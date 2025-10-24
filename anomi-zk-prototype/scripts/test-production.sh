#!/bin/bash
# ============================================================================
# ZK2P Protocol - Production Readiness Test Automation Script (Linux/WSL)
# ============================================================================
# 
# This script automates the complete testing workflow:
# 1. Build all Anchor programs
# 2. Run Rust unit tests
# 3. Start local validator
# 4. Deploy programs locally
# 5. Run integration tests
# 6. Generate test report
# 7. Cleanup
#
# Usage: ./scripts/test-production.sh
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Flags
SKIP_BUILD=false
SKIP_UNIT_TESTS=false
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-unit-tests)
            SKIP_UNIT_TESTS=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Helper functions
function print_success() {
    echo -e "${GREEN}$1${NC}"
}

function print_error() {
    echo -e "${RED}$1${NC}"
}

function print_info() {
    echo -e "${CYAN}$1${NC}"
}

function print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

function print_section() {
    echo ""
    echo -e "${MAGENTA}════════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA} $1${NC}"
    echo -e "${MAGENTA}════════════════════════════════════════════════════${NC}"
    echo ""
}

# Test results
BUILD_SUCCESS=false
UNIT_TESTS_PASSED=0
UNIT_TESTS_FAILED=0
INTEGRATION_TESTS_PASSED=0
INTEGRATION_TESTS_FAILED=0
PRODUCTION_TESTS_PASSED=0
PRODUCTION_TESTS_FAILED=0
ERRORS=()

START_TIME=$(date +%s)

# ============================================================================
# Step 1: Environment Check
# ============================================================================

print_section "Environment Check"

print_info "Checking required tools..."

# Check Rust
if command -v cargo &> /dev/null; then
    RUST_VERSION=$(cargo --version)
    print_success "✓ Rust/Cargo: $RUST_VERSION"
else
    print_error "✗ Rust/Cargo not found. Install from https://rustup.rs/"
    exit 1
fi

# Check Anchor
if command -v anchor &> /dev/null; then
    ANCHOR_VERSION=$(anchor --version)
    print_success "✓ Anchor CLI: $ANCHOR_VERSION"
else
    print_error "✗ Anchor CLI not found. Install: cargo install --git https://github.com/coral-xyz/anchor anchor-cli"
    exit 1
fi

# Check Solana
if command -v solana &> /dev/null; then
    SOLANA_VERSION=$(solana --version)
    print_success "✓ Solana CLI: $SOLANA_VERSION"
else
    print_error "✗ Solana CLI not found"
    exit 1
fi

# Check Node
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "✓ Node.js: $NODE_VERSION"
else
    print_error "✗ Node.js not found"
    exit 1
fi

# Navigate to project directory
if [ ! -d "anomi-zk-prototype" ]; then
    print_error "✗ anomi-zk-prototype directory not found. Run from project root."
    exit 1
fi

cd anomi-zk-prototype
print_success "✓ Working directory: $(pwd)"

# ============================================================================
# Step 2: Build Programs
# ============================================================================

if [ "$SKIP_BUILD" = false ]; then
    print_section "Building Anchor Programs"
    
    print_info "Running: anchor build"
    if anchor build; then
        print_success "✓ Build successful"
        BUILD_SUCCESS=true
        
        # Show program artifacts
        if [ -d "target/deploy" ]; then
            print_info "\nProgram artifacts:"
            ls -1 target/deploy/*.so | xargs -n1 basename
        fi
    else
        print_error "✗ Build failed"
        ERRORS+=("Build failed")
    fi
else
    print_warning "Skipping build (--skip-build flag)"
fi

# ============================================================================
# Step 3: Run Rust Unit Tests
# ============================================================================

if [ "$SKIP_UNIT_TESTS" = false ]; then
    print_section "Running Rust Unit Tests"
    
    declare -a UNIT_TESTS=(
        "order::tests:Order Tests:market"
        "order_book::tests:OrderBook Tests:market"
        "critbit::tests:CritBit Tests:market"
    )
    
    for test_spec in "${UNIT_TESTS[@]}"; do
        IFS=':' read -r lib name package <<< "$test_spec"
        print_info "Testing: $name"
        
        if output=$(cargo test --package "$package" --lib "$lib" 2>&1); then
            # Parse test results
            if [[ $output =~ ([0-9]+)\ passed ]]; then
                passed=${BASH_REMATCH[1]}
                UNIT_TESTS_PASSED=$((UNIT_TESTS_PASSED + passed))
                print_success "  ✓ $passed tests passed"
            fi
        else
            if [[ $output =~ ([0-9]+)\ failed ]]; then
                failed=${BASH_REMATCH[1]}
                UNIT_TESTS_FAILED=$((UNIT_TESTS_FAILED + failed))
                print_error "  ✗ $failed tests failed"
            fi
            ERRORS+=("$name failed")
        fi
        
        if [ "$VERBOSE" = true ]; then
            echo "$output"
        fi
    done
    
    print_info "\nUnit Test Summary:"
    print_success "  Passed: $UNIT_TESTS_PASSED"
    if [ $UNIT_TESTS_FAILED -gt 0 ]; then
        print_error "  Failed: $UNIT_TESTS_FAILED"
    fi
else
    print_warning "Skipping unit tests (--skip-unit-tests flag)"
fi

# ============================================================================
# Step 4: Run Integration Tests
# ============================================================================

print_section "Running Integration Tests"

print_info "Running: anchor test --skip-build"
if output=$(anchor test --skip-build 2>&1); then
    print_success "✓ Integration tests passed"
    
    if [[ $output =~ ([0-9]+)\ passing ]]; then
        INTEGRATION_TESTS_PASSED=${BASH_REMATCH[1]}
        print_info "  Tests passed: $INTEGRATION_TESTS_PASSED"
    fi
else
    print_error "✗ Integration tests failed"
    ERRORS+=("Integration tests failed")
    
    if [[ $output =~ ([0-9]+)\ failing ]]; then
        INTEGRATION_TESTS_FAILED=${BASH_REMATCH[1]}
    fi
fi

if [ "$VERBOSE" = true ]; then
    echo "$output"
fi

# ============================================================================
# Step 5: Run Production Readiness Tests
# ============================================================================

print_section "Running Production Readiness Test Suite"

print_info "Running: anchor test --skip-build tests/production-readiness.ts"
if output=$(anchor test --skip-build tests/production-readiness.ts 2>&1); then
    print_success "✓ Production readiness tests passed"
    
    if [[ $output =~ ([0-9]+)\ passing ]]; then
        PRODUCTION_TESTS_PASSED=${BASH_REMATCH[1]}
        print_info "  Tests passed: $PRODUCTION_TESTS_PASSED"
    fi
else
    print_error "✗ Production readiness tests failed"
    ERRORS+=("Production tests failed")
    
    if [[ $output =~ ([0-9]+)\ failing ]]; then
        PRODUCTION_TESTS_FAILED=${BASH_REMATCH[1]}
    fi
fi

if [ "$VERBOSE" = true ]; then
    echo "$output"
fi

# ============================================================================
# Step 6: Generate Test Report
# ============================================================================

print_section "Generating Test Report"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Create report directory
mkdir -p test-reports

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
REPORT_PATH="test-reports/production-test-report-$TIMESTAMP.md"

# Generate Markdown report
cat > "$REPORT_PATH" << EOF
# ZK2P Protocol - Production Readiness Test Report

**Date:** $(date +"%Y-%m-%d %H:%M:%S")  
**Duration:** ${DURATION}s  
**Environment:** $(hostname)

---

## Summary

| Metric | Value |
|--------|-------|
| Build Status | $([ "$BUILD_SUCCESS" = true ] && echo "✅ Success" || echo "❌ Failed") |
| Unit Tests Passed | $UNIT_TESTS_PASSED |
| Unit Tests Failed | $UNIT_TESTS_FAILED |
| Integration Tests Passed | $INTEGRATION_TESTS_PASSED |
| Integration Tests Failed | $INTEGRATION_TESTS_FAILED |
| Production Tests Passed | $PRODUCTION_TESTS_PASSED |
| Production Tests Failed | $PRODUCTION_TESTS_FAILED |

---

## Test Categories

### 1. Rust Unit Tests

**Status:** $([ $UNIT_TESTS_FAILED -eq 0 ] && echo "✅ All Passed" || echo "⚠️ Some Failed")

- Order Tests
- OrderBook Tests  
- CritBit Tree Tests

**Total:** $UNIT_TESTS_PASSED passed, $UNIT_TESTS_FAILED failed

### 2. Integration Tests

**Status:** $([ $INTEGRATION_TESTS_FAILED -eq 0 ] && echo "✅ All Passed" || echo "⚠️ Some Failed")

**Total:** $INTEGRATION_TESTS_PASSED passed, $INTEGRATION_TESTS_FAILED failed

### 3. Production Readiness Tests

**Status:** $([ $PRODUCTION_TESTS_FAILED -eq 0 ] && echo "✅ All Passed" || echo "⚠️ Some Failed")

Test categories covered:
1. Market & Account Initialization
2. OrderBook CritBit Operations
3. All 5 Order Types
4. Multi-Order Matching
5. Self-Trade Prevention
6. Cancel Order Functionality
7. Partial Fills & Edge Cases
8. Stress Test (50+ orders)
9. PDA Validation
10. Token Escrow Flows

**Total:** $PRODUCTION_TESTS_PASSED passed, $PRODUCTION_TESTS_FAILED failed

---

## Errors

$(if [ ${#ERRORS[@]} -eq 0 ]; then
    echo "None"
else
    for error in "${ERRORS[@]}"; do
        echo "- $error"
    done
fi)

---

## Production Readiness Assessment

$(if [ "$BUILD_SUCCESS" = true ] && [ $UNIT_TESTS_FAILED -eq 0 ] && [ $INTEGRATION_TESTS_FAILED -eq 0 ] && [ $PRODUCTION_TESTS_FAILED -eq 0 ]; then
    echo "✅ **SYSTEM IS PRODUCTION READY**

All tests passed. The matching engine is validated for production deployment."
else
    echo "⚠️ **REVIEW REQUIRED**

Some tests failed. Review errors and fix issues before production deployment."
fi)

---

## Next Steps

- [ ] Review test results
- [ ] Fix any failing tests
- [ ] Run manual verification (see docs/PRODUCTION_TESTING.md)
- [ ] Proceed to Phase 2: ZK Integration
- [ ] Deploy to devnet for Phase 3 testing

---

*Generated by test-production.sh*
EOF

print_success "✓ Report generated: $REPORT_PATH"

# ============================================================================
# Step 7: Display Final Results
# ============================================================================

print_section "Test Results Summary"

echo "Duration: ${DURATION}s"
echo ""

if [ "$BUILD_SUCCESS" = true ]; then
    print_success "✓ Build: Success"
else
    print_error "✗ Build: Failed"
fi

echo ""
echo "Test Results:"
print_success "  ✓ Unit Tests Passed: $UNIT_TESTS_PASSED"
[ $UNIT_TESTS_FAILED -gt 0 ] && print_error "  ✗ Unit Tests Failed: $UNIT_TESTS_FAILED"

print_success "  ✓ Integration Tests Passed: $INTEGRATION_TESTS_PASSED"
[ $INTEGRATION_TESTS_FAILED -gt 0 ] && print_error "  ✗ Integration Tests Failed: $INTEGRATION_TESTS_FAILED"

print_success "  ✓ Production Tests Passed: $PRODUCTION_TESTS_PASSED"
[ $PRODUCTION_TESTS_FAILED -gt 0 ] && print_error "  ✗ Production Tests Failed: $PRODUCTION_TESTS_FAILED"

echo ""

TOTAL_TESTS=$((UNIT_TESTS_PASSED + INTEGRATION_TESTS_PASSED + PRODUCTION_TESTS_PASSED))
TOTAL_FAILED=$((UNIT_TESTS_FAILED + INTEGRATION_TESTS_FAILED + PRODUCTION_TESTS_FAILED))

if [ $TOTAL_FAILED -eq 0 ] && [ "$BUILD_SUCCESS" = true ]; then
    print_section "🎉 ALL TESTS PASSED - PRODUCTION READY!"
    print_success "Total: $TOTAL_TESTS tests passed"
    echo ""
    print_info "Next steps:"
    echo "  1. Review test report: $REPORT_PATH"
    echo "  2. Run manual verification (docs/PRODUCTION_TESTING.md)"
    echo "  3. Proceed to Phase 2: ZK Integration"
    exit 0
else
    print_section "⚠️  REVIEW REQUIRED"
    print_error "Total: $TOTAL_FAILED test(s) failed"
    echo ""
    print_warning "Action items:"
    echo "  1. Review test report: $REPORT_PATH"
    echo "  2. Fix failing tests"
    echo "  3. Re-run: ./scripts/test-production.sh"
    exit 1
fi

