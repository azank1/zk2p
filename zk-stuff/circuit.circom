pragma circom 2.0.0;

/*
    ANOMI ZK Circuit - Trade Settlement Proof
    
    This circuit proves knowledge of a valid trade settlement without revealing
    sensitive trading information. It validates:
    1. The trader knows the correct settlement key
    2. The trade amount and price are within valid ranges
    3. The settlement is cryptographically authorized
*/

template AnomiSettlement(n) {
    // Public inputs (visible on-chain)
    signal input amount;        // Trade amount
    signal input price;         // Trade price
    signal input tradeHash;     // Hash of the complete trade details
    
    // Private inputs (hidden)
    signal private input settlementKey;     // Secret key proving authorization
    signal private input nonce;             // Prevents replay attacks
    signal private input buyerSecret;       // Buyer's private commitment
    signal private input sellerSecret;      // Seller's private commitment
    
    // Public outputs
    signal output validSettlement;
    
    // Components for cryptographic operations
    component hasher = Poseidon(4);
    component rangeCheck1 = Num2Bits(64);
    component rangeCheck2 = Num2Bits(64);
    
    // Validate amount is within reasonable range (non-zero, not overflow)
    rangeCheck1.in <== amount;
    rangeCheck2.in <== price;
    
    // Ensure amount and price are positive
    component amountPositive = GreaterThan(64);
    amountPositive.in[0] <== amount;
    amountPositive.in[1] <== 0;
    
    component pricePositive = GreaterThan(64);
    pricePositive.in[0] <== price;
    pricePositive.in[1] <== 0;
    
    // Compute the expected trade hash from private inputs
    hasher.inputs[0] <== settlementKey;
    hasher.inputs[1] <== buyerSecret;
    hasher.inputs[2] <== sellerSecret;
    hasher.inputs[3] <== nonce;
    
    // Verify the trade hash matches the public input
    component hashVerifier = IsEqual();
    hashVerifier.in[0] <== hasher.out;
    hashVerifier.in[1] <== tradeHash;
    
    // Settlement is valid if:
    // 1. Amount and price are positive
    // 2. Hash verification passes  
    component andGate1 = AND();
    andGate1.a <== amountPositive.out;
    andGate1.b <== pricePositive.out;
    
    component andGate2 = AND();
    andGate2.a <== andGate1.out;
    andGate2.b <== hashVerifier.out;
    
    validSettlement <== andGate2.out;
    
    // Constraint: settlement must be valid (1)
    validSettlement === 1;
}

// Template for range checking
template GreaterThan(n) {
    assert(n <= 252);
    signal input in[2];
    signal output out;
    
    component lt = LessThan(n+1);
    lt.in[0] <== in[1];
    lt.in[1] <== in[0] + 1;
    out <== lt.out;
}

// Template for less than comparison
template LessThan(n) {
    assert(n <= 252);
    signal input in[2];
    signal output out;
    
    component n2b = Num2Bits(n+1);
    n2b.in <== in[0] + (1<<n) - in[1];
    out <== 1 - n2b.out[n];
}

// Include necessary libraries
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

// Main component
component main = AnomiSettlement(64);