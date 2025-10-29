#!/bin/bash
# Check and display all program IDs

echo "=================================="
echo "Program ID Status Check"
echo "=================================="
echo ""

echo "1. KEYPAIR FILES (actual deployed IDs):"
if [ -f "target/deploy/market-keypair.json" ]; then
    MARKET_KEYPAIR=$(solana address -k target/deploy/market-keypair.json)
    echo "   Market keypair:         $MARKET_KEYPAIR"
else
    echo "   Market keypair:         NOT FOUND"
fi

if [ -f "target/deploy/order_store-keypair.json" ]; then
    ORDER_STORE_KEYPAIR=$(solana address -k target/deploy/order_store-keypair.json)
    echo "   OrderStore keypair:     $ORDER_STORE_KEYPAIR"
else
    echo "   OrderStore keypair:     NOT FOUND"
fi

if [ -f "target/deploy/order_processor-keypair.json" ]; then
    ORDER_PROCESSOR_KEYPAIR=$(solana address -k target/deploy/order_processor-keypair.json)
    echo "   OrderProcessor keypair: $ORDER_PROCESSOR_KEYPAIR"
else
    echo "   OrderProcessor keypair: NOT FOUND"
fi

echo ""
echo "2. SOURCE CODE (declare_id! in lib.rs):"
MARKET_SRC=$(grep "declare_id!" programs/market/src/lib.rs | sed 's/.*"\(.*\)".*/\1/')
echo "   Market source:          $MARKET_SRC"

ORDER_STORE_SRC=$(grep "declare_id!" programs/order-store/src/lib.rs | sed 's/.*"\(.*\)".*/\1/')
echo "   OrderStore source:      $ORDER_STORE_SRC"

ORDER_PROCESSOR_SRC=$(grep "declare_id!" programs/order-processor/src/lib.rs | sed 's/.*"\(.*\)".*/\1/')
echo "   OrderProcessor source:  $ORDER_PROCESSOR_SRC"

echo ""
echo "3. ANCHOR.TOML [programs.devnet]:"
echo "   (configured IDs for deployment)"

echo ""
echo "=================================="
echo "DIAGNOSIS:"
echo "=================================="

if [ "$MARKET_KEYPAIR" != "$MARKET_SRC" ]; then
    echo "❌ Market: MISMATCH!"
    echo "   Keypair: $MARKET_KEYPAIR"
    echo "   Source:  $MARKET_SRC"
else
    echo "✓ Market: OK"
fi

if [ "$ORDER_STORE_KEYPAIR" != "$ORDER_STORE_SRC" ]; then
    echo "❌ OrderStore: MISMATCH!"
    echo "   Keypair: $ORDER_STORE_KEYPAIR"
    echo "   Source:  $ORDER_STORE_SRC"
else
    echo "✓ OrderStore: OK"
fi

if [ "$ORDER_PROCESSOR_KEYPAIR" != "$ORDER_PROCESSOR_SRC" ]; then
    echo "❌ OrderProcessor: MISMATCH!"
    echo "   Keypair: $ORDER_PROCESSOR_KEYPAIR"
    echo "   Source:  $ORDER_PROCESSOR_SRC"
else
    echo "✓ OrderProcessor: OK"
fi

echo ""

