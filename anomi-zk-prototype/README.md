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
