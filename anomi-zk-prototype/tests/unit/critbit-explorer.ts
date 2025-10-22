/**
 * CritBit Tree Explorer
 * 
 * Interactive tool to visualize CritBit tree structure and operations.
 * This helps understand how bit-pattern routing works.
 * 
 * Run: npx ts-node tests/unit/critbit-explorer.ts
 */

// ANSI colors for output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
};

// Simulate CritBit node structure
interface CritBitNode {
  key: number;
  orderIndex: number;
  parent: number;
  left: number;
  right: number;
  prefixLen: number;
  isLeaf: boolean;
}

const EMPTY = 4294967295; // u32::MAX

class CritBitTreeExplorer {
  nodes: CritBitNode[];
  root: number;
  leafCount: number;
  maxNodes: number;

  constructor(maxNodes: number = 100) {
    this.maxNodes = maxNodes;
    this.nodes = Array(maxNodes).fill(null).map(() => ({
      key: 0,
      orderIndex: 0,
      parent: EMPTY,
      left: EMPTY,
      right: EMPTY,
      prefixLen: 0,
      isLeaf: false,
    }));
    this.root = EMPTY;
    this.leafCount = 0;
  }

  // Get bit at position (0 = rightmost)
  getBit(key: number, bitPos: number): boolean {
    return ((key >> bitPos) & 1) === 1;
  }

  // Find first differing bit
  findCriticalBit(key1: number, key2: number): number {
    const xor = key1 ^ key2;
    let bitPos = 63;
    while (bitPos >= 0) {
      if (((xor >> bitPos) & 1) === 1) {
        return bitPos;
      }
      bitPos--;
    }
    return 0;
  }

  // Allocate a new node
  allocNode(): number {
    for (let i = 0; i < this.maxNodes; i++) {
      // Find unused node (parent = EMPTY and not root)
      if (i !== this.root && this.nodes[i].parent === EMPTY && !this.nodes[i].isLeaf) {
        return i;
      }
    }
    
    // Just return next available
    return this.leafCount * 2; // Simple allocation for demo
  }

  // Insert a key
  insert(key: number, orderIndex: number): void {
    console.log(`\n${colors.bright}${colors.cyan}Inserting key=${key}, index=${orderIndex}${colors.reset}`);

    // Empty tree
    if (this.root === EMPTY) {
      const nodeIndex = this.allocNode();
      this.nodes[nodeIndex] = {
        key,
        orderIndex,
        parent: EMPTY,
        left: EMPTY,
        right: EMPTY,
        prefixLen: 0,
        isLeaf: true,
      };
      this.root = nodeIndex;
      this.leafCount = 1;
      
      console.log(`${colors.green}→ Created root node (Node ${nodeIndex})${colors.reset}`);
      return;
    }

    // Find insertion point
    let current = this.root;
    let depth = 0;
    
    console.log(`${colors.yellow}Traversing tree:${colors.reset}`);
    
    while (true) {
      const node = this.nodes[current];
      
      console.log(`${"  ".repeat(depth)}Node ${current}: ${node.isLeaf ? `key=${node.key}` : `inner, bit=${node.prefixLen}`}`);
      
      if (node.isLeaf) {
        // Found a leaf
        if (node.key === key) {
          console.log(`${colors.yellow}→ Key already exists, updating order_index${colors.reset}`);
          this.nodes[current].orderIndex = orderIndex;
          return;
        }

        // Create new inner node
        const critBit = this.findCriticalBit(key, node.key);
        console.log(`${colors.magenta}→ Critical bit between ${key} and ${node.key} is bit ${critBit}${colors.reset}`);
        
        this.visualizeBits(key, node.key, critBit);

        const innerIndex = this.allocNode();
        const leafIndex = this.allocNode();

        // Create new leaf
        this.nodes[leafIndex] = {
          key,
          orderIndex,
          parent: innerIndex,
          left: EMPTY,
          right: EMPTY,
          prefixLen: 0,
          isLeaf: true,
        };

        // Create inner node
        const newLeafGoesRight = this.getBit(key, critBit);
        this.nodes[innerIndex] = {
          key: 0,
          orderIndex: 0,
          parent: node.parent,
          left: newLeafGoesRight ? current : leafIndex,
          right: newLeafGoesRight ? leafIndex : current,
          prefixLen: critBit,
          isLeaf: false,
        };

        console.log(`${colors.green}→ Created inner Node ${innerIndex} (bit=${critBit})${colors.reset}`);
        console.log(`${colors.green}→ Created leaf Node ${leafIndex} (key=${key})${colors.reset}`);
        console.log(`${colors.blue}→ Routing: ${newLeafGoesRight ? `${node.key} LEFT, ${key} RIGHT` : `${key} LEFT, ${node.key} RIGHT`}${colors.reset}`);

        // Update existing leaf's parent
        this.nodes[current].parent = innerIndex;

        // Update parent's child pointer
        if (node.parent === EMPTY) {
          this.root = innerIndex;
          console.log(`${colors.green}→ New root is Node ${innerIndex}${colors.reset}`);
        } else {
          const parent = this.nodes[node.parent];
          if (parent.left === current) {
            this.nodes[node.parent].left = innerIndex;
          } else {
            this.nodes[node.parent].right = innerIndex;
          }
        }

        this.leafCount++;
        return;
      }

      // Inner node - traverse
      if (this.getBit(key, node.prefixLen)) {
        console.log(`${"  ".repeat(depth)}→ Bit ${node.prefixLen} of ${key} = 1, go RIGHT`);
        current = node.right;
      } else {
        console.log(`${"  ".repeat(depth)}→ Bit ${node.prefixLen} of ${key} = 0, go LEFT`);
        current = node.left;
      }
      depth++;
    }
  }

  // Visual representation of bit differences
  visualizeBits(key1: number, key2: number, critBit: number): void {
    const binary1 = key1.toString(2).padStart(16, '0');
    const binary2 = key2.toString(2).padStart(16, '0');
    
    console.log(`\n${colors.dim}Binary representation:${colors.reset}`);
    console.log(`  ${key1.toString().padStart(4)} = ${binary1}`);
    console.log(`  ${key2.toString().padStart(4)} = ${binary2}`);
    
    // Show XOR
    const xor = key1 ^ key2;
    const binaryXor = xor.toString(2).padStart(16, '0');
    console.log(`  XOR  = ${binaryXor}`);
    
    // Highlight critical bit
    const highlight = " ".repeat(9 + (15 - critBit)) + "↑";
    console.log(`  ${highlight} ${colors.red}bit ${critBit}${colors.reset}\n`);
  }

  // Print tree structure
  printTree(): void {
    console.log(`\n${colors.bright}${colors.cyan}=== Tree Structure ===${colors.reset}`);
    console.log(`Root: Node ${this.root}`);
    console.log(`Leaf count: ${this.leafCount}`);
    console.log();
    
    if (this.root !== EMPTY) {
      this.printNode(this.root, "", true);
    }
    
    console.log();
  }

  // Recursively print tree
  printNode(nodeIndex: number, prefix: string, isLast: boolean): void {
    if (nodeIndex === EMPTY) return;

    const node = this.nodes[nodeIndex];
    const connector = isLast ? "└─ " : "├─ ";
    
    if (node.isLeaf) {
      console.log(`${prefix}${connector}${colors.green}Node ${nodeIndex}: key=${node.key}, index=${node.orderIndex}${colors.reset}`);
    } else {
      console.log(`${prefix}${connector}${colors.yellow}Node ${nodeIndex}: [Inner, bit=${node.prefixLen}]${colors.reset}`);
      
      const newPrefix = prefix + (isLast ? "    " : "│   ");
      
      // Print left subtree
      if (node.left !== EMPTY) {
        this.printNode(node.left, newPrefix, node.right === EMPTY);
      }
      
      // Print right subtree
      if (node.right !== EMPTY) {
        this.printNode(node.right, newPrefix, true);
      }
    }
  }

  // Find min/max using same algorithm as Rust
  findMin(): { key: number; index: number } | null {
    if (this.root === EMPTY) return null;
    return this.findMinLeaf(this.root);
  }

  findMinLeaf(nodeIndex: number): { key: number; index: number } | null {
    if (nodeIndex === EMPTY) return null;
    
    const node = this.nodes[nodeIndex];
    
    if (node.isLeaf) {
      return { key: node.key, index: node.orderIndex };
    }
    
    const leftMin = this.findMinLeaf(node.left);
    const rightMin = this.findMinLeaf(node.right);
    
    if (leftMin && rightMin) {
      return leftMin.key < rightMin.key ? leftMin : rightMin;
    }
    return leftMin || rightMin;
  }

  findMax(): { key: number; index: number } | null {
    if (this.root === EMPTY) return null;
    return this.findMaxLeaf(this.root);
  }

  findMaxLeaf(nodeIndex: number): { key: number; index: number } | null {
    if (nodeIndex === EMPTY) return null;
    
    const node = this.nodes[nodeIndex];
    
    if (node.isLeaf) {
      return { key: node.key, index: node.orderIndex };
    }
    
    const leftMax = this.findMaxLeaf(node.left);
    const rightMax = this.findMaxLeaf(node.right);
    
    if (leftMax && rightMax) {
      return leftMax.key > rightMax.key ? leftMax : rightMax;
    }
    return leftMax || rightMax;
  }

  // Find a specific key
  find(key: number): number | null {
    if (this.root === EMPTY) return null;
    
    let current = this.root;
    console.log(`\n${colors.cyan}Searching for key ${key}:${colors.reset}`);
    
    while (true) {
      const node = this.nodes[current];
      
      if (node.isLeaf) {
        if (node.key === key) {
          console.log(`${colors.green}✓ Found at Node ${current}, order_index=${node.orderIndex}${colors.reset}`);
          return node.orderIndex;
        } else {
          console.log(`${colors.red}✗ Not found (reached leaf with key=${node.key})${colors.reset}`);
          return null;
        }
      }
      
      const bit = this.getBit(key, node.prefixLen);
      console.log(`  Node ${current}: Check bit ${node.prefixLen} of ${key} = ${bit ? 1 : 0} → ${bit ? "RIGHT" : "LEFT"}`);
      
      current = bit ? node.right : node.left;
    }
  }
}

// ============================================================================
// Interactive Demo
// ============================================================================

function header(text: string) {
  console.log(`\n${colors.bright}${colors.cyan}${"=".repeat(70)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${text}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${"=".repeat(70)}${colors.reset}`);
}

function section(text: string) {
  console.log(`\n${colors.bright}${colors.yellow}${text}${colors.reset}`);
  console.log(`${colors.yellow}${"-".repeat(text.length)}${colors.reset}`);
}

async function runExplorer() {
  header("CritBit Tree Interactive Explorer");

  console.log(`
This tool demonstrates how CritBit trees work by inserting keys
and showing the resulting tree structure step-by-step.

${colors.bright}Key Concept:${colors.reset} CritBit trees route based on BIT PATTERNS,
not value comparisons. This is why 300 can be LEFT of 200!
`);

  // ============================================================================
  // Demo 1: The 100, 200, 300 Example
  // ============================================================================

  section("Demo 1: Insert 100, 200, 300 (Same as Rust test)");

  const tree1 = new CritBitTreeExplorer(100);

  console.log(`${colors.bright}Step 1: Insert 200${colors.reset}`);
  tree1.insert(200, 1);
  tree1.printTree();

  console.log(`${colors.bright}Step 2: Insert 100${colors.reset}`);
  tree1.insert(100, 0);
  tree1.printTree();

  console.log(`${colors.bright}Step 3: Insert 300${colors.reset}`);
  tree1.insert(300, 2);
  tree1.printTree();

  // Find min/max
  section("Finding Min and Max");
  const min = tree1.findMin();
  const max = tree1.findMax();
  
  console.log(`${colors.green}Minimum: ${min ? `key=${min.key}, index=${min.index}` : "None"}${colors.reset}`);
  console.log(`${colors.green}Maximum: ${max ? `key=${max.key}, index=${max.index}` : "None"}${colors.reset}`);

  console.log(`\n${colors.magenta}Why is 300 on the LEFT and 200 on the RIGHT?${colors.reset}`);
  console.log("Because CritBit routes by BIT 7:");
  console.log(`  100 (bit 7 = 0) → LEFT`);
  console.log(`  200 (bit 7 = 1) → RIGHT`);
  console.log(`  300 (bit 7 = 0) → LEFT (same as 100!)`);

  // ============================================================================
  // Demo 2: Order Book Prices
  // ============================================================================

  section("Demo 2: Realistic Order Book Prices");

  const tree2 = new CritBitTreeExplorer(100);
  const prices = [50_000, 45_000, 55_000, 42_000, 48_000, 52_000, 58_000];

  console.log(`Inserting prices: ${prices.map(p => `$${p/1000}`).join(", ")}\n`);

  prices.forEach((price, i) => {
    console.log(`\n${colors.bright}${colors.blue}──────────────────────────────────${colors.reset}`);
    tree2.insert(price, i);
  });

  tree2.printTree();

  // Test searches
  section("Search Operations");
  
  const searchPrices = [45_000, 50_000, 60_000];
  searchPrices.forEach(price => {
    tree2.find(price);
  });

  const min2 = tree2.findMin();
  const max2 = tree2.findMax();
  console.log(`\n${colors.green}Best ask (min): $${min2 ? min2.key / 1000 : "N/A"}${colors.reset}`);
  console.log(`${colors.green}Best bid (max): $${max2 ? max2.key / 1000 : "N/A"}${colors.reset}`);

  // ============================================================================
  // Demo 3: Sequential vs Random Insertion
  // ============================================================================

  section("Demo 3: Sequential vs Random Insertion");

  console.log(`${colors.bright}Sequential insertion (10, 20, 30, 40, 50):${colors.reset}`);
  const tree3 = new CritBitTreeExplorer(100);
  [10, 20, 30, 40, 50].forEach((key, i) => {
    tree3.insert(key, i);
  });
  tree3.printTree();

  console.log(`\n${colors.bright}Random insertion (30, 10, 50, 20, 40):${colors.reset}`);
  const tree4 = new CritBitTreeExplorer(100);
  [30, 10, 50, 20, 40].forEach((key, i) => {
    tree4.insert(key, i);
  });
  tree4.printTree();

  console.log(`\n${colors.magenta}Observation:${colors.reset} Tree structure differs based on insertion order!`);
  console.log(`This is because each insertion depends on the current tree state.`);

  // ============================================================================
  // Demo 4: Binary Representation Analysis
  // ============================================================================

  section("Demo 4: Understanding Bit Patterns");

  const testKeys = [100, 200, 300];
  console.log(`\nAnalyzing keys: ${testKeys.join(", ")}\n`);

  testKeys.forEach(key => {
    const binary = key.toString(2).padStart(16, '0');
    console.log(`${key.toString().padStart(3)} = ${binary}`);
  });

  console.log(`\nBit positions (from right):`);
  console.log(`                FEDCBA9876543210`);
  
  console.log(`\n${colors.bright}Key differences:${colors.reset}`);
  console.log(`100 vs 200: Bit ${tree1.findCriticalBit(100, 200)} differs first`);
  console.log(`100 vs 300: Bit ${tree1.findCriticalBit(100, 300)} differs first`);
  console.log(`200 vs 300: Bit ${tree1.findCriticalBit(200, 300)} differs first`);

  // ============================================================================
  // Summary
  // ============================================================================

  section("Summary");

  console.log(`
${colors.bright}Key Insights:${colors.reset}

1. ${colors.green}Routing by Bits, Not Values${colors.reset}
   - LEFT/RIGHT determined by bit pattern, not magnitude
   - 300 can be LEFT of 200 if their bits differ that way

2. ${colors.green}Critical Bit = First Difference${colors.reset}
   - XOR highlights differing bits
   - First 1-bit in XOR is the critical bit position

3. ${colors.green}Tree Structure Varies${colors.reset}
   - Depends on insertion order
   - Same keys, different order → different tree shape
   - But all trees support same operations

4. ${colors.green}O(log n) Guarantees${colors.reset}
   - Maximum depth = number of bits (64 for u64)
   - Each level eliminates ~50% of search space
   - Efficient even with millions of keys

5. ${colors.green}Min/Max Requires Full Traversal${colors.reset}
   - Can't just "go right" for max
   - Must check all leaves (or cache values)
   - Tradeoff for other efficiencies

${colors.bright}Why Use CritBit in Solana Order Books?${colors.reset}

✓ Fixed-size array (PDA-compatible)
✓ No heap allocations
✓ O(log n) insert/find/remove
✓ Efficient sparse key space handling
✓ Deterministic memory layout

${colors.bright}Try This:${colors.reset}

Modify this script to insert your own keys and see how the tree changes!
Compare tree structures with different insertion orders.
Experiment with prices from real markets.

${colors.green}Explorer complete!${colors.reset}
  `);
}

// Run the explorer
runExplorer().catch(console.error);

