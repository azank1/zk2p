# System Architecture

## Overview

ZK2P is a three-program Solana system for P2P fiat-to-crypto trading with zero-knowledge proof verification.

---

## Programs

### Market Program

**Purpose:** Order book management and token custody

**Responsibilities:**
- Order placement (all 5 types)
- Order matching via CritBit tree
- Token escrow management
- Self-trade prevention
- Order cancellation

**Key Instructions:**
- `initialize_market` - Setup market account
- `initialize_order_book_v2` - Create CritBit-based order book
- `place_limit_order_v2` - Place order with escrow
- `match_order` - Execute matching with order type handling
- `cancel_order` - Cancel order and return tokens

### OrderStore Program

**Purpose:** Persistent matched order storage

**Responsibilities:**
- Store matched orders
- Trade history tracking
- State management

**Status:** Basic implementation, will be enhanced in Phase 2

### OrderProcessor Program

**Purpose:** ZK proof validation and settlement

**Responsibilities:**
- Verify solvency proofs
- Verify payment proofs
- Orchestrate settlement
- Proof state tracking

**Status:** Stubbed, awaiting ZK source code integration

---

## Data Structures

### CritBit Tree

**Purpose:** Efficient price-level management

**Properties:**
- Binary tree with bit-pattern routing
- Internal nodes store critical bit positions
- Leaf nodes store price and order queue index
- O(log n) insert, remove, find operations

**Configuration:**
- Max capacity: 100 nodes per tree
- Supports 50 price levels
- Separate trees for bids and asks

**Implementation:** `programs/market/src/critbit.rs`

### Order Structure

**Size:** 122 bytes fixed

**Fields:**
- `order_id`: u128 (unique identifier)
- `owner`: Pubkey (order owner)
- `quantity`: u64 (remaining amount)
- `original_quantity`: u64 (initial amount)
- `price`: u64 (scaled by 1e6)
- `timestamp`: i64 (creation time)
- `order_type`: OrderType enum
- `side`: Side enum (Bid/Ask)
- `client_order_id`: u64 (client reference)
- `payment_method`: [u8; 32] (for settlement)

**Order Types:**
1. **Limit:** Rests in book until filled or cancelled
2. **Market:** Executes immediately at best price
3. **Post-Only:** Rejects if would match (maker-only)
4. **IOC:** Immediate-or-Cancel (fills immediately, cancels remainder)
5. **FOK:** Fill-or-Kill (must fill completely or reject)

### OrderBook Structure

**Components:**
- `bids`: CritBit tree (buy orders)
- `asks`: CritBit tree (sell orders)
- `order_queues`: Vec<OrderQueue> (FIFO at each price)
- `best_bid`: u64 (cached)
- `best_ask`: u64 (cached)
- `total_orders`: u64 (counter)

**Price Levels:** Maximum 50 per side

**Queue:** FIFO ordering within each price level

---

## Order Flow

### Place Ask Order

```
1. User calls place_limit_order_v2
2. Tokens transferred to escrow vault
3. Order inserted into asks CritBit tree
4. Order added to FIFO queue at price level
5. Best ask updated if needed
```

### Place Bid Order

```
1. User calls match_order
2. Query best ask from CritBit tree
3. Check if ask_price <= bid_price
4. If match:
   a. Calculate fill quantity
   b. Update order quantities
   c. Remove fully filled orders
   d. Clean up empty price levels
5. Repeat for additional matches
6. Apply order type logic (IOC, FOK, etc.)
```

### Cancel Order

```
1. User calls cancel_order
2. Verify order ownership
3. Remove order from CritBit tree and queue
4. If ask order, return tokens from escrow
5. Update order book state
```

---

## Account Structure

### Program Derived Addresses (PDAs)

**Market:**
- Seeds: `["market", token_mint]`
- Stores: authority, token mint, order sequence counter

**Order Book:**
- Seeds: `["order_book", token_mint]`
- Stores: CritBit trees, order queues, statistics

**Escrow Vault:**
- Seeds: `["escrow_vault", token_mint]`
- SPL Token account owned by escrow authority

**Escrow Authority:**
- Seeds: `["escrow_authority", token_mint]`
- PDA with signing authority over escrow vault

---

## Matching Engine

### Algorithm

**Price-Time Priority:**
1. Orders sorted by price (ascending asks, descending bids)
2. Within same price, FIFO ordering (oldest first)

**Matching Process:**
```rust
fn match_order(side: Side, quantity: u64, limit_price: u64) {
    let opposite_tree = get_opposite_tree(side);
    let mut remaining = quantity;
    
    while remaining > 0 {
        let best_order = opposite_tree.best_order();
        
        if !price_matches(best_order.price, limit_price, side) {
            break;
        }
        
        if would_self_trade(best_order.owner) {
            continue; // Skip own orders
        }
        
        let fill_qty = min(remaining, best_order.quantity);
        best_order.quantity -= fill_qty;
        remaining -= fill_qty;
        
        if best_order.quantity == 0 {
            remove_order(best_order);
        }
    }
}
```

### Self-Trade Prevention

Before matching, check if taker matches their own maker order. Skip self-matches to prevent wash trading.

---

## Performance Characteristics

### Compute Units (Typical)

- Market initialization: ~3,000 CU
- Order placement: ~15,000 CU
- Order matching: ~30-40,000 CU (depends on matches)
- Order cancellation: ~10,000 CU

### Time Complexity

- Insert order: O(log n) via CritBit
- Remove order: O(log n) via CritBit
- Find best price: O(1) cached
- Match order: O(k × log n) for k matches

### Space Constraints

- OrderBook size: ~10KB PDA limit
- Max price levels: 50 per side
- Max orders: Limited by account size
- CritBit node size: 26 bytes

---

## Token Flow

### Ask Order Flow

```
User Token Account 
    ↓ (transfer)
Escrow Vault
    ↓ (on match)
Buyer Token Account
```

### Escrow Security

- Vault owned by escrow authority PDA
- Authority can only be invoked by program
- No external signing capability
- Tokens only released on match or cancel

---

## Error Handling

### Custom Errors

- `InvalidAmount` - Zero or negative quantity
- `InvalidPrice` - Zero or negative price
- `OrderBookFull` - Max price levels reached
- `OrderNotFound` - Order ID not in book
- `UnauthorizedCancellation` - Wrong owner
- `SelfTradeNotAllowed` - Self-match attempted
- `PostOnlyWouldMatch` - Post-only rejected
- `FillOrKillNotFilled` - FOK cannot complete

---

## Testing

### Unit Tests (Rust)

**Location:** Within source files

- `critbit::tests` - Tree operations
- `order::tests` - Order lifecycle
- `order_book::tests` - Book operations

**Run:** `cargo test --package market --lib`

### Integration Tests (TypeScript)

**Location:** `tests/`

- `phase2-orderbook.ts` - OrderBook integration
- `production-readiness.ts` - Comprehensive scenarios
- `escrow.ts` - Token flows

**Run:** `anchor test`

### Test Coverage

- 10 unit tests (Rust)
- 6 integration tests (Phase 2)
- 23 production tests (comprehensive)
- Total: 39 tests

---

## Future Enhancements

### Phase 2: ZK Integration

- Integrate ZK proof circuits
- Implement proof verification in OrderProcessor
- Add proof generation to settlement flow
- Test full P2P settlement with ZK

### Phase 3: Production Features

- Event queue for fill events
- Crank mechanism for processing
- Maker/taker fees
- Market statistics
- Volume tracking

---

## References

- Serum DEX: CritBit tree inspiration
- OpenBook V2: Order book architecture
- Anchor Framework: Program framework

---

**Last Updated:** December 2024  
**Status:** Phase 1 complete, Phase 2 in design, Phase 3 ready for implementation

