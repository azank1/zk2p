import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import fs from "fs";
import path from "path";
import type { Market } from '../../target/types/market';
import marketIdl from '../../target/idl/market.json';

/**
 * Debug Test - Minimal Order Placement Test
 * This script tests order placement with maximum logging
 */

interface Config {
  defaultTokenMint: string;
  programId: string;
  rpcUrl: string;
  sellerAddress: string;
  buyerAddress: string;
}

async function main() {
  console.log("========================================");
  console.log("DEBUG: Order Placement Test");
  console.log("========================================\n");

  try {
    // Step 1: Load config
    console.log("[1/6] Loading config...");
    const configPath = "demo-ui/config.json";
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }
    const config: Config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    console.log("✅ Config loaded");
    console.log("   Token Mint:", config.defaultTokenMint);
    console.log("   Program ID:", config.programId);
    console.log("   RPC URL:", config.rpcUrl);

    // Step 2: Setup connection
    console.log("\n[2/6] Setting up connection...");
    const connection = new Connection(config.rpcUrl, 'confirmed');
    const marketProgramId = new PublicKey(config.programId);
    const tokenMint = new PublicKey(config.defaultTokenMint);
    console.log("✅ Connection established");

    // Step 3: Load seller wallet
    console.log("\n[3/6] Loading seller wallet...");
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      throw new Error("HOME or USERPROFILE environment variable not set");
    }
    const sellerWalletPath = path.join(homeDir, '.config', 'solana', 'id.json');
    console.log("   Looking for wallet at:", sellerWalletPath);
    if (!fs.existsSync(sellerWalletPath)) {
      throw new Error(`Seller wallet not found: ${sellerWalletPath}\n   Please create a Solana CLI wallet or update the path.`);
    }
    const sellerWalletData = JSON.parse(fs.readFileSync(sellerWalletPath, 'utf8'));
    const sellerKeypair = Keypair.fromSecretKey(Uint8Array.from(sellerWalletData));
    console.log("✅ Seller wallet loaded");
    console.log("   Seller Pubkey:", sellerKeypair.publicKey.toString());

    // Step 4: Check seller balance
    console.log("\n[4/6] Checking seller balance...");
    const sellerBalance = await connection.getBalance(sellerKeypair.publicKey);
    console.log("   SOL Balance:", (sellerBalance / 1e9).toFixed(4), "SOL");
    if (sellerBalance < 0.1 * 1e9) {
      console.log("   ⚠️  Warning: Low SOL balance, may need airdrop");
    }

    // Step 5: Check token account
    console.log("\n[5/6] Checking token account...");
    const sellerAta = await getAssociatedTokenAddress(tokenMint, sellerKeypair.publicKey);
    console.log("   ATA Address:", sellerAta.toString());
    try {
      const tokenAccount = await getAccount(connection, sellerAta);
      console.log("   ✅ Token account exists");
      console.log("   Token Balance:", tokenAccount.amount.toString());
      if (tokenAccount.amount === 0n) {
        console.log("   ⚠️  Warning: Token balance is 0");
      }
    } catch (error) {
      console.log("   ❌ Token account does not exist");
      console.log("   Error:", (error as Error).message);
      throw error;
    }

    // Step 6: Setup program and PDAs
    console.log("\n[6/6] Setting up program and PDAs...");
    const sellerWallet = new anchor.Wallet(sellerKeypair);
    const sellerProvider = new anchor.AnchorProvider(connection, sellerWallet, { 
      commitment: 'confirmed' 
    });
    const sellerProgram = new anchor.Program<Market>(marketIdl as any, sellerProvider);

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

    console.log("✅ Program setup complete");
    console.log("   Market PDA:", marketPda.toString());
    console.log("   OrderBook PDA:", orderBookPda.toString());
    console.log("   Escrow Vault PDA:", escrowVaultPda.toString());

    // Step 7: Verify accounts exist
    console.log("\n[7/7] Verifying on-chain accounts...");
    const marketInfo = await connection.getAccountInfo(marketPda);
    const orderBookInfo = await connection.getAccountInfo(orderBookPda);
    const escrowInfo = await connection.getAccountInfo(escrowVaultPda);

    if (!marketInfo) {
      throw new Error("Market account not initialized. Run: npm run p2p:init-market");
    }
    console.log("   ✅ Market account exists");

    if (!orderBookInfo) {
      throw new Error("OrderBook account not initialized. Run: npm run p2p:init-market");
    }
    console.log("   ✅ OrderBook account exists");

    if (!escrowInfo) {
      throw new Error("Escrow vault not initialized. Run: npm run p2p:init-market");
    }
    console.log("   ✅ Escrow vault exists");

    // Step 8: Attempt order placement
    console.log("\n[8/8] Attempting to place ASK order...");
    console.log("   Side: Ask");
    console.log("   Price: 50");
    console.log("   Quantity: 100");
    console.log("   Order Type: Limit");

    try {
      const askTx = await sellerProgram.methods
        .placeLimitOrderV2(
          { ask: {} },
          new anchor.BN(50),
          new anchor.BN(100),
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

      console.log("   ✅ Order placed successfully!");
      console.log("   Transaction:", askTx);
      console.log("   Explorer: https://explorer.solana.com/tx/" + askTx + "?cluster=devnet");
    } catch (error) {
      console.log("   ❌ Order placement failed!");
      console.log("   Error Name:", (error as Error).name);
      console.log("   Error Message:", (error as Error).message);
      if ((error as Error).stack) {
        console.log("   Stack Trace:");
        console.log((error as Error).stack);
      }
      throw error;
    }

    console.log("\n========================================");
    console.log("✅ Test completed successfully!");
    console.log("========================================");

  } catch (error) {
    console.log("\n========================================");
    console.log("❌ Test failed!");
    console.log("========================================");
    console.error("Error:", error);
    if (error instanceof Error) {
      console.error("Name:", error.name);
      console.error("Message:", error.message);
      if (error.stack) {
        console.error("Stack:", error.stack);
      }
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

