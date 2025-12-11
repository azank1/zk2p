# ZK Email Verification - Settlement Layer

Zero-Knowledge proof circuit for email verification in the ZK2P DEX settlement layer.

## Overview

This circuit verifies email-based payment confirmations for P2P token settlements. It proves:
1. **DKIM Verification**: Email was sent by Google (via DKIM signature hash matching)
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
cd scripts
.\compile_circuit.ps1
```

**Option 2: Use Bash script (Linux/Mac)**
```bash
cd scripts
chmod +x compile_circuit.sh
./compile_circuit.sh
```

**Note:** Scripts automatically change to the parent directory for compilation, then return.

**Option 3: Manual setup**
```bash
# 1. Compile circuit
circom2 src/circuit.circom --r1cs --wasm -l node_modules

# 2. Generate Powers of Tau (if needed)
cd scripts
.\generate-ptau.ps1  # Windows
# OR download: https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_13.ptau
# Save to: zk-stuff/powersOfTau28_hez_final_13.ptau

# 3. Generate proving key
snarkjs groth16 setup circuit.r1cs powersOfTau28_hez_final_13.ptau circuit_final.zkey

# 4. Export verification key
snarkjs zkey export verificationkey circuit_final.zkey verification_key.json
```

### Run Tests

```bash
npm test
```

This will:
- Parse the example email file
- Generate a ZK proof
- Verify the proof locally
- Test invalid inputs (signature hash, domain)
- Validate domain matching

## Implementation Details

### Architecture

```
zk-stuff/
├── src/                    # Source code
│   ├── circuit.circom      # ZK circuit definition
│   ├── email-parser.js     # Email parsing & DKIM extraction
│   └── proof-generator.js  # Proof generation utility
├── scripts/                # Build scripts
│   ├── compile_circuit.ps1 # Windows compilation script
│   ├── compile_circuit.sh  # Linux/Mac compilation script
│   └── generate-ptau.ps1   # Powers of Tau generator
├── tests/                  # Test suite
│   └── test-email-verification.js
├── examples/               # Example data
│   └── eml_data/
│       └── Easypaisa_EMLFile.eml
└── package.json
```

### Circuit Constraints

**Constraint A (DKIM "Seal")**: Verifies signature hash matches email hash
- Compares 8 words (32-bit chunks) of signature hash with email hash
- All 8 words must match exactly
- Enforces body hash integrity verification

**Constraint B (Domain "Letter")**: Verifies From header matches `.*@telenorbank\.pk`
- Checks all positions in header for `@` symbol
- Validates domain `telenorbank.pk` follows the `@`
- Uses byte-by-byte comparison
- Supports up to 128-byte email addresses

Both constraints must pass for proof to be valid.

### Constraint A Implementation Status

**Current Implementation (Prototype):**
- ✅ **Body Hash Verification**: Verifies computed body hash matches DKIM's claimed body hash (`bh` field)
- ✅ **Hash Matching**: Circuit enforces that `signatureHash` matches `emailHash`
- ⚠️ **RSA Signature Verification**: NOT fully implemented (requires DNS lookup)

**What IS Verified:**
1. Email body is canonicalized and hashed (SHA-256)
2. Computed body hash matches the body hash claimed in DKIM-Signature header
3. Circuit enforces signature hash matches email hash (both are body hashes)

**What is NOT Verified (Prototype Limitation):**
1. RSA signature is not decrypted to extract hash (`signature^e mod n`)
2. DNS lookup not performed to fetch DKIM public key
3. Signature authenticity not cryptographically verified

**Why This Limitation:**
- Full RSA-2048 verification requires:
  - DNS TXT record lookup: `{selector}._domainkey.{domain}`
  - Parsing DNS record to extract public key modulus
  - RSA decryption: `signature^e mod n` (2048-bit operations)
  - PKCS#1 v1.5 padding removal
- This would add significant complexity and DNS dependency
- Current approach verifies body hash integrity (core DKIM check)
- RSA signature verification can be added later or done outside circuit

**What This Means:**
- ✅ Body hash is verified (computed matches DKIM claim)
- ✅ Circuit correctly enforces hash matching constraint
- ⚠️ RSA signature authenticity not verified (prototype limitation)
- The circuit itself is correct; the limitation is in input preparation

### Constraint B Implementation Status

✅ **Fully Implemented:**
- Circuit enforces domain matching via byte-by-byte comparison
- Tests verify that invalid domains are rejected
- Supports `.*@telenorbank\.pk` pattern matching

## Usage

### Generate Proof for Settlement

```javascript
const AnomiProofGenerator = require("./src/proof-generator");

const generator = new AnomiProofGenerator(
    "./circuit_js/circuit.wasm",
    "./circuit_final.zkey"
);

// Generate proof from email file
const result = await generator.generateEmailProof(
    "./examples/eml_data/Easypaisa_EMLFile.eml",
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

## Testing

The test suite (`tests/test-email-verification.js`) includes:

1. **Test 1**: Email parsing and DKIM extraction
2. **Test 2**: Circuit input preparation
3. **Test 3**: ZK proof generation
4. **Test 4**: Local proof verification
5. **Test 5**: Domain validation (JavaScript check)
6. **Test 6**: Invalid signature hash rejection (Constraint A)
7. **Test 6.5**: Body hash mismatch detection
8. **Test 7**: Invalid domain rejection (Constraint B)

All tests verify that:
- Valid inputs generate valid proofs
- Invalid inputs are correctly rejected
- Circuit constraints are properly enforced

## Approach

### Email Processing Flow

1. **Parse Email**: Extract headers and body from `.eml` file
2. **Extract DKIM**: Parse DKIM-Signature header for signature and body hash
3. **Canonicalize**: Normalize email body according to DKIM canonicalization rules
4. **Compute Hash**: SHA-256 hash of canonicalized body
5. **Verify Body Hash**: Compare computed hash with DKIM's claimed body hash
6. **Extract From Header**: Parse From header and extract email address
7. **Prepare Circuit Inputs**: Convert all data to circuit-compatible format
8. **Generate Proof**: Use snarkjs to generate ZK proof
9. **Verify Proof**: Validate proof using verification key

### Circuit Design

The circuit uses:
- **Circom 2.0** for circuit definition
- **circomlib** for standard components (comparators, gates)
- **Groth16** zk-SNARK protocol
- **Power-13 Ptau** (supports up to 8,192 constraints)

Circuit structure:
- Main template: `EmailVerification(maxFromHeaderBytes)`
- Domain matcher: `DomainMatcher(maxBytes)` with position checking
- Multi-input gates: `MultiAND`, `MultiOR` for constraint aggregation

## Notes

- Circuit supports up to 128-byte email addresses
- Both constraints must pass for proof to be valid
- Invalid inputs are correctly rejected (verified by tests)
- Generated files (`.r1cs`, `.wasm`, `.zkey`, `.ptau`) are git-ignored
- See `.gitignore` for complete list of ignored files

## Future Enhancements

1. **Full RSA Signature Verification**: Implement DNS lookup and RSA-2048 decryption
2. **Multiple Email Providers**: Support DKIM verification for providers other than Google
3. **Key Rotation**: Implement mechanism for DKIM key rotation
4. **Optimization**: Reduce circuit size and proving time
5. **Production Deployment**: Integrate with Solana program for on-chain verification
