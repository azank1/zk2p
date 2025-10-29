# P2P Token Swap Testing Guide

## Overview
This guide walks you through testing a complete P2P token swap on Solana Devnet using two Phantom wallets.

## ✅ Prerequisites Fixed
- [x] TypeScript configuration updated with Node.js types
- [x] @types/node installed
- [x] Type safety added to test scripts
- [x] All scripts ready to execute

## 📋 Testing Flow

### Phase 1: Create Test Token

**Command:**
```bash
npx ts-node scripts/create-new-token.ts
```

**What it does:**
- Creates a new SPL token on Devnet
- Mints 100,000 tokens to your wallet (seller)
- Saves configuration to `scripts/token-config.json`

**Expected output:**
```
✅ Token created: <MINT_ADDRESS>
✅ Deployer ATA: <TOKEN_ACCOUNT>
✅ Minted 100,000 tokens to deployer
✅ Configuration saved
```

**Verify:**
- Check `scripts/token-config.json` exists
- View token on Solana Explorer (link provided in output)

---

### Phase 2: Setup Buyer Wallet

**Command:**
```bash
npx ts-node scripts/setup-buyer-wallet.ts
```

**What it does:**
- Generates a new keypair for the buyer
- Saves to `scripts/test-buyer-wallet.json`

**Expected output:**
```
Generated buyer wallet keypair
Public Key: <BUYER_PUBLIC_KEY>
✅ Saved keypair to: scripts/test-buyer-wallet.json
```

**Manual steps:**
1. Open Phantom wallet
2. Go to Settings → Add/Import Wallet
3. Import using the private key from `scripts/test-buyer-wallet.json`
4. Switch Phantom to Devnet mode
5. Request devnet SOL from Phantom faucet or run:
   ```bash
   solana airdrop 2 <BUYER_PUBLIC_KEY> --url devnet
   ```

---

### Phase 3: Distribute Tokens

**Command:**
```bash
npx ts-node scripts/create-e2e-tokens.ts
```

**What it does:**
- Sends 10,000 tokens to buyer wallet
- Creates token account for buyer if needed
- Updates configuration

**Expected output:**
```
✅ Buyer ATA created: <BUYER_TOKEN_ACCOUNT>
✅ Transferred 10,000 tokens to buyer
```

**Verify:**
- Seller should have ~90,000 tokens
- Buyer should have 10,000 tokens
- Check balances in Phantom

---

### Phase 4: Place Test Order (CLI)

**Command:**
```bash
npx ts-node scripts/place-order-cli.ts
```

**What it does:**
- Allows manual order placement via command line
- Interactive prompts for order details

**Example usage:**
```
Order Side: SELL
Price: 50
Amount: 100
```

**Verify:**
- Check transaction on Solana Explorer
- Run fetch-orderbook script to see order

---

### Phase 5: Automated P2P Flow Test

**Command:**
```bash
npx ts-node scripts/test-p2p-flow.ts
```

**What it does:**
1. Seller places ASK order (100 tokens @ price 50)
2. Buyer places BID order (100 tokens @ price 50)
3. Orders should match on-chain
4. Shows initial and final balances

**Expected output:**
```
[1/2] Seller placing ASK order...
✅ Ask placed! TX: <TRANSACTION_ID>

[2/2] Buyer placing BID order...
✅ Bid placed! TX: <TRANSACTION_ID>

Token Balances:
  Seller: <FINAL_SELLER_BALANCE>
  Buyer: <FINAL_BUYER_BALANCE>
  Escrow: <ESCROW_BALANCE>
```

**Success criteria:**
- Both transactions succeed
- Tokens transfer between wallets
- Order book updates correctly

---

### Phase 6: Verify Order Book State

**Command:**
```bash
npx ts-node scripts/fetch-orderbook.ts
```

**What it does:**
- Fetches Market and OrderBook account data
- Shows CritBit tree state
- Displays best bid/ask

**Expected output:**
```
=== Market Account ===
Authority: <AUTHORITY>
Token Mint: <MINT>
Next Order Sequence: <NUMBER>

=== Order Book Account ===
Total Orders: <COUNT>
Best Bid: <PRICE>
Best Ask: <PRICE>
Bids Leaf Count: <COUNT>
Asks Leaf Count: <COUNT>
```

---

## 🔍 Troubleshooting

### TypeScript Errors
All TypeScript compilation errors should now be resolved. If you still see errors:
```bash
cd anomi-zk-prototype
npm install
npx tsc scripts/<SCRIPT_NAME>.ts --noEmit
```

### Insufficient SOL Balance
Both wallets need SOL for transaction fees:
```bash
solana airdrop 2 <PUBLIC_KEY> --url devnet
```

### Token Account Not Found
Make sure to run `create-e2e-tokens.ts` before placing orders.

### Order Placement Fails
Check:
- Market is initialized on devnet
- Token mint matches deployed market
- Sufficient token balance
- Wallet has SOL for fees

### Transaction Timeout
Devnet can be slow. Increase timeout or retry:
```typescript
const provider = new anchor.AnchorProvider(connection, wallet, {
  commitment: 'confirmed',
  skipPreflight: false,
  preflightCommitment: 'confirmed',
});
```

---

## 📊 Verification Checklist

After running the full flow:

- [ ] Token created and visible on Solana Explorer
- [ ] Buyer wallet imported into Phantom
- [ ] Both wallets have SOL balance
- [ ] Tokens distributed (seller: 90k, buyer: 10k)
- [ ] Seller ASK order placed successfully
- [ ] Buyer BID order placed successfully
- [ ] Orders matched on-chain
- [ ] Token balances updated correctly
- [ ] Order book shows correct state
- [ ] All transactions visible on Solana Explorer

---

## 🎯 Quick Test Script

Run all phases in sequence:
```bash
cd anomi-zk-prototype

# Phase 1: Create token
npx ts-node scripts/create-new-token.ts

# Phase 2: Setup buyer
npx ts-node scripts/setup-buyer-wallet.ts
# (Manual: Import wallet to Phantom, get SOL)

# Phase 3: Distribute tokens
npx ts-node scripts/create-e2e-tokens.ts

# Phase 4: Automated P2P test
npx ts-node scripts/test-p2p-flow.ts

# Phase 5: Verify state
npx ts-node scripts/fetch-orderbook.ts
```

---

## 📚 Additional Resources

- **Solana Explorer (Devnet):** https://explorer.solana.com/?cluster=devnet
- **Anchor Docs:** https://www.anchor-lang.com/
- **SPL Token:** https://spl.solana.com/token
- **Phantom Wallet:** https://phantom.app/

---

## 🚀 Success!

When you see successful transactions for both ASK and BID orders, and token balances update correctly, you've achieved a successful P2P token swap on Solana Devnet!

Next steps:
- Test with UI (demo-ui/)
- Add more complex order matching scenarios
- Implement order cancellation
- Add mainnet deployment configuration

