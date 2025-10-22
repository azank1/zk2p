# Order Matching Engine

## Overview

The matching engine implements price-time priority with partial fills, powered by CritBit tree-based order book.

## Matching Algorithm

### Price-Time Priority

**Primary Sort:** Price (ascending for asks, descending for bids)
**Secondary Sort:** Time (FIFO - oldest orders first)

**Implementation:**
```rust
// Sort orders by price, then time
orders.sort_by(|a, b| {
    a.price.cmp(&b.price)
        .then(a.created_at.cmp(&b.created_at))
});
```

### Matching Flow

**Step 1: Order Placement**
```
Seller places ask order:
1. Transfer tokens to escrow
2. Insert price level into CritBit tree
3. Add order to FIFO queue at price level
4. Order stored in OrderBook PDA
```

**Step 2: Bid Matching**
```
Buyer places bid order:
1. Query best ask: min(asks CritBit tree)
2. Check if ask_price <= bid_price
3. If match:
   a. Calculate fill amount
   b. Update order quantities
   c. Create matched order (CPI to OrderStore)
   d. If fully filled, remove from tree
4. Repeat until bid filled or no matches
```

**Step 3: Partial Fills**
```
Ask: 100 tokens @ $50
Bid: 60 tokens @ $55

Result:
- Match: 60 tokens @ $50
- Ask remaining: 40 tokens @ $50 (stays in book)
- Bid fully filled
```

## Order Book Structure

### Current Implementation (Phase 2B)

**OrderBookV2:**
```rust
pub struct OrderBook {
    pub bids: CritBitTree,           // Buy orders
    pub asks: CritBitTree,           // Sell orders
    pub order_queues: Vec<OrderQueue>,  // FIFO at each price
    pub max_price_levels: u32,       // 50 levels
}
```

**Order Queue (at each price level):**
```rust
pub struct OrderQueue {
    pub orders: Vec<Order>,  // FIFO queue
}
```

**Order Structure:**
```rust
pub struct Order {
    pub trader: Pubkey,        // 32 bytes
    pub amount: u64,           // 8 bytes
    pub filled_amount: u64,    // 8 bytes
    pub price: u64,            // 8 bytes
    pub side: Side,            // 1 byte
    pub order_type: OrderType, // 1 byte
    pub order_id: u128,        // 16 bytes
    pub created_at: i64,       // 8 bytes
    // Total: 122 bytes (fixed size)
}
```

## Matching Rules

### Price Matching

**Ask Order Match Condition:**
```
ask_price <= bid_price
```

**Example:**
```
Asks: $45, $48, $50
Bid: $55 max

Matches: $45 ✓, $48 ✓, $50 ✓
Does not match: $60 ✗
```

### Time Priority (FIFO)

**Orders at same price:**
```
Time: 10:00 AM -> Order A: 100 @ $50
Time: 10:05 AM -> Order B: 50 @ $50
Time: 10:10 AM -> Order C: 75 @ $50

Match order: A -> B -> C
```

### Partial Fill Example

**Scenario:**
```
Order Book:
- Ask A: 50 @ $48 (Time: 10:00)
- Ask B: 25 @ $48 (Time: 10:05)
- Ask C: 100 @ $50

Bid: 60 @ $55
```

**Execution:**
```
1. Match Ask A: 50 tokens @ $48 (fully filled, removed)
2. Match Ask B: 10 tokens @ $48 (partially filled)
3. Ask B remaining: 15 tokens @ $48 (stays in book)
4. Bid fully filled: 60 tokens total
```

## Order Types (Phase 2C Implementation)

### Limit Order
- Places order at specific price
- Stays in book until filled or cancelled
- Currently implemented

### Market Order
- Executes immediately at best available price
- No price limit
- Planned for Phase 2C

### Post-Only Order
- Only adds liquidity (maker)
- Cancelled if would match immediately
- Prevents paying taker fees
- Planned for Phase 2C

### Immediate-or-Cancel (IOC)
- Fills immediately at specified price or better
- Unfilled portion cancelled
- Planned for Phase 2C

### Fill-or-Kill (FOK)
- Either fills entire order or cancels
- All-or-nothing execution
- Planned for Phase 2C

## Escrow Management

### Token Custody

**Ask Order Escrow:**
```
1. Seller places ask: 100 USDC @ $50
2. Transfer 100 USDC to escrow vault
3. Escrow PDA holds tokens until match
4. On match: Transfer from escrow to buyer
```

**No Bid Escrow:**
```
Bids are instant-match only
No token custody for buy orders
Payment happens off-chain (fiat)
```

### Escrow Release

**On Full Match:**
```
1. Match confirmed
2. Create matched order (OrderStore)
3. Release tokens from escrow
4. Transfer to buyer
5. Remove order from book
```

**On Partial Match:**
```
1. Calculate fill amount
2. Release partial tokens from escrow
3. Remaining tokens stay in escrow
4. Update order quantity in book
```

## Performance Metrics

### Current Implementation

**Order Book Operations:**
- Insert order: O(log n)
- Find best price: O(n) [recursive leaf traversal]
- Remove order: O(log n)
- Match execution: O(k × log n) for k matches

**Space Complexity:**
- Max price levels: 50
- Orders per level: Variable (FIFO queue)
- Total capacity: ~10KB PDA limit

**Throughput:**
- Single-order placement: ~1-2ms
- Multi-order matching: ~5-10ms
- Limited by Solana compute units

## Test Coverage

### Unit Tests

**Order Matching Tests:**
```bash
cargo test --package market --lib order_book::tests
```

**Tests:**
- `test_order_book_insert`: Price level insertion
- `test_order_book_remove`: Price level removal
- `test_order_book_best_price`: Min/max queries

### Integration Tests

**Phase 2A Tests:**
```bash
anchor test -- --grep "Phase 2A"
```

**Tests:**
- Order book initialization
- Ask order placement
- Bid matching with real sellers
- Partial fills
- Order validation

**Phase 2B Tests:**
```bash
anchor test -- --grep "Phase 2B"
```

**Tests:**
- OrderBookV2 initialization
- CritBit tree operations
- Order placement with new structure

## Matching Examples

### Example 1: Simple Match

**Order Book:**
```
Ask: 100 @ $50
```

**New Bid:**
```
Bid: 100 @ $55
```

**Result:**
```
Match: 100 tokens @ $50
Total: $5,000
Ask removed from book
```

### Example 2: Multiple Matches

**Order Book:**
```
Ask A: 50 @ $45
Ask B: 25 @ $48
Ask C: 100 @ $50
```

**New Bid:**
```
Bid: 100 @ $55
```

**Execution:**
```
Match 1: 50 @ $45 = $2,250
Match 2: 25 @ $48 = $1,200
Match 3: 25 @ $50 = $1,250
Total: $4,700 for 100 tokens
Ask C remaining: 75 @ $50
```

### Example 3: No Match

**Order Book:**
```
Ask: 100 @ $60
```

**New Bid:**
```
Bid: 50 @ $55
```

**Result:**
```
No match (ask_price > bid_price)
Bid rejected
Ask remains in book
```

## Future Enhancements

### Phase 2C: Advanced Matching
- Multi-order matching in single transaction
- All 5 order types implemented
- Self-trade prevention
- Time-in-force parameters

### Phase 2D: Event Queue
- Fill events for indexing
- Out events for rejections
- Crank mechanism for processing
- Off-chain event consumers

### Phase 2E: Production Features
- Maker/taker fees
- Volume tracking
- Market statistics
- Admin controls

## Visualization

**Demo UI:** http://127.0.0.1:8080

The UI demonstrates:
- Real-time order placement
- CritBit tree operations
- Matching algorithm execution
- Partial fill handling
- Order book state updates

