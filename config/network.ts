// The "flip a switch" config. Devnet uses MockYield + a mock-USDC mint; mainnet uses
// KaminoYield + real USDC. Nothing in the on-chain program changes between them.

export type Network = "devnet" | "mainnet-beta";
export type YieldSourceKind = "mock" | "kamino";

export interface AppConfig {
  network: Network;
  rpcUrl: string;
  programId: string;
  yieldSource: YieldSourceKind;
  /** Principal token: mock-USDC on devnet, real USDC on mainnet. */
  principalMint: string;
  lockPeriodSecs: number;
}

const PLACEHOLDER_PROGRAM_ID = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS";
const USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const DEVNET: AppConfig = {
  network: "devnet",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com",
  programId: process.env.NEXT_PUBLIC_PROGRAM_ID ?? PLACEHOLDER_PROGRAM_ID,
  yieldSource: "mock",
  principalMint: process.env.NEXT_PUBLIC_PRINCIPAL_MINT ?? "",
  lockPeriodSecs: 7 * 24 * 60 * 60,
};

const MAINNET: AppConfig = {
  network: "mainnet-beta",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.mainnet-beta.solana.com",
  programId: process.env.NEXT_PUBLIC_PROGRAM_ID ?? PLACEHOLDER_PROGRAM_ID,
  yieldSource: "kamino",
  principalMint: process.env.NEXT_PUBLIC_PRINCIPAL_MINT ?? USDC_MAINNET,
  lockPeriodSecs: 7 * 24 * 60 * 60,
};

// Flip via NEXT_PUBLIC_NETWORK (frontend) or NETWORK (relayer).
const selected =
  (process.env.NEXT_PUBLIC_NETWORK ?? process.env.NETWORK) === "mainnet-beta"
    ? MAINNET
    : DEVNET;

export const CONFIG: AppConfig = selected;
