"use client";

import clsx from "clsx";
import type { TimelineStep, TrimmedReplayMeta } from "@/lib/replay/types";

const METER_CELLS = 12;

/**
 * Folded TxLINE match stats at the playhead (corrections included, silently) plus the rolling
 * attack-intensity meter distilled from graded possession events — intentionally unattributed,
 * because the feed doesn't say whose attack it is.
 */
export function StatsPanel({
  meta,
  step,
}: {
  meta: TrimmedReplayMeta;
  step: TimelineStep | null;
}) {
  const stats = step?.stats;
  const intensity = step?.intensity ?? 0;
  const filled = Math.round(intensity * METER_CELLS);

  return (
    <section className="panel flex flex-col gap-3 p-4" aria-label="Match statistics">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-chalk">
          Match stats
        </h2>
        <span className="kit-label text-[9px] text-mist">TxLINE devnet replay</span>
      </div>

      {/* side legend */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="kit-label flex items-center gap-1.5 text-yes">
          <i className="h-2 w-2 rounded-full bg-yes" aria-hidden /> {meta.home}
        </span>
        <span className="kit-label flex items-center gap-1.5 text-no">
          {meta.away} <i className="h-2 w-2 rounded-full bg-no" aria-hidden />
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <StatRow label="Goals" home={stats?.score.home ?? 0} away={stats?.score.away ?? 0} />
        <StatRow label="Corners" home={stats?.corners.home ?? 0} away={stats?.corners.away ?? 0} />
        <StatRow label="Yellow cards" home={stats?.yellows.home ?? 0} away={stats?.yellows.away ?? 0} />
        {((stats?.reds.home ?? 0) > 0 || (stats?.reds.away ?? 0) > 0) && (
          <StatRow label="Red cards" home={stats?.reds.home ?? 0} away={stats?.reds.away ?? 0} />
        )}
      </div>

      {/* attack intensity — a broadcast-style LED meter */}
      <div className="mt-1 border-t border-white/8 pt-3">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="kit-label text-[10px] text-chalk-dim">Attack intensity</span>
          <span className="text-[9px] text-mist">from possession grades · unattributed</span>
        </div>
        <div
          className="flex gap-1"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={Math.round(intensity * 100) / 100}
          aria-label="Attack intensity"
        >
          {Array.from({ length: METER_CELLS }, (_, i) => (
            <span
              key={i}
              className={clsx(
                "h-2.5 flex-1 rounded-sm transition-colors duration-300",
                i < filled
                  ? i >= METER_CELLS - 3
                    ? "bg-no shadow-[0_0_8px_-2px_var(--no)]"
                    : "bg-flood shadow-[0_0_8px_-2px_var(--flood)]"
                  : "bg-white/5",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function StatRow({ label, home, away }: { label: string; home: number; away: number }) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 rounded-lg bg-pitch-800/50 px-2.5 py-1.5">
      <span className={clsx("led text-left text-lg font-bold leading-none", home > away ? "text-yes" : "text-chalk")}>
        {home}
      </span>
      <span className="kit-label text-center text-[10px] text-mist">{label}</span>
      <span className={clsx("led text-right text-lg font-bold leading-none", away > home ? "text-no" : "text-chalk")}>
        {away}
      </span>
    </div>
  );
}
