import * as dotenv from "dotenv";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";

// Load repo-root .env (the relayer runs from ./relayer).
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

export const NETWORK = process.env.NETWORK ?? "devnet";
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ??
  process.env.RPC_URL ??
  (NETWORK === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com");

export const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID ?? "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
);

export const PRINCIPAL_MINT = process.env.PRINCIPAL_MINT
  ? new PublicKey(process.env.PRINCIPAL_MINT)
  : null;

export const connection = new Connection(RPC_URL, "confirmed");

export function loadOracleKeypair(): Keypair {
  const p = process.env.ORACLE_KEYPAIR ?? "../keypairs/oracle.json";
  const resolved = path.resolve(process.cwd(), p);
  const secret = JSON.parse(fs.readFileSync(resolved, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}
