import { Connection, Keypair } from '@solana/web3.js';
import { createMint, getMint, mintTo, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import * as fs from 'fs';

const DEVNET_RPC = 'https://api.devnet.solana.com';

async function main() {
  console.log('=== Creating New SPL Token on Devnet ===\n');

  // Load wallet
  const walletPath = process.env.HOME + '/.config/solana/id.json';
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(walletData));

  const connection = new Connection(DEVNET_RPC, 'confirmed');
  console.log('Wallet:', wallet.publicKey.toString());

  const balance = await connection.getBalance(wallet.publicKey);
  console.log('Balance:', balance / 1e9, 'SOL\n');

  // Create token mint
  console.log('[1/3] Creating SPL token...');
  const decimals = 9;
  const mint = await createMint(
    connection,
    wallet,
    wallet.publicKey,
    wallet.publicKey,
    decimals
  );

  console.log('✅ Token created:', mint.toString());
  console.log('   Decimals:', decimals);

  // Get mint info
  const mintInfo = await getMint(connection, mint);
  console.log('   Supply:', mintInfo.supply.toString(), '\n');

  // Create ATA for deployer
  console.log('[2/3] Creating token account for deployer...');
  const deployerATA = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet,
    mint,
    wallet.publicKey
  );
  console.log('✅ Deployer ATA:', deployerATA.address.toString(), '\n');

  // Mint initial supply
  console.log('[3/3] Minting initial supply (100,000 tokens)...');
  const initialSupply = 100_000 * Math.pow(10, decimals);
  await mintTo(
    connection,
    wallet,
    mint,
    deployerATA.address,
    wallet,
    initialSupply
  );
  console.log('✅ Minted 100,000 tokens to deployer\n');

  // Save configuration
  const config = {
    network: 'devnet',
    tokenMint: mint.toString(),
    decimals,
    initialSupply: 100_000,
    deployer: {
      wallet: wallet.publicKey.toString(),
      ata: deployerATA.address.toString(),
      balance: 100_000,
    },
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync('scripts/token-config.json', JSON.stringify(config, null, 2));
  console.log('✅ Configuration saved to scripts/token-config.json\n');

  console.log('=== Token Creation Complete ===');
  console.log('Token Mint:', mint.toString());
  console.log('Explorer:', `https://explorer.solana.com/address/${mint}?cluster=devnet`);
  console.log('\nNext step: ts-node scripts/setup-buyer-wallet.ts');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
