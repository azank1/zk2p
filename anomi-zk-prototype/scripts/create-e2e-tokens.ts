import { Connection, Keypair, Transaction, SystemProgram } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID, MINT_SIZE, getMinimumBalanceForRentExemptMint } from '@solana/spl-token';
import * as fs from 'fs';

const DEVNET_RPC = 'https://api.devnet.solana.com';
const connection = new Connection(DEVNET_RPC, 'confirmed');

async function main() {
  console.log('=== Creating Test Tokens for E2E Test ===\n');

  const walletPath = process.env.ANCHOR_WALLET || (process.env.HOME + '/.config/solana/id.json');
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(walletData));
  console.log('Wallet:', wallet.publicKey.toString());

  let buyerWallet;
  if (fs.existsSync('test-buyer-wallet.json')) {
    const buyerData = JSON.parse(fs.readFileSync('test-buyer-wallet.json', 'utf8'));
    buyerWallet = Keypair.fromSecretKey(Uint8Array.from(buyerData));
    console.log('Buyer wallet:', buyerWallet.publicKey.toString());
  } else {
    console.log('Buyer wallet not found. Run setup-buyer-wallet.ts first.');
    process.exit(1);
  }

  console.log('\n[1/3] Creating SPL token mint...');
  const mintKeypair = Keypair.generate();
  const decimals = 9;
  const lamports = await getMinimumBalanceForRentExemptMint(connection);
  
  const createMintTx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    })
  );

  await connection.sendTransaction(createMintTx, [wallet, mintKeypair]);
  console.log('✅ Token mint:', mintKeypair.publicKey.toString());

  console.log('\n[2/3] Creating token accounts...');
  const sellerATA = await getOrCreateAssociatedTokenAccount(connection, wallet, mintKeypair.publicKey, wallet.publicKey);
  const buyerATA = await getOrCreateAssociatedTokenAccount(connection, wallet, mintKeypair.publicKey, buyerWallet.publicKey);
  console.log('✅ Seller ATA:', sellerATA.address.toString());
  console.log('✅ Buyer ATA:', buyerATA.address.toString());

  console.log('\n[3/3] Minting 10,000 tokens to seller...');
  const amount = 10_000 * Math.pow(10, decimals);
  await mintTo(connection, wallet, mintKeypair.publicKey, sellerATA.address, wallet, amount);
  console.log('✅ Minted 10,000 tokens');

  const config = {
    network: 'devnet',
    tokenMint: mintKeypair.publicKey.toString(),
    seller: { wallet: wallet.publicKey.toString(), ata: sellerATA.address.toString(), balance: 10_000 },
    buyer: { wallet: buyerWallet.publicKey.toString(), ata: buyerATA.address.toString(), balance: 0 },
  };
  fs.writeFileSync('e2e-token-config.json', JSON.stringify(config, null, 2));

  console.log('\n✅ Token setup complete!');
  console.log('Mint:', mintKeypair.publicKey.toString());
}

main().catch(console.error);
