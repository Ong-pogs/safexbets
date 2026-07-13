use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::SafeXError;
use crate::state::{Market, MarketStatus, Position, Side};

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut, address = market.vault)]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = bettor_token.owner == bettor.key() @ SafeXError::Unauthorized,
        constraint = bettor_token.mint == market.principal_mint @ SafeXError::WrongMint
    )]
    pub bettor_token: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = bettor,
        space = 8 + Position::INIT_SPACE,
        seeds = [b"position", market.key().as_ref(), bettor.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<PlaceBet>, side: Side, amount: u64) -> Result<()> {
    require!(amount > 0, SafeXError::ZeroAmount);
    let clock = Clock::get()?;

    // --- validation ---
    {
        let market = &ctx.accounts.market;
        require!(market.status == MarketStatus::Open, SafeXError::MarketNotOpen);
        require!(
            clock.unix_timestamp < market.kickoff_ts,
            SafeXError::BettingClosed
        );
    }

    // --- move principal into the vault ---
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.bettor_token.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.bettor.to_account_info(),
            },
        ),
        amount,
    )?;

    // --- record / update position ---
    let market_key = ctx.accounts.market.key();
    let bettor_key = ctx.accounts.bettor.key();
    {
        let pos = &mut ctx.accounts.position;
        if pos.owner == Pubkey::default() {
            pos.market = market_key;
            pos.owner = bettor_key;
            pos.side = side;
            pos.principal = 0;
            pos.principal_withdrawn = false;
            pos.yield_claimed = false;
            pos.bump = ctx.bumps.position;
        }
        require!(pos.side == side, SafeXError::SideMismatch);
        pos.principal = pos
            .principal
            .checked_add(amount)
            .ok_or(SafeXError::MathOverflow)?;
    }

    // --- update pool ---
    let market = &mut ctx.accounts.market;
    match side {
        Side::Yes => {
            market.yes_principal = market
                .yes_principal
                .checked_add(amount)
                .ok_or(SafeXError::MathOverflow)?
        }
        Side::No => {
            market.no_principal = market
                .no_principal
                .checked_add(amount)
                .ok_or(SafeXError::MathOverflow)?
        }
    }
    Ok(())
}
