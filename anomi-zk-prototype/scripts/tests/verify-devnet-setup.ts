import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import fs from "fs";

/**
 * Verify Devnet Setup for P2P DEX Demo
 * 
 * This script verifies:
 * 1. Market program is deployed
 * 2. OrderStore program is deployed
 * 3. Market account is initialized
 * 4. OrderBook is initialized
 * 5. Escrow vault is initialized
 * 6. Seller has tokens in ATA
 * 7. Buyer has SOL for fees
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
  console.log("Devnet Setup Verification");
  console.log("================================\n");

  // Read UI config
  const configPath = "demo-ui/config.json";
  if (!fs.existsSync(configPath)) {
    console.error("❌ Error: config.json not found at demo-ui/config.json");
    process.exit(1);
  }

  const config: Config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  console.log("Configuration loaded from:", configPath);
  console.log("  Token Mint:", config.defaultTokenMint);
  console.log("  Market Program:", config.programId);
  console.log("  OrderStore Program:", config.orderStoreProgramId);
  console.log("  Seller:", config.sellerAddress);
  console.log("  Buyer:", config.buyerAddress);
  console.log("");

  // Setup connection
  const connection = new Connection(config.rpcUrl, 'confirmed');
  const marketProgramId = new PublicKey(config.programId);
  const orderStoreProgramId = new PublicKey(config.orderStoreProgramId);
  const tokenMint = new PublicKey(config.defaultTokenMint);
  const sellerPubkey = new PublicKey(config.sellerAddress);
  const buyerPubkey = new PublicKey(config.buyerAddress);

  let allChecksPass = true;

  // Check 1: Market program deployed
  console.log("1. Checking Market Program deployment...");
  try {
    const marketProgramInfo = await connection.getAccountInfo(marketProgramId);
    if (marketProgramInfo && marketProgramInfo.executable) {
      console.log("   ✅ Market program is deployed");
    } else {
      console.log("   ❌ Market program not found or not executable");
      allChecksPass = false;
    }
  } catch (error) {
    console.log("   ❌ Error checking Market program:", (error as Error).message);
    allChecksPass = false;
  }

  // Check 2: OrderStore program deployed (OPTIONAL - for persistent order tracking)
  console.log("\n2. Checking OrderStore Program deployment...");
  try {
    const orderStoreProgramInfo = await connection.getAccountInfo(orderStoreProgramId);
    if (orderStoreProgramInfo && orderStoreProgramInfo.executable) {
      console.log("   ✅ OrderStore program is deployed");
    } else {
      console.log("   ⚠️  OrderStore program not deployed (optional - for order record tracking)");
      console.log("       P2P flow will work without it, but matched orders won't be persisted");
      console.log("       To deploy: Run 'anchor build && anchor deploy' in WSL");
    }
  } catch (error) {
    console.log("   ⚠️  Warning: Could not check OrderStore program:", (error as Error).message);
  }

  // Check 3: Market account initialized
  console.log("\n3. Checking Market account...");
  try {
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), tokenMint.toBuffer()],
      marketProgramId
    );
    const marketInfo = await connection.getAccountInfo(marketPda);
    if (marketInfo) {
      console.log("   ✅ Market account initialized");
      console.log("      Address:", marketPda.toString());
    } else {
      console.log("   ❌ Market account not initialized");
      console.log("      Run: npm run p2p:init");
      allChecksPass = false;
    }
  } catch (error) {
    console.log("   ❌ Error checking Market account:", (error as Error).message);
    allChecksPass = false;
  }

  // Check 4: OrderBook initialized
  console.log("\n4. Checking OrderBook account...");
  try {
    const [orderBookPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("order_book"), tokenMint.toBuffer()],
      marketProgramId
    );
    const orderBookInfo = await connection.getAccountInfo(orderBookPda);
    if (orderBookInfo) {
      console.log("   ✅ OrderBook account initialized");
      console.log("      Address:", orderBookPda.toString());
      console.log("      Size:", orderBookInfo.data.length, "bytes");
    } else {
      console.log("   ❌ OrderBook account not initialized");
      console.log("      Run: npm run p2p:init");
      allChecksPass = false;
    }
  } catch (error) {
    console.log("   ❌ Error checking OrderBook account:", (error as Error).message);
    allChecksPass = false;
  }

  // Check 5: Escrow vault initialized
  console.log("\n5. Checking Escrow Vault...");
  try {
    const [escrowVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_vault"), tokenMint.toBuffer()],
      marketProgramId
    );
    const vaultInfo = await connection.getAccountInfo(escrowVaultPda);
    if (vaultInfo) {
      console.log("   ✅ Escrow vault initialized");
      console.log("      Address:", escrowVaultPda.toString());
    } else {
      console.log("   ❌ Escrow vault not initialized");
      console.log("      Run: npm run p2p:init");
      allChecksPass = false;
    }
  } catch (error) {
    console.log("   ❌ Error checking Escrow vault:", (error as Error).message);
    allChecksPass = false;
  }

  // Check 6: Seller has tokens
  console.log("\n6. Checking Seller wallet and token balance...");
  try {
    const sellerBalance = await connection.getBalance(sellerPubkey);
    console.log("   Seller SOL balance:", (sellerBalance / LAMPORTS_PER_SOL).toFixed(4), "SOL");
    
    const sellerAta = await getAssociatedTokenAddress(tokenMint, sellerPubkey);
    try {
      const sellerTokenAccount = await getAccount(connection, sellerAta);
      console.log("   ✅ Seller has token account");
      console.log("      ATA:", sellerAta.toString());
      console.log("      Token balance:", sellerTokenAccount.amount.toString());
      
      if (sellerTokenAccount.amount > 0n) {
        console.log("   ✅ Seller has tokens to sell");
      } else {
        console.log("   ⚠️  Warning: Seller token balance is 0");
        console.log("      Mint tokens: spl-token mint", tokenMint.toString(), "<AMOUNT>", sellerAta.toString());
      }
    } catch {
      console.log("   ❌ Seller token account (ATA) not found");
      console.log("      Create ATA: spl-token create-account", tokenMint.toString(), "--owner", sellerPubkey.toString());
      allChecksPass = false;
    }
  } catch (error) {
    console.log("   ❌ Error checking Seller:", (error as Error).message);
    allChecksPass = false;
  }

  // Check 7: Buyer has SOL
  console.log("\n7. Checking Buyer wallet...");
  try {
    const buyerBalance = await connection.getBalance(buyerPubkey);
    console.log("   Buyer SOL balance:", (buyerBalance / LAMPORTS_PER_SOL).toFixed(4), "SOL");
    
    if (buyerBalance >= 0.1 * LAMPORTS_PER_SOL) {
      console.log("   ✅ Buyer has sufficient SOL for transactions");
    } else {
      console.log("   ⚠️  Warning: Buyer SOL balance is low (< 0.1 SOL)");
      console.log("      Airdrop: solana airdrop 1", buyerPubkey.toString(), "--url devnet");
    }
    
    const buyerAta = await getAssociatedTokenAddress(tokenMint, buyerPubkey);
    try {
      const buyerTokenAccount = await getAccount(connection, buyerAta);
      console.log("   ℹ️  Buyer has token account");
      console.log("      ATA:", buyerAta.toString());
      console.log("      Token balance:", buyerTokenAccount.amount.toString());
    } catch {
      console.log("   ℹ️  Buyer token account (ATA) will be created on first order");
    }
  } catch (error) {
    console.log("   ❌ Error checking Buyer:", (error as Error).message);
    allChecksPass = false;
  }

  // Summary
  console.log("\n================================");
  if (allChecksPass) {
    console.log("✅ All checks passed! Ready for P2P demo.");
    console.log("\nNext steps:");
    console.log("  1. Start UI server: npm run ui:start");
    console.log("  2. Open two browsers:");
    console.log("     - Browser 1: Connect Seller wallet (" + config.sellerAddress.slice(0, 8) + "...)");
    console.log("     - Browser 2: Connect Buyer wallet (" + config.buyerAddress.slice(0, 8) + "...)");
    console.log("  3. Place orders and test P2P flow");
    process.exit(0);
  } else {
    console.log("❌ Some checks failed. Please address the issues above.");
    console.log("\nCommon fixes:");
    console.log("  - Initialize on-chain accounts: npm run p2p:init");
    console.log("  - Create test tokens: npm run setup:create-e2e-tokens");
    console.log("  - Check Anchor.toml and config.json have matching program IDs");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

