# Demo UI Testing Guide

Quick guide to test the CritBit visualization after cleanup.

---

## Start the Server

**Windows (Easiest):**
1. Open File Explorer
2. Navigate to `anomi-zk-prototype\demo-ui`
3. Double-click `start-server.bat`
4. A command window will open showing the server running

**Or use PowerShell:**
```powershell
cd d:\dev\zk2p\anomi-zk-prototype\demo-ui
.\start-server.ps1
```

**Server will display:**
```
Starting ZK2P Demo UI Server...
Server directory: D:\dev\zk2p\anomi-zk-prototype\demo-ui
Starting HTTP server on http://127.0.0.1:8080

Open your browser to: http://127.0.0.1:8080
```

---

## Open the UI

1. Open your web browser (Chrome, Firefox, Edge)
2. Go to: **http://127.0.0.1:8080**
3. You should see the 2k2Peer DEX Interface

**Expected:** Dark themed UI with multiple panels visible

---

## Test Scenario 1: Basic Order Placement

### Place First Ask Order

1. Find "Order Entry" panel (left side)
2. Fill in:
   - Trader: `Alice`
   - Amount: `100`
   - Price: `50`
   - Payment Method: `Bank Transfer`
3. Click "Place Ask Order"

**Expected Results:**
- Transaction log shows "Ask order placed"
- Order Book shows order: 100 @ 50
- CritBit Graph shows single node
- Statistics updated

---

## Test Scenario 2: Multiple Price Levels

### Place Additional Orders

**Order 2:**
- Trader: `Bob`
- Amount: `50`
- Price: `45`
- Click "Place Ask Order"

**Order 3:**
- Trader: `Charlie`
- Amount: `75`
- Price: `52`
- Click "Place Ask Order"

**Expected Results:**
- Order Book shows 3 orders sorted by price
- CritBit Graph shows tree structure with multiple nodes
- Tree View shows hierarchical structure
- Each order visible in order list

---

## Test Scenario 3: Order Matching

### Place a Bid Order

1. In Order Entry, fill:
   - Trader: `Buyer1`
   - Amount: `60`
   - Price: `55`
2. Click "Place Bid Order"

**Expected Results:**
- Transaction log shows matching
- Some ask orders matched (Bob's at 45, part of Alice's at 50)
- CritBit tree updates
- Statistics show matched orders

---

## Test Scenario 4: Tree Operations

### Observe CritBit Visualization

**Check these panels:**

1. **CritBit Graph (SVG)**
   - Shows tree structure
   - Nodes connected with edges
   - Green (root), Purple (internal), Blue (leaf) colors

2. **Tree Structure**
   - Hierarchical view
   - Shows price levels
   - Expandable nodes

3. **Order Book**
   - All asks listed
   - Sorted by price
   - Shows quantity at each price

4. **Transaction Log**
   - All operations logged
   - Insert, match, remove events
   - Timestamps shown

---

## Test Scenario 5: Clear and Reset

1. Click "Clear All" button
2. Verify all orders removed
3. CritBit tree resets to empty
4. Order book clears

---

## Verification Checklist

After running all scenarios:

- [ ] Page loads without errors
- [ ] Can place ask orders
- [ ] Can place bid orders
- [ ] CritBit tree visualizes correctly
- [ ] Order book displays orders
- [ ] Matching logic works
- [ ] Transaction log shows events
- [ ] Tree animations appear
- [ ] Statistics update
- [ ] No console errors (F12 to check)

---

## Troubleshooting

### Issue: Page shows "Index of /"

**Solution:** You're seeing the directory listing. 
- Make sure you opened `http://127.0.0.1:8080` not `http://127.0.0.1:8080/` with trailing slash
- Or directly go to `http://127.0.0.1:8080/index.html`

### Issue: Cannot connect / Refused to connect

**Solution:** Server isn't running.
1. Check the command window is still open
2. Make sure Python is installed: `python --version`
3. Restart the server using `start-server.bat`

### Issue: Port already in use

**Solution:** Another program is using port 8080.
1. Stop any other Python servers
2. Or change port: `python -m http.server 8081 --bind 127.0.0.1`
3. Access at `http://127.0.0.1:8081`

### Issue: 404 Error

**Solution:** Server started in wrong directory.
1. Make sure you're in `demo-ui` folder
2. Check `index.html` exists: `dir index.html`
3. Restart server from correct location

---

## Expected Output

### Console (F12 Developer Tools)

**Should NOT see:**
- Red error messages
- Failed to load resources
- JavaScript errors

**May see:**
- Info messages about operations
- Debug logs (green/blue text)

### Performance

- Page load: < 2 seconds
- Order placement: Instant
- Tree updates: Smooth animations
- No lag or freezing

---

## Success Criteria

✓ UI loads successfully
✓ Can place orders
✓ CritBit tree visualizes
✓ Matching works
✓ No errors in console
✓ All panels functional

**If all checkmarks pass: UI IS WORKING!**

---

## Next Steps After Verification

Once UI is working:
1. Confirm: "UI tested and working"
2. Ready for Phase 3A: Phantom wallet integration
3. Will replace this simulation with blockchain calls

---

## Need Help?

If you encounter issues:
1. Check browser console (F12) for errors
2. Verify Python is installed
3. Confirm you're in correct directory
4. Try different browser
5. Check POST_CLEANUP_VERIFICATION.md for more details

