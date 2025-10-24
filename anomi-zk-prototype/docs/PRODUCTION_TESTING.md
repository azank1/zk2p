# Production Testing Guide

Manual verification guide for ZK2P Protocol matching engine production readiness.

## Overview

This guide provides step-by-step manual testing scenarios to validate the production readiness of the CritBit-based matching engine. Use this after automated tests pass to perform human verification of critical functionality.

---

## Prerequisites

### Environment Setup

```bash
# 1. Start local validator
solana-test-validator

# 2. In another terminal, build and deploy
cd anomi-zk-prototype
anchor build
anchor deploy

# 3. Configure Solana CLI to localhost
solana config set --url localhost

# 4. Check configuration
solana config get
```

### Test Accounts

Create test wallets:

```bash
# Create test accounts
solana-keygen new -o test-accounts/user1.json
solana-keygen new -o test-accounts/user2.json
solana-keygen new -o test-accounts/user3.json

# Airdrop SOL
solana airdrop 10 $(solana-keygen pubkey test-accounts/user1.json)
solana airdrop 10 $(solana-keygen pubkey test-accounts/user2.json)
solana airdrop 10 $(solana-keygen pubkey test-accounts/user3.json)
```

---

## Test Category 1: Market Initialization

### Test 1.1: Initialize Market Accounts

**Objective:** Verify market and order book initialization

**Steps:**

1. Initialize escrow vault:
   ```bash
   anchor run initialize-escrow
   ```

2. Initialize market:
   ```bash
   anchor run initialize-market
   ```

3. Initialize order book:
   ```bash
   anchor run initialize-order-book
   ```

**Expected Results:**
- ✅ Escrow vault created with correct PDA
- ✅ Market account initialized with token mint
- ✅ Order book initialized with zero orders
- ✅ Best bid = 0, Best ask = MAX

**Verification:**
```bash
# Check accounts exist
solana account <MARKET_PDA>
solana account <ORDER_BOOK_PDA>
solana account <ESCROW_VAULT>
```

**Pass Criteria:**
- [ ] All accounts exist
- [ ] Account owners are correct program IDs
- [ ] Initial state is valid

---

## Test Category 2: Order Placement

### Test 2.1: Place Single Ask Order

**Objective:** Verify limit order placement with token escrow

**Steps:**

1. Check user token balance before:
   ```bash
   spl-token balance <TOKEN_MINT> --owner <USER1_PUBKEY>
   ```

2. Place ask order (100 tokens @ price 50):
   ```typescript
   await program.methods
     .placeLimitOrderV2(
       { ask: {} },
       new BN(50_000),
       new BN(100_000_000),
       { limit: {} },
       new BN(1),
       "Bank Transfer"
     )
     .accounts({ /* ... */ })
     .signers([user1])
     .rpc();
   ```

3. Check balances after:
   ```bash
   # User balance should decrease
   spl-token balance <TOKEN_MINT> --owner <USER1_PUBKEY>
   
   # Escrow balance should increase
   spl-token balance <TOKEN_MINT> --owner <ESCROW_VAULT>
   ```

4. Query order book state:
   ```typescript
   const orderBook = await program.account.orderBook.fetch(orderBookPDA);
   console.log("Total orders:", orderBook.totalOrders.toString());
   console.log("Best ask:", orderBook.bestAsk.toString());
   ```

**Expected Results:**
- ✅ User balance decreased by 100 tokens
- ✅ Escrow balance increased by 100 tokens
- ✅ Order book total orders = 1
- ✅ Best ask = 50,000

**Pass Criteria:**
- [ ] Token transfer to escrow successful
- [ ] Order stored in order book
- [ ] CritBit tree updated
- [ ] No token loss

---

### Test 2.2: Place Multiple Orders at Different Prices

**Objective:** Verify CritBit tree handles multiple price levels

**Steps:**

1. Place 5 ask orders at different prices:
   - User1: 100 tokens @ 45
   - User2: 50 tokens @ 50
   - User1: 75 tokens @ 48
   - User3: 60 tokens @ 52
   - User2: 90 tokens @ 47

2. Query order book:
   ```typescript
   const orderBook = await program.account.orderBook.fetch(orderBookPDA);
   console.log("Total orders:", orderBook.totalOrders);
   console.log("Best ask:", orderBook.bestAsk);
   ```

**Expected Results:**
- ✅ Total orders = 6 (including previous test)
- ✅ Best ask = 45,000 (lowest price)
- ✅ All tokens escrowed correctly

**Pass Criteria:**
- [ ] All orders accepted
- [ ] CritBit tree correctly orders prices
- [ ] Best ask is lowest price (45)
- [ ] Token accounting correct

---

## Test Category 3: Order Matching

### Test 3.1: Simple Bid Match

**Objective:** Verify bid matches against best ask

**Steps:**

1. Note current state:
   ```typescript
   const before = await program.account.orderBook.fetch(orderBookPDA);
   console.log("Orders before:", before.totalOrders);
   console.log("Best ask before:", before.bestAsk);
   ```

2. Place bid order (50 tokens @ price 50):
   ```typescript
   await program.methods
     .matchOrder(
       { bid: {} },
       new BN(50_000_000),
       new BN(50_000),
       { limit: {} }
     )
     .accounts({ /* ... */ })
     .signers([buyer])
     .rpc();
   ```

3. Check state after:
   ```typescript
   const after = await program.account.orderBook.fetch(orderBookPDA);
   console.log("Orders after:", after.totalOrders);
   console.log("Best ask after:", after.bestAsk);
   ```

**Expected Results:**
- ✅ Bid matches against ask at 45
- ✅ 50 tokens matched
- ✅ Ask order partially filled (50 remaining) or removed if fully filled
- ✅ Best ask updated if order fully filled

**Pass Criteria:**
- [ ] Matching executed correctly
- [ ] Order book state updated
- [ ] Best ask recalculated
- [ ] Logs show fill details

---

### Test 3.2: Multi-Order Matching

**Objective:** Verify bid matches multiple asks across price levels

**Steps:**

1. Place large bid (200 tokens @ price 55):
   ```typescript
   await program.methods
     .matchOrder(
       { bid: {} },
       new BN(200_000_000),
       new BN(55_000),
       { limit: {} }
     )
     .accounts({ /* ... */ })
     .signers([buyer])
     .rpc();
   ```

2. Review logs for match details

3. Check final order book state

**Expected Results:**
- ✅ Bid matches multiple asks (at 45, 47, 48, 50, 52)
- ✅ Matches in price priority (lowest first)
- ✅ Fills 200 tokens across multiple orders
- ✅ Order book updated correctly

**Pass Criteria:**
- [ ] Multiple matches executed
- [ ] Price-time priority respected
- [ ] Correct quantity filled
- [ ] Tree structure updated

---

## Test Category 4: All Order Types

### Test 4.1: Limit Order

**Already tested above**

### Test 4.2: Market Order

**Objective:** Verify market order executes at best available price

**Steps:**

1. Place market bid (no specific price limit):
   ```typescript
   await program.methods
     .matchOrder(
       { bid: {} },
       new BN(30_000_000),
       new BN(1_000_000), // Very high limit
       { market: {} }
     )
     .accounts({ /* ... */ })
     .signers([buyer])
     .rpc();
   ```

**Expected Results:**
- ✅ Matches at best ask price
- ✅ Fills any available quantity
- ✅ No resting order in book

**Pass Criteria:**
- [ ] Market order executed immediately
- [ ] Best available price used
- [ ] No limit order created

---

### Test 4.3: Post-Only Order

**Objective:** Verify post-only rejects if would match

**Steps:**

1. Place post-only bid at price that would match existing asks:
   ```typescript
   try {
     await program.methods
       .matchOrder(
         { bid: {} },
         new BN(50_000_000),
         new BN(50_000), // Price that matches existing ask
         { postOnly: {} }
       )
       .accounts({ /* ... */ })
       .signers([buyer])
       .rpc();
     
     console.log("ERROR: Should have rejected!");
   } catch (err) {
     console.log("✓ Correctly rejected:", err.message);
   }
   ```

**Expected Results:**
- ✅ Transaction rejected
- ✅ Error: "PostOnlyWouldMatch"
- ✅ No order placed

**Pass Criteria:**
- [ ] Post-only correctly rejected
- [ ] Appropriate error message
- [ ] Order book unchanged

---

### Test 4.4: Immediate-or-Cancel (IOC)

**Objective:** Verify IOC fills immediately and cancels remainder

**Steps:**

1. Place IOC order for large quantity:
   ```typescript
   await program.methods
     .matchOrder(
       { bid: {} },
       new BN(500_000_000), // More than available
       new BN(60_000),
       { immediateOrCancel: {} }
     )
     .accounts({ /* ... */ })
     .signers([buyer])
     .rpc();
   ```

**Expected Results:**
- ✅ Fills available orders
- ✅ Cancels unfilled portion
- ✅ No resting order in book

**Pass Criteria:**
- [ ] Partial fill executed
- [ ] Remainder cancelled
- [ ] No limit order created

---

### Test 4.5: Fill-or-Kill (FOK)

**Objective:** Verify FOK requires complete fill or rejects

**Steps:**

1. Place FOK for quantity that cannot be filled:
   ```typescript
   try {
     await program.methods
       .matchOrder(
         { bid: {} },
         new BN(10000_000_000), // Huge quantity
         new BN(100_000),
         { fillOrKill: {} }
       )
       .accounts({ /* ... */ })
       .signers([buyer])
       .rpc();
     
     console.log("ERROR: Should have rejected!");
   } catch (err) {
     console.log("✓ Correctly rejected:", err.message);
   }
   ```

**Expected Results:**
- ✅ Transaction rejected
- ✅ Error: "FillOrKillNotFilled"
- ✅ No partial fill

**Pass Criteria:**
- [ ] FOK correctly rejected
- [ ] No partial execution
- [ ] Order book unchanged

---

## Test Category 5: Self-Trade Prevention

### Test 5.1: Prevent Self-Trade

**Objective:** Verify user cannot match their own orders

**Steps:**

1. User1 places ask order:
   ```typescript
   await program.methods
     .placeLimitOrderV2(
       { ask: {} },
       new BN(60_000),
       new BN(100_000_000),
       { limit: {} },
       new BN(999),
       "Self Trade Test"
     )
     .accounts({ owner: user1.publicKey, /* ... */ })
     .signers([user1])
     .rpc();
   ```

2. Same user tries to bid against their own order:
   ```typescript
   try {
     await program.methods
       .matchOrder(
         { bid: {} },
         new BN(50_000_000),
         new BN(60_000),
         { limit: {} }
       )
       .accounts({ owner: user1.publicKey, /* ... */ })
       .signers([user1])
       .rpc();
     
     console.log("ERROR: Self-trade should be prevented!");
   } catch (err) {
     console.log("✓ Self-trade prevented:", err.message);
   }
   ```

**Expected Results:**
- ✅ Transaction rejected
- ✅ Error: "SelfTradeNotAllowed"
- ✅ Order book unchanged

**Pass Criteria:**
- [ ] Self-trade detected and prevented
- [ ] Appropriate error message
- [ ] No matching occurred

---

## Test Category 6: Order Cancellation

### Test 6.1: Cancel Order and Return Tokens

**Objective:** Verify order cancellation returns escrowed tokens

**Steps:**

1. Check user balance before:
   ```bash
   spl-token balance <TOKEN_MINT> --owner <USER_PUBKEY>
   ```

2. Place ask order:
   ```typescript
   const tx = await program.methods
     .placeLimitOrderV2(
       { ask: {} },
       new BN(70_000),
       new BN(80_000_000),
       { limit: {} },
       new BN(1001),
       "Cancel Test"
     )
     .accounts({ /* ... */ })
     .signers([user])
     .rpc();
   
   // Get order ID from logs
   const orderID = parseOrderIdFromLogs(tx);
   ```

3. Cancel the order:
   ```typescript
   await program.methods
     .cancelOrder(
       orderID,
       { ask: {} },
       new BN(70_000)
     )
     .accounts({ /* ... */ })
     .signers([user])
     .rpc();
   ```

4. Check balance after:
   ```bash
   spl-token balance <TOKEN_MINT> --owner <USER_PUBKEY>
   ```

**Expected Results:**
- ✅ Order removed from book
- ✅ Tokens returned to user
- ✅ User balance restored
- ✅ Order book total orders decreased

**Pass Criteria:**
- [ ] Order successfully cancelled
- [ ] Tokens returned to user
- [ ] No token loss
- [ ] Order book updated

---

### Test 6.2: Unauthorized Cancellation Rejected

**Objective:** Verify only order owner can cancel

**Steps:**

1. User1 places order (get order ID)

2. User2 tries to cancel User1's order:
   ```typescript
   try {
     await program.methods
       .cancelOrder(orderID, { ask: {} }, price)
       .accounts({ owner: user2.publicKey, /* ... */ })
       .signers([user2])
       .rpc();
     
     console.log("ERROR: Should have been rejected!");
   } catch (err) {
     console.log("✓ Unauthorized cancel rejected:", err.message);
   }
   ```

**Expected Results:**
- ✅ Transaction rejected
- ✅ Error: "UnauthorizedCancellation"
- ✅ Order remains in book

**Pass Criteria:**
- [ ] Authorization check works
- [ ] Appropriate error
- [ ] Order not cancelled

---

## Test Category 7: Edge Cases

### Test 7.1: Zero Quantity Rejected

**Steps:**

```typescript
try {
  await program.methods
    .placeLimitOrderV2(
      { ask: {} },
      new BN(50_000),
      new BN(0), // Zero quantity
      { limit: {} },
      new BN(2000),
      "Zero Test"
    )
    .accounts({ /* ... */ })
    .rpc();
  
  console.log("ERROR: Should reject zero quantity!");
} catch (err) {
  console.log("✓ Zero quantity rejected:", err.message);
}
```

**Pass Criteria:**
- [ ] Zero quantity rejected
- [ ] Error: "InvalidAmount"

---

### Test 7.2: Zero Price Rejected

**Steps:**

```typescript
try {
  await program.methods
    .placeLimitOrderV2(
      { ask: {} },
      new BN(0), // Zero price
      new BN(100_000_000),
      { limit: {} },
      new BN(2001),
      "Zero Price"
    )
    .accounts({ /* ... */ })
    .rpc();
  
  console.log("ERROR: Should reject zero price!");
} catch (err) {
  console.log("✓ Zero price rejected:", err.message);
}
```

**Pass Criteria:**
- [ ] Zero price rejected
- [ ] Error: "InvalidPrice"

---

### Test 7.3: Partial Fill Handling

**Steps:**

1. Place large ask (500 tokens)

2. Match with smaller bid (100 tokens)

3. Verify:
   - 100 tokens filled
   - 400 tokens remain in book
   - Order not removed
   - Correct tokens distributed

**Pass Criteria:**
- [ ] Partial fill executed correctly
- [ ] Remaining quantity updated
- [ ] Order stays in book
- [ ] Token accounting correct

---

## Test Category 8: Performance & Stress

### Test 8.1: Place 50 Orders

**Objective:** Verify system handles multiple orders

**Steps:**

1. Place 50 orders sequentially with varying prices

2. Monitor:
   - Transaction confirmation time
   - Compute units used
   - Success rate

3. Query final order book state

**Expected Results:**
- ✅ All or most orders accepted (may hit limits)
- ✅ CritBit tree maintains structure
- ✅ Performance acceptable

**Pass Criteria:**
- [ ] At least 40/50 orders placed successfully
- [ ] Transaction time < 2s average
- [ ] No corruption in order book

---

## Test Category 9: Token Accounting

### Test 9.1: Total Supply Conservation

**Objective:** Verify no tokens created or destroyed

**Steps:**

1. Record initial state:
   ```typescript
   const initialUserBalances = [];
   for (const user of users) {
     const balance = await getAccount(connection, user.tokenAccount);
     initialUserBalances.push(balance.amount);
   }
   const initialEscrow = await getAccount(connection, escrowVault);
   const initialTotal = initialUserBalances.reduce((sum, b) => sum + b, 0n) + initialEscrow.amount;
   ```

2. Execute various transactions:
   - Place 10 orders
   - Match 5 orders
   - Cancel 2 orders

3. Calculate final total:
   ```typescript
   const finalUserBalances = [];
   for (const user of users) {
     const balance = await getAccount(connection, user.tokenAccount);
     finalUserBalances.push(balance.amount);
   }
   const finalEscrow = await getAccount(connection, escrowVault);
   const finalTotal = finalUserBalances.reduce((sum, b) => sum + b, 0n) + finalEscrow.amount;
   ```

4. Compare:
   ```typescript
   console.log("Initial total:", initialTotal.toString());
   console.log("Final total:", finalTotal.toString());
   console.log("Difference:", (finalTotal - initialTotal).toString());
   ```

**Expected Results:**
- ✅ Initial total = Final total
- ✅ No tokens created or lost
- ✅ Escrow + user balances = constant

**Pass Criteria:**
- [ ] Total supply unchanged
- [ ] Difference = 0 (or < rounding error)
- [ ] No token loss

---

## Test Category 10: PDA Validation

### Test 10.1: PDA Derivations

**Objective:** Verify all PDAs derived correctly

**Steps:**

1. Derive PDAs manually:
   ```typescript
   const [market, marketBump] = PublicKey.findProgramAddressSync(
     [Buffer.from("market"), tokenMint.toBuffer()],
     programId
   );
   
   const [orderBook, obBump] = PublicKey.findProgramAddressSync(
     [Buffer.from("order_book"), tokenMint.toBuffer()],
     programId
   );
   
   const [escrowVault, evBump] = PublicKey.findProgramAddressSync(
     [Buffer.from("escrow_vault"), tokenMint.toBuffer()],
     programId
   );
   
   const [escrowAuthority, eaBump] = PublicKey.findProgramAddressSync(
     [Buffer.from("escrow_authority"), tokenMint.toBuffer()],
     programId
   );
   ```

2. Compare with actual PDAs used

3. Verify bumps are optimal (255 -> 0 search)

**Expected Results:**
- ✅ All PDAs match expected derivation
- ✅ Bumps are correct
- ✅ Seeds follow convention

**Pass Criteria:**
- [ ] PDA derivations correct
- [ ] No hardcoded addresses
- [ ] Consistent seed patterns

---

## Final Validation Checklist

### Core Functionality

- [ ] Market initialization works
- [ ] Order placement works (all 5 types)
- [ ] Order matching works (single & multi)
- [ ] Order cancellation works
- [ ] Token escrow works correctly

### Security

- [ ] Self-trade prevention works
- [ ] Authorization checks work
- [ ] PDA validation correct
- [ ] No privilege escalation possible

### Data Integrity

- [ ] CritBit tree maintains structure
- [ ] Best bid/ask calculated correctly
- [ ] Order book state consistent
- [ ] Token accounting perfect (no loss)

### Performance

- [ ] Handles 50+ orders
- [ ] Transaction time < 2s
- [ ] Compute units reasonable
- [ ] No degradation under load

### Edge Cases

- [ ] Zero quantity rejected
- [ ] Zero price rejected
- [ ] Partial fills handled
- [ ] Empty order book handled

---

## Production Readiness Assessment

**System is production ready when:**

✅ All automated tests pass (100%)  
✅ All manual tests pass  
✅ No critical bugs found  
✅ Performance meets requirements  
✅ Token accounting perfect  
✅ Security checks validated  

**Next Steps:**

1. Document any issues found
2. Fix critical bugs
3. Re-test affected areas
4. Proceed to Phase 2: ZK Integration

---

## Troubleshooting

### Common Issues

**Issue:** "Account not initialized"
- **Solution:** Run initialization scripts in order

**Issue:** "Insufficient funds"
- **Solution:** Check SOL and token balances, airdrop if needed

**Issue:** "Transaction too large"
- **Solution:** Reduce number of operations or optimize

**Issue:** "Compute budget exceeded"
- **Solution:** Request more compute units or optimize code

---

## Test Report Template

```markdown
# Manual Testing Report

**Date:** YYYY-MM-DD
**Tester:** [Your Name]
**Environment:** Local/Devnet/Testnet

## Summary

- Total Tests: X
- Passed: X
- Failed: X
- Success Rate: X%

## Detailed Results

### Test 1.1: [Test Name]
- Status: PASS/FAIL
- Notes: [Any observations]

[Continue for all tests...]

## Issues Found

1. **Issue:** [Description]
   - **Severity:** Critical/High/Medium/Low
   - **Steps to Reproduce:** [Steps]
   - **Expected:** [Expected behavior]
   - **Actual:** [Actual behavior]

## Conclusion

[Overall assessment and recommendation]

## Sign-off

- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Ready for next phase

Tested by: ________________
Date: ________________
```

---

**End of Manual Testing Guide**

For automated testing, see: `scripts/test-production.sh` or `scripts/test-production.ps1`

For production readiness automated suite, run: `anchor test tests/production-readiness.ts`

