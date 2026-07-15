/** All principal amounts are 6-decimal USDC (Circle devnet USDC; matches the tests). */
export const PRINCIPAL_DECIMALS = 6;
export const PRINCIPAL_UNIT = 10 ** PRINCIPAL_DECIMALS; // base units per 1 USDC
export const PRINCIPAL_SYMBOL = "USDC";

/** Self-serve devnet funding — the app never custodies funds, users hit the faucets directly. */
export const USDC_FAUCET_URL = "https://faucet.circle.com";
export const SOL_FAUCET_URL = "https://faucet.solana.com";

/** Default demo yield the "Advance 7 days" button stacks onto the losing pool (in USDC). */
export const DEMO_ACCRUE_APY = 0.08; // 8% APY headline used to size the simulated week of yield
export const SEVEN_DAYS_SECS = 7 * 24 * 60 * 60;

/** PDA seeds (must match the Rust program). */
export const SEED_MARKET = "market";
export const SEED_VAULT = "vault";
export const SEED_POSITION = "position";
