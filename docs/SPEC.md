# SafeXBets — Design Spec (`CleanSheet` mechanic)

**Track:** Prediction Markets & Settlement — TxODDS × Solana World Cup Hackathon
**Goal:** Win the flagship track. Solo, part-time build. Devnet-first, mainnet by a config flip.
**Status:** Approved design → implementation.

---

## 1. One-liner

A **no-loss prediction market** for the World Cup on Solana. Deposit, back a Yes/No call on a
match, and **TxLINE settles it on-chain**. Winners take the losers' **yield**; everyone keeps
their **principal**. *You stake time, not money.*

## 2. Why it wins this track

- **Differentiated** — not another Polymarket clone. A no-loss market is memorable.
- **Deeply Solana** — DeFi legos: prediction market × lending yield × oracle settlement,
  composable in a way that only works on cheap/fast rails.
- **On-theme for "…& Settlement"** — the hero feature is a verifiable TxLINE oracle that settles
  markets on-chain. That is exactly what a *data company* judging this wants to see.
- **Narrative** — "bet without losing your money" is a responsible-betting story a data company
  eyeing regulated markets loves to stand next to.

## 3. Core mechanic (the "CleanSheet")

Football term: a *clean sheet* = concede nothing. Here: your principal is never conceded.

1. **Deposit** principal (mock-USDC on devnet) → enters a match market on the **Yes** or **No** side.
2. **Betting closes at kickoff.** Principal is now working in the **YieldSource**.
3. **Match ends → TxLINE result posted on-chain → market settles.**
4. **Winners:** principal unlocked instantly **+** a **pro-rata** claim on the losers' yield
   (vests over the lock period).
5. **Losers:** principal **locked 7 days**, its yield **forfeited to winners**; after the lock they
   withdraw **100% of principal**.

> The loser's penalty is **time** (illiquidity) and that time's **yield** — never principal.

## 4. Key design decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Loss model | **Pure no-loss** — prizes are yield only | The whole USP; principal always returned |
| Market structure | **Pooled / parimutuel** | Odds emerge from pool sizes; no external pricing engine needed |
| Market primitive | **Binary Yes/No proposition** (e.g. "Home to win?") | A draw resolves cleanly to **No** — zero void logic, always decisive |
| Payout rule | **Pro-rata** by stake (MVP) | No on-chain randomness (VRF) needed; lottery-jackpot mode = future |
| Loser lock | **Fixed 7 days**, fast-forwardable in demo | Tunable prize window; demo can simulate elapsed time |
| Betting window | **Pre-match only** (closes at kickoff) | Avoids live-odds/in-play complexity |
| Winner lock | **None** — instant principal, prize vests over lock | Winning = liquidity + bonus; losing = time + its yield |
| Yield source | **Adapter**: MockYield (devnet) → KaminoYield (mainnet) | Devnet-first; mainnet is a config flip |
| Settlement | **Signed TxLINE result verified on-chain** (hero) with **authority-post fallback** | On-theme; fallback ships first so settlement always works |
| Asset | **Mock-USDC SPL** on devnet | Clean "principal-safe" mental model |

## 5. Architecture

```
                 ┌────────────────────────┐
   TxLINE API →  │   Oracle Relayer (TS)   │  fetch result → sign → post
   (TxODDS)      └───────────┬────────────┘
                             │ settle(result, sig)
                             ▼
   ┌──────────────────────────────────────────────────────────┐
   │              Anchor Program (yield-agnostic core)          │
   │  Market · Pool(Yes/No) · Position · Vault                  │
   │  create_market · place_bet · settle · claim · withdraw     │
   │                         │ CPI                              │
   │                         ▼                                  │
   │                 ┌───────────────┐                          │
   │                 │  YieldSource   │  trait / adapter        │
   │                 │  MockYield ────┼──► (devnet: accrue knob) │
   │                 │  KaminoYield ──┼──► (mainnet: Kamino CPI)  │
   │                 └───────────────┘                          │
   └───────────────────────────┬──────────────────────────────┘
                                │ read/write
                     ┌──────────▼──────────┐
                     │  Next.js frontend    │  bet · portfolio ·
                     │  + wallet adapter    │  fast-forward · claim
                     └─────────────────────┘
```

### The "flip a switch" contract
The **on-chain program is yield-agnostic**: it manages pools, principal accounting, locks,
settlement and payout shares. *How* yield is generated lives behind a **YieldSource** boundary.
Switching devnet → mainnet is one config change (`NETWORK`, `YIELD_SOURCE`, program IDs, token
mint). No core-program logic changes.

- **Devnet MockYield**: an authority-only `accrue(amount)` / `advance_time` instruction simulates
  yield. Demo controls APY + elapsed time.
- **Mainnet KaminoYield**: `deposit` / `harvest` / `withdraw` via Kamino Lend CPI. Same downstream
  accounting.

## 6. On-chain state (draft)

- **Market** — `match_id`, `proposition`, `kickoff_ts`, `lock_period` (7d), `status`
  (Open/Locked/Settled), `outcome` (Unset/Yes/No/Void), `oracle_authority`.
- **Pool** (Yes / No) — `total_principal`, `total_yield_accrued`, `staker_count`.
- **Position** — `owner`, `side` (Yes/No), `principal`, `claimed`, `unlock_ts` (for losers),
  `yield_share_bps` (computed at settle).
- **Vault** — token account holding pooled principal + a `yield_source` config.

## 7. Instruction flow

- `create_market(match_id, proposition, kickoff_ts)` — admin/authority opens a market.
- `place_bet(side, amount)` — before kickoff; transfers principal into the vault + records Position.
- `(mock) accrue(amount)` / `advance_time(secs)` — devnet-only yield simulation.
- `settle(outcome, signature?)` — after match; verifies TxLINE result, sets outcome, flips pools to
  winner/loser, sets loser `unlock_ts = now + 7d`.
- `claim()` — winners: pull principal immediately + vested share of losers' yield.
- `withdraw_principal()` — losers: after `unlock_ts`, withdraw 100% principal.

## 8. Edge cases (decided)

- **Draw** → resolves **No** (Home did not win). No void needed.
- **One-sided pool** (nobody on the other side) → **void**; refund principal + own yield, no lock.
- **No winners** can't occur with Yes/No unless voided.
- **Oracle disagreement / late result** → admin can re-post before any claims; add a short guard
  window (stretch).

## 9. Economics (honest)

Prize = `locked_principal × yield_rate × lock_duration`. Yield is inherently small in absolute
terms — that is the no-loss trade. Levers to make wins feel real:
- **Concentration** (pro-rata now; lottery/VRF later).
- **Longer locks** (7d → tournament-end).
- **Boosted yield vault** (opt-in, higher-risk) — future.
- **Sponsor boosts** (yield-only injections) — future.
- **TVL scale** — ≈ TVL × 0.15%/week at 8% APY; the growth story, pitched not demoed.

On devnet the MockYield APY + fast-forward make the demo payout look great without any of the above.

## 10. Out of scope (stretch / v2)

Real Kamino mainnet · full 1X2 (draw as its own outcome) · VRF lottery mode · in-play betting ·
AI market-making · secondary market for locked positions.

## 11. Demo money-shot

Bet both sides of a real fixture → hit **"advance 7 days"** → yield visibly accrues → post the
TxLINE result → winner clicks **Claim**, pot lands live; loser sees principal locked with a
countdown, fully recoverable. One screen, whole thesis.
