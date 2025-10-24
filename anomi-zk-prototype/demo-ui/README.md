# 2k2Peer DEX Interface

Interactive visualization of CritBit tree-based order matching.

## Quick Start

### Windows

**Option 1: Double-click the script**
- Navigate to `demo-ui` folder
- Double-click `start-server.bat`

**Option 2: PowerShell**
```powershell
cd anomi-zk-prototype\demo-ui
.\start-server.ps1
```

**Option 3: Command Prompt**
```cmd
cd anomi-zk-prototype\demo-ui
python -m http.server 8080 --bind 127.0.0.1
```

### Linux/Mac

```bash
cd anomi-zk-prototype/demo-ui
python3 -m http.server 8080 --bind 127.0.0.1
```

### Access the UI

Open your browser to: **http://127.0.0.1:8080**

**Important:** Make sure to:
1. Run the command from inside the `demo-ui` directory
2. Navigate to `http://127.0.0.1:8080` (not just `http://127.0.0.1:8080/`)

### Stop the Server

Press `Ctrl+C` in the terminal

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
