import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('=== Setting Up Seller Wallet ===\n');

  // Check if seller wallet already exists
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    console.error('❌ HOME or USERPROFILE environment variable not set');
    process.exit(1);
  }

  const sellerWalletPath = path.join(homeDir, '.config', 'solana', 'id.json');
  const sellerWalletDir = path.dirname(sellerWalletPath);

  if (fs.existsSync(sellerWalletPath)) {
    const existingData = JSON.parse(fs.readFileSync(sellerWalletPath, 'utf8'));
    const existingKeypair = Keypair.fromSecretKey(Uint8Array.from(existingData));
    console.log('⚠️  Seller wallet already exists at:', sellerWalletPath);
    console.log('   Public Key:', existingKeypair.publicKey.toString());
    console.log('');
    console.log('   If you want to create a new wallet, delete the existing file first.');
    process.exit(0);
  }

  // Generate new keypair for seller
  const sellerWallet = Keypair.generate();
  
  console.log('Generated seller wallet keypair');
  console.log('Public Key:', sellerWallet.publicKey.toString());
  console.log('');

  // Create directory if it doesn't exist
  if (!fs.existsSync(sellerWalletDir)) {
    fs.mkdirSync(sellerWalletDir, { recursive: true });
    console.log('Created directory:', sellerWalletDir);
  }

  // Save to file
  const keypairArray = Array.from(sellerWallet.secretKey);
  fs.writeFileSync(sellerWalletPath, JSON.stringify(keypairArray));
  console.log('✅ Saved keypair to:', sellerWalletPath);
  console.log('');

  console.log('=== Next Steps ===');
  console.log('1. Update demo-ui/config.json with this seller address:');
  console.log('   "sellerAddress": "' + sellerWallet.publicKey.toString() + '"');
  console.log('');
  console.log('2. Fund the wallet with SOL (for devnet):');
  console.log('   solana airdrop 2', sellerWallet.publicKey.toString(), '--url devnet');
  console.log('   (Or use WSL if Solana CLI is installed there)');
  console.log('');
  console.log('3. Distribute tokens to seller:');
  console.log('   npm run p2p:distribute');
  console.log('');
  console.log('4. Then run tests:');
  console.log('   npm run test:single-wallet');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

