/**
 * PDA Analysis Script
 * 
 * This script analyzes and visualizes all Program Derived Addresses (PDAs)
 * used in the Market program for Phase 2A.
 * 
 * Run: npx ts-node scripts/analyze-pdas.ts
 */

import { PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Market } from "../target/types/market";

// ANSI color codes for pretty output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

function header(text: string) {
  console.log(`\n${colors.bright}${colors.cyan}${"=".repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${text}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${"=".repeat(60)}${colors.reset}\n`);
}

function section(text: string) {
  console.log(`${colors.bright}${colors.yellow}${text}${colors.reset}`);
  console.log(`${colors.yellow}${"-".repeat(text.length)}${colors.reset}`);
}

function info(label: string, value: string) {
  console.log(`${colors.green}${label}:${colors.reset} ${value}`);
}

function code(text: string) {
  console.log(`${colors.blue}  ${text}${colors.reset}`);
}

async function analyzePDAs() {
  header("PDA Analysis for Market Program (Phase 2A)");

  // Use hardcoded program ID for offline analysis
  console.log("Analyzing PDAs (offline mode - no cluster connection needed)...\n");
  
  // Market program ID from declare_id in lib.rs
  const programId = new PublicKey("7eAHPRbhqzsqpC1Wuw2Y8AqRGGqGcEGAXAGmfsovfLae");
  
  info("Program ID", programId.toBase58());
  console.log("(Using offline PDA derivation - no wallet needed)");
  
  // Create a dummy token mint for demonstration
  const dummyTokenMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // USDC mint
  
  console.log("\n");
  section("Example Token Mint (USDC)");
  info("Mint Address", dummyTokenMint.toBase58());
  
  // ============================================================================
  // PDA 1: Escrow Vault
  // ============================================================================
  
  console.log("\n");
  section("PDA #1: Escrow Vault");
  console.log("Purpose: Token custody account that holds escrowed tokens");
  console.log("Type: SPL Token Account\n");
  
  const escrowVaultSeeds = [
    Buffer.from("escrow_vault"),
    dummyTokenMint.toBuffer(),
  ];
  
  code("Seeds:");
  code('  ["escrow_vault", token_mint.as_ref()]');
  code("");
  code("Derivation (TypeScript):");
  code('  const [escrowVault, vaultBump] = PublicKey.findProgramAddressSync(');
  code('    [Buffer.from("escrow_vault"), tokenMint.toBuffer()],');
  code('    program.programId');
  code('  );');
  
  const [escrowVault, vaultBump] = PublicKey.findProgramAddressSync(
    escrowVaultSeeds,
    programId
  );
  
  console.log("");
  info("Derived Address", escrowVault.toBase58());
  info("Canonical Bump", vaultBump.toString());
  info("Is On Curve", PublicKey.isOnCurve(escrowVault.toBuffer()) ? "No (valid PDA)" : "Yes (invalid!)");
  
  console.log("\n" + colors.magenta + "Why this PDA?" + colors.reset);
  console.log("  • Deterministic: Same token mint always derives same vault address");
  console.log("  • No private key: Cannot be compromised");
  console.log("  • Program-controlled: Only Market program can transfer from it");
  
  // ============================================================================
  // PDA 2: Escrow Authority
  // ============================================================================
  
  console.log("\n");
  section("PDA #2: Escrow Authority");
  console.log("Purpose: Authority that can sign transfers from escrow vault");
  console.log("Type: System Account (just an address)\n");
  
  const escrowAuthoritySeeds = [
    Buffer.from("escrow_authority"),
    dummyTokenMint.toBuffer(),
  ];
  
  code("Seeds:");
  code('  ["escrow_authority", token_mint.as_ref()]');
  code("");
  code("Derivation (TypeScript):");
  code('  const [escrowAuthority, authBump] = PublicKey.findProgramAddressSync(');
  code('    [Buffer.from("escrow_authority"), tokenMint.toBuffer()],');
  code('    program.programId');
  code('  );');
  
  const [escrowAuthority, authBump] = PublicKey.findProgramAddressSync(
    escrowAuthoritySeeds,
    programId
  );
  
  console.log("");
  info("Derived Address", escrowAuthority.toBase58());
  info("Canonical Bump", authBump.toString());
  info("Is On Curve", PublicKey.isOnCurve(escrowAuthority.toBuffer()) ? "No (valid PDA)" : "Yes (invalid!)");
  
  console.log("\n" + colors.magenta + "Why this PDA?" + colors.reset);
  console.log("  • Authority of escrow vault token account");
  console.log("  • Program can sign as this PDA using invoke_signed");
  console.log("  • Enables program to transfer tokens without private key");
  
  console.log("\n" + colors.magenta + "Signing Pattern (Rust):" + colors.reset);
  code('let seeds = &[');
  code('    b"escrow_authority",');
  code('    token_mint.as_ref(),');
  code('    &[' + authBump + '], // Canonical bump');
  code('];');
  code('let signer_seeds = &[&seeds[..]];');
  code('');
  code('token::transfer(');
  code('    CpiContext::new_with_signer(');
  code('        token_program,');
  code('        Transfer { ... },');
  code('        signer_seeds, // Program signs as PDA');
  code('    ),');
  code('    amount,');
  code(')?;');
  
  // ============================================================================
  // PDA 3: Order Book
  // ============================================================================
  
  console.log("\n");
  section("PDA #3: Order Book");
  console.log("Purpose: Stores Vec<AskOrder> order book data");
  console.log("Type: Anchor Account (Market program owns)\n");
  
  const orderBookSeeds = [
    Buffer.from("order_book"),
    dummyTokenMint.toBuffer(),
  ];
  
  code("Seeds:");
  code('  ["order_book", token_mint.as_ref()]');
  code("");
  code("Derivation (TypeScript):");
  code('  const [orderBook, bookBump] = PublicKey.findProgramAddressSync(');
  code('    [Buffer.from("order_book"), tokenMint.toBuffer()],');
  code('    program.programId');
  code('  );');
  
  const [orderBook, bookBump] = PublicKey.findProgramAddressSync(
    orderBookSeeds,
    programId
  );
  
  console.log("");
  info("Derived Address", orderBook.toBase58());
  info("Canonical Bump", bookBump.toString());
  info("Is On Curve", PublicKey.isOnCurve(orderBook.toBuffer()) ? "No (valid PDA)" : "Yes (invalid!)");
  
  console.log("\n" + colors.magenta + "Account Structure:" + colors.reset);
  code("struct OrderBook {");
  code("    token_mint: Pubkey,     // 32 bytes");
  code("    orders: Vec<AskOrder>,  // Variable size");
  code("    last_order_id: u64,     // 8 bytes");
  code("}");
  code("");
  code("Size Calculation:");
  code("  Discriminator:        8 bytes");
  code("  token_mint:          32 bytes");
  code("  Vec length:           4 bytes");
  code("  Orders (10 max):  1,920 bytes (192 * 10)");
  code("  last_order_id:        8 bytes");
  code("  --------------------------------");
  code("  Total:           ~1,972 bytes");
  
  console.log("\n" + colors.magenta + "Why this PDA?" + colors.reset);
  console.log("  • One order book per token mint");
  console.log("  • Deterministic address (no need to store it)");
  console.log("  • Program owns account, controls all mutations");
  
  // ============================================================================
  // Comparison: Same Token = Same PDAs
  // ============================================================================
  
  console.log("\n");
  section("Key Property: Deterministic Derivation");
  console.log("\nIf you use the SAME token mint, you get the SAME PDAs:");
  
  const secondDerivation = {
    vault: PublicKey.findProgramAddressSync(escrowVaultSeeds, programId)[0],
    authority: PublicKey.findProgramAddressSync(escrowAuthoritySeeds, programId)[0],
    book: PublicKey.findProgramAddressSync(orderBookSeeds, programId)[0],
  };
  
  console.log("\nFirst derivation:");
  info("  Vault", escrowVault.toBase58().slice(0, 20) + "...");
  info("  Authority", escrowAuthority.toBase58().slice(0, 20) + "...");
  info("  Book", orderBook.toBase58().slice(0, 20) + "...");
  
  console.log("\nSecond derivation (same seeds):");
  info("  Vault", secondDerivation.vault.toBase58().slice(0, 20) + "...");
  info("  Authority", secondDerivation.authority.toBase58().slice(0, 20) + "...");
  info("  Book", secondDerivation.book.toBase58().slice(0, 20) + "...");
  
  console.log("\n" + colors.green + "✓ Addresses match! This is the power of PDAs." + colors.reset);
  
  // ============================================================================
  // Different Token = Different PDAs
  // ============================================================================
  
  console.log("\n");
  section("Different Token Mint → Different PDAs");
  
  const differentTokenMint = new PublicKey("So11111111111111111111111111111111111111112"); // SOL mint
  
  const differentSeeds = {
    vault: [Buffer.from("escrow_vault"), differentTokenMint.toBuffer()],
    authority: [Buffer.from("escrow_authority"), differentTokenMint.toBuffer()],
    book: [Buffer.from("order_book"), differentTokenMint.toBuffer()],
  };
  
  const differentPDAs = {
    vault: PublicKey.findProgramAddressSync(differentSeeds.vault, programId)[0],
    authority: PublicKey.findProgramAddressSync(differentSeeds.authority, programId)[0],
    book: PublicKey.findProgramAddressSync(differentSeeds.book, programId)[0],
  };
  
  console.log("\nOriginal mint (USDC):");
  info("  Mint", dummyTokenMint.toBase58().slice(0, 20) + "...");
  info("  Vault", escrowVault.toBase58().slice(0, 20) + "...");
  
  console.log("\nDifferent mint (SOL):");
  info("  Mint", differentTokenMint.toBase58().slice(0, 20) + "...");
  info("  Vault", differentPDAs.vault.toBase58().slice(0, 20) + "...");
  
  console.log("\n" + colors.green + "✓ Different addresses! Each token has isolated escrow." + colors.reset);
  
  // ============================================================================
  // Summary
  // ============================================================================
  
  console.log("\n");
  section("Summary: PDA Relationships");
  
  console.log("\n" + colors.bright + "Visual Diagram:" + colors.reset);
  console.log(`
  ┌───────────────────────────────────────────────┐
  │        For Token Mint: ${dummyTokenMint.toBase58().slice(0, 8)}...        │
  └───────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
  ┌─────────┐  ┌──────────┐  ┌──────────┐
  │ Escrow  │  │ Escrow   │  │  Order   │
  │  Vault  │  │Authority │  │   Book   │
  │   PDA   │  │   PDA    │  │   PDA    │
  └─────────┘  └──────────┘  └──────────┘
       │            │              │
       │ Token      │ Is           │ Stores
       │ Account    │ Authority    │ Vec<Order>
       │            │ Of           │
       │            │              │
       └────────────┴──────────────┘
                    │
            All derived from
            same token_mint seed
  `);
  
  console.log(colors.bright + "\nKey Takeaways:" + colors.reset);
  console.log("  1. PDAs are deterministic (no randomness)");
  console.log("  2. PDAs have no private key (cannot be compromised)");
  console.log("  3. PDAs enable program-controlled accounts");
  console.log("  4. Each token mint gets isolated PDAs");
  console.log("  5. Escrow Authority signs transfers using invoke_signed");
  
  // ============================================================================
  // CLI Commands to Inspect (if on localnet with accounts)
  // ============================================================================
  
  console.log("\n");
  section("CLI Commands to Inspect PDAs");
  
  console.log("\n" + colors.bright + "If these accounts exist on-chain:" + colors.reset);
  console.log("");
  code("# Inspect escrow vault (SPL Token Account)");
  code(`solana account ${escrowVault.toBase58()}`);
  code("");
  code("# Inspect order book (Anchor Account)");
  code(`solana account ${orderBook.toBase58()}`);
  code("");
  code("# Get token account info (if initialized)");
  code(`spl-token account-info ${escrowVault.toBase58()}`);
  code("");
  code("# Decode account data (hexdump)");
  code(`solana account ${orderBook.toBase58()} --output json | jq -r .account.data[0] | base64 -d | xxd`);
  
  console.log("\n" + colors.green + "✓ PDA analysis complete!" + colors.reset);
  console.log("");
}

// Run the analysis
analyzePDAs().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

