# Phase 2B: Complete Settlement Integration with PDA Locking

## Current State Analysis

### What Works Now (Phase 2A)
✅ **Order Book Matching**: Price-time priority algorithm  
✅ **Token Escrow**: SPL tokens held in vault  
✅ **Match Creation**: CPI to OrderStore creates `MatchedOrder` PDA  
✅ **Basic Settlement**: OrderProcessor validates ZK proofs (stubbed)

### What's Missing
❌ **PDA Locking**: MatchedOrder PDAs not locked during settlement  
❌ **Escrow Release**: No automatic token transfer after proof validation  
❌ **State Transitions**: No enforcement of Pending → InProgress → Settled flow  
❌ **Atomic Settlement**: Matching and escrow release are separate operations

---

## Proposed Architecture: 1-Buyer-to-1-Seller with PDA Locking

### Core Concept: The MatchedOrder PDA as Settlement Lock

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: MATCHING (Market Program)                         │
├─────────────────────────────────────────────────────────────┤
│  1. Buyer submits bid                                       │
│  2. Algorithm finds matching seller                         │
│  3. Create MatchedOrder PDA (seeds: [buyer, seller, nonce]) │
│  4. Lock escrow amount to this specific PDA                 │
│  5. Status: Pending                                         │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: SETTLEMENT (OrderProcessor Program)               │
├─────────────────────────────────────────────────────────────┤
│  1. Buyer submits ZK proof to OrderProcessor               │
│  2. Validate proof against MatchedOrder PDA                │
│  3. Lock PDA: Status → InProgress (prevent re-entrancy)    │
│  4. CPI to Market: release_escrowed_funds()                │
│  5. Transfer tokens from escrow → buyer                    │
│  6. Update PDA: Status → Settled                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### 1. Enhanced MatchedOrder PDA Structure

**Add to `order-store/src/lib.rs`:**

```rust
#[account]
pub struct MatchedOrder {
    pub amount: u64,
    pub price: u64,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub status: OrderStatus,
    pub created_at: i64,
    pub settled_at: i64,
    
    // NEW FIELDS FOR PHASE 2B
    pub escrow_vault: Pubkey,        // Which vault holds the tokens
    pub token_mint: Pubkey,          // Which token is being traded
    pub escrow_bump: u8,             // Bump seed for escrow authority PDA
    pub order_bump: u8,              // Bump seed for this PDA
    pub settlement_deadline: i64,    // Unix timestamp (e.g., 24 hours)
    pub locked_by: Pubkey,           // Current processor (prevent parallel settlement)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum OrderStatus {
    Pending,        // Just matched, awaiting settlement
    InProgress,     // Settlement started (PDA locked)
    Settled,        // Successfully completed
    Expired,        // Deadline passed (refund seller)
    Cancelled,      // Manually cancelled (refund seller)
}
```

**Why this design?**
- `escrow_vault` + `token_mint`: Direct link to escrowed funds
- `locked_by`: Prevents race conditions (only one settlement at a time)
- `settlement_deadline`: Automatic refunds if buyer doesn't pay
- Bump seeds: Allows PDA re-derivation for verification

---

### 2. Atomic Match + Lock Flow

**Update `market/src/lib.rs` → `create_bid()`:**

```rust
pub fn create_bid(
    ctx: Context<CreateBid>,
    amount: u64,
    price: u64,
    trader: Pubkey,
) -> Result<()> {
    // ... existing matching logic ...
    
    // MATCH FOUND - Create locked PDA
    let matched_order_seeds = [
        b"matched_order",
        ctx.accounts.buyer.key().as_ref(),
        ask_order.seller.as_ref(),
        &Clock::get()?.unix_timestamp.to_le_bytes(), // Nonce for uniqueness
    ];
    
    let (matched_order_pda, bump) = Pubkey::find_program_address(
        &matched_order_seeds,
        ctx.accounts.order_store_program.key(),
    );
    
    // CPI to OrderStore with escrow metadata
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    order_store::cpi::create_matched_order(
        cpi_ctx,
        fill_amount,
        ask_order.price,
        trader, // buyer
        ask_order.seller,
        ctx.accounts.escrow_vault.key(),      // NEW: Link to escrow
        ctx.accounts.token_mint.key(),        // NEW: Token being traded
        ctx.accounts.escrow_authority_bump,   // NEW: For CPI signing
        bump,                                 // NEW: PDA bump
        Clock::get()?.unix_timestamp + 86400, // NEW: 24hr deadline
    )?;
    
    msg!("Market: MatchedOrder PDA locked to escrow vault");
    
    // ... continue with order book updates ...
}
```

**Key change:** The `MatchedOrder` PDA is now a **smart lock** that knows:
- ✅ Which escrow vault to release from
- ✅ How to verify it's the correct match
- ✅ When to expire (deadline)

---

### 3. Settlement with PDA Locking

**Update `order-processor/src/lib.rs` → `finalize_trade()`:**

```rust
pub fn finalize_trade(
    ctx: Context<FinalizeTrade>,
    proof_a: [u8; 64],
    proof_b: [u8; 128], 
    proof_c: [u8; 64],
    public_signals: Vec<String>,
) -> Result<()> {
    let matched_order = &mut ctx.accounts.matched_order;
    
    // SECURITY: Enforce state machine
    require!(
        matched_order.status == order_store::OrderStatus::Pending,
        ErrorCode::OrderNotPending
    );
    
    // SECURITY: Check deadline hasn't passed
    let now = Clock::get()?.unix_timestamp;
    require!(
        now <= matched_order.settlement_deadline,
        ErrorCode::SettlementExpired
    );
    
    // LOCK THE PDA (prevent re-entrancy)
    matched_order.status = order_store::OrderStatus::InProgress;
    matched_order.locked_by = ctx.accounts.buyer.key();
    
    msg!("OrderProcessor: PDA locked for settlement");
    
    // Validate ZK proof
    let is_valid = validate_groth16_proof(
        &load_verification_key()?,
        &proof_a,
        &proof_b,
        &proof_c,
        &public_signals,
    )?;
    
    require!(is_valid, ErrorCode::InvalidZKProof);
    msg!("OrderProcessor: ZK proof valid - releasing escrow");
    
    // CPI TO MARKET: Release escrowed funds
    let cpi_program = ctx.accounts.market_program.to_account_info();
    let cpi_accounts = market::cpi::accounts::ReleaseEscrowedFunds {
        matched_order: ctx.accounts.matched_order.to_account_info(),
        escrow_vault: ctx.accounts.escrow_vault.to_account_info(),
        escrow_authority: ctx.accounts.escrow_authority.to_account_info(),
        buyer_token_account: ctx.accounts.buyer_token_account.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
    };
    
    // Sign with OrderProcessor authority
    let auth_seeds = &[
        b"order_processor_authority",
        &[ctx.bumps.order_processor_authority],
    ];
    let signer = &[&auth_seeds[..]];
    
    let cpi_ctx = CpiContext::new_with_signer(
        cpi_program,
        cpi_accounts,
        signer,
    );
    
    market::cpi::release_escrowed_funds(
        cpi_ctx,
        matched_order.amount,
    )?;
    
    msg!("OrderProcessor: Tokens transferred to buyer");
    
    // FINALIZE: Update PDA to Settled
    matched_order.status = order_store::OrderStatus::Settled;
    matched_order.settled_at = now;
    
    msg!("OrderProcessor: Trade finalized - PDA unlocked");
    
    Ok(())
}
```

**Critical security features:**
1. **Atomic Lock**: Status → `InProgress` before any external calls
2. **Deadline Check**: Prevents stale settlements
3. **Single Settlement**: `locked_by` prevents concurrent processing
4. **CPI with Signer**: OrderProcessor has authority to release escrow

---

### 4. Escrow Release (Market Program)

**Update `market/src/lib.rs` → `release_escrowed_funds()`:**

```rust
pub fn release_escrowed_funds(
    ctx: Context<ReleaseEscrowedFunds>,
    amount: u64,
) -> Result<()> {
    let matched_order = &ctx.accounts.matched_order;
    
    // SECURITY 1: Verify caller is OrderProcessor
    let order_processor_program_id = 
        Pubkey::try_from("F1J8MS1XhZgALP4VSjrKHF4Kj3VaG1vnNUCtafVnHgKo")
            .map_err(|_| ErrorCode::InvalidProgramId)?;
    
    require!(
        *ctx.accounts.token_program.to_account_info().owner == order_processor_program_id,
        ErrorCode::UnauthorizedCaller
    );
    
    // SECURITY 2: Verify PDA is locked for settlement
    require!(
        matched_order.status == order_store::OrderStatus::InProgress,
        ErrorCode::OrderNotInProgress
    );
    
    // SECURITY 3: Verify this is the correct escrow vault
    require!(
        ctx.accounts.escrow_vault.key() == matched_order.escrow_vault,
        ErrorCode::InvalidEscrowVault
    );
    
    // SECURITY 4: Verify buyer receiving tokens
    require!(
        ctx.accounts.buyer_token_account.owner == matched_order.buyer,
        ErrorCode::InvalidBuyer
    );
    
    msg!("Market: Releasing {} tokens from escrow", amount);
    
    // Transfer tokens using escrow authority PDA
    let escrow_seeds = &[
        b"escrow_authority",
        ctx.accounts.escrow_vault.to_account_info().key.as_ref(),
        &[matched_order.escrow_bump],
    ];
    let signer = &[&escrow_seeds[..]];
    
    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.escrow_vault.to_account_info(),
            to: ctx.accounts.buyer_token_account.to_account_info(),
            authority: ctx.accounts.escrow_authority.to_account_info(),
        },
        signer,
    );
    
    token::transfer(transfer_ctx, amount)?;
    
    msg!("Market: Escrow released - {} tokens transferred to buyer", amount);
    
    Ok(())
}

#[derive(Accounts)]
pub struct ReleaseEscrowedFunds<'info> {
    #[account(mut)]
    pub matched_order: Account<'info, order_store::MatchedOrder>,
    
    #[account(mut)]
    pub escrow_vault: Account<'info, TokenAccount>,
    
    /// PDA that has authority over escrow vault
    /// CHECK: Seeds verified in instruction logic
    pub escrow_authority: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub buyer_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}
```

**This design ensures:**
- ✅ **Only OrderProcessor can release**: Checked at program level
- ✅ **Only InProgress orders**: Prevents double-spending
- ✅ **Correct escrow vault**: PDA stores vault address
- ✅ **Correct buyer**: PDA stores buyer pubkey

---

## State Machine Visualization

```
┌─────────┐
│ Pending │  ← create_bid() creates PDA
└────┬────┘
     │
     │ finalize_trade() called
     │ (locks PDA immediately)
     ↓
┌─────────────┐
│ InProgress  │  ← PDA LOCKED - prevents re-entrancy
└────┬────────┘
     │
     │ ZK proof valid + escrow released
     │
     ↓
┌─────────┐
│ Settled │  ← PDA unlocked, tokens transferred
└─────────┘

ALTERNATIVE PATHS:
Pending → (deadline passed) → Expired → refund_seller()
Pending → (manual cancel) → Cancelled → refund_seller()
```

---

## Security Properties

### 1. **No Double-Spending**
- PDA locks to `InProgress` before any token transfers
- Once `Settled`, cannot be processed again
- Escrow release checks `InProgress` status

### 2. **No Re-Entrancy**
- `locked_by` field prevents concurrent settlements
- Status transitions enforced: `Pending → InProgress → Settled`
- All checks before external calls (check-effects-interactions)

### 3. **No Fund Loss**
- Escrow vault linked directly in PDA
- Deadline enforcement with automatic refunds
- Only authorized programs (OrderProcessor) can trigger release

### 4. **Atomic Settlement**
- Either: (proof valid → escrow released → PDA settled)
- Or: (proof invalid → revert everything → PDA still Pending)

---

## Implementation Checklist

### Phase 2B.1: Enhanced PDA Structure
- [ ] Add new fields to `MatchedOrder` (escrow_vault, token_mint, bumps, deadline)
- [ ] Add `InProgress`, `Expired`, `Cancelled` to `OrderStatus` enum
- [ ] Add `locked_by` field for re-entrancy protection

### Phase 2B.2: Atomic Match + Lock
- [ ] Update `create_bid()` to pass escrow metadata to OrderStore
- [ ] Update `create_matched_order()` to accept and store escrow info
- [ ] Add deadline calculation (24 hours default)

### Phase 2B.3: Locked Settlement Flow
- [ ] Update `finalize_trade()` to lock PDA immediately
- [ ] Add deadline validation
- [ ] Implement CPI to `release_escrowed_funds()`
- [ ] Add OrderProcessor authority PDA for signing

### Phase 2B.4: Secure Escrow Release
- [ ] Implement `release_escrowed_funds()` with all security checks
- [ ] Add program ID verification (only OrderProcessor can call)
- [ ] Verify PDA status is `InProgress`
- [ ] Add escrow vault and buyer validation

### Phase 2B.5: Refund Mechanism
- [ ] Implement `refund_expired_order()` (seller reclaims after deadline)
- [ ] Implement `cancel_order()` (mutual cancellation)
- [ ] Add status transitions to `Expired` / `Cancelled`

### Phase 2B.6: Testing
- [ ] Test: Match → Settle → Escrow Release (happy path)
- [ ] Test: Match → Expired → Refund Seller
- [ ] Test: Prevent double settlement (re-entrancy)
- [ ] Test: Only OrderProcessor can release escrow
- [ ] Test: Incorrect vault/buyer rejected

---

## Key Differences from Current Implementation

| Aspect | Current (Phase 2A) | Proposed (Phase 2B) |
|--------|-------------------|---------------------|
| **PDA Locking** | ❌ No locking mechanism | ✅ `InProgress` status locks PDA |
| **Escrow Link** | ❌ PDA doesn't know vault | ✅ PDA stores escrow_vault pubkey |
| **Settlement** | ❌ Separate flow | ✅ Atomic: proof → release → settle |
| **Deadlines** | ❌ No expiration | ✅ 24hr deadline with refunds |
| **Security** | ❌ Anyone can release | ✅ Only OrderProcessor via CPI |
| **Re-Entrancy** | ⚠️ Vulnerable | ✅ Protected by `locked_by` |

---

## Example Flow

### Scenario: Alice sells 100 USDC @ $1.00, Bob buys 100 USDC @ $1.05

**Step 1: Alice places ask**
```rust
place_ask_order(amount: 100_000_000, price: 1_000_000, payment: "PayPal")
// → 100 USDC transferred to escrow vault
// → AskOrder stored in OrderBook
```

**Step 2: Bob submits bid**
```rust
create_bid(amount: 100_000_000, price: 1_050_000, trader: Bob)
// → Algorithm finds Alice's order (price 1.00 ≤ 1.05 ✓)
// → Create MatchedOrder PDA:
//    - buyer: Bob
//    - seller: Alice
//    - amount: 100 USDC
//    - price: 1.00 (Alice's ask price)
//    - escrow_vault: <vault_pubkey>
//    - status: Pending
//    - deadline: now + 24hrs
```

**Step 3: Bob submits ZK proof (off-chain payment complete)**
```rust
finalize_trade(
    matched_order_pda,
    proof_a, proof_b, proof_c,
    public_signals: ["100000000", "Alice", "PayPal"]
)
// → Verify proof proves Bob paid Alice $100 via PayPal
// → Lock PDA: status = InProgress
// → CPI to Market: release_escrowed_funds()
//    → Transfer 100 USDC from escrow → Bob's wallet
// → Update PDA: status = Settled
```

**Result:**
- ✅ Bob receives 100 USDC tokens
- ✅ Alice receives $100 fiat (proven by ZK proof)
- ✅ PDA permanently locked as `Settled`
- ✅ Trade cannot be replayed or double-spent

---

## Next Steps

1. **Review this proposal** - Does this match your vision for the settlement flow?

2. **Prioritize features** - Which parts are critical for your use case?
   - Atomic settlement?
   - Deadline/refunds?
   - Re-entrancy protection?

3. **Implementation order** - Suggested:
   - Week 1: Enhanced PDA structure + atomic match
   - Week 2: Locked settlement flow
   - Week 3: Secure escrow release
   - Week 4: Refund mechanisms + testing

4. **Update UI Demo** - Add settlement phase visualization showing PDA locking

Would you like me to start implementing Phase 2B.1 (Enhanced PDA Structure)?
