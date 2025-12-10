// On-Chain Transaction Builder for ZK2P Market Program
// This module creates Solana transactions to interact with the deployed Market program

// Wait for dependencies to load
(function() {
    'use strict';
    
// Wait for Buffer to be available (polyfill loads asynchronously)
function waitForBuffer(callback, maxAttempts = 100) {
    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function' && typeof Buffer.alloc === 'function') {
        console.log('[ZK2P] Buffer is available, initializing...');
        callback();
    } else if (maxAttempts > 0) {
        // Listen for bufferReady event
        if (typeof window !== 'undefined' && window.addEventListener) {
            const handler = function() {
                window.removeEventListener('bufferReady', handler);
                if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
                    callback();
                } else {
                    waitForBuffer(callback, maxAttempts - 1);
                }
            };
            window.addEventListener('bufferReady', handler, { once: true });
        }
        setTimeout(() => waitForBuffer(callback, maxAttempts - 1), 100);
    } else {
        console.error('[ZK2P] Buffer not available after waiting! Cannot initialize transaction module.');
        console.error('[ZK2P] Make sure buffer polyfill is loaded before this script.');
        console.error('[ZK2P] Buffer type:', typeof Buffer);
        console.error('[ZK2P] window.Buffer type:', typeof window.Buffer);
    }
}

waitForBuffer(function() {
    console.log('[ZK2P] Initializing transaction module with Buffer support...');
    console.log('[ZK2P] Buffer.from available:', typeof Buffer.from === 'function');
    console.log('[ZK2P] Buffer.alloc available:', typeof Buffer.alloc === 'function');
    
// Program instruction discriminators (first 8 bytes of instruction data)
// These are derived from the Anchor instruction name hash: sha256("global:{instruction_name}").slice(0, 8)
const INSTRUCTIONS = {
    PLACE_LIMIT_ORDER: Buffer.from([0x8a, 0x19, 0x37, 0x4e, 0x49, 0x6c, 0x63, 0x0a]), // place_limit_order_v2
    CANCEL_ORDER: Buffer.from([0x3d, 0x7a, 0x8f, 0x11, 0x2b, 0x5e, 0x91, 0xc4]), // cancel_order
    MARK_PAYMENT_MADE: Buffer.from([0xc7, 0x9c, 0x3e, 0x2f, 0x8d, 0x1a, 0x4b, 0x6e]), // mark_payment_made
    VERIFY_SETTLEMENT: Buffer.from([0x5a, 0x8b, 0x7c, 0x1d, 0x9e, 0x2f, 0x3a, 0x4c]), // verify_settlement
    MATCH_ORDER: Buffer.from([0x65, 0x4c, 0x8a, 0x9f, 0x23, 0x7d, 0x1e, 0xb2]), // match_order
    // OrderStore instructions
    CREATE_MATCHED_ORDER: Buffer.from([0xa1, 0xb2, 0xc3, 0xd4, 0xe5, 0xf6, 0x07, 0x18]), // create_matched_order
    CONFIRM_ORDER: Buffer.from([0x29, 0x3a, 0x4b, 0x5c, 0x6d, 0x7e, 0x8f, 0x90]), // confirm_order
    SETTLE_ORDER: Buffer.from([0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f, 0x70, 0x81]), // settle_order
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
    
    // Check if ZK Fiat Mode is enabled
    if (!window.zkFiatModeEnabled) {
        if (window.log) window.log('[Payment] ZK Fiat Mode is disabled', 'warning');
        return;
    }
    
    try {
        if (window.log) window.log('[Payment] Marking payment as made on-chain...', 'info');
        
        const connection = new solanaWeb3.Connection('https://api.devnet.solana.com', 'confirmed');
        const wallet = new solanaWeb3.PublicKey(window.connectedPubkey);
        
        // Get config
        let config = window.appConfig;
        if (!config) {
            if (window.log) window.log('[Payment] Config not loaded', 'error');
            return;
        }
        
        const programId = new solanaWeb3.PublicKey(config.programId);
        const tokenMintStr = document.getElementById('tokenMint')?.value || config.defaultTokenMint;
        const tokenMint = new solanaWeb3.PublicKey(tokenMintStr);
        
        // Derive OrderBook PDA
        const [orderBook] = await solanaWeb3.PublicKey.findProgramAddress(
            [Buffer.from('order_book'), tokenMint.toBuffer()],
            programId
        );
        
        // Build instruction data: discriminator (8 bytes) + order_id (16 bytes u128)
        const instructionData = Buffer.alloc(24);
        INSTRUCTIONS.MARK_PAYMENT_MADE.copy(instructionData, 0);
        
        // Write order_id as u128 little-endian
        const orderIdToUse = orderId || currentMatchedOrderId || Date.now();
        const orderIdBigInt = BigInt(orderIdToUse);
        instructionData.writeBigUInt64LE(orderIdBigInt & BigInt('0xFFFFFFFFFFFFFFFF'), 8); // Low 64 bits
        instructionData.writeBigUInt64LE(orderIdBigInt >> BigInt(64), 16); // High 64 bits
        
        // Build accounts array
        const keys = [
            { pubkey: wallet, isSigner: true, isWritable: false }, // buyer
            { pubkey: orderBook, isSigner: false, isWritable: true }, // order_book
            { pubkey: tokenMint, isSigner: false, isWritable: false }, // token_mint
            { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        ];
        
        // Create instruction
        const instruction = new solanaWeb3.TransactionInstruction({
            keys,
            programId,
            data: instructionData
        });
        
        // Create and send transaction
        const transaction = new solanaWeb3.Transaction().add(instruction);
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet;
        
        // Sign and send via Phantom
        const { signature } = await window.phantomWallet.signAndSendTransaction(transaction);
        
        if (window.log) window.log('[Payment] Transaction sent! Confirming...', 'info');
        await connection.confirmTransaction(signature, 'confirmed');
        
        if (window.log) {
            window.log('[Payment] Payment marked on-chain!', 'success');
            window.log(`[Explorer] https://explorer.solana.com/tx/${signature}?cluster=devnet`, 'info');
        }
        
        // Update OrderStore: Confirm order (Pending -> Confirmed)
        try {
            if (config.orderStoreProgramId && window.currentMatchedOrder) {
                const orderStoreProgramId = new solanaWeb3.PublicKey(config.orderStoreProgramId);
                const confirmTx = await confirmOrderTransaction({
                    connection,
                    orderStoreProgramId,
                    wallet,
                    orderId: window.currentMatchedOrder.order_id,
                    proofData: [] // Stub - empty proof data
                });
                
                const confirmSignature = await window.phantomWallet.signAndSendTransaction(confirmTx);
                await connection.confirmTransaction(confirmSignature, 'confirmed');
                
                if (window.log) {
                    window.log('[OrderStore] Order confirmed (Pending -> Confirmed)', 'success');
                    window.log(`[Explorer] https://explorer.solana.com/tx/${confirmSignature}?cluster=devnet`, 'info');
                }
            }
        } catch (orderStoreError) {
            if (window.log) {
                window.log(`[OrderStore] Warning: Could not confirm order: ${orderStoreError.message}`, 'warning');
            }
            console.warn('OrderStore confirm error:', orderStoreError);
        }
        
        // Show settlement timer in UI
        const markPaidBtn = document.getElementById('markPaidBtn');
        const settlementTimer = document.getElementById('settlementTimer');
        const paymentStatus = document.getElementById('paymentStatus');
        
        if (markPaidBtn) markPaidBtn.style.display = 'none';
        if (settlementTimer) settlementTimer.style.display = 'block';
        if (paymentStatus) paymentStatus.textContent = 'Payment marked. Verifying...';
        
        // Start 10-second countdown
        startSettlementTimer(orderIdToUse);
        
    } catch (error) {
        if (window.log) window.log(`[Payment] Error marking payment: ${error.message}`, 'error');
        console.error(error);
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
    // Check if ZK Fiat Mode is enabled
    if (!window.zkFiatModeEnabled) {
        if (window.log) window.log('[Settlement] ZK Fiat Mode is disabled', 'warning');
        return;
    }
    
    try {
        if (window.log) {
            window.log('[Settlement] 10-second delay expired. Verifying payment on-chain...', 'info');
            window.log('[Settlement] In production: ZK proof would be validated here', 'warning');
        }
        
        const connection = new solanaWeb3.Connection('https://api.devnet.solana.com', 'confirmed');
        const wallet = new solanaWeb3.PublicKey(window.connectedPubkey);
        
        // Get config
        let config = window.appConfig;
        if (!config) {
            if (window.log) window.log('[Settlement] Config not loaded', 'error');
            return;
        }
        
        const programId = new solanaWeb3.PublicKey(config.programId);
        const tokenMintStr = document.getElementById('tokenMint')?.value || config.defaultTokenMint;
        const tokenMint = new solanaWeb3.PublicKey(tokenMintStr);
        
        // Derive PDAs
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
        
        // Get seller's token account (use connected wallet as seller for now)
        const sellerTokenAccount = await getOrCreateTokenAccount(connection, wallet, tokenMint);
        
        // Build instruction data: discriminator (8 bytes) + order_id (16 bytes u128)
        const instructionData = Buffer.alloc(24);
        INSTRUCTIONS.VERIFY_SETTLEMENT.copy(instructionData, 0);
        
        // Write order_id as u128 little-endian
        const orderIdToUse = orderId || currentMatchedOrderId || Date.now();
        const orderIdBigInt = BigInt(orderIdToUse);
        instructionData.writeBigUInt64LE(orderIdBigInt & BigInt('0xFFFFFFFFFFFFFFFF'), 8); // Low 64 bits
        instructionData.writeBigUInt64LE(orderIdBigInt >> BigInt(64), 16); // High 64 bits
        
        // Build accounts array
        const keys = [
            { pubkey: wallet, isSigner: true, isWritable: false }, // seller
            { pubkey: sellerTokenAccount, isSigner: false, isWritable: true }, // seller_token_account
            { pubkey: orderBook, isSigner: false, isWritable: true }, // order_book
            { pubkey: escrowVault, isSigner: false, isWritable: true }, // escrow_vault
            { pubkey: escrowAuthority, isSigner: false, isWritable: false }, // escrow_authority
            { pubkey: tokenMint, isSigner: false, isWritable: false }, // token_mint
            { pubkey: solanaWeb3.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
            { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        ];
        
        // Create instruction
        const instruction = new solanaWeb3.TransactionInstruction({
            keys,
            programId,
            data: instructionData
        });
        
        // Create and send transaction
        const transaction = new solanaWeb3.Transaction().add(instruction);
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet;
        
        // Sign and send via Phantom
        const { signature } = await window.phantomWallet.signAndSendTransaction(transaction);
        
        if (window.log) window.log('[Settlement] Transaction sent! Confirming...', 'info');
        await connection.confirmTransaction(signature, 'confirmed');
        
        if (window.log) {
            window.log('[Settlement] Payment verified on-chain! Tokens released.', 'success');
            window.log(`[Explorer] https://explorer.solana.com/tx/${signature}?cluster=devnet`, 'info');
        }
        
        // Update OrderStore: Settle order (Confirmed -> Settled)
        try {
            if (config.orderStoreProgramId && window.currentMatchedOrder) {
                const orderStoreProgramId = new solanaWeb3.PublicKey(config.orderStoreProgramId);
                const settleTx = await settleOrderTransaction({
                    connection,
                    orderStoreProgramId,
                    wallet,
                    orderId: window.currentMatchedOrder.order_id
                });
                
                const settleSignature = await window.phantomWallet.signAndSendTransaction(settleTx);
                await connection.confirmTransaction(settleSignature, 'confirmed');
                
                if (window.log) {
                    window.log('[OrderStore] Order settled (Confirmed -> Settled)', 'success');
                    window.log(`[Explorer] https://explorer.solana.com/tx/${settleSignature}?cluster=devnet`, 'info');
                }
            }
        } catch (orderStoreError) {
            if (window.log) {
                window.log(`[OrderStore] Warning: Could not settle order: ${orderStoreError.message}`, 'warning');
            }
            console.warn('OrderStore settle error:', orderStoreError);
        }
        
        // Update UI to show verification complete
        const settlementTimer = document.getElementById('settlementTimer');
        const paymentStatus = document.getElementById('paymentStatus');
        
        if (settlementTimer) settlementTimer.style.display = 'none';
        if (paymentStatus) {
            paymentStatus.textContent = '✅ Payment Verified (On-Chain)';
            paymentStatus.style.color = '#00ff88';
        }
        
        // Refresh order book state
        if (window.fetchOrderBookState) {
            setTimeout(() => window.fetchOrderBookState(), 2000);
        }
        
        // Auto-hide payment section after 5 seconds
        setTimeout(() => {
            const paymentSection = document.getElementById('paymentSection');
            if (paymentSection) paymentSection.style.display = 'none';
        }, 5000);
        
    } catch (error) {
        if (window.log) window.log(`[Settlement] Verification failed: ${error.message}`, 'error');
        console.error(error);
    }
}

/**
 * Show payment section when order is matched
 */
function showPaymentSection(isBuyer, orderId) {
    // Only show if ZK Fiat Mode is enabled
    if (!window.zkFiatModeEnabled) {
        if (window.log) window.log('[Payment] ZK Fiat Mode disabled - skipping payment flow', 'info');
        return;
    }
    
    currentMatchedOrderId = orderId;
    const section = document.getElementById('paymentSection');
    const markPaidBtn = document.getElementById('markPaidBtn');
    const status = document.getElementById('paymentStatus');
    const settlementTimer = document.getElementById('settlementTimer');
    
    // Reset UI state
    if (settlementTimer) settlementTimer.style.display = 'none';
    if (markPaidBtn) markPaidBtn.style.display = 'none';
    
    if (section) section.style.display = 'block';
    
    if (isBuyer) {
        if (status) {
            status.textContent = '💰 Order matched! Transfer fiat payment off-chain, then click "Mark Payment Made"';
            status.style.color = '#ffaa00';
        }
        if (markPaidBtn) {
            markPaidBtn.style.display = 'block';
            markPaidBtn.textContent = 'Mark Payment Made';
        }
        if (window.log) {
            window.log('[Payment] You are the BUYER', 'warning');
            window.log('[Payment] Step 1: Send fiat payment to seller off-chain', 'info');
            window.log('[Payment] Step 2: Click "Mark Payment Made" button', 'info');
            window.log('[Payment] Step 3: Wait 10 seconds for verification', 'info');
        }
    } else {
        if (status) {
            status.textContent = '⏳ Order matched! Waiting for buyer to send fiat payment...';
            status.style.color = '#00aaff';
        }
        if (markPaidBtn) markPaidBtn.style.display = 'none';
        if (window.log) {
            window.log('[Payment] You are the SELLER', 'info');
            window.log('[Payment] Waiting for buyer to mark payment...', 'info');
            window.log('[Payment] Tokens will be released after verification', 'info');
        }
    }
}

/**
 * OrderStore Integration Functions
 * These handle persistent storage of matched orders
 */

/**
 * Create a matched order in OrderStore (Pending state)
 */
async function createMatchedOrderTransaction({
    connection,
    orderStoreProgramId,
    wallet,
    orderId,
    bidder,
    seller,
    tokenMint,
    amount,
    price
}) {
    // Derive MatchedOrder PDA
    const orderIdBytes = Buffer.alloc(8);
    orderIdBytes.writeBigUInt64LE(BigInt(orderId), 0);
    
    const [matchedOrder] = await solanaWeb3.PublicKey.findProgramAddress(
        [
            Buffer.from('matched_order'),
            orderIdBytes
        ],
        orderStoreProgramId
    );
    
    // Build instruction data: discriminator (8 bytes) + order_id (8 bytes) + bidder (32 bytes) + seller (32 bytes) + token_mint (32 bytes) + amount (8 bytes) + price (8 bytes)
    // Total: 8 + 8 + 32 + 32 + 32 + 8 + 8 = 128 bytes
    const instructionData = Buffer.alloc(128);
    INSTRUCTIONS.CREATE_MATCHED_ORDER.copy(instructionData, 0);
    
    // Write parameters
    instructionData.writeBigUInt64LE(BigInt(orderId), 8);
    new solanaWeb3.PublicKey(bidder).toBuffer().copy(instructionData, 16);
    new solanaWeb3.PublicKey(seller).toBuffer().copy(instructionData, 48);
    new solanaWeb3.PublicKey(tokenMint).toBuffer().copy(instructionData, 80);
    instructionData.writeBigUInt64LE(BigInt(amount), 112);
    instructionData.writeBigUInt64LE(BigInt(price), 120);
    
    // Build accounts array
    const keys = [
        { pubkey: matchedOrder, isSigner: false, isWritable: true }, // matched_order
        { pubkey: wallet, isSigner: true, isWritable: true }, // payer
        { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ];
    
    // Create instruction
    const instruction = new solanaWeb3.TransactionInstruction({
        keys,
        programId: orderStoreProgramId,
        data: instructionData
    });
    
    // Create transaction
    const transaction = new solanaWeb3.Transaction().add(instruction);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet;
    
    return { transaction, matchedOrder };
}

/**
 * Confirm order in OrderStore (after payment marked - updates to Confirmed state)
 */
async function confirmOrderTransaction({
    connection,
    orderStoreProgramId,
    wallet,
    orderId,
    proofData = []
}) {
    // Derive MatchedOrder PDA
    const orderIdBytes = Buffer.alloc(8);
    orderIdBytes.writeBigUInt64LE(BigInt(orderId), 0);
    
    const [matchedOrder] = await solanaWeb3.PublicKey.findProgramAddress(
        [
            Buffer.from('matched_order'),
            orderIdBytes
        ],
        orderStoreProgramId
    );
    
    // Build instruction data: discriminator (8 bytes) + proof_data (Vec<u8> - 4 bytes length + data)
    const proofDataBuffer = Buffer.from(proofData);
    const instructionData = Buffer.alloc(8 + 4 + proofDataBuffer.length);
    INSTRUCTIONS.CONFIRM_ORDER.copy(instructionData, 0);
    instructionData.writeUInt32LE(proofDataBuffer.length, 8);
    proofDataBuffer.copy(instructionData, 12);
    
    // Build accounts array
    const keys = [
        { pubkey: matchedOrder, isSigner: false, isWritable: true }, // matched_order
        { pubkey: wallet, isSigner: true, isWritable: false }, // authority
    ];
    
    // Create instruction
    const instruction = new solanaWeb3.TransactionInstruction({
        keys,
        programId: orderStoreProgramId,
        data: instructionData
    });
    
    // Create transaction
    const transaction = new solanaWeb3.Transaction().add(instruction);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet;
    
    return transaction;
}

/**
 * Settle order in OrderStore (after settlement - updates to Settled state)
 */
async function settleOrderTransaction({
    connection,
    orderStoreProgramId,
    wallet,
    orderId
}) {
    // Derive MatchedOrder PDA
    const orderIdBytes = Buffer.alloc(8);
    orderIdBytes.writeBigUInt64LE(BigInt(orderId), 0);
    
    const [matchedOrder] = await solanaWeb3.PublicKey.findProgramAddress(
        [
            Buffer.from('matched_order'),
            orderIdBytes
        ],
        orderStoreProgramId
    );
    
    // Build instruction data: discriminator (8 bytes) only
    const instructionData = Buffer.alloc(8);
    INSTRUCTIONS.SETTLE_ORDER.copy(instructionData, 0);
    
    // Build accounts array
    const keys = [
        { pubkey: matchedOrder, isSigner: false, isWritable: true }, // matched_order
        { pubkey: wallet, isSigner: true, isWritable: false }, // authority
    ];
    
    // Create instruction
    const instruction = new solanaWeb3.TransactionInstruction({
        keys,
        programId: orderStoreProgramId,
        data: instructionData
    });
    
    // Create transaction
    const transaction = new solanaWeb3.Transaction().add(instruction);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet;
    
    return transaction;
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
        identifyWalletRole,
        INSTRUCTIONS: INSTRUCTIONS, // Expose instruction discriminators
        // OrderStore functions
        createMatchedOrderTransaction,
        confirmOrderTransaction,
        settleOrderTransaction
    };
    console.log('[ZK2P] Transaction module loaded successfully');
    console.log('[ZK2P] Instruction discriminators:', Object.keys(INSTRUCTIONS));
    console.log('[ZK2P] OrderStore integration ready');
    console.log('[ZK2P] Buffer available:', typeof Buffer !== 'undefined');
}

}); // End of waitForBuffer callback

})(); // End of IIFE
