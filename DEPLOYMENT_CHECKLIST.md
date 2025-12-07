# Production Deployment Checklist

## Summary of Changes Made

✅ **Complete Cloudflare Worker** - All API routes implemented:

- Wallet balance (`/api/wallet/balance`)
- Token accounts (`/api/wallet/tokens`)
- DexScreener integration (`/api/dexscreener/*`)
- Jupiter swaps (`/api/jupiter/*`)
- Pump.fun swaps (`/api/pumpfun/*`)
- Price endpoints (`/api/price`)
- RPC proxy (`/api/solana-rpc`, `/api/rpc`)
- And many more...

✅ **API Client Fixed** - Points to correct Cloudflare Worker URL:

- Production: `https://proxy.fixorium.com.pk`
- Development: Uses local Express backend

✅ **Environment Configuration** - Set up for both dev and production

---

## Deployment Steps

### Step 1: Deploy Cloudflare Worker

```bash
# Install wrangler if not already installed
npm install -g wrangler@latest

# Deploy the worker to production
cd cloudflare
wrangler publish --config ./wrangler.toml --env production
```

The worker will be deployed to: `https://proxy.fixorium.com.pk`

### Step 2: Verify Cloudflare Deployment

Test the health endpoint:

```bash
curl https://proxy.fixorium.com.pk/api/health
```

Expected response:

```json
{
  "status": "ok",
  "upstream": {
    "dexscreener": "ok",
    "jupiter": "ok",
    "pumpfun": "ok"
  },
  "timestamp": "2024-..."
}
```

### Step 3: Test Key Endpoints

#### Test Wallet Balance (requires a valid wallet address):

```bash
curl "https://proxy.fixorium.com.pk/api/wallet/balance?publicKey=YOUR_WALLET_ADDRESS"
```

#### Test Token Price:

```bash
curl "https://proxy.fixorium.com.pk/api/dexscreener/tokens?mints=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
```

#### Test Jupiter Price:

```bash
curl "https://proxy.fixorium.com.pk/api/jupiter/price?ids=So11111111111111111111111111111111111111112"
```

#### Test Swap Quote:

```bash
curl "https://proxy.fixorium.com.pk/api/swap/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000"
```

### Step 4: Update Environment Variables (if needed)

If you have custom API keys for better rate limits, update them on Cloudflare:

```bash
wrangler secret put SOLANA_RPC --config ./cloudflare/wrangler.toml
```

Available secrets:

- `SOLANA_RPC` - Custom Solana RPC endpoint (Helius, Alchemy, Moralis, etc.)
- `COINMARKETCAP_API_KEY` - CoinMarketCap API key
- `HELIUS_API_KEY` - Helius RPC API key

### Step 5: Verify Frontend Configuration

The `.env` file already points to the correct Cloudflare Worker:

```
VITE_API_BASE_URL=https://proxy.fixorium.com.pk
```

For local development, use `.env.local`:

```
VITE_API_BASE_URL=
# (empty = use local Express backend at /api)
```

### Step 6: Build and Deploy Frontend

```bash
# Build the frontend
npm run build

# Test locally
npm run preview

# Deploy to your hosting (Netlify, Vercel, etc.)
# Instructions depend on your hosting provider
```

---

## Available API Endpoints

### Wallet API

- `GET /api/health` - Health check
- `GET /api/wallet/balance?publicKey={address}` - Get SOL balance
- `GET /api/wallet/tokens?publicKey={address}` - Get SPL token accounts

### Price APIs

- `GET /api/price?mint={mint}` - Get token price from DexScreener
- `GET /api/dexscreener/tokens?mints={mint1},{mint2}` - Get multiple token prices
- `GET /api/dexscreener/search?q={query}` - Search for tokens
- `GET /api/dexscreener/trending` - Get trending tokens
- `GET /api/jupiter/price?ids={mint1},{mint2}` - Get Jupiter prices
- `GET /api/dextools/price?tokenAddress={mint}&chainId=solana` - DexTools price

### Swap APIs

- `GET /api/swap/quote?inputMint={mint}&outputMint={mint}&amount={amount}` - Get swap quote (Jupiter fallback to Pump.fun)
- `POST /api/swap/execute` - Execute swap transaction
- `POST /api/pumpfun/quote` - Get Pump.fun swap quote
- `POST /api/pumpfun/trade` - Execute Pump.fun trade
- `GET /api/jupiter/quote?inputMint={mint}&outputMint={mint}&amount={amount}` - Jupiter quote
- `POST /api/jupiter/swap` - Execute Jupiter swap

### Solana RPC

- `POST /api/solana-rpc` - JSON-RPC proxy
- `POST /api/rpc` - Alternative RPC endpoint

### Other APIs

- `GET /api/token?mint={mint}` - Get token metadata
- `GET /api/transaction?signature={sig}` - Get transaction details
- `GET /api/account?publicKey={address}` - Get account info
- `GET /api/forex/rate?base=USD&symbols=PKR` - Exchange rates
- `GET /api/stable-24h?symbols=USDC,USDT` - Stablecoin 24h change

---

## Troubleshooting

### "Route not found" errors

- Verify the endpoint URL is correct
- Check that the Cloudflare Worker is deployed: `wrangler deployments list --config ./cloudflare/wrangler.toml`
- Check Cloudflare Worker logs: `wrangler tail --config ./cloudflare/wrangler.toml`

### "Failed to fetch balance" or "Failed to fetch price"

- Verify the Solana RPC endpoint is working:
  ```bash
  curl -X POST https://api.mainnet-beta.solana.com \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["So11111111111111111111111111111111111111112"]}'
  ```
- Check if the wallet address is valid
- Verify the RPC endpoint has not hit rate limits

### CORS errors

- CORS headers are already configured in the Cloudflare Worker
- If still getting CORS errors, ensure requests are being made through the proxy URL, not directly

### High rate limiting

- Upgrade from public RPC endpoints to a paid provider (Helius, Alchemy, Moralis)
- Set `SOLANA_RPC` environment variable with your private endpoint

---

## Performance Optimization

### Enable Caching

The Cloudflare Worker uses in-memory caching for DexScreener data (30-second TTL). This is automatically enabled.

### Rate Limiting Protection

The worker has built-in timeout protection (10-20 seconds depending on endpoint) to prevent hanging requests.

### Recommended Settings

- Set `SOLANA_RPC` to a paid provider for better rate limits
- Monitor Cloudflare Analytics for traffic patterns
- Consider using Cloudflare KV for persistent caching across requests

---

## Monitoring

### Check Cloudflare Dashboard

1. Go to https://dash.cloudflare.com/
2. Select your account and worker
3. View metrics: Requests, Errors, CPU Time

### View Worker Logs

```bash
wrangler tail --config ./cloudflare/wrangler.toml
```

### Frontend Error Monitoring

Check browser console for API errors. The app logs API errors to the console with the prefix `[API Error]`.

---

## Important Notes

⚠️ **Do not commit secrets** - Use Cloudflare environment variables for API keys, not `.env` files

⚠️ **Frontend must use the proxy** - Never call external APIs directly from the frontend. Always route through `/api/*`

⚠️ **RPC rate limits** - Free public RPC endpoints have strict rate limits. For production, use a paid provider.

✅ **CORS is handled** - All external API calls go through the Cloudflare Worker, so no CORS issues

---

## Next Steps

1. ✅ Complete Cloudflare Worker implementation
2. ✅ Update API client configuration
3. ✅ Set up environment variables
4. 📍 **Deploy Cloudflare Worker** (run step 1 above)
5. 📍 **Test all endpoints** (use curl commands in step 3)
6. 📍 **Deploy frontend** (follow your hosting provider's instructions)
7. 📍 **Monitor production** (check Cloudflare dashboard)

---

## Support & Debugging

If you encounter issues:

1. **Check Cloudflare Worker logs**: `wrangler tail --config ./cloudflare/wrangler.toml`
2. **Test endpoints individually**: Use the curl commands above
3. **Check browser console**: Look for detailed error messages
4. **Verify environment variables**: Ensure `VITE_API_BASE_URL` is correct
5. **Check Solana RPC**: Make sure the RPC endpoint is responding

---

For more information, see:

- `QUICK_SETUP.md` - Quick setup guide
- `INTEGRATION_GUIDE.md` - Frontend integration examples
- `API_PROXY_CONFIGURATION.md` - API proxy details
