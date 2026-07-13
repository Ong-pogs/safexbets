import { PublicKey } from "@solana/web3.js";
import { getProgram } from "./anchorClient";
import { Outcome } from "./txline";

/**
 * Post the settlement result on-chain (authority-signed, v1).
 *
 * Hero upgrade (Phase 4): instead of trusting the authority signature, attach a
 * TxODDS-signed payload and verify it in-program via the Ed25519 program. The trust
 * root is still this relayer's key unless TxODDS provides signing keys, so this is a
 * verifiability upgrade — see docs/SPEC.md §5 and PLAN.md Phase 4.
 */
export async function settleMarket(market: PublicKey, outcome: Outcome): Promise<string> {
  const { program, wallet } = getProgram();
  const outArg =
    outcome === "yes" ? { yes: {} } : outcome === "no" ? { no: {} } : { void: {} };

  return program.methods
    .settle(outArg as any)
    .accounts({ authority: wallet.publicKey, market })
    .rpc();
}
