# SafeXBets — Frontend (`app/`)

The Next.js frontend for **SafeXBets**, a no-loss World Cup prediction market on Solana.
Back a Yes/No call on a match, keep your principal, and win the losers' yield. *You stake time, not money.*

- **Wallet connect** (devnet) via Solana wallet-adapter (Phantom / Solflare).
- **Markets board** — every market as a stadium scoreboard: Yes/No pools, implied odds, status, kickoff clock.
- **Bet modal** — pick a side + amount, principal moves into the vault.
- **Portfolio** — your positions with **Claim** (winners) / **Withdraw** (losers, after the lock).
- **Match Control** — operator booth (visible when your wallet authored a market): create markets, post the TxLINE result, and stack the yield prize.
- **TxLINE odds** — a local fixture today (clearly labelled `TxLINE (fixture)`) shown next to the pool-implied odds; swapping in the live feed is a one-file change (`src/lib/txline.ts`).
- **Match Center** (`/match/[fixtureId]`) — a fan-facing replay of a real TxLINE devnet fixture:
  scoreboard/clock/feed/stats folded from the official event stream, a 3D tracking visualization
  (Three.js, Metrica open-data demo clip — honestly labelled, it's a different match), a transport
  bar with goal markers and 1/2/4/8× speeds, and the fixture's on-chain market in a side rail.

## Routes

| Route | What it serves |
| --- | --- |
| `/` | Markets board, portfolio, Match Control, featured Match Center link |
| `/match/[fixtureId]` | Match Center for a TxLINE fixture (bundled demo: `18187298`, Brazil vs Norway 1–2) |
| `/api/txline/replay/[fixtureId]` | Server-only replay proxy: live TxLINE devnet when `TXLINE_API_TOKEN` is set, else the bundled fixture; clean 404 JSON otherwise |

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · `@coral-xyz/anchor` 0.31 · `@solana/web3.js` · `@solana/spl-token` · wallet-adapter.

## Prerequisites

The program must be built + deployed to devnet first (Mac/Linux toolchain). See `../docs/MAC-SETUP.md`.
You need:

1. The deployed **program id** (`anchor deploy` output).
2. A devnet **mock-USDC mint** with 6 decimals (`spl-token create-token --decimals 6`), and some minted to your wallet.
3. **The generated IDL copied in** (crucial — see below).

### Copy the real IDL over the placeholder

`src/idl/safexbets.json` ships as a hand-written **placeholder** so the app builds without the
Anchor toolchain. On the Mac, after `anchor build`, overwrite it with the generated IDL:

```bash
# from the repo root
cp target/idl/safexbets.json app/src/idl/safexbets.json
```

## Configure

```bash
cd app
cp .env.local.example .env.local
```

Fill `.env.local`:

| Var | Meaning |
| --- | --- |
| `NEXT_PUBLIC_NETWORK` | `devnet` (flip to `mainnet-beta` to switch clusters/yield source) |
| `NEXT_PUBLIC_RPC_URL` | devnet RPC (a dedicated RPC beats the public one) |
| `NEXT_PUBLIC_PROGRAM_ID` | deployed program id |
| `NEXT_PUBLIC_PRINCIPAL_MINT` | your devnet mock-USDC mint |
| `TXLINE_API_TOKEN` | *optional, server-side only (no `NEXT_PUBLIC_`)* — enables live TxLINE devnet replays in `/api/txline/replay/*`; the bundled Brazil–Norway replay works without it |

## Run

```bash
npm install
npm run dev
# open http://localhost:3000
```

`npm run build` for a production build, `npm run typecheck` to typecheck without emitting,
`npm run check:replay` to sanity-check the Match Center's replay normalizer against the bundled
fixture (asserts the Brazil–Norway final score 1–2, goal sides, and silent score corrections).

## Demo runbook (the money-shot)

Use **two wallets** (a market needs both sides staked, or it voids). One is the *operator*
(authored the market); the other is a *bettor*.

1. **Operator** connects → **Match Control** → *Create demo market* (pick a fixture; kickoff ~2 min; lock `7 days` for the real story, or `5 min` to also demo the loser withdraw).
2. **Operator** backs one side; **bettor** backs the other (Bet modal).
3. Wait for kickoff to pass → betting closes.
4. **Operator** → *Settle Yes* or *Settle No* (posts the TxLINE result on-chain).
5. **Operator** → *Advance 7 days* (stacks a demo-accelerated week of yield onto the losing pool — hammer it to grow the pot).
6. **Winner** opens **Portfolio** → *Claim winnings* → principal + losers' yield lands live.
7. **Loser** sees principal locked with a 7-day countdown, fully recoverable (or *Withdraw* if you used a short lock).
8. **Match Center encore** — open `/match/18187298` (the *Watch the replay* strip on the home
   page, or the *Match Center →* chip on any card whose market you created for fixture
   `18187298` — it's the default pick in *Create demo market*). Play the Brazil–Norway replay:
   the scoreboard, feed and stats replay the official TxLINE events (watch the VAR-overturned
   goal fold back out of the score), the 3D pitch is a labelled Metrica demo visualization, and
   the rail carries the fixture's live on-chain market — bet/claim/withdraw work right there.

> "Advance 7 days" calls the program's `accrue` on the **losing** side, so all simulated yield
> becomes claimable prize (nothing stranded). It targets the loser, so it unlocks after you settle.

## Architecture notes

- `src/lib/config.ts` mirrors the repo-root `config/network.ts` "flip a switch" config (browser env only).
- `src/lib/anchor.ts` builds the Anchor `Program` from the IDL and injects `NEXT_PUBLIC_PROGRAM_ID` at runtime.
- `src/lib/program.ts` wraps every instruction/fetch (account name sets mirror `tests/safexbets.ts`).
- `src/lib/market-view.ts` mirrors the on-chain payout/lock logic for accurate UI (never authoritative — the chain is).
- `src/lib/txline.ts` is the **single swap point** for the odds feed (fixture → live API).
- `src/lib/replay/` is the Match Center data layer: `normalize.ts` (pure TxLINE replay → playback
  timeline — index-paced clock, stats folding with silent corrections, sides from stat-key
  increments; checked by `npm run check:replay`) and `server.ts` (server-only replay source:
  live TxLINE with `TXLINE_API_TOKEN`, else the bundled fixture; in-process cache — the token
  never reaches the client).
- The 3D pitch (`src/components/match/PitchView3D.tsx`) and its 1.9 MB Metrica clip
  (`public/replay/metrica-clip.json`) load **only** on the match page, via `next/dynamic` +
  runtime `fetch`.
- All principal is 6-decimal mock-USDC; conversions live in `src/lib/format.ts`.

### Troubleshooting

- **`Buffer is not defined`** — the polyfill lives at the top of `src/app/providers.tsx`. If a
  dependency still trips over it, add `webpack.ProvidePlugin({ Buffer: ['buffer', 'Buffer'] })` in
  `next.config.mjs`.
- **Empty board / can't bet** — check the setup banner: program id and mint must point at your
  devnet deployment, and the IDL must be the generated one.
