# ZK2P Protocol

Zero-Knowledge Proof P2P Token Exchange on Solana.

## Quick Start

```bash
cd anomi-zk-prototype

# Install dependencies
npm install

# Build programs
anchor build

# Run tests
npm test

# Deploy to devnet
npm run deploy:devnet
```

## P2P Testing (Devnet)

```bash
# 1. Create test token
npm run p2p:create-token

# 2. Setup buyer wallet
npm run p2p:setup-buyer

# 3. Initialize market
npm run p2p:init-market <TOKEN_MINT>

# 4. Distribute tokens
npm run p2p:distribute

# 5. Run P2P swap test
npm run p2p:test

# 6. Verify order book
npm run p2p:fetch
```

## How It Works

**Multi-Program Architecture:**
- `Market` - Order matching with CritBit tree-based order book
- `OrderStore` - Persistent matched order storage
- `OrderProcessor` - ZK proof validation and settlement

**Order Flow:**
1. Users place limit/market orders (ASK to sell, BID to buy)
2. Orders matched on-chain using price-time priority
3. Tokens held in escrow during matching
4. Matched orders stored for off-chain settlement
5. ZK proofs validate fiat payment (future feature)
6. Tokens released upon proof verification

**Key Features:**
- CritBit tree: O(log n) order operations
- 5 order types: Limit, Market, Post-Only, IOC, FOK
- Partial fills and self-trade prevention
- Token escrow with SPL integration
- 39 passing tests (10 unit + 29 integration)

## ZK Email Verification

The settlement layer uses Zero-Knowledge proofs to verify email-based payment confirmations. The ZK circuit proves:
1. **DKIM Verification**: Email was sent by Google (via DKIM signature hash matching)
2. **Domain Matching**: Email is from `@telenorbank.pk` (Easypaisa/Telenor)

**Quick Start:**
```bash
cd zk-stuff
npm install
npm test  # Run email verification tests
```

See [`zk-stuff/README.md`](zk-stuff/README.md) for detailed setup and usage.

## Documentation

- [`anomi-zk-prototype/docs/SETUP.md`](anomi-zk-prototype/docs/SETUP.md) - Installation guide
- [`anomi-zk-prototype/docs/DEPLOYMENT.md`](anomi-zk-prototype/docs/DEPLOYMENT.md) - Deployment instructions
- [`anomi-zk-prototype/docs/TESTING.md`](anomi-zk-prototype/docs/TESTING.md) - Testing guide
- [`anomi-zk-prototype/docs/ARCHITECTURE.md`](anomi-zk-prototype/docs/ARCHITECTURE.md) - System design
- [`zk-stuff/README.md`](zk-stuff/README.md) - ZK Email Verification setup
- [`workflow_ANOMI.md`](workflow_ANOMI.md) - Project status and roadmap

## Current Status

✅ **Completed:**
- Core matching engine with CritBit trees
- All 5 order types implemented
- Token escrow system secure
- 39 tests passing
- Deployed to Solana devnet
- P2P testing scripts ready
- ZK email verification circuit (DKIM + domain matching)
- Email parsing and proof generation utilities

🚧 **In Progress:**
- End-to-end P2P wallet testing
- Phantom wallet UI integration
- ZK proof integration with Solana program

⏳ **Future:**
- Full RSA signature verification in circuit
- Mainnet deployment

See [`workflow_ANOMI.md`](workflow_ANOMI.md) for detailed roadmap.

## Contributing

This project follows a milestone-based development approach. See the workflow document for current status and next steps.

## License

ISC
