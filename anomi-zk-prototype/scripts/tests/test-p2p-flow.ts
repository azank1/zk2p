import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import * as fs from 'fs';
import type { Market } from '../target/types/market';
import marketIdl from '../target/idl/market.json';

const DEVNET_RPC = 'https://api.devnet.solana.com';

async function main() {
  console.log('=== Automated P2P Trading Flow Test ===\n');

  // Load config
  const tokenConfig = JSON.parse(fs.readFileSync('scripts/token-config.json', 'utf8'));
  const tokenMint = new PublicKey(tokenConfig.tokenMint);

  // Load wallets (cross-platform)
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const sellerPath = `${homeDir}/.config/solana/id.json`;
  const sellerData = JSON.parse(fs.readFileSync(sellerPath, 'utf8'));
  const seller = Keypair.fromSecretKey(Uint8Array.from(sellerData));

  const buyerData = JSON.parse(fs.readFileSync('scripts/test-buyer-wallet.json', 'utf8'));
  const buyer = Keypair.fromSecretKey(Uint8Array.from(buyerData));

  const connection = new Connection(DEVNET_RPC, 'confirmed');

  console.log('Seller:', seller.publicKey.toString());
  console.log('Buyer:', buyer.publicKey.toString());
  console.log('Token Mint:', tokenMint.toString(), '\n');

  // Setup provider and program
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(seller), {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);

  const program = new anchor.Program<Market>(marketIdl as any, provider);

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

  // Get ATAs
  const sellerATA = await getAssociatedTokenAddress(tokenMint, seller.publicKey);
  const buyerATA = await getAssociatedTokenAddress(tokenMint, buyer.publicKey);

  console.log('PDAs:');
  console.log('  Market:', market.toString());
  console.log('  OrderBook:', orderBook.toString());
  console.log('  Escrow:', escrowVault.toString(), '\n');

  // Check initial balances
  console.log('Initial Balances:');
  const sellerInitial = await getAccount(connection, sellerATA);
  const buyerInitial = await getAccount(connection, buyerATA);
  console.log('  Seller:', sellerInitial.amount.toString());
  console.log('  Buyer:', buyerInitial.amount.toString(), '\n');

  // Step 1: Seller places Ask order
  console.log('[1/2] Seller placing ASK order (100 tokens @ 50)...');
  
  try {
    const askTx = await (program.methods as any)
      .placeLimitOrderV2(
        { ask: {} },
        new anchor.BN(50),
        new anchor.BN(100),
        { limit: {} },
        new anchor.BN(Date.now()),
        'Phantom-Test'
      )
      .accounts({
        owner: seller.publicKey,
        ownerTokenAccount: sellerATA,
        escrowVault,
        market,
        orderBook,
        tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Ask placed! TX:', askTx);
    console.log('   Explorer:', `https://explorer.solana.com/tx/${askTx}?cluster=devnet\n`);
  } catch (error: any) {
    console.error('❌ Error placing ask:', error.message);
    process.exit(1);
  }

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 2: Buyer places Bid order
  console.log('[2/2] Buyer placing BID order (100 tokens @ 50)...');
  
  const buyerProvider = new anchor.AnchorProvider(connection, new anchor.Wallet(buyer), {
    commitment: 'confirmed',
  });
  const buyerProgram = new anchor.Program<Market>(marketIdl as any, buyerProvider);

  try {
    const bidTx = await (buyerProgram.methods as any)
      .placeLimitOrderV2(
        { bid: {} },
        new anchor.BN(50),
        new anchor.BN(100),
        { limit: {} },
        new anchor.BN(Date.now() + 1),
        'Phantom-Test'
      )
      .accounts({
        owner: buyer.publicKey,
        ownerTokenAccount: buyerATA,
        escrowVault,
        market,
        orderBook,
        tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Bid placed! TX:', bidTx);
    console.log('   Explorer:', `https://explorer.solana.com/tx/${bidTx}?cluster=devnet\n`);
  } catch (error: any) {
    console.error('❌ Error placing bid:', error.message);
    if (error.logs) {
      console.log('\nProgram Logs:');
      error.logs.forEach((log: string) => console.log('  ', log));
    }
  }

  // Check final balances
  console.log('\n=== Final State ===');
  const sellerFinal = await getAccount(connection, sellerATA);
  const buyerFinal = await getAccount(connection, buyerATA);
  const escrowFinal = await getAccount(connection, escrowVault);

  console.log('Token Balances:');
  console.log('  Seller:', sellerFinal.amount.toString());
  console.log('  Buyer:', buyerFinal.amount.toString());
  console.log('  Escrow:', escrowFinal.amount.toString());

  console.log('\n=== P2P Test Complete ===');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
