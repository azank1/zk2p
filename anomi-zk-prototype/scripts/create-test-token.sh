#!/bin/bash
# Create Test SPL Token on Devnet

set -e

echo "=================================="
echo "Create Test SPL Token"
echo "=================================="
echo ""

# Configure devnet
solana config set --url devnet

# Create token
echo "Creating SPL token (6 decimals)..."
TOKEN_MINT=$(spl-token create-token --decimals 6 2>&1 | grep "Creating token" | awk '{print $3}')

if [ -z "$TOKEN_MINT" ]; then
    echo "Error: Failed to create token"
    exit 1
fi

echo "✓ Token created: $TOKEN_MINT"
echo ""

# Create token account
echo "Creating token account..."
spl-token create-account $TOKEN_MINT

echo ""
echo "Minting 100,000 test tokens..."
spl-token mint $TOKEN_MINT 100000

echo ""
echo "=================================="
echo "Token Setup Complete!"
echo "=================================="
echo ""
echo "Token Mint: $TOKEN_MINT"
echo ""
echo "View on Explorer:"
echo "https://explorer.solana.com/address/$TOKEN_MINT?cluster=devnet"
echo ""
echo "Next step:"
echo "  ts-node scripts/init-devnet.ts $TOKEN_MINT"
echo ""

# Save token mint
echo "$TOKEN_MINT" > scripts/test-token-mint.txt
echo "✓ Token mint saved to scripts/test-token-mint.txt"

