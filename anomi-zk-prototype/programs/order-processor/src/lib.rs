use anchor_lang::prelude::*;
use order_store::{MatchedOrder, OrderStatus};

declare_id!("Gn8GGrCgmBQs4tRvf2oeWXjgsqHBcYByDhQiAxGdfFqV");

#[program]
pub mod order_processor {
    use super::*;

    pub fn finalize_trade(
        ctx: Context<FinalizeTrade>,
        proof_data: Vec<u8>,
    ) -> Result<()> {
        let matched_order = &mut ctx.accounts.matched_order;
        require!(matched_order.status == OrderStatus::Pending, ErrorCode::InvalidOrderStatus);
        require!(!proof_data.is_empty(), ErrorCode::InvalidProof);
        matched_order.status = OrderStatus::Confirmed;
        matched_order.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn settle_trade(ctx: Context<SettleTrade>) -> Result<()> {
        let matched_order = &mut ctx.accounts.matched_order;
        require!(matched_order.status == OrderStatus::Confirmed, ErrorCode::InvalidOrderStatus);
        matched_order.status = OrderStatus::Settled;
        matched_order.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct FinalizeTrade<'info> {
    #[account(mut)]
    pub matched_order: Account<'info, MatchedOrder>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SettleTrade<'info> {
    #[account(mut)]
    pub matched_order: Account<'info, MatchedOrder>,
    pub authority: Signer<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid order status")]
    InvalidOrderStatus,
    #[msg("Invalid proof")]
    InvalidProof,
}
