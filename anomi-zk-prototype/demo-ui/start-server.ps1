# Start Demo UI Server
# Run this script from anywhere to start the demo UI

Write-Host "Starting ZK2P Demo UI Server..." -ForegroundColor Green
Write-Host ""

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Change to demo-ui directory
Set-Location $scriptDir

Write-Host "Server directory: $scriptDir" -ForegroundColor Cyan
Write-Host "Starting HTTP server on http://127.0.0.1:8080" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start Python HTTP server
python -m http.server 8080 --bind 127.0.0.1

