import type {
  FoldedStats,
  SideTotals,
  StepKind,
  TeamSide,
  Timeline,
  TimelineStep,
  TrimmedReplay,
  TrimmedReplayEvent,
} from "./types";

/**
 * Pure TxLINE replay -> playback timeline normalizer (design spec §5).
 *
 * The replay's own timestamps are unusable for pacing (coverage sessions days apart), so playback
 * is *index-paced*: the master clock scrubs a step index and each step carries everything the page
 * needs at that moment — folded score/stats, a synthetic minute label, ticker text, and whether a
 * goal banner fires. TxLINE events carry no team attribution in their payload; sides come from
 * stat-key *increments* (P1/P2 keys mapped to home/away via `meta.participant1IsHome`), and
 * corrections (snapshots that decrement) fold in silently — only increments celebrate.
 */

/** Feed plumbing that never surfaces (spec §5.1). */
const DROPPED_KINDS = new Set([
  "connected",
  "disconnected",
  "standby",
  "possible",
  "clock_adjustment",
  "coverage_update",
]);

/** Kinds that become playback steps (spec §5.3). `comment` only qualifies when it has text. */
const DISPLAY_KINDS = new Set<StepKind>([
  "goal",
  "shot",
  "corner",
  "free_kick",
  "penalty",
  "penalty_outcome",
  "yellow_card",
  "var",
  "var_end",
  "substitution",
  "injury",
  "kickoff",
  "halftime_finalised",
  "additional_time",
  "game_finalised",
  "comment",
]);

/** Graded possession -> attack-intensity contribution (spec §5.3), smoothed with an EMA. */
const POSSESSION_INTENSITY: Record<string, number> = {
  safe_possession: 0.25,
  attack_possession: 0.5,
  danger_possession: 0.75,
  high_danger_possession: 1,
};
const INTENSITY_ALPHA = 0.3; // EMA weight per possession event — smooth but responsive

/** TxLINE flat stats key pairs: P1 key / P2 key per stat family. */
const STAT_FAMILIES = [
  { p1: "1", p2: "2", field: "score" },
  { p1: "3", p2: "4", field: "yellows" },
  { p1: "5", p2: "6", field: "reds" },
  { p1: "7", p2: "8", field: "corners" },
] as const;

type StatField = (typeof STAT_FAMILIES)[number]["field"];

/** Which stat family attributes a given step kind (for picking the side of an increment). */
const KIND_FAMILY: Partial<Record<StepKind, StatField>> = {
  goal: "score",
  penalty_outcome: "score",
  var_end: "score",
  corner: "corners",
  yellow_card: "yellows",
};

const emptyTotals = (): SideTotals => ({ home: 0, away: 0 });
const emptyStats = (): FoldedStats => ({
  score: emptyTotals(),
  corners: emptyTotals(),
  yellows: emptyTotals(),
  reds: emptyTotals(),
});
const cloneStats = (s: FoldedStats): FoldedStats => ({
  score: { ...s.score },
  corners: { ...s.corners },
  yellows: { ...s.yellows },
  reds: { ...s.reds },
});

const statNum = (stats: Record<string, number>, key: string): number => {
  const v = stats[key];
  return typeof v === "number" && Number.isFinite(v) ? v : Number(v ?? 0) || 0;
};

/** "OffTarget" -> "off target", "Overturned" -> "overturned". */
const prettyToken = (raw: string): string =>
  raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();

export function normalizeReplay(replay: TrimmedReplay): Timeline {
  const { meta } = replay;
  const p1IsHome = meta.participant1IsHome;
  const sideOfP1: TeamSide = p1IsHome ? "home" : "away";
  const sideOfP2: TeamSide = p1IsHome ? "away" : "home";
  const teamName = (side: TeamSide) => (side === "home" ? meta.home : meta.away);

  // 1. Sort by ts (stable), drop plumbing kinds.
  const events = [...replay.events]
    .sort((a, b) => a.ts - b.ts)
    .filter((e) => !DROPPED_KINDS.has(e.action));

  // 2/3. Single fold walk: running stats from snapshots, rolling intensity from possession
  //      grades, and a step for every display-kind event.
  const running = emptyStats();
  let intensity = 0;
  const steps: TimelineStep[] = [];
  const goalIndices: number[] = [];

  for (const e of events) {
    const grade = POSSESSION_INTENSITY[e.action];
    if (grade !== undefined) {
      intensity = intensity + (grade - intensity) * INTENSITY_ALPHA;
      continue; // possession events collapse into the meter — never steps
    }

    // Fold a stats snapshot (even on kinds that don't become steps, so nothing is lost) and
    // record which sides *incremented* per family. Decrements are corrections: applied silently.
    const incremented: Partial<Record<StatField, TeamSide>> = {};
    let goalSide: TeamSide | null = null;
    if (e.stats) {
      for (const fam of STAT_FAMILIES) {
        const nextP1 = statNum(e.stats, fam.p1);
        const nextP2 = statNum(e.stats, fam.p2);
        const totals = running[fam.field];
        const prevP1 = sideOfP1 === "home" ? totals.home : totals.away;
        const prevP2 = sideOfP2 === "home" ? totals.home : totals.away;
        if (nextP1 > prevP1) incremented[fam.field] = sideOfP1;
        else if (nextP2 > prevP2) incremented[fam.field] = sideOfP2;
        totals[sideOfP1] = nextP1;
        totals[sideOfP2] = nextP2;
      }
      goalSide = incremented.score ?? null;
    }

    const kind = e.action as StepKind;
    if (!DISPLAY_KINDS.has(kind)) continue;
    if (kind === "comment" && !e.text?.trim()) continue; // nothing to show

    // Side: the increment matching this kind's stat family wins; any other increment next; then
    // the feed's own P1/P2 `participant` field (substitutions, injuries); else neutral.
    const familyMatch = KIND_FAMILY[kind] ? incremented[KIND_FAMILY[kind]!] : undefined;
    const anyIncrement = familyMatch ?? incremented.score ?? incremented.corners ?? incremented.yellows ?? incremented.reds;
    const participantSide =
      e.participant === 1 ? sideOfP1 : e.participant === 2 ? sideOfP2 : undefined;
    const side: TeamSide | null = anyIncrement ?? participantSide ?? null;

    const isGoal = goalSide !== null;
    if (isGoal) goalIndices.push(steps.length);

    steps.push({
      kind,
      ts: e.ts,
      label: stepLabel(kind, e, side ? teamName(side) : null),
      minuteLabel: "", // filled in pass 4 once in-play bounds are known
      side,
      stats: cloneStats(running),
      intensity: Math.round(intensity * 1000) / 1000,
      isGoal,
      goalSide,
    });
  }

  // 4. Synthetic clock: index-proportional minutes across the in-play span; "PRE" before the
  //    first kickoff, "FT" from game_finalised on. A labeled replay clock, not real match time.
  const kickoffIdx = steps.findIndex((s) => s.kind === "kickoff");
  const startIdx = kickoffIdx === -1 ? 0 : kickoffIdx;
  const finalisedIdx = steps.findIndex((s) => s.kind === "game_finalised");
  const endIdx = finalisedIdx === -1 ? steps.length : finalisedIdx;
  const inPlaySpan = Math.max(1, endIdx - 1 - startIdx);
  steps.forEach((step, i) => {
    if (i < startIdx) step.minuteLabel = "PRE";
    else if (i >= endIdx) step.minuteLabel = "FT";
    else step.minuteLabel = `${Math.round((90 * (i - startIdx)) / inPlaySpan)}'`;
  });

  // 5. Final score = last folded snapshot (Brazil–Norway must land on 1–2).
  return { steps, goalIndices, finalScore: { ...running.score } };
}

/** Human ticker line for a step. Sided events get the team name appended. */
function stepLabel(kind: StepKind, e: TrimmedReplayEvent, team: string | null): string {
  let base: string;
  switch (kind) {
    case "goal":
      base = "Goal";
      break;
    case "shot":
      base = e.outcome ? `Shot — ${prettyToken(e.outcome)}` : "Shot";
      break;
    case "corner":
      base = "Corner";
      break;
    case "free_kick":
      base = e.freeKick ? `Free kick (${prettyToken(e.freeKick)})` : "Free kick";
      break;
    case "penalty":
      base = "Penalty awarded";
      break;
    case "penalty_outcome":
      base = e.outcome ? `Penalty ${prettyToken(e.outcome)}` : "Penalty";
      break;
    case "yellow_card":
      base = "Yellow card";
      break;
    case "var":
      base = e.type ? `VAR check (${prettyToken(e.type)})` : "VAR check";
      break;
    case "var_end":
      base = e.outcome ? `VAR — ${prettyToken(e.outcome)}` : "VAR complete";
      break;
    case "substitution":
      base = "Substitution";
      break;
    case "injury":
      base = "Injury delay";
      break;
    case "kickoff":
      base = "Kick-off";
      break;
    case "halftime_finalised":
      base = "Half-time";
      break;
    case "additional_time":
      base = "Additional time";
      break;
    case "game_finalised":
      base = "Full-time";
      break;
    case "comment":
      return e.text?.trim() ?? "";
  }
  return team ? `${base} — ${team}` : base;
}
