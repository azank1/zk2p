use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use anchor_spl::token_interface::{TokenAccount, Mint};

declare_id!("7eAHPRbhqzsqpC1Wuw2Y8AqRGGqGcEGAXAGmfsovfLae");

// ============================================================================
// Phase 2B: Order Management Modules
// ============================================================================
pub mod critbit;
pub mod order;
pub mod order_book;

use order::{Order, OrderType, Side, generate_order_id};
use order_book::OrderBook;

// ============================================================================
// Account Structures
// ============================================================================

/// Market account for tracking global state
#[account]
pub struct Market {
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub next_order_sequence: u64,  // Counter for generating order IDs
}

impl Market {
    pub const LEN: usize = 8 +  // discriminator
                          32 + // authority
                          32 + // token_mint
                          8;   // next_order_sequence
}

#[program]
pub mod market {
    use super::*;

    /// Initialize the escrow vault for a specific token mint
    pub fn initialize_escrow_vault(ctx: Context<InitializeEscrowVault>) -> Result<()> {
        msg!(
            "Market: Initializing escrow vault for mint: {}",
            ctx.accounts.token_mint.key()
        );
        Ok(())
    }

    /// Initialize the market account
    pub fn initialize_market(ctx: Context<InitializeMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.token_mint = ctx.accounts.token_mint.key();
        market.next_order_sequence = 0;
        
        msg!("Market: Initialized market for mint: {}", market.token_mint);
        msg!("Market: Authority set to: {}", market.authority);
        Ok(())
    }

    /// Initialize order book with CritBit tree
    pub fn initialize_order_book_v2(ctx: Context<InitializeOrderBook>) -> Result<()> {
        let order_book = &mut ctx.accounts.order_book;
        let market = ctx.accounts.market.key();
        let token_mint = ctx.accounts.token_mint.key();
        
        // Initialize OrderBook with CritBit trees
        // Use double deref to assign to Account wrapper
        **order_book = OrderBook::new(market, token_mint, token_mint);
        
        msg!("Market: Initialized OrderBook for mint: {}", token_mint);
        msg!("Market: Supports {} price levels", OrderBook::MAX_PRICE_LEVELS);
        msg!("Market: CritBit trees initialized for bids and asks");
        Ok(())
    }

    /// Place a limit order
    pub fn place_limit_order_v2(
        ctx: Context<PlaceLimitOrder>,
        side: Side,
        price: u64,
        quantity: u64,
        order_type: OrderType,
        client_order_id: u64,
        payment_method: String,
    ) -> Result<u128> {
        require!(quantity > 0, ErrorCode::InvalidAmount);
        require!(price > 0, ErrorCode::InvalidPrice);
        
        let market = &mut ctx.accounts.market;
        let order_book = &mut ctx.accounts.order_book;
        
        // Generate unique u128 order ID
        let order_id = generate_order_id(
            &ctx.accounts.owner.key(),
            market.next_order_sequence,
            Clock::get()?.unix_timestamp,
        );
        market.next_order_sequence += 1;
        
        msg!(
            "Market: Placing limit order - owner: {}, side: {:?}, price: {}, qty: {}, type: {:?}",
            ctx.accounts.owner.key(),
            side,
            price,
            quantity,
            order_type
        );
        
        // Create Order struct
        let order = Order::new(
            order_id,
            ctx.accounts.owner.key(),
            quantity,
            price,
            Clock::get()?.unix_timestamp,
            order_type,
            side,
            client_order_id,
            payment_method,
        );
        
        // If this is an Ask order, transfer tokens to escrow
        if side == Side::Ask {
            let transfer_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.owner_token_account.to_account_info(),
                    to: ctx.accounts.escrow_vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            );
            token::transfer(transfer_ctx, quantity)?;
            msg!("Market: {} tokens transferred to escrow", quantity);
        }
        
        // Insert into CritBit-based order book
        order_book.insert_order(order)?;
        
        msg!("Market: Order inserted successfully - ID: {}", order_id);
        msg!("Market: Total orders in book: {}", order_book.total_orders);
        
        Ok(order_id)
    }

    /// Cancel an order and return escrowed tokens
    pub fn cancel_order(
        ctx: Context<CancelOrder>,
        order_id: u128,
        side: Side,
        price: u64,
    ) -> Result<()> {
        let order_book = &mut ctx.accounts.order_book;
        
        // Remove order from order book
        let order = order_book.remove_order(order_id, side, price)?;
        
        // Verify the caller is the order owner
        require!(
            order.owner == ctx.accounts.owner.key(),
            ErrorCode::UnauthorizedCancellation
        );
        
        msg!(
            "Market: Cancelling order - ID: {}, owner: {}, side: {:?}, price: {}",
            order_id,
            ctx.accounts.owner.key(),
            side,
            price
        );
        
        // If this was an Ask order, return escrowed tokens
        if side == Side::Ask {
            let remaining_quantity = order.quantity; // quantity is already the remaining amount
            
            if remaining_quantity > 0 {
                let token_mint_key = ctx.accounts.token_mint.key();
                let seeds = &[
                    b"escrow_authority",
                    token_mint_key.as_ref(),
                    &[ctx.bumps.escrow_authority],
                ];
                let signer_seeds = &[&seeds[..]];
                
                let transfer_ctx = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow_vault.to_account_info(),
                        to: ctx.accounts.owner_token_account.to_account_info(),
                        authority: ctx.accounts.escrow_authority.to_account_info(),
                    },
                    signer_seeds,
                );
                
                token::transfer(transfer_ctx, remaining_quantity)?;
                msg!("Market: Returned {} tokens from escrow", remaining_quantity);
            }
        }
        
        msg!("Market: Order cancelled successfully");
        msg!("Market: Total orders remaining: {}", order_book.total_orders);
        
        Ok(())
    }
}

// ============================================================================
// Account Validation Structures
// ============================================================================

#[derive(Accounts)]
pub struct InitializeEscrowVault<'info> {
    #[account(
        init,
        payer = payer,
        token::mint = token_mint,
        token::authority = escrow_authority,
        seeds = [b"escrow_vault", token_mint.key().as_ref()],
        bump,
    )]
    pub escrow_vault: InterfaceAccount<'info, TokenAccount>,

    /// PDA that will have authority over the escrow vault
    /// CHECK: PDA derived from seeds, used as token account authority
    #[account(
        seeds = [b"escrow_authority", token_mint.key().as_ref()],
        bump,
    )]
    pub escrow_authority: UncheckedAccount<'info>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// ============================================================================
// Account Validation Structures
// ============================================================================

#[derive(Accounts)]
pub struct InitializeMarket<'info> {
    #[account(
        init,
        payer = payer,
        space = Market::LEN,
        seeds = [b"market", token_mint.key().as_ref()],
        bump,
    )]
    pub market: Account<'info, Market>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    /// CHECK: Authority for market configuration
    pub authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeOrderBook<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + std::mem::size_of::<OrderBook>(),
        seeds = [b"order_book", token_mint.key().as_ref()],
        bump,
    )]
    pub order_book: Account<'info, OrderBook>,

    #[account(
        seeds = [b"market", token_mint.key().as_ref()],
        bump,
    )]
    pub market: Account<'info, Market>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceLimitOrder<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        constraint = owner_token_account.owner == owner.key() @ ErrorCode::InvalidTokenAccountOwner,
        constraint = owner_token_account.mint == token_mint.key() @ ErrorCode::InvalidMint,
    )]
    pub owner_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"escrow_vault", token_mint.key().as_ref()],
        bump,
        constraint = escrow_vault.mint == token_mint.key() @ ErrorCode::InvalidMint,
    )]
    pub escrow_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"market", token_mint.key().as_ref()],
        bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"order_book", token_mint.key().as_ref()],
        bump,
    )]
    pub order_book: Account<'info, OrderBook>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelOrder<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        constraint = owner_token_account.owner == owner.key() @ ErrorCode::InvalidTokenAccountOwner,
        constraint = owner_token_account.mint == token_mint.key() @ ErrorCode::InvalidMint,
    )]
    pub owner_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"escrow_vault", token_mint.key().as_ref()],
        bump,
        constraint = escrow_vault.mint == token_mint.key() @ ErrorCode::InvalidMint,
    )]
    pub escrow_vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: PDA that has authority over escrow vault
    #[account(
        seeds = [b"escrow_authority", token_mint.key().as_ref()],
        bump,
    )]
    pub escrow_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"order_book", token_mint.key().as_ref()],
        bump,
    )]
    pub order_book: Account<'info, OrderBook>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ============================================================================
// Error Codes
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,

    #[msg("Price must be greater than zero")]
    InvalidPrice,

    #[msg("Payment method string is too long (max 100 characters)")]
    PaymentMethodTooLong,

    #[msg("Token account owner does not match seller")]
    InvalidTokenAccountOwner,

    #[msg("Token mint does not match expected mint")]
    InvalidMint,

    #[msg("Unauthorized caller - only OrderProcessor can release escrow")]
    UnauthorizedCaller,

    #[msg("Invalid program ID")]
    InvalidProgramId,

    #[msg("No matching orders found for this bid")]
    NoMatchingOrders,

    #[msg("Unauthorized cancellation - only order owner can cancel")]
    UnauthorizedCancellation,
}
