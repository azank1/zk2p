# Check ZK2P Development Dependencies

Write-Host "================================" -ForegroundColor Cyan
Write-Host "ZK2P Dependency Check" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check Git
Write-Host "Checking Git..." -NoNewline
if (Get-Command git -ErrorAction SilentlyContinue) {
    $version = git --version
    Write-Host " OK" -ForegroundColor Green
    Write-Host "  $version" -ForegroundColor Gray
} else {
    Write-Host " MISSING" -ForegroundColor Red
    Write-Host "  Install from: https://git-scm.com/" -ForegroundColor Yellow
    $allGood = $false
}

# Check Node.js
Write-Host "Checking Node.js..." -NoNewline
if (Get-Command node -ErrorAction SilentlyContinue) {
    $version = node --version
    Write-Host " OK" -ForegroundColor Green
    Write-Host "  $version" -ForegroundColor Gray
} else {
    Write-Host " MISSING" -ForegroundColor Red
    Write-Host "  Install from: https://nodejs.org/" -ForegroundColor Yellow
    $allGood = $false
}

# Check Yarn
Write-Host "Checking Yarn..." -NoNewline
if (Get-Command yarn -ErrorAction SilentlyContinue) {
    $version = yarn --version
    Write-Host " OK" -ForegroundColor Green
    Write-Host "  $version" -ForegroundColor Gray
} else {
    Write-Host " MISSING" -ForegroundColor Red
    Write-Host "  Install: npm install -g yarn" -ForegroundColor Yellow
    $allGood = $false
}

# Check Rust
Write-Host "Checking Rust..." -NoNewline
if (Get-Command cargo -ErrorAction SilentlyContinue) {
    $version = cargo --version
    Write-Host " OK" -ForegroundColor Green
    Write-Host "  $version" -ForegroundColor Gray
} else {
    Write-Host " MISSING" -ForegroundColor Red
    Write-Host "  Install from: https://rustup.rs/" -ForegroundColor Yellow
    $allGood = $false
}

# Check Solana
Write-Host "Checking Solana CLI..." -NoNewline
if (Get-Command solana -ErrorAction SilentlyContinue) {
    $version = solana --version
    Write-Host " OK" -ForegroundColor Green
    Write-Host "  $version" -ForegroundColor Gray
} else {
    Write-Host " MISSING" -ForegroundColor Red
    Write-Host "  Install: See SETUP_GUIDE.md" -ForegroundColor Yellow
    Write-Host "  Recommended: Use WSL for Windows" -ForegroundColor Yellow
    $allGood = $false
}

# Check Anchor
Write-Host "Checking Anchor CLI..." -NoNewline
if (Get-Command anchor -ErrorAction SilentlyContinue) {
    $version = anchor --version
    Write-Host " OK" -ForegroundColor Green
    Write-Host "  $version" -ForegroundColor Gray
} else {
    Write-Host " MISSING" -ForegroundColor Red
    Write-Host "  Install: cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked" -ForegroundColor Yellow
    $allGood = $false
}

# Check Python
Write-Host "Checking Python..." -NoNewline
if (Get-Command python -ErrorAction SilentlyContinue) {
    $version = python --version
    Write-Host " OK" -ForegroundColor Green
    Write-Host "  $version" -ForegroundColor Gray
} else {
    Write-Host " MISSING" -ForegroundColor Red
    Write-Host "  Install from: https://www.python.org/" -ForegroundColor Yellow
    $allGood = $false
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan

if ($allGood) {
    Write-Host "All dependencies installed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now:" -ForegroundColor Cyan
    Write-Host "  anchor build" -ForegroundColor Gray
    Write-Host "  anchor test" -ForegroundColor Gray
    Write-Host "  .\scripts\deploy-devnet.ps1" -ForegroundColor Gray
} else {
    Write-Host "Some dependencies are missing" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "See SETUP_GUIDE.md for installation instructions" -ForegroundColor Cyan
}

Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

