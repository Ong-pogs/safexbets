# Sportsbook UX conventions → SafeXBets decisions

Research pass 2026-07-15 (FanDuel / DraftKings / bet365 / Polymarket patterns; sources at bottom).
SafeXBets is a **no-loss parimutuel** product — conventions are adopted only where they serve that.

## Navigation IA
Convention: persistent top bar (brand · sports/lobby · live · promos · **balance chip → deposit** ·
account); mobile = slim top bar + **bottom tab bar** (Home / Sports / Live / My Bets / Account).
- **Adopt:** sticky desktop navbar (Matches · Match Center · My Bets · balance chip · wallet);
  mobile bottom tabs (Matches / Match Center / My Bets) + slim top bar (brand + wallet).
- **Adapt:** "Deposit" → **devnet faucet popover** (Circle USDC faucet + copy address + SOL faucet).
  Balance is a wallet-token read, not a cashier ledger.
- **Skip:** promos/casino tabs, search, league drill-down (one competition), account center (wallet is it).

## Betslip anatomy
Convention: selection summary (market + pick + odds) → stake input w/ quick chips → potential
returns, live-computed → single CTA with amount; inline errors (insufficient funds → deposit link);
never a dead disabled button — always say why.
- **Adopt:** summary (fixture + proposition + side), stake + MAX + 5/25/100 chips, returns box,
  CTA carrying stake, reason text under a disabled CTA, insufficient-balance state with faucet link.
- **Adapt:** returns box is **no-loss phrased**: "Principal back: always" + "Potential prize: share
  of the losing pool's yield" (estimate at today's pot — parimutuel payouts finalize at settle).
  Balance/ATA checks use **the market's own principalMint** (legacy markets ≠ env mint).
- **Skip:** multi-leg parlays, odds-format toggles, cash-out (positions aren't tradeable).

## My Bets
Convention: tabs Open (a.k.a. Unsettled) / Settled; state chips per bet (won ✓ green, lost ✗ red,
void/push grey); stake + returns per row; aggregate of pending stakes; deep link to the event.
- **Adopt:** Open/Settled tabs, chips (Open · Locked ⏳ + countdown · Claimable 💰 · Collected ✓ ·
  Recoverable ↩ · Recovered ✓ · Void ↩), stake/side/proposition → match center link, aggregates
  strip (in play / claimable / locked), connect-wallet empty state, skeletons.
- **Adapt:** "lost" is never red-✗ money-gone — it's **Locked** with a countdown to 100% principal
  recovery. Claim/withdraw are on-chain actions with toast progress, not passive rows.
- **Skip:** 90-day history archive, cash-out buttons, bet-share images.

## Odds display
Convention: US books default American odds; Polymarket shows probability (¢ = %) with optional
decimal; parimutuel (tote) boards show pool splits + approximate odds that finalize at close.
- **Adopt:** decimal odds derived from pool-implied probability (1/share), always paired with the
  implied % — probability-first like a prediction market, decimal as the bettor-familiar bridge.
- **Adapt:** TxLINE bookmaker line shown **side-by-side as reference**, labeled — our pools are the
  price, the line is context. Odds labelled "now" (parimutuel: your true share moves until kickoff).
- **Skip:** American/fractional formats, overround display, line-movement charts.

## Lobby / event list
Convention: fixtures grouped by day, kickoff time + countdown, markets-count or headline line per
row, live badge, one-tap into event page.
- **Adopt:** day-grouped rows, local kickoff + countdown, TxLINE line if known, **Market live**
  badge from on-chain state, CTA → `/match/[fixtureId]`, note "Markets open automatically ~48h
  before kickoff · settled by TxLINE".
- **Skip:** in-play odds updating in the lobby, sport switcher, favourites.

Sources: gammastack.com/blog/sports-betting-ui-ux-guide · symphony-solutions.com/insights/sportsbook-ux ·
help.bet365.com bet-settlement · sportsbook.draftkings.com/mybets · startpolymarket.com/learn/understanding-odds ·
polymarkettrader.com "55¢ means 55%".
