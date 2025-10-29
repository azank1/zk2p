import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';

async function main() {
  console.log('=== Setting Up Buyer Wallet ===\n');

  // Generate new keypair for buyer
  const buyerWallet = Keypair.generate();
  
  console.log('Generated buyer wallet keypair');
  console.log('Public Key:', buyerWallet.publicKey.toString());
  console.log('');

  // Save to file
  const keypairArray = Array.from(buyerWallet.secretKey);
  fs.writeFileSync('scripts/test-buyer-wallet.json', JSON.stringify(keypairArray));
  console.log('✅ Saved keypair to: scripts/test-buyer-wallet.json\n');

  console.log('=== Next Steps ===');
  console.log('1. Import this wallet into your second Phantom wallet:');
  console.log('   - Open Phantom > Settings > Add/Import Wallet');
  console.log('   - Use the private key from scripts/test-buyer-wallet.json');
  console.log('');
  console.log('2. Switch Phantom to Devnet mode');
  console.log('');
  console.log('3. Get devnet SOL via Phantom faucet or run:');
  console.log('   solana airdrop 2', buyerWallet.publicKey.toString(), '--url devnet');
  console.log('');
  console.log('4. Then run: ts-node scripts/create-e2e-tokens.ts');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
