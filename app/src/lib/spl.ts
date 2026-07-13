import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";

/**
 * Browser-safe stand-in for spl-token's `getOrCreateAssociatedTokenAccount`.
 *
 * That helper needs a `Keypair` payer to sign a standalone create transaction — which a
 * wallet-adapter connection doesn't expose (we only have `signTransaction`). So instead we derive
 * the ATA synchronously and, if it doesn't exist yet, hand back a create *instruction* to prepend
 * to the same transaction we're already asking the wallet to sign. The connected wallet is both
 * payer and owner.
 */
export async function ensureAtaIx(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
): Promise<{ ata: PublicKey; createIx: TransactionInstruction | null }> {
  const ata = getAssociatedTokenAddressSync(mint, owner);
  const info = await connection.getAccountInfo(ata);
  const createIx = info ? null : createAssociatedTokenAccountInstruction(owner, ata, owner, mint);
  return { ata, createIx };
}
