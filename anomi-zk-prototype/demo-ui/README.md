# 2k2Peer DEX Interface

Interactive visualization of CritBit tree-based order matching.

## Run Locally

```bash
python -m http.server 8080 --bind 127.0.0.1
```

Open http://127.0.0.1:8080 in your browser.

## Features

**Order Entry:**
- Place ask orders (sell)
- Place bid orders (buy)
- Real-time order matching

**Order Book:**
- Live price-time sorted orders
- Partial fill tracking

**CritBit Tree Graph:**
- Interactive SVG visualization
- Root nodes (green)
- Internal nodes (purple) with bit positions
- Leaf nodes (blue) with prices

**Tree Structure:**
- Hierarchical view
- Node properties display
- Real-time synchronization

**Transaction Log:**
- All operations logged
- Insert/Remove/Match events
- CritBit tree operations

## What It Demonstrates

**CritBit Operations:**
- Insert: Add price levels with critical bit calculation
- Remove: Delete price levels with tree rebalancing
- Find: O(log n) price lookups
- Min/Max: Best bid/ask queries

**Order Matching:**
- Price-time priority sorting
- Partial fills
- FIFO at same price level
- Token escrow simulation

## Design

Blackhole.xyz-inspired UI:
- Dark theme with glassmorphism
- Neon accents (green/blue/purple)
- Smooth animations
- Responsive layout
