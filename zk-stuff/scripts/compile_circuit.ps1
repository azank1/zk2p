# Compile Circuit and Generate Keys
# PowerShell version for Windows

Write-Host "========================================"
Write-Host "ZK Circuit Compilation Script"
Write-Host "========================================`n"

# Step 1: Compile circuit
Write-Host "Step 1: Compiling circuit..."
circom2 ../src/circuit.circom --r1cs --wasm -l ../node_modules
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Circuit compilation failed"
    exit 1
}
Write-Host "✅ Circuit compiled successfully`n"

# Step 2: Check for ptau file (try power 13 first, then 12)
$ptauFile = $null
if (Test-Path "powersOfTau28_hez_final_13.ptau") {
    $ptauFile = "powersOfTau28_hez_final_13.ptau"
} elseif (Test-Path "powersOfTau28_hez_final_12.ptau") {
    $ptauFile = "powersOfTau28_hez_final_12.ptau"
}

if (-not $ptauFile) {
    Write-Host "⚠️  Powers of Tau file not found!"
    Write-Host "`nOptions:"
    Write-Host "1. Generate locally (recommended for testing):"
    Write-Host "   .\generate-ptau.ps1"
    Write-Host "   (This will create power 13 ptau file for larger circuits)`n"
    Write-Host "2. Download from official source (~500MB):"
    Write-Host "   https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_13.ptau"
    Write-Host "   Save to: zk-stuff/powersOfTau28_hez_final_13.ptau`n"
    Write-Host "After obtaining the ptau file, run this script again.`n"
    exit 0
}

# Step 3: Generate proving key
Write-Host "Step 2: Generating proving key using $ptauFile..."
Write-Host "This may take several minutes..."
snarkjs groth16 setup circuit.r1cs $ptauFile circuit_final.zkey -v
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to generate proving key"
    exit 1
}
Write-Host "✅ Proving key generated successfully`n"

# Step 4: Export verification key
Write-Host "Step 3: Exporting verification key..."
snarkjs zkey export verificationkey circuit_final.zkey verification_key.json

# Return to scripts directory
Pop-Location
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to export verification key"
    exit 1
}
Write-Host "✅ Verification key exported successfully`n"

Write-Host "========================================"
Write-Host "✅ ZK Setup Complete!"
Write-Host "========================================`n"
Write-Host "Generated files:"
Write-Host "  - circuit.r1cs"
Write-Host "  - circuit_js/circuit.wasm"
Write-Host "  - circuit_final.zkey"
Write-Host "  - verification_key.json`n"
Write-Host "Next: Test proof generation"
Write-Host "  node test-email-verification.js`n"

