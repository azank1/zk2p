# Testing Guide

## Quick Start

### Run All Tests

```bash
cd anomi-zk-prototype

# Automated test suite
.\scripts\test-production.ps1    # Windows
./scripts/test-production.sh     # Linux/WSL

# Or run directly
anchor test
```

---

## Test Categories

### Unit Tests (Rust)

**Location:** Within program source files

```bash
# All unit tests
cargo test --package market --lib

# Specific components
cargo test --package market --lib order::tests
cargo test --package market --lib order_book::tests
cargo test --package market --lib critbit::tests
```

**Coverage:**
- Order structure and lifecycle (4 tests)
- OrderBook operations (3 tests)
- CritBit tree operations (3 tests)

**Total:** 10 unit tests

### Integration Tests (TypeScript)

**Location:** `tests/` directory

```bash
# All integration tests
anchor test

# Specific test file
anchor test tests/phase2-orderbook.ts
anchor test tests/production-readiness.ts
```

**Test Files:**
- `phase2-orderbook.ts` - OrderBook integration (6 tests)
- `production-readiness.ts` - Production scenarios (23 tests)
- `escrow.ts` - Token flows (3 tests)

**Total:** 32 integration tests

---

## Production Readiness Tests

Comprehensive validation across 10 categories:

1. Market & Account Initialization
2. OrderBook CritBit Operations
3. All 5 Order Types (Limit, Market, Post-Only, IOC, FOK)
4. Multi-Order Matching
5. Self-Trade Prevention
6. Cancel Order Functionality
7. Partial Fills & Edge Cases
8. Stress Test (50+ orders)
9. PDA Validation
10. Token Escrow Flows

**Run:**
```bash
anchor test tests/production-readiness.ts
```

---

## Test Automation

### Automated Scripts

**Windows:**
```powershell
.\scripts\test-production.ps1

# Options
-SkipBuild         # Skip anchor build
-SkipUnitTests     # Skip Rust unit tests
-Verbose           # Show detailed output
```

**Linux/WSL:**
```bash
./scripts/test-production.sh

# Options
--skip-build       # Skip anchor build
--skip-unit-tests  # Skip Rust unit tests
--verbose          # Show detailed output
```

### Test Reports

Reports generated in `test-reports/`:
- `production-test-report-{timestamp}.md` - Markdown report
- `production-test-report-{timestamp}.json` - JSON data

---

## Component Isolation Testing

Test components independently before integration.

### CritBit Tree

```bash
cargo test --package market --lib critbit::tests -- --nocapture
```

**What's Tested:**
- Insert operations
- Remove operations
- Find operations
- Min/max queries
- Tree rebalancing

### Order Structure

```bash
cargo test --package market --lib order::tests -- --nocapture
```

**What's Tested:**
- Order creation
- Unique ID generation
- Partial fills
- FIFO queue operations

### OrderBook

```bash
cargo test --package market --lib order_book::tests -- --nocapture
```

**What's Tested:**
- Order insertion
- Order removal
- Best price queries
- Tree integration

---

## Manual Testing

For manual verification of critical paths:

### Setup Local Validator

```bash
# Terminal 1: Start validator
solana-test-validator

# Terminal 2: Deploy and test
cd anomi-zk-prototype
anchor build
anchor deploy
```

### Test Scenarios

**1. Place Ask Order**
```bash
# Create test accounts, mint tokens
# Call place_limit_order_v2
# Verify tokens escrowed
# Check order in book
```

**2. Match Orders**
```bash
# Place multiple asks at different prices
# Place bid order
# Verify matching occurs
# Check token transfers
```

**3. Cancel Order**
```bash
# Place order
# Cancel order
# Verify tokens returned
# Check order removed
```

---

## Test Environment

### Local Validator

- Fresh state per test run
- Fast iteration
- Automatic cleanup

### Devnet (Future)

```bash
# Configure
solana config set --url devnet

# Deploy
anchor deploy --provider.cluster devnet

# Test
anchor test --provider.cluster devnet
```

---

## Troubleshooting

### Tests Timeout

**Solution:** Check validator is running, increase timeout in Anchor.toml

### Account Not Initialized

**Solution:** Run initialization instructions in correct order

### Insufficient Funds

**Solution:** Airdrop more SOL to test accounts

### Build Fails

**Solution:**
```bash
cargo clean
anchor clean
anchor build
```

---

## Performance Benchmarks

### Expected Performance

| Operation | Target | Typical |
|-----------|--------|---------|
| Order Placement | < 500ms | 200-300ms |
| Order Matching | < 1s | 400-600ms |
| Test Suite | < 30s | 15-20s |

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
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install Dependencies
        run: |
          # Install Rust, Solana, Anchor
      - name: Run Tests
        run: |
          cd anomi-zk-prototype
          ./scripts/test-production.sh
```

---

## Test Coverage Summary

| Category | Tests | Status |
|----------|-------|--------|
| Unit Tests (Rust) | 10 | Passing |
| Integration Tests | 32 | Passing |
| **Total** | **42** | **Passing** |

---

**Last Updated:** December 2024  
**For detailed test procedures, see:** `tests/README_PRODUCTION_TESTS.md`

