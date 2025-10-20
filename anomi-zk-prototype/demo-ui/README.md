# ZK2P Order Matching Engine - Interactive Demo

## Quick Start

Open `index.html` in your browser:

```bash
# From this directory
open index.html  # macOS
xdg-open index.html  # Linux
start index.html  # Windows
```

Or start a simple HTTP server:

```bash
python3 -m http.server 8080
# Then visit: http://localhost:8080
```

## What This Demo Shows

This interactive UI simulates the **exact matching algorithm** from the Rust smart contract:

### Algorithm Details

**Sorting (Price-Time Priority):**
```rust
orders.sort_by(|a, b| a.price.cmp(&b.price).then(a.created_at.cmp(&b.created_at)))
```

**Matching Logic:**
- Sort all ask orders by **price (ascending)** → cheapest first
- Within same price, sort by **timestamp (ascending)** → oldest first (FIFO)
- Match bid against all asks where `ask.price ≤ bid.price`
- Support **partial fills** (split orders across multiple matches)

### UI Features

1. **Place Ask Orders** - Add sell orders to the book (simulates `place_ask_order()`)
2. **Create Bids** - Submit buy orders and watch matching in real-time (simulates `create_bid()`)
3. **Live Order Book** - See sorted orders with price-time priority
4. **Transaction Log** - Console-style output showing algorithm execution
5. **Stats Dashboard** - Track active orders, matches, and volume

### Try This

1. Add 3 ask orders: Alice (100 tokens @ $50), Bob (50 tokens @ $45), Carol (75 tokens @ $55)
2. Order book will auto-sort: Bob → Alice → Carol (by price)
3. Create bid: 120 tokens @ $52
4. Watch matching: Fills Bob (50), then Alice (70 partial), Carol skipped (too expensive)

## Algorithm Comparison

| Feature | Demo UI | Rust Contract |
|---------|---------|---------------|
| Sorting | `Array.sort()` | `Vec::sort_by()` |
| Price Priority | `a.price - b.price` | `a.price.cmp(&b.price)` |
| Time Priority | `a.created_at - b.created_at` | `a.created_at.cmp(&b.created_at)` |
| Matching | `askOrder.price <= price` | `ask_order.price <= price` |
| Partial Fills | `Math.min(remaining, ask.amount)` | `std::cmp::min(amount, ask_order.amount)` |

The JavaScript implementation is a **1:1 simulation** of the Solana program logic.
