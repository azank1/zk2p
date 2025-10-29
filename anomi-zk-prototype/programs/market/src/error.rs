use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // Amount/Price validation
    #[msg("Amount must be greater than zero")]
    InvalidAmount,

    #[msg("Price must be greater than zero")]
    InvalidPrice,

    // Account validation
    #[msg("Token account owner does not match seller")]
    InvalidTokenAccountOwner,

    #[msg("Token mint does not match expected mint")]
    InvalidMint,

    // Authorization
    #[msg("Unauthorized caller - only OrderProcessor can release escrow")]
    UnauthorizedCaller,

    #[msg("Unauthorized cancellation - only order owner can cancel")]
    UnauthorizedCancellation,

    #[msg("Invalid program ID")]
    InvalidProgramId,

    // Order book errors
    #[msg("Order book is full")]
    OrderBookFull,

    #[msg("Order not found")]
    OrderNotFound,

    #[msg("Invalid order side")]
    InvalidSide,

    #[msg("No matching orders found for this bid")]
    NoMatchingOrders,

    // Order type specific
    #[msg("Self-trade not allowed")]
    SelfTradeNotAllowed,

    #[msg("Post-only order would match immediately")]
    PostOnlyWouldMatch,

    #[msg("Fill-or-kill order cannot be fully filled")]
    FillOrKillNotFilled,

    // Payment
    #[msg("Payment method string is too long (max 100 characters)")]
    PaymentMethodTooLong,
    
    // P2P Settlement
    #[msg("Unauthorized action - only order owner can perform this")]
    UnauthorizedAction,
    
    #[msg("Settlement delay has not expired yet")]
    SettlementDelayNotExpired,
}
