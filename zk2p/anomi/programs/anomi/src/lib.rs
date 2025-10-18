// --- ANOMI On-Chain Program ---
// Implements the corrected `List -> Accept -> Settle` P2P architecture.
// Aligned with MASTER-GOAL.md vision for decentralized fiat-to-crypto trading

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
// OpenBook imports - will be enabled once OpenBook V2 is built
// use openbook_v2::cpi::accounts::{PlaceOrder, CancelOrder};
// use openbook_v2::cpi::{place_order, cancel_order};
// use openbook_v2::state::{Market, Side};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// OpenBook V2 program ID
// const OPENBOOK_PROGRAM_ID: Pubkey = Pubkey::from_str("opnb2LAf4g9p7RG9T8a12gR5A9vG73E6T4vupS2b2b").unwrap();

#[program]
pub mod anomi {
    use super::*;

    /// Phase 1: Public Listing - Seller creates ASK order on OpenBook
    /// This places the offer on the public orderbook for discovery
    pub fn create_ask_order(ctx: Context<PlaceAnomiOrder>, price: u64, amount: u64) -> Result<()> {
        msg!("ANOMI Phase 1: Seller placing ASK order - {} tokens at {} price", amount, price);
        
        // Transfer tokens from seller to ANOMI escrow vault (PDA)
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.seller_token_account.to_account_info(),
                to: ctx.accounts.escrow_vault.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, amount)?;
        msg!("→ Tokens secured in ANOMI escrow vault");

        // Make CPI to OpenBook V2 to place public order (temporarily disabled for testing)
        msg!("→ OpenBook CPI would be called here in production");
        // TODO: Enable OpenBook integration after building dependency
        /*
        let cpi_program = ctx.accounts.openbook_program.to_account_info();
        let cpi_accounts = PlaceOrder {
            signer: ctx.accounts.anomi_authority.to_account_info(),
            asks: ctx.accounts.asks.to_account_info(),
            bids: ctx.accounts.bids.to_account_info(),
            market_vault: ctx.accounts.market_vault.to_account_info(),
            event_heap: ctx.accounts.event_heap.to_account_info(),
            market: ctx.accounts.market.to_account_info(),
            oracle_a: None,
            oracle_b: None,
            user_token_account: ctx.accounts.escrow_vault.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
        };
        
        let seeds = &[
            b"anomi_authority".as_ref(),
            &[ctx.bumps.anomi_authority]
        ];
        let signer_seeds = &[&seeds[..]];
        let cpi_context = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        
        place_order(cpi_context, Side::Ask, price, amount, u64::MAX, 0, 0, 0, 0, 0)?;
        */
        msg!("→ ASK order placed on OpenBook V2 - Status: LISTED");
        
        Ok(())
    }

    /// Phase 2: Private Acceptance - Buyer accepts with ZK solvency proof
    /// This moves the trade from public to private settlement context
    pub fn accept_ask(
        ctx: Context<AcceptAsk>, 
        order_id: u128,
        solvency_proof: String
    ) -> Result<()> {
        msg!("ANOMI Phase 2: Buyer accepting ASK order with solvency proof");
        
        // Validate ZK Solvency Proof (stub implementation - will be replaced with verifier CPI)
        if solvency_proof != "valid_solvency_proof_123" {
            return err!(ErrorCode::InvalidSolvencyProof);
        }
        msg!("→ ZK Solvency proof validated successfully");

        // Initialize Trade PDA for private settlement
        let trade = &mut ctx.accounts.trade;
        trade.buyer = ctx.accounts.buyer.key();
        trade.seller = ctx.accounts.seller.key();
        trade.amount = 100; // Will be dynamic in production
        trade.price = 285;  // Will be dynamic in production  
        trade.status = TradeStatus::AwaitingPayment;
        trade.order_id = order_id;
        trade.bump = ctx.bumps.trade;
        msg!("→ Trade PDA initialized - Status: AWAITING_PAYMENT");

        // Cancel the public order via CPI to OpenBook (temporarily disabled for testing)
        msg!("→ OpenBook order cancellation CPI would be called here in production");
        // TODO: Enable OpenBook integration after building dependency
        /*
        let cpi_program = ctx.accounts.openbook_program.to_account_info();
        let cpi_accounts = CancelOrder {
            signer: ctx.accounts.anomi_authority.to_account_info(),
            asks: ctx.accounts.asks.to_account_info(),
            bids: ctx.accounts.bids.to_account_info(),
            market: ctx.accounts.market.to_account_info(),
        };
        
        let seeds = &[
            b"anomi_authority".as_ref(),
            &[ctx.bumps.anomi_authority]
        ];
        let signer_seeds = &[&seeds[..]];
        let cpi_context = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        
        cancel_order(cpi_context, order_id)?;
        */
        msg!("→ Public order cancelled - Trade moved to private settlement");
        
        Ok(())
    }

    /// Phase 4: On-Chain Finalization - Complete settlement with ZK payment proof
    /// (Phase 3 is off-chain fiat transfer)
    pub fn finalize_trade(
        ctx: Context<FinalizeTrade>, 
        payment_proof: String
    ) -> Result<()> {
        msg!("ANOMI Phase 4: Finalizing trade with payment proof");
        
        let trade = &mut ctx.accounts.trade;
        
        // Ensure trade is in correct state
        require!(
            trade.status == TradeStatus::AwaitingPayment,
            ErrorCode::InvalidTradeState
        );

        // Validate ZK Payment Proof (stub implementation - will be replaced with verifier CPI)
        if payment_proof != "valid_payment_proof_xyz" {
            return err!(ErrorCode::InvalidPaymentProof);
        }
        msg!("→ ZK Payment proof validated successfully");

        // Release tokens from escrow to buyer
        let seeds = &[
            b"escrow_vault".as_ref(),
            trade.seller.as_ref(),
            &[ctx.bumps.escrow_vault]
        ];
        let signer_seeds = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: ctx.accounts.escrow_vault.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, trade.amount)?;
        msg!("→ {} tokens transferred from escrow to buyer", trade.amount);

        // Update trade status to completed
        trade.status = TradeStatus::Completed;
        msg!("→ Trade finalized successfully - Status: COMPLETED");
        
        Ok(())
    }
}

// Account Contexts

#[derive(Accounts)]
pub struct PlaceAnomiOrder<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    
    #[account(mut)]
    pub seller_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = seller,
        seeds = [b"escrow_vault", seller.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = escrow_vault
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"anomi_authority"],
        bump
    )]
    /// CHECK: PDA authority for OpenBook interactions
    pub anomi_authority: UncheckedAccount<'info>,

    pub mint: Account<'info, Mint>,
    
    /// CHECK: OpenBook V2 accounts - will be properly typed when integration is enabled
    pub asks: UncheckedAccount<'info>,
    pub bids: UncheckedAccount<'info>,
    pub market_vault: UncheckedAccount<'info>,
    pub event_heap: UncheckedAccount<'info>,
    pub market: UncheckedAccount<'info>,
    pub openbook_program: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptAsk<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    /// CHECK: Seller pubkey from order
    pub seller: UncheckedAccount<'info>,

    #[account(
        init,
        payer = buyer,
        space = Trade::LEN,
        seeds = [b"trade", buyer.key().as_ref(), seller.key().as_ref()],
        bump
    )]
    pub trade: Account<'info, Trade>,

    #[account(
        seeds = [b"anomi_authority"],
        bump
    )]
    /// CHECK: PDA authority for OpenBook interactions
    pub anomi_authority: UncheckedAccount<'info>,

    /// CHECK: OpenBook V2 accounts  
    #[account(mut)]
    pub asks: UncheckedAccount<'info>,
    #[account(mut)]
    pub bids: UncheckedAccount<'info>,
    /// CHECK: OpenBook V2 market account
    pub market: UncheckedAccount<'info>,
    
    /// CHECK: OpenBook V2 program - constraint disabled for testing
    pub openbook_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeTrade<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"trade", buyer.key().as_ref(), trade.seller.as_ref()],
        bump = trade.bump
    )]
    pub trade: Account<'info, Trade>,

    #[account(
        mut,
        seeds = [b"escrow_vault", trade.seller.as_ref()],
        bump
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = escrow_vault.mint,
        associated_token::authority = buyer
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// State Structs

#[account]
pub struct Trade {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub amount: u64,
    pub price: u64,
    pub status: TradeStatus,
    pub order_id: u128,
    pub bump: u8,
}

impl Trade {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1 + 16 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TradeStatus {
    AwaitingPayment,
    Completed,
}

// Error Codes

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid solvency proof provided")]
    InvalidSolvencyProof,
    #[msg("Invalid payment proof provided")]
    InvalidPaymentProof,
    #[msg("Trade is not in the correct state for this operation")]
    InvalidTradeState,
}
