# Start the Demo UI Server

## Option 1: Windows Batch File (Easiest)

**Double-click:** `start-server.bat`

Or from PowerShell:
```powershell
cd D:\dev\zk2p\anomi-zk-prototype\demo-ui
.\start-server.bat
```

Then open: **http://127.0.0.1:8080**

## Option 2: PowerShell Script

```powershell
cd D:\dev\zk2p\anomi-zk-prototype\demo-ui
.\start-server.ps1
```

Then open: **http://127.0.0.1:8080**

## Option 3: Manual Python Command (Windows)

```powershell
cd D:\dev\zk2p\anomi-zk-prototype\demo-ui
python -m http.server 8080
```

Then open: **http://localhost:8080**

## Option 4: WSL (Linux)

```bash
cd /mnt/d/dev/zk2p/anomi-zk-prototype/demo-ui
python3 -m http.server 8080
```

Then open: **http://localhost:8080**

## Quick Test

Once the server starts, you should see:
```
Serving HTTP on 0.0.0.0 port 8080 (http://0.0.0.0:8080/) ...
```

Then open your browser to the URL and you'll see the 2k2Peer DEX interface!

## What You'll See

1. **Purple "Connect Phantom Wallet" button** at the top
2. Order entry form
3. "Place Ask" and "Place Bid" buttons
4. Order book panel  
5. CritBit tree visualization
6. Transaction logs

Click the purple button to connect your Phantom wallet!

