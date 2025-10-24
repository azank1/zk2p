# Devnet Deployment Guide

Step-by-step guide to deploy ZK2P to Solana devnet.

---

## Prerequisites

**Required Tools:**
- Solana CLI installed
- Anchor CLI installed
- Node.js and npm/yarn
- Git

**Check installations:**
```bash
solana --version
anchor --version
node --version
```

---

## Step 1: Deploy Programs

### Option A: Automated Script (Recommended)

**Windows:**
```powershell
cd anomi-zk-prototype
.\scripts\deploy-devnet.ps1
```

**Linux/WSL:**
```bash
cd anomi-zk-prototype
chmod +x scripts/deploy-devnet.sh
./scripts/deploy-devnet.sh
```

**What it does:**
- Configures Solana for devnet
- Checks/airdrops SOL
- Builds programs
- Deploys to devnet
- Saves program IDs to `scripts/devnet-config.json`

### Option B: Manual Deployment

```bash
# Configure devnet
solana config set --url devnet

# Get devnet SOL
solana airdrop 2

# Build
cd anomi-zk-prototype
anchor build

# Deploy
anchor deploy --provider.cluster devnet

# Save program IDs
solana address -k target/deploy/market-keypair.json
# Copy and save this address
```

**Result:** Programs deployed to devnet

---

## Step 2: Create Test Token

### Automated

**Windows:**
```powershell
.\scripts\create-test-token.ps1
```

**Linux/WSL:**
```bash
chmod +x scripts/create-test-token.sh
./scripts/create-test-token.sh
```

### Manual

```bash
# Create token (6 decimals)
spl-token create-token --decimals 6
# Save the token mint address

# Create token account
spl-token create-account <TOKEN_MINT>

# Mint test tokens (100,000)
spl-token mint <TOKEN_MINT> 100000
```

**Result:** Test token created and minted to your wallet

---

## Step 3: Initialize Market

```bash
# Read token mint from file (if using automated script)
TOKEN_MINT=$(cat scripts/test-token-mint.txt)

# Initialize market on devnet
cd anomi-zk-prototype
ts-node scripts/init-devnet.ts $TOKEN_MINT
```

**What it does:**
- Initializes escrow vault
- Initializes market account
- Initializes order book with CritBit trees
- Saves configuration to `demo-ui/config.json`

**Result:** Market ready for trading on devnet

---

## Step 4: Verify Deployment

### Check Program Accounts

```bash
# View market account
solana account <MARKET_PDA> --url devnet

# View order book
solana account <ORDER_BOOK_PDA> --url devnet

# View escrow vault
spl-token account-info <ESCROW_VAULT_PDA>
```

### View on Solana Explorer

Open browser to:
```
https://explorer.solana.com/address/<MARKET_PROGRAM_ID>?cluster=devnet
https://explorer.solana.com/address/<MARKET_PDA>?cluster=devnet
https://explorer.solana.com/address/<ORDER_BOOK_PDA>?cluster=devnet
```

**Expected:**
- Programs show as deployed
- PDAs show as initialized
- Escrow vault exists with 0 balance

---

## Troubleshooting

### Error: "Insufficient funds"

**Solution:**
```bash
solana airdrop 2 --url devnet
```

### Error: "Account already exists"

**Solution:** PDAs already initialized, this is OK. Continue to next step.

### Error: "Transaction too large"

**Solution:** Program may be too large. Check program size:
```bash
ls -lh target/deploy/*.so
```

### Error: "Token account not found"

**Solution:** Create token account:
```bash
spl-token create-account <TOKEN_MINT>
```

---

## Next Steps

After deployment complete:

1. **Add Phantom to UI**
   - Add Web3 libraries
   - Implement wallet connection
   - Replace simulation with blockchain calls

2. **Test with Multiple Wallets**
   - Create additional Phantom wallets
   - Mint tokens to each
   - Test P2P trading

3. **Validate MVP**
   - All operations work on devnet
   - Token escrow secure
   - Multi-user trading proven

---

**Estimated Time:** 30-60 minutes for full deployment

**For setup instructions, see:** `docs/SETUP.md`

