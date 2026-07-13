import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { SEED_MARKET, SEED_POSITION, SEED_VAULT } from "./constants";

/**
 * Program-derived addresses. Seeds must match the Rust program exactly:
 *   market   = ["market",   match_id as u64 little-endian]
 *   vault    = ["vault",    market]
 *   position = ["position", market, owner]
 */

export function marketPda(programId: PublicKey, matchId: BN): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_MARKET), matchId.toArrayLike(Buffer, "le", 8)],
    programId,
  )[0];
}

export function vaultPda(programId: PublicKey, market: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_VAULT), market.toBuffer()],
    programId,
  )[0];
}

export function positionPda(programId: PublicKey, market: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_POSITION), market.toBuffer(), owner.toBuffer()],
    programId,
  )[0];
}
