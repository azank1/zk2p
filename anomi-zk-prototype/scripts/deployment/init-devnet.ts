import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import fs from "fs";
import type { Market } from '../target/types/market';
import marketIdl from '../target/idl/market.json';

/**
 * Initialize Market on Solana Devnet
 * 
 * This script:
 * 1. Reads deployed program IDs from devnet-config.json
 * 2. Initializes escrow vault
 * 3. Initializes market account
 * 4. Initializes order book
 * 5. Saves PDA addresses for UI configuration
 */

async function main() {
  console.log("================================");
  console.log("ZK2P Market Initialization");
  console.log("================================\n");

  // Read deployment config
  const config = JSON.parse(fs.readFileSync("scripts/devnet-config.json", "utf8"));
  const programId = new PublicKey(config.programs.market);

  console.log("Program ID:", programId.toString());
  console.log("");

  // Setup provider (devnet)
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const walletPath = `${homeDir}/.config/solana/id.json`;
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const wallet = new anchor.Wallet(Keypair.fromSecretKey(Uint8Array.from(walletData)));
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  anchor.setProvider(provider);

  // Load program with proper typing
  const program = new anchor.Program<Market>(marketIdl as any, provider);

  // Get token mint from command line or use placeholder
  const tokenMintStr = process.argv[2];
  if (!tokenMintStr) {
    console.error("Error: Token mint address required");
    console.log("Usage: ts-node scripts/init-devnet.ts <TOKEN_MINT_ADDRESS>");
    console.log("\nFirst create a test token:");
    console.log("  spl-token create-token --decimals 6");
    process.exit(1);
  }

  const tokenMint = new PublicKey(tokenMintStr);
  console.log("Token Mint:", tokenMint.toString());
  console.log("");

  // Derive PDAs
  const [market, marketBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), tokenMint.toBuffer()],
    program.programId
  );

  const [orderBook, orderBookBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("order_book"), tokenMint.toBuffer()],
    program.programId
  );

  const [escrowVault, escrowVaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow_vault"), tokenMint.toBuffer()],
    program.programId
  );

  const [escrowAuthority, escrowAuthorityBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow_authority"), tokenMint.toBuffer()],
    program.programId
  );

  console.log("PDAs:");
  console.log("  Market:          ", market.toString());
  console.log("  OrderBook:       ", orderBook.toString());
  console.log("  Escrow Vault:    ", escrowVault.toString());
  console.log("  Escrow Authority:", escrowAuthority.toString());
  console.log("");

  // Step 1: Initialize Escrow Vault
  console.log("[1/3] Initializing escrow vault...");
  try {
    const tx1 = await (program.methods as any)
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

    console.log("✓ Escrow vault initialized");
    console.log("  TX:", tx1);
  } catch (err) {
    console.log("  (Escrow vault may already exist)");
  }
  console.log("");

  // Step 2: Initialize Market
  console.log("[2/3] Initializing market...");
  try {
    const tx2 = await (program.methods as any)
      .initializeMarket()
      .accounts({
        market,
        tokenMint,
        authority: provider.wallet.publicKey,
        payer: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✓ Market initialized");
    console.log("  TX:", tx2);
  } catch (err) {
    console.log("  (Market may already exist)");
  }
  console.log("");

  // Step 3: Initialize Order Book
  console.log("[3/3] Initializing order book...");
  try {
    const tx3 = await (program.methods as any)
      .initializeOrderBookV2()
      .accounts({
        orderBook,
        market,
        tokenMint,
        payer: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✓ Order book initialized");
    console.log("  TX:", tx3);
  } catch (err: any) {
    console.log("❌ Order book initialization FAILED");
    console.log("Error:", err.message);
    if (err.logs) {
      console.log("\nProgram Logs:");
      err.logs.forEach((log: string) => console.log("  ", log));
    }
    console.log("\nThis is likely due to the OrderBook size exceeding 10KB limit.");
    console.log("See docs/ARCHITECTURE.md for the lazy initialization solution.");
  }
  console.log("");

  // Save UI configuration
  console.log("Saving UI configuration...");
  const uiConfig = {
    network: "devnet",
    rpcEndpoint: "https://api.devnet.solana.com",
    programId: programId.toString(),
    tokenMint: tokenMint.toString(),
    pdas: {
      market: market.toString(),
      orderBook: orderBook.toString(),
      escrowVault: escrowVault.toString(),
      escrowAuthority: escrowAuthority.toString(),
    },
  };

  fs.writeFileSync(
    "demo-ui/config.json",
    JSON.stringify(uiConfig, null, 2)
  );

  console.log("✓ UI config saved to demo-ui/config.json");
  console.log("");

  console.log("================================");
  console.log("Initialization Complete!");
  console.log("================================\n");

  console.log("Market initialized on devnet!");
  console.log("");
  console.log("View on Solana Explorer:");
  console.log(`  Market: https://explorer.solana.com/address/${market}?cluster=devnet`);
  console.log(`  OrderBook: https://explorer.solana.com/address/${orderBook}?cluster=devnet`);
  console.log("");
  console.log("Next steps:");
  console.log("1. Mint test tokens to your wallet");
  console.log("2. Update demo-ui/index.html with config.json");
  console.log("3. Connect Phantom wallet and test!");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });

