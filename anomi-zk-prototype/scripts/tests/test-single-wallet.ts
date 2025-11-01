import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import fs from "fs";
import type { Market } from '../../target/types/market';
import marketIdl from '../../target/idl/market.json';

/**
 * Test Single Wallet Order Placement
 * 
 * This script:
 * 1. Places an ASK order from seller wallet
 * 2. Places a BID order from buyer wallet
 * 3. Fetches and displays order book state
 * 4. Verifies orders are on-chain
 */

interface Config {
  defaultTokenMint: string;
  programId: string;
  rpcUrl: string;
  sellerAddress: string;
  buyerAddress: string;
}

async function main() {
  console.log("================================");
  console.log("Single Wallet Order Test");
  console.log("================================\n");

  // Read config
  const config: Config = JSON.parse(fs.readFileSync("demo-ui/config.json", "utf8"));
  const connection = new Connection(config.rpcUrl, 'confirmed');
  const marketProgramId = new PublicKey(config.programId);
  const tokenMint = new PublicKey(config.defaultTokenMint);

  // Load wallets
  const sellerWalletPath = "scripts/setup/.wallets/seller-wallet.json";
  const buyerWalletPath = "scripts/test-buyer-wallet.json";

  if (!fs.existsSync(sellerWalletPath)) {
    console.error("❌ Seller wallet not found at:", sellerWalletPath);
    process.exit(1);
  }
  if (!fs.existsSync(buyerWalletPath)) {
    console.error("❌ Buyer wallet not found at:", buyerWalletPath);
    process.exit(1);
  }

  const sellerWalletData = JSON.parse(fs.readFileSync(sellerWalletPath, 'utf8'));
  const sellerKeypair = Keypair.fromSecretKey(Uint8Array.from(sellerWalletData));
  const sellerWallet = new anchor.Wallet(sellerKeypair);

  const buyerWalletData = JSON.parse(fs.readFileSync(buyerWalletPath, 'utf8'));
  const buyerKeypair = Keypair.fromSecretKey(Uint8Array.from(buyerWalletData));
  const buyerWallet = new anchor.Wallet(buyerKeypair);

  console.log("Seller:", sellerKeypair.publicKey.toString());
  console.log("Buyer:", buyerKeypair.publicKey.toString());
  console.log("");

  // Setup provider for seller
  const sellerProvider = new anchor.AnchorProvider(connection, sellerWallet, { commitment: 'confirmed' });
  const sellerProgram = new anchor.Program<Market>(marketIdl as any, sellerProvider);

  // Derive PDAs
  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), tokenMint.toBuffer()],
    marketProgramId
  );
  const [orderBookPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("order_book"), tokenMint.toBuffer()],
    marketProgramId
  );
  const [escrowVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow_vault"), tokenMint.toBuffer()],
    marketProgramId
  );
  const [escrowAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow_authority"), tokenMint.toBuffer()],
    marketProgramId
  );

  // Test 1: Place ASK order from seller
  console.log("1. Placing ASK order from seller...");
  try {
    const sellerAta = await getAssociatedTokenAddress(tokenMint, sellerKeypair.publicKey);
    
    const askTx = await sellerProgram.methods
      .placeLimitOrderV2(
        new anchor.BN(Math.floor(Math.random() * 1000000000)), // order_id
        { ask: {} }, // Side::Ask
        new anchor.BN(100), // quantity: 100 tokens
        new anchor.BN(50),  // price: 50
        { limit: {} } // OrderType::Limit
      )
      .accounts({
        market: marketPda,
        orderBook: orderBookPda,
        escrowVault: escrowVaultPda,
        escrowAuthority: escrowAuthorityPda,
        trader: sellerKeypair.publicKey,
        traderTokenAccount: sellerAta,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("   ✅ ASK order placed");
    console.log("      Signature:", askTx);
    console.log("      Explorer: https://explorer.solana.com/tx/" + askTx + "?cluster=devnet");
  } catch (error) {
    console.log("   ❌ Error placing ASK order:", (error as Error).message);
    console.error(error);
  }

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Place BID order from buyer
  console.log("\n2. Placing BID order from buyer...");
  try {
    const buyerProvider = new anchor.AnchorProvider(connection, buyerWallet, { commitment: 'confirmed' });
    const buyerProgram = new anchor.Program<Market>(marketIdl as any, buyerProvider);

    // Get or create buyer ATA
    const buyerAta = await getOrCreateAssociatedTokenAccount(
      connection,
      buyerKeypair,
      tokenMint,
      buyerKeypair.publicKey
    );

    const bidTx = await buyerProgram.methods
      .placeLimitOrderV2(
        new anchor.BN(Math.floor(Math.random() * 1000000000)), // order_id
        { bid: {} }, // Side::Bid
        new anchor.BN(100), // quantity: 100 tokens
        new anchor.BN(50),  // price: 50
        { limit: {} } // OrderType::Limit
      )
      .accounts({
        market: marketPda,
        orderBook: orderBookPda,
        escrowVault: escrowVaultPda,
        escrowAuthority: escrowAuthorityPda,
        trader: buyerKeypair.publicKey,
        traderTokenAccount: buyerAta.address,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("   ✅ BID order placed");
    console.log("      Signature:", bidTx);
    console.log("      Explorer: https://explorer.solana.com/tx/" + bidTx + "?cluster=devnet");
  } catch (error) {
    console.log("   ❌ Error placing BID order:", (error as Error).message);
    console.error(error);
  }

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Fetch order book state
  console.log("\n3. Fetching order book state...");
  try {
    const orderBookAccount = await sellerProgram.account.orderBook.fetch(orderBookPda);
    console.log("   ✅ Order book fetched");
    console.log("      Total orders:", orderBookAccount.orderQueues.length);
    
    let totalOrders = 0;
    for (const queue of orderBookAccount.orderQueues) {
      totalOrders += queue.orders.length;
    }
    console.log("      Active orders:", totalOrders);
    
    if (totalOrders > 0) {
      console.log("\n   Order details:");
      for (const queue of orderBookAccount.orderQueues) {
        for (const order of queue.orders) {
          const sideStr = order.side.bid ? 'BID' : 'ASK';
          console.log(`      - ${sideStr} | Qty: ${order.quantity.toString()} | Price: ${order.price.toString()} | Owner: ${order.owner.toString().slice(0, 8)}...`);
        }
      }
    }
  } catch (error) {
    console.log("   ❌ Error fetching order book:", (error as Error).message);
    console.error(error);
  }

  console.log("\n================================");
  console.log("✅ Single wallet test complete!");
  console.log("\nNext step: Test order matching");
  console.log("  Run: npm run test:matching");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

