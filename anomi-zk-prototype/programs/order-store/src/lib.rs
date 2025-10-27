use anchor_lang::prelude::*;

declare_id!("DjuV2BhfeVSnamUNPQhjY1NxtCqDT8RjG8xyKJAN2spg");

#[program]
pub mod order_store {
    use super::*;

    // Re-export types for CPI
    pub use crate::{MatchedOrder, OrderStatus, ErrorCode};

    /// Create a new MatchedOrder PDA in Pending state
    pub fn create_matched_order(
        ctx: Context<CreateMatchedOrder>,
        order_id: u64,
        bidder: Pubkey,
        seller: Pubkey,
        token_mint: Pubkey,
        amount: u64,
        price: u64,
    ) -> Result<()> {
        let matched_order = &mut ctx.accounts.matched_order;
        
        matched_order.order_id = order_id;
        matched_order.bidder = bidder;
        matched_order.seller = seller;
        matched_order.token_mint = token_mint;
        matched_order.amount = amount;
        matched_order.price = price;
        matched_order.status = OrderStatus::Pending;
        matched_order.created_at = Clock::get()?.unix_timestamp;
        matched_order.updated_at = Clock::get()?.unix_timestamp;
        
        Ok(())
    }

    /// Update order status to Confirmed after ZK proof validation
    pub fn confirm_order(
        ctx: Context<ConfirmOrder>,
        proof_data: Vec<u8>,
    ) -> Result<()> {
        let matched_order = &mut ctx.accounts.matched_order;
        
        // In a real implementation, this would validate the ZK proof
        // For now, we'll just update the status
        matched_order.status = OrderStatus::Confirmed;
        matched_order.updated_at = Clock::get()?.unix_timestamp;
        
        Ok(())
    }

    /// Update order status to Settled after successful settlement
    pub fn settle_order(ctx: Context<SettleOrder>) -> Result<()> {
        let matched_order = &mut ctx.accounts.matched_order;
        
        matched_order.status = OrderStatus::Settled;
        matched_order.updated_at = Clock::get()?.unix_timestamp;
        
        Ok(())
    }

    /// Cancel a pending order
    pub fn cancel_order(ctx: Context<CancelOrder>) -> Result<()> {
        let matched_order = &mut ctx.accounts.matched_order;
        
        require!(matched_order.status == OrderStatus::Pending, ErrorCode::InvalidOrderStatus);
        
        matched_order.status = OrderStatus::Cancelled;
        matched_order.updated_at = Clock::get()?.unix_timestamp;
        
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(order_id: u64)]
pub struct CreateMatchedOrder<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + MatchedOrder::LEN,
        seeds = [b"matched_order", &order_id.to_le_bytes()],
        bump
    )]
    pub matched_order: Account<'info, MatchedOrder>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfirmOrder<'info> {
    #[account(mut)]
    pub matched_order: Account<'info, MatchedOrder>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SettleOrder<'info> {
    #[account(mut)]
    pub matched_order: Account<'info, MatchedOrder>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelOrder<'info> {
    #[account(mut)]
    pub matched_order: Account<'info, MatchedOrder>,
    
    pub authority: Signer<'info>,
}

#[account]
pub struct MatchedOrder {
    pub order_id: u64,
    pub bidder: Pubkey,
    pub seller: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub price: u64,
    pub status: OrderStatus,
    pub created_at: i64,
    pub updated_at: i64,
}

impl MatchedOrder {
    pub const LEN: usize = 8 + // discriminator
        8 + // order_id
        32 + // bidder
        32 + // seller
        32 + // token_mint
        8 + // amount
        8 + // price
        1 + // status
        8 + // created_at
        8; // updated_at
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum OrderStatus {
    Pending,
    Confirmed,
    Settled,
    Cancelled,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid order status for this operation")]
    InvalidOrderStatus,
}