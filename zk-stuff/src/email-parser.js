const fs = require('fs');
const crypto = require('crypto');
const { promisify } = require('util');
const dns = require('dns').promises;

/**
 * Email Parser for ZK Circuit
 * 
 * Parses .eml files and extracts:
 * - DKIM signature and components
 * - From header
 * - Email body hash for DKIM verification
 */

class EmailParser {
    /**
     * Parse .eml file and extract email components
     * @param {string} emlPath - Path to .eml file
     * @returns {Object} Parsed email data
     */
    static parseEML(emlPath) {
        const emlContent = fs.readFileSync(emlPath, 'utf8');
        const lines = emlContent.split('\n');
        
        const headers = {};
        let headerSection = true;
        let bodyStartIndex = 0;
        
        // Parse headers
        let currentHeader = null;
        let currentValue = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Empty line marks end of headers
            if (line.trim() === '' && headerSection) {
                headerSection = false;
                bodyStartIndex = i + 1;
                continue;
            }
            
            if (headerSection) {
                // Check if this is a continuation line (starts with whitespace)
                if (line.match(/^\s+/) && currentHeader) {
                    currentValue += ' ' + line.trim();
                } else {
                    // Save previous header
                    if (currentHeader) {
                        headers[currentHeader.toLowerCase()] = currentValue.trim();
                    }
                    
                    // Parse new header
                    const colonIndex = line.indexOf(':');
                    if (colonIndex > 0) {
                        currentHeader = line.substring(0, colonIndex).trim().toLowerCase();
                        currentValue = line.substring(colonIndex + 1).trim();
                    }
                }
            }
        }
        
        // Save last header
        if (currentHeader) {
            headers[currentHeader.toLowerCase()] = currentValue.trim();
        }
        
        // Extract body
        const bodyLines = lines.slice(bodyStartIndex);
        const body = bodyLines.join('\n');
        
        return {
            headers,
            body,
            raw: emlContent
        };
    }
    
    /**
     * Extract DKIM signature from email headers
     * @param {Object} email - Parsed email object
     * @returns {Object} DKIM signature components
     */
    static extractDKIMSignature(email) {
        const dkimHeader = email.headers['dkim-signature'];
        if (!dkimHeader) {
            throw new Error('DKIM-Signature header not found');
        }
        
        // Parse DKIM signature fields
        const dkimFields = {};
        const parts = dkimHeader.split(';');
        
        for (const part of parts) {
            const eqIndex = part.indexOf('=');
            if (eqIndex > 0) {
                const key = part.substring(0, eqIndex).trim();
                let value = part.substring(eqIndex + 1).trim();
                
                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                
                dkimFields[key] = value;
            }
        }
        
        // Extract signature bytes (base64 encoded)
        const signatureBase64 = dkimFields.b || '';
        const signatureBytes = Buffer.from(signatureBase64.replace(/\s/g, ''), 'base64');
        
        // Extract body hash (bh field)
        const bodyHashBase64 = dkimFields.bh || '';
        const bodyHash = Buffer.from(bodyHashBase64.replace(/\s/g, ''), 'base64');
        
        return {
            version: dkimFields.v || '1',
            algorithm: dkimFields.a || 'rsa-sha256',
            domain: dkimFields.d || '',
            selector: dkimFields.s || '',
            canonicalization: dkimFields.c || 'relaxed/relaxed',
            headers: dkimFields.h ? dkimFields.h.split(':') : [],
            bodyHash: bodyHashBase64.replace(/\s/g, ''),
            bodyHashBytes: bodyHash,
            signature: signatureBase64.replace(/\s/g, ''),
            signatureBytes: signatureBytes,
            queryMethod: dkimFields.q || 'dns/txt',
            raw: dkimHeader
        };
    }
    
    /**
     * Extract From header from email
     * @param {Object} email - Parsed email object
     * @returns {string} From header value
     */
    static extractFromHeader(email) {
        const fromHeader = email.headers['from'];
        if (!fromHeader) {
            throw new Error('From header not found');
        }
        
        // Extract email address from From header (handles "Name <email@domain.com>" format)
        const emailMatch = fromHeader.match(/<([^>]+)>/) || fromHeader.match(/([^\s<>]+@[^\s<>]+)/);
        if (emailMatch) {
            return emailMatch[1];
        }
        
        return fromHeader.trim();
    }
    
    /**
     * Canonicalize email for DKIM verification
     * @param {Object} email - Parsed email object
     * @param {string} canonicalization - Canonicalization method (relaxed/simple)
     * @returns {string} Canonicalized email
     */
    static canonicalizeEmail(email, canonicalization = 'relaxed') {
        // For relaxed canonicalization:
        // - Convert header field names to lowercase
        // - Unfold header field continuation lines
        // - Convert sequences of one or more WSP characters to a single SP
        // - Delete all WSP characters at the end of each unfolded header field value
        // - Delete any WSP characters remaining before and after the colon separating the header field name from the header field value
        
        // For body:
        // - Ignore all whitespace at the end of lines
        // - Reduce all sequences of WSP within a line to a single SP character
        // - Ignore all empty lines at the end of the message body
        
        // Simplified implementation - in production, follow RFC 6376 exactly
        const lines = email.raw.split('\n');
        const headerEndIndex = lines.findIndex(line => line.trim() === '');
        
        if (headerEndIndex === -1) {
            throw new Error('Invalid email format');
        }
        
        // Canonicalize headers
        const canonicalHeaders = [];
        for (let i = 0; i < headerEndIndex; i++) {
            let line = lines[i];
            
            if (canonicalization === 'relaxed') {
                // Convert to lowercase and normalize whitespace
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    const name = line.substring(0, colonIndex).trim().toLowerCase();
                    const value = line.substring(colonIndex + 1).trim().replace(/\s+/g, ' ');
                    line = name + ':' + value;
                }
            }
            
            canonicalHeaders.push(line);
        }
        
        // Canonicalize body
        const bodyLines = lines.slice(headerEndIndex + 1);
        let canonicalBody = '';
        
        if (canonicalization === 'relaxed') {
            for (const line of bodyLines) {
                // Remove trailing whitespace
                const trimmed = line.replace(/\s+$/, '');
                // Replace multiple spaces with single space
                const normalized = trimmed.replace(/\s+/g, ' ');
                canonicalBody += normalized + '\r\n';
            }
            // Remove trailing empty lines
            canonicalBody = canonicalBody.replace(/\r\n+$/, '');
        } else {
            canonicalBody = bodyLines.join('\r\n');
        }
        
        return {
            headers: canonicalHeaders.join('\r\n'),
            body: canonicalBody
        };
    }
    
    /**
     * Compute email hash for DKIM verification
     * @param {Object} email - Parsed email object
     * @param {Array<string>} headerList - List of headers to hash (from DKIM h= field)
     * @returns {Buffer} SHA-256 hash of canonicalized headers and body
     */
    static computeEmailHash(email, headerList = ['date', 'from', 'to', 'message-id', 'subject', 'mime-version']) {
        const canonical = this.canonicalizeEmail(email, 'relaxed');
        
        // Build header string in order specified by headerList
        const headerStrings = [];
        for (const headerName of headerList) {
            const headerValue = email.headers[headerName.toLowerCase()];
            if (headerValue) {
                headerStrings.push(`${headerName.toLowerCase()}:${headerValue.trim()}`);
            }
        }
        
        const headerString = headerStrings.join('\r\n') + '\r\n';
        
        // Compute body hash
        const bodyHash = crypto.createHash('sha256').update(canonical.body).digest();
        
        // Compute header hash (simplified - in production, follow RFC 6376 exactly)
        const headerHash = crypto.createHash('sha256').update(headerString).digest();
        
        return {
            headerHash: headerHash.toString('hex'),
            bodyHash: bodyHash.toString('hex'),
            bodyHashBase64: bodyHash.toString('base64')
        };
    }
    
    /**
     * Verify DKIM RSA signature and extract hash from signature
     * This performs the actual RSA verification: signature^e mod n
     * 
     * IMPORTANT: Full RSA-2048 verification requires:
     * 1. DNS lookup to fetch public key: {selector}._domainkey.{domain}
     * 2. Parse DNS TXT record to extract modulus and exponent
     * 3. Decrypt RSA signature: signature^e mod n
     * 4. Extract hash from decrypted signature (PKCS#1 v1.5 padding)
     * 
     * Due to complexity and DNS dependency, this is a prototype implementation.
     * 
     * @param {Object} dkim - DKIM signature data
     * @param {Object} email - Parsed email object
     * @param {Object} computedEmailHash - Pre-computed email hash from computeEmailHash()
     * @returns {Object} Verification result and extracted hash
     */
    static async verifyDKIMSignatureAndExtractHash(dkim, email, computedEmailHash) {
        try {
            // Step 1: Verify body hash matches (computed vs DKIM claim)
            const computedBodyHashBase64 = computedEmailHash.bodyHashBase64;
            const dkimBodyHashBase64 = dkim.bodyHash;
            
            if (computedBodyHashBase64 !== dkimBodyHashBase64) {
                throw new Error(`Body hash mismatch: computed=${computedBodyHashBase64.substring(0, 20)}..., dkim=${dkimBodyHashBase64.substring(0, 20)}...`);
            }
            
            console.log(`[DKIM] ✅ Body hash verified: matches DKIM claim`);
            
            // Step 2: Attempt RSA signature verification
            // For full verification, we would:
            // 1. Fetch public key from DNS: ${dkim.selector}._domainkey.${dkim.domain}
            // 2. Parse DNS TXT record (format: "v=DKIM1; k=rsa; p=<base64-modulus>")
            // 3. Decrypt signature: signature^e mod n (using Node.js crypto.verify or bigint math)
            // 4. Extract hash from decrypted signature (remove PKCS#1 v1.5 padding)
            // 5. Compare extracted hash with computed header hash
            
            // DNS lookup would be:
            // const dnsQuery = `${dkim.selector}._domainkey.${dkim.domain}`;
            // const txtRecords = await dns.resolveTxt(dnsQuery);
            // const publicKeyRecord = txtRecords[0].join('');
            // Parse: v=DKIM1; k=rsa; p=<base64-modulus>
            
            // RSA decryption would be:
            // const signatureBuffer = Buffer.from(dkim.signature, 'base64');
            // const publicKey = crypto.createPublicKey({ key: parsedKey, type: 'spki' });
            // const decrypted = crypto.publicDecrypt(publicKey, signatureBuffer);
            // Extract hash from decrypted buffer (skip PKCS#1 padding)
            
            console.log(`[DKIM] ⚠️  RSA signature verification not fully implemented (requires DNS lookup)`);
            console.log(`[DKIM]    Would verify: signature^e mod n matches header hash`);
            console.log(`[DKIM]    Current: Using body hash (verified to match DKIM claim)`);
            
            // For now, use body hash as signature hash
            // In full implementation, this would be the hash extracted from RSA signature
            const bodyHashFromDKIM = Buffer.from(dkim.bodyHash, 'base64');
            
            return {
                bodyHashVerified: true, // Body hash matches
                rsaSignatureVerified: false, // RSA signature not verified (DNS lookup required)
                extractedHash: bodyHashFromDKIM,
                extractedHashHex: bodyHashFromDKIM.toString('hex'),
                extractedHashBase64: dkim.bodyHash,
                note: 'Using body hash as signature hash. Full RSA verification requires DNS lookup and RSA-2048 decryption.'
            };
        } catch (error) {
            throw new Error(`DKIM signature verification failed: ${error.message}`);
        }
    }
    
    /**
     * Prepare circuit inputs from parsed email
     * @param {Object} email - Parsed email object
     * @param {string|number} orderId - Order ID to include in proof
     * @returns {Object} Circuit inputs
     */
    static prepareCircuitInputs(email, orderId) {
        const dkim = this.extractDKIMSignature(email);
        const fromHeader = this.extractFromHeader(email);
        const emailHash = this.computeEmailHash(email, dkim.headers);
        
        // Convert signature bytes to array of BigInts (for circuit)
        const signatureBytes = dkim.signatureBytes;
        const signatureArray = [];
        for (let i = 0; i < signatureBytes.length; i++) {
            signatureArray.push(signatureBytes[i].toString());
        }
        
        // Convert From header to byte array
        const fromHeaderBytes = Buffer.from(fromHeader, 'utf8');
        const fromHeaderArray = [];
        for (let i = 0; i < fromHeaderBytes.length; i++) {
            fromHeaderArray.push(fromHeaderBytes[i].toString());
        }
        
        // Note: Public key modulus and exponent would need to be fetched from DNS
        // For now, we'll need to provide them separately
        // Google's DKIM public key would be fetched from: {selector}._domainkey.{domain}
        
        return {
            // Public inputs
            emailHash: emailHash.bodyHash,
            fromHeaderHash: crypto.createHash('sha256').update(fromHeader).digest('hex'),
            orderId: orderId.toString(),
            
            // Private inputs
            dkimSignature: signatureArray,
            fromHeader: fromHeaderArray,
            fromHeaderString: fromHeader,
            
            // Metadata
            dkim: dkim,
            emailHashData: emailHash
        };
    }
}

module.exports = EmailParser;

