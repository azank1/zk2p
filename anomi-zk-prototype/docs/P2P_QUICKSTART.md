# P2P Trading Quick Start

## Prerequisites

- Solana CLI configured in WSL
- Anchor CLI installed
- Two Phantom wallets (seller and buyer)
- Both wallets have devnet SOL

## Quick Commands (WSL)

```bash
cd /mnt/d/dev/zk2p/anomi-zk-prototype

# Build and deploy
anchor build
anchor deploy --provider.cluster devnet

# Create test environment
npm run p2p:create-token
npm run p2p:setup-buyer
npm run p2p:init-market <TOKEN_MINT>
npm run p2p:distribute

# Run P2P test
npm run p2p:test

# View results
npm run p2p:fetch

# Start UI
npm run ui:start
```

## Testing with 2 Wallets

1. Start server: `npm run ui:start`
2. Open `http://127.0.0.1:8080` in two browsers
3. Browser 1: Connect seller Phantom wallet
4. Browser 2: Connect buyer Phantom wallet
5. Seller: Place ASK order
6. Buyer: Place BID order
7. Buyer: Click "Mark Payment Made"
8. Both: Watch 10-second countdown
9. Both: See "Payment Verified" message

## Payment Flow

1. **Match:** Orders match (client-side for now)
2. **Payment UI:** Buyer sees "Mark Payment Made" button
3. **Mark Paid:** Buyer clicks after sending fiat off-chain
4. **Settlement Delay:** 10-second countdown (simulates ZK proof verification)
5. **Verification:** Auto-completes, tokens released to seller
6. **Complete:** Both parties see success message

## Troubleshooting

**Build fails:** Run in WSL, not PowerShell  
**OrderBook fails:** Check `anchor build` output for errors  
**UI doesn't show payment:** Check browser console, verify onchain-transactions.js loaded  
**Wallet not detected:** Ensure Phantom is set to Devnet mode

See `BUILD_AND_TEST.md` for detailed instructions.
