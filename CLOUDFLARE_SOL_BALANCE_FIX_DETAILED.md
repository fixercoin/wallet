# SOL Balance Returns 0 on Cloudflare - Root Cause & Fix

## Problem Summary
- ✅ **Dev Server**: SOL balance shows correctly (0.002256)
- ❌ **Cloudflare Deployment**: SOL balance returns 0.00
- Other tokens show correct balances on both environments

## Root Causes Identified

### 1. Invalid/Hardcoded Helius API Key
**File**: `wrangler.toml`
**Issue**: The Helius API key was hardcoded in the config:
```toml
HELIUS_API_KEY = "ff9e8f9e-ec7f-463e-9d7f-46ab0bffbfb3"
```
This key was either invalid, expired, or from another project.

### 2. Incomplete RPC Fallback Chain
**File**: `functions/api/wallet-balance.ts`
**Issue**: The Cloudflare endpoint didn't properly support:
- HELIUS_API_KEY environment variable
- HELIUS_RPC_URL environment variable
- Proper fallback sequencing

It only checked SOLANA_RPC_URL, ALCHEMY_RPC_URL, MORALIS_RPC_URL before falling back to public endpoints.

### 3. Poor Error Logging in Cloudflare
The endpoint returned generic errors without details about which RPC endpoint failed or why.

## Changes Made

### 1. ✅ Removed Hardcoded API Key from wrangler.toml
```diff
- HELIUS_API_KEY = "ff9e8f9e-ec7f-463e-9d7f-46ab0bffbfb3"
+ # HELIUS_API_KEY must be configured in Cloudflare Pages project settings
```

**Instructions**: Set in Cloudflare Pages UI:
1. Go to your project in Cloudflare Pages
2. Project Settings > Environment variables > Production
3. Add `HELIUS_API_KEY` with your valid API key from https://www.helius.dev

### 2. ✅ Enhanced Cloudflare wallet-balance Endpoint
**File**: `functions/api/wallet-balance.ts`

**Changes**:
- Added HELIUS_API_KEY support with proper URL construction
- Added HELIUS_RPC_URL support
- Improved RPC endpoint priority order:
  1. Helius with API key (fastest, most reliable)
  2. Helius RPC URL
  3. Custom Solana RPC
  4. Alchemy RPC
  5. Moralis RPC
  6. Free public endpoints (solana.publicnode.com, api.solflare.com, etc.)
- Added comprehensive logging to identify which endpoint succeeds/fails
- Improved error messages with endpoint details

### 3. ✅ Improved Dev Server Route (server/routes/wallet-balance.ts)
- Updated error messages to be clearer
- Added better logging for debugging
- Now logs which RPC endpoint was used
- Returns `source` field in response for transparency

## How to Verify the Fix

### Step 1: Deploy Changes
```bash
# Push changes to your Cloudflare Pages repository
git add -A
git commit -m "Fix: Cloudflare SOL balance endpoint with proper RPC fallback"
git push
```

### Step 2: Configure Environment Variables in Cloudflare
**Option 1 (Recommended): Use Helius API Key**
1. Get free API key from https://www.helius.dev
2. In Cloudflare Pages project:
   - Settings > Environment variables > Production
   - Add variable: `HELIUS_API_KEY` = `your-api-key-here`
3. Redeploy: Make any small code change and push to trigger deploy, or manually redeploy

**Option 2: Use Custom RPC URL**
If you don't have Helius:
```
SOLANA_RPC_URL = https://solana.publicnode.com
```

### Step 3: Test in Cloudflare
1. Open your wallet
2. Check if SOL balance displays correctly (not 0.00)
3. Refresh balance - should fetch new data
4. Check browser console for logs:
```
[wallet-balance] Using Helius API key endpoint
[wallet-balance] Attempt 1/...: https://mainnet.helius-rpc.com/?api-key=...
[wallet-balance] ✅ Success: 0.002256 SOL from https://mainnet.helius-rpc.com...
```

## Debugging Steps if Issues Persist

### Check Cloudflare Function Logs
1. Go to Cloudflare Dashboard > Pages > Your Project > Deployments
2. Click latest deployment
3. View Function logs (if available)
4. Look for `[wallet-balance]` messages

### Check Browser Console
When SOL balance fails to load:
```javascript
// In browser console, check the API response
fetch('/api/wallet/balance?publicKey=YOUR_ADDRESS')
  .then(r => r.json())
  .then(data => console.log(data))
```

Expected success response:
```json
{
  "publicKey": "YOUR_ADDRESS",
  "balance": 0.002256,
  "balanceLamports": 2256000,
  "source": "https://mainnet.helius-rpc.com/?api-key=..."
}
```

### If Still Getting 0 Balance
1. **Check WalletContext logic** in `client/contexts/WalletContext.tsx`
   - Line 1124: If `tokenAccounts` doesn't have valid SOL balance
   - Line 1133: Falls back to `getBalance()` endpoint
   - Line 1154: If both fail, SOL balance shows as 0

2. **Manual Test**:
   ```bash
   # Test RPC endpoint directly
   curl -X POST https://mainnet.helius-rpc.com/?api-key=YOUR_KEY \
     -H "Content-Type: application/json" \
     -d '{
       "jsonrpc":"2.0",
       "id":1,
       "method":"getBalance",
       "params":["YOUR_WALLET_ADDRESS"]
     }'
   ```

## Public RPC Endpoints (Free Fallback)
If no auth configured, these are tried in order:
1. `https://solana.publicnode.com` ⭐ Most reliable
2. `https://api.solflare.com`
3. `https://rpc.ankr.com/solana`
4. `https://api.mainnet-beta.solana.com`
5. `https://api.marinade.finance/rpc`

These are rate-limited but work for development. For production, use Helius.

## Summary of Fixes

| Issue | File | Fix |
|-------|------|-----|
| Invalid API key | `wrangler.toml` | Removed hardcoded key, use env vars |
| Missing HELIUS support | `functions/api/wallet-balance.ts` | Added HELIUS_API_KEY and HELIUS_RPC_URL |
| Poor error logging | `functions/api/wallet-balance.ts` | Added detailed endpoint-level logging |
| Unclear response format | `functions/api/wallet-balance.ts` | Added `source` field to response |
| Dev server unclear errors | `server/routes/wallet-balance.ts` | Improved error messages and logging |

## Prevention for Future Issues

1. **Never commit sensitive keys** - Always use environment variables
2. **Test both environments** - Dev server and Cloudflare deployment
3. **Add comprehensive logging** - Know which endpoint succeeded/failed
4. **Use fallback chains** - Multiple RPC providers for reliability
5. **Monitor SOL balance specifically** - It's fetched differently than tokens

## Environment Variables Reference

### For Cloudflare Pages
Set in: **Project Settings > Environment variables**

```
# Option 1: Helius (Recommended - fastest)
HELIUS_API_KEY = your-helius-api-key

# Option 2: Custom RPC
SOLANA_RPC_URL = https://your-custom-rpc.com

# Option 3: Multiple providers (will fallback in order)
HELIUS_API_KEY = your-helius-key
ALCHEMY_RPC_URL = https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY
MORALIS_RPC_URL = https://solana-mainnet.moralis.io

# If none set, uses free public endpoints automatically
```

### For Dev Server (localhost)
Set in: `wrangler.toml` or `.env` file

```
[env.development.vars]
SOLANA_RPC_URL = "https://solana.publicnode.com"
```

Or via environment:
```bash
HELIUS_API_KEY=your-key npm run dev
```
