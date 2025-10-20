# Phase 2B-2E: Building a Robust Matching Engine (OpenBook/Serum Standard)

**Priority:** Build production-grade DEX engine BEFORE adding ZK proofs  
**Goal:** Match OpenBook v2 and Serum DEX reliability and features  
**Timeline:** 4-6 weeks of focused development

---

## Current State (Phase 2A)

✅ **What Works:**
- Basic price-time priority sorting
- Single order matching per bid
- Order book PDA storage (max 10 orders)
- Token escrow with SPL Token integration
- 5 passing tests

❌ **What's Missing (Compared to OpenBook/Serum):**
- Order IDs and order management
- Limit orders vs market orders
- Order cancellation
- Post-only orders (maker-only)
- Fill-or-kill / Immediate-or-cancel
- Maker/taker fee structure
- Event queue for off-chain indexing
- Order book depth management
- Self-trade prevention
- Crank/matching loop optimization
- Account rent management
- Serum-style CritBit tree for order book

---

## OpenBook v2 / Serum DEX Key Features to Adopt

### 1. **Order Book Data Structure**
**Current:** `Vec<AskOrder>` (simple, limited to 10 orders)  
**OpenBook/Serum:** CritBit tree (binary tree for efficient price-level lookup)

**Why it matters:**
- O(log n) insert/remove vs O(n)
- Scales to thousands of orders
- Efficient best bid/ask lookup

### 2. **Order Types**
**Current:** Only market orders (immediate match)  
**Production:** Multiple order types

| Type | Description | Use Case |
|------|-------------|----------|
| Limit | Execute at price or better | Most common |
| Market | Execute immediately at best price | Quick fills |
| Post-Only | Only add liquidity (maker) | Market makers |
| IOC | Immediate-or-Cancel | Taker orders |
| FOK | Fill-or-Kill | All-or-nothing |

### 3. **Order Lifecycle Management**
**Current:** Orders created and immediately matched/removed  
**Production:** Full lifecycle with order IDs

```
Place → Open → [Partial Fills] → Filled/Cancelled
  ↓
OrderID generated
  ↓
Indexed in order book
  ↓
Matchable until filled/cancelled
```

### 4. **Event Queue (Critical for Indexers)**
**Current:** None - only logs  
**OpenBook/Serum:** Ring buffer storing all market events

```rust
pub enum Event {
    Fill {
        maker_order_id: u128,
        taker_order_id: u128,
        maker: Pubkey,
        taker: Pubkey,
        price: u64,
        quantity: u64,
        timestamp: i64,
    },
    Out {
        order_id: u128,
        owner: Pubkey,
        quantity_released: u64,
    },
}
```

**Why it matters:**
- Off-chain services can reconstruct order book state
- UI can show real-time trades
- Analytics and history
- Compliance and auditing

### 5. **Maker/Taker Fees**
**Current:** No fees  
**Production:** Fee structure incentivizing liquidity

```rust
pub struct FeeStructure {
    pub maker_fee_bps: i64,  // Can be negative (rebate)
    pub taker_fee_bps: i64,  // Positive fee
    pub fee_collector: Pubkey,
}
```

**Example:** Maker -0.02% (rebate), Taker +0.05%

### 6. **Self-Trade Prevention**
**Current:** Can trade with yourself  
**Production:** Prevent wash trading

```rust
// Cancel oldest order if self-match detected
if bid.owner == ask.owner {
    cancel_order(oldest_order);
    continue;
}
```

### 7. **Crank Mechanism (Matching Optimization)**
**Current:** Match one order per bid  
**Serum:** Dedicated crank instruction processes multiple matches

```rust
pub fn consume_events(
    ctx: Context<ConsumeEvents>,
    limit: u64,
) -> Result<()> {
    // Process up to `limit` events from queue
    // Settle trades atomically
    // Update balances
}
```

---

## Roadmap: Building a Robust Engine

### **Phase 2B: Order Management & Lifecycle** (Week 1-2)

#### Goals:
- Replace Vec with efficient order book structure
- Add order IDs and tracking
- Implement order cancellation
- Add order types (Limit, Market, Post-Only)

#### Implementation:

**1. Order Book Structure (Simplified CritBit)**

```rust
#[account]
pub struct OrderBookSide {
    pub token_mint: Pubkey,
    pub side: Side, // Bid or Ask
    pub orders: BTreeMap<u64, Vec<Order>>, // Price → Orders at that price
    pub best_price: u64,
    pub total_liquidity: u64,
}

#[derive(Clone, Debug)]
pub struct Order {
    pub order_id: u128,
    pub owner: Pubkey,
    pub quantity: u64,
    pub price: u64,
    pub timestamp: i64,
    pub order_type: OrderType,
    pub client_order_id: u64, // User-defined ID
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum OrderType {
    Limit,
    Market,
    PostOnly,
    ImmediateOrCancel,
    FillOrKill,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum Side {
    Bid,
    Ask,
}
```

**2. Order ID Generation**

```rust
pub fn generate_order_id(
    owner: &Pubkey,
    sequence: u64,
    timestamp: i64,
) -> u128 {
    // High 64 bits: timestamp + sequence
    // Low 64 bits: owner hash
    let high = ((timestamp as u128) << 32) | (sequence as u128);
    let low = owner.to_bytes()[0..16].try_into().unwrap();
    (high << 64) | u128::from_le_bytes(low)
}
```

**3. Place Limit Order**

```rust
pub fn place_limit_order(
    ctx: Context<PlaceLimitOrder>,
    side: Side,
    price: u64,
    quantity: u64,
    order_type: OrderType,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let order_book = &mut ctx.accounts.order_book;
    
    // Generate unique order ID
    let order_id = generate_order_id(
        ctx.accounts.owner.key,
        market.next_order_sequence,
        Clock::get()?.unix_timestamp,
    );
    market.next_order_sequence += 1;
    
    // Create order
    let order = Order {
        order_id,
        owner: ctx.accounts.owner.key(),
        quantity,
        price,
        timestamp: Clock::get()?.unix_timestamp,
        order_type,
        client_order_id: ctx.accounts.owner_sequence,
    };
    
    // Add to order book at price level
    order_book.insert_order(side, price, order)?;
    
    // Update best price if needed
    order_book.update_best_price(side)?;
    
    msg!("Order placed: ID={}, price={}, qty={}", order_id, price, quantity);
    
    Ok(())
}
```

**4. Cancel Order**

```rust
pub fn cancel_order(
    ctx: Context<CancelOrder>,
    order_id: u128,
) -> Result<()> {
    let order_book = &mut ctx.accounts.order_book;
    
    // Find and remove order
    let order = order_book.remove_order(order_id)?;
    
    // Verify owner
    require!(
        order.owner == ctx.accounts.owner.key(),
        ErrorCode::UnauthorizedCancel
    );
    
    // Return escrowed tokens
    release_escrow_for_order(ctx, &order)?;
    
    msg!("Order cancelled: ID={}", order_id);
    
    Ok(())
}
```

**Tests:**
- [ ] Place multiple limit orders at different prices
- [ ] Cancel order by ID
- [ ] Only owner can cancel
- [ ] Escrow released on cancel
- [ ] Best price updates correctly

---

### **Phase 2C: Matching Engine Upgrade** (Week 2-3)

#### Goals:
- Match multiple orders in single transaction
- Implement all order types (IOC, FOK, Post-Only)
- Self-trade prevention
- Partial fill tracking

#### Implementation:

**1. Advanced Matching Algorithm**

```rust
pub fn match_orders(
    ctx: Context<MatchOrders>,
    side: Side, // Bid or Ask
    limit_price: Option<u64>,
    max_quote_quantity: u64,
) -> Result<Vec<Fill>> {
    let order_book = &mut ctx.accounts.order_book;
    let mut fills = Vec::new();
    let mut remaining = max_quote_quantity;
    
    // Get opposite side for matching
    let opposite_side = side.opposite();
    
    while remaining > 0 {
        // Get best order from opposite side
        let best_order = match order_book.get_best_order(opposite_side) {
            Some(order) => order,
            None => break, // No more orders
        };
        
        // Check price compatibility
        if let Some(limit) = limit_price {
            let is_acceptable = match side {
                Side::Bid => best_order.price <= limit, // Buying: accept if ask <= limit
                Side::Ask => best_order.price >= limit, // Selling: accept if bid >= limit
            };
            if !is_acceptable {
                break;
            }
        }
        
        // Self-trade prevention
        if best_order.owner == ctx.accounts.trader.key() {
            msg!("Self-trade detected - cancelling oldest order");
            order_book.remove_order(best_order.order_id)?;
            continue;
        }
        
        // Calculate fill quantity
        let fill_quantity = std::cmp::min(remaining, best_order.quantity);
        
        // Create fill event
        let fill = Fill {
            maker_order_id: best_order.order_id,
            maker: best_order.owner,
            taker: ctx.accounts.trader.key(),
            price: best_order.price,
            quantity: fill_quantity,
            timestamp: Clock::get()?.unix_timestamp,
        };
        
        fills.push(fill);
        
        // Update order book
        if fill_quantity == best_order.quantity {
            // Fully filled - remove order
            order_book.remove_order(best_order.order_id)?;
        } else {
            // Partially filled - update quantity
            order_book.update_order_quantity(
                best_order.order_id,
                best_order.quantity - fill_quantity,
            )?;
        }
        
        remaining -= fill_quantity;
    }
    
    msg!("Matching complete: {} fills executed", fills.len());
    Ok(fills)
}
```

**2. Order Type Validation**

```rust
fn validate_order_type_execution(
    order_type: OrderType,
    fills: &[Fill],
    requested_quantity: u64,
) -> Result<bool> {
    let total_filled: u64 = fills.iter().map(|f| f.quantity).sum();
    
    match order_type {
        OrderType::Limit => Ok(true), // Any fill acceptable
        
        OrderType::Market => Ok(true), // Any fill acceptable
        
        OrderType::PostOnly => {
            // Must not match immediately (adds liquidity)
            require!(fills.is_empty(), ErrorCode::PostOnlyWouldMatch);
            Ok(true)
        }
        
        OrderType::ImmediateOrCancel => {
            // Cancel unfilled portion
            Ok(total_filled > 0)
        }
        
        OrderType::FillOrKill => {
            // Must fill completely or reject
            require!(
                total_filled == requested_quantity,
                ErrorCode::FillOrKillNotFilled
            );
            Ok(true)
        }
    }
}
```

**Tests:**
- [ ] Match multiple orders in one transaction
- [ ] Partial fills tracked correctly
- [ ] Post-Only rejects immediate matches
- [ ] IOC cancels unfilled portion
- [ ] FOK rejects partial fills
- [ ] Self-trade prevention works

---

### **Phase 2D: Event Queue & Indexing** (Week 3-4)

#### Goals:
- Ring buffer for trade events
- Consume events instruction
- Off-chain indexer compatibility

#### Implementation:

**1. Event Queue Structure**

```rust
#[account]
pub struct EventQueue {
    pub market: Pubkey,
    pub head: u64,
    pub count: u64,
    pub events: [Event; 256], // Ring buffer (adjust size)
}

impl EventQueue {
    pub const LEN: usize = 8 + 32 + 8 + 8 + (Event::LEN * 256);
    
    pub fn push(&mut self, event: Event) -> Result<()> {
        require!(
            self.count < 256,
            ErrorCode::EventQueueFull
        );
        
        let index = (self.head + self.count) % 256;
        self.events[index as usize] = event;
        self.count += 1;
        
        Ok(())
    }
    
    pub fn pop(&mut self) -> Option<Event> {
        if self.count == 0 {
            return None;
        }
        
        let event = self.events[self.head as usize];
        self.head = (self.head + 1) % 256;
        self.count -= 1;
        
        Some(event)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub enum Event {
    Fill {
        maker_order_id: u128,
        taker_order_id: u128,
        maker: Pubkey,
        taker: Pubkey,
        side: Side,
        price: u64,
        quantity: u64,
        maker_fee: i64,
        taker_fee: i64,
        timestamp: i64,
    },
    Out {
        order_id: u128,
        owner: Pubkey,
        side: Side,
        quantity_released: u64,
        reason: OutReason,
    },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum OutReason {
    Cancelled,
    Filled,
    Expired,
}

impl Event {
    pub const LEN: usize = 1 + 16 + 16 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 8;
}
```

**2. Consume Events (Crank)**

```rust
pub fn consume_events(
    ctx: Context<ConsumeEvents>,
    limit: u64,
) -> Result<()> {
    let event_queue = &mut ctx.accounts.event_queue;
    let mut processed = 0;
    
    while processed < limit {
        match event_queue.pop() {
            Some(event) => {
                match event {
                    Event::Fill {
                        maker,
                        taker,
                        price,
                        quantity,
                        maker_fee,
                        taker_fee,
                        ..
                    } => {
                        // Transfer tokens
                        settle_fill(
                            ctx,
                            maker,
                            taker,
                            price,
                            quantity,
                            maker_fee,
                            taker_fee,
                        )?;
                    }
                    Event::Out {
                        owner,
                        quantity_released,
                        reason,
                        ..
                    } => {
                        // Return escrowed funds
                        release_escrow(ctx, owner, quantity_released)?;
                    }
                }
                processed += 1;
            }
            None => break,
        }
    }
    
    msg!("Consumed {} events", processed);
    Ok(())
}
```

**Tests:**
- [ ] Events pushed to queue correctly
- [ ] Ring buffer wraps around
- [ ] Consume events processes fills
- [ ] Multiple events consumed in order
- [ ] Queue full handling

---

### **Phase 2E: Fees & Production Features** (Week 4-5)

#### Goals:
- Maker/taker fee structure
- Fee collection accounts
- Referral fees
- Market authority controls

#### Implementation:

**1. Fee Structure**

```rust
#[account]
pub struct Market {
    pub market_authority: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub order_book: Pubkey,
    pub event_queue: Pubkey,
    
    // Fee structure
    pub maker_fee_bps: i64,   // -2 = 0.02% rebate
    pub taker_fee_bps: i64,   // 5 = 0.05% fee
    pub fee_collector: Pubkey,
    pub collected_fees: u64,
    
    // Stats
    pub total_volume: u64,
    pub total_trades: u64,
    pub next_order_sequence: u64,
}

impl Market {
    pub fn calculate_fees(&self, quantity: u64, price: u64, is_maker: bool) -> (u64, i64) {
        let quote_amount = (quantity as u128 * price as u128) / 1_000_000;
        let fee_bps = if is_maker { self.maker_fee_bps } else { self.taker_fee_bps };
        
        let fee = if fee_bps >= 0 {
            ((quote_amount * fee_bps as u128) / 10_000) as u64
        } else {
            // Negative fee = rebate
            let rebate = ((quote_amount * (-fee_bps) as u128) / 10_000) as u64;
            -(rebate as i64)
        };
        
        (quote_amount as u64, fee as i64)
    }
}
```

**2. Fee Collection**

```rust
pub fn collect_fees(
    ctx: Context<CollectFees>,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    
    // Only market authority can collect
    require!(
        ctx.accounts.authority.key() == market.market_authority,
        ErrorCode::UnauthorizedFeeCollection
    );
    
    let amount = market.collected_fees;
    market.collected_fees = 0;
    
    // Transfer fees to collector
    token::transfer(
        ctx.accounts.fee_vault → ctx.accounts.fee_collector_account,
        amount,
    )?;
    
    msg!("Collected {} fees", amount);
    Ok(())
}
```

**Tests:**
- [ ] Maker receives rebate
- [ ] Taker pays fee
- [ ] Fees accumulate correctly
- [ ] Only authority can collect
- [ ] Fee calculation accurate

---

## Testing Strategy

### Unit Tests (Per Phase)
- Test individual functions in isolation
- Mock accounts and PDAs
- Fast iteration

### Integration Tests (End of Each Phase)
- Test full order flow
- Multiple users placing/canceling orders
- Match scenarios (full fill, partial, no match)
- Event queue and crank

### Stress Tests (Phase 2E)
- 100+ orders in order book
- Rapid place/cancel cycles
- Max events in queue
- Gas optimization verification

### Benchmark Tests
- Compare to OpenBook v2 gas costs
- Order placement: ~40k CU
- Matching: ~100k CU per order matched
- Crank: ~200k CU for 10 events

---

## Migration Path from Phase 2A → 2B-2E

### Option 1: Clean Slate (Recommended)
- Keep Phase 2A as reference
- Build new programs from scratch with proper structure
- Easier to implement production patterns

### Option 2: Incremental Upgrade
- Refactor existing code phase by phase
- More complex but preserves tests
- Risk of technical debt

**Recommendation:** Option 1 - Start fresh with production architecture from day 1

---

## Success Criteria

### Phase 2B Complete:
- [ ] Order IDs working
- [ ] Multiple orders in book
- [ ] Cancel by order ID
- [ ] Limit order placement
- [ ] 10+ passing tests

### Phase 2C Complete:
- [ ] Multi-order matching
- [ ] All order types working
- [ ] Self-trade prevention
- [ ] 20+ passing tests

### Phase 2D Complete:
- [ ] Event queue functional
- [ ] Crank processes events
- [ ] Indexer can read events
- [ ] 30+ passing tests

### Phase 2E Complete:
- [ ] Fees working
- [ ] Production-ready API
- [ ] 50+ passing tests
- [ ] Gas costs comparable to OpenBook v2

### Final Validation:
- [ ] Can handle 1000+ orders
- [ ] No memory leaks
- [ ] Proper error handling
- [ ] Security audit ready

---

## Then Add ZK (Phase 3)

Once the engine is robust:

**Phase 3A:** ZK Proof Integration
- Add proof verification to settle flow
- Link matched orders to ZK proofs
- Implement proof challenges

**Phase 3B:** Privacy Features
- Private order amounts (ZK)
- Hidden order book (optional)
- Selective disclosure

---

## Timeline Summary

| Phase | Duration | Focus |
|-------|----------|-------|
| 2B | 1-2 weeks | Order management |
| 2C | 1-2 weeks | Advanced matching |
| 2D | 1 week | Event queue |
| 2E | 1 week | Fees & polish |
| **Total** | **4-6 weeks** | **Robust engine** |
| 3A-3B | 2-3 weeks | ZK integration |

---

## Questions to Answer

1. **Order Book Size:** How many orders do you expect? (affects data structure choice)
2. **Fee Model:** Do you want maker rebates? Referral fees?
3. **Crank:** Who runs the crank? Permissionless or authority-only?
4. **Migration:** Clean slate or upgrade existing code?
5. **Priority:** Which features are must-have vs nice-to-have?

Let me know and I'll start implementing! 🚀
