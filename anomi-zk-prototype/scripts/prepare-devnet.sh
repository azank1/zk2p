#!/bin/bash
# Prepare programs for devnet deployment

set -e

echo "=================================="
echo "Preparing for Devnet Deployment"
echo "=================================="
echo ""

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Step 1: Generate fresh keypairs for devnet (if they don't exist)
echo "[1/4] Generating devnet keypairs..."
mkdir -p target/deploy

if [ ! -f "target/deploy/market-keypair.json" ]; then
    solana-keygen new --no-bip39-passphrase -o target/deploy/market-keypair.json --force
fi

if [ ! -f "target/deploy/order_store-keypair.json" ]; then
    solana-keygen new --no-bip39-passphrase -o target/deploy/order_store-keypair.json --force
fi

if [ ! -f "target/deploy/order_processor-keypair.json" ]; then
    solana-keygen new --no-bip39-passphrase -o target/deploy/order_processor-keypair.json --force
fi

# Step 2: Get the program IDs from keypairs
echo "[2/4] Reading program IDs from keypairs..."
MARKET_ID=$(solana address -k target/deploy/market-keypair.json)
ORDER_STORE_ID=$(solana address -k target/deploy/order_store-keypair.json)
ORDER_PROCESSOR_ID=$(solana address -k target/deploy/order_processor-keypair.json)

echo "  Market:         $MARKET_ID"
echo "  OrderStore:     $ORDER_STORE_ID"
echo "  OrderProcessor: $ORDER_PROCESSOR_ID"
echo ""

# Step 3: Update declare_id! in source files
echo "[3/4] Updating program source files..."

# Update Market
sed -i.bak "s|declare_id!(\".*\");|declare_id!(\"$MARKET_ID\");|" programs/market/src/lib.rs
echo "  ✓ Updated programs/market/src/lib.rs"

# Update OrderStore  
sed -i.bak "s|declare_id!(\".*\");|declare_id!(\"$ORDER_STORE_ID\");|" programs/order-store/src/lib.rs
echo "  ✓ Updated programs/order-store/src/lib.rs"

# Update OrderProcessor
sed -i.bak "s|declare_id!(\".*\");|declare_id!(\"$ORDER_PROCESSOR_ID\");|" programs/order-processor/src/lib.rs
echo "  ✓ Updated programs/order-processor/src/lib.rs"

# Step 4: Update Anchor.toml
echo "[4/4] Updating Anchor.toml..."
sed -i.bak "/\[programs.devnet\]/,/^\[/ {
    /^market = /c\market = \"$MARKET_ID\"
    /^order_store = /c\order_store = \"$ORDER_STORE_ID\"
    /^order_processor = /c\order_processor = \"$ORDER_PROCESSOR_ID\"
}" Anchor.toml
echo "  ✓ Updated Anchor.toml"

echo ""
echo "=================================="
echo "✓ Preparation complete!"
echo "=================================="
echo ""
echo "Program IDs configured:"
echo "  Market:         $MARKET_ID"
echo "  OrderStore:     $ORDER_STORE_ID"
echo "  OrderProcessor: $ORDER_PROCESSOR_ID"
echo ""
echo "Next steps:"
echo "  1. anchor build"
echo "  2. anchor deploy --provider.cluster devnet"
echo ""

