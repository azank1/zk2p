// On-Chain Transaction Builder for ZK2P Market Program
// This module creates Solana transactions to interact with the deployed Market program

// Wait for dependencies to load
(function() {
    'use strict';
    
// Program instruction discriminators (first 8 bytes of instruction data)
// These are derived from the Anchor instruction name hash
const INSTRUCTIONS = {
    PLACE_LIMIT_ORDER: Buffer.from([0x8a, 0x19, 0x37, 0x4e, 0x49, 0x6c, 0x63, 0x0a]), // place_limit_order_v2
    CANCEL_ORDER: Buffer.from([0x3d, 0x7a, 0x8f, 0x11, 0x2b, 0x5e, 0x91, 0xc4]), // cancel_order
};

// Order types
const OrderType = {
    LIMIT: 0,
    MARKET: 1,
    POST_ONLY: 2,
    IOC: 3,  // Immediate or Cancel
    FOK: 4,  // Fill or Kill
};

// Order sides
const Side = {
    BID: { bid: {} },
    ASK: { ask: {} },
};

/**
 * Build instruction data for place_limit_order_v2
 * 
 * Instruction layout:
 * - Discriminator: 8 bytes
 * - Side: 1 byte (0 = Bid, 1 = Ask)
 * - Price: 8 bytes (u64, little-endian)
 * - Quantity: 8 bytes (u64, little-endian)  
 * - OrderType: 1 byte
 * - ClientOrderId: 16 bytes (u128, little-endian)
 * - PaymentMethod: String (4 bytes length + data)
 */
function buildPlaceOrderInstruction(side, price, quantity, orderType, clientOrderId, paymentMethod) {
    const buffers = [];
    
    // 1. Discriminator (8 bytes)
    buffers.push(INSTRUCTIONS.PLACE_LIMIT_ORDER);
    
    // 2. Side (1 byte: 0 = Bid, 1 = Ask)
    const sideBuffer = Buffer.alloc(1);
    sideBuffer.writeUInt8(side === 'ask' ? 1 : 0, 0);
    buffers.push(sideBuffer);
    
    // 3. Price (8 bytes, u64 little-endian)
    const priceBuffer = Buffer.alloc(8);
    priceBuffer.writeBigUInt64LE(BigInt(price), 0);
    buffers.push(priceBuffer);
    
    // 4. Quantity (8 bytes, u64 little-endian)
    const quantityBuffer = Buffer.alloc(8);
    quantityBuffer.writeBigUInt64LE(BigInt(quantity), 0);
    buffers.push(quantityBuffer);
    
    // 5. Order Type (1 byte)
    const orderTypeBuffer = Buffer.alloc(1);
    orderTypeBuffer.writeUInt8(orderType, 0);
    buffers.push(orderTypeBuffer);
    
    // 6. Client Order ID (16 bytes, u128 little-endian)
    const clientIdBuffer = Buffer.alloc(16);
    clientIdBuffer.writeBigUInt64LE(BigInt(clientOrderId), 0);
    buffers.push(clientIdBuffer);
    
    // 7. Payment Method (length-prefixed string)
    const paymentBytes = Buffer.from(paymentMethod, 'utf8');
    const paymentLengthBuffer = Buffer.alloc(4);
    paymentLengthBuffer.writeUInt32LE(paymentBytes.length, 0);
    buffers.push(paymentLengthBuffer);
    buffers.push(paymentBytes);
    
    return Buffer.concat(buffers);
}

/**
 * Create a transaction to place an order on-chain
 * 
 * @param {object} params
 * @param {solanaWeb3.Connection} params.connection - Solana RPC connection
 * @param {solanaWeb3.PublicKey} params.programId - Market program ID
 * @param {solanaWeb3.PublicKey} params.wallet - User's wallet public key
 * @param {solanaWeb3.PublicKey} params.tokenMint - SPL token mint
 * @param {solanaWeb3.PublicKey} params.userTokenAccount - User's token account
 * @param {string} params.side - 'ask' or 'bid'
 * @param {number} params.price - Order price
 * @param {number} params.quantity - Order quantity
 * @param {number} params.orderType - Order type (0-4)
 * @param {string} params.paymentMethod - Payment method string
 */
async function createPlaceOrderTransaction({
    connection,
    programId,
    wallet,
    tokenMint,
    userTokenAccount,
    side,
    price,
    quantity,
    orderType,
    paymentMethod
}) {
    // Derive PDAs
    const [market] = await solanaWeb3.PublicKey.findProgramAddress(
        [Buffer.from('market'), tokenMint.toBuffer()],
        programId
    );
    
    const [orderBook] = await solanaWeb3.PublicKey.findProgramAddress(
        [Buffer.from('order_book'), tokenMint.toBuffer()],
        programId
    );
    
    const [escrowVault] = await solanaWeb3.PublicKey.findProgramAddress(
        [Buffer.from('escrow_vault'), tokenMint.toBuffer()],
        programId
    );
    
    const [escrowAuthority] = await solanaWeb3.PublicKey.findProgramAddress(
        [Buffer.from('escrow_authority'), tokenMint.toBuffer()],
        programId
    );
    
    // Build instruction data
    const clientOrderId = Date.now(); // Use timestamp as unique ID
    const instructionData = buildPlaceOrderInstruction(
        side,
        price,
        quantity,
        orderType,
        clientOrderId,
        paymentMethod
    );
    
    // Build accounts array (order must match program's account list)
    const keys = [
        { pubkey: wallet, isSigner: true, isWritable: true },                    // owner
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },        // owner_token_account
        { pubkey: escrowVault, isSigner: false, isWritable: true },             // escrow_vault
        { pubkey: escrowAuthority, isSigner: false, isWritable: false },        // escrow_authority
        { pubkey: market, isSigner: false, isWritable: true },                  // market
        { pubkey: orderBook, isSigner: false, isWritable: true },               // order_book
        { pubkey: solanaWeb3.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
        { pubkey: tokenMint, isSigner: false, isWritable: false },              // token_mint
        { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ];
    
    // Create instruction
    const instruction = new solanaWeb3.TransactionInstruction({
        keys,
        programId,
        data: instructionData
    });
    
    // Create transaction
    const transaction = new solanaWeb3.Transaction().add(instruction);
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet;
    
    return transaction;
}

/**
 * Helper: Get or create associated token account
 */
async function getOrCreateTokenAccount(connection, wallet, tokenMint) {
    try {
        // Derive the ATA (Associated Token Account) address
        const TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
        const ASSOCIATED_TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
        
        const [ata] = await solanaWeb3.PublicKey.findProgramAddress(
            [
                wallet.toBuffer(),
                TOKEN_PROGRAM_ID.toBuffer(),
                tokenMint.toBuffer(),
            ],
            ASSOCIATED_TOKEN_PROGRAM_ID
        );
        
        // Check if ATA exists
        const accountInfo = await connection.getAccountInfo(ata);
        
        if (!accountInfo) {
            console.log(`[ATA] Associated token account not found for ${wallet.toString()}`);
            console.log(`[ATA] Derived ATA: ${ata.toString()}`);
            console.log(`[ATA] NOTE: The account needs to be created. The transaction may fail.`);
            console.log(`[ATA] Please create it manually or ensure it exists before placing orders.`);
        }
        
        return ata;
        
    } catch (error) {
        console.error('[ATA] Error getting token account:', error);
        throw error;
    }
}

/**
 * P2P Payment Status Tracking Functions
 * These handle the fiat settlement flow with stub ZK verification
 */

let currentMatchedOrderId = null;

/**
 * Mark payment as made (called by buyer after off-chain fiat transfer)
 */
async function markPaymentMade(orderId) {
    if (!window.phantomWallet || !window.connectedPubkey) {
        if (window.log) window.log('[Payment] Please connect Phantom wallet first', 'error');
        return;
    }
    
    try {
        if (window.log) window.log('[Payment] Marking payment as made...', 'info');
        
        // Show settlement timer in UI
        const markPaidBtn = document.getElementById('markPaidBtn');
        const settlementTimer = document.getElementById('settlementTimer');
        const paymentStatus = document.getElementById('paymentStatus');
        
        if (markPaidBtn) markPaidBtn.style.display = 'none';
        if (settlementTimer) settlementTimer.style.display = 'block';
        if (paymentStatus) paymentStatus.textContent = 'Payment marked. Verifying...';
        
        // Start 10-second countdown
        startSettlementTimer(orderId || currentMatchedOrderId);
        
    } catch (error) {
        if (window.log) window.log(`[Payment] Error marking payment: ${error.message}`, 'error');
    }
}

/**
 * 10-second countdown timer for settlement delay
 */
function startSettlementTimer(orderId) {
    let countdown = 10;
    document.getElementById('countdown').textContent = countdown;
    
    const timer = setInterval(() => {
        countdown--;
        document.getElementById('countdown').textContent = countdown;
        
        if (countdown <= 0) {
            clearInterval(timer);
            verifySettlement(orderId);
        }
    }, 1000);
}

/**
 * Auto-verify settlement after delay (stub ZK proof verification)
 */
async function verifySettlement(orderId) {
    try {
        if (window.log) {
            window.log('[Settlement] 10-second delay expired. Verifying payment...', 'info');
            window.log('[Settlement] In production: ZK proof would be validated here', 'warning');
        }
        
        // Update UI to show verification complete
        const settlementTimer = document.getElementById('settlementTimer');
        const paymentStatus = document.getElementById('paymentStatus');
        
        if (settlementTimer) settlementTimer.style.display = 'none';
        if (paymentStatus) {
            paymentStatus.textContent = '✅ Payment Verified (Stub ZK)';
            paymentStatus.style.color = '#00ff88';
        }
        
        if (window.log) {
            window.log('[Settlement] Payment verified! Tokens released to seller.', 'success');
            window.log('[Settlement] Transaction would be sent on-chain in production', 'info');
        }
        
        // Auto-hide payment section after 5 seconds
        setTimeout(() => {
            const paymentSection = document.getElementById('paymentSection');
            if (paymentSection) paymentSection.style.display = 'none';
        }, 5000);
        
    } catch (error) {
        if (window.log) window.log(`[Settlement] Verification failed: ${error.message}`, 'error');
    }
}

/**
 * Show payment section when order is matched
 */
function showPaymentSection(isBuyer, orderId) {
    currentMatchedOrderId = orderId;
    const section = document.getElementById('paymentSection');
    const markPaidBtn = document.getElementById('markPaidBtn');
    const status = document.getElementById('paymentStatus');
    
    if (section) section.style.display = 'block';
    
    if (isBuyer) {
        if (status) status.textContent = 'Order matched! Please transfer fiat payment off-chain.';
        if (markPaidBtn) markPaidBtn.style.display = 'block';
        if (window.log) window.log('[Payment] You are the BUYER. Mark payment after sending fiat.', 'warning');
    } else {
        if (status) status.textContent = 'Order matched! Waiting for buyer to send payment...';
        if (markPaidBtn) markPaidBtn.style.display = 'none';
        if (window.log) window.log('[Payment] You are the SELLER. Waiting for buyer payment...', 'info');
    }
}

/**
 * Identify wallet role (seller or buyer) based on connected address
 */
async function identifyWalletRole() {
    // Use the global variables from index.html
    if (!window.connectedPubkey) return null;
    
    try {
        // Use appConfig loaded in index.html, or load it here
        let config = window.appConfig;
        if (!config) {
            const response = await fetch('config.json');
            config = await response.json();
        }
        
        const sellerAddress = config.sellerAddress || '3zWJav4zdy86ZFkZd2iNoF93h28Q5iT2CWGmApjbh6Ue';
        const buyerAddress = config.buyerAddress || 'BYvrTqzdLAFnyfbNQW7kR6K9vvg3e8119VwxeLDxejhf';
        
        let role = 'Unknown';
        if (window.connectedPubkey === sellerAddress) {
            role = 'Seller';
        } else if (window.connectedPubkey === buyerAddress) {
            role = 'Buyer';
        }
        
        // Update UI
        const walletRoleDiv = document.getElementById('walletRole');
        const walletRoleText = document.getElementById('walletRoleText');
        if (walletRoleDiv && walletRoleText) {
            walletRoleText.textContent = role;
            walletRoleDiv.style.display = 'block';
        }
        
        return role;
    } catch (error) {
        console.warn('Could not identify wallet role:', error);
        return null;
    }
}

// Export for use in index.html
if (typeof window !== 'undefined') {
    window.ZK2P = {
        createPlaceOrderTransaction,
        getOrCreateTokenAccount,
        OrderType,
        Side,
        markPaymentMade,
        showPaymentSection,
        identifyWalletRole
    };
    console.log('[ZK2P] Transaction module loaded successfully');
}

})(); // End of IIFE
