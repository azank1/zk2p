import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import type { Market } from '../target/types/market';
import marketIdl from '../target/idl/market.json';
import fs from 'fs';

/**
 * Reset (close) the OrderBook account to allow re-initialization with new structure
 */
async function main() {
  const tokenMintStr = process.argv[2];
  if (!tokenMintStr) {
    console.error('Usage: npx ts-node scripts/reset-orderbook.ts <TOKEN_MINT>');
    process.exit(1);
  }

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load wallet
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const walletPath = `${homeDir}/.config/solana/id.json`;
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
  );

  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);

  const programId = new PublicKey('Bk2pKQsXXvjPChX2G8AWgwoefnwRbTSirtHGnG8yUEdB');
  const program = new anchor.Program<Market>(marketIdl as any, provider);
  const tokenMint = new PublicKey(tokenMintStr);

  console.log('================================');
  console.log('Reset OrderBook Account');
  console.log('================================\n');
  console.log('Authority:', walletKeypair.publicKey.toString());
  console.log('Token Mint:', tokenMint.toString());

  // Derive PDAs
  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('market'), tokenMint.toBuffer()],
    programId
  );
  
  const [orderBookPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('order_book'), tokenMint.toBuffer()],
    programId
  );

  console.log('\nPDAs:');
  console.log('  Market:    ', marketPda.toString());
  console.log('  OrderBook: ', orderBookPda.toString());

  // Check if account exists
  const accountInfo = await connection.getAccountInfo(orderBookPda);
  if (!accountInfo) {
    console.log('\n✓ OrderBook account does not exist. No need to reset.');
    process.exit(0);
  }

  console.log('\nOrderBook exists. Resetting...');

  try {
    const tx = await (program.methods as any).resetOrderBook()
      .accounts({
        orderBook: orderBookPda,
        market: marketPda,
        tokenMint: tokenMint,
        authority: walletKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log('✓ OrderBook reset!');
    console.log('  TX:', tx);
    console.log('\nNow run:');
    console.log(`  npm run p2p:init-market ${tokenMint.toString()}`);
  } catch (err: any) {
    console.error('❌ Error:', err.message || err);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });

