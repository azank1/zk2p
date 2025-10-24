# ZK2P Protocol

Zero-Knowledge Proof P2P Fiat-to-Crypto Exchange on Solana.

## Quick Start

### New Developers

**1. Check Dependencies:**
```bash
cd anomi-zk-prototype
npm run check-deps
```

**2. Install & Build:**
```bash
yarn install
npm run build
```

**3. Run Tests:**
```bash
npm run test
```

**See:** `SETUP_GUIDE.md` for complete installation instructions

### Already Setup

```bash
git clone https://github.com/azank1/zk2p.git
cd zk2p/anomi-zk-prototype
yarn install
anchor build
anchor test
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

- Phase 1: Production testing complete
- Phase 2: ZK integration (waiting for source)
- Phase 3: Devnet deployment (next)

## Documentation

- [Architecture](anomi-zk-prototype/docs/ARCHITECTURE.md) - System design
- [CritBit Implementation](anomi-zk-prototype/docs/CRITBIT_IMPLEMENTATION.md) - Technical spec
- [Matching Engine](anomi-zk-prototype/docs/MATCHING_ENGINE.md) - Algorithm details
- [Testing Guide](anomi-zk-prototype/docs/TESTING.md) - Test procedures
- [Project Status](workflow_ANOMI.md) - Detailed roadmap
