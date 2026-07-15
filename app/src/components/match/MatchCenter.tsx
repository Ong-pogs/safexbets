"use client";

import clsx from "clsx";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeReplay } from "@/lib/replay/normalize";
import type { TeamSide, TrimmedReplay } from "@/lib/replay/types";
import { FeedTicker } from "./FeedTicker";
import { MarketRail } from "./MarketRail";
import { MatchScoreboard } from "./MatchScoreboard";
import { StatsPanel } from "./StatsPanel";
import { nextSpeed, Transport, type PlaybackSpeed } from "./Transport";

/** Shared mutable clock — hot-path consumers (3D view, transport) read it inside their own rAF. */
export interface PlaybackClock {
  progressRef: React.MutableRefObject<number>;
  playingRef: React.MutableRefObject<boolean>;
  /** True when pace is "live" — the 3D layer then plays its clip at natural speed (looping). */
  liveRef: React.MutableRefObject<boolean>;
}

/** Full replay run at 1× (spec: ~90 s), index-paced — the raw timestamps span days. */
const RUN_SECONDS = 90;
/** "Live" pace: the whole timeline over ≈ a real match (90' + stoppage). */
const LIVE_RUN_SECONDS = 95 * 60;
const BANNER_MS = 4200;

// The Three.js scene ships only to visitors of this page, client-side only.
const PitchView3D = dynamic(() => import("./PitchView3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-pitch-900">
      <div className="led animate-pulse text-[10px] tracking-[0.2em] text-mist">
        LOADING 3D ENGINE…
      </div>
    </div>
  ),
});

/**
 * Match Center orchestrator — owns the ONE master clock (`progress` in [0,1], rAF-driven) that
 * every layer reads from. Match facts (score, ticker, stats, banner) come from the TxLINE
 * timeline at `steps[floor(progress · N)]`; the 3D layer maps the same progress onto its demo
 * clip. Honors `prefers-reduced-motion`: no autoplay until the visitor presses play.
 */
export function MatchCenter({ replay }: { replay: TrimmedReplay }) {
  const timeline = useMemo(() => normalizeReplay(replay), [replay]);
  const { steps, goalIndices } = timeline;
  const stepCount = steps.length;

  // ---- master clock ----
  const progressRef = useRef(0);
  const playingRef = useRef(false);
  const liveRef = useRef(false);
  const speedRef = useRef<PlaybackSpeed>(1);
  const lastIndexRef = useRef(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [stepIndex, setStepIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [banner, setBanner] = useState<{ side: TeamSide; minute: string; key: number } | null>(null);
  const bannerKey = useRef(0);

  const clock = useMemo<PlaybackClock>(() => ({ progressRef, playingRef, liveRef }), []);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    speedRef.current = speed;
    liveRef.current = speed === "live";
  }, [speed]);

  // Reduced motion: never autoplay (and the 3D layer drops its trail). Otherwise, roll the tape.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    if (!mq.matches) setPlaying(true);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // The rAF loop advances progress and derives the current step. Goal banners fire only for
  // steps crossed *during playback* — scrubbing seeks silently (see onScrub).
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      if (playingRef.current) {
        const s = speedRef.current;
        const rate = s === "live" ? 1 / LIVE_RUN_SECONDS : s / RUN_SECONDS;
        const next = progressRef.current + dt * rate;
        if (next >= 1) {
          progressRef.current = 1;
          setPlaying(false); // full time — hold on FT
        } else {
          progressRef.current = next;
        }
      }

      const idx = Math.min(Math.floor(progressRef.current * stepCount), stepCount - 1);
      const prev = lastIndexRef.current;
      if (idx !== prev) {
        lastIndexRef.current = idx;
        setStepIndex(idx);
        if (playingRef.current && prev !== -1 && idx > prev) {
          // celebrate the last goal increment crossed this tick
          for (let i = idx; i > prev; i--) {
            const s = steps[i];
            if (s.isGoal && s.goalSide) {
              setBanner({ side: s.goalSide, minute: s.minuteLabel, key: ++bannerKey.current });
              break;
            }
          }
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [stepCount, steps]);

  // Banner auto-dismiss.
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), BANNER_MS);
    return () => clearTimeout(t);
  }, [banner]);

  const onTogglePlay = useCallback(() => {
    setPlaying((was) => {
      if (!was && progressRef.current >= 1) progressRef.current = 0; // replay from kickoff
      return !was;
    });
  }, []);

  const onCycleSpeed = useCallback(() => setSpeed((s) => nextSpeed(s)), []);

  const onScrub = useCallback(
    (p: number) => {
      progressRef.current = Math.max(0, Math.min(1, p));
      const idx = Math.min(Math.floor(progressRef.current * stepCount), stepCount - 1);
      lastIndexRef.current = idx;
      setStepIndex(idx); // facts snap silently — no banners while seeking
      setBanner(null);
    },
    [stepCount],
  );

  const clockLabelAt = useCallback(
    (p: number) => {
      if (stepCount === 0) return "PRE";
      const idx = Math.min(Math.floor(Math.max(0, Math.min(1, p)) * stepCount), stepCount - 1);
      return steps[idx].minuteLabel;
    },
    [steps, stepCount],
  );

  const goalMarkers = useMemo(
    () => goalIndices.map((i) => i / Math.max(1, stepCount)),
    [goalIndices, stepCount],
  );

  const step = stepCount > 0 ? steps[stepIndex] : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* ---- left column: the broadcast ---- */}
      <div className="flex min-w-0 flex-col gap-4">
        <MatchScoreboard meta={replay.meta} step={step} playing={playing} />

        {/* the pitch monitor: 3D layer + goal banner overlay + transport console */}
        <section className="panel overflow-hidden p-0" aria-label="Pitch view">
          <div className="relative aspect-video w-full">
            <PitchView3D clock={clock} reducedMotion={reducedMotion} />

            {banner && (
              <div
                key={banner.key}
                className="pointer-events-none absolute inset-x-0 top-[32%] z-20 flex justify-center"
                role="status"
              >
                <div
                  className={clsx(
                    "border-y bg-gradient-to-r from-transparent to-transparent px-10 py-3 text-center motion-safe:animate-pot-pop sm:px-16",
                    banner.side === "home"
                      ? "border-yes/70 via-yes/15"
                      : "border-no/70 via-no/15",
                  )}
                >
                  <div
                    className={clsx(
                      "led-glow font-display text-4xl font-bold uppercase tracking-[0.3em] sm:text-6xl",
                      banner.side === "home" ? "text-yes" : "text-no",
                    )}
                  >
                    Goal
                  </div>
                  <div className="led mt-1 text-xs tracking-[0.2em] text-chalk">
                    {(banner.side === "home" ? replay.meta.home : replay.meta.away).toUpperCase()} ·{" "}
                    {banner.minute}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Transport
            progressRef={progressRef}
            playing={playing}
            speed={speed}
            goalMarkers={goalMarkers}
            clockLabelAt={clockLabelAt}
            onTogglePlay={onTogglePlay}
            onCycleSpeed={onCycleSpeed}
            onScrub={onScrub}
          />
        </section>

        {/* feed + stats */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
          <FeedTicker steps={steps} currentIndex={stepIndex} />
          <StatsPanel meta={replay.meta} step={step} />
        </div>
      </div>

      {/* ---- right rail: the on-chain market (stacks below on mobile) ---- */}
      <MarketRail fixtureId={replay.meta.fixtureId} />
    </div>
  );
}
