# Production Readiness Test Suite

Comprehensive automated testing for ZK2P Protocol production deployment validation.

## Quick Start

```bash
# Run all production tests
cd anomi-zk-prototype
anchor test tests/production-readiness.ts

# Run automated test suite with reporting
./scripts/test-production.sh           # Linux/WSL
.\scripts\test-production.ps1          # Windows PowerShell
```

---

## Test Suite Overview

### Production Readiness Tests (`production-readiness.ts`)

**Purpose:** Comprehensive validation of all system functionality

**Categories:**
1. **Market & Account Initialization** (3 tests)
2. **OrderBook CritBit Operations** (3 tests)
3. **All 5 Order Types** (5 tests)
4. **Multi-Order Matching** (2 tests)
5. **Self-Trade Prevention** (1 test)
6. **Cancel Order Functionality** (2 tests)
7. **Partial Fills & Edge Cases** (3 tests)
8. **Stress Test** (1 test - 50+ orders)
9. **PDA Validation** (1 test)
10. **Token Escrow Flows** (2 tests)

**Total:** 23 comprehensive tests

---

## Test Categories Explained

### Category 1: Market & Account Initialization

Validates core account setup:
- Escrow vault initialization with PDA authority
- Market account initialization with token mint
- OrderBook initialization with CritBit trees

**Why Important:** Foundation for all other operations

### Category 2: OrderBook CritBit Operations

Tests CritBit tree data structure:
- Insert single order and update tree
- Insert multiple orders at different price levels
- Verify price ordering in tree (best ask query)

**Why Important:** Core data structure for O(log n) performance

### Category 3: All 5 Order Types

Validates each order type behavior:
- **Limit:** Places and stays in book
- **Market:** Executes immediately at best price
- **Post-Only:** Rejects if would match (maker-only)
- **IOC:** Fills immediately, cancels remainder
- **FOK:** Requires complete fill or rejects

**Why Important:** DEX must support all standard order types

### Category 4: Multi-Order Matching

Tests complex matching scenarios:
- Bid matches multiple asks across price levels
- Price-time priority (FIFO at same price)

**Why Important:** Real-world trades often span multiple orders

### Category 5: Self-Trade Prevention

Validates security feature:
- User cannot match their own orders

**Why Important:** Critical for fair market operation

### Category 6: Cancel Order Functionality

Tests order cancellation:
- Cancel order and return escrowed tokens
- Reject unauthorized cancellation attempts

**Why Important:** Users must be able to cancel orders safely

### Category 7: Partial Fills & Edge Cases

Tests edge cases:
- Partial order fills
- Zero quantity rejection
- Zero price rejection

**Why Important:** System must handle all inputs gracefully

### Category 8: Stress Test

Performance validation:
- Place 50+ orders at different price levels
- Verify system doesn't degrade

**Why Important:** Production must handle volume

### Category 9: PDA Validation

Security validation:
- Verify PDA derivations are correct
- Ensure deterministic address generation

**Why Important:** Security depends on correct PDA usage

### Category 10: Token Escrow Flows

Token accounting validation:
- Verify no token loss in escrow
- Validate escrow authority controls vault

**Why Important:** Must never lose user funds

---

## Running Tests

### Option 1: Direct Anchor Test

```bash
cd anomi-zk-prototype

# Run specific test file
anchor test tests/production-readiness.ts

# Run all tests
anchor test

# Skip build if already built
anchor test --skip-build
```

### Option 2: Automated Test Script

**Windows (PowerShell):**
```powershell
cd anomi-zk-prototype
.\scripts\test-production.ps1

# Options
.\scripts\test-production.ps1 -SkipBuild      # Skip anchor build
.\scripts\test-production.ps1 -SkipUnitTests  # Skip Rust unit tests
.\scripts\test-production.ps1 -Verbose        # Show detailed output
```

**Linux/WSL (Bash):**
```bash
cd anomi-zk-prototype
chmod +x scripts/test-production.sh  # First time only
./scripts/test-production.sh

# Options
./scripts/test-production.sh --skip-build       # Skip anchor build
./scripts/test-production.sh --skip-unit-tests  # Skip Rust unit tests
./scripts/test-production.sh --verbose          # Show detailed output
```

### Option 3: Individual Test Suites

```bash
# Unit tests only
cargo test --package market --lib order::tests
cargo test --package market --lib order_book::tests
cargo test --package market --lib critbit::tests

# Phase 2 integration tests
anchor test tests/phase2-orderbook.ts

# Production tests only
anchor test tests/production-readiness.ts
```

---

## Test Reports

### Automated Reports

Test scripts generate reports in `test-reports/`:

- **Markdown Report:** `production-test-report-{timestamp}.md`
- **JSON Report:** `production-test-report-{timestamp}.json`

**Report Contents:**
- Test execution summary
- Pass/fail counts by category
- Duration and performance metrics
- Errors and issues found
- Production readiness assessment

### Manual Testing

For step-by-step manual verification, see:
- `docs/PRODUCTION_TESTING.md` - Manual test guide
- `docs/COMPONENT_ISOLATION_TESTING.md` - Component testing guide

---

## Understanding Test Output

### Success Output

```
╔════════════════════════════════════════════════════════════════╗
║       ZK2P PRODUCTION READINESS TEST SUITE                     ║
║       Testing CritBit-based Matching Engine                    ║
╚════════════════════════════════════════════════════════════════╝

🔧 Setting up test environment...
✅ Test environment ready
   Users created: 10
   Token mint: AbC12345...
   Market PDA: XyZ67890...

📦 Category 1: Market & Account Initialization
   Test 1.1: Escrow vault initialization
   ✅ Escrow vault initialized correctly
   
   Test 1.2: Market initialization
   ✅ Market initialized with correct config
   
   Test 1.3: OrderBook initialization
   ✅ OrderBook initialized with CritBit trees

[... more tests ...]

╔════════════════════════════════════════════════════════════════╗
║                    TEST SUMMARY                                 ║
╚════════════════════════════════════════════════════════════════╝

   Total Duration: 15.32s
   Tests Passed: 23
   Tests Failed: 0
   Success Rate: 100.0%

   ✅ ALL TESTS PASSED - PRODUCTION READY!

╔════════════════════════════════════════════════════════════════╗
║              PRODUCTION READINESS: VALIDATED ✅                 ║
╚════════════════════════════════════════════════════════════════╝
```

### Failure Output

```
❌ Test 3.3: Post-only order behavior
   Expected error: PostOnlyWouldMatch
   Actual: Transaction succeeded (should have failed)

╔════════════════════════════════════════════════════════════════╗
║                    TEST SUMMARY                                 ║
╚════════════════════════════════════════════════════════════════╝

   Total Duration: 12.45s
   Tests Passed: 22
   Tests Failed: 1
   Success Rate: 95.7%

   ⚠️  1 test(s) failed - review required
```

---

## Interpreting Results

### ✅ All Tests Pass

**Status:** Production ready for Phase 2

**Next Steps:**
1. Review test report
2. Commit changes
3. Proceed to Phase 2: ZK Integration

### ⚠️ Some Tests Fail

**Status:** Review required

**Action Items:**
1. Check test report for failure details
2. Review program logs
3. Fix issues in code
4. Re-run tests
5. Validate fixes

### ❌ Build Fails

**Status:** Critical issue

**Action Items:**
1. Check Rust compiler errors
2. Fix syntax/type errors
3. Verify dependencies
4. Re-build and test

---

## Test Environment

### Local Validator

Tests run on local Solana validator:
- Automatically started by `anchor test`
- Fresh state for each test run
- Fast iteration

### Devnet (Future)

For devnet testing:
```bash
# Configure for devnet
solana config set --url devnet

# Deploy
anchor deploy --provider.cluster devnet

# Run tests against devnet
anchor test --provider.cluster devnet
```

---

## Troubleshooting

### Issue: Tests timeout

**Symptoms:** Tests hang or timeout

**Solutions:**
- Check if validator is running
- Increase timeout in `Anchor.toml`
- Check network connectivity

### Issue: "Account not initialized"

**Symptoms:** Account initialization errors

**Solutions:**
- Ensure accounts initialized in correct order
- Check PDA derivations
- Verify sufficient SOL for rent

### Issue: "Insufficient funds"

**Symptoms:** Transaction fails with insufficient funds

**Solutions:**
- Airdrop more SOL to test accounts
- Check token minting succeeded
- Verify balances before operations

### Issue: "Transaction too large"

**Symptoms:** Transaction exceeds size limit

**Solutions:**
- Reduce number of operations per transaction
- Split into multiple transactions
- Optimize instruction data

### Issue: "Compute budget exceeded"

**Symptoms:** Transaction uses too many compute units

**Solutions:**
- Request more compute units
- Optimize code (reduce loops)
- Consider using multiple transactions

---

## Performance Benchmarks

### Expected Performance

| Metric | Target | Typical |
|--------|--------|---------|
| Test Suite Duration | < 30s | 15-20s |
| Single Test | < 2s | 0.5-1s |
| Order Placement | < 500ms | 200-300ms |
| Order Matching | < 1s | 400-600ms |
| Stress Test (50 orders) | < 10s | 5-7s |

### Compute Units

| Operation | Target | Typical |
|-----------|--------|---------|
| Initialize Market | < 5K | ~3K |
| Place Order | < 20K | ~15K |
| Match Order | < 50K | ~30-40K |
| Cancel Order | < 15K | ~10K |

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Production Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Install Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      
      - name: Install Solana
        run: |
          sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
          echo "$HOME/.local/share/solana/install/active_release/bin" >> $GITHUB_PATH
      
      - name: Install Anchor
        run: |
          cargo install --git https://github.com/coral-xyz/anchor anchor-cli
      
      - name: Run Tests
        run: |
          cd anomi-zk-prototype
          ./scripts/test-production.sh
      
      - name: Upload Test Reports
        uses: actions/upload-artifact@v2
        with:
          name: test-reports
          path: anomi-zk-prototype/test-reports/
```

---

## Contributing

When adding new tests:

1. Follow existing test structure
2. Add to appropriate category
3. Update test count in this README
4. Document expected behavior
5. Include pass criteria

### Test Template

```typescript
it("X.Y - Test description", async () => {
  console.log("\n   Test X.Y: Test name");
  
  // Setup
  const user = users[0];
  
  // Execute
  await program.methods
    .someInstruction(params)
    .accounts({ /* ... */ })
    .signers([user.keypair])
    .rpc();
  
  // Verify
  const account = await program.account.someAccount.fetch(pda);
  expect(account.someField).to.equal(expectedValue);
  
  console.log("   ✅ Test passed");
  console.log(`      Metric: ${account.someField}`);
  stats.passed++;
});
```

---

## Additional Resources

- **Workflow Status:** `workflow_ANOMI.md`
- **Manual Testing:** `docs/PRODUCTION_TESTING.md`
- **Component Isolation:** `docs/COMPONENT_ISOLATION_TESTING.md`
- **CritBit Implementation:** `docs/CRITBIT_IMPLEMENTATION.md`
- **Matching Engine:** `docs/MATCHING_ENGINE.md`

---

## Phase 1 Completion Criteria

Phase 1 is complete when:

- ✅ All automated tests pass (100%)
- ✅ Test automation scripts working
- ✅ Manual test guide complete
- ✅ Component isolation validated
- ✅ Test reports generated
- ✅ Zero critical issues
- ✅ Documentation complete

**Status:** ⏳ In Progress

Run `./scripts/test-production.sh` (or `.ps1`) to validate Phase 1 completion.

