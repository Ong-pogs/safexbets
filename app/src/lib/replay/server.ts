import bundledJson from "@/fixtures/replay-18187298.json";
import type { TrimmedReplay, TrimmedReplayEvent } from "./types";

/**
 * SERVER-ONLY replay source. Import this from route handlers / server components exclusively —
 * it reads `TXLINE_API_TOKEN` (a secret; no NEXT_PUBLIC_ prefix, never shipped to the browser)
 * and bundles the 53 KB devnet replay fixture, neither of which belongs in the client bundle.
 *
 * Resolution order for a fixture id:
 *   1. module-level cache
 *   2. live TxLINE devnet (guest JWT + X-Api-Token) when TXLINE_API_TOKEN is set —
 *      SSE-parsed and trimmed to the exact shape of the bundled fixture
 *   3. the bundled Brazil–Norway replay (fixture 18187298)
 *   4. null -> the caller 404s
 */

const TXLINE_JWT_URL = process.env.TXLINE_JWT_URL ?? "https://txline-dev.txodds.com/auth/guest/start";
const TXLINE_API_BASE = process.env.TXLINE_BASE_URL ?? "https://txline-dev.txodds.com/api";

export const BUNDLED_FIXTURE_ID = 18187298;
const bundledReplay = bundledJson as unknown as TrimmedReplay;

const replayCache = new Map<number, TrimmedReplay>();
let cachedJwt: string | null = null;

export async function loadReplay(fixtureId: number): Promise<TrimmedReplay | null> {
  const cached = replayCache.get(fixtureId);
  if (cached) return cached;

  if (process.env.TXLINE_API_TOKEN) {
    try {
      const live = await fetchLiveReplay(fixtureId, process.env.TXLINE_API_TOKEN);
      if (live && live.events.length > 0) {
        replayCache.set(fixtureId, live);
        return live;
      }
    } catch {
      // Live feed down/misconfigured — fall through to the bundled replay for the demo fixture.
    }
  }

  if (fixtureId === BUNDLED_FIXTURE_ID) {
    replayCache.set(fixtureId, bundledReplay);
    return bundledReplay;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Live TxLINE path (mirrors relayer/src/txline.ts auth + SSE parsing)
// ---------------------------------------------------------------------------

async function guestJwt(): Promise<string> {
  if (cachedJwt) return cachedJwt;
  const res = await fetch(TXLINE_JWT_URL, { method: "POST", cache: "no-store" });
  if (!res.ok) throw new Error(`TxLINE guest JWT failed: ${res.status}`);
  const token = ((await res.json()) as { token?: string }).token;
  if (!token) throw new Error("TxLINE guest JWT response had no token");
  cachedJwt = token;
  return token;
}

async function fetchLiveReplay(fixtureId: number, apiToken: string): Promise<TrimmedReplay | null> {
  const jwt = await guestJwt();
  const res = await fetch(`${TXLINE_API_BASE}/scores/historical/${fixtureId}`, {
    headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken },
    cache: "no-store",
  });
  if (res.status === 401) cachedJwt = null; // JWT expired — next call re-acquires
  if (!res.ok) return null;

  // scores/historical returns an SSE text stream: repeated "data: {json}" blocks.
  const raw: RawTxLineEvent[] = [];
  for (const line of (await res.text()).split("\n")) {
    const t = line.trim();
    if (!t.startsWith("data:")) continue;
    try {
      raw.push(JSON.parse(t.slice(5).trim()) as RawTxLineEvent);
    } catch {
      /* skip non-JSON keepalive lines */
    }
  }
  if (raw.length === 0) return null;
  return trimReplay(fixtureId, raw);
}

/** Raw TxLINE score event — PascalCase fields, only a subset confirmed (docs/TXLINE-API.md). */
interface RawTxLineEvent {
  Action?: string;
  GameState?: string;
  Participant1IsHome?: boolean;
  Participant1?: string;
  Participant2?: string;
  StartTime?: number;
  CompetitionId?: number;
  Timestamp?: number;
  Ts?: number;
  Time?: number;
  Text?: string;
  Outcome?: string;
  Type?: string;
  FreeKick?: string;
  Participant?: number;
  Stats?: Record<string, unknown>;
}

/** "CoverageUpdate" / "coverage update" -> "coverage_update" (bundled fixture vocabulary). */
const toSnake = (s: string): string =>
  s
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();

/**
 * Project raw SSE events onto the bundled-fixture shape: `{ts, action, text?, outcome?, type?,
 * freeKick?, participant?, stats?}` with `stats` kept only when the snapshot actually changed.
 * Field names beyond Action/Stats/Participant1IsHome are best-effort (untestable without a
 * token); the bundled path is the verified one.
 */
function trimReplay(fixtureId: number, raw: RawTxLineEvent[]): TrimmedReplay {
  let participant1IsHome = true;
  let participant1: string | undefined;
  let participant2: string | undefined;
  let startTimeMs: number | undefined;
  let competitionId: number | undefined;
  let lastStatsJson = "";

  const events: TrimmedReplayEvent[] = [];
  for (const r of raw) {
    if (typeof r.Participant1IsHome === "boolean") participant1IsHome = r.Participant1IsHome;
    if (typeof r.Participant1 === "string") participant1 = r.Participant1;
    if (typeof r.Participant2 === "string") participant2 = r.Participant2;
    if (typeof r.StartTime === "number") startTimeMs = r.StartTime;
    if (typeof r.CompetitionId === "number") competitionId = r.CompetitionId;
    if (!r.Action) continue;

    const e: TrimmedReplayEvent = {
      ts: r.Timestamp ?? r.Ts ?? r.Time ?? 0,
      action: toSnake(r.Action),
    };
    if (typeof r.Text === "string" && r.Text.trim()) e.text = r.Text;
    if (typeof r.Outcome === "string") e.outcome = r.Outcome;
    if (typeof r.Type === "string") e.type = r.Type;
    if (typeof r.FreeKick === "string") e.freeKick = r.FreeKick;
    if (typeof r.Participant === "number") e.participant = r.Participant;

    if (r.Stats && Object.keys(r.Stats).length > 0) {
      const stats: Record<string, number> = {};
      for (const [k, v] of Object.entries(r.Stats)) stats[k] = Number(v ?? 0) || 0;
      const json = JSON.stringify(stats);
      if (json !== lastStatsJson) {
        e.stats = stats; // snapshot-change events only, like the bundled fixture
        lastStatsJson = json;
      }
    }
    events.push(e);
  }

  const p1 = participant1 ?? "Home";
  const p2 = participant2 ?? "Away";
  return {
    meta: {
      fixtureId,
      home: participant1IsHome ? p1 : p2,
      away: participant1IsHome ? p2 : p1,
      participant1IsHome,
      startTimeMs,
      competitionId,
      source: "TxLINE devnet historical replay",
    },
    events,
  };
}
