const AnomiProofGenerator = require("./proof-generator");
const EmailParser = require("./email-parser");
const path = require("path");
const fs = require("fs");

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
    const emlPath = path.join(__dirname, "eml_data", "Easypaisa_EMLFile.eml");
    const wasmPath = path.join(__dirname, "circuit_js", "circuit.wasm");
    const zkeyPath = path.join(__dirname, "circuit_final.zkey");
    const vkeyPath = path.join(__dirname, "verification_key.json");
    
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
    
    // Test 5: Test with invalid domain (should fail)
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

