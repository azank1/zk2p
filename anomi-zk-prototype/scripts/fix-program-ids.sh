#!/bin/bash
# Fix Program ID Mismatch in Anchor.toml

echo "Getting actual program IDs from keypair files..."
echo ""

# Get actual program IDs
MARKET_ID=$(solana address -k target/deploy/market-keypair.json)
ORDER_STORE_ID=$(solana address -k target/deploy/order_store-keypair.json)
ORDER_PROCESSOR_ID=$(solana address -k target/deploy/order_processor-keypair.json)

echo "Found Program IDs:"
echo "  Market:         $MARKET_ID"
echo "  OrderStore:     $ORDER_STORE_ID"
echo "  OrderProcessor: $ORDER_PROCESSOR_ID"
echo ""

# Update Anchor.toml
echo "Updating Anchor.toml..."
sed -i.bak "/\[programs.devnet\]/,/\[/ {
    s|market = \".*\"|market = \"$MARKET_ID\"|
    s|order_store = \".*\"|order_store = \"$ORDER_STORE_ID\"|
    s|order_processor = \".*\"|order_processor = \"$ORDER_PROCESSOR_ID\"|
}" Anchor.toml

echo "✓ Anchor.toml updated"
echo ""

# Update lib.rs files with correct declare_id!
echo "Updating program lib.rs files..."

# Market
sed -i.bak "s|declare_id!(\".*\");|declare_id!(\"$MARKET_ID\");|" programs/market/src/lib.rs
echo "✓ Updated programs/market/src/lib.rs"

# OrderStore  
sed -i.bak "s|declare_id!(\".*\");|declare_id!(\"$ORDER_STORE_ID\");|" programs/order-store/src/lib.rs
echo "✓ Updated programs/order-store/src/lib.rs"

# OrderProcessor
sed -i.bak "s|declare_id!(\".*\");|declare_id!(\"$ORDER_PROCESSOR_ID\");|" programs/order-processor/src/lib.rs
echo "✓ Updated programs/order-processor/src/lib.rs"

echo ""
echo "======================================"
echo "✓ Configuration fixed!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Rebuild: anchor build"
echo "2. Redeploy: anchor deploy --provider.cluster devnet"
echo ""

