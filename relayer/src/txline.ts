import fs from "fs";
import path from "path";

export type Outcome = "yes" | "no" | "void";

// Devnet TxLINE endpoints (see docs/TXLINE-API.md). Overridable via env.
const API_BASE_URL = process.env.TXLINE_BASE_URL ?? "https://txline-dev.txodds.com/api";
const JWT_URL = process.env.TXLINE_JWT_URL ?? "https://txline-dev.txodds.com/auth/guest/start";
const WORLD_CUP_COMPETITION_ID = 72;

let cachedJwt: string | null = null;

async function guestJwt(): Promise<string> {
  if (cachedJwt) return cachedJwt;
  const res = await fetch(JWT_URL, { method: "POST" });
  if (!res.ok) throw new Error(`TxLINE guest JWT failed: ${res.status}`);
  cachedJwt = ((await res.json()) as any).token;
  return cachedJwt!;
}

function apiToken(): string {
  const t = process.env.TXLINE_API_TOKEN;
  if (!t) {
    throw new Error(
      "TXLINE_API_TOKEN not set (see docs/TXLINE-API.md). Use offline fixtures via `--fixture`."
    );
  }
  return t;
}

async function authedGet(pathname: string): Promise<Response> {
  const jwt = await guestJwt();
  const res = await fetch(`${API_BASE_URL}${pathname}`, {
    headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken() },
  });
  if (res.status === 401) cachedJwt = null; // JWT expired — next call re-acquires
  return res;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export interface TxFixture {
  fixtureId: number;
  competition: string;
  participant1: string;
  participant2: string;
  participant1IsHome: boolean;
  startTimeMs: number;
  homeTeam: string;
  awayTeam: string;
}

export async function getFixtures(
  startEpochDay: number,
  competitionId = WORLD_CUP_COMPETITION_ID
): Promise<TxFixture[]> {
  const res = await authedGet(
    `/fixtures/snapshot?competitionId=${competitionId}&startEpochDay=${startEpochDay}`
  );
  if (!res.ok) throw new Error(`TxLINE fixtures failed: ${res.status}`);
  const rows = ((await res.json()) as any[]) ?? [];
  return rows.map((f) => ({
    fixtureId: f.FixtureId,
    competition: f.Competition,
    participant1: f.Participant1,
    participant2: f.Participant2,
    participant1IsHome: !!f.Participant1IsHome,
    startTimeMs: f.StartTime,
    homeTeam: f.Participant1IsHome ? f.Participant1 : f.Participant2,
    awayTeam: f.Participant1IsHome ? f.Participant2 : f.Participant1,
  }));
}

// ---------------------------------------------------------------------------
// Scores / settlement
// ---------------------------------------------------------------------------

// scores/historical returns an SSE text stream: repeated "data: {json}" blocks.
function parseSseEvents(text: string): any[] {
  const events: any[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.startsWith("data:")) {
      try {
        events.push(JSON.parse(t.slice(5).trim()));
      } catch {
        /* skip non-JSON keepalive lines */
      }
    }
  }
  return events;
}

function statNum(stats: any, key: string): number {
  const v = stats?.[key];
  return typeof v === "number" ? v : Number(v ?? 0) || 0;
}

/**
 * Resolve a fixture's final result to our "Home to win?" proposition.
 *   home wins             -> "yes"
 *   draw / away wins       -> "no"
 *   no score data / error  -> "void"
 *
 * Soccer `Stats` is a flat map (period prefix 0 = Total): key "1"/"2" = P1/P2 total goals,
 * "6001"/"6002" = penalty-shootout goals (see docs/TXLINE-API.md). Winner = higher goals; if
 * level, penalties break it; still level = genuine draw -> No.
 *
 * Note: devnet keeps GameState = "scheduled" even on completed replays, so we settle from the
 * latest non-empty Stats snapshot rather than gating on GameState. On mainnet you may additionally
 * require GameState to be a finished phase (F/FET/FPE) before settling.
 */
async function resolveFromTxLine(fixtureId: number): Promise<Outcome> {
  const res = await authedGet(`/scores/historical/${fixtureId}`);
  if (!res.ok) throw new Error(`TxLINE scores failed: ${res.status}`);
  const events = parseSseEvents(await res.text());
  if (events.length === 0) return "void";

  let stats: any = null;
  let p1IsHome: boolean | null = null;
  for (const e of events) {
    if (e.Stats && Object.keys(e.Stats).length) stats = e.Stats;
    if (typeof e.Participant1IsHome === "boolean") p1IsHome = e.Participant1IsHome;
  }
  if (!stats || p1IsHome === null) return "void";

  const p1 = statNum(stats, "1");
  const p2 = statNum(stats, "2");
  const p1pen = statNum(stats, "6001");
  const p2pen = statNum(stats, "6002");

  let p1Wins: boolean;
  if (p1 !== p2) p1Wins = p1 > p2;
  else if (p1pen !== p2pen) p1Wins = p1pen > p2pen; // shootout
  else return "no"; // genuine draw -> "Home to win?" is No

  const homeWins = p1IsHome ? p1Wins : !p1Wins;
  return homeWins ? "yes" : "no";
}

/**
 * Resolve a match. Live TxLINE feed when TXLINE_API_TOKEN is set and not forced to fixture mode,
 * else the offline fixture in fixtures/txline.sample.json. `matchId` must equal the TxLINE fixtureId.
 */
export async function resolveOutcome(
  matchId: number,
  opts?: { fixture?: boolean }
): Promise<Outcome> {
  if (!opts?.fixture && process.env.TXLINE_API_TOKEN) {
    return resolveFromTxLine(matchId);
  }
  const fxPath = path.resolve(__dirname, "../fixtures/txline.sample.json");
  const fx: any[] = JSON.parse(fs.readFileSync(fxPath, "utf-8"));
  const m = fx.find((x) => x.matchId === matchId);
  if (!m || m.status !== "finished") return "void";
  return m.homeScore > m.awayScore ? "yes" : "no";
}
