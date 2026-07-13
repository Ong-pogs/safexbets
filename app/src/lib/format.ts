import { BN } from "@coral-xyz/anchor";
import { PRINCIPAL_DECIMALS, PRINCIPAL_UNIT } from "./constants";

/**
 * BN / decimal helpers. Principal is 6-decimal mock-USDC: on-chain amounts are integer "base
 * units" (1 USDC = 1_000_000 base units). Keep conversion in one place to avoid decimal drift.
 */

/** UI number (e.g. 12.5 USDC) -> on-chain base units BN. Rounds to whole base units. */
export function toBaseUnits(uiAmount: number): BN {
  if (!Number.isFinite(uiAmount) || uiAmount <= 0) return new BN(0);
  // Do the scaling in integer space to dodge floating-point error on the last decimals.
  const [whole, frac = ""] = uiAmount.toString().split(".");
  const fracPadded = (frac + "0".repeat(PRINCIPAL_DECIMALS)).slice(0, PRINCIPAL_DECIMALS);
  return new BN(whole).mul(new BN(PRINCIPAL_UNIT)).add(new BN(fracPadded || "0"));
}

/** On-chain base units BN -> UI number (may lose precision for display; fine for < 2^53). */
export function toUiAmount(base: BN | number): number {
  const n = typeof base === "number" ? base : base.toNumber();
  return n / PRINCIPAL_UNIT;
}

/** Format base units as a grouped USDC string, e.g. 1234500000 -> "1,234.50". */
export function formatUsdc(base: BN | number, opts: { decimals?: number } = {}): string {
  const decimals = opts.decimals ?? 2;
  return toUiAmount(base).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Compact USDC for tight scoreboard cells, e.g. 12_500 -> "12.5K". */
export function formatUsdcCompact(base: BN | number): string {
  const v = toUiAmount(base);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Parimutuel pool share as a fraction 0..1. Even (0.5) when the market is empty. */
export function poolShare(sidePool: BN, otherPool: BN): number {
  const total = sidePool.add(otherPool);
  if (total.isZero()) return 0.5;
  // Scale up before dividing so BN integer division keeps precision.
  return sidePool.mul(new BN(1_000_000)).div(total).toNumber() / 1_000_000;
}

/** Percentage string from a 0..1 fraction. */
export function pct(fraction: number, decimals = 0): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/** Parimutuel "decimal odds" implied by a pool share (1 / probability). */
export function impliedDecimalOdds(share: number): number {
  if (share <= 0) return 0;
  return 1 / share;
}

/**
 * Winner's pro-rata cut of the losing pool's yield, mirroring `claim.rs`:
 *   share = loserYield * positionPrincipal / winnerPoolPrincipal
 * Returned in base units as a BN.
 */
export function proRataYieldShare(loserYield: BN, positionPrincipal: BN, winnerPool: BN): BN {
  if (winnerPool.isZero()) return new BN(0);
  return loserYield.mul(positionPrincipal).div(winnerPool);
}

/** Shorten a pubkey/base58 string for display: "Fg6P…sLnS". */
export function shortAddr(addr: string, lead = 4, tail = 4): string {
  if (addr.length <= lead + tail + 1) return addr;
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

/** Seconds (unix) remaining until a target; negative once passed. */
export function secondsUntil(targetUnix: number): number {
  return targetUnix - Math.floor(Date.now() / 1000);
}

/**
 * Human countdown from a seconds delta. Match-clock feel: "2d 04h", "58:12", "12s".
 * Negative deltas return "0s".
 */
export function formatCountdown(deltaSecs: number): string {
  let s = Math.max(0, Math.floor(deltaSecs));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}h`;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

/** Local date-time string for a unix timestamp. */
export function formatDateTime(unix: number): string {
  return new Date(unix * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
