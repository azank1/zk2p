const snarkjs = require("snarkjs");
const crypto = require("crypto");
const EmailParser = require("./email-parser");

/**
 * ANOMI ZK Proof Generator
 * 
 * This utility generates ZK proofs for email verification and trade settlement validation.
 * It supports both email verification (DKIM + domain matching) and trade settlement proofs.
 */

class AnomiProofGenerator {
    constructor(wasmPath, zkeyPath) {
        this.wasmPath = wasmPath || path.join(__dirname, "..", "circuit_js", "circuit.wasm");
        this.zkeyPath = zkeyPath || path.join(__dirname, "..", "circuit_final.zkey");
    }

    /**
     * Generate a ZK proof for trade settlement
     * @param {Object} tradeData - The trade information
     * @param {number} tradeData.amount - Trade amount
     * @param {number} tradeData.price - Trade price  
     * @param {string} tradeData.settlementKey - Private settlement authorization key
     * @param {string} tradeData.buyerSecret - Buyer's private commitment
     * @param {string} tradeData.sellerSecret - Seller's private commitment
     * @returns {Object} Generated proof and public signals
     */
    async generateProof(tradeData) {
        try {
            console.log("Generating ZK proof for trade settlement...");
            
            // Generate a random nonce to prevent replay attacks
            const nonce = crypto.randomBytes(32).toString('hex');
            
            // Compute the trade hash from private inputs
            const tradeHash = this.computeTradeHash(
                tradeData.settlementKey,
                tradeData.buyerSecret,
                tradeData.sellerSecret,
                nonce
            );
            
            // Prepare circuit inputs
            const circuitInputs = {
                // Public inputs (will be visible on-chain)
                amount: tradeData.amount.toString(),
                price: tradeData.price.toString(),
                tradeHash: tradeHash,
                
                // Private inputs (will be hidden in the proof)
                settlementKey: tradeData.settlementKey,
                nonce: nonce,
                buyerSecret: tradeData.buyerSecret,
                sellerSecret: tradeData.sellerSecret
            };
            
            console.log("Circuit inputs prepared:", {
                amount: circuitInputs.amount,
                price: circuitInputs.price,
                tradeHash: circuitInputs.tradeHash,
                // Private inputs not logged for security
            });
            
            // Generate the proof
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                circuitInputs,
                this.wasmPath,
                this.zkeyPath
            );
            
            console.log("ZK proof generated successfully");
            
            // Format proof for Solana program consumption
            const formattedProof = this.formatProofForSolana(proof);
            
            return {
                proof: formattedProof,
                publicSignals: publicSignals,
                tradeHash: tradeHash,
                nonce: nonce
            };
            
        } catch (error) {
            console.error("Error generating ZK proof:", error);
            throw error;
        }
    }
    
    /**
     * Compute trade hash from private inputs using Poseidon hash
     * In a real implementation, this would use the same hash function as the circuit
     */
    computeTradeHash(settlementKey, buyerSecret, sellerSecret, nonce) {
        // For this prototype, we'll use a simple hash
        // In production, this should match the Poseidon hash used in the circuit
        const combined = settlementKey + buyerSecret + sellerSecret + nonce;
        return crypto.createHash('sha256').update(combined).digest('hex').slice(0, 16);
    }
    
    /**
     * Format the snarkjs proof for consumption by Solana programs
     */
    formatProofForSolana(proof) {
        // Convert proof elements to the format expected by our Solana program
        return {
            a: this.g1PointToBytes(proof.pi_a),
            b: this.g2PointToBytes(proof.pi_b), 
            c: this.g1PointToBytes(proof.pi_c)
        };
    }
    
    /**
     * Convert G1 point to byte array (64 bytes)
     */
    g1PointToBytes(point) {
        // This is a simplified conversion
        // In production, you'd properly serialize the curve points
        const x = BigInt(point[0]).toString(16).padStart(64, '0');
        const y = BigInt(point[1]).toString(16).padStart(64, '0');
        return Buffer.from(x + y, 'hex');
    }
    
    /**
     * Convert G2 point to byte array (128 bytes)
     */
    g2PointToBytes(point) {
        // G2 points have 4 coordinates (2 complex numbers)
        const coords = [point[0][0], point[0][1], point[1][0], point[1][1]];
        const hexStrings = coords.map(coord => 
            BigInt(coord).toString(16).padStart(32, '0')
        );
        return Buffer.from(hexStrings.join(''), 'hex');
    }
    
    /**
     * Generate a ZK proof for email verification
     * @param {string} emlPath - Path to .eml file
     * @param {string|number} orderId - Order ID to include in proof
     * @returns {Object} Generated proof and public signals
     */
    /**
     * Generate a ZK proof for email verification
     * @param {string} emlPath - Path to .eml file
     * @param {string|number} orderId - Order ID to include in proof
     * @returns {Object} Proof and public signals
     * 
     * NOTE: Currently uses dkim.bodyHash as signature hash (prototype limitation).
     * Full RSA-2048 signature verification (decrypting signature^e mod n) is not implemented
     * due to computational complexity in ZK circuits. This is documented in the code.
     */
    async generateEmailProof(emlPath, orderId) {
        try {
            console.log("Generating ZK proof for email verification...");
            console.log("Email file:", emlPath);
            console.log("Order ID:", orderId);
            
            // Parse email
            const email = EmailParser.parseEML(emlPath);
            const dkim = EmailParser.extractDKIMSignature(email);
            const fromHeader = EmailParser.extractFromHeader(email);
            const emailHashData = EmailParser.computeEmailHash(email, dkim.headers);
            
            console.log("DKIM Domain:", dkim.domain);
            console.log("DKIM Selector:", dkim.selector);
            console.log("From Header:", fromHeader);
            
            // Convert email hash to array of 8 32-bit words
            // This is the computed body hash from canonicalized email
            const emailHashBytes = Buffer.from(emailHashData.bodyHash, 'hex');
            const emailHash = [];
            for (let i = 0; i < 8; i++) {
                const word = emailHashBytes.readUInt32BE(i * 4);
                emailHash.push(word.toString());
            }
            
            // Convert From header hash to array of 8 32-bit words
            const fromHeaderHashBytes = crypto.createHash('sha256').update(fromHeader).digest();
            const fromHeaderHash = [];
            for (let i = 0; i < 8; i++) {
                const word = fromHeaderHashBytes.readUInt32BE(i * 4);
                fromHeaderHash.push(word.toString());
            }
            
            // Verify DKIM signature and extract hash from RSA signature
            // This should decrypt signature^e mod n to get the signed hash
            // Currently verifies body hash matches; full RSA verification requires DNS lookup
            const dkimVerification = await EmailParser.verifyDKIMSignatureAndExtractHash(dkim, email, emailHashData);
            
            // Use the extracted hash from RSA signature (or body hash if RSA verification not fully implemented)
            const signatureHashBytes = dkimVerification.extractedHash;
            const signatureHash = [];
            for (let i = 0; i < 8; i++) {
                const word = signatureHashBytes.readUInt32BE(i * 4);
                signatureHash.push(word.toString());
            }
            
            // Convert From header to byte array (pad to 128 bytes)
            const fromHeaderBytes = Buffer.from(fromHeader, 'utf8');
            const fromHeaderArray = [];
            const maxFromHeaderBytes = 128;
            for (let i = 0; i < maxFromHeaderBytes; i++) {
                if (i < fromHeaderBytes.length) {
                    fromHeaderArray.push(fromHeaderBytes[i].toString());
                } else {
                    fromHeaderArray.push("0"); // Padding
                }
            }
            
            // Convert orderId to array of 2 64-bit words (u128)
            const orderIdBigInt = BigInt(orderId);
            const orderIdArray = [
                (orderIdBigInt & BigInt("0xFFFFFFFFFFFFFFFF")).toString(),
                ((orderIdBigInt >> BigInt(64)) & BigInt("0xFFFFFFFFFFFFFFFF")).toString()
            ];
            
            // Prepare circuit inputs
            const circuitInputs = {
                // Public inputs
                emailHash: emailHash,
                fromHeaderHash: fromHeaderHash,
                orderId: orderIdArray,
                
                // Private inputs
                fromHeader: fromHeaderArray,
                signatureHash: signatureHash
            };
            
            console.log("Circuit inputs prepared");
            console.log("Email hash (first 4 words):", emailHash.slice(0, 4));
            console.log("From header:", fromHeader);
            console.log("From header length:", fromHeaderBytes.length);
            
            // Generate the proof
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                circuitInputs,
                this.wasmPath,
                this.zkeyPath
            );
            
            console.log("ZK proof generated successfully");
            
            // Format proof for Solana program consumption
            const formattedProof = this.formatProofForSolana(proof);
            
            return {
                proof: formattedProof, // For Solana program
                rawProof: proof, // For local verification
                publicSignals: publicSignals,
                emailHash: emailHashData.bodyHash,
                fromHeader: fromHeader,
                orderId: orderId.toString()
            };
            
        } catch (error) {
            console.error("Error generating email verification proof:", error);
            throw error;
        }
    }
    
    /**
     * Verify a proof (useful for testing)
     */
    async verifyProof(proof, publicSignals, verificationKeyPath) {
        try {
            const vKey = JSON.parse(require('fs').readFileSync(verificationKeyPath));
            const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
            return isValid;
        } catch (error) {
            console.error("Error verifying proof:", error);
            return false;
        }
    }
}

module.exports = AnomiProofGenerator;