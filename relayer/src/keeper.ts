import * as anchor from "@coral-xyz/anchor";
import { getProgram, marketPda, vaultPda } from "./anchorClient";
import { getFixtures, resolveOutcome } from "./txline";
import { settleMarket } from "./settle";
import { PRINCIPAL_MINT } from "./config";

/**
 * Keeper — markets make themselves.
 *
 * Polls TxLINE and (a) opens a market for every upcoming fixture inside the horizon that
 * doesn't have one yet (kickoff = real StartTime), and (b) settles any of our markets whose
 * kickoff has passed as soon as TxLINE has a result. Run on the Mac (needs the oracle keypair):
 *
 *   npm run keeper           # loop forever (KEEPER_POLL_SECS, default 120)
 *   npm run keeper -- --once # single pass (good for cron)
 *
 * Env: KEEPER_HORIZON_HOURS (default 48) — how far ahead to open markets.
 */
const POLL_SECS = Number(process.env.KEEPER_POLL_SECS ?? 120);
const HORIZON_HOURS = Number(process.env.KEEPER_HORIZON_HOURS ?? 48);
const ONCE = process.argv.includes("--once");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function openUpcomingMarkets() {
  if (!PRINCIPAL_MINT) throw new Error("Set PRINCIPAL_MINT in .env first.");
  const { program, wallet } = getProgram();

  const epochDay = Math.floor(Date.now() / 86_400_000);
  let fixtures;
  try {
    fixtures = await getFixtures(epochDay - 1); // endpoint returns fixtures from that day onward
  } catch (e: any) {
    console.log(`[keeper] fixtures unavailable (${e.message ?? e}) — skipping open pass`);
    return;
  }

  const now = Date.now();
  const horizon = now + HORIZON_HOURS * 3_600_000;
  const upcoming = fixtures.filter((f) => f.startTimeMs > now + 60_000 && f.startTimeMs < horizon);

  for (const fx of upcoming) {
    const matchId = new anchor.BN(fx.fixtureId);
    const market = marketPda(matchId);
    if (await program.account.market.fetchNullable(market)) continue; // already open

    const proposition = `${fx.homeTeam} to win vs ${fx.awayTeam}`.slice(0, 64);
    try {
      await program.methods
        .initializeMarket(matchId, proposition, new anchor.BN(Math.floor(fx.startTimeMs / 1000)), new anchor.BN(0))
        .accounts({ authority: wallet.publicKey, principalMint: PRINCIPAL_MINT, market, vault: vaultPda(market) })
        .rpc();
      console.log(`[keeper] opened ${fx.fixtureId} "${proposition}" (kickoff ${new Date(fx.startTimeMs).toISOString()})`);
    } catch (e: any) {
      console.log(`[keeper] failed to open ${fx.fixtureId}: ${e.message ?? e}`);
    }
  }
}

async function settleFinishedMarkets() {
  const { program, wallet } = getProgram();
  const markets = await program.account.market.all();
  const now = Date.now();

  for (const m of markets) {
    const a: any = m.account;
    const status = Object.keys(a.status)[0];
    if (status !== "open" && status !== "locked") continue;
    if (a.kickoffTs.toNumber() * 1000 > now) continue;
    if (!a.authority.equals(wallet.publicKey)) continue; // only markets we authored

    const fixtureId = a.matchId.toNumber();
    let outcome;
    try {
      outcome = await resolveOutcome(fixtureId);
    } catch (e: any) {
      console.log(`[keeper] ${fixtureId}: result fetch failed (${e.message ?? e})`);
      continue;
    }
    if (outcome === "void") {
      console.log(`[keeper] ${fixtureId}: no final result yet`);
      continue;
    }
    try {
      const sig = await settleMarket(m.publicKey, outcome);
      console.log(`[keeper] settled ${fixtureId} -> ${outcome}  tx ${sig}`);
    } catch (e: any) {
      console.log(`[keeper] settle failed for ${fixtureId}: ${e.message ?? e}`);
    }
  }
}

async function main() {
  console.log(`[keeper] horizon ${HORIZON_HOURS}h · poll ${POLL_SECS}s · ${ONCE ? "single pass" : "looping"}`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await openUpcomingMarkets();
      await settleFinishedMarkets();
    } catch (e: any) {
      console.error(`[keeper] pass failed: ${e.message ?? e}`);
    }
    if (ONCE) break;
    await sleep(POLL_SECS * 1000);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
