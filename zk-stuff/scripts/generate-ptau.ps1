# Generate Powers of Tau file for testing
# This creates a smaller ptau file suitable for development/testing

Write-Host "========================================"
Write-Host "Generating Powers of Tau File"
Write-Host "========================================`n"

Write-Host "Step 1: Creating initial ptau file (power 13 for larger circuits)..."
Write-Host "This may take a few minutes..."
snarkjs powersoftau new bn128 13 pot13_0000.ptau -v
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to create initial ptau file"
    exit 1
}

Write-Host "`nStep 2: First contribution..."
snarkjs powersoftau contribute pot13_0000.ptau pot13_0001.ptau --name="First contribution" -v
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed first contribution"
    exit 1
}

Write-Host "`nStep 3: Second contribution..."
snarkjs powersoftau contribute pot13_0001.ptau pot13_0002.ptau --name="Second contribution" -v
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed second contribution"
    exit 1
}

Write-Host "`nStep 4: Applying beacon..."
snarkjs powersoftau beacon pot13_0002.ptau pot13_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon" -v
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed beacon"
    exit 1
}

Write-Host "`nStep 5: Preparing phase 2..."
snarkjs powersoftau prepare phase2 pot13_beacon.ptau powersOfTau28_hez_final_13.ptau -v
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed phase 2 preparation"
    exit 1
}

Write-Host "`nStep 6: Cleaning up intermediate files..."
Remove-Item pot13_*.ptau -ErrorAction SilentlyContinue

Write-Host "`n========================================"
Write-Host "✅ Powers of Tau file generated successfully!"
Write-Host "========================================`n"
Write-Host "File: powersOfTau28_hez_final_13.ptau"
Write-Host "`nNext: Generate proving key with:"
Write-Host "  snarkjs groth16 setup circuit.r1cs powersOfTau28_hez_final_13.ptau circuit_final.zkey`n"

