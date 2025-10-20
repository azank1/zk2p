# Test Suite Guide

## Phase 2A Matching Engine Tests

### Test Files

1. **`phase2a-matching.ts`** - Phase 2A matching engine tests ✅ CORE TEST
2. **`escrow.ts`** - Phase 0.5 token escrow tests
3. **`anomi-zk-prototype.ts`** - End-to-end settlement flow tests (may need updates)

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

#### Run Only Phase 2A Tests
```bash
anchor test -- --grep "Phase 2A"
```

### What Phase 2A Tests Prove

The `phase2a-matching.ts` test proves:

✅ **Test 1**: Order book initialization works
✅ **Test 2**: Ask orders are stored in order book (not just logged)
✅ **Test 3**: **MATCHING ENGINE** - Bid matches against real ask order
   - Real buyer and seller (not stubbed same trader)
   - Partial fills work correctly
   - Order book updated after match
✅ **Test 4**: Validation works (rejects bids with no matching orders)

### Test 3 is the CORE proof


- ✅ **NEW (Phase 2A)**: `create_bid` actually searches order book and matches real seller

### Expected Output

```
Phase 2A: Matching Engine
  ✓ Initializes escrow vault and order book
  ✓ Places ask order and stores it in order book
  ✓ Matches bid against ask order (CORE TEST)
    ✅ Matched! Buyer: [buyer_pubkey]
    ✅ Matched! Seller: [seller_pubkey]
    ✅ Amount: 50000000
    ✅ Price: 50000
    ✅ Order book updated: 50 tokens remaining
    🎉 PHASE 2A MATCHING ENGINE VERIFIED!
  ✓ Rejects bid when no matching orders exist

4 passing
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
