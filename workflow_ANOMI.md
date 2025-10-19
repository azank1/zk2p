ANOMI Workflow (Microservices Architecture)
This document provides a comprehensive, state-to-state description of the ANOMI protocol's operation based on the final, multi-program architecture (Market, OrderStore, OrderProcessor). It details the complete wiring from initial offer to final, ZK-gated settlement.
Core Principles:
Separation of Concerns: Each on-chain program has one job. Market matches, OrderStore records, OrderProcessor settles.
Asynchronous Settlement: Matching is decoupled from settlement, allowing for the delay required for off-chain fiat payments.
Persistent State: Matched trades are saved to a persistent OrderStore PDA, not a transient event queue.
Initial System State
On-Chain Programs:
Market Program: Deployed. Its on-chain order book is empty.
OrderStore Program: Deployed. Its persistent PDA for the market is empty.
OrderProcessor Program: Deployed.
Seller (Ali): Has 100 USDC in a Phantom wallet.
Buyer (Farzan): Has PKR in an Easypaisa account and a Phantom wallet.
Phase 1: Order Placement & Escrow
State: IDLE
Seller's Goal: To place a public, asynchronous "ask" order and securely escrow the funds.
Action: Ali uses the ANOMI UI to call the place_ask_order instruction on the Market Program.
On-Chain Transaction (Market Program):
The instruction receives the order: Sell 100 USDC for 285 PKR.
It makes a CPI to the Solana Token Program.
It transfers 100 USDC from Ali's wallet into a secure Market Program escrow vault. This vault is controlled by the Market Program's own PDA authority.
It adds the new ask order to its internal, on-chain order book.
Resulting State: PENDING_MATCH
An active ask order for 100 USDC is live in the Market Program's order book.
The 100 USDC is held in custody by the Market Program.
The seller can go offline.
Phase 2: Automated Match & Persistent Event Creation
State: PENDING_MATCH
Buyer's Goal: To place a "bid" order and have the system find a match automatically.
Off-Chain Action:
Farzan generates his ZK Solvency Proof off-chain.
He uses the ANOMI UI to call the place_bid_order instruction on the Market Program, providing the proof and his bid details (Buy 100 USDC for 285 PKR).
On-Chain Transaction (Market Program):
ZK Proof Validation: The instruction first validates the buyer's ZK Solvency Proof. If invalid, the transaction fails.
Automated Match: The program's internal matching engine checks the order book and finds Ali's compatible ask order. A match is found!
Event Creation: Instead of using Serum's EventQueue, the Market Program now constructs a persistent MatchedOrder struct containing the details: order_id, buyer, seller, amounts, a 24-hour expiry timestamp, and an initial status of Pending.
CPI to OrderStore: The Market Program makes a CPI to the OrderStore Program, calling its store_matched_order instruction and passing the new MatchedOrder struct.
The OrderStore Program saves this MatchedOrder to its persistent, on-chain PDA for the market.
The Market Program removes the filled orders from its own order book.
Resulting State: AWAITING_PAYMENT
A new, permanent MatchedOrder record exists in the OrderStore PDA with status: Pending. This is our persistent settlement queue.
The 100 USDC is still held in custody by the Market Program.
Phase 3: Off-Chain Fiat Transfer & Proof Generation
State: AWAITING_PAYMENT
Buyer's Goal: To pay the seller in the real world and generate a private proof of this action.
Off-Chain Action:
The ANOMI UI, having read the new MatchedOrder from the OrderStore, displays Ali's Easypaisa details to Farzan.
Farzan sends 28,500 PKR to Ali.
Farzan's client-side tools generate the ZK Payment Proof.
Resulting State (Conceptual): AWAITING_PROOF
The on-chain state has not changed. The system is waiting for the final on-chain settlement trigger.
Phase 4: ZK-Gated Settlement
State: AWAITING_PROOF
Buyer's Goal: To submit the payment proof, triggering the final, trustless release of the escrowed USDC.
Action: Farzan's UI calls the finalize_trade instruction on the OrderProcessor Program, providing the order_id and the ZK Payment Proof.
On-Chain Transaction (OrderProcessor Program):
ZK Proof Validation: The instruction validates the ZK Payment Proof. If invalid, it fails.
CPI to OrderStore (State Update 1): The OrderProcessor calls the OrderStore Program to update the MatchedOrder's status to PaymentConfirmed. This prevents race conditions.
Permissioned CPI to Market Program (Asset Release): The OrderProcessor now makes a secure CPI to the Market Program, calling a special release_escrowed_funds instruction.
The Market Program verifies that this CPI is coming from the trusted OrderProcessor Program.
If the call is authorized, the Market Program makes a final CPI to the Token Program, transferring the 100 USDC from its escrow vault to Farzan's wallet.
CPI to OrderStore (State Update 2): The OrderProcessor makes a final call to the OrderStore Program to update the MatchedOrder's status to Settled.
Resulting State: COMPLETED
Farzan's wallet now holds 100 USDC.
The Market Program's escrow vault for this trade is empty.
The MatchedOrder in the OrderStore is permanently marked as Settled, serving as the final, immutable receipt of the transaction.
The zk-p2p loop is complete.

​The Verdict is Correct: We Are Building a Custom System
​Let's embrace the core finding:
​"You're building a completely separate system that happens to use similar terminology."

​This is not a failure; it is a clarification. It frees us from trying to force our unique, P2P, fiat-to-crypto model into the architecture of a high-frequency, crypto-to-crypto exchange. Serum/OpenBook is a brilliant airplane; we are building a specialized submarine. We can learn from its engine design, but we cannot try to fly it underwater.
​Our Recommendation: We will adopt the recommendation from the analysis. We will build our system from scratch without direct Serum/OpenBook integration, but we will use its battle-tested, on-chain patterns as our reference guide.
​Redefining Our Relationship with OpenBook V2
​The analysis correctly identifies that our relationship with OpenBook is not one of integration, but of inspiration. It is a Reference Architecture, not a runtime dependency.
​Based on the analysis, here is the final, definitive breakdown of our relationship with the OpenBook V2 repository:

