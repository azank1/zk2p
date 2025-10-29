import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';

const DEVNET_RPC = 'https://api.devnet.solana.com';

async function main() {
  console.log('=== Fetching Order Book State ===\n');

  // Load config
  const tokenConfig = JSON.parse(fs.readFileSync('scripts/token-config.json', 'utf8'));
  const tokenMint = new PublicKey(tokenConfig.tokenMint);

  // Load wallet
  const walletPath = process.env.HOME + '/.config/solana/id.json';
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(walletData));

  // Setup connection
  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);

  // Load program
  const idl = JSON.parse(fs.readFileSync('target/idl/market.json', 'utf8'));
  const program = new anchor.Program(idl, provider);

  console.log('Program ID:', program.programId.toString());
  console.log('Token Mint:', tokenMint.toString(), '\n');

  // Derive PDAs
  const [market] = PublicKey.findProgramAddressSync(
    [Buffer.from('market'), tokenMint.toBuffer()],
    program.programId
  );

  const [orderBook] = PublicKey.findProgramAddressSync(
    [Buffer.from('order_book'), tokenMint.toBuffer()],
    program.programId
  );

  console.log('Accounts:');
  console.log('  Market:', market.toString());
  console.log('  OrderBook:', orderBook.toString(), '\n');

  // Fetch market account
  try {
    const marketAccount = await program.account.market.fetch(market);
    console.log('=== Market Account ===');
    console.log('Authority:', marketAccount.authority.toString());
    console.log('Token Mint:', marketAccount.tokenMint.toString());
    console.log('Next Order Sequence:', marketAccount.nextOrderSequence.toString(), '\n');
  } catch (error) {
    console.log('❌ Market account not found or not initialized\n');
  }

  // Fetch order book
  try {
    const orderBookAccount = await program.account.orderBook.fetch(orderBook);
    console.log('=== Order Book Account ===');
    console.log('Market:', orderBookAccount.market.toString());
    console.log('Base Mint:', orderBookAccount.baseMint.toString());
    console.log('Quote Mint:', orderBookAccount.quoteMint.toString());
    console.log('Total Orders:', orderBookAccount.totalOrders.toString());
    console.log('Best Bid:', orderBookAccount.bestBid.toString());
    console.log('Best Ask:', orderBookAccount.bestAsk.toString());
    console.log('Next Queue Index:', orderBookAccount.nextQueueIndex.toString());
    
    console.log('\nBids CritBit Tree:');
    console.log('  Root:', orderBookAccount.bids.root);
    console.log('  Leaf Count:', orderBookAccount.bids.leafCount);
    
    console.log('\nAsks CritBit Tree:');
    console.log('  Root:', orderBookAccount.asks.root);
    console.log('  Leaf Count:', orderBookAccount.asks.leafCount);
    
    console.log('\nOrder Queues:', orderBookAccount.orderQueues.length);
    
  } catch (error: any) {
    console.log('❌ OrderBook account not found or not initialized');
    console.log('Error:', error.message, '\n');
  }

  console.log('\n=== Fetch Complete ===');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
