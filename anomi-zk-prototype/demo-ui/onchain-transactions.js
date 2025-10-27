// On-Chain Transaction Builder for ZK2P Market Program
// This module creates Solana transactions to interact with the deployed Market program

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
    // For simplicity, derive the ATA (Associated Token Account)
    const [ata] = await solanaWeb3.PublicKey.findProgramAddress(
        [
            wallet.toBuffer(),
            solanaWeb3.TOKEN_PROGRAM_ID.toBuffer(),
            tokenMint.toBuffer(),
        ],
        new solanaWeb3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL') // SPL Associated Token Program
    );
    
    return ata;
}

// Export for use in index.html
if (typeof window !== 'undefined') {
    window.ZK2P = {
        createPlaceOrderTransaction,
        getOrCreateTokenAccount,
        OrderType,
        Side
    };
}

