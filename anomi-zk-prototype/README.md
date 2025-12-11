# ZK2P DEX - Zero-Knowledge Proof P2P Token Exchange

CritBit tree-based decentralized exchange on Solana with P2P fiat settlement.

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
# Verify setup
npm run test:verify-setup

# Single wallet test (seller + buyer)
npm run test:single-wallet

# Matching test
npm run test:matching

# Two-user demo (proves CritBit matching)
npm run test:two-user-demo

# End-to-end test
npm run test:e2e
```

## Demo

The demo UI is available at `http://127.0.0.1:8080` after running `npm run ui:start`.

**Two-User Demo:**
1. User 1 (Seller): Connect wallet, place ASK order
2. User 2 (Buyer): Connect wallet, place BID order
3. Orders match automatically via CritBit tree
4. Tokens escrowed until fiat payment verified

## Architecture

- **Market Program**: CritBit tree-based order book with O(log n) operations
- **OrderStore Program**: Persistent matched order storage
- **OrderProcessor Program**: ZK proof validation (future)

## Programs (Devnet)

- Market: `Bk2pKQsXXvjPChX2G8AWgwoefnwRbTSirtHGnG8yUEdB`
- OrderStore: `DjuV2BhfeVSnamUNPQhjY1NxtCqDT8RjG8xyKJAN2spg`

## Mainnet Deployment

The UI automatically detects environment:
- Devnet: Uses `config.devnet.json` (default)
- Mainnet: Uses `config.mainnet.json` (set `?network=mainnet` in URL)

To deploy to mainnet:
1. Update `config.mainnet.json` with mainnet program IDs
2. Deploy programs to mainnet
3. Access UI with `?network=mainnet` parameter

## License

ISC
