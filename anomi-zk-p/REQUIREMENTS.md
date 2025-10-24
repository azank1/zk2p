# ZK2P Development Requirements

## System Requirements

**Operating System:**
- Linux (Ubuntu 20.04+)
- macOS (10.15+)
- Windows 10/11 with WSL2 (recommended for Solana development)

**Hardware:**
- CPU: 4+ cores
- RAM: 8GB minimum, 16GB recommended
- Disk: 20GB free space

---

## Required Software

### Core Tools

| Tool | Version | Purpose |
|------|---------|---------|
| **Git** | Latest | Version control |
| **Node.js** | v18+ | JavaScript runtime |
| **Yarn** | v1.22+ | Package manager |
| **Rust** | v1.70+ | Rust compiler |
| **Solana CLI** | v1.17+ | Solana tooling |
| **Anchor CLI** | v0.29.0 | Anchor framework |
| **Python** | v3.8+ | Demo UI server |

---

## Installation Links

### Direct Downloads

- **Git:** https://git-scm.com/downloads
- **Node.js:** https://nodejs.org/ (LTS version)
- **Rust:** https://rustup.rs/
- **Python:** https://www.python.org/downloads/
- **Solana:** https://docs.solana.com/cli/install-solana-cli-tools

### Package Managers

**Rust (via rustup):**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Solana CLI:**
```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
```

**Anchor CLI:**
```bash
cargo install --git https://github.com/coral-xyz/anchor --tag v0.29.0 anchor-cli --locked
```

**Yarn:**
```bash
npm install -g yarn
```

---

## Quick Setup Script

### For Linux/WSL

```bash
#!/bin/bash
# Install all dependencies

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Solana
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Node.js (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Yarn
npm install -g yarn

# Anchor
cargo install --git https://github.com/coral-xyz/anchor --tag v0.29.0 anchor-cli --locked

echo "Setup complete! Run: cd anomi-zk-prototype && anchor build"
```

### Verification

Run dependency checker:
```powershell
cd anomi-zk-prototype
.\scripts\check-dependencies.ps1
```

---

## Development Dependencies (Auto-Installed)

These are installed via `yarn install`:

- @coral-xyz/anchor
- @solana/web3.js
- @solana/spl-token
- chai (testing)
- mocha (testing)
- ts-node (TypeScript execution)
- typescript

**See:** `package.json` for complete list

---

## Optional Tools

**Recommended:**
- **VS Code** - Code editor with Rust/Solana extensions
- **Phantom Wallet** - Browser extension for testing
- **Solflare** - Alternative wallet

**VS Code Extensions:**
- rust-analyzer
- Solana Explorer
- Anchor Language Support

---

## Minimum Setup for MVP

**To just run tests:**
- Rust + Cargo
- Anchor CLI
- Node.js + Yarn

**To deploy to devnet:**
- All of above +
- Solana CLI
- Devnet SOL (free via airdrop)

**To run UI:**
- Python 3
- Web browser

---

## Troubleshooting

**Issue:** Solana not in PATH (Windows)

**Fix:**
1. Find Solana installation: `C:\Users\<User>\.local\share\solana\install\active_release\bin`
2. Add to PATH via System Environment Variables
3. Restart terminal

**Issue:** Anchor build fails

**Fix:**
```bash
# Update Rust
rustup update stable

# Clean and rebuild
anchor clean
anchor build
```

**Issue:** Tests fail

**Fix:**
```bash
# Ensure programs built
anchor build

# Run with fresh validator
anchor test
```

---

**Next:** See SETUP_GUIDE.md for detailed installation instructions

