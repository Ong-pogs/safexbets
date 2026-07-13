# SafeXBets Oracle Relayer

Ingests a match result (TxLINE live feed, or an offline fixture) and posts it on-chain to
**settle** a market. Also drives the demo: create markets and `accrue` simulated yield.

The relayer's keypair (`ORACLE_KEYPAIR`, default `../keypairs/oracle.json`) is the **market
authority** — the only signer allowed to `accrue` and `settle`.

## Prereqs
1. Program built + deployed on the Mac (`anchor build` generates `../target/idl/safexbets.json`).
2. Repo-root `.env` filled in (copy from `../.env.example`): `PROGRAM_ID`, `PRINCIPAL_MINT`,
   `ORACLE_KEYPAIR`, and optionally `TXLINE_BASE_URL` / `TXLINE_API_KEY`.

## Install & use
```bash
npm install

# create a demo market: matchId 1, "Home to win?", kickoff in 60s, 120s lock
npm run create-market -- 1 "Brazil to win vs Japan" $(($(date +%s) + 60)) 120

npm run list

# fast-forward yield onto the losing (NO) pool
npm run accrue -- <MARKET_PUBKEY> no 50

# settle from the TxLINE fixture (matchId 1 = Brazil 2-1 -> "yes")
npm run settle -- <MARKET_PUBKEY> --from-txline 1
# ...or settle explicitly
npm run settle -- <MARKET_PUBKEY> yes
```

## TxLINE integration
`src/txline.ts` is the single place that talks to TxLINE. It uses the live API when
`TXLINE_BASE_URL` + `TXLINE_API_KEY` are set, else the fixture in `fixtures/txline.sample.json`.
Adjust the request path/response shape to the real schema once you have the sponsor's docs.
