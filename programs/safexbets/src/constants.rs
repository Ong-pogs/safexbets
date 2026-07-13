/// Max length of a market's proposition string, e.g. "Brazil to win vs Japan".
pub const PROPOSITION_MAX_LEN: usize = 64;

/// Default loser lock period: 7 days (seconds). Markets can override with a shorter
/// value for demos (the mechanic is identical, only the duration is demo-scaled).
pub const LOCK_PERIOD_DEFAULT: i64 = 7 * 24 * 60 * 60;
