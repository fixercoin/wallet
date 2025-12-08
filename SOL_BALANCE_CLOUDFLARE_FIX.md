# SOL Balance Not Showing After Cloudflare Deployment - Fix Guide

## Problem
After deploying to Cloudflare, the SOL balance shows as 0 on the wallet dashboard, even though the wallet contains SOL. The issue occurs because the RPC endpoint configuration is not properly set up for Cloudflare deployment.

## Root Cause
The application's balance and token fetching endpoints (`/api/wallet/balance` and `/api/wallet/token-accounts`) require a working Solana RPC endpoint. After Cloudflare deployment, if no RPC endpoint is explicitly configured via environment variables, the app falls back to a hardcoded Alchemy API key which may be rate-limited or not working properly in your deployment environment.

## Solution

### Option 1: Configure SOLANA_RPC_URL (Recommended for Production)
Set the `SOLANA_RPC_URL` environment variable to a working Solana RPC endpoint:

```bash
SOLANA_RPC_URL=https://your-rpc-endpoint.com
```

**Recommended RPC Providers:**
- **Helius** (Free tier available): `https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY`
- **QuickNode**: Enterprise-grade with free tier
- **Alchemy**: `https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY`
- **Triton (Mercury)**: Fast and reliable

### Option 2: Use Helius RPC (Fast and Free)
If using Helius, set the `HELIUS_API_KEY` environment variable:

```bash
HELIUS_API_KEY=your-helius-api-key
```

The app will automatically use: `https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY`

### Option 3: For Cloudflare Workers Deployment
When deploying to Cloudflare Workers, you need to set environment variables in your `wrangler.toml`:

```toml
[env.production]
vars = { SOLANA_RPC_URL = "https://your-rpc-endpoint.com" }
```

Or for Helius:

```toml
[env.production]
vars = { HELIUS_API_KEY = "your-helius-api-key" }
```

### Option 4: For Cloudflare Pages Deployment
Set environment variables in the Cloudflare Pages dashboard:

1. Go to your project → Settings → Environment variables
2. Add `SOLANA_RPC_URL` or `HELIUS_API_KEY`
3. Redeploy your project

## How the Fix Works

The application now includes improved RPC endpoint selection logic that:

1. **Checks for SOLANA_RPC_URL first** - Uses your custom RPC endpoint if configured
2. **Falls back to HELIUS_API_KEY** - Uses Helius if no SOLANA_RPC_URL is set
3. **Final fallback to Alchemy** - Uses hardcoded Alchemy key (may be rate-limited)

## Verification

After setting the environment variable:

1. Restart your Cloudflare deployment (or re-deploy if needed)
2. Load the wallet dashboard
3. Check the browser console for logs like:
   - `[WalletBalance] Using SOLANA_RPC_URL` - Configuration is correct
   - `[TokenAccounts] ✅ Fetched SOL balance: X.XX SOL` - Balance is successfully fetched

## Improved Error Logging

The fix also includes enhanced error logging in the server endpoints:
- `[TokenAccounts] Failed to fetch SOL balance - RPC endpoint returned error: HTTP XXX`
- `[WalletBalance] ❌ Error: Failed to fetch balance from RPC endpoint`

These logs help diagnose RPC configuration issues quickly.

## Testing Locally

To test locally with a specific RPC endpoint:

```bash
# Using environment variable
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com npm run dev

# Or set in .env file
echo "SOLANA_RPC_URL=https://api.mainnet-beta.solana.com" >> .env
npm run dev
```

## Common Issues

### Issue: Balance still shows 0
- **Check**: Verify the RPC endpoint is reachable: `curl -X POST https://your-rpc-endpoint -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["11111111111111111111111111111111"]}'`
- **Check**: Look for RPC error messages in server logs
- **Solution**: Try a different RPC provider

### Issue: RPC endpoint is rate-limited
- **Solution**: Use a paid RPC provider with higher rate limits (Helius Pro, QuickNode, etc.)

### Issue: Very slow balance loading
- **Solution**: Your RPC endpoint may be overloaded. Switch to a different provider or enable caching

## Recommendation for Production

For production Cloudflare deployments, we recommend:

1. **Use Helius or QuickNode** - Both have excellent Solana RPC support and free tiers
2. **Set SOLANA_RPC_URL** - Most reliable for production
3. **Monitor RPC usage** - Track rate limits and costs
4. **Enable caching** - The app already caches balances for offline support

## Additional Resources

- [Helius RPC Documentation](https://docs.helius.dev)
- [QuickNode Solana Guides](https://www.quicknode.com/guides/solana)
- [Solana Official RPC Documentation](https://docs.solana.com/developing/clients/jsonrpc-api)
