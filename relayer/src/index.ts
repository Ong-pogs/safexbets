import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { getProgram, marketPda, vaultPda } from "./anchorClient";
import { resolveOutcome, Outcome } from "./txline";
import { settleMarket } from "./settle";
import { connection, loadOracleKeypair, PRINCIPAL_MINT } from "./config";

const DECIMALS = 6;
const toBase = (human: number) => new anchor.BN(Math.round(human * 10 ** DECIMALS));

function usage() {
  console.log(`SafeXBets relayer — commands:

  list
      List all markets.

  create-market <matchId> "<proposition>" <kickoffUnix> [lockSecs]
      Open a Yes/No market. Requires PRINCIPAL_MINT in .env.

  accrue <marketPubkey> <yes|no> <humanAmount>
      Credit simulated yield to a pool (the demo "fast-forward").

  settle <marketPubkey> <yes|no|void>
  settle <marketPubkey> --from-txline <matchId>
      Settle a market, either explicitly or from the TxLINE feed/fixture.
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

  if (cmd === "create-market") {
    if (!PRINCIPAL_MINT) throw new Error("Set PRINCIPAL_MINT in .env first.");
    const [matchIdStr, proposition, kickoff, lock] = args;
    const matchId = new anchor.BN(matchIdStr);
    const market = marketPda(matchId);
    const vault = vaultPda(market);
    const { program, wallet } = getProgram();
    await program.methods
      .initializeMarket(
        matchId,
        proposition,
        new anchor.BN(kickoff),
        new anchor.BN(lock ?? "0")
      )
      .accounts({
        authority: wallet.publicKey,
        principalMint: PRINCIPAL_MINT,
        market,
        vault,
      })
      .rpc();
    console.log(`Market created: ${market.toBase58()}`);
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
      outcome = await resolveOutcome(Number(args[2]), { fixture: true });
      console.log(`TxLINE resolved match ${args[2]} -> ${outcome}`);
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
