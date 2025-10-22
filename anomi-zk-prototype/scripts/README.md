Analyze PDA OUTPUT:

DA Analysis for Market Program (Phase 2A)
============================================================

Analyzing PDAs (offline mode - no cluster connection needed)...

Program ID: 7eAHPRbhqzsqpC1Wuw2Y8AqRGGqGcEGAXAGmfsovfLae
(Using offline PDA derivation - no wallet needed)


Example Token Mint (USDC)
-------------------------
Mint Address: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v


PDA #1: Escrow Vault
--------------------
Purpose: Token custody account that holds escrowed tokens
Type: SPL Token Account

  Seeds:
    ["escrow_vault", token_mint.as_ref()]

  Derivation (TypeScript):
    const [escrowVault, vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_vault"), tokenMint.toBuffer()],
      program.programId
    );

Derived Address: EjYY8wx4u69H11k5Mb6yz2WnaAKutQsKCecjNxjirTNA
Canonical Bump: 254
Is On Curve: Yes (invalid!)

Why this PDA?
  • Deterministic: Same token mint always derives same vault address
  • No private key: Cannot be compromised
  • Program-controlled: Only Market program can transfer from it


PDA #2: Escrow Authority
------------------------
Purpose: Authority that can sign transfers from escrow vault
Type: System Account (just an address)

  Seeds:
    ["escrow_authority", token_mint.as_ref()]

  Derivation (TypeScript):
    const [escrowAuthority, authBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_authority"), tokenMint.toBuffer()],
      program.programId
    );

Derived Address: 77sxcsM5UfkQxDCsHFxhBNrZFdBTRyXXf4KkSAEXy7RN
Canonical Bump: 254
Is On Curve: Yes (invalid!)

Why this PDA?
  • Authority of escrow vault token account
  • Program can sign as this PDA using invoke_signed
  • Enables program to transfer tokens without private key

Signing Pattern (Rust):
  let seeds = &[
      b"escrow_authority",
      token_mint.as_ref(),
      &[254], // Canonical bump
  ];
  let signer_seeds = &[&seeds[..]];

  token::transfer(
      CpiContext::new_with_signer(
          token_program,
          Transfer { ... },
          signer_seeds, // Program signs as PDA
      ),
      amount,
  )?;


PDA #3: Order Book
------------------
Purpose: Stores Vec<AskOrder> order book data
Type: Anchor Account (Market program owns)

  Seeds:
    ["order_book", token_mint.as_ref()]

  Derivation (TypeScript):
    const [orderBook, bookBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("order_book"), tokenMint.toBuffer()],
      program.programId
    );

Derived Address: 5Wh8wSv57LcPmW8i7tXDwKyVeZdNBSf3Dh96Ymeebryc
Canonical Bump: 255
Is On Curve: Yes (invalid!)

Account Structure:
  struct OrderBook {
      token_mint: Pubkey,     // 32 bytes
      orders: Vec<AskOrder>,  // Variable size
      last_order_id: u64,     // 8 bytes
  }

  Size Calculation:
    Discriminator:        8 bytes
    token_mint:          32 bytes
    Vec length:           4 bytes
    Orders (10 max):  1,920 bytes (192 * 10)
    last_order_id:        8 bytes
    --------------------------------
    Total:           ~1,972 bytes

Why this PDA?
  • One order book per token mint
  • Deterministic address (no need to store it)
  • Program owns account, controls all mutations


Key Property: Deterministic Derivation
--------------------------------------

If you use the SAME token mint, you get the SAME PDAs:

First derivation:
  Vault: EjYY8wx4u69H11k5Mb6y...
  Authority: 77sxcsM5UfkQxDCsHFxh...
  Book: 5Wh8wSv57LcPmW8i7tXD...

Second derivation (same seeds):
  Vault: EjYY8wx4u69H11k5Mb6y...
  Authority: 77sxcsM5UfkQxDCsHFxh...
  Book: 5Wh8wSv57LcPmW8i7tXD...

✓ Addresses match! This is the power of PDAs.


Different Token Mint → Different PDAs
-------------------------------------

Original mint (USDC):
  Mint: EPjFWdd5AufqSSqeM2qN...
  Vault: EjYY8wx4u69H11k5Mb6y...

Different mint (SOL):
  Mint: So111111111111111111...
  Vault: ASYGhyRrsgfKpPYkfNGK...

✓ Different addresses! Each token has isolated escrow.


Summary: PDA Relationships
--------------------------

Visual Diagram:

  ┌───────────────────────────────────────────────┐
  │        For Token Mint: EPjFWdd5...        │
  └───────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
  ┌─────────┐  ┌──────────┐  ┌──────────┐
  │ Escrow  │  │ Escrow   │  │  Order   │
  │  Vault  │  │Authority │  │   Book   │
  │   PDA   │  │   PDA    │  │   PDA    │
  └─────────┘  └──────────┘  └──────────┘
       │            │              │
       │ Token      │ Is           │ Stores
       │ Account    │ Authority    │ Vec<Order>
       │            │ Of           │
       │            │              │
       └────────────┴──────────────┘
                    │
            All derived from
            same token_mint seed


Key Takeaways:
  1. PDAs are deterministic (no randomness)
  2. PDAs have no private key (cannot be compromised)
  3. PDAs enable program-controlled accounts
  4. Each token mint gets isolated PDAs
  5. Escrow Authority signs transfers using invoke_signed


CLI Commands to Inspect PDAs
----------------------------

If these accounts exist on-chain:

  # Inspect escrow vault (SPL Token Account)
  solana account EjYY8wx4u69H11k5Mb6yz2WnaAKutQsKCecjNxjirTNA

  # Inspect order book (Anchor Account)
  solana account 5Wh8wSv57LcPmW8i7tXDwKyVeZdNBSf3Dh96Ymeebryc

  # Get token account info (if initialized)
  spl-token account-info EjYY8wx4u69H11k5Mb6yz2WnaAKutQsKCecjNxjirTNA

  # Decode account data (hexdump)
  solana account 5Wh8wSv57LcPmW8i7tXDwKyVeZdNBSf3Dh96Ymeebryc --output json | jq -r .account.data[0] | base64 -d | xxd

✓ PDA analysis complete!
