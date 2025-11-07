# Quick Setup & Deployment Guide

## What's New

Your Cloudflare Worker has been updated with complete wallet and swap functionality:

✅ **Wallet Balance Management** - Fetch balances for FIXERCOIN, SOL, USDC, USDT, LOCKER
✅ **Token Price Feeds** - DexScreener integration
✅ **Pump.fun Swaps** - Get quotes and execute token swaps
✅ **Jupiter Integration** - Support for Jupiter DEX swap quotes
✅ **RPC Forwarding** - Direct Solana RPC calls via Shyft
✅ **Transaction Lookup** - Get transaction details by signature
✅ **Account Info** - Fetch on-chain account information

## Available Endpoints

### Core Wallet APIs

```
GET  /api/wallet/balance?wallet={address}
POST /api/wallet/credit                           (Admin only)
GET  /api/health
```

### Price Data

```
GET  /api/dexscreener/price?token={address}
GET  /api/jupiter/price?ids={mint1},{mint2}
```

### Swap Operations

```
GET  /api/swap/quote?mint={mint}                  (Pump.fun)
POST /api/swap/execute                            (Pump.fun)
GET  /api/swap/jupiter/quote?inputMint=...&outputMint=...&amount=...
```

### Solana Blockchain

```
POST /api/rpc                                     (Custom RPC calls)
GET  /api/transaction?signature={sig}
GET  /api/account?publicKey={address}
```

## Environment Setup

### Production (Cloudflare Worker)

**Current Configuration:**

- Worker Domain: `proxy.fixorium.com.pk`
- Solana RPC: `https://rpc.shyft.to?api_key=3hAwrhOAmJG82eC7`
- Pump.fun APIs: `https://pumpportal.fun/api/`
- Jupiter: `https://quote-api.jup.ag/v6/`

**Deployment Command:**

```bash
npm run deploy:cloudflare
```

This runs:

```bash
HELIUS_API_KEY=xxx \
CF_ACCOUNT_ID=zzz \
wrangler publish --config ./cloudflare/wrangler.toml --env production
```

### Local Development

**Environment Variables (.env.local):**

```
VITE_API_BASE_URL=/api
```

The dev server at `npm run dev` will:

- Run Express server on `/api` routes
- Proxy Cloudflare Worker endpoints for testing
- Support WebSocket at `/ws/:roomId`

## Frontend Configuration

### 1. Environment Setup

Create `.env.local`:

```
VITE_API_BASE_URL=https://proxy.fixorium.com.pk
```

Or for development:

```
VITE_API_BASE_URL=/api
```

### 2. Import and Use

```typescript
import { walletApi } from "@/lib/wallet-api";

// Fetch wallet balance
const { balances } = await walletApi.getBalance(walletAddress);

// Get token price
const priceData = await walletApi.getTokenPrice(tokenAddress);

// Get swap quote
const quote = await walletApi.getSwapQuote(tokenMint);

// Execute swap
const result = await walletApi.executeSwap({
  mint: tokenMint,
  amount: 1000000,
  slippage: 10,
});
```

## Deployment Checklist

### Before Production:

- [ ] Test all endpoints locally with `npm run dev`
- [ ] Configure admin token for `/api/wallet/credit`
- [ ] Test wallet balance caching in KV
- [ ] Verify CORS headers work for your domain
- [ ] Load test price endpoints
- [ ] Test swap quote and execution flow

### Production Deployment:

1. **Build Frontend:**

   ```bash
   npm run build
   ```

2. **Deploy Cloudflare Worker:**

   ```bash
   npm run deploy:cloudflare
   ```

3. **Verify Health:**

   ```bash
   curl https://fixorium-proxy.khanbabusargodha.workers.dev/api/health
   ```

4. **Update Frontend Config:**
   - Set `VITE_API_BASE_URL=https://fixorium-proxy.khanbabusargodha.workers.dev`
   - Redeploy frontend

## Common Issues & Solutions

### "Failed to fetch balance"

- Check wallet address format (must be valid Solana address)
- Verify Cloudflare Worker is deployed
- Check CORS headers in browser console

### "Swap quote unavailable"

- Verify token mint address exists
- Check Pump.fun API status
- Look for rate limiting (429 errors)

### "RPC call failed"

- Check Shyft API key is still valid
- Verify request body format (must be valid JSON-RPC)
- Some RPC methods may not be supported by Shyft

## Performance Optimization

### Caching Strategy

**Wallet Balances:**

- Cache in KV for 5-10 minutes
- Refresh on user interaction
- Store in browser localStorage

**Token Prices:**

- Cache for 1-5 minutes depending on frequency
- Use React Query's `staleTime` and `cacheTime`
- Consider batch price requests

**Swap Quotes:**

- Always fetch fresh (not cached)
- Implement request debouncing
- Show last known price while fetching

### Rate Limiting

```typescript
// Implement client-side rate limiting
const throttleMap = new Map<string, number>();

async function throttledFetch(
  key: string,
  fn: () => Promise<any>,
  delayMs = 1000,
) {
  const lastCall = throttleMap.get(key) || 0;
  const now = Date.now();

  if (now - lastCall < delayMs) {
    throw new Error("Rate limited");
  }

  throttleMap.set(key, now);
  return fn();
}
```

## Monitoring & Logging

### In Cloudflare Dashboard:

1. Go to **Workers** → Your Worker
2. Monitor **Metrics** tab for:
   - Request count
   - Error rate
   - Response time
   - Bandwidth

### Enable Logging:

```typescript
// In cloudflare/src/worker.ts
console.log(`[${new Date().toISOString()}] ${method} ${pathname}`);
console.error(`[ERROR] ${error.message}`);
```

View logs:

```bash
wrangler tail --config ./cloudflare/wrangler.toml
```

## Scaling Considerations

### Current Limits (Cloudflare Free Tier):

- ✅ Unlimited requests
- ✅ 100k KV reads/writes per day
- ✅ Low latency globally distributed

### For High Traffic:

- Increase KV storage limits
- Use Durable Objects for real-time features
- Implement aggressive caching
- Add Redis/Memcached for hot data

## Support & Debugging

### Test Endpoints Locally:

```bash
# Health check
curl http://localhost:5173/api/health

# Wallet balance
curl "http://localhost:5173/api/wallet/balance?wallet=YOUR_ADDRESS"

# Token price
curl "http://localhost:5173/api/dexscreener/price?token=TOKEN_ADDRESS"

# Swap quote
curl "http://localhost:5173/api/swap/quote?mint=MINT_ADDRESS"
```

### View Real-Time Logs:

```bash
npm run dev  # View logs in terminal
```

## Documentation Files

Created comprehensive guides:

1. **WALLET_API_ENDPOINTS.md** - Complete API reference
2. **INTEGRATION_GUIDE.md** - Frontend integration examples
3. **QUICK_SETUP.md** - This file

## Next Steps

1. ✅ Review endpoint documentation
2. ✅ Create wallet API client (`client/lib/wallet-api.ts`)
3. ✅ Integrate into your components
4. ✅ Test locally with `npm run dev`
5. ✅ Deploy to production with `npm run deploy:cloudflare`

## Contact & Support

For issues or questions:

- Check Cloudflare Worker logs: `wrangler tail`
- Verify API endpoints: `curl https://your-worker-domain/api/health`
- Review browser console for CORS issues
- Check network tab for response details
