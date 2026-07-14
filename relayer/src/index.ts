import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { getProgram, marketPda, vaultPda } from "./anchorClient";
import { resolveOutcome, getFixtures, Outcome } from "./txline";
import { settleMarket } from "./settle";
import { connection, loadOracleKeypair, PRINCIPAL_MINT } from "./config";

const DECIMALS = 6;
const toBase = (human: number) => new anchor.BN(Math.round(human * 10 ** DECIMALS));

function usage() {
  console.log(`SafeXBets relayer — commands:

  list
      List all markets.

  list-fixtures [startEpochDay]
      List live World Cup fixtures from TxLINE (default epoch day 20624).

  create-market <matchId> "<proposition>" <kickoffUnix> [lockSecs]
      Open a Yes/No market. Requires PRINCIPAL_MINT in .env.

  seed-fixtures [startEpochDay] [count] [kickoffOffsetSecs] [lockSecs]
      Create markets from real TxLINE fixtures (match_id = fixtureId). Betting opens now+offset,
      so a past fixture (real result already available) can still be bet on and then settled live.

  accrue <marketPubkey> <yes|no> <humanAmount>
      Credit simulated yield to a pool (the demo "fast-forward").

  settle <marketPubkey> <yes|no|void>
  settle <marketPubkey> --from-txline <fixtureId>
      Settle a market explicitly, or from the live TxLINE score feed (offline fixture fallback).
`);
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (cmd === "list") {
    const { program } = getProgram();
    const markets = await program.account.market.all();
    if (markets.length === 0) return console.log("No markets yet.");
    for (const m of markets) {
      const a: any = m.account;
      const status = Object.keys(a.status)[0];
      console.log(
        `${m.publicKey.toBase58()}  "${a.proposition}"  [${status}]  ` +
          `YES=${a.yesPrincipal.toString()}  NO=${a.noPrincipal.toString()}`
      );
    }
    return;
  }

  if (cmd === "list-fixtures") {
    const startEpochDay = Number(args[0] ?? "20624");
    const fixtures = await getFixtures(startEpochDay);
    for (const fx of fixtures.slice(0, 25)) {
      console.log(
        `${fx.fixtureId}  ${fx.homeTeam} (H) vs ${fx.awayTeam}  @ ${new Date(fx.startTimeMs).toISOString()}`
      );
    }
    console.log(`(${fixtures.length} fixtures for epoch day ${startEpochDay})`);
    return;
  }

  if (cmd === "create-market") {
    if (!PRINCIPAL_MINT) throw new Error("Set PRINCIPAL_MINT in .env first.");
    const [matchIdStr, proposition, kickoff, lock] = args;
    const matchId = new anchor.BN(matchIdStr);
    const market = marketPda(matchId);
    const { program, wallet } = getProgram();
    await program.methods
      .initializeMarket(matchId, proposition, new anchor.BN(kickoff), new anchor.BN(lock ?? "0"))
      .accounts({ authority: wallet.publicKey, principalMint: PRINCIPAL_MINT, market, vault: vaultPda(market) })
      .rpc();
    console.log(`Market created: ${market.toBase58()}`);
    return;
  }

  if (cmd === "seed-fixtures") {
    if (!PRINCIPAL_MINT) throw new Error("Set PRINCIPAL_MINT in .env first.");
    const startEpochDay = Number(args[0] ?? "20624");
    const count = Number(args[1] ?? "3");
    const kickoffOffset = Number(args[2] ?? "600");
    const lock = new anchor.BN(args[3] ?? "120");
    const fixtures = await getFixtures(startEpochDay);
    const { program, wallet } = getProgram();
    const kickoff = new anchor.BN(Math.floor(Date.now() / 1000) + kickoffOffset);
    for (const fx of fixtures.slice(0, count)) {
      const matchId = new anchor.BN(fx.fixtureId);
      const market = marketPda(matchId);
      const proposition = `${fx.homeTeam} to win vs ${fx.awayTeam}`.slice(0, 64);
      try {
        await program.methods
          .initializeMarket(matchId, proposition, kickoff, lock)
          .accounts({ authority: wallet.publicKey, principalMint: PRINCIPAL_MINT, market, vault: vaultPda(market) })
          .rpc();
        console.log(`  ok  fixture ${fx.fixtureId}  "${proposition}"  -> ${market.toBase58()}`);
      } catch (e: any) {
        console.log(`  skip fixture ${fx.fixtureId}: ${e.message ?? e}`);
      }
    }
    console.log(`\nSettle with real scores later:  npm run settle -- <MARKET> --from-txline <fixtureId>`);
    return;
  }

  if (cmd === "accrue") {
    if (!PRINCIPAL_MINT) throw new Error("Set PRINCIPAL_MINT in .env first.");
    const [marketStr, sideStr, amountStr] = args;
    const market = new PublicKey(marketStr);
    const side = sideStr === "yes" ? { yes: {} } : { no: {} };
    const { program, wallet } = getProgram();
    const payer = loadOracleKeypair();
    const authorityToken = (
      await getOrCreateAssociatedTokenAccount(connection, payer, PRINCIPAL_MINT, wallet.publicKey)
    ).address;
    await program.methods
      .accrue(side as any, toBase(Number(amountStr)))
      .accounts({ authority: wallet.publicKey, market, vault: vaultPda(market), authorityToken })
      .rpc();
    console.log(`Accrued ${amountStr} to ${sideStr} pool of ${marketStr}`);
    return;
  }

  if (cmd === "settle") {
    const marketStr = args[0];
    const market = new PublicKey(marketStr);
    let outcome: Outcome;
    if (args[1] === "--from-txline") {
      const fixtureId = Number(args[2]);
      // Live feed when TXLINE_API_TOKEN is set, else offline fixture fallback.
      outcome = await resolveOutcome(fixtureId);
      console.log(`TxLINE resolved fixture ${fixtureId} -> ${outcome}`);
    } else {
      outcome = args[1] as Outcome;
    }
    const sig = await settleMarket(market, outcome);
    console.log(`Settled ${marketStr} as ${outcome}. tx: ${sig}`);
    return;
  }

  usage();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
