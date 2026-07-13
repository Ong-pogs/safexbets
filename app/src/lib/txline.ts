import fixtureJson from "@/fixtures/txline.json";

/**
 * TxLINE odds feed — the TxODDS live football data source.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  SINGLE SWAP POINT. Today this reads a local fixture (no API key yet).         │
 * │  To go live: change ONLY `getTxLineFeed()` below to `fetch()` the real TxLINE  │
 * │  endpoint and map the response into `TxLineMatch[]`. Every consumer already    │
 * │  depends on this shape, so nothing else in the app changes.                    │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */

export interface TxLineMatch {
  /** External match id — also used as the on-chain `match_id` so a market links to its line. */
  matchId: number;
  home: string;
  away: string;
  kickoffTs: number;
  proposition: string;
  line: string;
  /** Decimal (European) odds for the Yes/No proposition. */
  odds: { yes: number; no: number };
}

/** Normalized implied probabilities (bookmaker overround removed), each 0..1. */
export interface TxLineImplied {
  yes: number;
  no: number;
}

const FIXTURE = fixtureJson as {
  source?: string;
  competition?: string;
  updatedAt?: string;
  matches: TxLineMatch[];
};

export const TXLINE_LABEL = FIXTURE.source ?? "TxLINE (fixture)";
export const TXLINE_COMPETITION = FIXTURE.competition ?? "";
export const TXLINE_UPDATED_AT = FIXTURE.updatedAt ?? "";
/** Flip to true once `getTxLineFeed` calls the real API (drives the "fixture" labelling). */
export const TXLINE_IS_LIVE = false;

export function getTxLineFeed(): TxLineMatch[] {
  return FIXTURE.matches ?? [];
}

export function getTxLineForMatch(matchId: number): TxLineMatch | undefined {
  return getTxLineFeed().find((m) => m.matchId === matchId);
}

/** Strip the bookmaker overround so Yes+No implied probabilities sum to 1 (comparable to pools). */
export function impliedFromOdds(odds: { yes: number; no: number }): TxLineImplied {
  const rawYes = odds.yes > 0 ? 1 / odds.yes : 0;
  const rawNo = odds.no > 0 ? 1 / odds.no : 0;
  const sum = rawYes + rawNo;
  if (sum <= 0) return { yes: 0.5, no: 0.5 };
  return { yes: rawYes / sum, no: rawNo / sum };
}
