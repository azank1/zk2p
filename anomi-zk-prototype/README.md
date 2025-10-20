# ZK2P Protocol - Anomi Prototype

## First-Time Setup

```bash
# 1. Install dependencies
yarn install

# 2. Build programs
anchor build

# 3. Run tests
anchor test
```

## Phase 2A: Production Matching Engine

### What's New

Phase 2A implements a **real order book with matching engine**, replacing the stubbed instant-match system:

- ✅ Order book storage in PDAs
- ✅ Price-time priority matching algorithm
- ✅ Multi-seller P2P marketplace
- ✅ Partial order fills support

### Run Phase 2A Tests

```bash
# Run all tests (recommended)
anchor test

# Or run only Phase 2A matching tests
anchor test -- --grep "Phase 2A"
```

### What the Tests Prove

**Test File**: `tests/phase2a-matching.ts`

1. ✅ Order book initialization
2. ✅ Ask orders stored in order book (not just logged)
3. ✅ **CORE**: Bid matches real seller from order book
4. ✅ Partial fills and order book updates work

**Before Phase 2A**: Matching was stubbed (same trader both sides)
**After Phase 2A**: Real matching with actual sellers from order book

### Expected Output

```
Phase 2A: Matching Engine
  ✓ Initializes escrow vault and order book
  ✓ Places ask order and stores it in order book
  ✓ Matches bid against ask order (CORE TEST)
  ✓ Rejects bid when no matching orders exist

4 passing
```

## Project Structure

```
anomi-zk-prototype/
├── programs/
│   ├── market/          # Order book & matching (Phase 2A ✅)
│   ├── order-store/     # Matched order storage
│   └── order-processor/ # ZK validation (stubbed)
├── tests/
│   ├── phase2a-matching.ts  # Phase 2A tests ✅
│   ├── escrow.ts            # Phase 0.5 tests
│   └── anomi-zk-prototype.ts
└── Anchor.toml
```

## Development Status

**Current**: Phase 2A Complete (Production Matching Engine)
**Next**: Phase 2B (Real ZK proof validation)

See parent `README.md` for full protocol documentation.
