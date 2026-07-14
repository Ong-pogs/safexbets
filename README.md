# ⚽ SafeXBets

> **No-loss prediction markets for the World Cup, on Solana.**
> Back a Yes/No call on a match. **TxLINE settles it on-chain.** Winners take the losers' *yield* —
> everyone keeps their *principal*. **You stake time, not money.**

Built for the **TxODDS × Solana World Cup Hackathon** — *Prediction Markets & Settlement* track.

---

## The idea in 20 seconds

Every bettor deposits **principal** that goes to work in a yield source (a mock vault on devnet;
**Kamino** on mainnet). When a match ends, **TxLINE** — TxODDS' live football feed — posts the
result **on-chain** and the market settles:

- 🏆 **Winners** get their principal back **instantly** + a pro-rata share of the losers' **yield**.
- ⏳ **Losers** have their principal **locked for 7 days** and forfeit that week's yield — then get
  **100% of principal** back.

The only thing at risk is **time** (and the yield that time would have earned). Never your deposit.
Football calls it a **clean sheet** — concede nothing. So do you.

## Why it's interesting

- **No-loss** → a responsible-betting story, not a degen casino.
- **Parimutuel** → odds emerge from the pools; no oracle needed for *pricing*.
- **TxLINE as the settlement oracle** → the on-theme heart of the "…& Settlement" track.
- **Yield-agnostic core** → devnet → mainnet is a **config flip**, not a rewrite.

## Architecture

```
TxLINE (TxODDS)──► Oracle Relayer (TS) ──settle(result,sig)──► Anchor Program ──CPI──► YieldSource
                                                                     ▲                  (Mock→Kamino)
                                                              Next.js frontend
                                                       bet · fast-forward · claim
```

The on-chain program manages pools, principal, locks, settlement and payout shares. *How* yield is
generated sits behind a **`YieldSource`** adapter — `MockYield` on devnet (with a fast-forward knob
for demos), `KaminoYield` on mainnet. See [`docs/SPEC.md`](docs/SPEC.md).

## Repo layout

```
safexbets/
├── docs/            SPEC.md · PLAN.md · MAC-SETUP.md
├── programs/        Anchor program (Rust) — the yield-agnostic core
├── relayer/         Oracle relayer (TS) — TxLINE → on-chain settle
├── app/             Next.js frontend — bet · portfolio · fast-forward · claim
└── config/          network + yield-source config (the "flip a switch")
```

## Quickstart

Building/deploying needs the Solana + Anchor toolchain — do it on macOS/Linux.
Full copy-paste prompts: **[`docs/MAC-SETUP.md`](docs/MAC-SETUP.md)**.

```bash
git clone https://github.com/Ong-pogs/safexbets && cd safexbets
# then follow docs/MAC-SETUP.md: install → build → test → deploy devnet → run relayer + app
```

## Status

✅ Live on devnet: program + relayer (real TxLINE feed) + frontend. Includes the **Match Center**
(`/match/18187298`) — a broadcast-style replay of Brazil vs Norway driven by TxLINE devnet data,
with a 3D tracking visualization (Metrica open data, labeled) and the on-chain market alongside.
Roadmap (real Kamino, 1X2, VRF lottery, sponsor boosts) in [`docs/PLAN.md`](docs/PLAN.md).

## Disclaimer

Experimental, unaudited hackathon software. Devnet only. Nothing here is financial advice.
