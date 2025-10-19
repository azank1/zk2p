use anchor_lang::prelude::*;

declare_id!("7eAHPRbhqzsqpC1Wuw2Y8AqRGGqGcEGAXAGmfsovfLae");

#[program]
pub mod market {
    use super::*;

    /// Create a bid order and immediately trigger matching
    /// This is a stub that simulates instant matching for testing
    pub fn create_bid(
        ctx: Context<CreateBid>,
        amount: u64,
        price: u64,
        trader: Pubkey,
    ) -> Result<()> {
        msg!("Market: Received bid - amount: {}, price: {}", amount, price);
        
        // In a real matching engine, this would match against the order book
        // For this prototype, we immediately create a MatchedOrder via CPI
        
        let cpi_program = ctx.accounts.order_store_program.to_account_info();
        let cpi_accounts = order_store::cpi::accounts::CreateMatchedOrder {
            matched_order: ctx.accounts.matched_order.to_account_info(),
            payer: ctx.accounts.payer.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        // Create the matched order via CPI
        order_store::cpi::create_matched_order(
            cpi_ctx,
            amount,
            price,
            trader,
            trader, // For simplicity, same trader on both sides in this stub
        )?;
        
        msg!("Market: Successfully created MatchedOrder via CPI");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateBid<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    /// The MatchedOrder PDA that will be created in OrderStore
    /// CHECK: This will be validated by the OrderStore program via CPI
    #[account(mut)]
    pub matched_order: UncheckedAccount<'info>,
    
    /// The OrderStore program we'll call via CPI
    /// CHECK: This should be the OrderStore program ID
    pub order_store_program: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}
