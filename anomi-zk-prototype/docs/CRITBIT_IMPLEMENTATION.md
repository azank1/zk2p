# CritBit Tree Implementation

## Overview

CritBit (Critical Bit) tree is a binary search tree where internal nodes represent bit positions where keys differ. This implementation powers the order book for O(log n) operations.

## Data Structure

**Node Types:**
- **Leaf Node**: Stores price (key) and order index
- **Internal Node**: Stores critical bit position for routing

**Tree Properties:**
- Maximum capacity: 100 nodes
- Operations: O(log n) time complexity
- Space efficient: Fixed-size allocation

## Core Operations

### Insert Operation

**Algorithm:**
1. If tree empty, create root leaf node
2. Traverse to find insertion point
3. Calculate critical bit between new and existing key
4. Create new internal node at critical bit position
5. Attach new leaf and existing node as children
6. Update parent pointers

**Code Location:** `programs/market/src/critbit.rs` lines 130-204

**Time Complexity:** O(log n)

**Example:**
```
Insert $50 -> Root: $50
Insert $45 -> Internal(bit 5) -> Left: $45, Right: $50
Insert $52 -> Tree rebalances with new internal nodes
```

### Remove Operation

**Algorithm:**
1. Traverse to leaf node with target key
2. Remove leaf and parent internal node
3. Connect sibling to grandparent
4. Update tree structure

**Code Location:** `programs/market/src/critbit.rs` lines 207-265

**Time Complexity:** O(log n)

**Example:**
```
Remove $45 -> Sibling $50 moves up, internal node removed
```

### Find Operation

**Algorithm:**
1. Start at root
2. At each internal node, check bit at prefix position
3. Go left if bit is 0, right if bit is 1
4. Continue until leaf node found

**Time Complexity:** O(log n)

### Min/Max Operations

**Algorithm:**
1. Recursively traverse all leaves in subtree
2. Compare keys to find minimum/maximum
3. Return lowest/highest price level

**Code Location:** `programs/market/src/critbit.rs` lines 280-330

**Time Complexity:** O(n) for complete traversal
**Note:** CritBit routes by bit patterns, not value ordering

## Critical Bit Calculation

**Function:** `find_critical_bit(key1, key2)`

**Algorithm:**
```rust
let xor = key1 ^ key2;  // XOR to find differing bits
if xor == 0 return 64;  // Keys identical
return 63 - xor.leading_zeros() as u8;  // Highest bit position
```

**Example:**
```
$45 = 0b101101
$50 = 0b110010
XOR = 0b011111 -> Critical bit at position 5
```

## Integration with Order Book

**OrderBookV2 Structure:**
```rust
pub struct OrderBook {
    pub bids: CritBitTree,      // Buy orders (descending price)
    pub asks: CritBitTree,      // Sell orders (ascending price)
    pub order_queues: Vec<OrderQueue>,  // FIFO at each price
}
```

**Order Placement Flow:**
1. Place order -> Insert price into CritBit tree
2. Get tree index -> Map to order queue
3. Add order to FIFO queue at price level

**Matching Flow:**
1. Query min(asks) or max(bids) for best price
2. Traverse CritBit tree to find match
3. Execute fill -> Update order queue
4. If price level empty -> Remove from tree

## Performance Characteristics

**Operations:**
- Insert: O(log n)
- Remove: O(log n)
- Find: O(log n)
- Min/Max: O(n) (recursive leaf traversal)

**Space:**
- Node size: 26 bytes
- Max nodes: 100
- Total: ~2.6 KB per tree

**Scalability:**
- Supports 50 price levels (configurable)
- Each level can have multiple orders (FIFO queue)
- Fits within Solana's 10KB PDA limit

## Bit-Pattern Routing

**Key Insight:** CritBit trees route by bit patterns, not numerical order.

**Example Tree:**
```
         Root (bit 5)
        /            \
    (bit 3)        (bit 4)
    /    \         /     \
  $45   $47     $50     $52
```

**Routing Decision:**
- At each internal node, extract bit at prefix position
- Bit = 0 -> Go left
- Bit = 1 -> Go right

**Why This Matters:**
- Min/Max cannot simply traverse left/right
- Must recursively check all leaves
- Trade-off: O(log n) insert vs O(n) min/max

## Testing

**Unit Tests:** `cargo test --package market --lib critbit::tests`

**Test Coverage:**
- `test_critbit_insert_and_find`: Basic insert/find operations
- `test_critbit_min_max`: Min/max leaf traversal
- `test_critbit_remove`: Removal and tree rebalancing

**Edge Cases Tested:**
- Empty tree
- Single node
- Multiple insertions
- Removal of root
- Tree rebalancing

## Visualization

**Demo UI:** http://127.0.0.1:8080

The interactive visualization shows:
- Tree structure (SVG graph)
- Internal nodes with bit positions
- Leaf nodes with prices
- Real-time insert/remove animations
- Traversal path highlighting

## Future Enhancements

**Phase 2C:**
- Optimized min/max with caching
- Balanced tree maintenance
- Bulk insert/remove operations

**Phase 3:**
- Off-chain tree verification
- Zero-knowledge proofs of tree state
- Merkle tree integration

## References

- Serum DEX CritBit implementation
- OpenBook V2 order book design
- Original CritBit paper (D. J. Bernstein)

