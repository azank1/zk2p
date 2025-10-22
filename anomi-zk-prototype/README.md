# Anomi ZK Prototype

Solana-based order matching engine with CritBit tree data structure.

## Build & Test

```bash
# Build programs
anchor build

# Run unit tests
cargo test --package market --lib order::tests
cargo test --package market --lib order_book::tests
cargo test --package market --lib critbit::tests

# Run integration tests
anchor test
```

## Test Results

**Unit Tests (10/10 passing):**
- Order structure: 4/4
- OrderBook operations: 3/3
- CritBit tree: 3/3

**Integration Tests (6/6 passing):**
- Phase 2 OrderBook: 6/6 (includes cancel order tests)

## Programs

### Market
Order matching with CritBit-based order book.

**Key Instructions:**
- `initialize_market` - Setup market account
- `initialize_order_book_v2` - Setup CritBit tree
- `place_limit_order_v2` - Place limit order with escrow
- `cancel_order` - Cancel order and return tokens

### OrderStore
Persistent matched order storage.

### OrderProcessor
ZK proof validation and settlement (stubbed).

## Demo UI

```bash
cd demo-ui
python -m http.server 8080 --bind 127.0.0.1
```

Open http://127.0.0.1:8080 to visualize CritBit tree operations.

## Implementation

**CritBit Tree (`critbit.rs`):**
- 429 lines of production code
- O(log n) insert, remove, find operations
- Bit-pattern routing for efficient price levels

**Order Structure (`order.rs`):**
- 122 bytes fixed-size
- 5 order types: Limit, Market, Post-Only, IOC, FOK
- Unique u128 order IDs
- Partial fill tracking

**OrderBook (`order_book.rs`):**
- Separate CritBit trees for bids/asks
- 50 price levels (fits 10KB PDA limit)
- FIFO queues at each price level
