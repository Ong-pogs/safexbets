use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::{LOCK_PERIOD_DEFAULT, PROPOSITION_MAX_LEN};
use crate::errors::SafeXError;
use crate::state::{Market, MarketStatus, Outcome};

#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct InitializeMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    pub principal_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        space = 8 + Market::INIT_SPACE,
        seeds = [b"market", match_id.to_le_bytes().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = authority,
        seeds = [b"vault", market.key().as_ref()],
        bump,
        token::mint = principal_mint,
        token::authority = market
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<InitializeMarket>,
    match_id: u64,
    proposition: String,
    kickoff_ts: i64,
    lock_period: i64,
) -> Result<()> {
    require!(
        proposition.len() <= PROPOSITION_MAX_LEN,
        SafeXError::PropositionTooLong
    );

    let m = &mut ctx.accounts.market;
    m.authority = ctx.accounts.authority.key();
    m.match_id = match_id;
    m.proposition = proposition;
    m.principal_mint = ctx.accounts.principal_mint.key();
    m.vault = ctx.accounts.vault.key();
    m.kickoff_ts = kickoff_ts;
    // lock_period <= 0 means "use the default"; demos pass a short value.
    m.lock_period = if lock_period <= 0 {
        LOCK_PERIOD_DEFAULT
    } else {
        lock_period
    };
    m.status = MarketStatus::Open;
    m.outcome = Outcome::Unset;
    m.winner_side = None;
    m.yes_principal = 0;
    m.no_principal = 0;
    m.yes_yield = 0;
    m.no_yield = 0;
    m.loser_unlock_ts = 0;
    m.settled_ts = 0;
    m.bump = ctx.bumps.market;
    Ok(())
}
