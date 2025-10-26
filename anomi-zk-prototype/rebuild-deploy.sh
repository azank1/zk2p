#!/bin/sh
cd /mnt/d/dev/zk2p/anomi-zk-prototype
echo "Cleaning build..."
cargo clean
echo "Rebuilding programs..."
anchor build
echo "Deploying to devnet..."
anchor deploy --provider.cluster devnet
