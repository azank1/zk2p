# ZK2P DEX

Zero-Knowledge Proof P2P Token Exchange on Solana.

## Quick Start

```bash
# Install dependencies
npm install

# Build programs (requires WSL for Anchor)
anchor build

# Setup seller wallet
npm run p2p:setup-seller

# Initialize market
npm run p2p:init-market

# Distribute tokens
npm run p2p:balance-tokens

# Run UI
npm run ui:start
```

## Testing

```bash
# Single wallet test (seller + buyer)
npm run test:single-wallet

# Matching test
npm run test:matching

# End-to-end test
npm run test:e2e
```

## Architecture

- **Market Program**: CritBit tree-based order book with O(log n) operations
- **OrderStore Program**: Persistent matched order storage
- **OrderProcessor Program**: ZK proof validation (future)

## Programs

- Market: `Bk2pKQsXXvjPChX2G8AWgwoefnwRbTSirtHGnG8yUEdB`
- OrderStore: `DjuV2BhfeVSnamUNPQhjY1NxtCqDT8RjG8xyKJAN2spg`
- OrderProcessor: Deployed separately

## License

ISC
