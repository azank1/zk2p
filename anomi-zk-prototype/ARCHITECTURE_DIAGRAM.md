# Phase 2B Architecture Diagram

## Complete Settlement Flow with PDA Locking

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                         PHASE 1: ORDER PLACEMENT                          ║
╚═══════════════════════════════════════════════════════════════════════════╝

    👩 Alice (Seller)                          📦 Market Program
         │                                            │
         │  place_ask_order(100 USDC @ $1.00)       │
         ├───────────────────────────────────────────>│
         │                                            │
         │         Transfer 100 USDC to Escrow       │
         │<───────────────────────────────────────────┤
         │                                            │
         │                                            ▼
         │                                    ┌───────────────┐
         │                                    │  Order Book   │
         │                                    │  PDA          │
         │                                    ├───────────────┤
         │                                    │ • Alice: 100  │
         │                                    │   @ $1.00     │
         │                                    │ • created_at  │
         │                                    └───────────────┘
         │                                            │
         │                                            ▼
         │                                    ┌───────────────┐
         │                                    │ Escrow Vault  │
         │                                    │ (SPL Token)   │
         │                                    ├───────────────┤
         │                                    │ 💰 100 USDC   │
         │                                    │ locked        │
         │                                    └───────────────┘


╔═══════════════════════════════════════════════════════════════════════════╗
║                    PHASE 2: MATCHING (1-to-1 Pairing)                     ║
╚═══════════════════════════════════════════════════════════════════════════╝

    👨 Bob (Buyer)                             📦 Market Program
         │                                            │
         │  create_bid(100 USDC @ $1.05)             │
         ├───────────────────────────────────────────>│
         │                                            │
         │                                            ▼
         │                                    ┌───────────────┐
         │                                    │ Price-Time    │
         │                                    │ Priority Sort │
         │                                    └───────┬───────┘
         │                                            │
         │                                    Find best match
         │                                    (Alice @ $1.00)
         │                                            │
         │                                            ▼
         │                              ╔═════════════════════════════╗
         │                              ║   CREATE MATCHED ORDER PDA   ║
         │                              ║   (THE SETTLEMENT LOCK)      ║
         │                              ╠═════════════════════════════╣
         │                              ║ Seeds: [buyer, seller, ts]  ║
         │                              ║                             ║
         │                              ║ • buyer: Bob                ║
         │                              ║ • seller: Alice             ║
         │                              ║ • amount: 100 USDC          ║
         │                              ║ • price: $1.00              ║
         │                              ║ • escrow_vault: <pubkey>    ║
         │                              ║ • token_mint: USDC          ║
         │                              ║ • status: PENDING 🟡        ║
         │                              ║ • deadline: now + 24hrs     ║
         │                              ║ • locked_by: None           ║
         │                              ╚═════════════════════════════╝
         │                                            │
         │        Match Created - Pay Alice!          │
         │<───────────────────────────────────────────┤
         │                                            │


╔═══════════════════════════════════════════════════════════════════════════╗
║              PHASE 3: OFF-CHAIN PAYMENT (Real World)                      ║
╚═══════════════════════════════════════════════════════════════════════════╝

    👨 Bob                                      👩 Alice
         │                                            │
         │    "Send me $100 via PayPal"              │
         │<───────────────────────────────────────────┤
         │                                            │
         │  💸 $100 USD via PayPal                   │
         ├───────────────────────────────────────────>│
         │                                            │
         │        "Payment received!"                 │
         │<───────────────────────────────────────────┤
         │                                            │
         ▼                                            │
    ┌──────────────┐                                 │
    │ Bob generates│                                 │
    │ ZK Proof:    │                                 │
    │ "I paid Alice│                                 │
    │  $100 PayPal"│                                 │
    └──────────────┘                                 │


╔═══════════════════════════════════════════════════════════════════════════╗
║        PHASE 4: SETTLEMENT (Atomic with PDA Locking)                      ║
╚═══════════════════════════════════════════════════════════════════════════╝

    👨 Bob                          🔒 OrderProcessor              📦 Market
         │                                 │                          │
         │  finalize_trade(               │                          │
         │    matched_order_pda,           │                          │
         │    zk_proof                     │                          │
         │  )                              │                          │
         ├─────────────────────────────────>│                          │
         │                                 │                          │
         │                                 ▼                          │
         │                          Check PDA Status                  │
         │                          (must be Pending)                 │
         │                                 │                          │
         │                                 ▼                          │
         │                          Check Deadline                    │
         │                          (< 24hrs elapsed)                 │
         │                                 │                          │
         │                                 ▼                          │
         │                      ╔═══════════════════════╗             │
         │                      ║   🔒 LOCK PDA         ║             │
         │                      ║   status = InProgress ║             │
         │                      ║   locked_by = Bob     ║             │
         │                      ╚═══════════════════════╝             │
         │                                 │                          │
         │                                 │ PDA Locked!              │
         │                                 │ (prevents re-entrancy)   │
         │                                 │                          │
         │                                 ▼                          │
         │                          Validate ZK Proof                 │
         │                          (groth16_verify)                  │
         │                                 │                          │
         │                                 │ ✅ Proof Valid           │
         │                                 │                          │
         │                                 ▼                          │
         │                          CPI: release_escrowed_funds()     │
         │                                 ├─────────────────────────>│
         │                                 │                          │
         │                                 │                          ▼
         │                                 │                   Verify Caller
         │                                 │                   (only OrderProc)
         │                                 │                          │
         │                                 │                          ▼
         │                                 │                   Verify PDA Status
         │                                 │                   (must be InProgress)
         │                                 │                          │
         │                                 │                          ▼
         │                                 │                   Verify Vault
         │                                 │                   (matches PDA)
         │                                 │                          │
         │                                 │                          ▼
         │                                 │            ┌─────────────────────┐
         │                                 │            │  Escrow Vault       │
         │                                 │            │  Sign with PDA Auth │
         │                                 │            └──────────┬──────────┘
         │                                 │                       │
         │  💰 100 USDC Received!          │          Transfer     │
         │<────────────────────────────────┼───────────────────────┘
         │                                 │                          │
         │                                 ▼                          │
         │                      ╔═══════════════════════╗             │
         │                      ║   ✅ FINALIZE PDA     ║             │
         │                      ║   status = Settled    ║             │
         │                      ║   settled_at = now    ║             │
         │                      ╚═══════════════════════╝             │
         │                                 │                          │
         │        Settlement Complete!     │                          │
         │<────────────────────────────────┤                          │
         │                                 │                          │


╔═══════════════════════════════════════════════════════════════════════════╗
║                            FINAL STATE                                    ║
╚═══════════════════════════════════════════════════════════════════════════╝

    👨 Bob                                           👩 Alice
    ✅ Has 100 USDC                                  ✅ Has $100 USD
    (on-chain tokens)                                (off-chain fiat)

    ╔═══════════════════════════════════╗
    ║   MatchedOrder PDA (Immutable)    ║
    ╠═══════════════════════════════════╣
    ║ • status: SETTLED ✅              ║
    ║ • settled_at: 1729471234          ║
    ║ • Cannot be replayed              ║
    ║ • Permanent on-chain record       ║
    ╚═══════════════════════════════════╝


╔═══════════════════════════════════════════════════════════════════════════╗
║                       SECURITY GUARANTEES                                 ║
╚═══════════════════════════════════════════════════════════════════════════╝

    1. 🔒 NO DOUBLE-SPENDING
       ▸ PDA locks to InProgress before any transfers
       ▸ Once Settled, cannot process again

    2. 🛡️ NO RE-ENTRANCY
       ▸ locked_by field prevents concurrent settlement
       ▸ Status checked at every step

    3. 💰 NO FUND LOSS
       ▸ Escrow vault linked in PDA
       ▸ Deadline enforcement (24hr)
       ▸ Auto-refund if expired

    4. ⚛️ ATOMIC SETTLEMENT
       ▸ Either: (proof valid → escrow released → PDA settled)
       ▸ Or: (proof invalid → everything reverted)

    5. 🔐 ACCESS CONTROL
       ▸ Only OrderProcessor can release escrow
       ▸ Only correct buyer receives tokens
       ▸ PDA seeds enforce 1-to-1 pairing


╔═══════════════════════════════════════════════════════════════════════════╗
║                    ALTERNATIVE: EXPIRED SETTLEMENT                        ║
╚═══════════════════════════════════════════════════════════════════════════╝

    If Bob never submits proof within 24hrs:

    👩 Alice                            📦 Market Program
         │                                     │
         │  refund_expired_order()             │
         ├─────────────────────────────────────>│
         │                                     │
         │                                     ▼
         │                              Check Deadline
         │                              (> 24hrs passed)
         │                                     │
         │                                     ▼
         │                              Check Status
         │                              (still Pending)
         │                                     │
         │                                     ▼
         │                     Update: status = Expired
         │                                     │
         │                                     ▼
         │                     Transfer 100 USDC back to Alice
         │  💰 Refund Received                 │
         │<────────────────────────────────────┤
         │                                     │

    Result: Alice gets her tokens back (no loss)
```

## Key Insight: The PDA IS the Settlement Lock

The `MatchedOrder` PDA serves as:
- 🔒 **Lock**: Prevents double-settlement via status field
- 🔗 **Bridge**: Links matching → escrow → settlement
- 🧾 **Receipt**: Permanent on-chain proof of trade
- ⏰ **Timer**: Enforces settlement deadline
- 🛡️ **Guard**: Only authorized programs can modify

This design ensures **1 buyer → 1 seller → 1 settlement** with no room for exploits.
