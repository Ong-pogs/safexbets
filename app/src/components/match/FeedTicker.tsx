"use client";

import clsx from "clsx";
import type { TimelineStep } from "@/lib/replay/types";

/** How many feed lines stay on the board. */
const VISIBLE_STEPS = 8;

/**
 * The rolling TxLINE event feed. Auto-follows the playhead (latest step on top) and announces new
 * lines politely to screen readers. Sides are tinted with the app's home-mint / away-amber kit.
 */
export function FeedTicker({
  steps,
  currentIndex,
}: {
  steps: TimelineStep[];
  currentIndex: number;
}) {
  const from = Math.max(0, currentIndex + 1 - VISIBLE_STEPS);
  const visible = steps.slice(from, currentIndex + 1);

  return (
    <section className="panel flex min-h-[16rem] flex-col p-4" aria-label="Match event feed">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-chalk">
          Match feed
        </h2>
        <span className="kit-label text-[9px] text-mist">TxLINE devnet replay</span>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <ol aria-live="polite" aria-atomic="false" className="flex flex-col gap-1.5">
          {visible.length === 0 && (
            <li className="text-xs text-mist">
              Waiting for kick-off — press play or scrub the timeline.
            </li>
          )}
          {[...visible].reverse().map((step, i) => {
            const absoluteIndex = currentIndex - i;
            const latest = i === 0;
            return (
              <li
                key={absoluteIndex}
                className={clsx(
                  "flex items-baseline gap-2.5 rounded-lg border-l-2 px-2.5 py-1.5 text-xs transition-opacity",
                  step.isGoal
                    ? "border-flood bg-flood/[0.07]"
                    : step.side === "home"
                      ? "border-yes/50 bg-white/[0.02]"
                      : step.side === "away"
                        ? "border-no/50 bg-white/[0.02]"
                        : "border-white/15 bg-white/[0.02]",
                  !latest && "opacity-60",
                )}
              >
                <span className="led w-8 shrink-0 text-right text-[10px] text-mist">
                  {step.minuteLabel}
                </span>
                <span
                  className={clsx(
                    "min-w-0 flex-1 leading-snug",
                    step.isGoal
                      ? "font-semibold text-flood"
                      : step.side === "home"
                        ? "text-yes"
                        : step.side === "away"
                          ? "text-no"
                          : "text-chalk-dim",
                  )}
                >
                  {step.isGoal && <span className="kit-label mr-1.5 text-[9px]">Goal</span>}
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
        {/* fade the tail so old lines dissolve into the panel */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-pitch-700 to-transparent"
          aria-hidden
        />
      </div>
    </section>
  );
}
