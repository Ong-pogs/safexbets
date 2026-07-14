# TxLINE API — integration notes (devnet, confirmed)

Sources: https://txline.txodds.com/documentation/worldcup and the devnet examples in
https://github.com/txodds/tx-on-chain/tree/main/examples/devnet

The relayer consumes TxLINE via `relayer/src/txline.ts` (the single swap point). It runs on offline
fixtures until `TXLINE_API_TOKEN` is set in `.env`, then automatically uses the live devnet feed.

## Endpoints (devnet)
- Base: `https://txline-dev.txodds.com/api`
- Guest JWT: `POST https://txline-dev.txodds.com/auth/guest/start` → `{ token }`
- **Scores (final result): `GET /scores/historical/{fixtureId}`** → array of updates (last = final)
- Fixtures: `GET /fixtures/snapshot?competitionId={id}&startEpochDay={epochDay}`
- Odds snapshot: `GET /odds/snapshot/{fixtureId}?asOf={ts}`
- Odds stream (SSE): `GET /odds/stream`
- Data-request headers: `Authorization: Bearer {jwt}` **and** `X-Api-Token: {apiToken}`

## Get a free-tier API token — self-serve, devnet (no need to wait on anyone)
Service level 1 = 60-second delay, which is plenty for **post-match settlement**. Run TxODDS's own
example against a funded devnet wallet:

```bash
git clone https://github.com/txodds/tx-on-chain && cd tx-on-chain && npm install
TOKEN_MINT_ADDRESS=4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG \
ANCHOR_PROVIDER_URL="https://api.devnet.solana.com" \
ANCHOR_WALLET="/abs/path/to/funded-devnet-wallet.json" \
npx ts-node examples/devnet/scripts/subscription_free_tier.ts
# → prints:  API Token: <TOKEN>
```

Paste `<TOKEN>` into `safexbets/.env` as `TXLINE_API_TOKEN`. The relayer flips to the live feed
automatically. (You can reuse `keypairs/oracle.json` as the wallet — just fund it with devnet SOL.)

### What that script does (from examples/devnet/common/users.ts)
1. Guest JWT: `POST /auth/guest/start`.
2. Create the user's **Token-2022** ATA for mint `4Zao…` if missing.
3. `program.subscribe(serviceLevelId=1, weeks=4)` on the **Txoracle** program (PDAs `pricing_matrix`,
   `token_treasury_v2`). Free tier ⇒ 0 token cost, just SOL fees. `weeks` must be a multiple of 4.
4. Sign `${txSig}:${leagues}:${jwt}` (nacl detached → base64).
5. `POST /token/activate { txSig, walletSignature, leagues: [] }` → long-lived `apiToken`.

If activation fails, the sponsor asked for **only your wallet pubkey + the subscribe tx signature**
(never share the JWT) → t.me/TxLINEChat.

## Mapping to our market (confirmed against a live devnet payload)
Create each market with `match_id = TxLINE fixtureId` (from `/fixtures/snapshot`). Home team =
`Participant1` when `Participant1IsHome`, else `Participant2`. Use `npm run seed-fixtures` /
`list-fixtures` in the relayer.

`/scores/historical/{fixtureId}` returns an **SSE text stream** (`data: {json}` blocks), *not* JSON.
Each event carries `Action`, `GameState`, `Participant1IsHome`, and a flat **`Stats`** map keyed by
`period_prefix + base_key` (numeric values):
- `"1"` / `"2"` = Participant1 / Participant2 **total goals**
- `"6001"` / `"6002"` = penalty-shootout goals
- `3–8` = yellow/red cards, corners; `1000/2000/3000/…` prefixes = per-period

Settlement (`relayer/src/txline.ts`): take the **latest non-empty `Stats` snapshot**, winner = more
goals (`1` vs `2`); if level, penalties (`6001` vs `6002`); still level → draw → **No**. Map the
winner to home via `Participant1IsHome`. *"Home to win?"* = Yes iff the home team won.

⚠️ Devnet leaves `GameState = "scheduled"` even on completed replays, so we settle from `Stats`, not
`GameState`. **Demo fixture: `18187298`** has a full replay (final **1–2**) — use it for a real
live-feed settlement demo: `npm run settle -- <MARKET> --from-txline 18187298`.

## 🌟 Hero: on-chain validation proofs
`examples/devnet/scripts/fixture_validation_view_only.ts` demonstrates TxLINE's **validation proofs**
(fixture/odds/score) anchored on Solana. The settlement hero = verify a TxLINE **score proof** inside
our `settle()` instead of trusting the relayer. Deep-dive once the fixture MVP is green.
