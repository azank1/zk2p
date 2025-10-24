# ZK2P Quick Start

Fast track to getting ZK2P DEX running.

---

## For New Developers

### Step 1: Check Dependencies

```bash
cd anomi-zk-prototype
npm run check-deps
```

**If missing tools:** See `SETUP_GUIDE.md` for installation instructions

### Step 2: Install Project Dependencies

```bash
yarn install
```

### Step 3: Build and Test

```bash
# Build programs
npm run build

# Run tests
npm run test
```

**Expected:** All tests pass

### Step 4: Run Demo UI

```bash
npm run ui:start
```

Open browser to: http://127.0.0.1:8080

---

## For Devnet Deployment

### Prerequisites

Ensure you have:
- ✓ Solana CLI installed
- ✓ Anchor CLI installed
- ✓ Devnet SOL (via airdrop)

**Check:**
```bash
npm run check-deps
```

### Deployment (3 Steps)

**Step 1: Deploy Programs**
```bash
cd anomi-zk-prototype
npm run deploy:devnet
```

**Step 2: Create Test Token**
```bash
npm run create-token
```

**Step 3: Initialize Market**
```bash
# Get token mint from scripts/test-token-mint.txt
ts-node scripts/init-devnet.ts <TOKEN_MINT>
```

**Done!** Programs live on devnet.

---

## Available NPM Scripts

```bash
# Dependency Check
npm run check-deps          # Check if all tools installed

# Build & Test
npm run build               # Build Anchor programs
npm run test                # Run all tests
npm run test:unit           # Run Rust unit tests only
npm run test:production     # Run production test suite

# Devnet Deployment
npm run deploy:devnet       # Deploy to devnet
npm run create-token        # Create test SPL token

# UI
npm run ui:start            # Start demo UI server
```

---

## Common Workflows

### Local Development

```bash
# 1. Make code changes
# 2. Build
npm run build

# 3. Test
npm run test

# 4. Test UI
npm run ui:start
```

### Devnet Testing

```bash
# 1. Deploy to devnet
npm run deploy:devnet

# 2. Create token
npm run create-token

# 3. Initialize market
ts-node scripts/init-devnet.ts <TOKEN_MINT>

# 4. Update UI and connect Phantom wallet
```

---

## Troubleshooting

### "solana: command not found"

**You're missing Solana CLI**

**Fix:**
- See `SETUP_GUIDE.md` Section: "Install Solana CLI"
- Recommended: Use WSL on Windows

### "anchor: command not found"

**You're missing Anchor CLI**

**Fix:**
```bash
cargo install --git https://github.com/coral-xyz/anchor --tag v0.29.0 anchor-cli --locked
```

### Scripts won't run

**Fix:**
```bash
# On Linux/WSL, make scripts executable
chmod +x scripts/*.sh

# On Windows, use PowerShell (not CMD)
```

---

## Documentation

**Setup:**
- `SETUP_GUIDE.md` - Complete installation guide
- `REQUIREMENTS.md` - Software requirements
- `anomi-zk-prototype/README.md` - Project overview

**Development:**
- `docs/ARCHITECTURE.md` - System design
- `docs/TESTING.md` - Test procedures
- `docs/CRITBIT_IMPLEMENTATION.md` - CritBit details

**Deployment:**
- `DEVNET_DEPLOYMENT_GUIDE.md` - Devnet deployment
- `scripts/DEPLOYMENT_README.md` - Scripts overview

**Current Status:**
- `workflow_ANOMI.md` - Implementation status
- `READY_FOR_DEVNET.md` - Current phase

---

## Quick Commands Reference

```bash
# Check setup
npm run check-deps

# Build & test
npm run build && npm run test

# Deploy to devnet
npm run deploy:devnet

# Start UI
npm run ui:start

# Run specific tests
npm run test:unit
npm run test:production
```

---

**First time?** Run `npm run check-deps` to verify your setup!

