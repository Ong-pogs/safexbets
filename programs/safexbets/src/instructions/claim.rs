use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::SafeXError;
use crate::state::{Market, MarketStatus, Position, Side};

/// Winner claim: principal back immediately + pro-rata share of the losing pool's yield.
/// `share = loser_pool_yield * position.principal / winner_pool_principal`.
///
/// Note (MVP): principal + yield are paid together. In the demo the yield is fast-forwarded
/// (via `accrue`) before the winner claims, so they receive principal + full prize in one click.
#[derive(Accounts)]
pub struct Claim<'info> {
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

pub fn handler(ctx: Context<Claim>) -> Result<()> {
    let (winner, status, match_id, bump, yes_yield, no_yield, yes_principal, no_principal) = {
        let m = &ctx.accounts.market;
        (
            m.winner_side,
            m.status,
            m.match_id,
            m.bump,
            m.yes_yield,
            m.no_yield,
            m.yes_principal,
            m.no_principal,
        )
    };
    require!(status == MarketStatus::Settled, SafeXError::NotSettled);
    let winner = winner.ok_or(SafeXError::NotWinner)?;

    let (pos_side, pos_principal, principal_withdrawn, yield_claimed) = {
        let p = &ctx.accounts.position;
        (p.side, p.principal, p.principal_withdrawn, p.yield_claimed)
    };
    require!(pos_side == winner, SafeXError::NotWinner);

    let mut payout: u64 = 0;
    if !principal_withdrawn {
        payout = payout
            .checked_add(pos_principal)
            .ok_or(SafeXError::MathOverflow)?;
    }
    if !yield_claimed {
        let (loser_yield, winner_pool) = match winner {
            Side::Yes => (no_yield, yes_principal),
            Side::No => (yes_yield, no_principal),
        };
        if winner_pool > 0 {
            let share = (loser_yield as u128)
                .checked_mul(pos_principal as u128)
                .ok_or(SafeXError::MathOverflow)?
                .checked_div(winner_pool as u128)
                .ok_or(SafeXError::MathOverflow)? as u64;
            payout = payout.checked_add(share).ok_or(SafeXError::MathOverflow)?;
        }
    }
    require!(payout > 0, SafeXError::AlreadyClaimed);

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
        payout,
    )?;

    let p = &mut ctx.accounts.position;
    p.principal_withdrawn = true;
    p.yield_claimed = true;
    Ok(())
}
