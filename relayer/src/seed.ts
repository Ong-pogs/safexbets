import * as anchor from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import fs from "fs";
import path from "path";
import { getProgram, marketPda, vaultPda } from "./anchorClient";
import { connection, loadOracleKeypair, PRINCIPAL_MINT } from "./config";

// Push-button demo setup: fund two demo wallets and open a couple of markets.
// Run on the Mac after deploy + mint (docs/MAC-SETUP.md §3, §5). Requires PRINCIPAL_MINT in .env,
// and the oracle keypair must be the mock-USDC mint authority (it is, if you created the mint
// with the oracle wallet as authority).

const DECIMALS = 6;
const unit = 10 ** DECIMALS;

const DEMO_MARKETS = [
  { matchId: 1, proposition: "Brazil to win vs Japan" },
  { matchId: 2, proposition: "Argentina to win vs Mexico" },
];

function saveKeypair(name: string, kp: Keypair): string {
  const p = path.resolve(process.cwd(), `../keypairs/${name}.json`);
  fs.writeFileSync(p, JSON.stringify(Array.from(kp.secretKey)));
  return p;
}

async function fundWallet(name: string, mintAuthority: Keypair) {
  const kp = Keypair.generate();
  saveKeypair(name, kp);
  try {
    const sig = await connection.requestAirdrop(kp.publicKey, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig);
  } catch {
    console.warn(`  ! airdrop for ${name} hit the faucet limit — fund ${kp.publicKey.toBase58()} manually`);
  }
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    mintAuthority,
    PRINCIPAL_MINT!,
    kp.publicKey
  );
  try {
    await mintTo(connection, mintAuthority, PRINCIPAL_MINT!, ata.address, mintAuthority, 5000 * unit);
  } catch {
    // Not the mint authority (e.g. PRINCIPAL_MINT is Circle devnet USDC) — fund manually instead:
    console.warn(`  ! cannot mint ${PRINCIPAL_MINT!.toBase58()} — send USDC to ${kp.publicKey.toBase58()} via https://faucet.circle.com`);
  }
  return kp;
}

async function main() {
  if (!PRINCIPAL_MINT) {
    throw new Error("Set PRINCIPAL_MINT in .env first (see docs/MAC-SETUP.md §3).");
  }
  const { program, wallet } = getProgram();
  const authority = loadOracleKeypair();

  console.log("Funding demo wallets (5000 mock-USDC + 1 SOL each)...");
  const alice = await fundWallet("demo-alice", authority);
  const bob = await fundWallet("demo-bob", authority);

  const now = Math.floor(Date.now() / 1000);
  const kickoff = new anchor.BN(now + 120); // ~2 min of open betting
  const lock = new anchor.BN(120); //          2-min loser lock for a live demo

  console.log("Creating demo markets...");
  for (const m of DEMO_MARKETS) {
    const matchId = new anchor.BN(m.matchId);
    const market = marketPda(matchId);
    try {
      await program.methods
        .initializeMarket(matchId, m.proposition, kickoff, lock)
        .accounts({
          authority: wallet.publicKey,
          principalMint: PRINCIPAL_MINT,
          market,
          vault: vaultPda(market),
        })
        .rpc();
      console.log(`  ok  "${m.proposition}"  ->  ${market.toBase58()}`);
    } catch (e: any) {
      console.log(`  skip "${m.proposition}" (matchId ${m.matchId}) — may already exist: ${e.message ?? e}`);
    }
  }

  console.log("\nDemo ready:");
  console.log(`  Alice  ${alice.publicKey.toBase58()}   (keypairs/demo-alice.json)`);
  console.log(`  Bob    ${bob.publicKey.toBase58()}   (keypairs/demo-bob.json)`);
  console.log(`  Betting open ~120s; loser lock 120s.`);
  console.log(`\nNext: import demo-alice/demo-bob into your wallet, bet opposite sides, then after kickoff:`);
  console.log(`  npm run settle -- <MARKET> --from-txline 1     # Brazil 2-1 -> "yes"`);
  console.log(`  npm run accrue -- <MARKET> no 50               # stack the losers' yield`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
