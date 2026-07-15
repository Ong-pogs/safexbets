import { BN } from "@coral-xyz/anchor";
import { proRataYieldShare, secondsUntil } from "./format";
import {
  MarketAccount,
  PositionAccount,
  sideKey,
  statusKey,
} from "./types";

/**
 * Pure UI-side mirror of the program's settlement/payout rules (state.rs + claim.rs + withdraw.rs).
 * Never authoritative — the chain is — but lets the UI show accurate buttons and estimates.
 */

export function bettingOpen(m: MarketAccount): boolean {
  return statusKey(m.status) === "open" && secondsUntil(m.kickoffTs.toNumber()) > 0;
}

/**
 * The market's demo-facing phase. The program has no separate "lock" transition, so an Open market
 * past kickoff is betting-closed-but-unsettled ("in play / awaiting result").
 */
export type MarketPhase = "betting" | "in_play" | "settled" | "void";

export function marketPhase(m: MarketAccount, now: number): MarketPhase {
  const s = statusKey(m.status);
  if (s === "settled") return "settled";
  if (s === "void") return "void";
  return now < m.kickoffTs.toNumber() ? "betting" : "in_play";
}

export function totalPrincipal(m: MarketAccount): BN {
  return m.yesPrincipal.add(m.noPrincipal);
}

export function totalYield(m: MarketAccount): BN {
  return m.yesYield.add(m.noYield);
}

/**
 * The prize pot winners share. Post-settle it's exactly the losing side's accrued yield; pre-settle
 * we show all yield accrued so far (what's "on the table").
 */
export function prizePot(m: MarketAccount): BN {
  const w = sideKey(m.winnerSide);
  if (w === "yes") return m.noYield;
  if (w === "no") return m.yesYield;
  return totalYield(m);
}

export type PositionRole = "pending" | "winner" | "loser" | "void";

export function positionRole(m: MarketAccount, pos: PositionAccount): PositionRole {
  const status = statusKey(m.status);
  if (status === "void") return "void";
  if (status !== "settled") return "pending";
  return sideKey(pos.side) === sideKey(m.winnerSide) ? "winner" : "loser";
}

/** Winner payout estimate = principal (if unwithdrawn) + pro-rata loser yield (if unclaimed). */
export function claimEstimate(m: MarketAccount, pos: PositionAccount): BN {
  let payout = new BN(0);
  if (!pos.principalWithdrawn) payout = payout.add(pos.principal);
  if (!pos.yieldClaimed) {
    const w = sideKey(m.winnerSide);
    const loserYield = w === "yes" ? m.noYield : m.yesYield;
    const winnerPool = w === "yes" ? m.yesPrincipal : m.noPrincipal;
    payout = payout.add(proRataYieldShare(loserYield, pos.principal, winnerPool));
  }
  return payout;
}

/** Just the bonus (yield) portion of a winner's payout. */
export function bonusEstimate(m: MarketAccount, pos: PositionAccount): BN {
  const w = sideKey(m.winnerSide);
  const loserYield = w === "yes" ? m.noYield : m.yesYield;
  const winnerPool = w === "yes" ? m.yesPrincipal : m.noPrincipal;
  return proRataYieldShare(loserYield, pos.principal, winnerPool);
}

export function canClaim(m: MarketAccount, pos: PositionAccount): boolean {
  if (statusKey(m.status) !== "settled") return false;
  if (sideKey(m.winnerSide) !== sideKey(pos.side)) return false;
  return !pos.principalWithdrawn || !pos.yieldClaimed;
}

export function isLockedLoser(m: MarketAccount, pos: PositionAccount): boolean {
  return (
    statusKey(m.status) === "settled" &&
    sideKey(pos.side) !== sideKey(m.winnerSide) &&
    !pos.principalWithdrawn &&
    secondsUntil(m.loserUnlockTs.toNumber()) > 0
  );
}

export function canWithdraw(m: MarketAccount, pos: PositionAccount): boolean {
  if (pos.principalWithdrawn) return false;
  const status = statusKey(m.status);
  if (status === "void") return true; // refunds open to everyone, no lock
  if (status === "settled" && sideKey(pos.side) !== sideKey(m.winnerSide)) {
    return secondsUntil(m.loserUnlockTs.toNumber()) <= 0;
  }
  return false;
}

/**
 * Betslip-style position state for My Bets:
 *   open        — market unsettled; principal working in the vault
 *   claimable   — winner with principal and/or prize still to collect
 *   locked      — loser inside the lock window (countdown to 100% recovery)
 *   recoverable — loser past the lock, principal ready to withdraw
 *   collected   — winner, fully paid out
 *   recovered   — principal withdrawn (loser after lock, or void refund taken)
 *   void        — market voided, refund available anytime
 */
export type PositionState =
  | "open"
  | "claimable"
  | "locked"
  | "recoverable"
  | "collected"
  | "recovered"
  | "void";

export function positionState(m: MarketAccount, pos: PositionAccount): PositionState {
  const role = positionRole(m, pos);
  if (role === "pending") return "open";
  if (role === "winner") return canClaim(m, pos) ? "claimable" : "collected";
  if (role === "void") return pos.principalWithdrawn ? "recovered" : "void";
  // loser
  if (pos.principalWithdrawn) return "recovered";
  return isLockedLoser(m, pos) ? "locked" : "recoverable";
}
