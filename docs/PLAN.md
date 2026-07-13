# SafeXBets — Implementation Plan

Solo, part-time, ~6 days to the July 19 deadline. **Ruthless MVP.** Ship a working end-to-end
demo on devnet; everything else is a stretch.

## Division of labor

- **Windows box (this repo, done by the assistant):** write all source — Anchor program (Rust),
  relayer (TS), frontend (Next.js) — plus docs, config, and git.
- **Your Mac (Solana/Anchor toolchain + Linux):** build, test, deploy to devnet, run services.
  Copy-paste prompts live in [`MAC-SETUP.md`](./MAC-SETUP.md).

## Definition of done (MVP)

A judge can, on devnet: connect a wallet → bet Yes/No on a match → fast-forward yield → see a
TxLINE result settle the market on-chain → winner claims a real payout → loser sees a locked,
fully-recoverable principal.

## Phases

### Phase 0 — Repo & scaffold  ✅ (in progress)
- Monorepo, docs, `.gitignore`, config, GitHub public repo, CI-free.

### Phase 1 — Anchor program (the heart)
Files under `programs/safexbets/src/`:
- `state.rs` — `Market`, `Pool`, `Position`, `Vault`.
- `errors.rs`, `constants.rs`.
- `instructions/create_market.rs`, `place_bet.rs`, `settle.rs`, `claim.rs`, `withdraw.rs`.
- `yield/mod.rs` — `YieldSource` trait; `yield/mock.rs` — MockYield (`accrue`, `advance_time`).
- `lib.rs` — wire it up.
- **Tests** (`tests/safexbets.ts`): happy path (bet → accrue → settle → claim/withdraw), draw→No,
  one-sided void.
- *Build/test on Mac* → see MAC-SETUP §Build & Test.

### Phase 2 — Oracle relayer
`relayer/src/`:
- `txline.ts` — fetch a match result from TxLINE (with a mock/fixture mode for offline demo).
- `settle.ts` — post `settle` to the program. **v1: authority-signed** (relayer keypair is the
  oracle authority). **Hero upgrade:** Ed25519-signed payload the program verifies.
- `index.ts` — CLI: `settle <marketPubkey> <yes|no>`.

### Phase 3 — Frontend
`app/` (Next.js App Router):
- Wallet adapter + program client (from Anchor IDL).
- Match list with **live TxLINE odds** (seed the implied line).
- Bet modal (Yes/No + amount), portfolio, **fast-forward demo panel**, claim / withdraw.

### Phase 4 — Hero: signed settlement
- Relayer signs `{match_id, outcome, ts}`; `settle` verifies via Solana Ed25519 program +
  instruction introspection. Falls back to authority-post if disabled.

### Phase 5 — Polish & demo
- Seed script (create demo markets), demo script/runbook, README screenshots, `mainnet` config stub
  to prove the flip.

## Stretch (only if ahead)
Real Kamino CPI adapter · 1X2 markets · VRF lottery mode · sponsor-boost vault.

## Risk register
- **Anchor learning curve on Mac** → keep instructions small, test each in isolation.
- **Ed25519 verify plumbing** → Phase 4, non-blocking; authority-post ships first.
- **TxLINE access/latency** → relayer has a fixture mode so the demo never depends on the live feed.
- **Time** → Phases 1–3 are the MVP. 4–5 are upside. Cut ruthlessly.
