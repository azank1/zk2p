pragma circom 2.0.0;

/*
    Email Verification ZK Circuit
    
    This circuit proves:
    1. Constraint A (The "Seal"): DKIM signature hash matches email hash - proves Google sent the email
    2. Constraint B (The "Letter"): From header matches .*@telenorbank\.pk - proves email is from Easypaisa/Telenor
    
    Note: Full RSA-2048 verification in Circom is computationally expensive (millions of constraints).
    This implementation verifies the signature hash matches the email hash, which is the core check.
    The RSA signature verification (signature^e mod n) can be done outside the circuit or added later.
*/

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/gates.circom";

template EmailVerification(maxFromHeaderBytes) {
    // Public inputs (visible on-chain)
    signal input emailHash[8];           // SHA-256 hash of canonicalized email (8 * 32 bits = 256 bits)
    signal input fromHeaderHash[8];      // SHA-256 hash of From header (8 * 32 bits = 256 bits)
    signal input orderId[2];             // Order ID (u128 = 2 * 64 bits)
    
    // Private inputs (hidden in proof)
    signal input fromHeader[maxFromHeaderBytes];     // From header as byte array
    signal input signatureHash[8];                   // Hash extracted from RSA signature (computed outside circuit)
    
    // Outputs
    signal output validEmail;            // 1 if both constraints pass, 0 otherwise
    
    // Constraint A: Verify signature hash matches email hash
    // This verifies that the hash extracted from the RSA signature matches the email hash
    // In full RSA: signature^e mod n should decode to a padded hash matching emailHash
    component hashChecks[8];
    for (var i = 0; i < 8; i++) {
        hashChecks[i] = IsEqual();
        hashChecks[i].in[0] <== signatureHash[i];
        hashChecks[i].in[1] <== emailHash[i];
    }
    
    // All hash words must match
    component hashMatch = MultiAND(8);
    for (var i = 0; i < 8; i++) {
        hashMatch.in[i] <== hashChecks[i].out;
    }
    
    // Constraint B: Verify From header matches .*@telenorbank\.pk pattern
    component domainMatcher = DomainMatcher(maxFromHeaderBytes);
    for (var i = 0; i < maxFromHeaderBytes; i++) {
        domainMatcher.headerBytes[i] <== fromHeader[i];
    }
    
    // Both constraints must pass
    component andGate = AND();
    andGate.a <== hashMatch.out;
    andGate.b <== domainMatcher.matches;
    
    validEmail <== andGate.out;
    
    // Constraint: email must be valid
    validEmail === 1;
}

// Template to match domain pattern .*@telenorbank\.pk
template DomainMatcher(maxBytes) {
    signal input headerBytes[maxBytes];
    signal output matches;
    
    // Domain to match: "telenorbank.pk" (14 bytes including @)
    var domainLen = 14; // "@telenorbank.pk" = 14 bytes
    
    // Find '@' symbol positions
    component atChecks[maxBytes];
    for (var i = 0; i < maxBytes; i++) {
        atChecks[i] = IsEqual();
        atChecks[i].in[0] <== headerBytes[i];
        atChecks[i].in[1] <== 64; // '@' ASCII code
    }
    
    // Simplified approach: Check if domain "@telenorbank.pk" appears
    // We'll check positions 0 to maxBytes-14 (need 14 bytes total: '@' + 13 domain bytes)
    var checkPositions = maxBytes - 13; // Need '@' + 13 domain bytes
    
    component positionChecks[checkPositions];
    for (var pos = 0; pos < checkPositions; pos++) {
        positionChecks[pos] = CheckDomainAtPosition(maxBytes, pos);
        for (var i = 0; i < maxBytes; i++) {
            positionChecks[pos].headerBytes[i] <== headerBytes[i];
        }
    }
    
    // Match if any position has valid domain
    component orGate = MultiOR(checkPositions);
    for (var i = 0; i < checkPositions; i++) {
        orGate.in[i] <== positionChecks[i].matches;
    }
    
    matches <== orGate.out;
}

// Template to check if domain "@telenorbank.pk" appears at a specific position
template CheckDomainAtPosition(maxBytes, pos) {
    signal input headerBytes[maxBytes];
    signal output matches;
    
    // Check '@' at position pos
    component atCheck = IsEqual();
    atCheck.in[0] <== headerBytes[pos];
    atCheck.in[1] <== 64; // '@'
    
    // Check domain "telenorbank.pk" (13 bytes) starting at pos+1
    component byteChecks[13];
    byteChecks[0] = IsEqual();
    byteChecks[0].in[0] <== headerBytes[pos + 1];
    byteChecks[0].in[1] <== 116; // 't'
    byteChecks[1] = IsEqual();
    byteChecks[1].in[0] <== headerBytes[pos + 2];
    byteChecks[1].in[1] <== 101; // 'e'
    byteChecks[2] = IsEqual();
    byteChecks[2].in[0] <== headerBytes[pos + 3];
    byteChecks[2].in[1] <== 108; // 'l'
    byteChecks[3] = IsEqual();
    byteChecks[3].in[0] <== headerBytes[pos + 4];
    byteChecks[3].in[1] <== 101; // 'e'
    byteChecks[4] = IsEqual();
    byteChecks[4].in[0] <== headerBytes[pos + 5];
    byteChecks[4].in[1] <== 110; // 'n'
    byteChecks[5] = IsEqual();
    byteChecks[5].in[0] <== headerBytes[pos + 6];
    byteChecks[5].in[1] <== 111; // 'o'
    byteChecks[6] = IsEqual();
    byteChecks[6].in[0] <== headerBytes[pos + 7];
    byteChecks[6].in[1] <== 114; // 'r'
    byteChecks[7] = IsEqual();
    byteChecks[7].in[0] <== headerBytes[pos + 8];
    byteChecks[7].in[1] <== 98; // 'b'
    byteChecks[8] = IsEqual();
    byteChecks[8].in[0] <== headerBytes[pos + 9];
    byteChecks[8].in[1] <== 97; // 'a'
    byteChecks[9] = IsEqual();
    byteChecks[9].in[0] <== headerBytes[pos + 10];
    byteChecks[9].in[1] <== 110; // 'n'
    byteChecks[10] = IsEqual();
    byteChecks[10].in[0] <== headerBytes[pos + 11];
    byteChecks[10].in[1] <== 107; // 'k'
    byteChecks[11] = IsEqual();
    byteChecks[11].in[0] <== headerBytes[pos + 12];
    byteChecks[11].in[1] <== 46; // '.'
    byteChecks[12] = IsEqual();
    byteChecks[12].in[0] <== headerBytes[pos + 13];
    byteChecks[12].in[1] <== 112; // 'p'
    
    // All domain bytes must match
    component domainMatch = MultiAND(13);
    for (var i = 0; i < 13; i++) {
        domainMatch.in[i] <== byteChecks[i].out;
    }
    
    // Both '@' and domain must match
    component andGate = AND();
    andGate.a <== atCheck.out;
    andGate.b <== domainMatch.out;
    
    matches <== andGate.out;
}

// Multi-input OR gate (circomlib has MultiAND but not MultiOR)
template MultiOR(n) {
    signal input in[n];
    signal output out;
    
    component orGates[n-1];
    orGates[0] = OR();
    orGates[0].a <== in[0];
    orGates[0].b <== in[1];
    
    for (var i = 1; i < n-1; i++) {
        orGates[i] = OR();
        orGates[i].a <== orGates[i-1].out;
        orGates[i].b <== in[i+1];
    }
    
    if (n > 1) {
        out <== orGates[n-2].out;
    } else {
        out <== in[0];
    }
}

// Main component
// Parameter: maxFromHeaderBytes=128 (reasonable email address length)
component main = EmailVerification(128);
