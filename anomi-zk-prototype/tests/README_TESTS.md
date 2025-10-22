# Test Suite Guide

## Current Test Structure (Phase 2B Implementation)

### Unit Tests (Isolated Components)

**Rust Unit Tests:**
```bash
# Order structure and lifecycle
cargo test --package market --lib order::tests

# OrderBook with CritBit operations  
cargo test --package market --lib order_book::tests

# CritBit tree data structure
cargo test --package market --lib critbit::tests
```

### Integration Tests (Full Workflows)

1. **`phase2a-matching.ts`** - Phase 2A matching engine (legacy Vec<AskOrder>)
2. **`phase2b-orderbook-v2.ts`** - Phase 2B OrderBookV2 integration (new CritBit + Order)
3. **`escrow.ts`** - Phase 0.5 token escrow tests
4. **`anomi-zk-prototype.ts`** - End-to-end settlement flow tests

### Quick Start

#### Run All Tests
```bash
cd anomi-zk-prototype
anchor test
```

This will:
- Build all programs
- Start test validator automatically
- Run all tests
- Clean up when done

#### Run Specific Test Suites
```bash
# Phase 2A (legacy matching engine)
anchor test -- --grep "Phase 2A"

# Phase 2B (new OrderBookV2)
anchor test -- --grep "Phase 2B"

# All integration tests
anchor test
```

### What Each Test Suite Proves

**Phase 2A Tests (`phase2a-matching.ts`):**
✅ **Test 1**: Order book initialization works
✅ **Test 2**: Ask orders stored in Vec<AskOrder> order book
✅ **Test 3**: **MATCHING ENGINE** - Bid matches against real ask order
✅ **Test 4**: Validation works (rejects bids with no matching orders)

**Phase 2B Tests (`phase2b-orderbook-v2.ts`):**
✅ **Test 1**: OrderBookV2 initialization with CritBit trees
✅ **Test 2**: Place limit orders using new Order structure
✅ **Test 3**: OrderBookV2 side-by-side with Phase 2A
✅ **Test 4**: Token escrow integration with OrderBookV2

**Unit Tests (Rust):**
✅ **Order Tests**: Unique ID generation, partial fills, FIFO queues
✅ **OrderBook Tests**: CritBit insert/remove, best price queries  
✅ **CritBit Tests**: Tree traversal, min/max operations, bit-pattern routing

### Expected Output

**Unit Tests:**
```
running 4 tests
test order::tests::test_unique_order_ids ... ok
test order::tests::test_order_fill ... ok
test order::tests::test_order_queue ... ok
test order::tests::test_order_creation ... ok
test result: ok. 4 passed; 0 failed

running 3 tests
test order_book::tests::test_order_book_insert ... ok
test order_book::tests::test_order_book_remove ... ok
test order_book::tests::test_order_book_best_price ... ok
test result: ok. 3 passed; 0 failed
```

**Integration Tests:**
```
Phase 2A: Matching Engine
  ✓ Initializes escrow vault and order book
  ✓ Places ask order and stores it in order book
  ✓ Matches bid against ask order (CORE TEST)
  ✓ Rejects bid when no matching orders exist

Phase 2B: OrderBookV2 Integration
  ✓ Initializes OrderBookV2 with CritBit trees
  ✓ Places limit orders using Order structure
  ✓ Side-by-side operation with Phase 2A
  ✓ Token escrow integration
```

### Troubleshooting

#### Tests Fail with "AccountNotInitialized"
**Solution**: Make sure to run full `anchor test` (not `--skip-build`)

#### Tests Fail with "NoMatchingOrders"
**Solution**: Test 3 requires Test 2 to run first (places ask order)

#### Old Tests Fail
The `anomi-zk-prototype.ts` and `escrow.ts` tests need updates:
- Add `orderBook` and `tokenMint` to `create_bid` accounts
- Place ask order before creating bid

## Development Workflow

1. **Make changes** to `programs/market/src/lib.rs`
2. **Test**: `anchor test`
3. **Iterate**

That's it! `anchor test` handles everything.
