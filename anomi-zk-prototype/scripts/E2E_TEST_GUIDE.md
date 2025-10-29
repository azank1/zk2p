# End-to-End P2P Trading Test Guide

This guide walks through the complete P2P trading flow on Solana devnet.

## Prerequisites

- Solana CLI installed
- Anchor Framework installed
- Node.js and TypeScript
- Two Phantom wallet instances (seller and buyer)
- WSL terminal for running scripts

## Step-by-Step Testing

### Phase 1: Token Setup

#### Step 1: Create New SPL Token
```bash
cd /mnt/d/dev/zk2p/anomi-zk-prototype
ts-node scripts/create-new-token.ts
```

**Output:**
- New token mint address
- Saved to `scripts/token-config.json`
- 100,000 tokens minted to deployer

**Copy the token mint address for next steps.**

#### Step 2: Generate Buyer Wallet
```bash
ts-node scripts/setup-buyer-wallet.ts
```

**Output:**
- New keypair saved to `scripts/test-buyer-wallet.json`
- Public key displayed

**Action Required:**
1. Copy the buyer public key
2. Import the keypair into your second Phantom wallet
3. Switch Phantom to Devnet mode
4. Get SOL via faucet or run: `solana airdrop 2 <BUYER_PUBKEY> --url devnet`

#### Step 3: Distribute Tokens
```bash
ts-node scripts/create-e2e-tokens.ts
```

**Output:**
- ATAs created for seller and buyer
- 10,000 tokens minted to each wallet
- Saved to `scripts/e2e-distribution.json`

### Phase 2: Market Initialization

#### Step 4: Initialize Market PDAs
```bash
export ANCHOR_WALLET=~/.config/solana/id.json
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com

# Use the token mint from Step 1
ts-node scripts/init-devnet.ts <TOKEN_MINT_ADDRESS>
```

**Output:**
- Escrow vault initialized
- Market initialized
- OrderBook initialized
- UI config saved to `demo-ui/config.json`

**Explorer Links:**
- Market: `https://explorer.solana.com/address/<MARKET_ADDRESS>?cluster=devnet`
- OrderBook: `https://explorer.solana.com/address/<ORDERBOOK_ADDRESS>?cluster=devnet`

### Phase 3: CLI-Based P2P Test

#### Step 5: Test Automated P2P Flow
```bash
ts-node scripts/test-p2p-flow.ts
```

**What happens:**
1. Seller places Ask order (100 tokens @ 50)
2. Buyer places Bid order (100 tokens @ 50)
3. Orders match automatically
4. Tokens transfer from escrow to buyer

**Verify:**
- Two transaction signatures returned
- Check balances updated
- View transactions on Solana Explorer

#### Step 6: Fetch Order Book State
```bash
ts-node scripts/fetch-orderbook.ts
```

**Output:**
- Market account details
- OrderBook state (bids/asks)
- CritBit tree statistics
- Current orders

### Phase 4: UI-Based P2P Test

#### Step 7: Test with Phantom Wallet UI

**Setup:**
1. Start UI server:
```bash
cd demo-ui
python -m http.server 8080
```

2. Open http://127.0.0.1:8080 in browser

**Seller Test (Browser 1 / Incognito):**
1. Click "Connect Phantom Wallet"
2. Connect with seller wallet (main wallet)
3. Fill order form:
   - Amount: 100
   - Price: 50
   - Order Type: Limit Order
4. Click "Place Ask"
5. Approve transaction in Phantom
6. Note transaction signature

**Buyer Test (Browser 2 / Different Profile):**
1. Click "Connect Phantom Wallet"
2. Connect with buyer wallet
3. Fill order form:
   - Amount: 100
   - Price: 50
   - Order Type: Limit Order
4. Click "Place Bid"
5. Approve transaction in Phantom
6. Note transaction signature

**Verification:**
- Check order book panel updates
- View CritBit tree visualization
- Check transaction logs in UI
- Verify balances in Phantom

### Phase 5: Verification

#### Step 8: Manual Verification Checklist

For each transaction, verify on Solana Explorer:

**Seller Ask Order:**
- [ ] Transaction confirmed
- [ ] Program logs show "Market: Placing limit order"
- [ ] Token transfer to escrow vault visible
- [ ] Order inserted into OrderBook

**Buyer Bid Order:**
- [ ] Transaction confirmed
- [ ] Program logs show "Market: Placing limit order"
- [ ] Order matches against seller's ask
- [ ] Token transfer from escrow to buyer

**Final State:**
- [ ] Seller token balance decreased by 100
- [ ] Buyer token balance increased by 100
- [ ] Escrow vault returned to 0 (tokens released)
- [ ] Order book shows completed trade

## Success Criteria

- ✅ Both orders placed successfully via CLI
- ✅ Both orders placed successfully via UI
- ✅ Tokens transferred correctly (seller → escrow → buyer)
- ✅ Order book state updated correctly
- ✅ All transactions viewable on Solana Explorer
- ✅ No failed transactions
- ✅ 100% success rate for P2P trade

## Troubleshooting

**Error: "Insufficient funds"**
- Ensure both wallets have SOL for transaction fees
- Run: `solana airdrop 2 <WALLET> --url devnet`

**Error: "Account not initialized"**
- Re-run Step 4 to initialize market PDAs

**Error: "Token account not found"**
- Ensure tokens were distributed (Step 3)
- Check ATA addresses match

**UI not loading:**
- Ensure server is running on port 8080
- Check `demo-ui/config.json` exists

## Files Generated

- `scripts/token-config.json` - Token mint configuration
- `scripts/test-buyer-wallet.json` - Buyer wallet keypair
- `scripts/e2e-distribution.json` - Token distribution details
- `scripts/devnet-config.json` - Deployment configuration
- `demo-ui/config.json` - UI configuration

## Next Steps After Successful Test

1. Document transaction signatures
2. Save Explorer links
3. Test with different token amounts
4. Test different order types (FOK, IOC, etc.)
5. Test order cancellation
6. Test partial fills
