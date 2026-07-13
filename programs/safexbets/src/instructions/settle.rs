use anchor_lang::prelude::*;

use crate::errors::SafeXError;
use crate::state::{Market, MarketStatus, Outcome, Side};

/// v1: the market authority (oracle relayer) posts the TxLINE result.
/// Hero upgrade (Phase 4): verify a TxODDS-signed payload via the Ed25519 program before
/// accepting the outcome — see relayer/ and docs/SPEC.md §5.
#[derive(Accounts)]
pub struct Settle<'info> {
    pub authority: Signer<'info>,

    #[account(mut, has_one = authority @ SafeXError::Unauthorized)]
    pub market: Account<'info, Market>,
}

pub fn handler(ctx: Context<Settle>, outcome: Outcome) -> Result<()> {
    let clock = Clock::get()?;
    let market = &mut ctx.accounts.market;

    require!(
        market.status == MarketStatus::Open || market.status == MarketStatus::Locked,
        SafeXError::AlreadySettled
    );
    require!(
        clock.unix_timestamp >= market.kickoff_ts,
        SafeXError::MatchNotStarted
    );

    // A one-sided market cannot redistribute yield — void it and refund everyone.
    let one_sided = market.yes_principal == 0 || market.no_principal == 0;
    let final_outcome = if one_sided { Outcome::Void } else { outcome };

    match final_outcome {
        Outcome::Yes => {
            market.winner_side = Some(Side::Yes);
            market.status = MarketStatus::Settled;
            market.loser_unlock_ts = clock.unix_timestamp + market.lock_period;
        }
        Outcome::No => {
            market.winner_side = Some(Side::No);
            market.status = MarketStatus::Settled;
            market.loser_unlock_ts = clock.unix_timestamp + market.lock_period;
        }
        Outcome::Void => {
            market.winner_side = None;
            market.status = MarketStatus::Void;
            market.loser_unlock_ts = clock.unix_timestamp; // immediate refunds
        }
        Outcome::Unset => return err!(SafeXError::InvalidOutcome),
    }

    market.outcome = final_outcome;
    market.settled_ts = clock.unix_timestamp;
    Ok(())
}
