import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import * as fs from 'fs';
import type { Market } from '../target/types/market';
import marketIdl from '../target/idl/market.json';

const DEVNET_RPC = 'https://api.devnet.solana.com';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 4) {
    console.error('Usage: ts-node scripts/place-order-cli.ts <wallet-file> <side> <price> <quantity>');
    console.log('\nExample:');
    console.log('  ts-node scripts/place-order-cli.ts ~/.config/solana/id.json ask 50 100');
    console.log('  ts-node scripts/place-order-cli.ts scripts/test-buyer-wallet.json bid 50 100');
    console.log('\nSide: ask or bid');
    process.exit(1);
  }

  const [walletFile, side, priceStr, quantityStr] = args;
  const price = parseInt(priceStr);
  const quantity = parseInt(quantityStr);

  console.log('=== Placing Order on Devnet ===\n');
  console.log('Wallet File:', walletFile);
  console.log('Side:', side);
  console.log('Price:', price);
  console.log('Quantity:', quantity, '\n');

  // Load wallet
  const walletData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(walletData));
  console.log('Wallet:', wallet.publicKey.toString());

  // Load token config
  const tokenConfig = JSON.parse(fs.readFileSync('scripts/token-config.json', 'utf8'));
  const tokenMint = new PublicKey(tokenConfig.tokenMint);

  // Setup connection and provider
  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);

  // Load program with proper typing
  const program = new anchor.Program<Market>(marketIdl as any, provider);

  console.log('Program ID:', program.programId.toString(), '\n');

  // Derive PDAs
  const [market] = PublicKey.findProgramAddressSync(
    [Buffer.from('market'), tokenMint.toBuffer()],
    program.programId
  );

  const [orderBook] = PublicKey.findProgramAddressSync(
    [Buffer.from('order_book'), tokenMint.toBuffer()],
    program.programId
  );

  const [escrowVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow_vault'), tokenMint.toBuffer()],
    program.programId
  );

  // Get user's token account
  const ownerTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    wallet.publicKey
  );

  console.log('PDAs:');
  console.log('  Market:', market.toString());
  console.log('  OrderBook:', orderBook.toString());
  console.log('  Escrow Vault:', escrowVault.toString());
  console.log('  User ATA:', ownerTokenAccount.toString(), '\n');

  // Place order
  console.log(`Placing ${side.toUpperCase()} order...`);
  
  const sideEnum = side.toLowerCase() === 'ask' ? { ask: {} } : { bid: {} };
  const orderType = { limit: {} }; // Default to Limit order
  const clientOrderId = Date.now();
  const paymentMethod = 'Phantom-Test';

  try {
    const tx = await (program.methods as any)
      .placeLimitOrderV2(
        sideEnum,
        new anchor.BN(price),
        new anchor.BN(quantity),
        orderType,
        new anchor.BN(clientOrderId),
        paymentMethod
      )
      .accounts({
        owner: wallet.publicKey,
        ownerTokenAccount,
        escrowVault,
        market,
        orderBook,
        tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('\n✅ Order placed successfully!');
    console.log('Transaction:', tx);
    console.log('Explorer:', `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  } catch (error: any) {
    console.error('\n❌ Error placing order:', error.message);
    if (error.logs) {
      console.log('\nProgram Logs:');
      error.logs.forEach((log: string) => console.log('  ', log));
    }
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
