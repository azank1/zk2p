# ZK2P Protocol

## Project Setup

### 1. Clone the Repository

```bash
git clone https://github.com/azank1/zk2p.git
cd zk2p/anomi-zk-prototype
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
yarn install

# Or using npm
npm install
```

### 3. Build the Programs

```bash
# Build all Anchor programs (Market, OrderStore, OrderProcessor)
anchor build
```

This will compile:
- `programs/market` - Order matching and token escrow
- `programs/order-store` - Persistent state management
- `programs/order-processor` - ZK proof validation and settlement

### 4. Generate Program IDL

The build process automatically generates:
- `target/idl/market.json`
- `target/idl/order_store.json`
- `target/idl/order_processor.json`

---

## Running Tests

### Current Test Suite (Phase 2B Implementation)

**Unit Tests (Isolated Components):**
```bash
# Test Order structure and lifecycle
cargo test --package market --lib order::tests

# Test OrderBook with CritBit tree operations  
cargo test --package market --lib order_book::tests

# Test CritBit tree data structure
cargo test --package market --lib critbit::tests
```

**Integration Tests (Full Workflows):**
```bash
# Test Phase 2A matching engine (legacy)
anchor test -- --grep "Phase 2A"

# Test Phase 2B OrderBookV2 integration (new)
anchor test -- --grep "Phase 2B"

# Run all tests
anchor test
```

**What Each Test Validates:**
- **Order Tests**: Unique ID generation, partial fills, FIFO queues
- **OrderBook Tests**: CritBit tree insert/remove, best price queries
- **CritBit Tests**: Tree traversal, min/max operations, bit-pattern routing
- **Phase 2A Tests**: Legacy matching engine with Vec<AskOrder>
- **Phase 2B Tests**: New OrderBookV2 with CritBit trees and Order structs
## Architecture Overview

The protocol implements a multi-program design with clear separation of concerns:

- **Market Program**: Order matching and token custody
- **OrderStore Program**: Persistent state management for matched trades
- **OrderProcessor Program**: ZK-verified settlement execution

### Design Principles

**Separation of Concerns**: Each program has a single, well-defined responsibility.

**Asynchronous Settlement**: Order matching is decoupled from settlement, accommodating the inherent delays in off-chain fiat payment systems.

**Persistent State**: Matched trades are stored in persistent PDAs rather than transient event queues, ensuring durability across settlement delays.

**Zero-Knowledge Privacy**: All proofs (solvency and payment) are verified on-chain without revealing underlying financial data.

---

## Protocol Flow

### State Diagram

```
[IDLE] 
  │
  │ Seller: place_ask_order()
  │ → Transfer tokens to escrow
  │ → Add order to book
  ↓
[PENDING_MATCH]
  │
  │ Buyer: place_bid_order(zk_solvency_proof)
  │ → Validate ZK proof
  │ → Match orders
  │ → Store matched order (CPI to OrderStore)
  │ → Remove filled orders from book
  ↓
[AWAITING_PAYMENT]
  │
  │ Buyer: Off-chain fiat transfer to Seller
  │ → Generate ZK payment proof
  ↓
[AWAITING_PROOF]
  │
  │ Buyer: finalize_trade(order_id, zk_payment_proof)
  │ → Validate ZK proof (OrderProcessor)
  │ → Update status: PaymentConfirmed (CPI to OrderStore)
  │ → Release escrowed tokens (CPI to Market)
  │ → Update status: Settled (CPI to OrderStore)
  ↓
[COMPLETED]
```

---

## Detailed Protocol States

### Initial State: IDLE

**On-Chain State:**
- Market Program deployed with empty order book
- OrderStore Program deployed with empty persistent storage
- OrderProcessor Program deployed and ready

**Off-Chain State:**
- Seller holds digital assets (e.g., 100 USDC)
- Buyer holds fiat currency in traditional payment system

---

### Phase 1: Order Placement & Escrow

**State:** `IDLE → PENDING_MATCH`

**Seller Action:**
```
place_ask_order(amount, price, payment_method)
```

**On-Chain Execution (Market Program):**
1. Validate order parameters (amount > 0, price > 0)
2. Transfer tokens from seller to escrow vault (CPI to Token Program)
3. Add ask order to on-chain order book
4. Emit order placement event

**State Transition:**
- Escrow vault: `+100 USDC`
- Order book: `+1 ask order`
- Seller: Can go offline

**Invariants:**
- Tokens locked in PDA-controlled escrow
- Order visible to all potential buyers
- Seller cannot withdraw until order cancelled or filled

---

### Phase 2: Order Matching & State Persistence

**State:** `PENDING_MATCH → AWAITING_PAYMENT`

**Buyer Action:**
```
place_bid_order(amount, price, payment_method, zk_solvency_proof)
```

**On-Chain Execution (Market Program):**
1. **Validate ZK Solvency Proof**: Verify buyer has sufficient fiat reserves
   - If invalid → Transaction fails
   - If valid → Continue
2. **Match Orders**: Run matching engine against order book
   - Find compatible ask order
   - Calculate fill amounts
3. **Create Matched Order**: Construct persistent state record
   ```rust
   MatchedOrder {
     order_id: Pubkey,
     buyer: Pubkey,
     seller: Pubkey,
     token_amount: u64,
     fiat_amount: u64,
     payment_method: String,
     expiry: i64,        // 24-hour deadline
     status: Pending
   }
   ```
4. **Persist State**: CPI to OrderStore Program
   ```
   store_matched_order(matched_order)
   ```
5. **Update Order Book**: Remove filled orders

**State Transition:**
- OrderStore PDA: `+1 matched order (status: Pending)`
- Order book: `-1 ask order`
- Escrow vault: `100 USDC (unchanged)`

**Invariants:**
- Matched order persisted before book update
- Tokens remain locked until settlement
- 24-hour expiry enforced

---

### Phase 3: Off-Chain Fiat Transfer

**State:** `AWAITING_PAYMENT → AWAITING_PROOF`

**Off-Chain Actions:**

1. **UI Display**: Buyer receives seller's payment details from matched order
2. **Fiat Transfer**: Buyer initiates traditional payment (e.g., bank transfer, mobile money)
3. **Proof Generation**: Buyer generates ZK Payment Proof
   - Proves payment was sent to correct recipient
   - Proves payment amount matches trade
   - Does NOT reveal bank account details or transaction IDs

**State Transition:**
- On-chain state: `No change`
- Off-chain state: `Fiat transferred, proof generated`

**Security Properties:**
- Payment details never stored on-chain
- ZK proof cryptographically binds payment to trade
- Seller cannot claim non-payment if proof is valid

---

### Phase 4: ZK-Gated Settlement

**State:** `AWAITING_PROOF → COMPLETED`

**Buyer Action:**
```
finalize_trade(order_id, zk_payment_proof)
```

**On-Chain Execution (OrderProcessor Program):**

1. **Validate ZK Payment Proof**
   - Verify proof is cryptographically valid
   - Verify proof corresponds to this order_id
   - If invalid → Transaction fails

2. **Update State (First CPI to OrderStore)**
   ```
   update_order_status(order_id, PaymentConfirmed)
   ```
   - Prevents race conditions
   - Creates audit trail

3. **Release Escrowed Tokens (Permissioned CPI to Market)**
   ```
   release_escrowed_funds(order_id, amount, buyer)
   ```
   - Market Program validates caller is OrderProcessor
   - Transfer tokens from escrow to buyer (CPI to Token Program)

4. **Finalize Settlement (Second CPI to OrderStore)**
   ```
   update_order_status(order_id, Settled)
   ```
   - Mark order as complete
   - Create immutable settlement record

**State Transition:**
- Buyer wallet: `+100 USDC`
- Escrow vault: `-100 USDC`
- OrderStore PDA: `order.status = Settled`

**Invariants:**
- Atomic settlement: Either all CPIs succeed or all fail
- Payment proof validated before token release
- Settlement record permanently on-chain

---

## Program Responsibilities

### Market Program

**Responsibilities:**
- Order book management (add, remove, match)
- Token escrow custody via PDA authority
- Permissioned token release (only from OrderProcessor)

**Critical Security:**
- Escrow vault controlled by PDA (no private key)
- `release_escrowed_funds` validates caller program ID
- All token transfers via SPL Token Program CPIs

**Key Instructions:**
- `initialize_escrow_vault`
- `place_ask_order`
- `place_bid_order`
- `release_escrowed_funds` (permissioned)

---

### OrderStore Program

**Responsibilities:**
- Persistent storage of matched orders
- State transitions (Pending → PaymentConfirmed → Settled)
- Expiry enforcement (24-hour deadline)

**Data Structure:**
```rust
pub struct MatchedOrder {
    pub order_id: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub token_mint: Pubkey,
    pub token_amount: u64,
    pub fiat_amount: u64,
    pub payment_method: String,
    pub created_at: i64,
    pub expiry: i64,
    pub status: OrderStatus,
}

pub enum OrderStatus {
    Pending,
    PaymentConfirmed,
    Settled,
    Expired,
}
```

**Key Instructions:**
- `store_matched_order`
- `update_order_status`
- `get_matched_order`

---

### OrderProcessor Program

**Responsibilities:**
- ZK proof validation (solvency + payment proofs)
- Settlement orchestration via CPIs
- Cross-program authorization enforcement

**Settlement Flow:**
1. Validate ZK payment proof
2. Update OrderStore (PaymentConfirmed)
3. Trigger Market Program escrow release
4. Update OrderStore (Settled)

**Key Instructions:**
- `finalize_trade`
- `validate_payment_proof` (internal)

---

## Security Model

### Escrow Safety
- Tokens held by PDA with no private key
- Only OrderProcessor can trigger release
- Program ID validation prevents unauthorized calls

### ZK Privacy Guarantees
- Solvency proof: Buyer has funds without revealing account balance
- Payment proof: Payment sent without revealing transaction details
- All proofs verified on-chain, generated off-chain

### State Consistency
- Matched orders persisted before order book updates
- Status transitions logged for auditability
- 24-hour expiry prevents indefinite token locks

### Attack Mitigation
- **Replay attacks**: Proof nonces prevent reuse
- **Front-running**: ZK proofs bind to specific order IDs
- **Griefing**: Expiry returns funds to seller after 24h
- **Unauthorized release**: Permissioned CPI with program ID check

---

## Relationship to OpenBook/Serum

This protocol draws architectural inspiration from OpenBook V2 but is **not an integration or fork**. Key differences:

| Aspect | OpenBook V2 | ZK2P Protocol |
|--------|-------------|---------------|
| **Use Case** | High-frequency crypto-to-crypto DEX | Asynchronous fiat-to-crypto P2P |
| **Settlement** | Immediate (same transaction) | Delayed (hours/days for fiat transfer) |
| **State Model** | Transient event queue | Persistent matched order PDAs |
| **Privacy** | Public on-chain data | ZK proofs hide sensitive data |
| **Custody** | Temporary escrow during match | Extended escrow during fiat transfer |

**What We Borrowed:**
- Multi-program architecture pattern
- PDA-based escrow design
- CPI-driven settlement flow

**What We Built Custom:**
- ZK proof verification system
- Persistent OrderStore for asynchronous settlement
- Permissioned cross-program settlement orchestration

---

## Development Status

**Current Phase:** Phase 2B Implementation (Milestone 4 - OrderBookV2 Integration)

**Completed Milestones:**
- ✅ **Milestone 1**: Architecture documentation and PDA analysis
- ✅ **Milestone 2**: CritBit tree implementation with visual explorer
- ✅ **Milestone 3**: Order structure validation (7/7 tests passing)

**Currently Implementing:**
- 🔄 **Milestone 4**: OrderBookV2 side-by-side integration with Phase 2A
- ⏳ **Milestone 5**: Cancel order functionality
- ⏳ **Milestone 6**: Complete migration from Phase 2A to Phase 2B
- ⏳ **Milestone 7**: Multi-order matching and order types
- ⏳ **Milestone 8**: Event queue and crank mechanism
- ⏳ **Milestone 9**: Fee structure and production features

**Architecture Highlights:**
- **Dual Order Book System**: Phase 2A (Vec<AskOrder>) + Phase 2B (CritBit + Order)
- **Educational Approach**: Each component testable in isolation
- **Production-Ready**: OrderBookV2 supports 50 price levels, O(log n) operations
- **ZK-Ready**: Order structure designed for future ZK proof integration

**Test Coverage:**
- **Unit Tests**: Order, OrderBook, CritBit (10/10 passing)
- **Integration Tests**: Phase 2A matching, Phase 2B OrderBookV2
- **Educational Tools**: CritBit explorer, PDA analyzer

**See:** `workflow_ANOMI.md` for complete roadmap and `docs/architecture/` for technical details.

