# Helius RPC Setup Guide - Fix 502 Balance Error

## Problem

You're getting a **502 Bad Gateway** error when fetching wallet balances:

```
GET https://wallet.fixorium.com.pk/api/wallet/balance?publicKey=... 502
```

**Root Cause**: The application was using a hardcoded (and likely rate-limited) Helius API key that's now exposed in the public repository. This key has been removed, and the app needs a proper environment variable configuration.

## Solution

### Step 1: Get a Helius API Key

1. Go to **https://www.helius.dev/** and sign up (free plan available)
2. Once logged in, go to **Dev Dashboard**
3. Create a new project or select existing one
4. Copy your **RPC Endpoint URL** (looks like: `https://mainnet.helius-rpc.com/?api-key=YOUR_KEY`)
5. Extract the API key from the URL (the part after `api-key=`)

### Step 2: Set Environment Variable

**For Local Development:**

- Open the `.env` file in the project root
- Find the line: `HELIUS_API_KEY=`
- Set it to your API key:
  ```
  HELIUS_API_KEY=your-api-key-here
  ```
- Save and restart the dev server

**For Production (Netlify/Vercel):**

- Go to your deployment platform settings
- Set environment variable: `HELIUS_API_KEY=your-api-key-here`
- Redeploy the project

### Step 3: Verify the Setup

Test the endpoint locally:

```bash
curl "http://localhost:8080/api/wallet/balance?publicKey=5bW3uEyoP1jhXBMswgkB8xZuKUY3hscMaLJcsuzH2LNU"
```

Expected response:

```json
{
  "publicKey": "5bW3uEyoP1jhXBMswgkB8xZuKUY3hscMaLJcsuzH2LNU",
  "balance": 0.123456,
  "balanceLamports": 123456000
}
```

## What Was Changed

### 1. Removed Exposed API Keys

- ❌ Removed hardcoded key from `server/routes/wallet-balance.ts`
- ❌ Removed hardcoded key from `server/routes/token-accounts.ts`
- ❌ Removed hardcoded key from `functions/api/solana-send.ts`
- ❌ Removed hardcoded key from `utils/solanaConfig.ts`

### 2. Updated RPC Endpoint Priority

The application now uses this priority order for RPC endpoints:

1. **SOLANA_RPC_URL** (environment variable) - Takes highest priority
2. **HELIUS_API_KEY** - Constructs RPC URL: `https://mainnet.helius-rpc.com/?api-key={KEY}`
3. **HELIUS_RPC_URL** - Direct Helius RPC URL if provided
4. **ALCHEMY_RPC_URL** - Alchemy RPC URL if provided
5. **MORALIS_RPC_URL** - Moralis RPC URL if provided
6. **Public Fallbacks** - Free public endpoints (rate limited):
   - `https://solana.publicnode.com`
   - `https://rpc.ankr.com/solana`
   - `https://api.mainnet-beta.solana.com`

### 3. Improved Error Handling

- Better error messages that suggest fixing RPC configuration
- Proper logging of which endpoints are being tried
- 502 status code for RPC failures (indicates server/RPC issue)

## Environment Variable Options

You only need to set ONE of these (in order of preference):

### Option 1: Helius API Key (Recommended)

```bash
HELIUS_API_KEY=your-api-key-from-helius-dev
```

### Option 2: Generic Solana RPC URL

```bash
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
# OR
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
# OR any other compatible Solana RPC endpoint
```

### Option 3: Provider-Specific URLs

```bash
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
ALCHEMY_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY
MORALIS_RPC_URL=https://api.moralis.io/solana/...
```

## Why Helius RPC?

**Helius is recommended because:**

1. **Better Reliability** - 99.9% uptime SLA
2. **Higher Rate Limits** - Free plan: 10 RPS, Paid: Higher
3. **Better Support** - Solana-focused RPC provider
4. **Enhanced APIs** - Specialized endpoints for token balances, transaction history, etc.
5. **Low Latency** - Optimized for Solana
6. **CORS Support** - Works seamlessly from browser

## Troubleshooting

### Still Getting 502?

1. **Check API Key is correct**

   ```bash
   # Test your Helius endpoint directly:
   curl -X POST https://mainnet.helius-rpc.com/?api-key=YOUR_KEY \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["5bW3uEyoP1jhXBMswgkB8xZuKUY3hscMaLJcsuzH2LNU"]}'
   ```

2. **Check Server Logs**
   Look for errors in your server/deployment logs to see which RPC endpoints are being tried and why they're failing

3. **Check Rate Limits**
   - If using free tier, you might be hitting rate limits
   - Upgrade to Helius paid plan for higher limits
   - Or use a different RPC provider

4. **Test with Public Endpoint**
   - Temporarily set: `SOLANA_RPC_URL=https://solana.publicnode.com`
   - This is free but rate limited - good for testing only

### Token Balances Not Showing?

The code already uses Helius for token balances via `getTokenAccountsByOwner` RPC method. This should work once your RPC is configured correctly.

## Files Modified

- `server/routes/wallet-balance.ts` - Removed hardcoded key, improved error handling
- `server/routes/token-accounts.ts` - Removed hardcoded key
- `functions/api/solana-send.ts` - Removed hardcoded key
- `utils/solanaConfig.ts` - Removed hardcoded key
- `.env` - Added clear documentation of environment variables

## Next Steps

1. ✅ Get your Helius API key
2. ✅ Set `HELIUS_API_KEY` environment variable
3. ✅ Test the `/api/wallet/balance` endpoint
4. ✅ Deploy to production with the environment variable set
5. ✅ Monitor server logs for any issues

## Need Help?

- **Helius Support**: https://docs.helius.xyz/
- **Solana RPC Documentation**: https://solana.com/docs/rpc
- **Rate Limits**: https://www.helius.dev/pricing
