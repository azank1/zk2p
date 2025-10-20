[1mdiff --git a/workflow_ANOMI.md b/workflow_ANOMI.md[m
[1mindex d72505f..9a57112 100644[m
[1m--- a/workflow_ANOMI.md[m
[1m+++ b/workflow_ANOMI.md[m
[36m@@ -1,78 +1,606 @@[m
[31m-ANOMI Workflow (Microservices Architecture)[m
[31m-This document provides a comprehensive, state-to-state description of the ANOMI protocol's operation based on the final, multi-program architecture (Market, OrderStore, OrderProcessor). It details the complete wiring from initial offer to final, ZK-gated settlement.[m
[31m-Core Principles:[m
[31m-Separation of Concerns: Each on-chain program has one job. Market matches, OrderStore records, OrderProcessor settles.[m
[31m-Asynchronous Settlement: Matching is decoupled from settlement, allowing for the delay required for off-chain fiat payments.[m
[31m-Persistent State: Matched trades are saved to a persistent OrderStore PDA, not a transient event queue.[m
[31m-Initial System State[m
[31m-On-Chain Programs:[m
[31m-Market Program: Deployed. Its on-chain order book is empty.[m
[31m-OrderStore Program: Deployed. Its persistent PDA for the market is empty.[m
[31m-OrderProcessor Program: Deployed.[m
[31m-Seller (Ali): Has 100 USDC in a Phantom wallet.[m
[31m-Buyer (Farzan): Has PKR in an Easypaisa account and a Phantom wallet.[m
[31m-Phase 1: Order Placement & Escrow[m
[31m-State: IDLE[m
[31m-Seller's Goal: To place a public, asynchronous "ask" order and securely escrow the funds.[m
[31m-Action: Ali uses the ANOMI UI to call the place_ask_order instruction on the Market Program.[m
[31m-On-Chain Transaction (Market Program):[m
[31m-The instruction receives the order: Sell 100 USDC for 285 PKR.[m
[31m-It makes a CPI to the Solana Token Program.[m
[31m-It transfers 100 USDC from Ali's wallet into a secure Market Program escrow vault. This vault is controlled by the Market Program's own PDA authority.[m
[31m-It adds the new ask order to its internal, on-chain order book.[m
[31m-Resulting State: PENDING_MATCH[m
[31m-An active ask order for 100 USDC is live in the Market Program's order book.[m
[31m-The 100 USDC is held in custody by the Market Program.[m
[31m-The seller can go offline.[m
[31m-Phase 2: Automated Match & Persistent Event Creation[m
[31m-State: PENDING_MATCH[m
[31m-Buyer's Goal: To place a "bid" order and have the system find a match automatically.[m
[31m-Off-Chain Action:[m
[31m-Farzan generates his ZK Solvency Proof off-chain.[m
[31m-He uses the ANOMI UI to call the place_bid_order instruction on the Market Program, providing the proof and his bid details (Buy 100 USDC for 285 PKR).[m
[31m-On-Chain Transaction (Market Program):[m
[31m-ZK Proof Validation: The instruction first validates the buyer's ZK Solvency Proof. If invalid, the transaction fails.[m
[31m-Automated Match: The program's internal matching engine checks the order book and finds Ali's compatible ask order. A match is found![m
[31m-Event Creation: Instead of using Serum's EventQueue, the Market Program now constructs a persistent MatchedOrder struct containing the details: order_id, buyer, seller, amounts, a 24-hour expiry timestamp, and an initial status of Pending.[m
[31m-CPI to OrderStore: The Market Program makes a CPI to the OrderStore Program, calling its store_matched_order instruction and passing the new MatchedOrder struct.[m
[31m-The OrderStore Program saves this MatchedOrder to its persistent, on-chain PDA for the market.[m
[31m-The Market Program removes the filled orders from its own order book.[m
[31m-Resulting State: AWAITING_PAYMENT[m
[31m-A new, permanent MatchedOrder record exists in the OrderStore PDA with status: Pending. This is our persistent settlement queue.[m
[31m-The 100 USDC is still held in custody by the Market Program.[m
[31m-Phase 3: Off-Chain Fiat Transfer & Proof Generation[m
[31m-State: AWAITING_PAYMENT[m
[31m-Buyer's Goal: To pay the seller in the real world and generate a private proof of this action.[m
[31m-Off-Chain Action:[m
[31m-The ANOMI UI, having read the new MatchedOrder from the OrderStore, displays Ali's Easypaisa details to Farzan.[m
[31m-Farzan sends 28,500 PKR to Ali.[m
[31m-Farzan's client-side tools generate the ZK Payment Proof.[m
[31m-Resulting State (Conceptual): AWAITING_PROOF[m
[31m-The on-chain state has not changed. The system is waiting for the final on-chain settlement trigger.[m
[31m-Phase 4: ZK-Gated Settlement[m
[31m-State: AWAITING_PROOF[m
[31m-Buyer's Goal: To submit the payment proof, triggering the final, trustless release of the escrowed USDC.[m
[31m-Action: Farzan's UI calls the finalize_trade instruction on the OrderProcessor Program, providing the order_id and the ZK Payment Proof.[m
[31m-On-Chain Transaction (OrderProcessor Program):[m
[31m-ZK Proof Validation: The instruction validates the ZK Payment Proof. If invalid, it fails.[m
[31m-CPI to OrderStore (State Update 1): The OrderProcessor calls the OrderStore Program to update the MatchedOrder's status to PaymentConfirmed. This prevents race conditions.[m
[31m-Permissioned CPI to Market Program (Asset Release): The OrderProcessor now makes a secure CPI to the Market Program, calling a special release_escrowed_funds instruction.[m
[31m-The Market Program verifies that this CPI is coming from the trusted OrderProcessor Program.[m
[31m-If the call is authorized, the Market Program makes a final CPI to the Token Program, transferring the 100 USDC from its escrow vault to Farzan's wallet.[m
[31m-CPI to OrderStore (State Update 2): The OrderProcessor makes a final call to the OrderStore Program to update the MatchedOrder's status to Settled.[m
[31m-Resulting State: COMPLETED[m
[31m-Farzan's wallet now holds 100 USDC.[m
[31m-The Market Program's escrow vault for this trade is empty.[m
[31m-The MatchedOrder in the OrderStore is permanently marked as Settled, serving as the final, immutable receipt of the transaction.[m
[31m-The zk-p2p loop is complete.[m
[31m-[m
[31m-​The Verdict is Correct: We Are Building a Custom System[m
[31m-​Let's embrace the core finding:[m
[31m-​"You're building a completely separate system that happens to use similar terminology."[m
[31m-[m
[31m-​This is not a failure; it is a clarification. It frees us from trying to force our unique, P2P, fiat-to-crypto model into the architecture of a high-frequency, crypto-to-crypto exchange. Serum/OpenBook is a brilliant airplane; we are building a specialized submarine. We can learn from its engine design, but we cannot try to fly it underwater.[m
[31m-​Our Recommendation: We will adopt the recommendation from the analysis. We will build our system from scratch without direct Serum/OpenBook integration, but we will use its battle-tested, on-chain patterns as our reference guide.[m
[31m-​Redefining Our Relationship with OpenBook V2[m
[31m-​The analysis correctly identifies that our relationship with OpenBook is not one of integration, but of inspiration. It is a Reference Architecture, not a runtime dependency.[m
[31m-​Based on the analysis, here is the final, definitive breakdown of our relationship with the OpenBook V2 repository:[m
[32m+[m[32m# Ideal Low-Level Settlement Workflow in ZK2P[m
 [m
[32m+[m[32mThe ZK2P protocol implements an asynchronous, multi-program settlement architecture that separates order matching from settlement execution. Here's the detailed low-level workflow:[m
[32m+[m
[32m+[m[32m## Phase 1: Order Placement & Escrow (IDLE → PENDING_MATCH)[m
[32m+[m
[32m+[m[32m**Seller Action:** The seller calls `place_ask_order()` on the Market Program, which transfers tokens to the **Escrow Vault PDA**. [1-cite-0](#1-cite-0)[m[41m [m
[32m+[m
[32m+[m[32mThe Escrow Vault PDA is derived with seeds `["escrow_vault", token_mint]` and is controlled by a separate **Escrow Authority PDA** (seeds: `["escrow_authority", token_mint]`). This ensures no private key controls the escrowed tokens. [1-cite-1](#1-cite-1)[m[41m [m
[32m+[m
[32m+[m[32m## Phase 2: Matching & State Persistence (PENDING_MATCH → AWAITING_PAYMENT)[m
[32m+[m
[32m+[m[32m**Buyer