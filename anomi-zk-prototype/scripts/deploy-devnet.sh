#!/bin/bash
# Deploy ZK2P Programs to Solana Devnet

set -e

echo "=================================="
echo "ZK2P Devnet Deployment Script"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Step 1: Configure Solana for devnet
echo -e "${CYAN}[1/5] Configuring Solana CLI for devnet...${NC}"
solana config set --url devnet
echo ""

# Step 2: Check balance and airdrop if needed
echo -e "${CYAN}[2/5] Checking SOL balance...${NC}"
BALANCE=$(solana balance | awk '{print $1}')
echo "Current balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 1" | bc -l) )); then
    echo -e "${YELLOW}Low balance, requesting airdrop...${NC}"
    solana airdrop 2 || echo -e "${YELLOW}⚠ Airdrop failed (rate limit), but continuing with current balance${NC}"
    sleep 5
    BALANCE=$(solana balance | awk '{print $1}')
    echo "New balance: $BALANCE SOL"
else
    echo -e "${GREEN}✓ Sufficient balance for deployment${NC}"
fi
echo ""

# Step 3: Build programs
echo -e "${CYAN}[3/5] Building Anchor programs...${NC}"
anchor build
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Step 4: Deploy programs
echo -e "${CYAN}[4/5] Deploying to devnet...${NC}"
anchor deploy --provider.cluster devnet

# Get program IDs
MARKET_PROGRAM=$(solana address -k target/deploy/market-keypair.json)
ORDER_STORE_PROGRAM=$(solana address -k target/deploy/order_store-keypair.json)
ORDER_PROCESSOR_PROGRAM=$(solana address -k target/deploy/order_processor-keypair.json)

echo ""
echo -e "${GREEN}✓ Deployment complete!${NC}"
echo ""

# Step 5: Save configuration
echo -e "${CYAN}[5/5] Saving deployment configuration...${NC}"

cat > scripts/devnet-config.json << EOF
{
  "network": "devnet",
  "programs": {
    "market": "$MARKET_PROGRAM",
    "order_store": "$ORDER_STORE_PROGRAM",
    "order_processor": "$ORDER_PROCESSOR_PROGRAM"
  },
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo -e "${GREEN}✓ Configuration saved to scripts/devnet-config.json${NC}"
echo ""

# Display summary
echo "=================================="
echo "Deployment Summary"
echo "=================================="
echo ""
echo "Network: Devnet"
echo "Market Program:         $MARKET_PROGRAM"
echo "OrderStore Program:     $ORDER_STORE_PROGRAM"
echo "OrderProcessor Program: $ORDER_PROCESSOR_PROGRAM"
echo ""
echo "View on Explorer:"
echo "https://explorer.solana.com/address/$MARKET_PROGRAM?cluster=devnet"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Create test token: npm run create-token"
echo "2. Initialize market: npm run init-market"
echo "3. Update UI config with program IDs"
echo ""

