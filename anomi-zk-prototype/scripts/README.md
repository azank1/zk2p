# Scripts Directory

This directory contains all utility scripts for the project, organized by purpose.

## Directory Structure

```
scripts/
├── deployment/       # Deployment and initialization scripts
├── setup/           # Token creation and wallet setup
├── tests/           # Testing and verification scripts
├── *.json          # Configuration files
└── README.md       # This file
```

## Deployment Scripts (`deployment/`)

Scripts for deploying and initializing the program on devnet:

- `init-devnet.ts` - Initialize Market, OrderBook, and EscrowVault PDAs
- `deploy-devnet.ps1/.sh` - Deploy program to devnet
- `analyze-pdas.ts` - Analyze PDA addresses and sizes
- `prepare-devnet.sh` - Prepare environment for devnet deployment
- `fix-program-ids.sh` - Update program IDs after deployment
- `sync-keypairs.sh` - Sync keypairs between environments

**Usage:**
```bash
npm run p2p:init-market
```

## Setup Scripts (`setup/`)

Scripts for initial setup and token creation:

- `create-new-token.ts` - Create a new SPL token for testing
- `create-e2e-tokens.ts` - Distribute tokens to seller and buyer wallets
- `setup-buyer-wallet.ts` - Generate test buyer wallet
- `create-test-token.ps1/.sh` - Quick token creation utility
- `check-dependencies.ps1` - Verify all dependencies are installed

**Usage:**
```bash
npm run p2p:create-token      # Create new token
npm run p2p:setup-buyer       # Create buyer wallet
npm run p2p:distribute        # Distribute tokens
```

## Test Scripts (`tests/`)

Scripts for testing P2P trading functionality:

- `test-p2p-flow.ts` - Automated end-to-end P2P test
- `fetch-orderbook.ts` - Fetch and display on-chain order book state
- `place-order-cli.ts` - CLI tool for placing orders
- `manual-match.ts` - Manually trigger order matching
- `reset-orderbook.ts` - Reset/close OrderBook PDA
- `test-production.ps1/.sh` - Production readiness tests

**Usage:**
```bash
npm run p2p:test          # Run full P2P test
npm run p2p:fetch         # View order book
npm run p2p:place-order   # Place an order
npm run p2p:match         # Match orders
npm run p2p:reset         # Reset order book
```

## Configuration Files

- `token-config.json` - Token mint address and metadata
- `test-buyer-wallet.json` - Buyer wallet keypair
- `e2e-distribution.json` - Token distribution records
- `devnet-config.json` - Devnet deployment configuration

**Note:** Configuration files with sensitive data are excluded from git.

## Quick Start

1. **Initial Setup**
   ```bash
   npm run p2p:create-token
   npm run p2p:setup-buyer
   npm run p2p:init-market <TOKEN_MINT>
   npm run p2p:distribute
   ```

2. **Run Tests**
   ```bash
   npm run p2p:test
   ```

3. **Manual Testing**
   ```bash
   npm run p2p:place-order
   npm run p2p:fetch
   npm run p2p:match
   ```

## Environment Requirements

- **WSL**: Anchor build and deployment commands
- **PowerShell**: Windows-specific scripts
- **Node.js**: TypeScript execution
- **Solana CLI**: Wallet and network operations

## Notes

- All test wallets are excluded from version control
- Token addresses are environment-specific
- Always use devnet for testing
- Never commit private keys or wallet files

