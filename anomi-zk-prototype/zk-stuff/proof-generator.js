const snarkjs = require("snarkjs");
const crypto = require("crypto");

/**
 * ANOMI ZK Proof Generator
 * 
 * This utility generates ZK proofs for trade settlement validation.
 * It takes trade details and private secrets, then creates a proof
 * that can be verified on-chain without revealing sensitive information.
 */

class AnomiProofGenerator {
    constructor(wasmPath, zkeyPath) {
        this.wasmPath = wasmPath || "./circuit.wasm";
        this.zkeyPath = zkeyPath || "./circuit_final.zkey";
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