import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { transfer, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

const DEVNET_RPC = 'https://api.devnet.solana.com';

async function main() {
  console.log('=== Balancing Tokens Between Seller and Buyer ===\n');

  // Load config
  const configPath = 'demo-ui/config.json';
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const tokenMint = new PublicKey(config.defaultTokenMint);
  const sellerAddress = new PublicKey(config.sellerAddress);
  const buyerAddress = new PublicKey(config.buyerAddress);

  const connection = new Connection(DEVNET_RPC, 'confirmed');

  // Load wallets
  const homeDir = process.env.HOME || process.env.USERPROFILE!;
  const sellerData = JSON.parse(fs.readFileSync(path.join(homeDir, '.config', 'solana', 'id.json'), 'utf8'));
  const seller = Keypair.fromSecretKey(Uint8Array.from(sellerData));

  const buyerData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts', 'test-buyer-wallet.json'), 'utf8'));
  const buyer = Keypair.fromSecretKey(Uint8Array.from(buyerData));

  // Get token accounts
  const sellerAta = await getOrCreateAssociatedTokenAccount(connection, seller, tokenMint, seller.publicKey);
  const buyerAta = await getOrCreateAssociatedTokenAccount(connection, buyer, tokenMint, buyer.publicKey);

  console.log('Seller balance:', sellerAta.amount.toString());
  console.log('Buyer balance:', buyerAta.amount.toString(), '\n');

  // Balance: transfer from seller to buyer if seller has more
  const total = sellerAta.amount + buyerAta.amount;
  const target = total / BigInt(2);

  if (sellerAta.amount > target) {
    const transferAmount = sellerAta.amount - target;
    console.log(`Transferring ${transferAmount.toString()} tokens to buyer...`);
    const sig = await transfer(connection, seller, sellerAta.address, buyerAta.address, seller, transferAmount);
    await connection.confirmTransaction(sig, 'confirmed');
    console.log('✅ Transfer complete:', sig);
  } else if (buyerAta.amount > target) {
    const transferAmount = buyerAta.amount - target;
    console.log(`Transferring ${transferAmount.toString()} tokens to seller...`);
    const sig = await transfer(connection, buyer, buyerAta.address, sellerAta.address, buyer, transferAmount);
    await connection.confirmTransaction(sig, 'confirmed');
    console.log('✅ Transfer complete:', sig);
  } else {
    console.log('✅ Tokens already balanced');
  }

  // Final balances
  const sellerFinal = await getOrCreateAssociatedTokenAccount(connection, seller, tokenMint, seller.publicKey);
  const buyerFinal = await getOrCreateAssociatedTokenAccount(connection, buyer, tokenMint, buyer.publicKey);
  console.log('\nFinal balances:');
  console.log('Seller:', sellerFinal.amount.toString());
  console.log('Buyer:', buyerFinal.amount.toString());
}

main().catch(console.error);

