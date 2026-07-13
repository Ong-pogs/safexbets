# TxLINE API — integration notes

Source: https://txline.txodds.com/documentation/worldcup (World Cup hackathon docs).
This captures what we learned so integration is a config flip, not a rewrite. `relayer/src/txline.ts`
is the single swap point.

## Base URLs
- **Devnet:** `https://txline-dev.txodds.com/api`  ← we're on devnet, use this
- **Mainnet:** `https://txline.txodds.com/api`

## Auth — it's NOT a static API key
A two-stage, on-chain-gated flow:
1. **Guest JWT:** `POST /auth/guest/start` (no credentials) → `jwt`.
2. **Subscribe on-chain:** submit a subscription transaction (TxODDS program on the selected
   network) → `txSig`. *Hackathon note: TxODDS waived the token-payment requirement, so on devnet
   this should be free — confirm the subscription program ID via t.me/TxLINEChat.*
3. **Activate token:** sign the message `${txSig}::${jwt}`, then
   `POST /api/token/activate` with `{ txSig, walletSignature (base64), leagues: [] }` → `apiToken`.

Headers:
- Guest requests: `Authorization: Bearer ${jwt}`
- Data requests: `X-Api-Token: ${apiToken}`

**Free tier:** Level 1 = 60-second delay; **Level 12 = real-time World Cup & Int'l friendlies**.
Requires a funded wallet on the chosen network. **No rate limits.**

## Data endpoints (categories confirmed; exact paths TBC)
- **Fixtures** — match metadata.
- **Odds** — snapshots, historical updates, streaming *StablePrice* odds.
- **Scores** — snapshots, historical updates, streaming score events.
- **Validation Proofs** — "fixture, odds, and score proofs for **on-chain validation**."
- Real-time streaming via **Server-Sent Events (SSE)**.

## 🌟 Why this matters for our track (Prediction Markets & **Settlement**)
TxLINE provides **validation proofs anchored on Solana**. That means our settlement "hero" can
**verify TxODDS's own proof on-chain** instead of trusting our relayer's signature — a real
trustless-settlement story, using the sponsor's own anchoring. This is the single most on-theme
upgrade we can make, and it's *their* infrastructure doing the heavy lifting.

Plan: MVP settles via authority-post (works today, on fixtures). Hero upgrade = `settle` verifies a
TxLINE **score proof** against the on-chain anchor. Prioritize once the MVP demo is green.

## Open questions to confirm (docs deep-dive or t.me/TxLINEChat)
1. Exact endpoint **paths** for fixtures / scores / results / proofs.
2. The **subscription program ID** on devnet (+ that the hackathon waiver auto-applies).
3. The **proof format/schema** (how a score proof is structured + verified on-chain).
4. Response JSON shapes (field names for score/result).

Until these are in hand, the relayer runs on `fixtures/txline.sample.json`.
