import * as anchor from "@coral-xyz/anchor";
import type { Program } from "@coral-xyz/anchor";
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

describe("Phase 0.5: Token Escrow", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());
  
  const provider = anchor.AnchorProvider.env();
  const marketProgram = anchor.workspace.Market as Program<any>;
  
  // Test accounts
  let tokenMint: PublicKey;
  let seller: Keypair;
  let buyer: Keypair;
  let sellerTokenAccount: PublicKey;
  let buyerTokenAccount: PublicKey;
  let escrowVault: PublicKey;
  let escrowAuthority: PublicKey;
  
  before(async () => {
    // Generate keypairs
    seller = Keypair.generate();
    buyer = Keypair.generate();
    
    // Airdrop SOL to test accounts
    await provider.connection.requestAirdrop(seller.publicKey, 5e9);
    await provider.connection.requestAirdrop(buyer.publicKey, 5e9);
    await provider.connection.requestAirdrop(provider.wallet.publicKey, 5e9);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Create token mint
    tokenMint = await createMint(
      provider.connection,
      seller,
      seller.publicKey,
      null,
      6 // 6 decimals (like USDC)
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
    
    // Mint tokens to seller
    await mintTo(
      provider.connection,
      seller,
      tokenMint,
      sellerTokenAccount,
      seller.publicKey,
      1000000000 // 1000 tokens (with 6 decimals)
    );
    
    // Derive escrow PDAs
    [escrowVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_vault"), tokenMint.toBuffer()],
      marketProgram.programId
    );
    
    [escrowAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_authority"), tokenMint.toBuffer()],
      marketProgram.programId
    );
    
    console.log("✅ Test environment initialized");
    console.log(`Token Mint: ${tokenMint.toBase58()}`);
    console.log(`Seller: ${seller.publicKey.toBase58()}`);
    console.log(`Buyer: ${buyer.publicKey.toBase58()}`);
    console.log(`Escrow Vault: ${escrowVault.toBase58()}`);
    console.log(`Escrow Authority: ${escrowAuthority.toBase58()}`);
  });
  
  it("Initializes escrow vault", async () => {
    console.log("\n📦 Initializing escrow vault...");
    
    const tx = await marketProgram.methods
      .initializeEscrowVault()
      .accounts({
        escrowVault: escrowVault,
        escrowAuthority: escrowAuthority,
        tokenMint: tokenMint,
        payer: provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    
    console.log(`✅ Escrow vault initialized: ${tx}`);
    
    // Verify vault was created
    const vaultAccount = await getAccount(provider.connection, escrowVault);
    expect(vaultAccount.mint.toBase58()).to.equal(tokenMint.toBase58());
    expect(vaultAccount.owner.toBase58()).to.equal(escrowAuthority.toBase58());
    expect(vaultAccount.amount.toString()).to.equal("0");
    
    console.log("✅ Vault owner is escrow authority");
    console.log("✅ Vault starts with 0 balance");
  });
  
  it("Places ask order and escrows tokens", async () => {
    console.log("\n📈 Placing ask order...");
    
    const askAmount = new BN(100000000); // 100 tokens
    const askPrice = new BN(50000);      // Price: 50,000
    const paymentMethod = "Easypaisa: 03XX-XXXXXXX";
    
    // Check seller balance before
    const sellerBalanceBefore = await getAccount(provider.connection, sellerTokenAccount);
    console.log(`Seller balance before: ${sellerBalanceBefore.amount.toString()}`);
    
    const tx = await marketProgram.methods
      .placeAskOrder(askAmount, askPrice, paymentMethod)
      .accounts({
        seller: seller.publicKey,
        sellerTokenAccount: sellerTokenAccount,
        escrowVault: escrowVault,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([seller])
      .rpc();
    
    console.log(`✅ Ask order placed: ${tx}`);
    
    // Verify tokens were transferred to escrow
    const sellerBalanceAfter = await getAccount(provider.connection, sellerTokenAccount);
    const escrowBalance = await getAccount(provider.connection, escrowVault);
    
    expect(
      sellerBalanceBefore.amount - sellerBalanceAfter.amount
    ).to.equal(BigInt(askAmount.toString()));
    
    expect(escrowBalance.amount.toString()).to.equal(askAmount.toString());
    
    console.log(`✅ ${askAmount.toString()} tokens transferred to escrow`);
    console.log(`Seller balance after: ${sellerBalanceAfter.amount.toString()}`);
    console.log(`Escrow balance: ${escrowBalance.amount.toString()}`);
  });
  
  it("Releases escrowed funds (as OrderProcessor)", async () => {
    console.log("\n🔓 Testing escrow release...");
    
    const releaseAmount = new BN(100000000); // 100 tokens
    
    // Check balances before
    const buyerBalanceBefore = await getAccount(provider.connection, buyerTokenAccount);
    const escrowBalanceBefore = await getAccount(provider.connection, escrowVault);
    
    console.log(`Buyer balance before: ${buyerBalanceBefore.amount.toString()}`);
    console.log(`Escrow balance before: ${escrowBalanceBefore.amount.toString()}`);
    
    // NOTE: In real implementation, this would be called by OrderProcessor program via CPI
    // For testing, we need to simulate being the OrderProcessor
    // This will FAIL because we're not the OrderProcessor program
    // We'll update this test once we integrate with OrderProcessor in Phase 3
    
    try {
      await marketProgram.methods
        .releaseEscrowedFunds(releaseAmount)
        .accounts({
          caller: provider.wallet.publicKey, // This should be OrderProcessor
          escrowVault: escrowVault,
          escrowAuthority: escrowAuthority,
          buyerTokenAccount: buyerTokenAccount,
          tokenMint: tokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      
      expect.fail("Should have rejected non-OrderProcessor caller");
      
    } catch (error) {
      console.log("✅ Correctly rejected unauthorized caller");
      expect(error.message).to.include("UnauthorizedCaller");
    }
    
    console.log("✅ Escrow release is properly protected");
    console.log("⏳ Will integrate with OrderProcessor in Phase 3");
  });
  
  it("Can place multiple ask orders", async () => {
    console.log("\n📊 Testing multiple ask orders...");
    
    const askAmount1 = new BN(50000000); // 50 tokens
    const askPrice1 = new BN(45000);
    const paymentMethod1 = "Bank Transfer: Account 123";
    
    const askAmount2 = new BN(25000000); // 25 tokens
    const askPrice2 = new BN(48000);
    const paymentMethod2 = "Easypaisa: 03YY-YYYYYYY";
    
    const escrowBalanceBefore = await getAccount(provider.connection, escrowVault);
    
    // Place first ask
    await marketProgram.methods
      .placeAskOrder(askAmount1, askPrice1, paymentMethod1)
      .accounts({
        seller: seller.publicKey,
        sellerTokenAccount: sellerTokenAccount,
        escrowVault: escrowVault,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([seller])
      .rpc();
    
    console.log(`✅ First ask placed: ${askAmount1.toString()} tokens`);
    
    // Place second ask
    await marketProgram.methods
      .placeAskOrder(askAmount2, askPrice2, paymentMethod2)
      .accounts({
        seller: seller.publicKey,
        sellerTokenAccount: sellerTokenAccount,
        escrowVault: escrowVault,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([seller])
      .rpc();
    
    console.log(`✅ Second ask placed: ${askAmount2.toString()} tokens`);
    
    // Verify escrow balance increased
    const escrowBalanceAfter = await getAccount(provider.connection, escrowVault);
    const expectedIncrease = BigInt(askAmount1.add(askAmount2).toString());
    
    expect(
      escrowBalanceAfter.amount - escrowBalanceBefore.amount
    ).to.equal(expectedIncrease);
    
    console.log(`✅ Escrow holds ${escrowBalanceAfter.amount.toString()} tokens total`);
    console.log("✅ Multiple orders can be escrowed successfully");
  });
  
  it("Rejects invalid amounts and prices", async () => {
    console.log("\n🛡️  Testing input validation...");
    
    // Test zero amount
    try {
      await marketProgram.methods
        .placeAskOrder(new BN(0), new BN(50000), "Payment method")
        .accounts({
          seller: seller.publicKey,
          sellerTokenAccount: sellerTokenAccount,
          escrowVault: escrowVault,
          tokenMint: tokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([seller])
        .rpc();
      
      expect.fail("Should have rejected zero amount");
    } catch (error) {
      console.log("✅ Rejected zero amount");
      expect(error.message).to.include("InvalidAmount");
    }
    
    // Test zero price
    try {
      await marketProgram.methods
        .placeAskOrder(new BN(1000), new BN(0), "Payment method")
        .accounts({
          seller: seller.publicKey,
          sellerTokenAccount: sellerTokenAccount,
          escrowVault: escrowVault,
          tokenMint: tokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([seller])
        .rpc();
      
      expect.fail("Should have rejected zero price");
    } catch (error) {
      console.log("✅ Rejected zero price");
      expect(error.message).to.include("InvalidPrice");
    }
    
    // Test payment method too long
    try {
      const longPaymentMethod = "A".repeat(101); // 101 characters
      await marketProgram.methods
        .placeAskOrder(new BN(1000), new BN(50000), longPaymentMethod)
        .accounts({
          seller: seller.publicKey,
          sellerTokenAccount: sellerTokenAccount,
          escrowVault: escrowVault,
          tokenMint: tokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([seller])
        .rpc();
      
      expect.fail("Should have rejected payment method too long");
    } catch (error) {
      console.log("✅ Rejected payment method exceeding 100 characters");
      expect(error.message).to.include("PaymentMethodTooLong");
    }
    
    console.log("✅ All validation checks passed");
  });
});
