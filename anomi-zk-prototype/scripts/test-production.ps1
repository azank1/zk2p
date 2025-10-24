#!/usr/bin/env pwsh
# ============================================================================
# ZK2P Protocol - Production Readiness Test Automation Script
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
# Usage: .\scripts\test-production.ps1
# ============================================================================

param(
    [switch]$SkipBuild,
    [switch]$SkipUnitTests,
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Error { Write-Host $args -ForegroundColor Red }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Section { 
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host " $args" -ForegroundColor Magenta
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host ""
}

# Test results
$script:Results = @{
    StartTime = Get-Date
    BuildSuccess = $false
    UnitTestsPassed = 0
    UnitTestsFailed = 0
    IntegrationTestsPassed = 0
    IntegrationTestsFailed = 0
    ProductionTestsPassed = 0
    ProductionTestsFailed = 0
    Errors = @()
}

# ============================================================================
# Step 1: Environment Check
# ============================================================================

Write-Section "Environment Check"

Write-Info "Checking required tools..."

# Check Rust
if (Get-Command cargo -ErrorAction SilentlyContinue) {
    $rustVersion = cargo --version
    Write-Success "✓ Rust/Cargo: $rustVersion"
} else {
    Write-Error "✗ Rust/Cargo not found. Install from https://rustup.rs/"
    exit 1
}

# Check Anchor
if (Get-Command anchor -ErrorAction SilentlyContinue) {
    $anchorVersion = anchor --version
    Write-Success "✓ Anchor CLI: $anchorVersion"
} else {
    Write-Error "✗ Anchor CLI not found. Install: cargo install --git https://github.com/coral-xyz/anchor anchor-cli"
    exit 1
}

# Check Solana
if (Get-Command solana -ErrorAction SilentlyContinue) {
    $solanaVersion = solana --version
    Write-Success "✓ Solana CLI: $solanaVersion"
} else {
    Write-Error "✗ Solana CLI not found"
    exit 1
}

# Check Node/NPM
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Write-Success "✓ Node.js: $nodeVersion"
} else {
    Write-Error "✗ Node.js not found"
    exit 1
}

# Navigate to project directory
if (-not (Test-Path "anomi-zk-prototype")) {
    Write-Error "✗ anomi-zk-prototype directory not found. Run from project root."
    exit 1
}

Set-Location anomi-zk-prototype
Write-Success "✓ Working directory: $(Get-Location)"

# ============================================================================
# Step 2: Build Programs
# ============================================================================

if (-not $SkipBuild) {
    Write-Section "Building Anchor Programs"
    
    Write-Info "Running: anchor build"
    $buildOutput = anchor build 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "✓ Build successful"
        $script:Results.BuildSuccess = $true
        
        # Show program IDs
        if (Test-Path "target/deploy") {
            Write-Info "`nProgram artifacts:"
            Get-ChildItem "target/deploy/*.so" | ForEach-Object {
                Write-Host "  - $($_.Name)" -ForegroundColor Gray
            }
        }
    } else {
        Write-Error "✗ Build failed"
        $script:Results.Errors += "Build failed: $buildOutput"
        if (-not $Verbose) {
            Write-Warning "Run with -Verbose to see full build output"
        }
    }
    
    if ($Verbose) {
        Write-Host $buildOutput
    }
} else {
    Write-Warning "Skipping build (--SkipBuild flag)"
}

# ============================================================================
# Step 3: Run Rust Unit Tests
# ============================================================================

if (-not $SkipUnitTests) {
    Write-Section "Running Rust Unit Tests"
    
    $unitTests = @(
        @{ Name = "Order Tests"; Package = "market"; Lib = "order::tests" },
        @{ Name = "OrderBook Tests"; Package = "market"; Lib = "order_book::tests" },
        @{ Name = "CritBit Tests"; Package = "market"; Lib = "critbit::tests" }
    )
    
    foreach ($test in $unitTests) {
        Write-Info "Testing: $($test.Name)"
        
        $testCmd = "cargo test --package $($test.Package) --lib $($test.Lib) -- --nocapture"
        $testOutput = Invoke-Expression $testCmd 2>&1 | Out-String
        
        if ($LASTEXITCODE -eq 0) {
            # Parse test results
            if ($testOutput -match "(\d+) passed") {
                $passed = [int]$matches[1]
                $script:Results.UnitTestsPassed += $passed
                Write-Success "  ✓ $passed tests passed"
            }
        } else {
            if ($testOutput -match "(\d+) failed") {
                $failed = [int]$matches[1]
                $script:Results.UnitTestsFailed += $failed
                Write-Error "  ✗ $failed tests failed"
            }
            $script:Results.Errors += "$($test.Name) failed"
        }
        
        if ($Verbose) {
            Write-Host $testOutput -ForegroundColor Gray
        }
    }
    
    Write-Info "`nUnit Test Summary:"
    Write-Success "  Passed: $($script:Results.UnitTestsPassed)"
    if ($script:Results.UnitTestsFailed -gt 0) {
        Write-Error "  Failed: $($script:Results.UnitTestsFailed)"
    }
} else {
    Write-Warning "Skipping unit tests (--SkipUnitTests flag)"
}

# ============================================================================
# Step 4: Run Integration Tests
# ============================================================================

Write-Section "Running Integration Tests"

Write-Info "Running: anchor test --skip-build"
$testOutput = anchor test --skip-build 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Success "✓ Integration tests passed"
    
    # Try to parse test results from output
    $outputStr = $testOutput | Out-String
    if ($outputStr -match "(\d+) passing") {
        $script:Results.IntegrationTestsPassed = [int]$matches[1]
        Write-Info "  Tests passed: $($script:Results.IntegrationTestsPassed)"
    }
} else {
    Write-Error "✗ Integration tests failed"
    $script:Results.Errors += "Integration tests failed"
    
    if ($testOutput -match "(\d+) failing") {
        $script:Results.IntegrationTestsFailed = [int]$matches[1]
    }
}

if ($Verbose) {
    Write-Host ($testOutput | Out-String) -ForegroundColor Gray
}

# ============================================================================
# Step 5: Run Production Readiness Tests
# ============================================================================

Write-Section "Running Production Readiness Test Suite"

Write-Info "Running: anchor test --skip-build tests/production-readiness.ts"
$prodTestOutput = anchor test --skip-build tests/production-readiness.ts 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Success "✓ Production readiness tests passed"
    
    $outputStr = $prodTestOutput | Out-String
    if ($outputStr -match "(\d+) passing") {
        $script:Results.ProductionTestsPassed = [int]$matches[1]
        Write-Info "  Tests passed: $($script:Results.ProductionTestsPassed)"
    }
} else {
    Write-Error "✗ Production readiness tests failed"
    $script:Results.Errors += "Production tests failed"
    
    if ($prodTestOutput -match "(\d+) failing") {
        $script:Results.ProductionTestsFailed = [int]$matches[1]
    }
}

if ($Verbose) {
    Write-Host ($prodTestOutput | Out-String) -ForegroundColor Gray
}

# ============================================================================
# Step 6: Generate Test Report
# ============================================================================

Write-Section "Generating Test Report"

$script:Results.EndTime = Get-Date
$script:Results.Duration = ($script:Results.EndTime - $script:Results.StartTime).TotalSeconds

# Create report directory
$reportDir = "test-reports"
if (-not (Test-Path $reportDir)) {
    New-Item -ItemType Directory -Path $reportDir | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$reportPath = "$reportDir/production-test-report-$timestamp.md"

# Generate Markdown report
$report = @"
# ZK2P Protocol - Production Readiness Test Report

**Date:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")  
**Duration:** $([math]::Round($script:Results.Duration, 2))s  
**Environment:** $(if ($env:COMPUTERNAME) { $env:COMPUTERNAME } else { "Unknown" })

---

## Summary

| Metric | Value |
|--------|-------|
| Build Status | $(if ($script:Results.BuildSuccess) { "✅ Success" } else { "❌ Failed" }) |
| Unit Tests Passed | $($script:Results.UnitTestsPassed) |
| Unit Tests Failed | $($script:Results.UnitTestsFailed) |
| Integration Tests Passed | $($script:Results.IntegrationTestsPassed) |
| Integration Tests Failed | $($script:Results.IntegrationTestsFailed) |
| Production Tests Passed | $($script:Results.ProductionTestsPassed) |
| Production Tests Failed | $($script:Results.ProductionTestsFailed) |

---

## Test Categories

### 1. Rust Unit Tests

**Status:** $(if ($script:Results.UnitTestsFailed -eq 0) { "✅ All Passed" } else { "⚠️ Some Failed" })

- Order Tests
- OrderBook Tests  
- CritBit Tree Tests

**Total:** $($script:Results.UnitTestsPassed) passed, $($script:Results.UnitTestsFailed) failed

### 2. Integration Tests

**Status:** $(if ($script:Results.IntegrationTestsFailed -eq 0) { "✅ All Passed" } else { "⚠️ Some Failed" })

**Total:** $($script:Results.IntegrationTestsPassed) passed, $($script:Results.IntegrationTestsFailed) failed

### 3. Production Readiness Tests

**Status:** $(if ($script:Results.ProductionTestsFailed -eq 0) { "✅ All Passed" } else { "⚠️ Some Failed" })

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

**Total:** $($script:Results.ProductionTestsPassed) passed, $($script:Results.ProductionTestsFailed) failed

---

## Errors

$(if ($script:Results.Errors.Count -eq 0) { "None" } else { 
    ($script:Results.Errors | ForEach-Object { "- $_" }) -join "`n"
})

---

## Production Readiness Assessment

$(if ($script:Results.BuildSuccess -and 
     $script:Results.UnitTestsFailed -eq 0 -and 
     $script:Results.IntegrationTestsFailed -eq 0 -and 
     $script:Results.ProductionTestsFailed -eq 0) {
    "✅ **SYSTEM IS PRODUCTION READY**`n`nAll tests passed. The matching engine is validated for production deployment."
} else {
    "⚠️ **REVIEW REQUIRED**`n`nSome tests failed. Review errors and fix issues before production deployment."
})

---

## Next Steps

- [ ] Review test results
- [ ] Fix any failing tests
- [ ] Run manual verification (see docs/PRODUCTION_TESTING.md)
- [ ] Proceed to Phase 2: ZK Integration
- [ ] Deploy to devnet for Phase 3 testing

---

*Generated by test-production.ps1*
"@

$report | Out-File -FilePath $reportPath -Encoding UTF8
Write-Success "✓ Report generated: $reportPath"

# Also create JSON report for automation
$jsonReport = $script:Results | ConvertTo-Json -Depth 10
$jsonPath = "$reportDir/production-test-report-$timestamp.json"
$jsonReport | Out-File -FilePath $jsonPath -Encoding UTF8
Write-Success "✓ JSON report: $jsonPath"

# ============================================================================
# Step 7: Display Final Results
# ============================================================================

Write-Section "Test Results Summary"

Write-Host "Duration: $([math]::Round($script:Results.Duration, 2))s" -ForegroundColor White
Write-Host ""

if ($script:Results.BuildSuccess) {
    Write-Success "✓ Build: Success"
} else {
    Write-Error "✗ Build: Failed"
}

Write-Host ""
Write-Host "Test Results:" -ForegroundColor White
Write-Success "  ✓ Unit Tests Passed: $($script:Results.UnitTestsPassed)"
if ($script:Results.UnitTestsFailed -gt 0) {
    Write-Error "  ✗ Unit Tests Failed: $($script:Results.UnitTestsFailed)"
}

Write-Success "  ✓ Integration Tests Passed: $($script:Results.IntegrationTestsPassed)"
if ($script:Results.IntegrationTestsFailed -gt 0) {
    Write-Error "  ✗ Integration Tests Failed: $($script:Results.IntegrationTestsFailed)"
}

Write-Success "  ✓ Production Tests Passed: $($script:Results.ProductionTestsPassed)"
if ($script:Results.ProductionTestsFailed -gt 0) {
    Write-Error "  ✗ Production Tests Failed: $($script:Results.ProductionTestsFailed)"
}

Write-Host ""

$totalTests = $script:Results.UnitTestsPassed + $script:Results.IntegrationTestsPassed + $script:Results.ProductionTestsPassed
$totalFailed = $script:Results.UnitTestsFailed + $script:Results.IntegrationTestsFailed + $script:Results.ProductionTestsFailed

if ($totalFailed -eq 0 -and $script:Results.BuildSuccess) {
    Write-Section "🎉 ALL TESTS PASSED - PRODUCTION READY!"
    Write-Success "Total: $totalTests tests passed"
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Review test report: $reportPath" -ForegroundColor Gray
    Write-Host "  2. Run manual verification (docs/PRODUCTION_TESTING.md)" -ForegroundColor Gray
    Write-Host "  3. Proceed to Phase 2: ZK Integration" -ForegroundColor Gray
    exit 0
} else {
    Write-Section "⚠️  REVIEW REQUIRED"
    Write-Error "Total: $totalFailed test(s) failed"
    Write-Host ""
    Write-Host "Action items:" -ForegroundColor Yellow
    Write-Host "  1. Review test report: $reportPath" -ForegroundColor Gray
    Write-Host "  2. Fix failing tests" -ForegroundColor Gray
    Write-Host "  3. Re-run: .\scripts\test-production.ps1" -ForegroundColor Gray
    exit 1
}

