# On-Chain P2P Testing Setup

## Step 1: Create Test Token (Run in WSL)

```bash
cd /mnt/d/dev/zk2p/anomi-zk-prototype

# Make script executable
chmod +x scripts/create-test-token.sh

# Create token
./scripts/create-test-token.sh
```

This will:
- Create SPL token with 6 decimals
- Create token account for your wallet
- Mint 100,000 test tokens
- Save token mint to `scripts/test-token-mint.txt`
- Output: Token Mint address

**Save this address!** Example: `7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`

## Step 2: Initialize Market PDAs (Run in WSL)

Since we don't have IDL, we'll do this manually:

```bash
# Read the token mint
TOKEN_MINT=$(cat scripts/test-token-mint.txt)

# We'll initialize via the UI instead since IDL is missing
# The UI will create PDAs on first transaction
```

## Step 3: Update UI with Token Mint

Open `demo-ui/index.html` and find this line:
```javascript
const TOKEN_MINT = null;
```

Replace with your actual token mint:
```javascript
const TOKEN_MINT = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'; // Your token address
```

## Step 4: Mint Tokens to Test Wallets

```bash
# Wallet 1 (your main wallet)
spl-token mint $TOKEN_MINT 10000

# Wallet 2 (create a second wallet for P2P testing)
solana-keygen new --outfile ~/.config/solana/test-wallet-2.json
WALLET_2=$(solana address -k ~/.config/solana/test-wallet-2.json)

# Create token account for wallet 2
spl-token create-account $TOKEN_MINT --owner $WALLET_2

# Mint tokens to wallet 2
spl-token mint $TOKEN_MINT 10000 --recipient-owner $WALLET_2
```

## Step 5: Test P2P Flow

### Browser 1 (Seller - Wallet A):
1. Open http://localhost:8080
2. Connect Phantom (Wallet A)
3. Switch Phantom to Devnet
4. Place ASK order (selling 100 tokens @ $50)
5. Phantom signs transaction
6. Order stored on-chain

### Browser 2 (Buyer - Wallet B):  
1. Open http://localhost:8080 in **Incognito mode**
2. Connect Phantom (Import Wallet B using test-wallet-2.json)
3. Place BID order (buying 100 tokens @ $50)
4. Order matches on-chain!
5. Tokens transfer automatically

## Step 6: Verify on Solana Explorer

Check transactions:
```
https://explorer.solana.com/address/<YOUR_WALLET>?cluster=devnet
```

See:
- Order creation transactions
- Token transfers
- PDA account updates

## Current Limitation

**Without IDL**, we need to build instructions manually. The UI currently has:
- ✅ Phantom connection working
- ✅ PDA derivation functions
- ⏳ Transaction creation (needs manual instruction building)

## Quick Workaround: Use Anchor Client

Since init-devnet.ts uses Anchor client (which needs IDL), we have two options:

**Option A: Generate IDL from source**
```bash
# In WSL
cd /mnt/d/dev/zk2p/anomi-zk-prototype
anchor idl init --filepath target/idl/market.json Bk2pKQsXXvjPChX2G8AWgwoefnwRbTSirtHGnG8yUEdB
```

**Option B: Manual instruction building** (shown in next section)

The key is getting the token created first!

