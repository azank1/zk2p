# ZK Email Verification - Settlement Layer

Zero-Knowledge proof circuit for email verification in the ZK2P DEX settlement layer.

## Overview

This circuit verifies email-based payment confirmations for P2P token settlements. It proves:
1. **DKIM Verification**: Email was sent by Google (via DKIM signature)
2. **Domain Matching**: Email is from `@telenorbank.pk` (Easypaisa/Telenor)

## Quick Start

### Prerequisites

- Node.js 16+
- Circom compiler: `npm install -g circom2`
- SnarkJS: `npm install -g snarkjs`

### Installation

```bash
cd zk-stuff
npm install
```

### Setup Circuit

**Option 1: Use PowerShell script (Windows)**
```powershell
.\compile_circuit.ps1
```

**Option 2: Use Bash script (Linux/Mac)**
```bash
chmod +x compile_circuit.sh
./compile_circuit.sh
```

**Option 3: Manual setup**
```bash
# 1. Compile circuit
circom2 circuit.circom --r1cs --wasm -l node_modules

# 2. Generate Powers of Tau (if needed)
.\generate-ptau.ps1  # Windows
# OR download: https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_13.ptau

# 3. Generate proving key
snarkjs groth16 setup circuit.r1cs powersOfTau28_hez_final_13.ptau circuit_final.zkey

# 4. Export verification key
snarkjs zkey export verificationkey circuit_final.zkey verification_key.json
```

## Verify Settlement

### Test Email Verification

```bash
node test-email-verification.js
```

This will:
- Parse the example email file
- Generate a ZK proof
- Verify the proof locally
- Validate domain matching

### Generate Proof for Settlement

```javascript
const AnomiProofGenerator = require("./proof-generator");

const generator = new AnomiProofGenerator(
    "./circuit_js/circuit.wasm",
    "./circuit_final.zkey"
);

// Generate proof from email file
const result = await generator.generateEmailProof(
    "./eml_data/Easypaisa_EMLFile.eml",
    "12345678901234567890" // Order ID
);

// Use result.proof for Solana program
console.log("Proof (for Solana):", result.proof);
console.log("Public signals:", result.publicSignals);
```

### Solana Program Integration

The proof is formatted for the Solana `verify_settlement` instruction:

```rust
verify_settlement(
    order_id: u128,
    proof_a: Vec<u8>,      // 64 bytes (G1 point)
    proof_b: Vec<u8>,      // 128 bytes (G2 point)
    proof_c: Vec<u8>,      // 64 bytes (G1 point)
    public_signals: Vec<String>  // 18 elements
)
```

## File Structure

```
zk-stuff/
├── circuit.circom              # Main ZK circuit
├── email-parser.js             # Email parsing & DKIM extraction
├── proof-generator.js          # Proof generation utility
├── test-email-verification.js  # Test script
├── compile_circuit.ps1         # Windows compilation script
├── compile_circuit.sh          # Linux/Mac compilation script
├── generate-ptau.ps1           # Powers of Tau generator
├── eml_data/                   # Example email files
│   └── Easypaisa_EMLFile.eml
└── package.json
```

## Circuit Constraints

**Constraint A (DKIM "Seal")**: Verifies signature hash matches email hash
- Compares 8 words (32-bit chunks) of signature hash with email hash
- All 8 words must match exactly

**Constraint B (Domain "Letter")**: Verifies From header matches `.*@telenorbank\.pk`
- Checks all positions in header for `@` symbol
- Validates domain `telenorbank.pk` follows the `@`
- Uses byte-by-byte comparison

Both constraints must pass for proof to be valid.

## Notes

- Full RSA-2048 verification is computationally expensive in ZK circuits
- Current implementation verifies hash matching (core DKIM check)
- RSA signature decryption can be done outside circuit or added later
- Circuit supports up to 128-byte email addresses
