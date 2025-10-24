# Deploy ZK2P Programs to Solana Devnet (PowerShell)

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "ZK2P Devnet Deployment Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Configure Solana for devnet
Write-Host "[1/5] Configuring Solana CLI for devnet..." -ForegroundColor Cyan
solana config set --url devnet
Write-Host ""

# Step 2: Check balance and airdrop if needed
Write-Host "[2/5] Checking SOL balance..." -ForegroundColor Cyan
$balance = (solana balance) -replace " SOL", "" -as [decimal]
Write-Host "Current balance: $balance SOL"

if ($balance -lt 2) {
    Write-Host "Requesting airdrop..." -ForegroundColor Yellow
    solana airdrop 2
    Start-Sleep -Seconds 5
}
Write-Host ""

# Step 3: Build programs
Write-Host "[3/5] Building Anchor programs..." -ForegroundColor Cyan
anchor build
Write-Host "✓ Build complete" -ForegroundColor Green
Write-Host ""

# Step 4: Deploy programs
Write-Host "[4/5] Deploying to devnet..." -ForegroundColor Cyan
anchor deploy --provider.cluster devnet

# Get program IDs
$MARKET_PROGRAM = solana address -k target/deploy/market-keypair.json
$ORDER_STORE_PROGRAM = solana address -k target/deploy/order_store-keypair.json
$ORDER_PROCESSOR_PROGRAM = solana address -k target/deploy/order_processor-keypair.json

Write-Host ""
Write-Host "✓ Deployment complete!" -ForegroundColor Green
Write-Host ""

# Step 5: Save configuration
Write-Host "[5/5] Saving deployment configuration..." -ForegroundColor Cyan

$config = @{
    network = "devnet"
    programs = @{
        market = $MARKET_PROGRAM
        order_store = $ORDER_STORE_PROGRAM
        order_processor = $ORDER_PROCESSOR_PROGRAM
    }
    deployed_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json -Depth 10

$config | Out-File -FilePath "scripts/devnet-config.json" -Encoding UTF8
Write-Host "✓ Configuration saved to scripts/devnet-config.json" -ForegroundColor Green
Write-Host ""

# Display summary
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Deployment Summary" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Network: Devnet"
Write-Host "Market Program:         $MARKET_PROGRAM"
Write-Host "OrderStore Program:     $ORDER_STORE_PROGRAM"
Write-Host "OrderProcessor Program: $ORDER_PROCESSOR_PROGRAM"
Write-Host ""
Write-Host "View on Explorer:"
Write-Host "https://explorer.solana.com/address/$MARKET_PROGRAM?cluster=devnet"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "1. Create test token"
Write-Host "2. Initialize market"
Write-Host "3. Update UI config"
Write-Host ""

