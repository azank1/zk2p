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

## Step 5: Smoke Test (Optional)

### Test via Script

Create `scripts/test-place-order.ts`:
```typescript
// Quick test to place an order on devnet
const tx = await program.methods
  .placeLimitOrderV2(
    { ask: {} },
    new anchor.BN(50 * 1e6),
    new anchor.BN(100 * 1e6),
    { limit: {} },
    new anchor.BN(Date.now()),
    "Test Order"
  )
  .accounts({...})
  .rpc();

console.log("Order placed:", tx);
console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);
```

**Expected:** Order placed successfully, visible on explorer

---

## Configuration Files Generated

### devnet-config.json

```json
{
  "network": "devnet",
  "programs": {
    "market": "...",
    "order_store": "...",
    "order_processor": "..."
  },
  "deployed_at": "2024-12-..."
}
```

### demo-ui/config.json

```json
{
  "network": "devnet",
  "rpcEndpoint": "https://api.devnet.solana.com",
  "programId": "...",
  "tokenMint": "...",
  "pdas": {
    "market": "...",
    "orderBook": "...",
    "escrowVault": "...",
    "escrowAuthority": "..."
  }
}
```

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

1. **Phase 3: Add Phantom to UI**
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

## Deployment Checklist

Before deploying:
- [ ] Solana CLI configured
- [ ] Anchor programs build successfully
- [ ] Tests passing locally

Deployment:
- [ ] Programs deployed to devnet
- [ ] Program IDs saved
- [ ] Test token created
- [ ] Market initialized
- [ ] Order book initialized
- [ ] Escrow vault created

Verification:
- [ ] Can view PDAs on explorer
- [ ] Accounts show correct data
- [ ] No critical errors

---

**Estimated Time:** 30-60 minutes for full deployment

**Ready to proceed?** Run the deployment scripts!

