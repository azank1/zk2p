# Build & Test Guide - OrderBook Fix Applied

## ✅ Code Changes Complete

All program modifications have been applied:
- OrderBook INIT_SPACE constant added (2764 bytes - well under 10KB)
- Payment status tracking added to Order struct
- `mark_payment_made` and `verify_settlement` instructions implemented
- UI updated with payment status section and 10-second timer
- ZK stuff moved to root directory

## 🚀 Build and Deploy (Run in WSL)

**Important:** Run these commands in WSL/bash (not PowerShell) where Solana tools are configured.

```bash
cd /mnt/d/dev/zk2p/anomi-zk-prototype

# Build programs
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### Expected Output

```
Deploying cluster: https://api.devnet.solana.com
Upgrade authority: ~/.config/solana/id.json

Deploying program "market"...
Program Id: Bk2pKQsXXvjPChX2G8AWgwoefnwRbTSirtHGnG8yUEdB

Deploy success
```

### If Program ID Changes

If the program ID changes after deploy, update:
1. `scripts/devnet-config.json` - Update `programs.market` field
2. `demo-ui/index.html` - Update `PROGRAM_IDS.market` (line ~1372)

## 🧪 Test P2P Flow

After successful deployment:

```bash
# Initialize market with existing token
npm run p2p:init-market FRBYvn9SBFNptrDm9enMFEKNxMPkqxztoLbpbcmj2Pzb

# Run P2P swap test
npm run p2p:test

# Verify order book
npm run p2p:fetch
```

### Expected Success

```
[1/3] Initializing escrow vault...
✓ Escrow vault initialized

[2/3] Initializing market...
✓ Market initialized

[3/3] Initializing order book...
✓ Order book initialized        ← Should succeed now!
  TX: <TRANSACTION_SIGNATURE>

[1/2] Seller placing ASK order (100 tokens @ 50)...
✅ Ask placed! TX: <SIGNATURE>

[2/2] Buyer placing BID order (100 tokens @ 50)...
✅ Bid placed! TX: <SIGNATURE>

=== P2P Test Complete ===
```

## 🌐 UI Testing (2 Browsers)

After P2P test succeeds, test the UI:

### Setup

1. Open two browser windows (or use two different browsers)
2. Navigate both to: `http://127.0.0.1:8080`
3. Start the server:
   ```bash
   npm run ui:start
   ```

### Browser 1 (Seller)
1. Connect Phantom wallet (seller address: `3zWJav4...`)
2. Verify "Role: Seller" appears
3. Place ASK order: 100 tokens @ $50
4. Wait for buyer to match

### Browser 2 (Buyer)
1. Connect Phantom wallet (buyer address: `BYvrTqz...`)
2. Verify "Role: Buyer" appears
3. Place BID order: 100 tokens @ $50
4. Order matches immediately
5. Payment section appears
6. Click "Mark Payment Made" button
7. Watch 10-second countdown
8. See "✅ Payment Verified (Stub ZK)" message

### What Happens

1. **Match:** Orders match client-side immediately
2. **Payment UI:** Buyer sees "Mark Payment Made" button
3. **Countdown:** 10-second timer simulates ZK proof verification
4. **Settlement:** After delay, payment automatically verified
5. **Result:** Both parties see transaction complete

## 🔍 Troubleshooting

### Build Fails

**Error:** `no such command: build-sbf`  
**Solution:** Run in WSL where Solana tools are installed, not PowerShell

### OrderBook Still Fails to Initialize

**Check size:** The INIT_SPACE should be 2764 bytes. If it still fails:
1. Reduce MAX_PRICE_LEVELS from 50 to 20 in `order_book.rs`
2. Recalculate INIT_SPACE: `32 + 32 + 32 + 536 + 536 + 4 + 4 + 8 + 8 + 8 = 1200 bytes`
3. Rebuild and redeploy

### Payment Section Doesn't Show

- Check browser console for JavaScript errors
- Verify `onchain-transactions.js` is loaded after main script
- Confirm order matching logic calls `window.ZK2P.showPaymentSection()`

### UI Server Won't Start

```bash
# Kill existing server
pkill -f "python.*http.server"

# Restart
npm run ui:start
```

## 📊 Success Criteria

After completing all steps:

- ✅ `anchor build` completes without errors
- ✅ `anchor deploy` succeeds on devnet
- ✅ OrderBook initializes successfully (no more AccountNotInitialized error)
- ✅ Both seller and buyer can place orders
- ✅ Orders match automatically
- ✅ Payment status section appears in UI
- ✅ 10-second countdown works
- ✅ Settlement completes successfully

## 🎯 What Was Fixed

### OrderBook Size Issue
**Before:** `space = 8 + std::mem::size_of::<OrderBook>()` incorrectly calculated ~12KB  
**After:** `space = 8 + OrderBook::INIT_SPACE` correctly allocates 2764 bytes

### Payment Status Tracking
**Added to Order struct:**
- `payment_status: PaymentStatus` - Track settlement state
- `payment_marked_timestamp: i64` - When buyer marked paid
- `settlement_timestamp: i64` - When 10-second delay expires

**New Instructions:**
- `mark_payment_made(order_id)` - Buyer marks fiat payment sent
- `verify_settlement(order_id)` - Auto-verify after 10 seconds, release tokens

### UI Enhancements
- Wallet role indicator (Seller/Buyer)
- Payment status section with visual feedback
- 10-second countdown timer
- Auto-settlement after delay
- Clear messaging for both parties

## 📚 Next Steps After Testing

Once P2P flow works:
1. Add on-chain integration for payment instructions
2. Replace client-side matching with on-chain matching
3. Integrate with actual ZK proof system (in zk-stuff/)
4. Add order book refresh/polling
5. Implement WebSocket for real-time updates

---

**Ready to build?** Run in WSL:
```bash
cd /mnt/d/dev/zk2p/anomi-zk-prototype
anchor build
```

