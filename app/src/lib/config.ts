/**
 * Frontend mirror of the repo-root `config/network.ts` "flip a switch" config.
 *
 * Kept as a standalone copy (instead of importing across the monorepo) so the Next app is
 * self-contained and only depends on browser-visible `NEXT_PUBLIC_*` env vars. The shape and
 * defaults intentionally match `config/network.ts`; change both together.
 */

export type Network = "devnet" | "mainnet-beta";
export type YieldSourceKind = "mock" | "kamino";

export interface AppConfig {
  network: Network;
  rpcUrl: string;
  programId: string;
  yieldSource: YieldSourceKind;
  /** Principal token: mock-USDC on devnet, real USDC on mainnet. */
  principalMint: string;
  /** Loser lock (seconds). 7 days by default; demo markets can pass a shorter value. */
  lockPeriodSecs: number;
}

const PLACEHOLDER_PROGRAM_ID = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS";
const USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SEVEN_DAYS = 7 * 24 * 60 * 60;

// NEXT_PUBLIC_* are statically inlined by Next at build time — reference them directly.
const NETWORK = (process.env.NEXT_PUBLIC_NETWORK as Network) ?? "devnet";

const DEVNET: AppConfig = {
  network: "devnet",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com",
  programId: process.env.NEXT_PUBLIC_PROGRAM_ID || PLACEHOLDER_PROGRAM_ID,
  yieldSource: "mock",
  principalMint: process.env.NEXT_PUBLIC_PRINCIPAL_MINT || "",
  lockPeriodSecs: SEVEN_DAYS,
};

const MAINNET: AppConfig = {
  network: "mainnet-beta",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
  programId: process.env.NEXT_PUBLIC_PROGRAM_ID || PLACEHOLDER_PROGRAM_ID,
  yieldSource: "kamino",
  principalMint: process.env.NEXT_PUBLIC_PRINCIPAL_MINT || USDC_MAINNET,
  lockPeriodSecs: SEVEN_DAYS,
};

export const CONFIG: AppConfig = NETWORK === "mainnet-beta" ? MAINNET : DEVNET;

/** True when the app is still pointed at the un-deployed placeholder program id. */
export const IS_PLACEHOLDER_PROGRAM = CONFIG.programId === PLACEHOLDER_PROGRAM_ID;
/** True when no principal mint has been configured yet (betting can't work without it). */
export const IS_PRINCIPAL_MINT_MISSING = CONFIG.principalMint.trim() === "";

/** Solana Explorer link helper (cluster-aware). */
export function explorerUrl(kind: "tx" | "address", value: string): string {
  const cluster = CONFIG.network === "mainnet-beta" ? "" : `?cluster=${CONFIG.network}`;
  return `https://explorer.solana.com/${kind}/${value}${cluster}`;
}
