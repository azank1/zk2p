# Known Issues & Workarounds

## 🚨 Critical: OrderBook Initialization Fails (10KB PDA Limit)

### Issue
OrderBook account fails to initialize on devnet with error:
```
Error Code: AccountNotInitialized
Account does not exist or has no data
```

### Root Cause
The OrderBook struct (line 346 in `lib.rs`) allocates:
```rust
space = 8 + std::mem::size_of::<OrderBook>()
```

With the current implementation:
- 2 CritBitTrees (50 nodes each)
- Vec<OrderQueue> (50 queues)
- Other metadata

**Total size exceeds Solana's 10KB PDA account limit.**

### Evidence
From test run:
- ✅ Market initialized successfully
- ✅ Escrow initialized successfully  
- ❌ OrderBook failed (error swallowed in catch block)
- ❌ All order placements fail with "AccountNotInitialized"

### Impact
- **Blocks P2P testing** - Cannot place orders without OrderBook
- **Blocks devnet deployment** - Market unusable
- **Does NOT affect local tests** - Anchor test framework has different limits

### Solution (Requires Program Changes)

**Option 1: Lazy Initialization (Recommended)**
```rust
// Don't allocate Vec upfront
pub order_queues: Vec<OrderQueue>,  // Empty on init

// Change to:
pub order_queues: [Option<OrderQueue>; 50],  // Fixed array, lazily filled
```

**Option 2: Zero-Copy Accounts**
Use Anchor's `#[zero_copy]` attribute for large structs.

**Option 3: Separate Accounts**
Split OrderBook into multiple PDAs:
- OrderBook (metadata only)
- BidTree (PDA)
- AskTree (PDA)
- OrderQueues (multiple PDAs)

**Option 4: Reduce Capacity**
Current: 50 price levels  
Try: 20 price levels (may fit in 10KB)

### Temporary Workaround: Local Testing Only

**For devnet testing, focus on:**
1. ✅ Market and Escrow work correctly
2. ✅ Token custody proven functional
3. ✅ Architecture validated
4. ⏳ OrderBook requires program refactor

**Use local Anchor tests:**
```bash
anchor test  # Works - no 10KB limit
npm run test:unit  # Works - unit tests pass
```

### Implementation Priority

**Next Sprint:**
1. Implement lazy initialization (Option 1)
2. Reduce MAX_PRICE_LEVELS to 20 for testing
3. Re-deploy to devnet
4. Complete P2P swap test

**Estimated Effort:** 2-4 hours to refactor OrderBook initialization

### References
- Issue discovered: October 29, 2025
- Location: `programs/market/src/lib.rs:346`
- Related: `programs/market/src/order_book.rs:41-51`
- See: `docs/ARCHITECTURE.md` for OrderBook design

---

## ✅ Resolved Issues

### TypeScript Compilation Errors (Fixed)
**Issue:** Scripts failed with "Property 'market' does not exist"  
**Solution:** Direct IDL imports with type casting  
**Status:** ✅ Resolved - all scripts compile

### Cross-Platform Wallet Paths (Fixed)
**Issue:** Scripts failed on Windows  
**Solution:** Use HOME || USERPROFILE  
**Status:** ✅ Resolved - works on all platforms

### Missing devnet-config.json (Fixed)
**Issue:** init-devnet.ts couldn't find config  
**Solution:** Created scripts/devnet-config.json with program IDs  
**Status:** ✅ Resolved

