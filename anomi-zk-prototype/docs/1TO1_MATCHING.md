# 1:1 Matching Architecture

## Overview

Simplified matching engine enforcing **1 buyer : 1 seller** ratio for clean ZK proof integration.

---

## Design Rationale

### Why 1:1 Matching?

**ZK Proof Simplicity:**
- 1 buyer solvency proof
- 1 seller ask order
- 1 fiat transfer
- 1 payment proof
- Total: 2 proofs per trade (simple, predictable)

**vs Multi-Order Matching (1:N):**
- 1 buyer solvency proof
- N seller ask orders
- N fiat transfers
- N payment proofs
- Total: 1 + N proofs (complex, variable time)

---

## Implementation

### Limit Order (1:1)

**Behavior:**
```
Buyer wants: 100 tokens @ $55 max
Order Book: 
- Ask 1: 30 @ $50 (Alice)
- Ask 2: 40 @ $52 (Bob)
- Ask 3: 50 @ $54 (Charlie)

Result:
- Match ONLY Ask 1: 30 @ $50 from Alice
- Remaining 70 becomes resting bid order @ $55
```

**Code Logic:**
```javascript
function executeLimitBid(trader, amount, price, matchingAsks) {
    // Match against FIRST compatible ask only
    const askOrder = matchingAsks[0];
    const fillAmount = Math.min(amount, askOrder.amount);
    
    // Execute 1:1 match
    // If remaining, create resting bid
}
```

**Benefits:**
- Simple 1:1 settlement
- Predictable ZK proof generation
- Clear buyer-seller pairing

---

### FOK Order (1:1 Exact)

**Behavior:**
```
Buyer wants: EXACTLY 100 tokens @ $55 max

Scenario 1 - REJECT:
Order Book: Ask 1: 30 @ $50
Result: REJECTED (not exact match)

Scenario 2 - ACCEPT:
Order Book: Ask 1: 100 @ $50
Result: FILLED exactly (perfect 1:1 match)
```

**Code Logic:**
```javascript
function executeFOKBid(trader, amount, price, matchingAsks) {
    const askOrder = matchingAsks[0];
    
    // Must match EXACTLY
    if (askOrder.amount !== amount) {
        // REJECT - not exact
        return;
    }
    
    // Fill completely (1:1 exact)
}
```

**Benefits:**
- Guarantees exact amount
- Perfect 1:1 pairing
- Simplest ZK proof scenario

---

## ZK Proof Flow (1:1)

### Step 1: Buyer Places Limit Bid

```
1. Generate solvency proof (I have $5,000)
2. Submit bid: 100 tokens @ $50 max
3. System finds best ask: Alice 100 @ $48
4. Match 1:1: Buyer ↔ Alice
5. Create matched order pair
```

### Step 2: Fiat Transfer (Off-Chain)

```
Buyer transfers $4,800 to Alice via bank
```

### Step 3: Payment Proof

```
Buyer generates payment proof:
- Proves $4,800 sent to Alice
- Proves transaction completed
- Submit to OrderProcessor
```

### Step 4: Settlement

```
OrderProcessor verifies proof
If valid: Release 100 tokens from escrow to Buyer
If invalid: Reject, tokens stay in escrow
```

**Total Proofs: 2 (solvency + payment)**  
**Total Fiat Transfers: 1 (simple)**

---

## Comparison

### Multi-Order (1:N) - OLD

```
Bid: 100 tokens
Matches: Alice (30), Bob (40), Charlie (30)

Fiat Transfers:
- $1,440 to Alice
- $2,080 to Bob  
- $1,620 to Charlie

Proofs Needed:
- 1 solvency proof
- 3 payment proofs
- Total: 4 proofs

Time: ~4-8 seconds
Complexity: High
```

### 1:1 Matching - NEW

```
Bid: 100 tokens
Matches: Alice (30) ONLY

Fiat Transfer:
- $1,440 to Alice

Proofs Needed:
- 1 solvency proof
- 1 payment proof
- Total: 2 proofs

Remaining: 70 tokens becomes new bid (repeats if needed)

Time: ~2-4 seconds
Complexity: Low
```

---

## Trade-offs

### Advantages

**Simplicity:**
- Clean 1:1 buyer-seller pairing
- Predictable proof generation
- Easy to reason about

**ZK Proof:**
- Always 2 proofs (solvency + payment)
- Fast proof generation
- Lower complexity

**Settlement:**
- Single fiat transfer
- Atomic operation
- Clear success/failure

### Disadvantages

**User Experience:**
- Partial fills common
- Large orders need multiple transactions
- No price improvement across orders

**Costs:**
- Higher Solana transaction fees (multiple txs)
- More clicks for users
- Slower for large orders

---

## Mitigation Strategies

### For Large Orders

**Option 1: Auto-Retry in UI**
```javascript
async function placeLargeOrder(amount) {
    let filled = 0;
    while (filled < amount) {
        const remaining = amount - filled;
        const result = await placeLimitBid(remaining);
        filled += result.filled;
        
        if (!result.matched) break; // No more asks
    }
}
```

**Option 2: Batch Display**
```
Original order: 1000 tokens
Broken into: 10 x 100 token orders
UI shows: "Matching 10 sub-orders..."
Result: 10 separate 1:1 settlements
```

---

## On-Chain Implementation

### Current Code Already Supports This

The `match_order` instruction can be modified to enforce 1:1:

```rust
pub fn match_order(...) -> Result<Vec<(u64, u64, u128)>> {
    // Match against FIRST compatible order only
    let best_order = get_best_order(opposite_side)?;
    let fill_qty = min(quantity, best_order.quantity);
    
    // Return SINGLE fill (1:1)
    Ok(vec![(price, fill_qty, order_id)])
}
```

**Change Required:** Modify the while loop to break after first match.

---

## Benefits for MVP

**For Testing:**
- Simple to test (1 buyer + 1 seller)
- Clear success criteria
- Easy to verify balances

**For ZK Integration:**
- Clean proof architecture
- Predictable flows
- Easy to implement

**For Production:**
- Secure atomic settlements
- No complex state management
- Clear audit trail

---

## Next Steps

### Phase 2: Deploy to Devnet

Test 1:1 matching on-chain:
1. Deploy programs
2. Place ask order (Alice)
3. Place bid order (Bob)
4. Verify 1:1 match
5. Check token transfer

### Phase 3: Add Phantom

Connect UI to devnet:
1. Phantom wallet
2. On-chain calls
3. 1:1 matching enforced
4. Real token flows

### Phase 4: Add ZK

When ZK source ready:
1. Add proof generation
2. Test solvency proof
3. Test payment proof
4. Verify 1:1 settlement

---

**Current Status:** 1:1 matching implemented in UI simulation

**Next:** Deploy to devnet and test with real wallets

