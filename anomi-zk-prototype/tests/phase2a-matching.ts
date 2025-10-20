import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";
import BN from "bn.js";

describe("Phase 2A: Matching Engine", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  
  const provider = anchor.AnchorProvider.env();
  const marketProgram = anchor.workspace.Market as any;
  const orderStoreProgram = anchor.workspace.OrderStore as any;
  
  let tokenMint: PublicKey;
  let seller: Keypair;
  let buyer: Keypair;
  let sellerTokenAccount: PublicKey;
  let buyerTokenAccount: PublicKey;
  let escrowVault: PublicKey;
  let escrowAuthority: PublicKey;
  let orderBook: PublicKey;
  
  before(async () => {
    console.log("\n🔧 Setting up test environment...");
    
    seller = Keypair.generate();
    buyer = Keypair.generate();
    
    // Airdrop SOL
    await provider.connection.requestAirdrop(seller.publicKey, 5e9);
    await provider.connection.requestAirdrop(buyer.publicKey, 5e9);
    await provider.connection.requestAirdrop(provider.wallet.publicKey, 5e9);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Create token mint (seller is mint authority)
    tokenMint = await createMint(
      provider.connection,
      seller,
      seller.publicKey,
      null,
      6
    );
    
    // Create token accounts
    sellerTokenAccount = await createAccount(
      provider.connection,
      seller,
      tokenMint,
      seller.publicKey
    );
    
    buyerTokenAccount = await createAccount(
      provider.connection,
      buyer,
      tokenMint,
      buyer.publicKey
    );
    
    // Mint 1000 tokens to seller
    await mintTo(
      provider.connection,
      seller,
      tokenMint,
      sellerTokenAccount,
      seller.publicKey,
      1000000000
    );
    
    // Derive PDAs
    [escrowVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_vault"), tokenMint.toBuffer()],
      marketProgram.programId
    );
    
    [escrowAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_authority"), tokenMint.toBuffer()],
      marketProgram.programId
    );
    
    [orderBook] = PublicKey.findProgramAddressSync(
      [Buffer.from("order_book"), tokenMint.toBuffer()],
      marketProgram.programId
    );
    
    console.log("✅ Test environment ready");
  });
  
  it("Initializes escrow vault and order book", async () => {
    console.log("\n📦 Test 1: Initialization");
    
    await marketProgram.methods
      .initializeEscrowVault()
      .accounts({
        escrowVault,
        escrowAuthority,
        tokenMint,
        payer: provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    
    await marketProgram.methods
      .initializeOrderBook()
      .accounts({
        orderBook,
        tokenMint,
        payer: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    
    const orderBookAccount = await marketProgram.account.orderBook.fetch(orderBook);
    expect(orderBookAccount.orders.length).to.equal(0);
    
    console.log("✅ Escrow and order book initialized");
  });
  
  it("Places ask order and stores it in order book", async () => {
    console.log("\n📈 Test 2: Ask Order Placement");
    
    const amount = new BN(100000000); // 100 tokens
    const price = new BN(50000);
    const paymentMethod = "Bank Transfer";
    
    await marketProgram.methods
      .placeAskOrder(amount, price, paymentMethod)
      .accounts({
        seller: seller.publicKey,
        sellerTokenAccount,
        escrowVault,
        orderBook,
        tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([seller])
      .rpc();
    
    const orderBookAccount = await marketProgram.account.orderBook.fetch(orderBook);
    expect(orderBookAccount.orders.length).to.equal(1);
    expect(orderBookAccount.orders[0].amount.toString()).to.equal(amount.toString());
    expect(orderBookAccount.orders[0].price.toString()).to.equal(price.toString());
    
    const escrowBalance = await getAccount(provider.connection, escrowVault);
    expect(escrowBalance.amount.toString()).to.equal(amount.toString());
    
    console.log("✅ Ask order placed and escrowed");
  });
  
  it("Matches bid against ask order (CORE TEST)", async () => {
    console.log("\n🎯 Test 3: MATCHING ENGINE - This Proves Phase 2A Works!");
    
    const bidAmount = new BN(50000000); // 50 tokens (partial fill)
    const bidPrice = new BN(50000);
    
    // Derive MatchedOrder PDA
    const [matchedOrderPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("matched_order"),
        buyer.publicKey.toBuffer(),
        seller.publicKey.toBuffer(),
        bidAmount.toArrayLike(Buffer, "le", 8),
        bidPrice.toArrayLike(Buffer, "le", 8),
      ],
      orderStoreProgram.programId
    );
    
    console.log("📋 Creating bid...");
    
    await marketProgram.methods
      .createBid(bidAmount, bidPrice, buyer.publicKey)
      .accounts({
        payer: buyer.publicKey,
        matchedOrder: matchedOrderPda,
        orderStoreProgram: orderStoreProgram.programId,
        orderBook,
        tokenMint,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();
    
    // Verify matched order was created with REAL seller (not stubbed)
    const matchedOrder = await orderStoreProgram.account.matchedOrder.fetch(matchedOrderPda);
    console.log(`✅ Matched! Buyer: ${matchedOrder.buyer.toBase58().substring(0, 8)}...`);
    console.log(`✅ Matched! Seller: ${matchedOrder.seller.toBase58().substring(0, 8)}...`);
    console.log(`✅ Amount: ${matchedOrder.amount.toString()}`);
    console.log(`✅ Price: ${matchedOrder.price.toString()}`);
    
    expect(matchedOrder.buyer.toBase58()).to.equal(buyer.publicKey.toBase58());
    expect(matchedOrder.seller.toBase58()).to.equal(seller.publicKey.toBase58());
    expect(matchedOrder.amount.toString()).to.equal(bidAmount.toString());
    expect(matchedOrder.price.toString()).to.equal(bidPrice.toString());
    
    // Verify order book was updated (partial fill)
    const orderBookAfter = await marketProgram.account.orderBook.fetch(orderBook);
    expect(orderBookAfter.orders.length).to.equal(1);
    expect(orderBookAfter.orders[0].amount.toString()).to.equal("50000000"); // 100 - 50 = 50 remaining
    
    console.log("✅ Order book updated: 50 tokens remaining in ask order");
    console.log("\n🎉 PHASE 2A MATCHING ENGINE VERIFIED!");
    console.log("   - Real seller matched (not stubbed same trader)");
    console.log("   - Partial fills working");
    console.log("   - Order book state updated correctly");
  });
  
  it("Rejects bid when no matching orders exist", async () => {
    console.log("\n🛡️  Test 4: Validation - No Matching Orders");
    
    // Create a second order book for different token
    const newMint = await createMint(
      provider.connection,
      seller,
      seller.publicKey,
      null,
      6
    );
    
    const [newOrderBook] = PublicKey.findProgramAddressSync(
      [Buffer.from("order_book"), newMint.toBuffer()],
      marketProgram.programId
    );
    
    const [newEscrowVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_vault"), newMint.toBuffer()],
      marketProgram.programId
    );
    
    const [newEscrowAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_authority"), newMint.toBuffer()],
      marketProgram.programId
    );
    
    // Initialize new order book (empty)
    await marketProgram.methods
      .initializeEscrowVault()
      .accounts({
        escrowVault: newEscrowVault,
        escrowAuthority: newEscrowAuthority,
        tokenMint: newMint,
        payer: provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    
    await marketProgram.methods
      .initializeOrderBook()
      .accounts({
        orderBook: newOrderBook,
        tokenMint: newMint,
        payer: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    
    // Try to create bid with no orders in book
    const [dummyMatchedOrder] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("matched_order"),
        buyer.publicKey.toBuffer(),
        buyer.publicKey.toBuffer(),
        new BN(1000).toArrayLike(Buffer, "le", 8),
        new BN(1000).toArrayLike(Buffer, "le", 8),
      ],
      orderStoreProgram.programId
    );
    
    try {
      await marketProgram.methods
        .createBid(new BN(1000), new BN(1000), buyer.publicKey)
        .accounts({
          payer: buyer.publicKey,
          matchedOrder: dummyMatchedOrder,
          orderStoreProgram: orderStoreProgram.programId,
          orderBook: newOrderBook,
          tokenMint: newMint,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();
      
      expect.fail("Should have rejected bid with empty order book");
    } catch (error) {
      expect(error.message).to.include("NoMatchingOrders");
      console.log("✅ Correctly rejected bid with no matching orders");
    }
  });
});

