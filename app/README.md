# SafeXBets — Frontend (`app/`)

The Next.js frontend for **SafeXBets**, a no-loss World Cup prediction market on Solana.
Back a Yes/No call on a match, keep your principal, and win the losers' yield. *You stake time, not money.*

- **Sportsbook navigation** — sticky navbar (Matches · Match Center · My Bets) with a **balance
  chip** (connected wallet's devnet USDC; click → faucet popover with faucet.circle.com, copy
  address, SOL faucet) + wallet button; on mobile, a slim top bar + a bottom tab bar.
- **Matches lobby** (`/matches`) — the TxLINE slate grouped by day: kickoff + countdown, pre-match
  line, **Market live** badge from on-chain state, one tap into the fixture's Match Center.
  Markets open automatically ~48h before kickoff (relayer keeper) and settle from TxLINE.
- **Wallet connect** (devnet) via Solana wallet-adapter (Phantom / Solflare).
- **Markets board** — every market as a stadium scoreboard: Yes/No pools, implied odds, status, kickoff clock.
- **Betslip** — selection summary, stake with MAX + quick chips, pool-implied decimal odds beside
  the TxLINE reference line, a no-loss returns box ("principal back: always"), and an
  insufficient-balance state that reads **the market's own mint** and links the Circle faucet.
- **My Bets** (`/my-bets`) — Open/Settled tabs, state chips (Open · Locked ⏳ with countdown ·
  Claimable 💰 · Recovered ✓ · Void ↩), aggregates (in play / claimable / locked), **Claim** /
  **Withdraw** actions, links into each fixture's Match Center.
- **Operator booth** (`/operator`) — Match Control off the consumer home: create markets, post the
  TxLINE result, stack the yield prize. The keeper does all this automatically in normal play.
- **TxLINE odds** — a local fixture today (clearly labelled `TxLINE (fixture)`) shown next to the pool-implied odds; swapping in the live feed is a one-file change (`src/lib/txline.ts`).
- **Match Center** (`/match/[fixtureId]`) — a fan-facing replay of a real TxLINE devnet fixture:
  scoreboard/clock/feed/stats folded from the official event stream, a 3D tracking visualization
  (Three.js, Metrica open-data demo clip — honestly labelled, it's a different match), a transport
  bar with goal markers, 1/2/4/8× speeds + a LIVE pace, and the fixture's on-chain market in a side rail.

## Routes

| Route | What it serves |
| --- | --- |
| `/` | Hero + featured Match Center, markets board, recent-positions teaser |
| `/matches` | Matches lobby: day-grouped TxLINE fixtures, countdowns, market badges → Match Center |
| `/match/[fixtureId]` | Match Center for a TxLINE fixture (bundled demo: `18187298`, Brazil vs Norway 1–2) |
| `/my-bets` | Your betslips: Open/Settled tabs, claim/withdraw, lock countdowns, aggregates |
| `/operator` | Match Control booth for demos (the relayer keeper automates the real lifecycle) |
| `/api/txline/fixtures` | Fixtures slate for the lobby: live TxLINE snapshot with `TXLINE_API_TOKEN`, else a bundled sample (always includes `18187298`) |
| `/api/txline/replay/[fixtureId]` | Server-only replay proxy: live TxLINE devnet when `TXLINE_API_TOKEN` is set, else the bundled fixture; clean 404 JSON otherwise |

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · `@coral-xyz/anchor` 0.31 · `@solana/web3.js` · `@solana/spl-token` · wallet-adapter.

## Prerequisites

The program must be built + deployed to devnet first (Mac/Linux toolchain). See `../docs/MAC-SETUP.md`.
You need:

1. The deployed **program id** (`anchor deploy` output).
2. A 6-decimal **principal mint** — default is Circle's devnet USDC (`4zMM…ncDU`, self-fund at [faucet.circle.com](https://faucet.circle.com)); a self-made `spl-token create-token --decimals 6` mock mint also works.
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
| `NEXT_PUBLIC_PRINCIPAL_MINT` | principal mint — **Circle devnet USDC** `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (users self-fund at [faucet.circle.com](https://faucet.circle.com)); older markets keep whatever mint they were created with, and the betslip reads each market's own mint |
| `TXLINE_API_TOKEN` | *optional, server-side only (no `NEXT_PUBLIC_`)* — enables live TxLINE devnet data in `/api/txline/replay/*` and `/api/txline/fixtures`; the bundled Brazil–Norway replay + sample slate work without it |

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

1. **Operator** connects → **`/operator`** (footer "Operator booth", or the ⋯ menu in the navbar) → *Create demo market* (pick a fixture; kickoff ~2 min; lock `7 days` for the real story, or `5 min` to also demo the loser withdraw). In normal play the relayer **keeper** does this automatically ~48h before kickoff.
2. **Operator** backs one side; **bettor** backs the other (betslip — needs devnet USDC from [faucet.circle.com](https://faucet.circle.com); the balance chip's popover links it).
3. Wait for kickoff to pass → betting closes.
4. **Operator** → *Settle Yes* or *Settle No* (posts the TxLINE result on-chain).
5. **Operator** → *Advance 7 days* (stacks a demo-accelerated week of yield onto the losing pool — hammer it to grow the pot).
6. **Winner** opens **My Bets** → *Claim winnings* → principal + losers' yield lands live.
7. **Loser** sees the position **Locked ⏳** with a 7-day countdown in My Bets, fully recoverable (or *Withdraw* if you used a short lock).
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
- All principal is 6-decimal USDC (Circle devnet USDC by default); conversions live in
  `src/lib/format.ts`. Balance/ATA paths always use **the market's own `principalMint`**
  (`market.account.principalMint`), so legacy markets created under an older mock mint keep working.

### Troubleshooting

- **`Buffer is not defined`** — the polyfill lives at the top of `src/app/providers.tsx`. If a
  dependency still trips over it, add `webpack.ProvidePlugin({ Buffer: ['buffer', 'Buffer'] })` in
  `next.config.mjs`.
- **Empty board / can't bet** — check the setup banner: program id and mint must point at your
  devnet deployment, and the IDL must be the generated one.
