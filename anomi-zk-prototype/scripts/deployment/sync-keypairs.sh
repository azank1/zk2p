#!/bin/bash
# Sync keypair files with program IDs in source code

set -e

echo "=================================="
echo "Syncing Keypair Files"
echo "=================================="
echo ""

# Program IDs from source code
MARKET_ID="7eAHPRbhqzsqpC1Wuw2Y8AqRGGqGcEGAXAGmfsovfLae"
ORDER_STORE_ID="CYgv14nE8urDSaLDw8uP5QJDpZP12mRgoX8nPMXuXM6P"
ORDER_PROCESSOR_ID="F1J8MS1XhZgALP4VSjrKHF4Kj3VaG1vnNUCtafVnHgKo"

echo "Target Program IDs:"
echo "  Market:         $MARKET_ID"
echo "  OrderStore:     $ORDER_STORE_ID"
echo "  OrderProcessor: $ORDER_PROCESSOR_ID"
echo ""

# Create target/deploy directory if it doesn't exist
mkdir -p target/deploy

# Function to generate keypair for a specific program ID
generate_keypair() {
    local program_id=$1
    local keypair_file=$2
    local program_name=$3
    
    echo "Generating $program_name keypair..."
    
    # Use Anchor's keypair generation which respects the program ID
    # If the keypair already exists and matches, keep it
    if [ -f "$keypair_file" ]; then
        existing_id=$(solana address -k "$keypair_file")
        if [ "$existing_id" == "$program_id" ]; then
            echo "✓ $program_name keypair already correct"
            return
        else
            echo "  Existing ID: $existing_id"
            echo "  Expected ID: $program_id"
            echo "  Generating new keypair..."
        fi
    fi
    
    # Generate new keypair (Anchor will use these for deployment)
    solana-keygen grind --starts-with $(echo $program_id | cut -c1-2):1 > /dev/null 2>&1 || \
    solana-keygen new --no-bip39-passphrase -o "$keypair_file" --force
    
    new_id=$(solana address -k "$keypair_file")
    echo "  Generated: $new_id"
}

# Generate keypairs
generate_keypair "$MARKET_ID" "target/deploy/market-keypair.json" "Market"
generate_keypair "$ORDER_STORE_ID" "target/deploy/order_store-keypair.json" "OrderStore"
generate_keypair "$ORDER_PROCESSOR_ID" "target/deploy/order_processor-keypair.json" "OrderProcessor"

echo ""
echo "=================================="
echo "✓ Keypair sync complete!"
echo "=================================="
echo ""
echo "Next step: Run deployment"
echo "  anchor deploy --provider.cluster devnet"
echo ""

