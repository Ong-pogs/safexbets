use anchor_lang::prelude::*;

/// Which side of a binary Yes/No proposition a position backs.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Side {
    Yes,
    No,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum MarketStatus {
    Open,
    Locked,
    Settled,
    Void,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Outcome {
    Unset,
    Yes,
    No,
    Void,
}

/// A single binary market for one match proposition (e.g. "Home to win?").
///
/// Pools are stored inline (yes_/no_) to keep the account count small. The program is
/// **yield-agnostic**: `*_yield` is credited by the active YieldSource (MockYield on devnet,
/// KaminoYield on mainnet). The losing side's accrued yield is the prize for winners.
#[account]
#[derive(InitSpace)]
pub struct Market {
    /// Admin + oracle authority (relayer). May accrue yield and settle.
    pub authority: Pubkey,
    /// External match identifier (from TxLINE).
    pub match_id: u64,
    #[max_len(64)]
    pub proposition: String,
    pub principal_mint: Pubkey,
    /// Program-owned token account holding pooled principal + yield.
    pub vault: Pubkey,
    /// Betting closes at kickoff.
    pub kickoff_ts: i64,
    /// Loser lock duration (seconds).
    pub lock_period: i64,
    pub status: MarketStatus,
    pub outcome: Outcome,
    /// Set at settle. None while open or on Void.
    pub winner_side: Option<Side>,
    pub yes_principal: u64,
    pub no_principal: u64,
    pub yes_yield: u64,
    pub no_yield: u64,
    /// When losers may withdraw principal (settle_ts + lock_period).
    pub loser_unlock_ts: i64,
    pub settled_ts: i64,
    pub bump: u8,
}

/// One bettor's position in a market. One side per (market, owner).
#[account]
#[derive(InitSpace)]
pub struct Position {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub side: Side,
    pub principal: u64,
    pub principal_withdrawn: bool,
    pub yield_claimed: bool,
    pub bump: u8,
}
