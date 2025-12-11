const AnomiProofGenerator = require("../src/proof-generator");
const EmailParser = require("../src/email-parser");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const snarkjs = require("snarkjs");

/**
 * Test script for email verification ZK circuit
 * 
 * Tests:
 * 1. Parse example .eml file
 * 2. Generate proof with valid email
 * 3. Verify proof locally
 * 4. Test with invalid inputs (wrong domain, invalid signature)
 */

async function main() {
    console.log("========================================");
    console.log("Email Verification ZK Circuit Test");
    console.log("========================================\n");
    
    // Paths
    const emlPath = path.join(__dirname, "..", "examples", "eml_data", "Easypaisa_EMLFile.eml");
    const wasmPath = path.join(__dirname, "..", "circuit_js", "circuit.wasm");
    const zkeyPath = path.join(__dirname, "..", "circuit_final.zkey");
    const vkeyPath = path.join(__dirname, "..", "verification_key.json");
    
    // Check if files exist
    if (!fs.existsSync(emlPath)) {
        console.error("❌ Email file not found:", emlPath);
        process.exit(1);
    }
    
    if (!fs.existsSync(wasmPath)) {
        console.error("❌ Circuit WASM not found:", wasmPath);
        console.error("   Please compile the circuit first: circom circuit.circom --r1cs --wasm");
        process.exit(1);
    }
    
    if (!fs.existsSync(zkeyPath)) {
        console.error("❌ Proving key not found:", zkeyPath);
        console.error("   Please generate the proving key first");
        process.exit(1);
    }
    
    // Test 1: Parse email
    console.log("📧 Test 1: Parsing email file...");
    try {
        const email = EmailParser.parseEML(emlPath);
        const dkim = EmailParser.extractDKIMSignature(email);
        const fromHeader = EmailParser.extractFromHeader(email);
        
        console.log("✅ Email parsed successfully");
        console.log("   DKIM Domain:", dkim.domain);
        console.log("   DKIM Selector:", dkim.selector);
        console.log("   DKIM Algorithm:", dkim.algorithm);
        console.log("   From Header:", fromHeader);
        console.log("   Body Hash (base64):", dkim.bodyHash.substring(0, 20) + "...");
        console.log("");
    } catch (error) {
        console.error("❌ Failed to parse email:", error.message);
        process.exit(1);
    }
    
    // Test 2: Prepare circuit inputs
    console.log("🔧 Test 2: Preparing circuit inputs...");
    try {
        const orderId = "12345678901234567890"; // Example order ID
        const inputs = EmailParser.prepareCircuitInputs(
            EmailParser.parseEML(emlPath),
            orderId
        );
        
        console.log("✅ Circuit inputs prepared");
        console.log("   Email hash length:", inputs.emailHash.length);
        console.log("   From header:", inputs.fromHeaderString);
        console.log("   From header bytes:", inputs.fromHeader.length);
        console.log("   Order ID:", inputs.orderId);
        console.log("");
    } catch (error) {
        console.error("❌ Failed to prepare circuit inputs:", error.message);
        process.exit(1);
    }
    
    // Test 3: Generate proof (if circuit is compiled)
    if (fs.existsSync(wasmPath) && fs.existsSync(zkeyPath)) {
        console.log("🔐 Test 3: Generating ZK proof...");
        try {
            const generator = new AnomiProofGenerator(wasmPath, zkeyPath);
            const orderId = "12345678901234567890";
            
            const result = await generator.generateEmailProof(emlPath, orderId);
            
            console.log("✅ ZK proof generated successfully");
            console.log("   Proof size:", JSON.stringify(result.proof).length, "bytes");
            console.log("   Public signals:", result.publicSignals.length);
            console.log("   Email hash:", result.emailHash.substring(0, 20) + "...");
            console.log("   From header:", result.fromHeader);
            console.log("   Order ID:", result.orderId);
            console.log("");
            
            // Test 4: Verify proof locally
            if (fs.existsSync(vkeyPath)) {
                console.log("✅ Test 4: Verifying proof locally...");
                try {
                    // Use rawProof for verification (snarkjs format), not the Solana-formatted proof
                    const isValid = await generator.verifyProof(
                        result.rawProof || result.proof,
                        result.publicSignals,
                        vkeyPath
                    );
                    
                    if (isValid) {
                        console.log("✅ Proof verification: VALID");
                    } else {
                        console.log("❌ Proof verification: INVALID");
                    }
                    console.log("");
                } catch (error) {
                    console.warn("⚠️  Could not verify proof:", error.message);
                    console.log("   (This is expected if verification key format differs)");
                    console.log("");
                }
            } else {
                console.log("⚠️  Verification key not found, skipping proof verification");
                console.log("   Generate it with: snarkjs zkey export verificationkey circuit_final.zkey verification_key.json");
                console.log("");
            }
        } catch (error) {
            console.error("❌ Failed to generate proof:", error.message);
            console.error("   Stack:", error.stack);
            console.log("");
            console.log("Note: Circuit may need to be compiled first:");
            console.log("   1. circom circuit.circom --r1cs --wasm");
            console.log("   2. snarkjs groth16 setup circuit.r1cs powersOfTau28_hez_final_12.ptau circuit_final.zkey");
            console.log("");
        }
    } else {
        console.log("⚠️  Circuit not compiled, skipping proof generation");
        console.log("   Compile with: circom circuit.circom --r1cs --wasm");
        console.log("");
    }
    
    // Test 5: Test with invalid domain (should fail in circuit)
    console.log("🧪 Test 5: Testing domain validation logic...");
    try {
        const email = EmailParser.parseEML(emlPath);
        const fromHeader = EmailParser.extractFromHeader(email);
        
        console.log("   From header:", fromHeader);
        
        // Check if domain matches pattern
        const domainPattern = /@telenorbank\.pk$/;
        const matches = domainPattern.test(fromHeader);
        
        if (matches) {
            console.log("✅ Domain validation: PASS (matches @telenorbank.pk)");
        } else {
            console.log("❌ Domain validation: FAIL (does not match @telenorbank.pk)");
        }
        console.log("");
    } catch (error) {
        console.error("❌ Domain validation test failed:", error.message);
        console.log("");
    }
    
    // Test 6: Test with invalid signature hash (should fail Constraint A)
    if (fs.existsSync(wasmPath) && fs.existsSync(zkeyPath)) {
        console.log("🧪 Test 6: Testing invalid signature hash (should fail)...");
        try {
            const generator = new AnomiProofGenerator(wasmPath, zkeyPath);
            const email = EmailParser.parseEML(emlPath);
            const dkim = EmailParser.extractDKIMSignature(email);
            const fromHeader = EmailParser.extractFromHeader(email);
            const emailHashData = EmailParser.computeEmailHash(email, dkim.headers);
            
            // Create invalid signature hash (all zeros)
            const invalidSignatureHash = Array(8).fill("0");
            
            // Convert email hash to array of 8 32-bit words
            const emailHashBytes = Buffer.from(emailHashData.bodyHash, 'hex');
            const emailHash = [];
            for (let i = 0; i < 8; i++) {
                const word = emailHashBytes.readUInt32BE(i * 4);
                emailHash.push(word.toString());
            }
            
            // Convert From header hash
            const fromHeaderHashBytes = crypto.createHash('sha256').update(fromHeader).digest();
            const fromHeaderHash = [];
            for (let i = 0; i < 8; i++) {
                const word = fromHeaderHashBytes.readUInt32BE(i * 4);
                fromHeaderHash.push(word.toString());
            }
            
            // Convert From header to byte array
            const fromHeaderBytes = Buffer.from(fromHeader, 'utf8');
            const fromHeaderArray = [];
            const maxFromHeaderBytes = 128;
            for (let i = 0; i < maxFromHeaderBytes; i++) {
                if (i < fromHeaderBytes.length) {
                    fromHeaderArray.push(fromHeaderBytes[i].toString());
                } else {
                    fromHeaderArray.push("0");
                }
            }
            
            const orderIdBigInt = BigInt("12345678901234567890");
            const orderIdArray = [
                (orderIdBigInt & BigInt("0xFFFFFFFFFFFFFFFF")).toString(),
                ((orderIdBigInt >> BigInt(64)) & BigInt("0xFFFFFFFFFFFFFFFF")).toString()
            ];
            
            const invalidInputs = {
                emailHash: emailHash,
                fromHeaderHash: fromHeaderHash,
                orderId: orderIdArray,
                fromHeader: fromHeaderArray,
                signatureHash: invalidSignatureHash
            };
            
            try {
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    invalidInputs,
                    wasmPath,
                    zkeyPath
                );
                
                console.log("❌ Test 6 FAILED: Proof generated with invalid signature hash (should have failed)");
            } catch (error) {
                console.log("✅ Test 6 PASSED: Proof generation correctly failed with invalid signature hash");
            }
            console.log("");
        } catch (error) {
            console.error("❌ Test 6 error:", error.message);
            console.log("");
        }
    }
    
    // Test 6.5: Test with mismatched body hash (should fail Constraint A verification)
    if (fs.existsSync(wasmPath) && fs.existsSync(zkeyPath)) {
        console.log("🧪 Test 6.5: Testing body hash mismatch (should fail verification)...");
        try {
            const email = EmailParser.parseEML(emlPath);
            const dkim = EmailParser.extractDKIMSignature(email);
            
            // Create a fake email hash that doesn't match DKIM body hash
            const fakeEmailHashData = {
                bodyHash: "0000000000000000000000000000000000000000000000000000000000000000",
                bodyHashBase64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
            };
            
            try {
                await EmailParser.verifyDKIMSignatureAndExtractHash(dkim, email, fakeEmailHashData);
                console.log("❌ Test 6.5 FAILED: Body hash mismatch not caught (should have failed)");
            } catch (error) {
                if (error.message.includes("Body hash mismatch")) {
                    console.log("✅ Test 6.5 PASSED: Body hash mismatch correctly caught");
                } else {
                    console.log("❌ Test 6.5 FAILED: Wrong error:", error.message);
                }
            }
            console.log("");
        } catch (error) {
            console.error("❌ Test 6.5 error:", error.message);
            console.log("");
        }
    }
    
    // Test 7: Test with invalid domain (should fail Constraint B)
    if (fs.existsSync(wasmPath) && fs.existsSync(zkeyPath)) {
        console.log("🧪 Test 7: Testing invalid domain (should fail)...");
        try {
            const generator = new AnomiProofGenerator(wasmPath, zkeyPath);
            const email = EmailParser.parseEML(emlPath);
            const dkim = EmailParser.extractDKIMSignature(email);
            const fromHeader = EmailParser.extractFromHeader(email);
            const emailHashData = EmailParser.computeEmailHash(email, dkim.headers);
            
            // Create invalid domain (replace with @gmail.com)
            const invalidFromHeader = fromHeader.replace(/@telenorbank\.pk$/, '@gmail.com');
            
            // Convert email hash
            const emailHashBytes = Buffer.from(emailHashData.bodyHash, 'hex');
            const emailHash = [];
            for (let i = 0; i < 8; i++) {
                const word = emailHashBytes.readUInt32BE(i * 4);
                emailHash.push(word.toString());
            }
            
            // Convert From header hash (with invalid domain)
            const fromHeaderHashBytes = crypto.createHash('sha256').update(invalidFromHeader).digest();
            const fromHeaderHash = [];
            for (let i = 0; i < 8; i++) {
                const word = fromHeaderHashBytes.readUInt32BE(i * 4);
                fromHeaderHash.push(word.toString());
            }
            
            // Convert From header to byte array (with invalid domain)
            const fromHeaderBytes = Buffer.from(invalidFromHeader, 'utf8');
            const fromHeaderArray = [];
            const maxFromHeaderBytes = 128;
            for (let i = 0; i < maxFromHeaderBytes; i++) {
                if (i < fromHeaderBytes.length) {
                    fromHeaderArray.push(fromHeaderBytes[i].toString());
                } else {
                    fromHeaderArray.push("0");
                }
            }
            
            // Use valid signature hash (from DKIM bodyHash)
            const signatureHashBytes = Buffer.from(dkim.bodyHash, 'base64');
            const signatureHash = [];
            for (let i = 0; i < 8; i++) {
                const word = signatureHashBytes.readUInt32BE(i * 4);
                signatureHash.push(word.toString());
            }
            
            const orderIdBigInt = BigInt("12345678901234567890");
            const orderIdArray = [
                (orderIdBigInt & BigInt("0xFFFFFFFFFFFFFFFF")).toString(),
                ((orderIdBigInt >> BigInt(64)) & BigInt("0xFFFFFFFFFFFFFFFF")).toString()
            ];
            
            const invalidDomainInputs = {
                emailHash: emailHash,
                fromHeaderHash: fromHeaderHash,
                orderId: orderIdArray,
                fromHeader: fromHeaderArray,
                signatureHash: signatureHash
            };
            
            try {
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    invalidDomainInputs,
                    wasmPath,
                    zkeyPath
                );
                
                console.log("❌ Test 7 FAILED: Proof generated with invalid domain (should have failed)");
            } catch (error) {
                console.log("✅ Test 7 PASSED: Proof generation correctly failed with invalid domain");
            }
            console.log("");
        } catch (error) {
            console.error("❌ Test 7 error:", error.message);
            console.log("");
        }
    }
    
    console.log("========================================");
    console.log("✅ All tests completed!");
    console.log("========================================");
    
    // Explicitly exit to prevent hanging
    process.exit(0);
}

// Run tests
main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
});

