<!-- ce485ff3-4474-4d11-8f60-2054e749a627 78472bea-f7bd-4b98-becb-6df7ac88026f -->
# Milestone 4.5: CritBit Tree Visualization UI

## Overview

Enhance the DEX UI to visualize CritBit tree operations in real-time with an interactive graph and hierarchical view, using blackhole.xyz-inspired design.

## Implementation Steps

### 1. Update UI Design (demo-ui/index.html)

**Location:** `anomi-zk-prototype/demo-ui/index.html`

**Changes:**

- Add glassmorphism effects (frosted glass panels with backdrop-filter)
- Implement neon accents (green: #00ff88, blue: #00aaff, purple: #aa00ff)
- Add CSS animations for node insertions/removals
- Create 4-panel grid layout:
  - Left: Order Entry (existing)
  - Middle-Left: Order Book (existing)
  - Middle-Right: CritBit Graph Visualization (new)
  - Right: Hierarchical Tree View (new)
  - Bottom: Transaction Log (existing)

**CSS Enhancements:**

```css
.glass-panel {
    background: rgba(26, 26, 26, 0.7);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 255, 136, 0.2);
    box-shadow: 0 8px 32px rgba(0, 255, 136, 0.1);
}

.neon-glow {
    box-shadow: 0 0 10px rgba(0, 255, 136, 0.5),
                0 0 20px rgba(0, 255, 136, 0.3);
}

@keyframes node-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
}
```

### 2. CritBit Graph Visualization (SVG)

**New Section in HTML:**

**Features:**

- Interactive SVG graph with nodes and edges
- Node types:
  - Root (green neon circle)
  - Internal nodes (purple circles with bit position labels)
  - Leaf nodes (blue rectangles with price + order count)
- Animated edge drawing when inserting nodes
- Node highlighting during operations
- Pan/zoom functionality

**JavaScript Structure:**

```javascript
class CritBitGraphVisualizer {
    constructor(svgElement) {
        this.svg = svgElement;
        this.nodes = [];
        this.edges = [];
    }
    
    renderTree(critbitTree) {
        // Calculate node positions using tree layout algorithm
        // Draw nodes with appropriate colors/shapes
        // Draw edges with bezier curves
        // Add labels for bit positions and prices
    }
    
    animateInsert(nodeId, parentId) {
        // Pulse animation on new node
        // Edge draw animation from parent
    }
    
    animateRemove(nodeId) {
        // Fade out animation
        // Reconnect edges with smooth transition
    }
    
    highlightTraversal(path) {
        // Highlight nodes in path
        // Show bit comparisons at each step
    }
}
```

### 3. Hierarchical Tree View

**New Panel:**

**Features:**

- Expandable/collapsible tree structure
- Shows tree depth and node relationships
- Displays node properties:
  - Key (price)
  - Order index
  - Prefix length (bit position)
  - Parent/Left/Right pointers
- Color-coded nodes matching graph
- Real-time updates synchronized with graph

**HTML Structure:**

```html
<div class="tree-hierarchy">
    <div class="tree-node root" data-node-id="0">
        <span class="node-label">Root (bit 5)</span>
        <div class="node-children">
            <div class="tree-node internal">...</div>
            <div class="tree-node leaf">...</div>
        </div>
    </div>
</div>
```

### 4. CritBit Tree Implementation (JavaScript)

**File:** `anomi-zk-prototype/demo-ui/index.html` (within script tag)

**Implement CritBit operations based on critbit.rs:**

```javascript
class CritBitTree {
    constructor() {
        this.nodes = [];
        this.root = null;
        this.leafCount = 0;
        this.freeList = 0;
    }
    
    findCriticalBit(key1, key2) {
        // XOR keys and find highest bit position
    }
    
    getBit(key, bitPos) {
        // Extract bit at position
    }
    
    insert(key, orderIndex) {
        // Implement insert logic from critbit.rs lines 130-204
        // Trigger graph animation
        // Update hierarchical view
    }
    
    remove(key) {
        // Implement remove logic from critbit.rs lines 207-265
        // Trigger remove animation
    }
    
    find(key) {
        // Implement find with traversal path tracking
        // Highlight path in graph
    }
    
    min() {
        // Find minimum key (best bid)
        // Show traversal animation
    }
    
    max() {
        // Find maximum key (best ask)
        // Show traversal animation
    }
}
```

### 5. Integration with Order Book

**Update existing order placement functions:**

```javascript
function placeAskOrder() {
    // Existing order placement logic...
    
    // NEW: Update CritBit tree
    const priceLevel = parseInt(price);
    critbitTree.insert(priceLevel, orderBook.last_order_id);
    
    // Visualize insert operation
    graphVisualizer.animateInsert(priceLevel);
    hierarchyView.updateTree(critbitTree);
    
    // Log tree operation
    log(`🌳 CritBit Insert: price ${priceLevel}`, 'info');
}

function placeBidOrder() {
    // Existing matching logic...
    
    // NEW: Show tree traversal for finding best ask
    const traversalPath = critbitTree.findMinPath();
    graphVisualizer.highlightTraversal(traversalPath);
    
    // Remove matched orders from tree
    matchedOrders.forEach(order => {
        if (order.amount === 0) {
            critbitTree.remove(order.price);
            graphVisualizer.animateRemove(order.price);
        }
    });
}
```

### 6. Visual Operation Indicators

**Show these CritBit operations:**

1. **Insert Operation:**

   - Find critical bit between new and existing key
   - Create inner node at critical bit position
   - Add new leaf node
   - Show bit comparison at each step

2. **Remove Operation:**

   - Traverse to leaf node
   - Remove leaf and parent inner node
   - Reconnect sibling to grandparent
   - Animate tree restructuring

3. **Traversal (Find Min/Max):**

   - Highlight path from root to target leaf
   - Show bit decisions at each inner node
   - Display final result

4. **Best Bid/Ask Queries:**

   - Animate traversal to leftmost/rightmost leaf
   - Show O(log n) efficiency

### 7. Animation Timing

- Insert animation: 500ms
- Remove animation: 400ms
- Traversal highlight: 300ms per node
- Node pulse: 800ms
- Edge draw: 600ms

### 8. Responsive Layout

- Grid adjusts to 2x2 on medium screens
- Graph/hierarchy stack vertically on mobile
- Maintain aspect ratio for SVG graph

## Files to Modify

1. `anomi-zk-prototype/demo-ui/index.html` - Complete rewrite with new design and CritBit implementation
2. `anomi-zk-prototype/demo-ui/favicon.ico` - Already exists

## Testing Checklist

- Place multiple ask orders at different prices → verify tree structure
- Place bid orders → verify tree updates and traversal animations
- Test edge cases: single node, removal of root, tree rebalancing
- Verify glassmorphism effects in modern browsers
- Test responsive design at different screen sizes

## Success Criteria

- Interactive CritBit graph shows correct tree structure
- Real-time animations for all operations (insert, remove, traversal)
- Hierarchical view synchronized with graph
- Blackhole.xyz-inspired design (dark, glassmorphism, neon, animated)
- All operations from critbit.rs visualized
- Ready for on-chain integration (stubs for future deployment)

## Future Integration (Out of Scope for This Milestone)

- Connect to actual Solana program via Anchor
- Fetch on-chain CritBit tree state
- Submit transactions from UI
- Real-time WebSocket updates

### To-dos

- [ ] Implement blackhole.xyz-inspired design: dark theme, glassmorphism panels, neon accents (green/blue/purple), CSS animations
- [ ] Create 4-panel responsive grid layout: Order Entry, Order Book, CritBit Graph, Hierarchical Tree, Transaction Log
- [ ] Implement CritBit tree in JavaScript: insert, remove, find, min, max operations matching critbit.rs logic
- [ ] Build interactive SVG graph visualizer: nodes (root/internal/leaf), edges, animations for insert/remove/traversal
- [ ] Create hierarchical tree view: expandable nodes, display node properties, synchronized with graph
- [ ] Integrate CritBit operations with order placement: update tree on insert, show traversal on matching, animate removals
- [ ] Implement operation animations: insert (500ms), remove (400ms), traversal highlighting, node pulse effects
- [ ] Test all operations: multiple orders, edge cases, responsive design, browser compatibility