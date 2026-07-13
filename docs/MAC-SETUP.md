# Mac Setup & Hand-off Prompts

Everything that needs the **Solana/Anchor toolchain or Linux/macOS** runs here. Each section has a
**copy-paste prompt** (hand it to an agent/terminal on your Mac) and the **raw commands** it maps to.

> The Windows box writes the code and pushes to GitHub. Your Mac builds, tests, and deploys.

---

## 0. Install the toolchain (one time)

**Prompt to paste:**
> Install the Solana dev toolchain on my Mac: Rust (rustup), the Solana CLI (Anza/Agave), Anchor via
> avm (latest), and confirm Node ≥ 20. Print each version when done.

**Raw commands:**
```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

# Solana CLI (Anza/Agave)
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Anchor via avm
cargo install --git https://github.com/coral-xyz/anchor avm --force
avm install latest && avm use latest

# Verify
rustc --version && solana --version && anchor --version && node --version
```

---

## 1. Clone the repo

**Prompt to paste:**
> Clone https://github.com/Ong-pogs/safexbets and cd into it.

```bash
git clone https://github.com/Ong-pogs/safexbets
cd safexbets
```

---

## 2. Configure devnet + wallet

**Prompt to paste:**
> Point the Solana CLI at devnet, create a new keypair at ./keypairs/oracle.json if missing, set it
> as the default, and airdrop 2 SOL (retry if the faucet is rate-limited).

```bash
mkdir -p keypairs
solana config set --url devnet
solana-keygen new --no-bip39-passphrase -o keypairs/oracle.json
solana config set --keypair keypairs/oracle.json
solana airdrop 2
solana balance
```

---

## 3. Create a devnet mock-USDC mint (principal token)

**Prompt to paste:**
> Using spl-token on devnet, create a new mint with 6 decimals to act as mock-USDC, create an
> associated token account, mint 100000 to myself, and print the mint address. Then set
> PRINCIPAL_MINT in my .env to that address.

```bash
cargo install spl-token-cli   # if not installed
spl-token create-token --decimals 6
# take the mint address it prints:
spl-token create-account <MINT>
spl-token mint <MINT> 100000
```

---

## 4. Build & test the program

**Prompt to paste:**
> Run `anchor build` then `anchor test` in this repo. If the program ID in Anchor.toml / lib.rs
> doesn't match the built keypair, run `anchor keys sync` and rebuild. Paste any errors back to me.

```bash
anchor build
anchor keys sync      # aligns declare_id! with target/deploy keypair
anchor build
anchor test
```

---

## 5. Deploy to devnet

**Prompt to paste:**
> Deploy the program to devnet with anchor, then print the deployed program ID and update
> NEXT_PUBLIC_PROGRAM_ID and PROGRAM_ID in .env.

```bash
anchor deploy --provider.cluster devnet
solana address -k target/deploy/safexbets-keypair.json
```

---

## 6. Run the oracle relayer

**Prompt to paste:**
> In ./relayer run `npm install`, copy ../.env.example to ../.env and fill it, then start the
> relayer. Test it by settling a demo market with: `npm run settle -- <MARKET_PUBKEY> yes`.

```bash
cd relayer
npm install
npm run dev
# settle a market:
npm run settle -- <MARKET_PUBKEY> yes
```

---

## 7. Run the frontend

**Prompt to paste:**
> Copy the freshly built IDL into the app, configure its env, then run it. From repo root:
> `cp target/idl/safexbets.json app/src/idl/safexbets.json`; in ./app copy `.env.local.example` to
> `.env.local` and set `NEXT_PUBLIC_PROGRAM_ID` + `NEXT_PUBLIC_PRINCIPAL_MINT`; then
> `npm install && npm run dev` and open http://localhost:3000. Connect a devnet wallet funded with
> mock-USDC.

```bash
# from repo root, AFTER `anchor build` (so the real IDL exists):
cp target/idl/safexbets.json app/src/idl/safexbets.json
cd app
cp .env.local.example .env.local
# edit .env.local: NEXT_PUBLIC_PROGRAM_ID, NEXT_PUBLIC_PRINCIPAL_MINT, NEXT_PUBLIC_RPC_URL
npm install
npm run dev
```


---

## Handing errors back

When something fails on the Mac, paste the **exact command + full error output** back into the
Windows session. The code fixes happen there; you re-run here.
