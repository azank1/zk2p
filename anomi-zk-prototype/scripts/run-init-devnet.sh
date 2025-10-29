#!/bin/bash
export ANCHOR_WALLET=~/.config/solana/id.json
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
if [ -z "$1" ]; then
    echo "Usage: ./scripts/run-init-devnet.sh <TOKEN_MINT_ADDRESS>"
    echo "First create a test token:"
    echo "  spl-token create-token --decimals 9"
    exit 1
fi
echo "Running init-devnet.ts with token mint: $1"
echo ""
ts-node scripts/init-devnet.ts "$1"

