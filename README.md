# ZK2P Protocol

Zero-Knowledge Proof P2P Fiat-to-Crypto Exchange on Solana.

## Quick Start

### Prerequisites

Required tools:
- Git
- Node.js (v18+)
- Rust (v1.70+)
- Solana CLI (v1.17+)
- Anchor CLI (v0.29.0)

**See:** [docs/SETUP.md](anomi-zk-prototype/docs/SETUP.md) for detailed installation instructions

### Setup & Build

```bash
# Clone repository
git clone https://github.com/azank1/zk2p.git
cd zk2p/anomi-zk-prototype

# Install dependencies
yarn install

# Build programs
anchor build

# Run tests
anchor test
```

### Deploy to Devnet

```bash
# Deploy programs
npm run deploy:devnet

# Create test token
npm run create-token

# Initialize market
ts-node scripts/init-devnet.ts $(cat scripts/test-token-mint.txt)
```

**See:** [docs/DEPLOYMENT.md](anomi-zk-prototype/docs/DEPLOYMENT.md) for detailed deployment guide

## Testing

**All Tests:**
```bash
npm run test
```

**Unit Tests (Rust):**
```bash
npm run test:unit
```

**Production Tests:**
```bash
npm run test:production
```

Total test coverage: 39 tests (10 unit + 6 integration + 23 production)

## Demo UI

```bash
npm run ui:start
# Open http://127.0.0.1:8080
```

The UI demonstrates CritBit tree operations in real-time with interactive visualization.

**Features:**
- Real-time order book visualization
- CritBit tree structure display
- All 5 order types (Limit, Market, Post-Only, IOC, FOK)
- Multi-order matching simulation
- Order cancellation

## Architecture

**Multi-Program Design:**
- `Market` - Order matching, token custody
- `OrderStore` - Persistent matched order storage
- `OrderProcessor` - ZK proof validation, settlement

**Key Features:**
- CritBit tree-based order book (O(log n) operations)
- 5 order types with matching engine
- Price-time priority matching
- Partial fill support
- Self-trade prevention
- Token escrow with SPL integration
- PDA-based security

## Current Status

✅ **Production Ready**
- Core matching engine complete
- 39 passing tests
- All order types implemented
- Token escrow secure
- Deployment scripts ready

🚧 **In Progress**
- Devnet deployment
- Phantom wallet integration
- Multi-wallet testing

⏳ **Future**
- ZK proof integration (waiting for circuits)
- Mainnet deployment

## Documentation

**Getting Started:**
- [Setup Guide](anomi-zk-prototype/docs/SETUP.md) - Installation instructions
- [Deployment Guide](anomi-zk-prototype/docs/DEPLOYMENT.md) - Devnet deployment
- [Demo UI Server Guide](anomi-zk-prototype/demo-ui/START_SERVER_GUIDE.md) - UI setup and usage

**Technical:**
- [Architecture](anomi-zk-prototype/docs/ARCHITECTURE.md) - System design
- [CritBit Implementation](anomi-zk-prototype/docs/CRITBIT_IMPLEMENTATION.md) - Technical spec
- [Matching Engine](anomi-zk-prototype/docs/MATCHING_ENGINE.md) - Algorithm details
- [Testing Guide](anomi-zk-prototype/docs/TESTING.md) - Test procedures
- [Production Tests](anomi-zk-prototype/tests/README_PRODUCTION_TESTS.md) - Production test suite

**Deployment & Scripts:**
- [Deployment Scripts](anomi-zk-prototype/scripts/DEPLOYMENT_README.md) - Script usage guide
- [Test Suite Guide](anomi-zk-prototype/tests/README_TESTS.md) - Test structure and execution
- [Devnet Deployment Status](anomi-zk-prototype/DEVNET_DEPLOYED.md) - Deployment tracking

**Troubleshooting:**
- [OrderBook Fix Guide](ORDERBOOK_FIX.md) - Known issue and fix instructions

**Project Management:**
- [Workflow Status](workflow_ANOMI.md) - Detailed roadmap and milestones

## NPM Scripts

```bash
npm run check-deps        # Verify all tools installed
npm run build            # Build Anchor programs
npm run test             # Run all tests
npm run test:unit        # Run Rust unit tests
npm run test:production  # Run production tests
npm run deploy:devnet    # Deploy to Solana devnet
npm run create-token     # Create test SPL token
npm run ui:start         # Start demo UI server
```

## Contributing

This project follows a milestone-based development approach. See [workflow_ANOMI.md](workflow_ANOMI.md) for current status and upcoming milestones.
