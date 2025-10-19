use anchor_lang::prelude::*;

declare_id!("CYgv14nE8urDSaLDw8uP5QJDpZP12mRgoX8nPMXuXM6P");

#[program]
pub mod order_store {
    use super::*;

    /// Create a new MatchedOrder PDA in Pending state
    pub fn create_matched_order(
        ctx: Context<CreateMatchedOrder>,
        amount: u64,
        price: u64,
        buyer: Pubkey,
        seller: Pubkey,
    ) -> Result<()> {
        let matched_order = &mut ctx.accounts.matched_order;
        
        matched_order.amount = amount;
        matched_order.price = price;
        matched_order.buyer = buyer;
        matched_order.seller = seller;
        matched_order.status = OrderStatus::Pending;
        matched_order.created_at = Clock::get()?.unix_timestamp;
        matched_order.settled_at = 0;
        
        msg!("OrderStore: Created MatchedOrder - amount: {}, price: {}, status: Pending", amount, price);
        Ok(())
    }

    /// Update the status of a MatchedOrder (used by OrderProcessor)
    pub fn update_order_status(
        ctx: Context<UpdateOrderStatus>,
        new_status: OrderStatus,
    ) -> Result<()> {
        let matched_order = &mut ctx.accounts.matched_order;
        
        require!(
            matched_order.status == OrderStatus::Pending,
            ErrorCode::InvalidOrderStatus
        );
        
        matched_order.status = new_status;
        
        if new_status == OrderStatus::Settled {
            matched_order.settled_at = Clock::get()?.unix_timestamp;
        }
        
        msg!("OrderStore: Updated order status to: {:?}", new_status);
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64, price: u64, buyer: Pubkey, seller: Pubkey)]
pub struct CreateMatchedOrder<'info> {
    #[account(
        init,
        payer = payer,
        space = MatchedOrder::LEN,
        seeds = [b"matched_order", buyer.as_ref(), seller.as_ref(), &amount.to_le_bytes(), &price.to_le_bytes()],
        bump
    )]
    pub matched_order: Account<'info, MatchedOrder>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateOrderStatus<'info> {
    #[account(mut)]
    pub matched_order: Account<'info, MatchedOrder>,
    
    /// Only the OrderProcessor program should be able to update status
    /// CHECK: This will be validated by checking the caller
    pub authority: UncheckedAccount<'info>,
}

#[account]
pub struct MatchedOrder {
    pub amount: u64,
    pub price: u64,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub status: OrderStatus,
    pub created_at: i64,
    pub settled_at: i64,
}

impl MatchedOrder {
    pub const LEN: usize = 8 + // discriminator
                          8 + // amount
                          8 + // price  
                          32 + // buyer
                          32 + // seller
                          1 + // status
                          8 + // created_at
                          8; // settled_at
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum OrderStatus {
    Pending,
    Settled,
    Cancelled,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid order status for this operation")]
    InvalidOrderStatus,
}