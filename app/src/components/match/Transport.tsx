"use client";

import { useEffect, useRef } from "react";

/** Compressed multipliers over the ~90 s base run, plus "live" ≈ real match pace. */
export type PlaybackSpeed = number | "live";
const SPEEDS: PlaybackSpeed[] = [1, 2, 4, 8, "live"];
export const nextSpeed = (s: PlaybackSpeed): PlaybackSpeed =>
  SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length];

/**
 * Playback console for the master clock: play/pause, speed cycle, and a scrubber with goal
 * markers. The thumb/fill/timecode track the clock imperatively (its own rAF reading
 * `progressRef`) so the 60 fps playhead never re-renders the React tree.
 */
export function Transport({
  progressRef,
  playing,
  speed,
  goalMarkers,
  clockLabelAt,
  onTogglePlay,
  onCycleSpeed,
  onScrub,
}: {
  progressRef: React.MutableRefObject<number>;
  playing: boolean;
  speed: PlaybackSpeed;
  /** Goal positions as fractions of the timeline (index / step count). */
  goalMarkers: number[];
  clockLabelAt: (progress: number) => string;
  onTogglePlay: () => void;
  onCycleSpeed: () => void;
  onScrub: (progress: number) => void;
}) {
  const sliderRef = useRef<HTMLInputElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let lastLabel = "";
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p = progressRef.current;
      if (fillRef.current) fillRef.current.style.width = `${p * 100}%`;
      const slider = sliderRef.current;
      if (slider && document.activeElement !== slider) slider.value = String(Math.round(p * 1000));
      const label = clockLabelAt(p);
      if (label !== lastLabel) {
        lastLabel = label;
        if (clockRef.current) clockRef.current.textContent = label;
        slider?.setAttribute("aria-valuetext", `Replay clock ${label}`);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progressRef, clockLabelAt]);

  return (
    <div className="flex items-center gap-3 border-t border-white/8 bg-pitch-800/60 px-3 py-2.5 sm:px-4">
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={playing ? "Pause replay" : "Play replay"}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-flood text-pitch-900 transition hover:shadow-[0_0_20px_-4px_var(--flood)]"
        style={{ clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)" }}
      >
        {playing ? (
          <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden>
            <rect x="1" width="3.5" height="14" fill="currentColor" />
            <rect x="7.5" width="3.5" height="14" fill="currentColor" />
          </svg>
        ) : (
          <svg width="13" height="14" viewBox="0 0 13 14" aria-hidden>
            <path d="M1 0.5v13L12.5 7z" fill="currentColor" />
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={onCycleSpeed}
        aria-label={
          speed === "live"
            ? "Playback pace: live — approximately real match time. Press to change."
            : `Playback speed ${speed} times compressed — press to change`
        }
        title="Cycle pace: 1×–8× compressed replay · LIVE ≈ real match time"
        className={
          speed === "live"
            ? "led shrink-0 rounded-lg border border-flood/60 px-2.5 py-2 text-xs font-bold text-flood transition"
            : "led shrink-0 rounded-lg border border-white/10 px-2.5 py-2 text-xs font-bold text-chalk-dim transition hover:border-flood/50 hover:text-flood"
        }
      >
        {speed === "live" ? (
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-flood" aria-hidden />
            LIVE
          </span>
        ) : (
          `${speed}×`
        )}
      </button>

      {/* scrubber with goal markers */}
      <div className="relative flex h-9 min-w-0 flex-1 items-center">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" aria-hidden />
        <div
          ref={fillRef}
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-flood/40 to-flood"
          style={{ width: 0 }}
          aria-hidden
        />
        {goalMarkers.map((m, i) => (
          <span
            key={i}
            className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-flood shadow-[0_0_8px_var(--flood)]"
            style={{ left: `${m * 100}%` }}
            title="Goal"
            aria-hidden
          />
        ))}
        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={1000}
          step={1}
          defaultValue={0}
          onChange={(e) => onScrub(Number(e.currentTarget.value) / 1000)}
          aria-label="Match timeline"
          className="scrubber relative z-10 w-full"
        />
      </div>

      <div className="led shrink-0 text-right text-xs text-mist">
        <span ref={clockRef} className="font-bold text-chalk">
          PRE
        </span>
        <span className="mx-1">/</span>FT
      </div>
    </div>
  );
}
