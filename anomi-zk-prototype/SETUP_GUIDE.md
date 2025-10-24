# ZK2P Setup Guide

Complete setup guide for developers to get ZK2P running.

---

## Prerequisites

### Required Software

1. **Git** - Version control
2. **Node.js** (v18+) - JavaScript runtime
3. **Rust** (v1.70+) - Rust programming language
4. **Solana CLI** (v1.17+) - Solana command-line tools
5. **Anchor CLI** (v0.29.0) - Anchor framework
6. **Python** (v3.8+) - For demo UI server

---

## Installation Instructions

### Windows Installation

**Step 1: Install Rust**
```powershell
# Download and run rustup installer
Invoke-WebRequest -Uri https://win.rustup.rs/x86_64 -OutFile rustup-init.exe
.\rustup-init.exe
# Follow prompts, restart terminal after installation
```

**Step 2: Install Node.js**
- Download from: https://nodejs.org/
- Run installer
- Restart terminal

**Step 3: Install Solana CLI**

**Option A: Via WSL (Recommended)**
```bash
# In WSL terminal
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

**Option B: Windows Native**
- Download from: https://docs.solana.com/cli/install-solana-cli-tools
- Add to PATH: `C:\Users\<YourName>\.local\share\solana\install\active_release\bin`
- Restart PowerShell

**Step 4: Install Anchor**
```bash
# After Rust is installed
cargo install --git https://github.com/coral-xyz/anchor --tag v0.29.0 anchor-cli --locked
```

**Step 5: Install Yarn**
```powershell
npm install -g yarn
```

### Linux/WSL Installation

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Install Node.js (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Install Yarn
npm install -g yarn

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor --tag v0.29.0 anchor-cli --locked
```

---

## Verify Installation

Run these commands to verify everything is installed:

```bash
# Check versions
git --version          # Should show git version
node --version         # Should show v18.x.x or higher
npm --version          # Should show version
yarn --version         # Should show version
cargo --version        # Should show version
rustc --version        # Should show version
solana --version       # Should show solana-cli version
anchor --version       # Should show anchor-cli version
python --version       # Should show Python 3.x
```

**All commands should return version numbers.** If any fail, that tool is not installed or not in PATH.

---

## Project Setup

### Clone and Build

```bash
# Clone repository
git clone https://github.com/azank1/zk2p.git
cd zk2p/anomi-zk-prototype

# Install Node dependencies
yarn install

# Build Anchor programs
anchor build

# Run tests
anchor test
```

**Expected:** All tests pass

---

## Configure Solana

### Set Network

```bash
# For local testing
solana config set --url localhost

# For devnet deployment
solana config set --url devnet

# Check current config
solana config get
```

### Create Wallet (If Needed)

```bash
# Generate new wallet
solana-keygen new --outfile ~/.config/solana/id.json

# View public key
solana address

# Airdrop SOL (devnet only)
solana airdrop 2
```

---

## Common Issues

### Issue: "solana: command not found"

**Solution:** Add Solana to PATH

**Linux/WSL:**
```bash
echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**Windows:**
1. Search "Environment Variables" in Windows
2. Edit PATH variable
3. Add: `C:\Users\<YourName>\.local\share\solana\install\active_release\bin`
4. Restart PowerShell

### Issue: "anchor: command not found"

**Solution:** Reinstall Anchor

```bash
cargo install --git https://github.com/coral-xyz/anchor --tag v0.29.0 anchor-cli --locked --force
```

### Issue: "anchor build" fails

**Solution:** Check Rust toolchain

```bash
# Update Rust
rustup update

# Check toolchain
rustup show

# Should show stable or nightly
```

### Issue: WSL recommended over Windows

**Why:** Solana tooling works better on Linux

**Install WSL:**
```powershell
# In PowerShell (as Administrator)
wsl --install
# Restart computer
# Then follow Linux installation steps in WSL
```

---

## Quick Start After Setup

```bash
cd anomi-zk-prototype

# Build
anchor build

# Test locally
anchor test

# Deploy to devnet (after tools installed)
.\scripts\deploy-devnet.ps1    # Windows
./scripts/deploy-devnet.sh     # Linux/WSL
```

---

## For Developers

### Development Workflow

```bash
# 1. Make code changes
# 2. Build
anchor build

# 3. Test
anchor test

# 4. Deploy (when ready)
anchor deploy --provider.cluster devnet
```

### Test UI

```bash
cd demo-ui
python -m http.server 8080 --bind 127.0.0.1
# Open http://127.0.0.1:8080
```

---

## Next Steps

After installation complete:

1. **Verify tools:** Run version commands above
2. **Build project:** `anchor build`
3. **Run tests:** `anchor test`  
4. **Test UI:** Start demo server
5. **Deploy:** Follow DEVNET_DEPLOYMENT_GUIDE.md

---

**For deployment instructions, see:** `DEVNET_DEPLOYMENT_GUIDE.md`

**For testing instructions, see:** `docs/TESTING.md`

