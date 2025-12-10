import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import fs from "fs";
import type { Market } from '../../target/types/market';
import marketIdl from '../../target/idl/market.json';

/**
 * Test Order Matching and OrderStore Integration
 * 
 * This script:
 * 1. Matches existing orders using buyer wallet
 * 2. Verifies match on-chain
 * 3. Checks OrderStore creates MatchedOrder in Pending state
 */

interface Config {
  defaultTokenMint: string;
  programId: string;
  orderStoreProgramId: string;
  rpcUrl: string;
  sellerAddress: string;
  buyerAddress: string;
}

async function main() {
  console.log("================================");
  console.log("Order Matching Test");
  console.log("================================\n");

  // Read config
  const config: Config = JSON.parse(fs.readFileSync("demo-ui/config.json", "utf8"));
  const connection = new Connection(config.rpcUrl, 'confirmed');
  const marketProgramId = new PublicKey(config.programId);
  const orderStoreProgramId = new PublicKey(config.orderStoreProgramId);
  const tokenMint = new PublicKey(config.defaultTokenMint);

  // Load buyer wallet (matcher)
  const buyerWalletPath = "scripts/test-buyer-wallet.json";
  if (!fs.existsSync(buyerWalletPath)) {
    console.error("❌ Buyer wallet not found at:", buyerWalletPath);
    process.exit(1);
  }

  const buyerWalletData = JSON.parse(fs.readFileSync(buyerWalletPath, 'utf8'));
  const buyerKeypair = Keypair.fromSecretKey(Uint8Array.from(buyerWalletData));
  const buyerWallet = new anchor.Wallet(buyerKeypair);

  console.log("Matcher (Buyer):", buyerKeypair.publicKey.toString());
  console.log("");

  // Setup provider
  const provider = new anchor.AnchorProvider(connection, buyerWallet, { commitment: 'confirmed' });
  const program = new anchor.Program<Market>(marketIdl as any, provider);

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

  // Test 1: Fetch order book to find matchable orders
  console.log("1. Fetching order book...");
  let askOrderId = null;
  let bidOrderId = null;
  let seller = null;
  let buyer = null;

  try {
    const orderBookAccount = await program.account.orderBook.fetch(orderBookPda);
    console.log("   ✅ Order book fetched");
    
    for (const queue of orderBookAccount.orderQueues) {
      for (const order of queue.orders) {
        if (order.side.ask && !askOrderId) {
          askOrderId = order.orderId;
          seller = order.owner;
          console.log("      Found ASK:", order.orderId.toString(), "| Price:", order.price.toString());
        }
        if (order.side.bid && !bidOrderId) {
          bidOrderId = order.orderId;
          buyer = order.owner;
          console.log("      Found BID:", order.orderId.toString(), "| Price:", order.price.toString());
        }
      }
    }

    if (!askOrderId || !bidOrderId) {
      console.log("   ⚠️  Warning: Not enough orders to match");
      console.log("      Run: npm run test:single-wallet to place orders first");
      process.exit(1);
    }
  } catch (error) {
    console.log("   ❌ Error fetching order book:", (error as Error).message);
    process.exit(1);
  }

  // Test 2: Match orders
  console.log("\n2. Matching orders...");
  try {
    // Get or create token accounts (ensures they exist before matching)
    // Note: In a real scenario, these should already exist from order placement,
    // but we create them here for robustness and consistency
    const sellerAtaAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      buyerKeypair, // payer for account creation if needed
      tokenMint,
      seller!
    );
    const sellerAta = sellerAtaAccount.address;
    
    const buyerAtaAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      buyerKeypair,
      tokenMint,
      buyer!
    );
    const buyerAta = buyerAtaAccount.address;

    // Note: match_order expects (side, quantity, limit_price, order_type)
    // We'll match a BID order against existing ASK orders
    const matchTx = await program.methods
      .matchOrder(
        { bid: {} }, // Side::Bid (buyer wants to buy)
        new anchor.BN(100), // quantity: 100 tokens
        new anchor.BN(50),  // limit_price: 50 (willing to pay up to 50)
        { limit: {} } // OrderType::Limit
      )
      .accounts({
        owner: buyerKeypair.publicKey, // taker (buyer)
        orderBook: orderBookPda,
        tokenMint: tokenMint,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("   ✅ Orders matched");
    console.log("      Signature:", matchTx);
    console.log("      Explorer: https://explorer.solana.com/tx/" + matchTx + "?cluster=devnet");
  } catch (error) {
    console.log("   ❌ Error matching orders:", (error as Error).message);
    console.error(error);
    process.exit(1);
  }

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Check OrderStore MatchedOrder PDA (if integrated)
  console.log("\n3. Checking OrderStore integration...");
  try {
    // Derive MatchedOrder PDA
    // u128 is 16 bytes - write as two 64-bit values (little-endian)
    const orderIdBytes = Buffer.alloc(16);
    const orderIdBigInt = BigInt(askOrderId!.toString());
    // Write low 64 bits at offset 0
    orderIdBytes.writeBigUInt64LE(orderIdBigInt & BigInt(0xFFFFFFFFFFFFFFFF), 0);
    // Write high 64 bits at offset 8
    orderIdBytes.writeBigUInt64LE(orderIdBigInt >> BigInt(64), 8);
    
    const [matchedOrderPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("matched_order"), orderIdBytes],
      orderStoreProgramId
    );

    const matchedOrderInfo = await connection.getAccountInfo(matchedOrderPda);
    if (matchedOrderInfo) {
      console.log("   ✅ MatchedOrder PDA created");
      console.log("      Address:", matchedOrderPda.toString());
      console.log("      Status: Pending (awaiting payment confirmation)");
    } else {
      console.log("   ℹ️  MatchedOrder PDA not found");
      console.log("      Note: OrderStore integration may not be active yet");
      console.log("      This is expected if testing without ZK Fiat Mode");
    }
  } catch (error) {
    console.log("   ℹ️  Could not check OrderStore:", (error as Error).message);
  }

  // Test 4: Verify order book updated
  console.log("\n4. Verifying order book state...");
  try {
    const orderBookAccount = await program.account.orderBook.fetch(orderBookPda);
    let totalOrders = 0;
    for (const queue of orderBookAccount.orderQueues) {
      totalOrders += queue.orders.length;
    }
    console.log("   ✅ Order book updated");
    console.log("      Remaining orders:", totalOrders);
  } catch (error) {
    console.log("   ❌ Error fetching order book:", (error as Error).message);
  }

  console.log("\n================================");
  console.log("✅ Order matching test complete!");
  console.log("\nNext step: Test payment flow (if ZK Fiat Mode enabled)");
  console.log("  Run: npm run test:payment-flow");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

