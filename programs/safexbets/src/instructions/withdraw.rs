use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::SafeXError;
use crate::state::{Market, MarketStatus, Position};

/// Loser withdraw: after the lock expires, get 100% of principal back. On a voided market,
/// anyone with a position may withdraw principal immediately.
#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut, address = market.vault)]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), owner.key().as_ref()],
        bump = position.bump,
        has_one = owner @ SafeXError::Unauthorized,
        constraint = position.market == market.key() @ SafeXError::Unauthorized
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        constraint = owner_token.owner == owner.key() @ SafeXError::Unauthorized,
        constraint = owner_token.mint == market.principal_mint @ SafeXError::WrongMint
    )]
    pub owner_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Withdraw>) -> Result<()> {
    let clock = Clock::get()?;

    let (status, winner, match_id, bump, loser_unlock_ts) = {
        let m = &ctx.accounts.market;
        (
            m.status,
            m.winner_side,
            m.match_id,
            m.bump,
            m.loser_unlock_ts,
        )
    };
    let (pos_side, pos_principal, principal_withdrawn) = {
        let p = &ctx.accounts.position;
        (p.side, p.principal, p.principal_withdrawn)
    };
    require!(!principal_withdrawn, SafeXError::AlreadyWithdrawn);
    require!(pos_principal > 0, SafeXError::AlreadyWithdrawn);

    match status {
        MarketStatus::Void => { /* refunds open to everyone, no lock */ }
        MarketStatus::Settled => {
            let w = winner.ok_or(SafeXError::NotLoser)?;
            require!(pos_side != w, SafeXError::NotLoser);
            require!(
                clock.unix_timestamp >= loser_unlock_ts,
                SafeXError::StillLocked
            );
        }
        _ => return err!(SafeXError::NotSettled),
    }

    let mid = match_id.to_le_bytes();
    let signer: &[&[&[u8]]] = &[&[b"market", mid.as_ref(), &[bump]]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.owner_token.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            },
            signer,
        ),
        pos_principal,
    )?;

    let p = &mut ctx.accounts.position;
    p.principal_withdrawn = true;
    Ok(())
}
