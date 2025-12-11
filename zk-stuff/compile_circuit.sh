#!/bin/bash

# Compile Circuit and Generate Keys
# Bash version for Linux/Mac

echo "========================================"
echo "ZK Circuit Compilation Script"
echo "========================================"
echo ""

# Step 1: Compile circuit
echo "Step 1: Compiling circuit..."
circom2 circuit.circom --r1cs --wasm -l node_modules
if [ $? -ne 0 ]; then
    echo "Error: Circuit compilation failed"
    exit 1
fi
echo "✅ Circuit compiled successfully"
echo ""

# Step 2: Check for ptau file (try power 13 first, then 12)
PTAU_FILE=""
if [ -f "powersOfTau28_hez_final_13.ptau" ]; then
    PTAU_FILE="powersOfTau28_hez_final_13.ptau"
elif [ -f "powersOfTau28_hez_final_12.ptau" ]; then
    PTAU_FILE="powersOfTau28_hez_final_12.ptau"
fi

if [ -z "$PTAU_FILE" ]; then
    echo "⚠️  Powers of Tau file not found!"
    echo ""
    echo "Options:"
    echo "1. Download from official source (~500MB):"
    echo "   wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_13.ptau"
    echo ""
    echo "2. Generate locally (for testing):"
    echo "   Use generate-ptau.ps1 (Windows) or equivalent"
    echo ""
    echo "After obtaining the ptau file, run this script again."
    echo ""
    exit 0
fi

# Step 3: Generate proving key
echo "Step 2: Generating proving key using $PTAU_FILE..."
echo "This may take several minutes..."
snarkjs groth16 setup circuit.r1cs $PTAU_FILE circuit_final.zkey -v
if [ $? -ne 0 ]; then
    echo "Error: Failed to generate proving key"
    exit 1
fi
echo "✅ Proving key generated successfully"
echo ""

# Step 4: Export verification key
echo "Step 3: Exporting verification key..."
snarkjs zkey export verificationkey circuit_final.zkey verification_key.json
if [ $? -ne 0 ]; then
    echo "Error: Failed to export verification key"
    exit 1
fi
echo "✅ Verification key exported successfully"
echo ""

echo "========================================"
echo "✅ ZK Setup Complete!"
echo "========================================"
echo ""
echo "Generated files:"
echo "  - circuit.r1cs"
echo "  - circuit_js/circuit.wasm"
echo "  - circuit_final.zkey"
echo "  - verification_key.json"
echo ""
echo "Next: Test proof generation"
echo "  node test-email-verification.js"
echo ""