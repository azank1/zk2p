# Implementation Plan: P2P Settlement Layer

**Date**: October 20, 2025  
**Status**: Ready to Begin Implementation  
**Reference**: VISION_VS_IMPLEMENTATION.md, FULL_FLOW_ANALYSIS.md

---

## 🎯 Implementation Strategy: Option C (Two Parallel Tracks)

**Decision**: Keep `anomi-zk-prototype` as architectural reference, build full P2P system separately.

**Rationale**:
- ✅ Prototype successfully validated CPI patterns and ZK architecture
- ✅ P2P system requires 70% new features (escrow, dual proofs, UI)
- ✅ Cleaner to build fresh than retrofit existing code

---

## 📋 Phase Breakdown (6-7 Weeks Total)

### Phase 0.5: Token Escrow Foundation (Week 1)
**Goal**: Add SPL Token custody to Market Program

**Tasks**:
1. [ ] Add SPL Token dependency to `programs/market/Cargo.toml`
2. [ ] Create escrow vault PDA structure
   - Seeds: `[b"escrow_vault", token_mint, market_id]`
   - Authority: `[b"escrow_authority", market_id]`
3. [ ] Implement `place_ask_order` instruction
   - Accept token transfer from seller
   - Store in escrow vault
   - Create order in order book (stub for now)
4. [ ] Write tests for escrow deposit
5. [ ] Implement `release_escrowed_funds` instruction
   - Permissioned: Only OrderProcessor can call
   - Transfer tokens from vault to buyer
   - Validate authority

**Deliverables**:
- Working token custody system
- Tested escrow deposit/release flow
- Security: Proper PDA authority controls

**Files to Create/Modify**:
- `programs/market/Cargo.toml` - Add anchor-spl
- `programs/market/src/lib.rs` - Add escrow instructions
- `programs/market/src/state.rs` - Add EscrowVault account
- `tests/escrow.ts` - Escrow-specific tests

---

### Phase 1: Real ZK Circuit (Week 2)
**Goal**: Replace mock proofs with compiled Groth16 circuit

**Tasks**:
1. [ ] Download Powers of Tau ceremony
   ```bash
   cd anomi-zk-prototype/zk-stuff
   wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau
   ```
2. [ ] Compile circuit
   ```bash
   ./compile_circuit.sh
   ```
3. [ ] Verify compilation outputs:
   - `circuit.wasm` (proof generation)
   - `circuit_final.zkey` (proving key)
   - `verification_key.json` (verification key)
4. [ ] Update `proof-generator.js`
   - Replace mock with `snarkjs.groth16.fullProve()`
   - Use compiled WASM and zkey
5. [ ] Test with real proofs
   - Update test suite to use real proof generator
   - Verify tests still pass: `2 passing`

**Deliverables**:
- Compiled ZK circuit artifacts
- Real Groth16 proof generation
- Updated test suite with real proofs

**Files to Modify**:
- `zk-stuff/proof-generator.js` - Real proof generation
- `zk-stuff/circuit.circom` - Verify constraints
- `tests/anomi-zk-prototype.ts` - Use real proofs

---

### Phase 2A: Production Market - Order Book (Week 3)
**Goal**: Replace stub Market with real order book

**Tasks**:
1. [ ] Design order book data structure
   - Option A: Single OrderBook account with Vec<Order>
   - Option B: Separate Order PDAs (more scalable)
   - **Recommendation**: Option B for Solana account limits
2. [ ] Implement Order PDA structure
   ```rust
   #[account]
   pub struct Order {
       pub order_id: u64,
       pub trader: Pubkey,
       pub side: OrderSide, // Bid or Ask
       pub amount: u64,
       pub price: u64,
       pub token_mint: Pubkey,
       pub payment_method: String, // Easypaisa details
       pub created_at: i64,
       pub expires_at: i64,
   }
   ```
3. [ ] Implement `place_ask_order` instruction
   - Create Order PDA
   - Transfer tokens to escrow (from Phase 0.5)
   - Store payment method metadata
4. [ ] Implement `place_bid_order` instruction
   - Create Order PDA (or match immediately)
   - Search for matching ask orders
5. [ ] Implement matching engine
   - Price-time priority algorithm
   - Find best matching ask for bid
   - Create MatchedOrder via CPI
   - Remove matched orders from book

**Deliverables**:
- Real order book with persistent Order PDAs
- Price-time priority matching
- Payment method storage

**Files to Create/Modify**:
- `programs/market/src/state.rs` - Order struct
- `programs/market/src/lib.rs` - place_ask_order, place_bid_order, matching logic
- `programs/market/src/matching.rs` - Matching engine
- `tests/market.ts` - Order book tests

---

### Phase 2B: Payment Metadata & Dual ZK Proofs (Week 4)
**Goal**: Add fiat payment integration and dual ZK proof system

**Tasks**:
1. [ ] Add payment metadata to MatchedOrder
   ```rust
   pub struct MatchedOrder {
       // ... existing fields
       pub payment_method: String,    // Seller's Easypaisa/bank details
       pub expires_at: i64,            // 24-hour timeout
       pub proof_hash: [u8; 32],       // Replay attack prevention
   }
   ```
2. [ ] Create ZK Solvency Circuit
   - New circuit: `zk-stuff/solvency_circuit.circom`
   - Proves buyer has sufficient funds
   - Public inputs: amount, price
   - Private inputs: account balances
3. [ ] Add solvency proof validation to `place_bid_order`
   - Validate proof before allowing bid
   - Prevents insufficient funds scenarios
4. [ ] Update ZK Payment Circuit
   - Existing: `zk-stuff/circuit.circom`
   - Verify includes payment receipt hash
5. [ ] Add PaymentConfirmed status
   ```rust
   pub enum OrderStatus {
       Pending,
       PaymentConfirmed, // NEW: Intermediate status
       Settled,
       Cancelled,
   }
   ```

**Deliverables**:
- Dual ZK proof system (solvency + payment)
- Payment metadata storage
- Enhanced state machine

**Files to Create/Modify**:
- `zk-stuff/solvency_circuit.circom` - New circuit
- `zk-stuff/compile_solvency.sh` - Compilation script
- `programs/order-store/src/lib.rs` - Add payment_method, expires_at, proof_hash
- `programs/market/src/lib.rs` - Add solvency validation
- `tests/dual-proofs.ts` - Test both proof types

---

### Phase 3: Escrow Release & Security (Week 5)
**Goal**: Complete settlement flow with secure escrow release

**Tasks**:
1. [ ] Enhance `finalize_trade` in OrderProcessor
   ```rust
   pub fn finalize_trade(ctx, payment_proof) -> Result<()> {
       // 1. Validate proof (real Groth16)
       // 2. Update to PaymentConfirmed
       // 3. CPI to Market: release_escrowed_funds
       // 4. Update to Settled
   }
   ```
2. [ ] Implement permissioned CPI security
   - Market Program checks caller == ORDER_PROCESSOR_PROGRAM_ID
   - Reject unauthorized release attempts
3. [ ] Add replay attack prevention
   - Hash proof bytes
   - Store in MatchedOrder.proof_hash
   - Reject duplicate proofs
4. [ ] Add order expiration
   - Check `Clock::get()?.unix_timestamp > expires_at`
   - Implement `cancel_expired_order` instruction
   - Reclaim rent and return tokens
5. [ ] Add verification key storage
   - Create VerificationKey PDA
   - Store during initialization
   - Load during validation

**Deliverables**:
- Complete settlement flow with escrow release
- Security: Permissioned CPI, replay prevention, expiration
- Verification key on-chain

**Files to Modify**:
- `programs/order-processor/src/lib.rs` - Enhanced finalize_trade
- `programs/market/src/lib.rs` - Permissioned release_escrowed_funds
- `programs/order-store/src/lib.rs` - Expiration logic
- `tests/settlement.ts` - E2E settlement tests

---

### Phase 4: UI & Integration (Week 6)
**Goal**: Build user interface for P2P trading

**Tasks**:
1. [ ] Setup Next.js/React project
   ```bash
   npx create-next-app@latest anomi-ui --typescript
   cd anomi-ui
   npm install @solana/web3.js @solana/wallet-adapter-react @project-serum/anchor
   ```
2. [ ] Implement wallet connection (Phantom)
   - WalletProvider wrapper
   - Connect/disconnect button
3. [ ] Build order placement forms
   - Place Ask Order form (seller)
   - Place Bid Order form (buyer)
   - Input validation
4. [ ] Build order book display
   - Fetch all Order PDAs
   - Display asks and bids
   - Real-time updates
5. [ ] Build payment flow UI
   - Display matched order details
   - Show seller's payment method
   - 24-hour countdown timer
   - Generate proof button
   - Submit proof for settlement
6. [ ] Build order history view
   - Fetch user's MatchedOrders
   - Display status (Pending, PaymentConfirmed, Settled)
   - Transaction history

**Deliverables**:
- Working React UI
- Wallet integration
- Complete user flow (order → match → payment → settlement)

**Files to Create**:
- `ui/pages/index.tsx` - Landing page
- `ui/components/OrderBook.tsx` - Order book display
- `ui/components/PlaceOrder.tsx` - Order forms
- `ui/components/Settlement.tsx` - Payment flow
- `ui/utils/anchor.ts` - Anchor client setup

---

### Phase 5: Testing & Hardening (Week 7)
**Goal**: Production-ready testing and optimization

**Tasks**:
1. [ ] Write comprehensive tests
   - Happy path E2E test
   - Invalid proof rejection
   - Expired order cancellation
   - Replay attack prevention
   - Permissioned CPI violations
   - Edge cases (overflow, underflow)
2. [ ] Add fuzzing tests
   - Random order amounts/prices
   - Random proof generation
   - Boundary conditions
3. [ ] Profile compute units
   - Measure each instruction
   - Optimize hot paths
   - Target: <200k CU per settlement
4. [ ] Add event emission
   ```rust
   #[event]
   pub struct OrderMatched {
       pub order_id: u64,
       pub buyer: Pubkey,
       pub seller: Pubkey,
       pub amount: u64,
       pub price: u64,
       pub timestamp: i64,
   }
   ```
5. [ ] Security review
   - Authority checks
   - Arithmetic overflow protection
   - Account validation
   - Signer checks

**Deliverables**:
- Comprehensive test suite (20+ tests)
- Compute unit optimization
- Event emission for monitoring
- Security hardening

**Files to Create**:
- `tests/comprehensive.ts` - Full test suite
- `tests/fuzzing.rs` - Fuzzing tests
- `tests/security.ts` - Security-focused tests

---

## 🚀 Deployment Plan

### Localnet Testing (Ongoing)
```bash
# Terminal 1: Validator
anchor localnet

# Terminal 2: Tests
anchor test --skip-build --skip-local-validator
```

### Devnet Deployment (Week 8)
```bash
# Update Anchor.toml
[programs.devnet]
market = "<market-program-id>"
order_store = "<order-store-program-id>"
order_processor = "<order-processor-program-id>"

[provider]
cluster = "devnet"

# Deploy
solana airdrop 2 --url devnet
anchor build
anchor deploy --provider.cluster devnet

# Test on devnet
anchor test --provider.cluster devnet --skip-local-validator
```

### Mainnet Preparation (Week 9-12)
- [ ] External security audit (OtterSec, Neodyme)
- [ ] Bug bounty program
- [ ] Multisig upgrade authority
- [ ] Monitoring dashboard
- [ ] Incident response plan

---

## 📊 Success Metrics

### Phase 0.5: Escrow
- ✅ Tokens successfully deposited to escrow
- ✅ Only OrderProcessor can release tokens
- ✅ Tests pass: Escrow deposit/release

### Phase 1: ZK Circuit
- ✅ Circuit compiles without errors
- ✅ Proof generation <1 second
- ✅ Tests pass with real proofs: `2 passing`

### Phase 2A: Market
- ✅ Orders stored in PDAs
- ✅ Matching engine finds best price
- ✅ Payment metadata stored

### Phase 2B: Dual Proofs
- ✅ Solvency proof validates before bid
- ✅ Payment proof validates before settlement
- ✅ PaymentConfirmed status works

### Phase 3: Security
- ✅ Unauthorized release attempts fail
- ✅ Duplicate proofs rejected
- ✅ Expired orders can be cancelled

### Phase 4: UI
- ✅ Users can place orders via UI
- ✅ Order book displays correctly
- ✅ Complete settlement flow works

### Phase 5: Testing
- ✅ 20+ tests passing
- ✅ Compute units <200k
- ✅ No security vulnerabilities

---

## 🛠️ Development Workflow

### Daily Workflow
```bash
# Terminal 1: Keep validator running
cd anomi-zk-prototype
rm -rf .anchor/test-ledger
anchor localnet

# Terminal 2: Development
# Edit code...
anchor build
anchor test --skip-build --skip-local-validator

# Terminal 3: Monitor logs (optional)
solana logs
```

### After Each Phase
1. [ ] Run full test suite
2. [ ] Update README.md with progress
3. [ ] Commit changes with descriptive message
4. [ ] Update this file (check completed tasks)
5. [ ] Push to GitHub

---

## 📞 Next Immediate Actions

### Today (Day 1)
1. [ ] Review this implementation plan
2. [ ] Confirm Phase 0.5 approach (escrow foundation)
3. [ ] Setup development branch
   ```bash
   git checkout -b feature/token-escrow
   ```
4. [ ] Start Phase 0.5 Task 1: Add SPL Token dependency

### Tomorrow (Day 2)
1. [ ] Complete escrow vault PDA structure
2. [ ] Implement place_ask_order instruction
3. [ ] Write initial tests

---

## 🎯 Critical Path

**Phases that block others**:
- ✅ Phase 0.5 (Escrow) → Required for Phase 3 (Release)
- ✅ Phase 1 (ZK Circuit) → Required for Phase 2B (Dual Proofs)
- ✅ Phase 2A (Market) → Required for Phase 4 (UI)

**Can be parallelized**:
- Phase 1 (ZK Circuit) ∥ Phase 2A (Market)
- Phase 4 (UI) can start after Phase 2A completes

---

## 📝 Notes

### Key Decisions Made
1. **Two parallel tracks**: Keep prototype, build P2P separately
2. **Escrow first**: Foundation for secure settlement
3. **Dual ZK proofs**: Solvency + Payment validation
4. **Order PDAs**: More scalable than single OrderBook account
5. **Permissioned CPI**: Security-first approach

### Open Questions
- [ ] Which token to use for initial testing? (USDC-dev?)
- [ ] Order book capacity limits? (Max orders per market?)
- [ ] Fee structure? (Maker/taker fees?)
- [ ] Dispute resolution mechanism? (Future phase?)

### Risk Mitigation
- **Risk**: Circuit compilation fails
  - **Mitigation**: Test with simple circuit first, iterate
- **Risk**: Compute units exceed limit
  - **Mitigation**: Profile early, optimize hot paths
- **Risk**: Escrow security vulnerability
  - **Mitigation**: Extensive testing, external audit

---

## 🏁 Definition of Done

**Production-ready when**:
1. ✅ All 5 phases complete
2. ✅ 20+ tests passing (localnet + devnet)
3. ✅ External security audit passed
4. ✅ Compute units optimized (<200k CU)
5. ✅ UI fully functional
6. ✅ Documentation complete
7. ✅ Monitoring dashboard operational
8. ✅ Incident response plan documented

**Estimated Completion**: December 1, 2025 (6 weeks + 2 weeks buffer)

---

**Let's build! 🚀**