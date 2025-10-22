# ZK2P Protocol

Zero-Knowledge Proof P2P Fiat-to-Crypto Exchange on Solana.

## Quick Start

```bash
git clone https://github.com/azank1/zk2p.git
cd zk2p/anomi-zk-prototype
yarn install
anchor build
```

## Testing

**Unit Tests:**
```bash
cargo test --package market --lib order::tests
cargo test --package market --lib order_book::tests
cargo test --package market --lib critbit::tests
```

**Integration Tests:**
```bash
anchor test
```

## Demo UI

```bash
cd demo-ui
python -m http.server 8080 --bind 127.0.0.1
# Open http://127.0.0.1:8080
```

The UI demonstrates CritBit tree operations in real-time with interactive visualization.

## Architecture

**Multi-Program Design:**
- `Market` - Order matching, token custody
- `OrderStore` - Persistent matched order storage
- `OrderProcessor` - ZK proof validation, settlement

**Key Features:**
- CritBit tree-based order book (O(log n) operations)
- Price-time priority matching
- Partial fill support
- Token escrow with SPL integration

## Status

- Phase 2A: Complete (Real order book matching)
- Phase 2B Milestone 4: Complete (OrderBookV2 with CritBit)
- Phase 2B Milestone 4.5: Complete (CritBit visualization UI)
- Phase 3: Planned (ZK circuits)

## Documentation

See `workflow_ANOMI.md` for detailed implementation status and roadmap.
