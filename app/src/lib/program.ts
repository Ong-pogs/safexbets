import { BN, Idl, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { marketPda, positionPda, vaultPda } from "./pdas";
import { ensureAtaIx } from "./spl";
import {
  MarketRecord,
  OUTCOME_ARG,
  PositionRecord,
  SIDE_ARG,
  SideKey,
} from "./types";

/**
 * High-level program operations. All Anchor `methods`/`account` access is funnelled through here
 * and cast to `any` in one place, because we build the client from an untyped IDL (no generated
 * types on the Windows box). Callers get typed inputs and `MarketRecord` / `PositionRecord`
 * outputs. Account name sets mirror `tests/safexbets.ts`, which is verified against the program.
 */

type AnyProgram = Program<Idl>;
// Built from an untyped IDL (no generated types on the Windows box), so the methods/account
// namespaces are reached through `any` in this one place; callers stay fully typed via the
// `MarketRecord` / `PositionRecord` return types and typed params below.
const methods = (p: AnyProgram): any => (p as any).methods;
const accounts = (p: AnyProgram): any => (p as any).account;

// ---------- reads ----------

export async function fetchMarkets(program: AnyProgram): Promise<MarketRecord[]> {
  const rows = (await accounts(program).market.all()) as MarketRecord[];
  // Newest kickoff first — demo markets (created "now") float to the top.
  return rows.sort((a, b) => b.account.kickoffTs.cmp(a.account.kickoffTs));
}

export async function fetchPositionsByOwner(
  program: AnyProgram,
  owner: PublicKey,
): Promise<PositionRecord[]> {
  // Position layout: 8 (discriminator) + 32 (market) + 32 (owner) ⇒ owner starts at byte 40.
  const rows = (await accounts(program).position.all([
    { memcmp: { offset: 40, bytes: owner.toBase58() } },
  ])) as PositionRecord[];
  return rows;
}

// ---------- writes (return the tx signature) ----------

export async function sendInitializeMarket(
  program: AnyProgram,
  p: {
    authority: PublicKey;
    matchId: BN;
    proposition: string;
    kickoffTs: BN;
    lockPeriod: BN;
    principalMint: PublicKey;
  },
): Promise<string> {
  const market = marketPda(program.programId, p.matchId);
  const vault = vaultPda(program.programId, market);
  return methods(program)
    .initializeMarket(p.matchId, p.proposition, p.kickoffTs, p.lockPeriod)
    .accounts({
      authority: p.authority,
      principalMint: p.principalMint,
      market,
      vault,
    })
    .rpc();
}

export async function sendPlaceBet(
  program: AnyProgram,
  connection: Connection,
  p: {
    bettor: PublicKey;
    market: PublicKey;
    side: SideKey;
    amount: BN;
    principalMint: PublicKey;
  },
): Promise<string> {
  const vault = vaultPda(program.programId, p.market);
  const position = positionPda(program.programId, p.market, p.bettor);
  const { ata, createIx } = await ensureAtaIx(connection, p.bettor, p.principalMint);
  const builder = methods(program)
    .placeBet(SIDE_ARG[p.side], p.amount)
    .accounts({
      bettor: p.bettor,
      market: p.market,
      vault,
      bettorToken: ata,
      position,
    });
  if (createIx) builder.preInstructions([createIx]);
  return builder.rpc();
}

export async function sendAccrue(
  program: AnyProgram,
  connection: Connection,
  p: {
    authority: PublicKey;
    market: PublicKey;
    side: SideKey;
    amount: BN;
    principalMint: PublicKey;
  },
): Promise<string> {
  const vault = vaultPda(program.programId, p.market);
  const { ata, createIx } = await ensureAtaIx(connection, p.authority, p.principalMint);
  const builder = methods(program)
    .accrue(SIDE_ARG[p.side], p.amount)
    .accounts({
      authority: p.authority,
      market: p.market,
      vault,
      authorityToken: ata,
    });
  if (createIx) builder.preInstructions([createIx]);
  return builder.rpc();
}

export async function sendSettle(
  program: AnyProgram,
  p: { authority: PublicKey; market: PublicKey; outcome: "yes" | "no" | "void" },
): Promise<string> {
  return methods(program)
    .settle(OUTCOME_ARG[p.outcome])
    .accounts({ authority: p.authority, market: p.market })
    .rpc();
}

export async function sendClaim(
  program: AnyProgram,
  connection: Connection,
  p: { owner: PublicKey; market: PublicKey; principalMint: PublicKey },
): Promise<string> {
  const vault = vaultPda(program.programId, p.market);
  const position = positionPda(program.programId, p.market, p.owner);
  const { ata, createIx } = await ensureAtaIx(connection, p.owner, p.principalMint);
  const builder = methods(program)
    .claim()
    .accounts({
      owner: p.owner,
      market: p.market,
      vault,
      position,
      ownerToken: ata,
    });
  if (createIx) builder.preInstructions([createIx]);
  return builder.rpc();
}

export async function sendWithdrawPrincipal(
  program: AnyProgram,
  connection: Connection,
  p: { owner: PublicKey; market: PublicKey; principalMint: PublicKey },
): Promise<string> {
  const vault = vaultPda(program.programId, p.market);
  const position = positionPda(program.programId, p.market, p.owner);
  const { ata, createIx } = await ensureAtaIx(connection, p.owner, p.principalMint);
  const builder = methods(program)
    .withdrawPrincipal()
    .accounts({
      owner: p.owner,
      market: p.market,
      vault,
      position,
      ownerToken: ata,
    });
  if (createIx) builder.preInstructions([createIx]);
  return builder.rpc();
}
