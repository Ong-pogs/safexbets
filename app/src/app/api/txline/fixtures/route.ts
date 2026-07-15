import { NextResponse } from "next/server";
import fixtureJson from "@/fixtures/txline.json";
import type { FixturesPayload, LobbyFixture } from "@/lib/lobby";
import { BUNDLED_FIXTURE_ID, txlineGet } from "@/lib/replay/server";

/**
 * GET /api/txline/fixtures — the matches-lobby feed.
 *
 * Live path (TXLINE_API_TOKEN set, server-side only): TxLINE devnet
 * `/fixtures/snapshot?competitionId=72&startEpochDay=<yesterday>` via the shared guest-JWT auth
 * in lib/replay/server.ts, trimmed to the LobbyFixture shape and cached in-process for 5 minutes.
 *
 * Fallback (no token / feed down): the bundled sample — fixture 18187298 (Brazil vs Norway, the
 * replay fixture) at its real historical kickoff, plus the demo fixtures from src/fixtures/
 * txline.json re-timed onto the next ~48h so the lobby always has an upcoming slate. The payload
 * is labelled `source: "sample"` and the UI says so.
 */

export const dynamic = "force-dynamic";

const WORLD_CUP_COMPETITION_ID = 72; // matches relayer/src/txline.ts
const CACHE_TTL_MS = 5 * 60_000;

let cachedLive: { at: number; payload: FixturesPayload } | null = null;

const SAMPLE = fixtureJson as {
  competition?: string;
  matches: Array<{
    matchId: number;
    home: string;
    away: string;
    kickoffTs: number;
    proposition: string;
    odds: { yes: number; no: number };
  }>;
};

export async function GET(): Promise<NextResponse> {
  try {
    const live = await loadLiveFixtures();
    if (live && live.fixtures.length > 0) return NextResponse.json(live);
  } catch {
    // Feed down/misconfigured — the bundled sample keeps the lobby alive.
  }
  return NextResponse.json(sampleFixtures());
}

/** Raw TxLINE fixtures-snapshot row — PascalCase fields (docs/TXLINE-API.md, relayer-confirmed). */
interface RawFixtureRow {
  FixtureId?: number;
  Competition?: string;
  Participant1?: string;
  Participant2?: string;
  Participant1IsHome?: boolean;
  StartTime?: number;
}

async function loadLiveFixtures(): Promise<FixturesPayload | null> {
  if (cachedLive && Date.now() - cachedLive.at < CACHE_TTL_MS) return cachedLive.payload;

  const epochDay = Math.floor(Date.now() / 86_400_000);
  const res = await txlineGet(
    `/fixtures/snapshot?competitionId=${WORLD_CUP_COMPETITION_ID}&startEpochDay=${epochDay - 1}`,
  );
  if (!res || !res.ok) return null;

  const rows = ((await res.json()) as RawFixtureRow[]) ?? [];
  const sampleById = new Map(SAMPLE.matches.map((m) => [m.matchId, m]));

  const fixtures: LobbyFixture[] = rows
    .filter((r) => typeof r.FixtureId === "number" && typeof r.StartTime === "number")
    .map((r) => {
      const p1 = r.Participant1 ?? "Home";
      const p2 = r.Participant2 ?? "Away";
      const p1Home = r.Participant1IsHome !== false;
      const home = p1Home ? p1 : p2;
      const away = p1Home ? p2 : p1;
      const known = sampleById.get(r.FixtureId!);
      return {
        fixtureId: r.FixtureId!,
        home,
        away,
        kickoffMs: r.StartTime!,
        competition: r.Competition,
        proposition: known?.proposition ?? `${home} to win vs ${away}?`,
        // The snapshot has no odds; attach the bundled line when we know this fixture.
        ...(known ? { odds: known.odds } : {}),
      };
    });

  // Always carry the bundled replay fixture — the one Match Center guaranteed to work — even when
  // the live snapshot window (yesterday onward) no longer includes it.
  if (!fixtures.some((f) => f.fixtureId === BUNDLED_FIXTURE_ID)) {
    const replayFixture = sampleById.get(BUNDLED_FIXTURE_ID);
    if (replayFixture) {
      fixtures.push({
        fixtureId: replayFixture.matchId,
        home: replayFixture.home,
        away: replayFixture.away,
        kickoffMs: replayFixture.kickoffTs * 1000,
        competition: SAMPLE.competition,
        proposition: replayFixture.proposition,
        odds: replayFixture.odds,
      });
    }
  }
  fixtures.sort((a, b) => a.kickoffMs - b.kickoffMs);

  const payload: FixturesPayload = {
    source: "live",
    competition: SAMPLE.competition ?? "FIFA World Cup 2026",
    fixtures,
  };
  cachedLive = { at: Date.now(), payload };
  return payload;
}

/**
 * Bundled sample. 18187298 keeps its true historical kickoff (it's a finished fixture with a full
 * replay); the synthetic demo fixtures are re-timed onto the next two days — staggered, snapped to
 * the half hour — so countdowns and day grouping demo realistically without a token.
 */
function sampleFixtures(): FixturesPayload {
  const offsetsHrs = [4, 9, 26, 31, 49];
  let synthetic = 0;

  const fixtures: LobbyFixture[] = SAMPLE.matches
    .map((m) => {
      const isReplayFixture = m.matchId === BUNDLED_FIXTURE_ID;
      const kickoffMs = isReplayFixture
        ? m.kickoffTs * 1000
        : snapToHalfHour(Date.now() + (offsetsHrs[synthetic++ % offsetsHrs.length] ?? 4) * 3_600_000);
      return {
        fixtureId: m.matchId,
        home: m.home,
        away: m.away,
        kickoffMs,
        competition: SAMPLE.competition,
        proposition: m.proposition,
        odds: m.odds,
      };
    })
    .sort((a, b) => a.kickoffMs - b.kickoffMs);

  return { source: "sample", competition: SAMPLE.competition ?? "FIFA World Cup 2026", fixtures };
}

function snapToHalfHour(ms: number): number {
  const HALF_HOUR = 30 * 60_000;
  return Math.ceil(ms / HALF_HOUR) * HALF_HOUR;
}
