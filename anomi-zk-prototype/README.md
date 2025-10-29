# Anomi ZK Prototype

Solana-based order matching engine with CritBit tree data structure for P2P token exchange.

## Quick Start

```bash
# Install dependencies
npm install

# Build programs (in WSL)
anchor build

# Run all tests
npm test

# Unit tests
npm run test:unit

# Deploy to devnet (in WSL)
anchor deploy --provider.cluster devnet
```

**Note:** Run `anchor` commands in WSL where Solana tools are configured. See [`WSL_COMMANDS.txt`](WSL_COMMANDS.txt) for quick copy-paste commands.

## P2P Testing on Devnet

Complete P2P token swap between two wallets:

```bash
# Step 1: Create test token
npm run p2p:create-token

# Step 2: Generate buyer wallet keypair
npm run p2p:setup-buyer

# Step 3: Initialize market (use token mint from step 1)
npm run p2p:init-market <TOKEN_MINT_ADDRESS>

# Step 4: Distribute tokens to both wallets
npm run p2p:distribute

# Step 5: Execute P2P swap (automated test)
npm run p2p:test

# Step 6: Verify order book state
npm run p2p:fetch

# Manual order placement
npm run p2p:place-order -- <WALLET_FILE> <ask|bid> <PRICE> <QUANTITY>
```

**Example:**
```bash
npm run p2p:create-token
# Output: Token Mint: FRBYvn9SB...

npm run p2p:setup-buyer
# Creates scripts/test-buyer-wallet.json

npm run p2p:init-market FRBYvn9SBFNptrDm9enMFEKNxMPkqxztoLbpbcmj2Pzb
# Initializes market, escrow, orderbook

npm run p2p:distribute
# Distributes tokens to seller and buyer

npm run p2p:test
# Executes full P2P swap test
```

## How It Works

**Order Matching:**
1. Orders placed via `placeLimitOrderV2` instruction
2. CritBit tree maintains sorted price levels (O(log n))
3. FIFO queues at each price level ensure fairness
4. Orders matched immediately if crossing spread
5. Partial fills supported for better price discovery

**Token Custody:**
- Tokens escrowed in PDA-controlled vault
- Separate bid/ask accounting
- SPL token integration for transfers
- Escrow authority ensures security

**Order Types:**
- **Limit**: Execute at price or better
- **Market**: Execute immediately at best available price
- **Post-Only**: Only maker orders (no immediate match)
- **IOC** (Immediate or Cancel): Fill immediately or cancel
- **FOK** (Fill or Kill): Fill completely or cancel

## Programs

### Market Program
- **ID**: `Bk2pKQsXXvjPChX2G8AWgwoefnwRbTSirtHGnG8yUEdB`
- Order matching with CritBit-based order book
- Token escrow management
- Price-time priority matching

**Key Instructions:**
- `initialize_market` - Create market account
- `initialize_order_book_v2` - Setup CritBit trees
- `place_limit_order_v2` - Place order with escrow
- `cancel_order` - Cancel and return tokens
- `initialize_escrow_vault` - Setup token vault

### OrderStore Program
Persistent storage for matched orders.

### OrderProcessor Program
ZK proof validation and settlement (stubbed for future).

## Testing

**Test Coverage:**
- Unit tests: 10/10 passing
- Integration tests: 29/29 passing
- Total: 39 tests

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
anchor test

# Production readiness tests
npm run test:production
```

## Demo UI

Visualize CritBit tree operations in real-time:

```bash
npm run ui:start
# Open http://127.0.0.1:8080
```

**Features:**
- Real-time order book visualization
- CritBit tree structure display
- Interactive order placement
- Multi-order matching simulation

## Architecture

**Data Structures:**
- **Order**: 122 bytes (supports 5 order types)
- **OrderBook**: Separate bid/ask CritBit trees (50 price levels each)
- **OrderQueue**: FIFO queue at each price level
- **CritBit Tree**: Binary search tree with O(log n) operations

**Performance:**
- Insert order: O(log n)
- Match order: O(log n)
- Best price query: O(1)
- Cancel order: O(log n)

## npm Scripts

```bash
npm run build              # Build Anchor programs
npm run test               # Run all tests
npm run test:unit          # Rust unit tests
npm run test:production    # Production readiness tests
npm run deploy:devnet      # Deploy to devnet
npm run ui:start           # Start demo UI
npm run p2p:create-token   # Create test token
npm run p2p:setup-buyer    # Generate buyer wallet
npm run p2p:init-market    # Initialize market
npm run p2p:distribute     # Distribute tokens
npm run p2p:test           # Run P2P swap test
npm run p2p:fetch          # View order book state
```

## Documentation

- [`docs/SETUP.md`](docs/SETUP.md) - Installation and setup
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) - Deployment guide
- [`docs/TESTING.md`](docs/TESTING.md) - Testing procedures
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - System design
- [`docs/CRITBIT_IMPLEMENTATION.md`](docs/CRITBIT_IMPLEMENTATION.md) - CritBit technical spec
- [`docs/MATCHING_ENGINE.md`](docs/MATCHING_ENGINE.md) - Matching algorithm

## Troubleshooting

**TypeScript Errors:**
- Run `npm install` to ensure `@types/node` is installed
- `tsconfig.json` includes Node.js types and skipLibCheck

**Market Not Initialized:**
- Must run `npm run p2p:init-market <TOKEN_MINT>` before placing orders
- Initializes escrow vault, market account, and order book

**Wallet Path Issues:**
- Scripts use cross-platform paths (HOME/USERPROFILE)
- Default: `~/.config/solana/id.json`
- Ensure Solana CLI wallet exists and has devnet SOL

**Token Account Errors:**
- Run `npm run p2p:distribute` to create token accounts
- Ensures both seller and buyer have ATAs

## Current Status

✅ All core features implemented  
✅ 39 tests passing  
✅ Deployed to Solana devnet  
✅ P2P testing scripts functional  
✅ TypeScript configuration fixed  

See [`../workflow_ANOMI.md`](../workflow_ANOMI.md) for project roadmap.
