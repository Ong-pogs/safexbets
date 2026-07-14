/**
 * TxLINE replay types — the trimmed on-disk/over-the-wire shape and the normalized timeline the
 * Match Center plays back. Everything here is plain data (JSON-serializable), so a server
 * component can hand a `TrimmedReplay` straight to the client orchestrator.
 */

/** Which team an event belongs to, once P1/P2 has been mapped through `participant1IsHome`. */
export type TeamSide = "home" | "away";

export interface TrimmedReplayMeta {
  fixtureId: number;
  home: string;
  away: string;
  /** TxLINE speaks in Participant1/Participant2; this flag maps P1 -> home. */
  participant1IsHome: boolean;
  participant1Id?: number;
  participant2Id?: number;
  startTimeMs?: number;
  competitionId?: number;
  source?: string;
}

/**
 * One trimmed TxLINE SSE event. `stats` appears only on snapshot-change events and is the flat
 * TxLINE map: keys "1"/"2" = P1/P2 goals, "3"/"4" yellows, "5"/"6" reds, "7"/"8" corners,
 * "6001"/"6002" shootout goals.
 */
export interface TrimmedReplayEvent {
  ts: number;
  action: string;
  text?: string;
  outcome?: string;
  type?: string;
  freeKick?: string;
  /** P1/P2 attribution when the feed provides it (substitutions, injuries). */
  participant?: number;
  stats?: Record<string, number>;
}

export interface TrimmedReplay {
  meta: TrimmedReplayMeta;
  events: TrimmedReplayEvent[];
}

/** Event kinds that surface in the feed ticker / on the scrubber (spec §5.3). */
export type StepKind =
  | "goal"
  | "shot"
  | "corner"
  | "free_kick"
  | "penalty"
  | "penalty_outcome"
  | "yellow_card"
  | "var"
  | "var_end"
  | "substitution"
  | "injury"
  | "kickoff"
  | "halftime_finalised"
  | "additional_time"
  | "game_finalised"
  | "comment";

/** Per-side running totals folded from the latest stats snapshot at or before a step. */
export interface SideTotals {
  home: number;
  away: number;
}

export interface FoldedStats {
  score: SideTotals;
  corners: SideTotals;
  yellows: SideTotals;
  reds: SideTotals;
}

/**
 * One playback step. The master clock maps progress -> `steps[floor(progress * N)]`; every match
 * fact on the page (score, ticker, stats, banner) reads from the current step.
 */
export interface TimelineStep {
  /** Kind of the underlying TxLINE event. */
  kind: StepKind;
  /** Original event timestamp (unusable for pacing — playback is index-paced). */
  ts: number;
  /** Human line for the ticker, e.g. "Goal — Norway" or "Shot (Blocked)". */
  label: string;
  /** Synthetic replay-clock label: "PRE", "12'", "90'", "FT". */
  minuteLabel: string;
  /** Team attribution (from stat-key increments, or feed `participant`); null = neutral. */
  side: TeamSide | null;
  /** Running match state at this step (latest snapshot ≤ this index; corrections fold silently). */
  stats: FoldedStats;
  /** Rolling attack intensity 0..1 from graded possession events (unattributed). */
  intensity: number;
  /** True only when this step's snapshot *incremented* a goal key — fires the goal banner. */
  isGoal: boolean;
  /** Which side the banner celebrates when `isGoal`. */
  goalSide: TeamSide | null;
}

export interface Timeline {
  steps: TimelineStep[];
  /** Indices into `steps` where a goal banner fires (scrubber markers). */
  goalIndices: number[];
  /** Score after folding every snapshot (Brazil–Norway replay must equal 1–2). */
  finalScore: SideTotals;
}
