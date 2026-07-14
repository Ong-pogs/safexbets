"use client";

import clsx from "clsx";
import type { TimelineStep, TrimmedReplayMeta } from "@/lib/replay/types";

/**
 * The stadium LED strip — real fixture facts from the TxLINE layer (score folds from stats
 * snapshots; the clock is the synthetic replay minute). Wears the "official data" badge.
 */
export function MatchScoreboard({
  meta,
  step,
  playing,
}: {
  meta: TrimmedReplayMeta;
  step: TimelineStep | null;
  playing: boolean;
}) {
  const score = step?.stats.score ?? { home: 0, away: 0 };
  const clock = step?.minuteLabel ?? "PRE";
  const fullTime = clock === "FT";

  return (
    <section className="panel relative overflow-hidden" aria-label="Scoreboard">
      <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-flood/10 blur-3xl" />

      <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6 sm:py-4">
        {/* home | score | away */}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-3 sm:gap-5">
          <TeamName name={meta.home} side="home" />
          <div
            className="led led-glow shrink-0 whitespace-nowrap rounded-xl border border-white/10 bg-pitch-900/70 px-3 py-1.5 text-3xl font-bold text-chalk sm:px-4 sm:text-4xl"
            aria-label={`Score: ${meta.home} ${score.home}, ${meta.away} ${score.away}`}
          >
            {score.home}
            <span className="mx-1.5 text-mist sm:mx-2">:</span>
            {score.away}
          </div>
          <TeamName name={meta.away} side="away" />
        </div>

        {/* replay clock */}
        <div
          className={clsx(
            "led flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-base font-bold",
            fullTime ? "border-white/15 text-chalk-dim" : "border-flood/30 text-flood",
          )}
        >
          <span
            className={clsx(
              "h-1.5 w-1.5 rounded-full",
              fullTime ? "bg-mist" : "bg-flood",
              playing && !fullTime && "motion-safe:animate-live-pulse",
            )}
            aria-hidden
          />
          {clock}
          <span className="kit-label text-[9px] font-semibold text-mist">replay</span>
        </div>
      </div>

      {/* data-layer honesty label — visible, not tucked away */}
      <div className="relative flex items-center justify-between gap-3 border-t border-white/8 bg-pitch-800/50 px-4 py-1.5 sm:px-6">
        <span className="kit-label text-[9px] text-yes">
          Official data · TxLINE devnet replay
        </span>
        <span className="led text-[9px] text-mist">FIXTURE #{meta.fixtureId}</span>
      </div>
    </section>
  );
}

/** Mirrored team blocks: home reads right-aligned into the score, away left-aligned out of it. */
function TeamName({ name, side }: { name: string; side: "home" | "away" }) {
  const isHome = side === "home";
  return (
    <div
      className={clsx(
        "flex min-w-0 flex-1 items-center justify-start gap-2.5",
        isHome && "flex-row-reverse text-right", // row-reverse packs home against the score
      )}
    >
      <span
        className={clsx(
          "h-6 w-1.5 shrink-0 rounded-full",
          isHome ? "bg-yes shadow-[0_0_12px_var(--yes)]" : "bg-no shadow-[0_0_12px_var(--no)]",
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <div className="truncate font-display text-lg font-bold uppercase tracking-wide text-chalk sm:text-2xl">
          {name}
        </div>
        <div className={clsx("kit-label text-[9px]", isHome ? "text-yes" : "text-no")}>
          {isHome ? "Home · Yes side" : "Away · No side"}
        </div>
      </div>
    </div>
  );
}
