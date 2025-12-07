# SOL Balance Fix: Dev Server vs Cloudflare Deployment

## Issue Summary

SOL coin balance was displaying correctly in the dev server but failing after deployment to Cloudflare Pages. The issue was caused by:

1. **Missing environment variables** in Cloudflare dashboard
2. **Different environment variable access patterns** between dev server and Cloudflare
3. **Dev server fallback** to public RPC endpoints working better than Cloudflare's approach

## Root Cause Analysis

### Dev Server Logic (`server/routes/wallet-balance.ts`)
```typescript
// ✅ WORKS: Uses process.env directly
const solanaRpcUrl = getEnvVar(process.env.SOLANA_RPC_URL);
const heliusApiKey = getEnvVar(process.env.HELIUS_API_KEY);

// Falls back to public endpoints automatically
endpoints.push("https://solana.publicnode.com");
endpoints.push("https://rpc.ankr.com/solana");
// ... etc
```

**Why it works:**
- Node.js loads .env files automatically
- Multiple public endpoints as fallback
- 8-second timeout per endpoint with retry logic
- Logs detailed debugging information

### Cloudflare Pages Functions Logic (`functions/api/wallet/balance.ts`)
```typescript
// ❌ FAILED: Only checks env parameter, not process.env
const solanaRpcUrl = env?.SOLANA_RPC_URL;
const heliusApiKey = env?.HELIUS_API_KEY;

// Falls back to Shyft (single endpoint) then public endpoints
endpoints.push("https://rpc.shyft.to?api_key=3hAwrhOAmJG82eC7");
```

**Why it failed:**
- Environment variables NOT set in Cloudflare dashboard
- Only fell back to public endpoints (which can be slow/rate-limited)
- `env` parameter might not be properly passed from request context
- Only Shyft endpoint as paid service, then public endpoints

## Configuration Status

### Your Current Setup (.env file)
```
HELIUS_API_KEY=                    # ❌ EMPTY
# SOLANA_RPC_URL=...              # ❌ COMMENTED OUT
# ALCHEMY_RPC_URL=...             # ❌ NOT SET
# MORALIS_RPC_URL=...             # ❌ NOT SET
```

### Your Current Setup (wrangler.toml)
```toml
[env.production.vars]
SOLANA_RPC_URL = ""                # ❌ EMPTY - NEEDS CONFIGURATION
HELIUS_API_KEY = ""                # ❌ EMPTY - NEEDS CONFIGURATION
HELIUS_RPC_URL = ""                # ❌ EMPTY
ALCHEMY_RPC_URL = ""               # ❌ EMPTY
MORALIS_RPC_URL = ""               # ❌ EMPTY
```

## Solutions Applied

### 1. Enhanced `functions/api/wallet/balance.ts`
✅ Now checks BOTH:
- Cloudflare env parameter (primary)
- Node.js process.env (fallback for local testing)

✅ Better logging to show config source
✅ Proper trimming of environment variables
✅ Fallback to public endpoints with better priority ordering

### 2. What You Need to Do

#### Option A: Using Helius (RECOMMENDED - Fastest & Most Reliable)
1. **Get free Helius API key:**
   - Go to https://www.helius.dev/
   - Sign up for free account
   - Create a new app
   - Copy your API key

2. **Set in Cloudflare Dashboard:**
   - Go to Cloudflare Pages project settings
   - Navigate to: **Environment variables**
   - Add for both **Preview** and **Production**:
     ```
     HELIUS_API_KEY = "your-api-key-here"
     ```

3. **Test locally:**
   ```bash
   # Update .env file
   HELIUS_API_KEY=your-api-key-here
   
   # Run dev server
   npm run dev
   ```

#### Option B: Using Solana Public RPC
1. **Set in Cloudflare Dashboard:**
   - Environment variables > Production/Preview
   ```
   SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com"
   ```

2. **Or use Alchemy:**
   - Get API key from https://www.alchemy.com/
   - Set:
   ```
   ALCHEMY_RPC_URL = "https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY"
   ```

#### Option C: Multiple RPC Endpoints (Best Reliability)
Set all available options in Cloudflare dashboard:
```
HELIUS_API_KEY = "your-helius-key"
SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com"
ALCHEMY_RPC_URL = "https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY"
```

## Step-by-Step Cloudflare Dashboard Setup

1. **Go to your Cloudflare account**
   - Navigate to Pages > Select your project (fixorium-pages)

2. **Open Project Settings**
   - Click "Settings" tab
   - Select "Environment variables"

3. **Add Variables for Preview**
   - Click "Add variable"
   - Name: `HELIUS_API_KEY`
   - Value: `your-helius-api-key-here`
   - Environments: **Preview**
   - Click "Save"

4. **Add Variables for Production**
   - Click "Add variable"
   - Name: `HELIUS_API_KEY`
   - Value: `your-helius-api-key-here`
   - Environments: **Production**
   - Click "Save"

5. **Redeploy your project**
   - Go to "Deployments"
   - Click the most recent deployment
   - Click "Retry deployment"

6. **Test the balance endpoint**
   - Open DevTools Console
   - Should see successful balance fetch in logs
   - Check Network tab for `/api/wallet/balance?publicKey=...` status 200

## How SOL Balance Fetching Works

### Client Flow
1. User creates/imports wallet
2. `WalletContext.tsx` calls `getBalance(publicKey)`
3. `wallet-proxy.ts` fetches from `/api/wallet/balance?publicKey=...`

### Server/Cloudflare Flow
- **Dev Server:** `server/routes/wallet-balance.ts` handles request
  - Checks process.env for RPC endpoints
  - Falls back to public endpoints
  - Returns balance

- **Cloudflare:** `functions/api/wallet/balance.ts` handles request
  - Checks Cloudflare env parameter
  - Falls back to process.env (for Node.js compat)
  - Falls back to public endpoints
  - Returns balance

## Verification

### In Dev Server
```bash
# Run dev server
npm run dev

# Check logs for:
# [WalletBalance] Environment variable check: { hasSolanaRpcUrl: ?, hasHeliusRpcUrl: ?, ... }
# [WalletBalance] Trying X RPC endpoints...
# [WalletBalance] ✅ Success from priority/fallback endpoint: X SOL
```

### After Cloudflare Deployment
1. Create or import a wallet
2. Check browser DevTools Console
3. Should see wallet balance displayed (not "0 SOL")
4. Check Network tab for successful `/api/wallet/balance` response

## Fallback Behavior

### Priority Order (After Your Fix)
1. **HELIUS_API_KEY** (if set) → mainnet.helius-rpc.com
2. **HELIUS_RPC_URL** (if set) → direct URL
3. **SOLANA_RPC_URL** (if set) → direct URL
4. **ALCHEMY_RPC_URL** (if set) → direct URL
5. **MORALIS_RPC_URL** (if set) → direct URL
6. **Public Endpoints** (automatic fallback):
   - solana.publicnode.com
   - rpc.ankr.com/solana
   - rpc.ironforge.network/mainnet
   - api.mainnet-beta.solana.com
   - rpc.genesysgo.net

### Timeout & Retry
- **Per endpoint timeout:** 15 seconds (Cloudflare Pages Functions)
- **Retries:** Tries all endpoints in order
- **Response time:** ~500ms-3s with configured endpoints, slower with public fallbacks

## Common Issues & Solutions

### Issue: "Failed to fetch wallet balance"
**Cause:** All RPC endpoints failing/timing out

**Solutions:**
1. Check Cloudflare dashboard has env variables set
2. Verify API keys are correct (test manually with curl)
3. Check if endpoints are rate-limited or down
4. Try adding multiple RPC providers for redundancy

### Issue: Balance loads slowly
**Cause:** Using public endpoints instead of configured RPC

**Solution:**
Set HELIUS_API_KEY or another premium RPC endpoint in Cloudflare dashboard

### Issue: "Zero SOL balance after import"
**Cause:** RPC endpoint not returning valid response

**Solution:**
1. Check browser console logs
2. Check Cloudflare deployment logs
3. Verify RPC endpoint is working: `curl -X POST https://your-rpc.com -d '{"jsonrpc":"2.0","method":"getBalance","params":["address"],"id":1}'`

## Testing Checklist

- [ ] Set HELIUS_API_KEY in Cloudflare dashboard
- [ ] Redeploy Cloudflare project
- [ ] Create new wallet in browser
- [ ] Verify balance displays (not 0 SOL)
- [ ] Import test wallet with known balance
- [ ] Verify correct balance displays
- [ ] Check browser console for no errors
- [ ] Check Cloudflare deployment logs
- [ ] Test on different browsers/devices
- [ ] Verify token accounts also load (not just SOL)

## Environment Variable Reference

| Variable | Source | Purpose | Priority |
|----------|--------|---------|----------|
| HELIUS_API_KEY | Cloudflare Dashboard | Helius RPC with API key | High - Most reliable |
| HELIUS_RPC_URL | Cloudflare Dashboard | Full Helius RPC URL | High - If you have full URL |
| SOLANA_RPC_URL | Cloudflare Dashboard | Default Solana RPC | Medium |
| ALCHEMY_RPC_URL | Cloudflare Dashboard | Alchemy RPC endpoint | Medium |
| MORALIS_RPC_URL | Cloudflare Dashboard | Moralis RPC endpoint | Low |

## Additional Notes

- **Dev vs Production:** Environment variables must be set separately for each
- **Preview vs Production:** Consider setting for both in Cloudflare
- **Cost:** Most RPC providers have free tiers; Helius offers free plan for development
- **Rate Limits:** Public endpoints have low rate limits; use configured endpoints for production
- **Monitoring:** Check Cloudflare Pages Functions logs for any balance fetch errors

## Related Files Modified

1. `functions/api/wallet/balance.ts` - Enhanced env parameter handling
2. `wrangler.toml` - Environment variable configuration template (already set)
3. `.env` - Local development (you need to update with your keys)

## Next Steps

1. ✅ Applied code fix to handle env parameter + process.env
2. **⏳ Set HELIUS_API_KEY (or other RPC) in Cloudflare dashboard**
3. **⏳ Redeploy Cloudflare project**
4. **⏳ Test balance fetching**
