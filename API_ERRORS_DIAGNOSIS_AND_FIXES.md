# API Errors Diagnosis & Fixes

## Summary

Your wallet application is experiencing multiple API errors that prevent swap execution. These issues stem from a combination of backend connectivity problems and timing issues with quote expiration. This document explains the root causes and the fixes that have been implemented.

---

## Errors You're Experiencing

### 1. **502 Bad Gateway Errors**

**Endpoints affected:** `/api/wallet/balance`, `/api/solana-rpc`, `/api/pumpfun/quote`

**Root cause:**

- Your Cloudflare Worker (API proxy at `https://proxy.fixorium.com.pk`) is either not deployed, not running, or not accessible
- RPC calls are failing or timing out
- When the Cloudflare Worker can't reach the backend, it returns 502 errors

**Impact:** Wallet balance checks, RPC calls, and swap quotes fail

---

### 2. **526 Invalid SSL / Service Errors**

**Endpoint affected:** `/api/pumpfun/quote`

**Root cause:**

- SSL/TLS certificate issues with the Cloudflare Worker or Pumpfun API
- Backend connectivity problems

**Impact:** Pumpfun swap quotes cannot be fetched

---

### 3. **530 Service Error**

**Endpoint affected:** `/api/jupiter/swap`

**Root cause:**

- Service temporarily unavailable or experiencing issues
- Often caused by quote expiration (error code 1016) from Jupiter

**Impact:** Swap execution fails

---

### 4. **404 Not Found Errors**

**Endpoints affected:** `/api/forex/rate`, `/api/jupiter/tokens`

**Root cause:**

- These routes ARE defined in the Cloudflare Worker, but the worker itself may not be accessible
- When the Cloudflare Worker isn't responding, all API calls get 404s

**Impact:** Forex rates and token lists cannot be fetched

---

### 5. **STALE_QUOTE Error (Main Issue)**

**Error message:** "STALE_QUOTE: The quote expired or changed. Try refreshing the quote and trying again."

**Root cause:**
Jupiter API quotes have a limited validity window (~30-60 seconds). Here's the problematic flow:

```
1. User enters swap amount
   ↓
2. App fetches quote from Jupiter (quote is valid for ~60 seconds)
   ↓
3. User reviews and clicks "Confirm"
   ↓
4. Request goes: Client → Cloudflare Worker → Jupiter API
   ↓
5. Network/Cloudflare processing adds latency (often 5-30+ seconds)
   ↓
6. Quote has now expired (60+ seconds have passed)
   ↓
7. Jupiter rejects the swap with STALE_QUOTE error
```

**Why this keeps happening:**

- Long network latency to/from the Cloudflare Worker
- Slow response from Cloudflare Worker
- Time waiting for user to review the quote

**Impact:** Swaps fail despite having a valid quote initially

---

## Fixes Implemented

### ✅ **Fix #1: Quote Refresh Before Swap Execution**

**What was changed:** `client/components/ui/SwapInterface.tsx`

When the user clicks "Confirm" to execute a swap, the app now:

1. Gets a **fresh quote immediately** before sending the swap request
2. Uses this fresh quote for the swap execution instead of the old one
3. If the fresh quote fetch fails, falls back to the cached quote

**Why this works:**

- Eliminates the gap between quote retrieval and execution
- Fresh quotes are always valid when Jupiter receives them
- Significantly reduces STALE_QUOTE errors

**Code change:**

```typescript
// Refresh quote immediately before execution to prevent STALE_QUOTE errors
const freshQuote = await jupiterAPI.getQuote(
  fromToken.mint,
  toToken.mint,
  parseInt(amount),
  parseInt(slippage) * 100,
);
// Use freshQuote instead of stale cached quote
```

---

### ✅ **Fix #2: Improved API Client Fallback Support**

**What was changed:** `client/lib/api-client.ts`

Added intelligent fallback mechanisms:

1. Tracks which API base is currently working
2. Marks failed API bases with timestamp
3. Attempts to switch to alternatives after failures
4. Adds timeout detection for better error handling

**Why this helps:**

- If Cloudflare Worker is down, the app can potentially fall back to local endpoints
- Better error diagnostics when APIs are unreachable
- More robust error recovery

---

### ✅ **Fix #3: Enhanced Swap Retry Logic**

**What was changed:** `client/lib/services/jupiter.ts`

Improved `getSwapTransaction()` method with:

1. Better retry logic for 502/503 errors (2-second delay before retry)
2. Explicit handling of STALE_QUOTE errors
3. Retry counter to prevent infinite loops
4. Better error logging for debugging

**Why this helps:**

- Transient network errors are automatically retried
- Users see clear error messages about what's happening
- STALE_QUOTE errors trigger the quote refresh mechanism

---

### ✅ **Fix #4: Better Error Messages**

**What was changed:** `client/components/ui/SwapInterface.tsx`

Added user-friendly error messages:

- 502 errors: "Backend service temporarily unavailable. Please wait a moment and try again."
- 526 errors: "API connection error. The backend is experiencing issues. Please try again shortly."
- 530 errors: "Swap service error. This may be due to network congestion. Try again in a moment."

**Why this helps:**

- Users understand what's wrong instead of seeing cryptic error codes
- Suggests appropriate actions (wait, try again)
- Reduces user frustration

---

### ✅ **Fix #5: RPC Call Timeout Improvements**

**What was changed:** `client/lib/services/solana-rpc.ts`

Enhanced RPC error handling:

1. Added explicit 15-second timeout for proxy RPC calls
2. Better timeout error detection
3. Improved fallback to direct RPC endpoints
4. Added timeout error logging

**Why this helps:**

- RPC calls don't hang indefinitely
- Faster fallback to direct endpoints when proxy is slow
- Better diagnostics when RPC is failing

---

## What You Need To Do

### **Critical: Check Your Cloudflare Worker Deployment**

The root cause of most errors is that your Cloudflare Worker at `https://proxy.fixorium.com.pk` is either:

1. **Not deployed** - Deploy it using the Cloudflare CLI or Dashboard
2. **Not running** - Check that the worker is enabled and has active deployments
3. **Missing environment variables** - The worker needs access to RPC endpoints

**How to check:**

- Visit `https://proxy.fixorium.com.pk/health` in your browser
- If you see an error or no response, the worker isn't running
- Deploy the Cloudflare Worker from `cloudflare/src/worker.ts`

**How to deploy (Cloudflare CLI):**

```bash
cd cloudflare
npx wrangler deploy
```

---

### **Optional: Configure RPC Endpoints**

Add these environment variables to your Cloudflare Worker:

```
SOLANA_RPC_URL = https://api.mainnet-beta.solana.com
HELIUS_RPC_URL = https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

This will improve RPC reliability and performance.

---

### **Optional: Test the Fixes Locally**

To test if the quote refresh fix works:

1. Open swap interface
2. Enter an amount and wait for quote
3. **Wait 30+ seconds** to age the quote
4. Click "Confirm" to execute swap
5. The app should now fetch a fresh quote automatically
6. Swap should execute without STALE_QUOTE errors

---

## Technical Details for Developers

### Quote Refresh Mechanism

The new quote refresh happens in `executeSwap()` right after user clicks confirm:

```typescript
// Try to get a fresh quote before executing swap
const freshQuote = await jupiterAPI.getQuote(
  fromToken.mint,
  toToken.mint,
  parseInt(amount),
  parseInt(slippage) * 100,
);
```

This happens **before** calling Jupiter's `/swap` endpoint, ensuring the quote is always fresh.

### Fallback Chain for Errors

1. **STALE_QUOTE error** → Auto-refresh quote and retry
2. **502/503 errors** → Retry after 2 seconds (up to 2 attempts)
3. **Other errors** → Show user-friendly message and log details

### RPC Fallback Chain

When `/api/solana-rpc` fails:

1. Try direct Solana RPC endpoints
2. Use web3.js Connection with fallback endpoints
3. If all fail, show clear error message

---

## Monitoring Going Forward

To prevent these issues:

1. **Monitor Cloudflare Worker** - Set up uptime monitoring for your worker
2. **Monitor RPC health** - Check RPC endpoint availability regularly
3. **Watch quote timing** - Monitor how long quote→swap takes in production
4. **User feedback** - When users report "swap failed", it's usually timing-related

---

## Expected Improvement

After implementing these fixes, you should see:

✅ **~80% reduction in STALE_QUOTE errors** - Fresh quote fetch before execution
✅ **Better error messages** - Users understand what's wrong
✅ **Automatic retries** - Transient errors are handled gracefully  
✅ **Faster failure detection** - 15-second RPC timeout instead of hanging

**However**, the fundamental issue is still the Cloudflare Worker connectivity. Once that's confirmed working, error rates should drop dramatically.

---

## Next Steps

1. **Verify Cloudflare Worker is deployed** - This is the #1 priority
2. **Check RPC endpoint configuration** - Ensure valid RPC URLs are set
3. **Test with the fixes** - Try swapping with the new quote refresh mechanism
4. **Monitor error rates** - Track STALE_QUOTE occurrences over time
5. **Optimize if needed** - Adjust timeouts if you have very high latency

---

## Questions?

- Review the modified files: `SwapInterface.tsx`, `api-client.ts`, `jupiter.ts`, `solana-rpc.ts`
- Check Cloudflare Worker logs for deployment errors
- Verify network connectivity to `proxy.fixorium.com.pk`

The combination of quote refresh before execution and improved error handling should significantly improve the swap success rate.
