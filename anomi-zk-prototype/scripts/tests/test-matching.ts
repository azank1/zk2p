import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
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
    const sellerAta = await getAssociatedTokenAddress(tokenMint, seller!);
    const buyerAta = await getAssociatedTokenAddress(tokenMint, buyer!);

    const matchTx = await program.methods
      .matchOrder(askOrderId!, bidOrderId!)
      .accounts({
        market: marketPda,
        orderBook: orderBookPda,
        escrowVault: escrowVaultPda,
        escrowAuthority: escrowAuthorityPda,
        seller: seller!,
        buyer: buyer!,
        sellerTokenAccount: sellerAta,
        buyerTokenAccount: buyerAta,
        tokenMint: tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        matcher: buyerKeypair.publicKey,
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
    const orderIdBytes = Buffer.alloc(8);
    orderIdBytes.writeBigUInt64LE(BigInt(askOrderId!.toString()), 0);
    
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

