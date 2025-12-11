import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { transfer, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

const DEVNET_RPC = 'https://api.devnet.solana.com';

async function main() {
  console.log('=== Transferring Tokens to Seller ===\n');

  // Load config
  const configPath = 'demo-ui/config.json';
  if (!fs.existsSync(configPath)) {
    console.error('Error: config.json not found.');
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const tokenMint = new PublicKey(config.defaultTokenMint);
  const sellerAddress = new PublicKey(config.sellerAddress);
  const buyerAddress = new PublicKey(config.buyerAddress);

  console.log('Token Mint:', tokenMint.toString());
  console.log('Seller:', sellerAddress.toString());
  console.log('Buyer:', buyerAddress.toString(), '\n');

  const connection = new Connection(DEVNET_RPC, 'confirmed');

  // Load buyer wallet (has tokens)
  const buyerWalletPath = path.join(process.cwd(), 'scripts', 'test-buyer-wallet.json');
  if (!fs.existsSync(buyerWalletPath)) {
    console.error('Error: Buyer wallet not found.');
    process.exit(1);
  }
  const buyerData = JSON.parse(fs.readFileSync(buyerWalletPath, 'utf8'));
  const buyer = Keypair.fromSecretKey(Uint8Array.from(buyerData));

  // Load seller wallet
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    console.error('Error: HOME or USERPROFILE not set.');
    process.exit(1);
  }
  const sellerWalletPath = path.join(homeDir, '.config', 'solana', 'id.json');
  if (!fs.existsSync(sellerWalletPath)) {
    console.error('Error: Seller wallet not found.');
    process.exit(1);
  }
  const sellerData = JSON.parse(fs.readFileSync(sellerWalletPath, 'utf8'));
  const seller = Keypair.fromSecretKey(Uint8Array.from(sellerData));

  // Verify addresses match
  if (!seller.publicKey.equals(sellerAddress)) {
    console.warn('⚠️  Warning: Seller wallet address does not match config!');
    console.warn(`   Wallet: ${seller.publicKey.toString()}`);
    console.warn(`   Config: ${sellerAddress.toString()}`);
  }

  // Get or create token accounts
  console.log('[1/2] Setting up token accounts...');
  const buyerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    buyer,
    tokenMint,
    buyer.publicKey
  );
  console.log('✅ Buyer ATA:', buyerAta.address.toString());
  console.log('   Balance:', buyerAta.amount.toString());

  const sellerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    buyer, // payer
    tokenMint,
    seller.publicKey
  );
  console.log('✅ Seller ATA:', sellerAta.address.toString());
  console.log('   Balance:', sellerAta.amount.toString(), '\n');

  // Transfer tokens
  const transferAmount = 10_000 * 1_000_000_000; // 10,000 tokens (with 9 decimals)
  console.log(`[2/2] Transferring ${transferAmount / 1_000_000_000} tokens to seller...`);
  
  if (buyerAta.amount < BigInt(transferAmount)) {
    console.error(`❌ Error: Buyer only has ${buyerAta.amount.toString()} tokens, need ${transferAmount}`);
    process.exit(1);
  }

  try {
    const signature = await transfer(
      connection,
      buyer,
      buyerAta.address,
      sellerAta.address,
      buyer,
      transferAmount
    );
    
    await connection.confirmTransaction(signature, 'confirmed');
    console.log('✅ Transfer successful!');
    console.log('   Signature:', signature);
    console.log('   Explorer: https://explorer.solana.com/tx/' + signature + '?cluster=devnet\n');

    // Verify balances
    const sellerFinal = await getOrCreateAssociatedTokenAccount(
      connection,
      buyer,
      tokenMint,
      seller.publicKey
    );
    console.log('Final Seller Balance:', sellerFinal.amount.toString());
    console.log('Final Buyer Balance:', buyerAta.amount.toString());
  } catch (error) {
    console.error('❌ Transfer failed:', (error as Error).message);
    process.exit(1);
  }

  console.log('\n=== Transfer Complete ===');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
