import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import type { Market } from '../target/types/market';
import marketIdl from '../target/idl/market.json';
import * as fs from 'fs';

/**
 * Manually trigger order matching
 * This demonstrates how the match_order instruction works
 */

const DEVNET_RPC = 'https://api.devnet.solana.com';

async function main() {
  console.log('=== Manual Order Matching ===\n');

  // Load config
  const tokenConfig = JSON.parse(fs.readFileSync('scripts/token-config.json', 'utf8'));
  const tokenMint = new PublicKey(tokenConfig.tokenMint);

  // Load buyer wallet (will be the matcher - to avoid self-trade)
  const buyerData = JSON.parse(fs.readFileSync('scripts/test-buyer-wallet.json', 'utf8'));
  const buyer = Keypair.fromSecretKey(Uint8Array.from(buyerData));

  const connection = new Connection(DEVNET_RPC, 'confirmed');
  
  console.log('Matcher (Buyer):', buyer.publicKey.toString());
  console.log('Token Mint:', tokenMint.toString(), '\n');

  // Setup provider and program
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(buyer), {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);

  const program = new anchor.Program<Market>(marketIdl as any, provider);

  // Derive OrderBook PDA
  const [orderBook] = PublicKey.findProgramAddressSync(
    [Buffer.from('order_book'), tokenMint.toBuffer()],
    program.programId
  );

  console.log('OrderBook:', orderBook.toString(), '\n');

  try {
    // Call match_order to match the BID with existing ASK
    // Side: Bid (we're matching a bid against existing asks)
    // Quantity: 100
    // Limit Price: 50 (will match ASK @ 50)
    console.log('Attempting to match orders...');
    console.log('  Side: Bid');
    console.log('  Quantity: 100');
    console.log('  Limit Price: 50\n');

    const tx = await (program.methods as any)
      .matchOrder(
        { bid: {} }, // Side enum
        new anchor.BN(100), // quantity
        new anchor.BN(50), // limit_price
        { limit: {} } // OrderType enum
      )
      .accounts({
        owner: buyer.publicKey, // Buyer is the taker
        orderBook: orderBook,
        tokenMint: tokenMint,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Match executed!');
    console.log('   TX:', tx);
    console.log('   Explorer:', `https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

    // Fetch updated order book
    const orderBookAccount = await program.account.orderBook.fetch(orderBook);
    console.log('=== Updated Order Book ===');
    console.log('Total Orders:', orderBookAccount.totalOrders);
    console.log('Best Bid:', orderBookAccount.bestBid);
    console.log('Best Ask:', orderBookAccount.bestAsk);
  } catch (err: any) {
    console.error('❌ Error matching:', err.message || err);
    if (err.logs) {
      console.log('\nProgram Logs:');
      err.logs.forEach((log: string) => console.log('  ', log));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });

