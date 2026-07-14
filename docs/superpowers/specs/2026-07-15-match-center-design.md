# Match Center + Production Pass — Design Spec

**Date:** 2026-07-15 · **Status:** approved (user pre-authorized E2E delivery; approval gates compressed by explicit instruction)
**Origin:** user's `ball-tracker-demo` worktree (PITCHVIEW — 3D Three.js tracking replay on Metrica open data) + "make the app production-ready for consumers."

## 1. Goal

Turn the PITCHVIEW prototype into a **Match Center** inside the SafeXBets app: a fan-facing live-match
experience for a fixture, tied to its on-chain no-loss market — plus a production-readiness pass over
the whole consumer app.

## 2. Data truths that shape the design (verified empirically)

1. **TxLINE provides events + stats, not ball coordinates.** No free live tracking feed exists
   (prototype README documents the research). The 3D tracking clip is **Metrica open data — a
   different match** — and must be labeled as a demo visualization.
2. **Fixture 18187298 (Brazil vs Norway, final 1–2)** has a full devnet replay: 1102 events with a
   rich vocabulary — graded possession (`safe/attack/danger/high_danger_possession`), `shot`,
   `corner`, `goal` (+`GoalType`), `penalty`/`penalty_outcome`, `yellow_card`, `var`/`var_end`,
   `substitution`, `kickoff`, `halftime_finalised`, `additional_time`, `game_finalised`.
3. **Timestamps are unusable for pacing** — the replay stitches two coverage sessions ~5 days apart.
   Playback must be **index-paced** with a synthetic clock, not wall-clock-paced.
4. **Events carry no team attribution in `Data`.** Side comes from **stats-key deltas**: keys
   `1/2` = P1/P2 goals, `7/8` corners, `3/4` yellows, `5/6` reds, `6001/6002` shootout; map
   P1→home via `meta.participant1IsHome`. Shots/possession are unattributed → present neutrally.
5. **Corrections happen** (a snapshot decremented a score). Score/stat display must **fold the
   latest snapshot ≤ playhead** (corrections apply silently); only *increments* fire goal banners.

## 3. Architecture — one master timeline, two honestly-labeled layers

```
/match/[fixtureId]
┌──────────────────────────────────────────────┬──────────────────┐
│ MatchScoreboard  (TxLINE: score, clock)       │  MarketRail       │
│ PitchView3D      (Metrica demo clip, labeled) │  · on-chain market│
│ Transport        (play/pause · speed · scrub  │    for fixtureId  │
│                   with goal markers)          │  · pools/odds     │
│ FeedTicker + StatsPanel (TxLINE events/stats) │  · bet / claim /  │
│                                               │    withdraw       │
└──────────────────────────────────────────────┴──────────────────┘
```

- **Master clock:** one `progress ∈ [0,1]`; default full playback ~90 s; speeds 1/2/4/8×; scrubber.
  All match *facts* (score, ticker, stats, markers) read `timeline.steps[floor(progress·N)]`.
  The 3D layer maps the same progress → `clipTime = progress × clipDuration`.
- **Layer 1 — TxLINE (real fixture data):** scoreboard, clock, ticker, stats. Badge:
  “OFFICIAL DATA · TxLINE devnet replay”.
- **Layer 2 — PITCHVIEW 3D (visualization):** ported Three.js scene (broadcast/top/ballcam,
  minimap, ball trail, telemetry). Badge: “TRACKING VISUALIZATION · Metrica open data (demo feed —
  not this fixture)”. Its internal scoreboard/goal-banner/event logic is **removed** (page owns facts).

## 4. Modules

| Unit | Purpose | Depends on |
|---|---|---|
| `src/lib/replay/types.ts` | `TrimmedReplay {meta, events[]}`, `Timeline {steps[], goalIndices, finalScore}` | — |
| `src/lib/replay/normalize.ts` | Pure: sort→fold stats→filter display kinds→synthetic minutes→sides via deltas→intensity from possession grades | types |
| `src/app/api/txline/replay/[fixtureId]/route.ts` | Server-only proxy: live TxLINE (guest JWT + `X-Api-Token` env) → parse SSE → trim; fallback = bundled `src/fixtures/replay-18187298.json`; else 404 JSON. In-memory cache. **Token never reaches the client.** | fixtures |
| `src/components/match/MatchCenter.tsx` | Orchestrator + master clock (rAF; paused when `prefers-reduced-motion` until user plays) | normalize |
| `src/components/match/PitchView3D.tsx` | Ported prototype; `next/dynamic` `ssr:false`; fetches `/replay/metrica-clip.json` on mount; sized to container (ResizeObserver), not window; dispose on unmount | `three` |
| `src/components/match/{MatchScoreboard,FeedTicker,StatsPanel,Transport}.tsx` | HUD pieces (ticker `aria-live="polite"`) | — |
| `src/components/match/MarketRail.tsx` | Finds market by `matchId === fixtureId`; reuses existing hooks/BetModal/claim/withdraw; empty state if none | existing lib |
| `src/app/match/[fixtureId]/page.tsx` (+ loading/error/not-found) | Route, metadata (`Brazil vs Norway — Match Center · SafeXBets`) | all |

**Data assets (generated, already in repo):** `src/fixtures/replay-18187298.json` (53 KB trimmed
TxLINE replay) · `public/replay/metrica-clip.json` (1.9 MB Metrica clip — fetched on demand only).

**Dependency budget:** add `three` (+`@types/three`) only. No react-three-fiber, no chart libs.
Wallet-adapter pins/overrides in `app/package.json` are untouchable.

## 5. Timeline normalization (the tricky bit, decided)

1. Sort events by `ts`; drop kinds `{connected,disconnected,standby,possible,clock_adjustment,coverage_update}`.
2. Fold stats: running `{score, corners, yellows, reds}` = latest snapshot ≤ index (P1/P2 → home/away
   via `participant1IsHome`). A step's banner fires only on **increment** of a goal key.
3. Display kinds: `goal, shot, corner, free_kick, penalty, penalty_outcome, yellow_card, var,
   var_end, substitution, injury, kickoff, halftime_finalised, additional_time, game_finalised,
   comment(text)`. Possession events collapse into a rolling `intensity 0–1`
   (safe .25 / attack .5 / danger .75 / high_danger 1) shown as a meter, unattributed.
4. Synthetic clock: in-play steps get `minuteLabel ≈ round(90 · i / N_inplay)`' (labeled replay
   clock); pre-first-`kickoff` steps = “PRE”; after `game_finalised` = “FT”.
5. `finalScore` = last folded score (for Brazil–Norway must equal **1–2**; assert in a unit check).

## 6. Production pass (whole app)

- **States:** loading skeletons, error + retry, empty states on every fetch (markets, replay, rail).
- **Errors:** route-level `error.tsx` + `not-found.tsx` for `/match/*`; API errors → toasts (existing system).
- **A11y:** labeled transport buttons, `aria-live` ticker, focus-visible styles, reduced-motion
  (no autoplay, no ball trail animation).
- **Responsive:** pitch panel `aspect-video`, stacks on mobile; rail below; no fixed-inset layout.
- **Perf:** 3D bundle + clip JSON load only on match page (dynamic import); replay JSON server-side only.
- **Security:** `TXLINE_API_TOKEN` is a server env var (no `NEXT_PUBLIC`), documented in `.env.local.example`.
- **Consumer clarity:** home page “How it works” 3-step strip (deposit → back a call → winners take
  losers' *yield*, principal always yours) + footer disclaimer (devnet, experimental, 18+ messaging).
- **Entry points:** MarketCard → “Match Center →” (by matchId); home features the Brazil–Norway replay link.
- **Docs:** update `app/README.md` (routes, envs, demo runbook step for the match center).

## 7. Out of scope

Live SSE streaming to the browser (replay only) · syncing 3D clip to real fixture events ·
Sportmonks/paid tracking feeds · mainnet · new market types.

## 8. Verification

Agent: `tsc --noEmit` + `next build` green; normalizer sanity (final score 1–2, goal count/side
spot-check) as a small test or assertion. Then E2E on this box: `next dev` → HTTP 200 + content
checks on `/`, `/match/18187298`, `/api/txline/replay/18187298` (JSON shape), `/api/txline/replay/999`
(clean 404). Wallet click-paths verified manually by user on the Mac (documented limitation).
