/**
 * Shared shape of /api/txline/fixtures — imported by the route (server) and the matches lobby
 * (client). Types only; keep runtime logic out so nothing server-only leaks into the bundle.
 */

export interface LobbyFixture {
  /** TxLINE fixtureId — also the on-chain `match_id`, which is how the lobby finds live markets. */
  fixtureId: number;
  home: string;
  away: string;
  /** Kickoff in epoch milliseconds. */
  kickoffMs: number;
  competition?: string;
  /** Market proposition the keeper opens for this fixture ("<Home> to win …?"). */
  proposition?: string;
  /** TxLINE pre-match decimal line for the Yes/No proposition, when known. */
  odds?: { yes: number; no: number };
}

export interface FixturesPayload {
  /** "live" = TxLINE devnet snapshot; "sample" = bundled fixtures (no TXLINE_API_TOKEN). */
  source: "live" | "sample";
  competition: string;
  fixtures: LobbyFixture[];
}
