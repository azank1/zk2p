import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, getAccount } from "@solana/spl-token";
import fs from "fs";
import path from "path";
import type { Market } from '../../target/types/market';
import marketIdl from '../../target/idl/market.json';

/**
 * End-to-End Orchestrated DEX Test
 * 
 * This script orchestrates a complete test of the DEX:
 * 1. Verifies setup (wallets, market, tokens)
 * 2. Ensures seller and buyer have tokens
 * 3. Places ASK order from seller
 * 4. Places BID order from buyer
 * 5. Tests order matching
 * 6. Verifies order book state
 * 7. Reports results
 */

interface Config {
  defaultTokenMint: string;
  programId: string;
  rpcUrl: string;
  sellerAddress: string;
  buyerAddress: string;
}

interface TestResults {
  setup: boolean;
  sellerFunded: boolean;
  buyerFunded: boolean;
  askOrderPlaced: boolean;
  bidOrderPlaced: boolean;
  ordersMatched: boolean;
  orderBookVerified: boolean;
  errors: string[];
}

async function main() {
  console.log("========================================");
  console.log("End-to-End DEX Orchestrated Test");
  console.log("========================================\n");

  const results: TestResults = {
    setup: false,
    sellerFunded: false,
    buyerFunded: false,
    askOrderPlaced: false,
    bidOrderPlaced: false,
    ordersMatched: false,
    orderBookVerified: false,
    errors: []
  };

  try {
    // Step 1: Load configuration
    console.log("[1/7] Loading configuration...");
    const configPath = "demo-ui/config.json";
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }
    const config: Config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    console.log("✅ Config loaded");
    console.log(`   Token Mint: ${config.defaultTokenMint}`);
    console.log(`   Program ID: ${config.programId}`);
    console.log(`   Seller: ${config.sellerAddress}`);
    console.log(`   Buyer: ${config.buyerAddress}\n`);

    const connection = new Connection(config.rpcUrl, 'confirmed');
    const marketProgramId = new PublicKey(config.programId);
    const tokenMint = new PublicKey(config.defaultTokenMint);

    // Step 2: Load wallets
    console.log("[2/7] Loading wallets...");
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      throw new Error("HOME or USERPROFILE environment variable not set");
    }
    const sellerWalletPath = path.join(homeDir, '.config', 'solana', 'id.json');
    const buyerWalletPath = path.join(process.cwd(), "scripts", "test-buyer-wallet.json");

    if (!fs.existsSync(sellerWalletPath)) {
      throw new Error(`Seller wallet not found: ${sellerWalletPath}\n   Run: npm run p2p:setup-seller`);
    }
    if (!fs.existsSync(buyerWalletPath)) {
      throw new Error(`Buyer wallet not found: ${buyerWalletPath}\n   Run: npm run p2p:setup-buyer`);
    }

    const sellerWalletData = JSON.parse(fs.readFileSync(sellerWalletPath, 'utf8'));
    const sellerKeypair = Keypair.fromSecretKey(Uint8Array.from(sellerWalletData));
    const sellerWallet = new anchor.Wallet(sellerKeypair);

    const buyerWalletData = JSON.parse(fs.readFileSync(buyerWalletPath, 'utf8'));
    const buyerKeypair = Keypair.fromSecretKey(Uint8Array.from(buyerWalletData));
    const buyerWallet = new anchor.Wallet(buyerKeypair);

    console.log("✅ Wallets loaded");
    console.log(`   Seller: ${sellerKeypair.publicKey.toString()}`);
    console.log(`   Buyer: ${buyerKeypair.publicKey.toString()}\n`);

    // Verify wallet addresses match config
    if (sellerKeypair.publicKey.toString() !== config.sellerAddress) {
      console.warn("⚠️  Warning: Seller wallet doesn't match config!");
      console.warn(`   Wallet: ${sellerKeypair.publicKey.toString()}`);
      console.warn(`   Config: ${config.sellerAddress}\n`);
    }

    // Step 3: Verify market setup
    console.log("[3/7] Verifying market setup...");
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

    const marketInfo = await connection.getAccountInfo(marketPda);
    const orderBookInfo = await connection.getAccountInfo(orderBookPda);
    const escrowInfo = await connection.getAccountInfo(escrowVaultPda);

    if (!marketInfo || !orderBookInfo || !escrowInfo) {
      throw new Error("Market not initialized. Run: npm run p2p:init-market");
    }
    console.log("✅ Market initialized");
    console.log(`   Market PDA: ${marketPda.toString()}`);
    console.log(`   OrderBook PDA: ${orderBookPda.toString()}`);
    console.log(`   Escrow Vault: ${escrowVaultPda.toString()}\n`);
    results.setup = true;

    // Step 4: Fund wallets and verify token accounts
    console.log("[4/7] Funding wallets and verifying token accounts...");
    
    // Fund seller SOL if needed
    const sellerSolBalance = await connection.getBalance(sellerKeypair.publicKey);
    console.log(`   Seller SOL: ${(sellerSolBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    if (sellerSolBalance < 0.1 * LAMPORTS_PER_SOL) {
      console.log("   Requesting SOL airdrop for seller...");
      try {
        const airdropSig = await connection.requestAirdrop(sellerKeypair.publicKey, 2 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(airdropSig, 'confirmed');
        console.log("   ✅ Seller SOL funded");
      } catch (error) {
        console.warn(`   ⚠️  Airdrop failed: ${(error as Error).message}`);
        results.errors.push(`Seller SOL airdrop failed: ${(error as Error).message}`);
      }
    }

    // Fund buyer SOL if needed
    const buyerSolBalance = await connection.getBalance(buyerKeypair.publicKey);
    console.log(`   Buyer SOL: ${(buyerSolBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    if (buyerSolBalance < 0.1 * LAMPORTS_PER_SOL) {
      console.log("   Requesting SOL airdrop for buyer...");
      try {
        const airdropSig = await connection.requestAirdrop(buyerKeypair.publicKey, 2 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(airdropSig, 'confirmed');
        console.log("   ✅ Buyer SOL funded");
      } catch (error) {
        console.warn(`   ⚠️  Airdrop failed: ${(error as Error).message}`);
        results.errors.push(`Buyer SOL airdrop failed: ${(error as Error).message}`);
      }
    }

    // Get or create token accounts
    const sellerProvider = new anchor.AnchorProvider(connection, sellerWallet, { commitment: 'confirmed' });
    const sellerProgram = new anchor.Program<Market>(marketIdl as any, sellerProvider);

    const sellerAtaAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      sellerKeypair,
      tokenMint,
      sellerKeypair.publicKey
    );
    const sellerAta = sellerAtaAccount.address;
    const sellerTokenBalance = sellerAtaAccount.amount;
    console.log(`   Seller token account: ${sellerAta.toString()}`);
    console.log(`   Seller token balance: ${sellerTokenBalance.toString()}`);

    const buyerProvider = new anchor.AnchorProvider(connection, buyerWallet, { commitment: 'confirmed' });
    const buyerProgram = new anchor.Program<Market>(marketIdl as any, buyerProvider);

    const buyerAtaAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      buyerKeypair,
      tokenMint,
      buyerKeypair.publicKey
    );
    const buyerAta = buyerAtaAccount.address;
    const buyerTokenBalance = buyerAtaAccount.amount;
    console.log(`   Buyer token account: ${buyerAta.toString()}`);
    console.log(`   Buyer token balance: ${buyerTokenBalance.toString()}\n`);

    if (sellerTokenBalance === 0n) {
      console.warn("   ⚠️  Seller has 0 tokens. Run: npm run p2p:distribute");
      results.errors.push("Seller has 0 tokens - need to distribute tokens");
    } else {
      results.sellerFunded = true;
    }

    if (buyerTokenBalance === 0n) {
      console.warn("   ⚠️  Buyer has 0 tokens. Run: npm run p2p:distribute");
      results.errors.push("Buyer has 0 tokens - need to distribute tokens");
    } else {
      results.buyerFunded = true;
    }

    // Step 5: Place ASK order from seller
    console.log("[5/7] Placing ASK order from seller...");
    let askOrderId: anchor.BN | null = null;
    if (sellerTokenBalance > 0n) {
      try {
        const askTx = await sellerProgram.methods
          .placeLimitOrderV2(
            { ask: {} },
            new anchor.BN(50),  // price: 50
            new anchor.BN(100), // quantity: 100 tokens
            { limit: {} },
            new anchor.BN(1),
            "PayPal"
          )
          .accounts({
            owner: sellerKeypair.publicKey,
            ownerTokenAccount: sellerAta,
            escrowVault: escrowVaultPda,
            market: marketPda,
            orderBook: orderBookPda,
            tokenMint: tokenMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          } as any)
          .rpc();

        console.log("   ✅ ASK order placed");
        console.log(`   Signature: ${askTx}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${askTx}?cluster=devnet`);
        results.askOrderPlaced = true;

        // Fetch order ID from order book
        await new Promise(resolve => setTimeout(resolve, 2000));
        const orderBookAccount = await sellerProgram.account.orderBook.fetch(orderBookPda);
        for (const queue of orderBookAccount.orderQueues) {
          for (const order of queue.orders) {
            if (order.side.ask && order.owner.equals(sellerKeypair.publicKey)) {
              askOrderId = order.orderId;
              break;
            }
          }
          if (askOrderId) break;
        }
      } catch (error) {
        const errorMsg = `Failed to place ASK order: ${(error as Error).message}`;
        console.error(`   ❌ ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    } else {
      console.log("   ⏭️  Skipped (seller has no tokens)");
    }
    console.log("");

    // Step 6: Place BID order from buyer
    console.log("[6/7] Placing BID order from buyer...");
    let bidOrderId: anchor.BN | null = null;
    try {
      const bidTx = await buyerProgram.methods
        .placeLimitOrderV2(
          { bid: {} },
          new anchor.BN(50),  // price: 50
          new anchor.BN(100), // quantity: 100 tokens
          { limit: {} },
          new anchor.BN(2),
          "PayPal"
        )
        .accounts({
          owner: buyerKeypair.publicKey,
          ownerTokenAccount: buyerAta,
          escrowVault: escrowVaultPda,
          market: marketPda,
          orderBook: orderBookPda,
          tokenMint: tokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .rpc();

      console.log("   ✅ BID order placed");
      console.log(`   Signature: ${bidTx}`);
      console.log(`   Explorer: https://explorer.solana.com/tx/${bidTx}?cluster=devnet`);
      results.bidOrderPlaced = true;

      // Fetch order ID from order book
      await new Promise(resolve => setTimeout(resolve, 2000));
      const orderBookAccount = await buyerProgram.account.orderBook.fetch(orderBookPda);
      for (const queue of orderBookAccount.orderQueues) {
        for (const order of queue.orders) {
          if (order.side.bid && order.owner.equals(buyerKeypair.publicKey)) {
            bidOrderId = order.orderId;
            break;
          }
        }
        if (bidOrderId) break;
      }
    } catch (error) {
      const errorMsg = `Failed to place BID order: ${(error as Error).message}`;
      console.error(`   ❌ ${errorMsg}`);
      results.errors.push(errorMsg);
    }
    console.log("");

    // Step 7: Test order matching
    console.log("[7/7] Testing order matching...");
    if (results.askOrderPlaced && results.bidOrderPlaced) {
      try {
        // Match BID against ASK
        const matchTx = await buyerProgram.methods
          .matchOrder(
            { bid: {} },
            new anchor.BN(100),
            new anchor.BN(50),
            { limit: {} }
          )
          .accounts({
            owner: buyerKeypair.publicKey,
            orderBook: orderBookPda,
            tokenMint: tokenMint,
            systemProgram: anchor.web3.SystemProgram.programId,
          } as any)
          .rpc();

        console.log("   ✅ Orders matched");
        console.log(`   Signature: ${matchTx}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${matchTx}?cluster=devnet`);
        results.ordersMatched = true;

        // Verify order book updated
        await new Promise(resolve => setTimeout(resolve, 2000));
        const orderBookAccount = await buyerProgram.account.orderBook.fetch(orderBookPda);
        let totalOrders = 0;
        for (const queue of orderBookAccount.orderQueues) {
          totalOrders += queue.orders.length;
        }
        console.log(`   Order book now has ${totalOrders} orders`);
        results.orderBookVerified = true;
      } catch (error) {
        const errorMsg = `Failed to match orders: ${(error as Error).message}`;
        console.error(`   ❌ ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    } else {
      console.log("   ⏭️  Skipped (orders not placed)");
    }
    console.log("");

    // Final report
    console.log("========================================");
    console.log("Test Results Summary");
    console.log("========================================");
    console.log(`Setup Verified:        ${results.setup ? '✅' : '❌'}`);
    console.log(`Seller Funded:          ${results.sellerFunded ? '✅' : '❌'}`);
    console.log(`Buyer Funded:           ${results.buyerFunded ? '✅' : '❌'}`);
    console.log(`ASK Order Placed:       ${results.askOrderPlaced ? '✅' : '❌'}`);
    console.log(`BID Order Placed:       ${results.bidOrderPlaced ? '✅' : '❌'}`);
    console.log(`Orders Matched:         ${results.ordersMatched ? '✅' : '❌'}`);
    console.log(`Order Book Verified:    ${results.orderBookVerified ? '✅' : '❌'}`);

    if (results.errors.length > 0) {
      console.log("\nErrors encountered:");
      results.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }

    const allPassed = results.setup && 
                     results.sellerFunded && 
                     results.buyerFunded && 
                     results.askOrderPlaced && 
                     results.bidOrderPlaced && 
                     results.ordersMatched && 
                     results.orderBookVerified;

    console.log("\n========================================");
    if (allPassed) {
      console.log("✅ All tests passed!");
    } else {
      console.log("⚠️  Some tests failed or were skipped");
      console.log("\nNext steps:");
      if (!results.sellerFunded || !results.buyerFunded) {
        console.log("  - Run: npm run p2p:distribute (to mint tokens)");
      }
      if (!results.askOrderPlaced || !results.bidOrderPlaced) {
        console.log("  - Check wallet balances and try again");
      }
    }
    console.log("========================================\n");

    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error("\n========================================");
    console.error("❌ Fatal error during test");
    console.error("========================================");
    console.error(error);
    if (error instanceof Error) {
      console.error(`\nError: ${error.message}`);
      console.error(`Stack: ${error.stack}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

