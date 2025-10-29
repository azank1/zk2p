# Create Test SPL Token on Devnet (PowerShell)

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Create Test SPL Token" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Configure devnet
solana config set --url devnet

# Create token
Write-Host "Creating SPL token (6 decimals)..." -ForegroundColor Cyan
$output = spl-token create-token --decimals 6 2>&1 | Out-String
$TOKEN_MINT = ($output | Select-String -Pattern "Creating token (\w+)" | ForEach-Object { $_.Matches.Groups[1].Value })

if (-not $TOKEN_MINT) {
    Write-Host "Error: Failed to create token" -ForegroundColor Red
    Write-Host "Output: $output" -ForegroundColor Gray
    exit 1
}

Write-Host "✓ Token created: $TOKEN_MINT" -ForegroundColor Green
Write-Host ""

# Create token account
Write-Host "Creating token account..." -ForegroundColor Cyan
spl-token create-account $TOKEN_MINT

Write-Host ""
Write-Host "Minting 100,000 test tokens..." -ForegroundColor Cyan
spl-token mint $TOKEN_MINT 100000

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Token Setup Complete!" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Token Mint: $TOKEN_MINT"
Write-Host ""
Write-Host "View on Explorer:"
Write-Host "https://explorer.solana.com/address/$TOKEN_MINT?cluster=devnet"
Write-Host ""
Write-Host "Next step:" -ForegroundColor Green
Write-Host "  ts-node scripts/init-devnet.ts $TOKEN_MINT"
Write-Host ""

# Save token mint
$TOKEN_MINT | Out-File -FilePath "scripts/test-token-mint.txt" -Encoding ASCII -NoNewline
Write-Host "✓ Token mint saved to scripts/test-token-mint.txt" -ForegroundColor Green

