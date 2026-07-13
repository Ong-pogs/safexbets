import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import idlJson from "@/idl/safexbets.json";
import { CONFIG } from "./config";

/**
 * Anchor client construction.
 *
 * The IDL is loaded from `src/idl/safexbets.json` (a placeholder on machines without the Anchor
 * toolchain; the Mac's `anchor build` copies the real one over it). We inject the runtime program
 * id from `NEXT_PUBLIC_PROGRAM_ID` so the deployed address always wins over whatever is baked into
 * the JSON. Anchor 0.30+ takes `new Program(idl, provider)` and reads the id from `idl.address`.
 */

export const PROGRAM_ID = new PublicKey(CONFIG.programId);

function idlForRuntime(): Idl {
  return { ...(idlJson as unknown as Idl), address: CONFIG.programId };
}

/** A wallet-backed program for sending transactions (`AnchorWallet` = what `useAnchorWallet` gives). */
export function getProgram(connection: Connection, wallet: AnchorWallet): Program<Idl> {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program(idlForRuntime(), provider);
}

/** A read-only program (no connected wallet) for fetching accounts. */
export function getReadonlyProgram(connection: Connection): Program<Idl> {
  // Reads (`account.x.all()`) never touch the wallet; a stub satisfies the provider's type.
  const stub = {
    publicKey: PublicKey.default,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  } as unknown as AnchorWallet;
  const provider = new AnchorProvider(connection, stub, { commitment: "confirmed" });
  return new Program(idlForRuntime(), provider);
}
