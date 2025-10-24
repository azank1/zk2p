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

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design and data structures
- [Testing Guide](docs/TESTING.md) - How to run tests
- [CritBit Implementation](docs/CRITBIT_IMPLEMENTATION.md) - Technical details
- [Matching Engine](docs/MATCHING_ENGINE.md) - Algorithm specification

## Implementation Details

**CritBit Tree:** O(log n) operations, 50 price levels per side  
**Order Structure:** 122 bytes, 5 order types, partial fills supported  
**OrderBook:** Separate bid/ask trees, FIFO queues at each price level
