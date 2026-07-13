use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;
use state::{Outcome, Side};

// Placeholder ID — run `anchor keys sync` on the Mac to set the real deployed program ID.
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod safexbets {
    use super::*;

    /// Open a binary Yes/No market for a match proposition. `lock_period <= 0` uses the 7-day default.
    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        match_id: u64,
        proposition: String,
        kickoff_ts: i64,
        lock_period: i64,
    ) -> Result<()> {
        instructions::initialize_market::handler(ctx, match_id, proposition, kickoff_ts, lock_period)
    }

    /// Place a pre-kickoff bet on a side. Principal moves into the vault.
    pub fn place_bet(ctx: Context<PlaceBet>, side: Side, amount: u64) -> Result<()> {
        instructions::place_bet::handler(ctx, side, amount)
    }

    /// Devnet MockYield: authority credits simulated yield to a pool (the demo fast-forward).
    pub fn accrue(ctx: Context<Accrue>, side: Side, amount: u64) -> Result<()> {
        instructions::accrue::handler(ctx, side, amount)
    }

    /// Post the TxLINE result and settle the market.
    pub fn settle(ctx: Context<Settle>, outcome: Outcome) -> Result<()> {
        instructions::settle::handler(ctx, outcome)
    }

    /// Winner: principal back + pro-rata share of the losers' yield.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::claim::handler(ctx)
    }

    /// Loser (after lock) or anyone (on void): withdraw 100% of principal.
    pub fn withdraw_principal(ctx: Context<Withdraw>) -> Result<()> {
        instructions::withdraw::handler(ctx)
    }
}
