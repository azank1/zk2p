use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use anchor_spl::token_interface::{TokenAccount, Mint};

declare_id!("7eAHPRbhqzsqpC1Wuw2Y8AqRGGqGcEGAXAGmfsovfLae");

// ============================================================================
// Data Structures for Order Book
// ============================================================================

#[account]
pub struct AskOrder {
    pub seller: Pubkey,
    pub amount: u64,
    pub price: u64,
    pub payment_method: String,
    pub created_at: i64,
    pub order_id: Pubkey,
}

impl AskOrder {
    pub const LEN: usize = 8 + // discriminator
                          32 + // seller
                          8 +  // amount
                          8 +  // price
                          4 +  // payment_method length
                          100 + // payment_method (max 100 chars)
                          8 +  // created_at
                          32;  // order_id
}

#[account]
pub struct OrderBook {
    pub token_mint: Pubkey,
    pub orders: Vec<AskOrder>,
    pub last_order_id: u64,
}

impl OrderBook {
    pub const LEN: usize = 8 + // discriminator
                          32 + // token_mint
                          4 +  // orders length
                          (AskOrder::LEN * 10) + // Max 10 orders (to stay under 10KB limit)
                          8;   // last_order_id
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

    /// Initialize the order book for a specific token mint
    pub fn initialize_order_book(ctx: Context<InitializeOrderBook>) -> Result<()> {
        let order_book = &mut ctx.accounts.order_book;
        order_book.token_mint = ctx.accounts.token_mint.key();
        order_book.orders = Vec::new();
        order_book.last_order_id = 0;
        
        msg!(
            "Market: Initialized order book for mint: {}",
            ctx.accounts.token_mint.key()
        );
        Ok(())
    }

    /// Place an ask order (seller lists tokens for sale)
    /// Tokens are transferred to escrow and held until settlement
    pub fn place_ask_order(
        ctx: Context<PlaceAskOrder>,
        amount: u64,
        price: u64,
        payment_method: String,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(price > 0, ErrorCode::InvalidPrice);
        require!(
            payment_method.len() <= 100,
            ErrorCode::PaymentMethodTooLong
        );

        msg!(
            "Market: Placing ask order - seller: {}, amount: {}, price: {}, payment_method: {}",
            ctx.accounts.seller.key(),
            amount,
            price,
            payment_method
        );

        // Transfer tokens from seller to escrow vault
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.seller_token_account.to_account_info(),
                to: ctx.accounts.escrow_vault.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        );

        token::transfer(transfer_ctx, amount)?;

        msg!("Market: {} tokens transferred to escrow vault", amount);

        // Store order in order book
        let order_book = &mut ctx.accounts.order_book;
        order_book.last_order_id += 1;
        
        let order_id = Pubkey::find_program_address(
            &[
                b"ask_order",
                ctx.accounts.seller.key().as_ref(),
                &order_book.last_order_id.to_le_bytes(),
                &amount.to_le_bytes(),
                &price.to_le_bytes(),
            ],
            &crate::ID,
        ).0;

        let ask_order = AskOrder {
            seller: ctx.accounts.seller.key(),
            amount,
            price,
            payment_method,
            created_at: Clock::get()?.unix_timestamp,
            order_id,
        };

        order_book.orders.push(ask_order);
        
        msg!("Market: Ask order stored in order book with ID: {}", order_id);
        msg!("Market: Order book now has {} orders", order_book.orders.len());

        Ok(())
    }

    /// Create a bid order and trigger matching against the order book
    /// Implements price-time priority matching algorithm
    pub fn create_bid(
        ctx: Context<CreateBid>,
        amount: u64,
        price: u64,
        trader: Pubkey,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(price > 0, ErrorCode::InvalidPrice);
        
        msg!("Market: Received bid - amount: {}, price: {}, trader: {}", amount, price, trader);
        
        let order_book = &mut ctx.accounts.order_book;
        let mut matched_orders = Vec::new();
        
        // Sort orders by price (ascending - best price first) and then by time (ascending - first in, first out)
        order_book.orders.sort_by(|a, b| {
            a.price.cmp(&b.price)
                .then(a.created_at.cmp(&b.created_at))
        });
        
        msg!("Market: Order book has {} orders to match against", order_book.orders.len());
        
        // Find matching orders
        let mut orders_to_remove = Vec::new();
        for (index, ask_order) in order_book.orders.iter().enumerate() {
            // Check if this ask order can be matched
            if ask_order.price <= price {
                let fill_amount = std::cmp::min(amount, ask_order.amount);
                
                msg!(
                    "Market: Matching bid with ask - ask_price: {}, ask_amount: {}, fill_amount: {}",
                    ask_order.price, ask_order.amount, fill_amount
                );
                
                // Create matched order for this fill
                let cpi_program = ctx.accounts.order_store_program.to_account_info();
                let cpi_accounts = order_store::cpi::accounts::CreateMatchedOrder {
                    matched_order: ctx.accounts.matched_order.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                };
                let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
                
                order_store::cpi::create_matched_order(
                    cpi_ctx,
                    fill_amount,
                    ask_order.price, // Use ask price for the match
                    trader, // buyer
                    ask_order.seller, // seller
                )?;
                
                matched_orders.push((index, fill_amount));
                
                // If ask order is fully filled, mark for removal
                if fill_amount == ask_order.amount {
                    orders_to_remove.push(index);
                } else {
                    // Update remaining amount in the ask order
                    // Note: We'll need to handle this in the order book update
                }
                
                msg!("Market: Created match - {} tokens at price {}", fill_amount, ask_order.price);
                
                // For now, we'll only match one order per bid to keep it simple
                // In a full implementation, we'd continue matching until bid is filled or no more compatible asks
                break;
            }
        }
        
        if matched_orders.is_empty() {
            msg!("Market: No matching orders found for bid");
            return Err(ErrorCode::NoMatchingOrders.into());
        }
        
        // Remove fully filled orders (in reverse order to maintain indices)
        for &index in orders_to_remove.iter().rev() {
            order_book.orders.remove(index);
        }
        
        // Update partially filled orders
        for (index, fill_amount) in matched_orders.iter() {
            if let Some(order) = order_book.orders.get_mut(*index) {
                if order.amount > *fill_amount {
                    order.amount -= fill_amount;
                }
            }
        }
        
        msg!("Market: Matching completed - {} orders matched", matched_orders.len());
        msg!("Market: Order book now has {} remaining orders", order_book.orders.len());
        
        Ok(())
    }

    /// Release escrowed funds to the buyer after ZK proof validation
    /// SECURITY: This instruction can ONLY be called by the OrderProcessor program
    pub fn release_escrowed_funds(
        ctx: Context<ReleaseEscrowedFunds>,
        amount: u64,
    ) -> Result<()> {
        // CRITICAL SECURITY CHECK: Verify caller is OrderProcessor program
        let order_processor_program_id = 
            Pubkey::try_from("F1J8MS1XhZgALP4VSjrKHF4Kj3VaG1vnNUCtafVnHgKo")
                .map_err(|_| ErrorCode::InvalidProgramId)?;

        require!(
            ctx.accounts.caller.key() == order_processor_program_id,
            ErrorCode::UnauthorizedCaller
        );

        msg!(
            "Market: Releasing {} tokens from escrow to buyer: {}",
            amount,
            ctx.accounts.buyer_token_account.key()
        );

        // Derive PDA signer seeds for escrow authority
        let token_mint = ctx.accounts.token_mint.key();
        let seeds = &[
            b"escrow_authority",
            token_mint.as_ref(),
            &[ctx.bumps.escrow_authority],
        ];
        let signer_seeds = &[&seeds[..]];

        // Transfer tokens from escrow vault to buyer
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: ctx.accounts.escrow_authority.to_account_info(),
            },
            signer_seeds,
        );

        token::transfer(transfer_ctx, amount)?;

        msg!("Market: Escrow released successfully");
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

#[derive(Accounts)]
pub struct InitializeOrderBook<'info> {
    #[account(
        init,
        payer = payer,
        space = OrderBook::LEN,
        seeds = [b"order_book", token_mint.key().as_ref()],
        bump,
    )]
    pub order_book: Account<'info, OrderBook>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct PlaceAskOrder<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        constraint = seller_token_account.owner == seller.key() @ ErrorCode::InvalidTokenAccountOwner,
        constraint = seller_token_account.mint == token_mint.key() @ ErrorCode::InvalidMint,
    )]
    pub seller_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"escrow_vault", token_mint.key().as_ref()],
        bump,
        constraint = escrow_vault.mint == token_mint.key() @ ErrorCode::InvalidMint,
    )]
    pub escrow_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"order_book", token_mint.key().as_ref()],
        bump,
    )]
    pub order_book: Account<'info, OrderBook>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Program<'info, Token>,
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
    
    #[account(
        mut,
        seeds = [b"order_book", token_mint.key().as_ref()],
        bump,
    )]
    pub order_book: Account<'info, OrderBook>,
    
    pub token_mint: InterfaceAccount<'info, Mint>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseEscrowedFunds<'info> {
    /// The caller must be the OrderProcessor program
    /// CHECK: Validated in instruction logic
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow_vault", token_mint.key().as_ref()],
        bump,
    )]
    pub escrow_vault: InterfaceAccount<'info, TokenAccount>,

    /// PDA that has authority over the escrow vault
    /// CHECK: PDA derived from seeds
    #[account(
        seeds = [b"escrow_authority", token_mint.key().as_ref()],
        bump,
    )]
    pub escrow_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = buyer_token_account.mint == token_mint.key() @ ErrorCode::InvalidMint,
    )]
    pub buyer_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Program<'info, Token>,
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
}
