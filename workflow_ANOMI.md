# ZK2P Protocol - Development Workflow & Status

**Project:** Zero-Knowledge Proof P2P Fiat-to-Crypto Exchange on Solana  
**Repository:** https://github.com/azank1/zk2p  
**Last Updated:** October 20, 2025

---

## 📊 Executive Summary

ZK2P enables trustless P2P trading between crypto sellers and fiat buyers using zero-knowledge proofs to verify solvency and payment without revealing sensitive financial data. Built on Solana with a multi-program architecture inspired by OpenBook/Serum DEX patterns.

**Current Status:** Phase 2A Complete ✅ | Phase 2B Infrastructure Started 🚧

---

## 🏗️ Architecture Overview

### Multi-Program Design

```
┌─────────────────────────────────────────────────────────────┐
│                     ZK2P PROTOCOL                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Market Program │  │ OrderStore      │  │ OrderProcessor│ │
│  │                │  │ Program         │  │ Program       │ │
│  │ • Order Book   │  │                 │  │               │ │
│  │ • Matching     │  │ • Matched Order │  │ • ZK Proof    │ │
│  │ • Escrow       │  │   Storage       │  │   Validation  │ │
│  │                │  │ • State Mgmt    │  │ • Settlement  │ │
│  └───────┬────────┘  └────────┬────────┘  └──────┬───────┘ │
│          │                    │                   │         │
│          └────────── CPI Calls ─────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### Program Responsibilities

| Program | Purpose | Key Instructions | Status |
|---------|---------|-----------------|--------|
| **Market** | Order book management, token custody | `place_ask_order`, `create_bid`, `release_escrowed_funds` | ✅ Phase 2A |
| **OrderStore** | Persistent matched order storage | `create_matched_order`, `update_order_status` | ✅ Basic |
| **OrderProcessor** | ZK proof validation, settlement orchestration | `finalize_trade`, `validate_payment_proof` | 🟡 Stubbed |

---

## ✅ Phase 2A: COMPLETE

### What Was Implemented

**Goal:** Build a real order book with price-time priority matching (replacing stubbed instant-match system)

**Delivered:**
- ✅ Order book storage in PDAs (max 10 orders, 10KB limit)
- ✅ Price-time priority matching algorithm
- ✅ Multi-seller P2P marketplace (real buyer-seller matching)
- ✅ Partial order fills support
- ✅ Token escrow with SPL Token integration
- ✅ Order book persistence across transactions

**Test Results:** 4/4 passing tests in `tests/phase2a-matching.ts`

```bash
Phase 2A: Matching Engine
  ✓ Initializes escrow vault and order book
  ✓ Places ask order and stores it in order book
  ✓ Matches bid against ask order (CORE TEST) ⭐
  ✓ Rejects bid when no matching orders exist

4 passing (3.2s)
```

### Key Code Implementations

**1. Order Book Data Structure** (`programs/market/src/lib.rs:44-56`)
```rust
#[account]
pub struct OrderBook {
    pub token_mint: Pubkey,
    pub orders: Vec<AskOrder>,  // Max 10 orders for Phase 2A
    pub last_order_id: u64,
}
```

**2. Price-Time Priority Matching** (`programs/market/src/lib.rs:170-174`)
```rust
// Sort orders by price (ascending) then by time (ascending)
order_book.orders.sort_by(|a, b| {
    a.price.cmp(&b.price)
        .then(a.created_at.cmp(&b.created_at))
});
```

**3. Partial Fill Logic** (`programs/market/src/lib.rs:183`)
```rust
let fill_amount = std::cmp::min(amount, ask_order.amount);
```

### What This Proves

**Before Phase 2A:** Matching was stubbed (same trader on both sides)  
**After Phase 2A:** Real P2P matching with actual sellers from order book

The test at line 158 of `phase2a-matching.ts` proves:
```typescript
expect(matchedOrder.buyer.toBase58()).to.equal(buyer.publicKey.toBase58());
expect(matchedOrder.seller.toBase58()).to.equal(seller.publicKey.toBase58());
// ^^^ Buyer ≠ Seller = REAL P2P MATCHING ✅
```

---

## 🚧 Phase 2B: IN PROGRESS (Infrastructure Started)

### Goal
Transform Phase 2A's simple `Vec<AskOrder>` into a production-grade order book with:
- Order IDs and lifecycle management
- Multiple order types (Limit, Market, Post-Only, IOC, FOK)
- Order cancellation
- CritBit tree for efficient price-level lookup

### Files Created (Not Yet Integrated)

| File | Purpose | Status | Lines |
|------|---------|--------|-------|
| `programs/market/src/order.rs` | Order structs, types, ID generation | ✅ Complete | 332 |
| `programs/market/src/order_book.rs` | OrderBook v2 with CritBit tree | ✅ Complete | 329 |
| `programs/market/src/critbit.rs` | Binary tree for price levels | ✅ Complete | 381 |

**Current State:**
- Modules are imported in `lib.rs:10-16` but NOT used in instructions
- Phase 2A code still uses simple `Vec<AskOrder>` 
- All Phase 2B modules have unit tests

**Next Step:** Replace Phase 2A structures with Phase 2B implementations

### Order Types Defined (`order.rs:5-16`)
```rust
pub enum OrderType {
    Limit,              // Most common - stays in book
    Market,             // Immediate execution
    PostOnly,           // Maker-only (no immediate match)
    ImmediateOrCancel,  // IOC - fill or cancel
    FillOrKill,         // FOK - all or nothing
}
```

### Order Structure (`order.rs:38-59`)
```rust
pub struct Order {
    pub order_id: u128,           // Unique global ID
    pub owner: Pubkey,
    pub quantity: u64,            // Remaining to fill
    pub original_quantity: u64,   // For tracking fills
    pub price: u64,
    pub timestamp: i64,
    pub order_type: OrderType,
    pub side: Side,               // Bid or Ask
    pub client_order_id: u64,     // User tracking
    pub payment_method: [u8; 32], // Fixed-size for efficiency
}
```

### CritBit Tree Benefits
- **Current (Phase 2A):** O(n) insert/lookup with `Vec` (slow at 1000+ orders)
- **Phase 2B:** O(log n) insert/lookup with CritBit tree (scales to millions)

---

## 📋 Development Roadmap

### Phase 2B: Order Management NEXT
**Goal:** Production-grade order book with full lifecycle management

**Tasks:**
- [ ] Replace `Vec<AskOrder>` with CritBit-based `OrderBookV2`
- [ ] Implement `place_limit_order()` instruction
- [ ] Implement `cancel_order()` instruction
- [ ] Add order ID generation to all orders
- [ ] Update tests to use new order types
- [ ] Test: Multiple orders at different price levels
- [ ] Test: Order cancellation returns escrowed tokens
- [ ] Test: Only order owner can cancel

**Success Criteria:**
- 10+ passing tests
- Order IDs working
- Cancel functionality secure

---

### Phase 2C: Advanced Matching (Week 2-3)
**Goal:** Multi-order matching with all order types

**Tasks:**
- [ ] Implement multi-order matching (fill across multiple asks)
- [ ] Add Post-Only validation (reject immediate match)
- [ ] Add IOC logic (cancel unfilled portion)
- [ ] Add FOK logic (reject if not fully filled)
- [ ] Implement self-trade prevention
- [ ] Add maker/taker identification
- [ ] Test: Match across 5+ orders in one transaction
- [ ] Test: All order types work correctly

**Success Criteria:**
- 20+ passing tests
- All order types validated
- Self-trade prevention works

---

### Phase 2D: Event Queue & Indexing (Week 3-4)
**Goal:** Enable off-chain indexers and UI real-time updates

**Tasks:**
- [ ] Create `EventQueue` account structure
- [ ] Implement ring buffer (256 events)
- [ ] Define `Event` enum (Fill, Out)
- [ ] Add `consume_events()` instruction (crank)
- [ ] Emit events on fills and cancellations
- [ ] Build simple TypeScript event consumer
- [ ] Test: Events emitted correctly
- [ ] Test: Ring buffer wraps without data loss

**Success Criteria:**
- 30+ passing tests
- Off-chain indexer can reconstruct state
- Event queue handles 1000+ events

---

### Phase 2E: Fees & Production Features (Week 4-5)
**Goal:** Production-ready DEX with fee structure

**Tasks:**
- [ ] Add `FeeStructure` to Market account
- [ ] Implement maker/taker fee calculation
- [ ] Support negative fees (maker rebates)
- [ ] Add `collect_fees()` instruction (authority-only)
- [ ] Implement referral fee system (optional)
- [ ] Add market statistics (volume, trade count)
- [ ] Gas optimization pass
- [ ] Test: Fees calculated correctly
- [ ] Test: Only authority can collect fees

**Success Criteria:**
- 50+ passing tests
- Fees working correctly
- Gas costs comparable to OpenBook v2

---

### Phase 3A-3B: ZK Proof Integration (Week 5-8)
**Goal:** Integrate real zero-knowledge proof validation

**Current State:** ZK proofs are stubbed in tests

**Tasks:**
- [ ] Compile real ZK circuits (circom + snarkjs)
- [ ] Generate solvency proof circuit
- [ ] Generate payment proof circuit
- [ ] Implement on-chain Groth16 verifier
- [ ] Link proofs to matched orders
- [ ] Add proof challenge system
- [ ] Test: Real proof verification
- [ ] Test: Invalid proofs rejected

**Success Criteria:**
- Real ZK circuits compiled
- On-chain verification working
- Privacy guarantees proven

---

## 🎨 Demo UI

**Location:** `anomi-zk-prototype/demo-ui/index.html`

**Purpose:** Interactive visualization of Phase 2A matching algorithm

**Features:**
- Real-time order book display
- Place ask orders simulation
- Create bid orders simulation
- Visual matching algorithm execution
- Transaction log console
- Statistics dashboard

**Run:**
```bash
cd anomi-zk-prototype/demo-ui
python3 -m http.server 8080
# Visit: http://localhost:8080
```

**Algorithm Parity:**
The JavaScript implementation mirrors the Rust contract 1:1:
- Same sorting logic (price-time priority)
- Same matching conditions
- Same partial fill calculations

---

## 🛠️ Development Setup

### Prerequisites
```bash
# Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Anchor CLI (v0.29.0+)
cargo install --git https://github.com/coral-xyz/anchor --tag v0.29.0 anchor-cli

# Node.js dependencies
yarn install
```

### Build & Test
```bash
cd anomi-zk-prototype

# Build all programs
anchor build

# Run all tests
anchor test

# Run specific test suite
anchor test -- --grep "Phase 2A"
```

### Test Coverage

| Test Suite | File | Tests | Status |
|------------|------|-------|--------|
| Phase 2A Matching | `tests/phase2a-matching.ts` | 4/4 | ✅ Passing |
| Escrow Basics | `tests/escrow.ts` | 3/3 | ✅ Passing |
| Full Protocol | `tests/anomi-zk-prototype.ts` | - | 🟡 Needs Update |

**Total:** 7 passing tests

---

## 📈 Performance Targets

### Current (Phase 2A)
- Orders in book: 10 max
- Matching: Single order per bid
- Gas cost: ~150k CU per bid

### Target (Phase 2E)
- Orders in book: 1000+
- Matching: Multiple orders per transaction
- Gas cost: ~100k CU per order matched (OpenBook parity)

---

## 🔒 Security Model

### Escrow Safety
- Tokens held by PDA (no private key exposure)
- Only OrderProcessor can trigger release (`release_escrowed_funds` checks caller)
- Program ID validation prevents unauthorized calls

### ZK Privacy Guarantees (Phase 3)
- **Solvency Proof:** Proves buyer has fiat funds without revealing balance
- **Payment Proof:** Proves payment sent without revealing transaction details
- All proofs verified on-chain, generated off-chain

### Attack Mitigation
- **Replay attacks:** Proof nonces prevent reuse
- **Front-running:** ZK proofs cryptographically bound to order IDs
- **Griefing:** 24-hour expiry returns tokens to seller
- **Unauthorized release:** Permissioned CPI with strict caller validation

---

## 🎯 Next Action Items

### Immediate (This Week)
1. **Integrate Phase 2B Modules**
   - Replace `AskOrder` struct with `Order` from `order.rs`
   - Replace `OrderBook` with `OrderBookV2` from `order_book.rs`
   - Update `place_ask_order()` to use new structures
   - Update `create_bid()` to use CritBit tree matching

2. **Add Cancel Order Instruction**
   - Implement `cancel_order()` in `lib.rs`
   - Add authorization checks (only owner)
   - Return escrowed tokens to seller
   - Update order book state

3. **Update Tests**
   - Modify Phase 2A tests to work with new structures
   - Add tests for order cancellation
   - Add tests for multiple price levels

### Short-Term (Next 2 Weeks)
1. **Complete Phase 2B** (see roadmap above)
2. **Begin Phase 2C** (multi-order matching)
3. **Security audit of escrow mechanism**

### Long-Term (Next Month)
1. Complete Phases 2C-2E (robust DEX engine)
2. Begin Phase 3A (real ZK circuit integration)
3. Build full UI for order placement and matching

---

## 🤔 Open Questions & Decisions Needed

1. **Order Book Size:** How many orders should we support?
   - Current: 10 orders (Phase 2A limit)
   - Proposed: 1000 price levels (Phase 2B)
   - Need to balance with Solana account size limits

2. **Fee Model:** Do we want maker rebates?
   - Standard: Maker -0.02%, Taker +0.05%
   - Alternative: Both pay positive fees
   - Need to decide before Phase 2E

3. **Crank Mechanism:** Who runs the event queue crank?
   - Option A: Permissionless (anyone can call)
   - Option B: Authority-only
   - Affects decentralization vs control

4. **Migration Strategy:** Clean slate vs incremental?
   - Option A: Keep Phase 2A as reference, build Phase 2B fresh
   - Option B: Refactor Phase 2A code incrementally
   - Recommendation: Option A (cleaner architecture)

5. **ZK Circuit Priority:** Which proof to build first?
   - Solvency proof (buyer has funds)
   - Payment proof (buyer sent payment)
   - Both needed eventually, but order matters

---

## 📚 Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| Main README | `README.md` | High-level protocol overview |
| Prototype README | `anomi-zk-prototype/README.md` | Setup and quick start |
| Phase 2A Tests | `anomi-zk-prototype/tests/README_TESTS.md` | Test documentation |
| Robust Engine Roadmap | `ROBUST_ENGINE_ROADMAP.md` | Detailed Phase 2B-2E plan |
| This Workflow | `workflow_ANOMI.md` | Current document |

---

## 🔗 Important Links

- **Repository:** https://github.com/azank1/zk2p
- **Solana Docs:** https://docs.solana.com
- **Anchor Docs:** https://www.anchor-lang.com
- **OpenBook V2:** https://github.com/openbook-dex/openbook-v2
- **Circom:** https://docs.circom.io

---

## 📝 Change Log

| Date | Change | Phase |
|------|--------|-------|
| 2025-10-20 | Created comprehensive workflow document | Documentation |
| 2025-10-XX | Phase 2A completed with 4 passing tests | 2A Complete ✅ |
| 2025-10-XX | Phase 2B modules created (order.rs, order_book.rs, critbit.rs) | 2B Started 🚧 |
| 2025-10-XX | Demo UI created for matching visualization | Demo |

---

## 🎓 Learning Resources

### For Understanding the Codebase
1. Read `README.md` for protocol overview
2. Study `programs/market/src/lib.rs` for order book logic
3. Run `anchor test` and read test output
4. Open demo UI to visualize matching algorithm

### For Contributing
1. Understand Anchor framework basics
2. Review OpenBook v2 architecture (inspiration)
3. Study CritBit tree data structure
4. Learn Solana PDA (Program Derived Address) patterns

---

**Status Summary:**
- ✅ Phase 2A: Complete (Real order book matching)
- 🚧 Phase 2B: Infrastructure ready, needs integration
- ⏳ Phase 2C-2E: Roadmap defined, ready to implement
- ⏳ Phase 3: ZK circuits planned, not started

**Next Milestone:** Phase 2B Integration (Target: End of Week)

