use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::SafeXError;
use crate::state::{Market, Side};

/// Devnet MockYield: the authority simulates yield by depositing tokens into the vault and
/// crediting a pool. On mainnet this instruction is replaced by a KaminoYield `harvest` CPI
/// that moves real earned interest into the vault — same downstream accounting.
#[derive(Accounts)]
pub struct Accrue<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut, has_one = authority @ SafeXError::Unauthorized)]
    pub market: Account<'info, Market>,

    #[account(mut, address = market.vault)]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = authority_token.owner == authority.key() @ SafeXError::Unauthorized,
        constraint = authority_token.mint == market.principal_mint @ SafeXError::WrongMint
    )]
    pub authority_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Accrue>, side: Side, amount: u64) -> Result<()> {
    require!(amount > 0, SafeXError::ZeroAmount);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.authority_token.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        amount,
    )?;

    let market = &mut ctx.accounts.market;
    match side {
        Side::Yes => {
            market.yes_yield = market
                .yes_yield
                .checked_add(amount)
                .ok_or(SafeXError::MathOverflow)?
        }
        Side::No => {
            market.no_yield = market
                .no_yield
                .checked_add(amount)
                .ok_or(SafeXError::MathOverflow)?
        }
    }
    Ok(())
}
