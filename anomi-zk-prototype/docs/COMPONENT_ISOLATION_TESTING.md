# Component Isolation Testing

Systematic testing approach for validating each component independently before integration testing.

## Overview

Component isolation testing ensures each part of the system works correctly in isolation before testing them together. This approach helps identify issues at the component level, making debugging easier and ensuring robust integration.

---

## Component 1: CritBit Tree (`critbit.rs`)

### Isolation Strategy

Test the CritBit tree data structure without any order book or token logic.

### Unit Tests Location

`programs/market/src/critbit.rs` - Tests within module

### How to Run

```bash
cd anomi-zk-prototype
cargo test --package market --lib critbit::tests -- --nocapture
```

### Test Coverage

**Test 1: `test_critbit_insert_and_find`**
- Insert nodes with different keys
- Find nodes by key
- Verify tree structure
- Validate bit-pattern routing

**Test 2: `test_critbit_min_max`**
- Insert multiple nodes
- Query minimum key (leftmost leaf)
- Query maximum key (rightmost leaf)
- Verify traversal correctness

**Test 3: `test_critbit_remove`**
- Insert nodes
- Remove specific nodes
- Verify tree rebalancing
- Check node cleanup

### Expected Results

- ✅ All insert operations succeed
- ✅ Find returns correct nodes
- ✅ Min/max queries work
- ✅ Remove maintains tree integrity
- ✅ No memory leaks

### Validation Checklist

- [ ] Insert at root (empty tree)
- [ ] Insert as left child
- [ ] Insert as right child
- [ ] Find existing key
- [ ] Find non-existent key returns None
- [ ] Min/max on empty tree
- [ ] Min/max with single node
- [ ] Min/max with multiple nodes
- [ ] Remove root node
- [ ] Remove internal node
- [ ] Remove leaf node
- [ ] Remove from empty tree fails gracefully

### Performance Validation

- [ ] Insert: O(log n) time
- [ ] Find: O(log n) time
- [ ] Remove: O(log n) time
- [ ] Memory: Fixed pre-allocation
- [ ] No stack overflow on deep trees

---

## Component 2: Order Structure (`order.rs`)

### Isolation Strategy

Test order creation, lifecycle, and operations without order book integration.

### Unit Tests Location

`programs/market/src/order.rs` - Tests within module

### How to Run

```bash
cd anomi-zk-prototype
cargo test --package market --lib order::tests -- --nocapture
```

### Test Coverage

**Test 1: `test_order_creation`**
- Create orders with valid parameters
- Verify field initialization
- Check order ID uniqueness
- Validate enum variants

**Test 2: `test_unique_order_ids`**
- Generate multiple order IDs
- Verify uniqueness
- Test collision resistance
- Validate ID format (u128)

**Test 3: `test_order_fill`**
- Create order with quantity
- Partially fill order
- Verify quantity updates
- Check fill percentage calculation
- Test fully filled status

**Test 4: `test_order_queue`**
- Create OrderQueue
- Push multiple orders
- Pop orders (FIFO)
- Verify queue operations
- Test empty queue

### Expected Results

- ✅ Orders created with correct values
- ✅ Order IDs are unique
- ✅ Partial fills tracked accurately
- ✅ FIFO queue maintains order
- ✅ Payment method stored correctly

### Validation Checklist

- [ ] Order struct size = 122 bytes
- [ ] All 5 order types supported
- [ ] Order ID generation unique
- [ ] Timestamp recorded
- [ ] Fill percentage accurate (0-100)
- [ ] is_filled() returns correct boolean
- [ ] Quantity saturation handling
- [ ] Queue push/pop/peek work
- [ ] Queue is_empty() correct
- [ ] Payment method truncation (max 32 bytes)

### Performance Validation

- [ ] Order creation: O(1)
- [ ] Fill operation: O(1)
- [ ] Queue operations: O(1)
- [ ] Memory: Fixed size allocation

---

## Component 3: OrderBook (`order_book.rs`)

### Isolation Strategy

Test OrderBook operations without token transfers or settlement logic.

### Unit Tests Location

`programs/market/src/order_book.rs` - Tests within module

### How to Run

```bash
cd anomi-zk-prototype
cargo test --package market --lib order_book::tests -- --nocapture
```

### Test Coverage

**Test 1: `test_order_book_insert`**
- Create OrderBook
- Insert orders at various prices
- Verify CritBit tree insertion
- Check order queue assignment

**Test 2: `test_order_book_remove`**
- Insert orders
- Remove specific orders by ID
- Verify tree cleanup (empty price levels)
- Check total orders counter

**Test 3: `test_order_book_best_price`**
- Insert multiple bids and asks
- Query best bid (highest)
- Query best ask (lowest)
- Verify price caching updates

**Test 4 (implied): `test_order_book_match`**
- Insert asks at various prices
- Execute bid matching
- Verify multi-order fills
- Check FIFO within price level
- Validate self-trade prevention

### Expected Results

- ✅ Orders inserted into correct trees (bid/ask)
- ✅ Price levels managed efficiently
- ✅ Best prices calculated correctly
- ✅ Orders removed cleanly
- ✅ Tree structure maintained

### Validation Checklist

- [ ] Insert bid goes to bids tree
- [ ] Insert ask goes to asks tree
- [ ] New price level creates queue
- [ ] Existing price level adds to queue
- [ ] Remove order updates tree
- [ ] Remove last order at price removes level
- [ ] Best bid is highest price
- [ ] Best ask is lowest price
- [ ] Total orders counter accurate
- [ ] next_queue_index increments
- [ ] MAX_PRICE_LEVELS enforced (50)
- [ ] Match respects price-time priority
- [ ] Self-trade check works
- [ ] Partial fill updates quantity

### Performance Validation

- [ ] Insert: O(log n) via CritBit
- [ ] Remove: O(log n) via CritBit
- [ ] Best price: O(1) cached
- [ ] Match: O(k × log n) for k matches
- [ ] Memory: ~50 price levels max

---

## Component 4: Token Escrow (Market Program)

### Isolation Strategy

Test token transfer and escrow logic without order matching.

### How to Test

Create focused integration test that only tests escrow without full order book:

```typescript
// tests/unit/escrow-isolation.ts
describe("Escrow Isolation Tests", () => {
  it("Transfers tokens to escrow", async () => {
    // 1. Create token account
    // 2. Mint tokens to user
    // 3. Transfer to escrow vault
    // 4. Verify balances
  });
  
  it("Returns tokens from escrow", async () => {
    // 1. Tokens in escrow
    // 2. Execute return with PDA authority
    // 3. Verify user balance restored
  });
});
```

### Run Command

```bash
cd anomi-zk-prototype
anchor test tests/unit/escrow-isolation.ts
```

### Expected Results

- ✅ Tokens transfer to escrow vault
- ✅ Escrow vault owned by PDA authority
- ✅ Tokens returned correctly
- ✅ No token loss or creation
- ✅ Authority checks enforced

### Validation Checklist

- [ ] User balance decreases by amount
- [ ] Escrow balance increases by amount
- [ ] Total supply conserved
- [ ] PDA authority controls vault
- [ ] Unauthorized transfers rejected
- [ ] Token program invocation correct
- [ ] CPI context properly signed

---

## Component 5: Full Integration

### Strategy

Test all components working together after individual validation.

### How to Run

```bash
cd anomi-zk-prototype
anchor test
```

### Test Coverage

Covered by:
- `tests/phase2-orderbook.ts` - OrderBook integration
- `tests/production-readiness.ts` - Comprehensive scenarios
- `tests/escrow.ts` - Token flows

### Expected Results

- ✅ All components work together
- ✅ No integration issues
- ✅ Data flows correctly
- ✅ State consistency maintained

---

## Testing Workflow

### Step 1: Unit Tests (Isolation)

```bash
# Test each component individually
cargo test --package market --lib critbit::tests
cargo test --package market --lib order::tests
cargo test --package market --lib order_book::tests
```

**Pass Criteria:** All unit tests pass (10/10)

### Step 2: Component Integration

```bash
# Test pairs of components
cargo test --package market --lib order_book::tests
# (OrderBook uses CritBit + Order)
```

**Pass Criteria:** Integration between components works

### Step 3: Full Integration

```bash
# Test complete system
anchor test
```

**Pass Criteria:** All integration tests pass

### Step 4: Production Scenarios

```bash
# Comprehensive production test suite
anchor test tests/production-readiness.ts
```

**Pass Criteria:** All production scenarios pass

---

## Isolation Test Results Template

```markdown
# Component Isolation Test Results

**Date:** YYYY-MM-DD
**Component:** [Component Name]
**Tester:** [Your Name]

## Test Execution

| Test Name | Status | Duration | Notes |
|-----------|--------|----------|-------|
| Test 1    | PASS   | 5ms      | -     |
| Test 2    | PASS   | 3ms      | -     |
| Test 3    | FAIL   | -        | [Issue description] |

## Summary

- Tests Run: X
- Passed: X
- Failed: X
- Success Rate: X%

## Issues Found

1. **Issue:** [Description]
   - **Severity:** Critical/High/Medium/Low
   - **Component:** [Specific part]
   - **Fix:** [Proposed solution]

## Component Status

- [ ] All unit tests pass
- [ ] Performance acceptable
- [ ] No memory leaks
- [ ] Ready for integration

## Next Steps

- Fix issues found
- Re-run tests
- Proceed to integration testing
```

---

## Debugging Isolated Components

### CritBit Tree Debugging

```rust
// Add debug logging
#[cfg(test)]
fn debug_tree(&self) {
    msg!("Root: {}", self.root);
    msg!("Leaf count: {}", self.leaf_count);
    for (i, node) in self.nodes.iter().enumerate() {
        if node.is_leaf {
            msg!("Leaf {}: key={}, order_index={}", i, node.key, node.order_index);
        }
    }
}
```

### Order Debugging

```rust
// Print order state
impl std::fmt::Display for Order {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "Order[id={}, price={}, qty={}/{}]",
               self.order_id, self.price, self.quantity, self.original_quantity)
    }
}
```

### OrderBook Debugging

```typescript
// Fetch and inspect state
const orderBook = await program.account.orderBook.fetch(orderBookPDA);
console.log("Total orders:", orderBook.totalOrders.toString());
console.log("Best bid:", orderBook.bestBid.toString());
console.log("Best ask:", orderBook.bestAsk.toString());
console.log("Bids tree root:", orderBook.bids.root);
console.log("Asks tree root:", orderBook.asks.root);
```

---

## Performance Benchmarking

### Benchmark Setup

```bash
# Run tests with timing
cargo test --package market --lib -- --nocapture --test-threads=1
```

### Metrics to Track

| Operation | Target | Actual | Status |
|-----------|--------|--------|--------|
| CritBit insert | < 1ms | - | - |
| CritBit find | < 1ms | - | - |
| Order creation | < 100μs | - | - |
| OrderBook insert | < 2ms | - | - |
| OrderBook match | < 5ms | - | - |

---

## Conclusion

**Component isolation testing is complete when:**

✅ All unit tests pass for each component  
✅ Performance meets targets  
✅ No memory issues detected  
✅ Components ready for integration  

**Next Step:** Proceed to full integration testing

---

For automated execution of all component tests, use:

```bash
./scripts/test-production.sh
# or on Windows
.\scripts\test-production.ps1
```

