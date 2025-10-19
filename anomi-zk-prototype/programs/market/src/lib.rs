use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use anchor_spl::token_interface::{TokenAccount, Mint};

declare_id!("7eAHPRbhqzsqpC1Wuw2Y8AqRGGqGcEGAXAGmfsovfLae");

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
        msg!("Market: Ask order placed successfully");

        // TODO: In Phase 2A, store this order in an order book PDA
        // For now, we just log it

        Ok(())
    }

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
}
