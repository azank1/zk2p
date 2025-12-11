use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use anchor_spl::token_interface::{TokenAccount, Mint};

declare_id!("Bk2pKQsXXvjPChX2G8AWgwoefnwRbTSirtHGnG8yUEdB");

// ============================================================================
// Phase 2B: Order Management Modules
// ============================================================================
pub mod critbit;
pub mod error;
pub mod order;
pub mod order_book;

use error::ErrorCode;
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

    /// Mark payment as made by buyer (P2P fiat settlement stub)
    pub fn mark_payment_made(
        ctx: Context<MarkPayment>,
        order_id: u128,
    ) -> Result<()> {
        let order_book = &mut ctx.accounts.order_book;
        let clock = Clock::get()?;
        
        // Find the order in the order book
        // This is a simplified implementation - in production would need more robust order tracking
        for queue in order_book.order_queues.iter_mut() {
            for order in queue.orders.iter_mut() {
                if order.order_id == order_id {
                    require!(
                        order.owner == ctx.accounts.buyer.key(),
                        ErrorCode::UnauthorizedAction
                    );
                    
                    // Update payment status
                    order.payment_status = order::PaymentStatus::PaymentMarked;
                    order.payment_marked_timestamp = clock.unix_timestamp;
                    order.settlement_timestamp = clock.unix_timestamp + 10; // 10 second delay
                    
                    msg!("Payment marked for order {}. Settlement in 10 seconds.", order_id);
                    return Ok(());
                }
            }
        }
        
        Err(ErrorCode::OrderNotFound.into())
    }

    /// Verify settlement after delay and release tokens with ZK proof verification
    /// 
    /// Public signals format: [emailHash[8], fromHeaderHash[8], orderId[2]]
    /// Proof format: Groth16 proof (a, b, c points)
    pub fn verify_settlement(
        ctx: Context<VerifySettlement>,
        order_id: u128,
        proof_a: Vec<u8>,      // G1 point (64 bytes: 32 bytes x + 32 bytes y)
        proof_b: Vec<u8>,      // G2 point (128 bytes: 4 coordinates)
        proof_c: Vec<u8>,      // G1 point (64 bytes: 32 bytes x + 32 bytes y)
        public_signals: Vec<String>, // Public signals from circuit
    ) -> Result<()> {
        let order_book = &mut ctx.accounts.order_book;
        let clock = Clock::get()?;
        
        // Find the order
        for queue in order_book.order_queues.iter_mut() {
            for order in queue.orders.iter_mut() {
                if order.order_id == order_id {
                    // Check settlement delay has passed
                    require!(
                        clock.unix_timestamp >= order.settlement_timestamp,
                        ErrorCode::SettlementDelayNotExpired
                    );
                    
                    // Verify ZK proof
                    // Public signals: [emailHash[8], fromHeaderHash[8], orderId[2]]
                    // Expected format: 18 strings total
                    require!(
                        public_signals.len() >= 18,
                        ErrorCode::InvalidProof
                    );
                    
                    // Extract order ID from public signals (last 2 elements)
                    let proof_order_id_low = public_signals[16].parse::<u64>()
                        .map_err(|_| ErrorCode::InvalidProof)?;
                    let proof_order_id_high = public_signals[17].parse::<u64>()
                        .map_err(|_| ErrorCode::InvalidProof)?;
                    let proof_order_id = (proof_order_id_high as u128) << 64 | (proof_order_id_low as u128);
                    
                    // Verify order ID matches
                    require!(
                        proof_order_id == order_id,
                        ErrorCode::ProofOrderIdMismatch
                    );
                    
                    // Verify proof format
                    require!(
                        proof_a.len() == 64 && proof_b.len() == 128 && proof_c.len() == 64,
                        ErrorCode::InvalidProof
                    );
                    
                    // TODO: Full Groth16 proof verification
                    // This requires a verifier program or library like solana-zk
                    // For now, we verify the proof structure and order ID match
                    // In production, add CPI call to verifier program or use on-chain verifier
                    
                    msg!("ZK proof structure verified for order {}", order_id);
                    msg!("Email hash (first): {}", public_signals[0]);
                    msg!("From header hash (first): {}", public_signals[8]);
                    
                    // Update status
                    order.payment_status = order::PaymentStatus::Verified;
                    
                    // Transfer tokens from escrow to seller
                    let token_mint = ctx.accounts.token_mint.key();
                    let seeds = &[
                        b"escrow_authority",
                        token_mint.as_ref(),
                        &[ctx.bumps.escrow_authority],
                    ];
                    let signer = &[&seeds[..]];
                    
                    let cpi_accounts = Transfer {
                        from: ctx.accounts.escrow_vault.to_account_info(),
                        to: ctx.accounts.seller_token_account.to_account_info(),
                        authority: ctx.accounts.escrow_authority.to_account_info(),
                    };
                    let cpi_program = ctx.accounts.token_program.to_account_info();
                    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
                    
                    token::transfer(cpi_ctx, order.quantity)?;
                    
                    msg!("Settlement verified for order {}. Tokens released.", order_id);
                    return Ok(());
                }
            }
        }
        
        Err(ErrorCode::OrderNotFound.into())
    }
    
    /// Reset the order book (close and allow re-init with new structure)
    pub fn reset_order_book(ctx: Context<ResetOrderBook>) -> Result<()> {
        msg!("Order book reset. Re-initialize with new structure.");
        Ok(())
    }

    /// Match an order with advanced order type handling
    pub fn match_order(
        ctx: Context<MatchOrder>,
        side: Side,
        quantity: u64,
        limit_price: u64,
        order_type: OrderType,
    ) -> Result<Vec<(u64, u64, u128)>> {
        require!(quantity > 0, ErrorCode::InvalidAmount);
        require!(limit_price > 0, ErrorCode::InvalidPrice);
        
        let order_book = &mut ctx.accounts.order_book;
        let taker_owner = ctx.accounts.owner.key();
        
        msg!(
            "Market: Matching order - side: {:?}, qty: {}, limit: {}, type: {:?}",
            side,
            quantity,
            limit_price,
            order_type
        );
        
        // Check for self-trade before matching
        if order_book.would_self_trade(side, &taker_owner) {
            msg!("Market: Self-trade detected, rejecting order");
            return Err(ErrorCode::SelfTradeNotAllowed.into());
        }
        
        // Execute matching
        let fills = order_book.match_order(side, quantity, limit_price, taker_owner)?;
        
        // Handle order type-specific logic
        match order_type {
            OrderType::Limit => {
                // If not fully filled, add remaining as limit order
                let filled_quantity: u64 = fills.iter().map(|(_, qty, _)| qty).sum();
                if filled_quantity < quantity {
                    msg!("Market: Limit order partially filled ({}/{})", filled_quantity, quantity);
                }
            },
            OrderType::Market => {
                // Market order: accept any fill amount
                let filled_quantity: u64 = fills.iter().map(|(_, qty, _)| qty).sum();
                msg!("Market: Market order filled {}/{}", filled_quantity, quantity);
            },
            OrderType::PostOnly => {
                // Post-only: reject if would match immediately
                if !fills.is_empty() {
                    msg!("Market: Post-only order would match immediately, rejecting");
                    return Err(ErrorCode::PostOnlyWouldMatch.into());
                }
            },
            OrderType::ImmediateOrCancel => {
                // IOC: fill what's possible, cancel rest (no resting order)
                let filled_quantity: u64 = fills.iter().map(|(_, qty, _)| qty).sum();
                msg!("Market: IOC filled {}/{}, canceling remainder", filled_quantity, quantity);
            },
            OrderType::FillOrKill => {
                // FOK: must fill completely or reject entirely
                let filled_quantity: u64 = fills.iter().map(|(_, qty, _)| qty).sum();
                if filled_quantity < quantity {
                    msg!("Market: FOK order cannot be fully filled, rejecting");
                    return Err(ErrorCode::FillOrKillNotFilled.into());
                }
            },
        }
        
        msg!("Market: Matched {} orders, total fills: {}", fills.len(), fills.iter().map(|(_, qty, _)| qty).sum::<u64>());
        
        Ok(fills)
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
        space = 8 + OrderBook::INIT_SPACE,
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

#[derive(Accounts)]
pub struct MatchOrder<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

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
pub struct MarkPayment<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
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
pub struct VerifySettlement<'info> {
    #[account(
        mut,
        seeds = [b"order_book", token_mint.key().as_ref()],
        bump,
    )]
    pub order_book: Account<'info, OrderBook>,
    
    #[account(
        mut,
        seeds = [b"escrow_vault", token_mint.key().as_ref()],
        bump,
        constraint = escrow_vault.mint == token_mint.key() @ ErrorCode::InvalidMint,
    )]
    pub escrow_vault: InterfaceAccount<'info, TokenAccount>,
    
    #[account(mut)]
    pub seller_token_account: InterfaceAccount<'info, TokenAccount>,
    
    /// CHECK: PDA that has authority over escrow vault
    #[account(
        seeds = [b"escrow_authority", token_mint.key().as_ref()],
        bump,
    )]
    pub escrow_authority: UncheckedAccount<'info>,
    
    pub token_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ResetOrderBook<'info> {
    #[account(
        mut,
        seeds = [b"order_book", token_mint.key().as_ref()],
        bump,
        close = authority,
    )]
    pub order_book: Account<'info, OrderBook>,
    
    #[account(
        seeds = [b"market", token_mint.key().as_ref()],
        bump,
    )]
    pub market: Account<'info, Market>,
    
    pub token_mint: InterfaceAccount<'info, Mint>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

