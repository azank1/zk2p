# Unit Tests & Educational Tools

This directory contains standalone tools for understanding individual components in isolation.

---

## CritBit Tree Explorer

**File:** `critbit-explorer.ts`

**Purpose:** Interactive visualization of how CritBit trees work

**Run:**
```bash
npx ts-node tests/unit/critbit-explorer.ts
```

**What It Shows:**
- Step-by-step insertion process
- Binary representation of keys
- Critical bit calculation
- Tree structure visualization
- Search operation traces
- Min/max finding logic

**Example Output:**
```
=== Tree Structure ===
Root: Node 1
├─ Node 3: [Inner, bit=8]
│   ├─ Node 2: key=100, index=0
│   └─ Node 4: key=300, index=2
└─ Node 0: key=200, index=1
```

**Key Learning:**
- Understand why 300 is LEFT of 200 (bit patterns!)
- See how critical bits are calculated
- Trace search operations step-by-step

---

## Running Unit Tests

### All Unit Tests
```bash
cargo test --package market --lib
```

### Specific Component Tests
```bash
# CritBit tests
cargo test --package market --lib critbit::tests

# Order tests  
cargo test --package market --lib order::tests

# OrderBook tests
cargo test --package market --lib order_book::tests
```

### With Debug Output
```bash
cargo test --package market --lib critbit::tests -- --nocapture
```

---

## What Each Test File Covers

### `critbit.rs` Tests
- ✓ Insert and find operations
- ✓ Min/max leaf finding
- ✓ Remove operations
- ✓ Tree balancing

### `order.rs` Tests
- ✓ Order creation
- ✓ Order ID uniqueness
- ✓ Partial fills
- ✓ Order queue FIFO behavior

### `order_book.rs` Tests
- ✓ OrderBook initialization
- ✓ Order insertion into CritBit
- ✓ Best price tracking
- ✓ Order removal
- ✓ Spread calculation

---

## Educational Workflow

1. **Read Documentation:**
   - `docs/architecture/critbit-explained.md`
   - Understand bit-pattern routing

2. **Run Explorer:**
   ```bash
   npx ts-node tests/unit/critbit-explorer.ts
   ```
   - See visualizations
   - Experiment with different keys

3. **Run Unit Tests:**
   ```bash
   cargo test --package market --lib critbit::tests -- --nocapture
   ```
   - See actual Rust implementation
   - Compare with TypeScript explorer

4. **Modify and Experiment:**
   - Change keys in explorer
   - Add your own test cases
   - See how tree structure changes

---

## Next: Integration Testing

Once you understand components in isolation:
- Milestone 3: Order structure deep dive
- Milestone 4: Integrate into working program
- Milestone 5: Full system testing

**Goal:** Master each piece before combining them.

