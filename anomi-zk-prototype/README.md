# ZK2P Protocol - Phase 2B Implementation

Zero-knowledge peer-to-peer settlement with production matching engine and CritBit-based order book.

## 🎮 Interactive Demo

**See the matching algorithm in action!**

```bash
cd demo-ui
python3 -m http.server 8080
# Visit: http://localhost:8080
```

The demo visualizes the exact price-time priority algorithm from the Rust contract. Place ask orders, submit bids, and watch real-time matching with partial fills.

## Quick Start

```bash
yarn install
anchor build

# Run unit tests (isolated components)
cargo test --package market --lib order::tests
cargo test --package market --lib order_book::tests
cargo test --package market --lib critbit::tests

# Run integration tests (full workflows)
anchor test -- --grep "Phase 2A"  # Legacy matching engine
anchor test -- --grep "Phase 2B"  # New OrderBookV2
```

## Current Test Results

**Unit Tests (10/10 passing):**
```
Order Tests (4/4):
  ✔ test_order_creation
  ✔ test_order_fill  
  ✔ test_unique_order_ids
  ✔ test_order_queue

OrderBook Tests (3/3):
  ✔ test_order_book_insert
  ✔ test_order_book_remove
  ✔ test_order_book_best_price

CritBit Tests (3/3):
  ✔ test_critbit_insert_remove
  ✔ test_critbit_min_max
  ✔ test_critbit_traversal
```

## Phase 2B Features

- **Dual Order Book**: Phase 2A (Vec<AskOrder>) + Phase 2B (CritBit + Order)
- **CritBit Trees**: O(log n) price-level operations, 50 price levels max
- **Order Structure**: Bidirectional, 5 order types, partial fill tracking
- **Educational Tools**: CritBit explorer, PDA analyzer
- **Side-by-Side**: Both systems work independently

## Architecture

```
Seller → place_ask_order() → Tokens to Escrow → Order Book
Buyer → create_bid() → Match from Order Book → CPI to OrderStore
OrderProcessor → finalize_trade(zk_proof) → Release Escrow
```

## Programs

- **Market**: Order book + escrow + matching
- **OrderStore**: Persistent matched order state
- **OrderProcessor**: ZK-gated settlement

See main [README](../README.md) for protocol details.

```
Phase 2A: Matching Engine
  ✓ Initializes escrow vault and order book
  ✓ Places ask order and stores it in order book
  ✓ Matches bid against ask order (CORE TEST)
  ✓ Rejects bid when no matching orders exist

4 passing
```

## Project Structure

```
anomi-zk-prototype/
├── programs/
│   ├── market/          # Order book & matching (Phase 2A ✅)
│   ├── order-store/     # Matched order storage
│   └── order-processor/ # ZK validation (stubbed)
├── tests/
│   ├── phase2a-matching.ts  # Phase 2A tests ✅
│   ├── escrow.ts            # Phase 0.5 tests
│   └── anomi-zk-prototype.ts
└── Anchor.toml
```

## Development Status

**Current**: Milestone 4 - OrderBookV2 Integration (Phase 2B)
**Completed**: Milestones 1-3 (Architecture, CritBit, Order Structure)
**Next**: Milestone 5 (Cancel Orders), Milestone 6 (Complete Migration)

**Educational Approach:**
- Each component testable in isolation
- Visual tools for understanding CritBit trees
- Side-by-side Phase 2A/2B comparison
- Comprehensive documentation in `docs/architecture/`

See `workflow_ANOMI.md` for complete roadmap and parent `README.md` for protocol details.
