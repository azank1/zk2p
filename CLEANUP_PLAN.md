# Repository Cleanup Plan

## Objective
Prepare repository for professional development: remove fluff, add .gitignore, keep only essential documentation.

---

## Files to Delete (Unnecessary for Developers)

### Demo UI Test Files
```
anomi-zk-prototype/demo-ui/
├── DEMO_INSTRUCTIONS.txt          ← DELETE (informal instructions)
├── debug-test.html                ← DELETE (debug only)
├── demo-commands.ps1              ← DELETE (demo scripts)
├── quick-test.ps1                 ← DELETE (demo scripts)
├── simple-demo.ps1                ← DELETE (demo scripts)
├── test-milestones.html           ← DELETE (testing UI)
├── test-milestones.ps1            ← DELETE (testing script)
└── test-results.md                ← DELETE (test notes)
```

### Redundant Documentation
```
anomi-zk-prototype/
├── PHASE1_COMPLETE.md             ← DELETE (too much detail/emojis)
├── QUICK_START_TESTING.md         ← DELETE (redundant with tests/README)
└── PHASE1_IMPLEMENTATION_SUMMARY.md (root) ← DELETE (implementation notes)
```

### Keep These Files
```
anomi-zk-prototype/
├── README.md                      ← KEEP (main entry point)
├── docs/
│   ├── PRODUCTION_TESTING.md      ← SIMPLIFY (remove emojis)
│   ├── COMPONENT_ISOLATION_TESTING.md ← SIMPLIFY
│   ├── CRITBIT_IMPLEMENTATION.md  ← KEEP (technical)
│   └── MATCHING_ENGINE.md         ← KEEP (technical)
├── tests/
│   ├── README_PRODUCTION_TESTS.md ← SIMPLIFY
│   └── production-readiness.ts    ← KEEP (tests)
└── demo-ui/
    ├── index.html                 ← KEEP (will become production UI)
    └── README.md                  ← KEEP (usage instructions)
```

---

## .gitignore Additions

Add to `.gitignore`:

```gitignore
# Build artifacts
target/
node_modules/
.anchor/
test-ledger/

# Test reports (generated)
test-reports/
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Solana
.solana/
test-ledger/

# Temporary files
*.tmp
.temp/
```

---

## Documentation Simplification

### Remove from All Docs:
- Emojis (✅ → [x], 🚀 → remove, etc.)
- Hype language ("Amazing!", "Incredible!", etc.)
- Boxes and decorative ASCII art
- Excessive formatting
- Implementation notes/diary entries

### Keep:
- Technical specifications
- Code examples
- Architecture diagrams (text-based)
- Test procedures
- API documentation

---

## Essential Documentation Structure (Final)

```
anomi-zk-prototype/
├── README.md                          # Project overview, quick start
├── docs/
│   ├── ARCHITECTURE.md                # System architecture (NEW, clean)
│   ├── TESTING.md                     # Test procedures (simplified)
│   ├── CRITBIT_IMPLEMENTATION.md      # Technical spec
│   ├── MATCHING_ENGINE.md             # Technical spec
│   └── ZK_INTEGRATION.md              # ZK integration plan (when ready)
├── tests/
│   └── README.md                      # How to run tests (simplified)
├── scripts/
│   ├── test-production.ps1            # Test automation
│   └── test-production.sh             # Test automation
└── demo-ui/
    └── README.md                      # UI documentation
```

---

## Simplified README.md Structure

```markdown
# ZK2P Protocol

Solana-based P2P fiat-to-crypto exchange with zero-knowledge proofs.

## Quick Start

### Build
```bash
cd anomi-zk-prototype
anchor build
```

### Test
```bash
# All tests
anchor test

# Production readiness
anchor test tests/production-readiness.ts
```

### Deploy to Devnet
```bash
solana config set --url devnet
anchor deploy
```

## Architecture

Multi-program design:
- Market: Order matching, CritBit-based order book
- OrderStore: Matched order persistence
- OrderProcessor: ZK proof validation (in progress)

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Testing Guide](docs/TESTING.md)
- [CritBit Implementation](docs/CRITBIT_IMPLEMENTATION.md)
- [Matching Engine](docs/MATCHING_ENGINE.md)

## Status

- Phase 1: Production testing complete
- Phase 2: ZK integration (waiting for source)
- Phase 3: Devnet deployment (next)

## License

[Your License]
```

---

## New File: docs/ARCHITECTURE.md

Create clean technical architecture document:

```markdown
# System Architecture

## Overview

ZK2P is a three-program Solana system for P2P fiat-to-crypto trading.

## Programs

### Market Program
- Order book management (CritBit tree)
- Order placement and matching
- Token escrow
- Self-trade prevention

### OrderStore Program
- Matched order persistence
- Trade history
- State management

### OrderProcessor Program
- ZK proof verification (in progress)
- Settlement orchestration
- Proof state tracking

## Data Structures

### Order Book
- CritBit trees for bids/asks
- O(log n) operations
- 50 price levels
- FIFO queues per level

### Order
- 122 bytes fixed size
- 5 types: Limit, Market, Post-Only, IOC, FOK
- u128 unique IDs
- Partial fill tracking

## Order Flow

1. Place ask order → tokens escrowed
2. Place bid order → matching engine runs
3. Match found → tokens transferred
4. ZK verification (future) → settlement confirmed

## Account Structure

PDAs:
- market: [b"market", token_mint]
- order_book: [b"order_book", token_mint]
- escrow_vault: [b"escrow_vault", token_mint]
- escrow_authority: [b"escrow_authority", token_mint]

## Performance

- Order placement: ~15K compute units
- Matching: ~30-40K compute units
- CritBit operations: O(log n)
- Max 50 price levels per side
```

---

## Action Items

1. Delete unnecessary demo files
2. Update .gitignore
3. Simplify documentation (remove emojis/hype)
4. Create clean ARCHITECTURE.md
5. Simplify README.md
6. Remove redundant files
7. Test that build/test still work

---

## Post-Cleanup Repository Structure

```
zk2p/
├── .gitignore                         # Updated
├── README.md                          # Simplified
├── workflow_ANOMI.md                  # Status (keep)
└── anomi-zk-prototype/
    ├── README.md                      # Simplified
    ├── Anchor.toml
    ├── Cargo.toml
    ├── package.json
    ├── docs/
    │   ├── ARCHITECTURE.md            # NEW (clean technical)
    │   ├── TESTING.md                 # Simplified
    │   ├── CRITBIT_IMPLEMENTATION.md  # Keep
    │   └── MATCHING_ENGINE.md         # Keep
    ├── programs/
    │   ├── market/
    │   ├── order-processor/
    │   └── order-store/
    ├── tests/
    │   ├── README.md                  # Simplified
    │   ├── production-readiness.ts
    │   ├── phase2-orderbook.ts
    │   └── escrow.ts
    ├── scripts/
    │   ├── test-production.ps1
    │   └── test-production.sh
    └── demo-ui/
        ├── index.html                 # Will become production UI
        └── README.md
```

Total reduction: ~8-10 files removed, documentation simplified.

---

## Validation

After cleanup:
- [ ] `anchor build` works
- [ ] `anchor test` works
- [ ] Documentation is clear and professional
- [ ] No unnecessary files in repository
- [ ] .gitignore covers all build artifacts
- [ ] README provides clear entry point

