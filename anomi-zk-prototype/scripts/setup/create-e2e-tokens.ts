import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import * as fs from 'fs';

const DEVNET_RPC = 'https://api.devnet.solana.com';

async function main() {
  console.log('=== Distributing Tokens for E2E Test ===\n');

  // Load token config
  if (!fs.existsSync('scripts/token-config.json')) {
    console.error('Error: token-config.json not found.');
    console.log('Run: ts-node scripts/create-new-token.ts first');
    process.exit(1);
  }

  const tokenConfig = JSON.parse(fs.readFileSync('scripts/token-config.json', 'utf8'));
  const tokenMint = new PublicKey(tokenConfig.tokenMint);
  
  console.log('Token Mint:', tokenMint.toString());
  console.log('Decimals:', tokenConfig.decimals, '\n');

  // Load deployer wallet (seller) - cross-platform
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const walletPath = `${homeDir}/.config/solana/id.json`;
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const seller = Keypair.fromSecretKey(Uint8Array.from(walletData));

  // Load buyer wallet
  if (!fs.existsSync('scripts/test-buyer-wallet.json')) {
    console.error('Error: test-buyer-wallet.json not found.');
    console.log('Run: ts-node scripts/setup-buyer-wallet.ts first');
    process.exit(1);
  }

  const buyerData = JSON.parse(fs.readFileSync('scripts/test-buyer-wallet.json', 'utf8'));
  const buyer = Keypair.fromSecretKey(Uint8Array.from(buyerData));

  const connection = new Connection(DEVNET_RPC, 'confirmed');

  console.log('Seller Wallet:', seller.publicKey.toString());
  console.log('Buyer Wallet:', buyer.publicKey.toString(), '\n');

  // Create/Get ATAs
  console.log('[1/3] Creating Associated Token Accounts...');
  
  const sellerATA = await getOrCreateAssociatedTokenAccount(
    connection,
    seller,
    tokenMint,
    seller.publicKey
  );
  console.log('✅ Seller ATA:', sellerATA.address.toString());

  const buyerATA = await getOrCreateAssociatedTokenAccount(
    connection,
    seller, // payer
    tokenMint,
    buyer.publicKey
  );
  console.log('✅ Buyer ATA:', buyerATA.address.toString(), '\n');

  // Fund buyer wallet with SOL for transaction fees
  console.log('[2/4] Funding buyer wallet with SOL...');
  const buyerBalance = await connection.getBalance(buyer.publicKey);
  if (buyerBalance < 0.1 * 1e9) { // Less than 0.1 SOL
    console.log('Buyer has insufficient SOL. Airdropping 1 SOL...');
    try {
      const airdropSig = await connection.requestAirdrop(buyer.publicKey, 1 * 1e9);
      await connection.confirmTransaction(airdropSig);
      console.log('✅ Airdropped 1 SOL to buyer');
    } catch (err) {
      console.log('⚠️  Airdrop failed (rate limit?). Buyer may need manual funding.');
    }
  } else {
    console.log('✅ Buyer has sufficient SOL:', (buyerBalance / 1e9).toFixed(4), 'SOL');
  }
  console.log('');

  // Mint tokens to seller
  console.log('[3/4] Minting 10,000 tokens to seller...');
  const sellerAmount = 10_000 * Math.pow(10, tokenConfig.decimals);
  await mintTo(
    connection,
    seller,
    tokenMint,
    sellerATA.address,
    seller,
    sellerAmount
  );
  console.log('✅ Minted 10,000 tokens to seller\n');

  // Mint tokens to buyer
  console.log('[4/4] Minting 10,000 tokens to buyer...');
  const buyerAmount = 10_000 * Math.pow(10, tokenConfig.decimals);
  await mintTo(
    connection,
    seller,
    tokenMint,
    buyerATA.address,
    seller,
    buyerAmount
  );
  console.log('✅ Minted 10,000 tokens to buyer\n');

  // Save distribution config
  const distribution = {
    tokenMint: tokenMint.toString(),
    seller: {
      wallet: seller.publicKey.toString(),
      ata: sellerATA.address.toString(),
      balance: 10_000,
    },
    buyer: {
      wallet: buyer.publicKey.toString(),
      ata: buyerATA.address.toString(),
      balance: 10_000,
    },
  };

  fs.writeFileSync('scripts/e2e-distribution.json', JSON.stringify(distribution, null, 2));
  console.log('✅ Distribution config saved to scripts/e2e-distribution.json\n');

  console.log('=== Token Distribution Complete ===');
  console.log('Seller: 10,000 tokens');
  console.log('Buyer: 10,000 tokens');
  console.log('\nNext step: npm run p2p:test');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
