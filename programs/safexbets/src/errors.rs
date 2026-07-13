use anchor_lang::prelude::*;

#[error_code]
pub enum SafeXError {
    #[msg("Proposition string too long")]
    PropositionTooLong,
    #[msg("Market is not open for betting")]
    MarketNotOpen,
    #[msg("Betting has closed (kickoff passed)")]
    BettingClosed,
    #[msg("Market already settled")]
    AlreadySettled,
    #[msg("Market not settled yet")]
    NotSettled,
    #[msg("Only the market authority can do this")]
    Unauthorized,
    #[msg("Match has not kicked off yet")]
    MatchNotStarted,
    #[msg("You already have a position on the other side")]
    SideMismatch,
    #[msg("Not a winning position")]
    NotWinner,
    #[msg("Not a losing position")]
    NotLoser,
    #[msg("Principal is still locked")]
    StillLocked,
    #[msg("Principal already withdrawn")]
    AlreadyWithdrawn,
    #[msg("Nothing left to claim")]
    AlreadyClaimed,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid or unset outcome")]
    InvalidOutcome,
    #[msg("Token mint does not match the market principal mint")]
    WrongMint,
}
