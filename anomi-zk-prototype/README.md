# ZK2P Protocol - Phase 2A

Zero-knowledge peer-to-peer settlement with production matching engine.

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
anchor test
```

## Test Results

```
5 passing (10s)
  ✔ Escrow vault and order book initialization
  ✔ Ask order placement with token custody
  ✔ Bid matching with real seller (partial fills)
  ✔ Order book state updates
  ✔ Validation (rejects non-matching bids)
```

## Phase 2A Features

- **Order Book**: On-chain PDA storage with price-time priority
- **Matching Engine**: Bid orders match against real ask orders
- **Partial Fills**: Orders can be partially matched
- **Token Custody**: SPL tokens held in escrow during trading
- **Multi-Seller**: True P2P marketplace (not stub)

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

**Current**: Phase 2A Complete (Production Matching Engine)
**Next**: Phase 2B (Real ZK proof validation)

See parent `README.md` for full protocol documentation.
