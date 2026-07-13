import type { BN } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";

/**
 * Decoded account shapes. Anchor camelCases Rust field names and represents Rust enums as
 * single-key objects, e.g. `Side::Yes` -> `{ yes: {} }`. These interfaces mirror
 * `programs/safexbets/src/state.rs`.
 */

export type SideEnum = { yes: Record<string, never> } | { no: Record<string, never> };
export type StatusEnum =
  | { open: Record<string, never> }
  | { locked: Record<string, never> }
  | { settled: Record<string, never> }
  | { void: Record<string, never> };
export type OutcomeEnum =
  | { unset: Record<string, never> }
  | { yes: Record<string, never> }
  | { no: Record<string, never> }
  | { void: Record<string, never> };

export type SideKey = "yes" | "no";
export type StatusKey = "open" | "locked" | "settled" | "void";
export type OutcomeKey = "unset" | "yes" | "no" | "void";

export interface MarketAccount {
  authority: PublicKey;
  matchId: BN;
  proposition: string;
  principalMint: PublicKey;
  vault: PublicKey;
  kickoffTs: BN;
  lockPeriod: BN;
  status: StatusEnum;
  outcome: OutcomeEnum;
  winnerSide: SideEnum | null;
  yesPrincipal: BN;
  noPrincipal: BN;
  yesYield: BN;
  noYield: BN;
  loserUnlockTs: BN;
  settledTs: BN;
  bump: number;
}

export interface PositionAccount {
  market: PublicKey;
  owner: PublicKey;
  side: SideEnum;
  principal: BN;
  principalWithdrawn: boolean;
  yieldClaimed: boolean;
  bump: number;
}

export interface MarketRecord {
  publicKey: PublicKey;
  account: MarketAccount;
}
export interface PositionRecord {
  publicKey: PublicKey;
  account: PositionAccount;
}

/** Read the active variant name from an Anchor enum object. */
export function enumKey<T extends string>(e: Record<string, unknown> | null | undefined): T | null {
  if (!e) return null;
  const k = Object.keys(e)[0];
  return (k as T) ?? null;
}

export const sideKey = (s: SideEnum | null | undefined): SideKey | null => enumKey<SideKey>(s);
export const statusKey = (s: StatusEnum): StatusKey => enumKey<StatusKey>(s) ?? "open";
export const outcomeKey = (o: OutcomeEnum): OutcomeKey => enumKey<OutcomeKey>(o) ?? "unset";

/** Anchor enum argument builders (what the program expects as instruction input). */
export const SIDE_ARG: Record<SideKey, SideEnum> = { yes: { yes: {} }, no: { no: {} } };
export const OUTCOME_ARG = {
  yes: { yes: {} },
  no: { no: {} },
  void: { void: {} },
} as const;
