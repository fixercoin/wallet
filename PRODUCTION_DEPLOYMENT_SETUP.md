# Production Deployment Setup

This guide covers both deployment options for your full-stack app (frontend + backend API).

## Option 1: Cloudflare Pages (Recommended - Easiest)

Cloudflare Pages automatically handles both frontend and serverless functions with zero extra configuration.

### Prerequisites

- Connect Cloudflare Pages MCP integration

### Deployment Steps

1. **Connect to Cloudflare Pages MCP**
   - Click [Connect to Cloudflare Pages](#open-mcp-popover)
   - Authorize your Cloudflare Pages account

2. **Deploy**
   - The system will automatically:
     - Build frontend with `pnpm build`
     - Deploy to Cloudflare Pages
     - Deploy serverless functions from `netlify/functions/`
     - Configure API proxy via `wrangler.toml`

3. **Environment Variables** (if needed)
   - Add to Cloudflare Pages dashboard:
   ```
   SOLANA_RPC=https://...           # Optional, defaults to Shyft
   ```

### How It Works

- Frontend: Deployed to Cloudflare Pages CDN
- Backend: Serverless functions at `/.netlify/functions/api/*`
- API Proxy: `wrangler.toml` redirects `/api/*` → `/.netlify/functions/api/:splat`
- API Client: Automatically detects Cloudflare Pages and uses local `/api` paths

### Testing After Deployment

```bash
# Test API endpoint
curl https://YOUR-SITE.netlify.app/api/health

# Expected response:
# {"status":"ok","timestamp":"2024-..."}
```

---

## Option 2: Cloudflare Pages + Cloudflare Worker

If you prefer Cloudflare, deploy the Pages frontend separately from the Worker backend.

### Prerequisites

- Cloudflare account
- `wrangler` CLI installed (`npm install -g wrangler`)

### Step 1: Deploy Cloudflare Worker

```bash
cd cloudflare
wrangler deploy --config ./wrangler.toml --env production
```

This deploys to: `https://proxy.fixorium.com.pk`

### Step 2: Update Frontend Build Environment

The API client automatically detects Cloudflare Pages and uses the Worker URL.

No additional configuration needed - it will use `CLOUDFLARE_WORKER_BASE` automatically.

### Step 3: Deploy Frontend

```bash
# Build
pnpm build

# Deploy to Cloudflare Pages using your preferred method:
# - Wrangler Pages
# - Direct zip upload
# - GitHub integration
```

### Step 4: Environment Variables

Set on Cloudflare Worker (not in code):

```bash
wrangler secret put SOLANA_RPC --config ./cloudflare/wrangler.toml
```

### Testing After Deployment

```bash
# Test Worker health
curl https://proxy.fixorium.com.pk/api/health

# Test from frontend
# Navigate to your Cloudflare Pages URL and check browser console
```

---

## Option 3: Vercel (Also Supports Full-Stack)

Vercel supports both frontend and serverless functions similar to Cloudflare Pages.

1. Connect your repo to Vercel
2. Update API client if needed (Vercel domains are `*.vercel.app`)
3. Deploy

---

## Environment Configuration

### Development (Local)

File: `.env.local`

```
VITE_API_BASE_URL=
NODE_ENV=development
```

API Client behavior:

- Detects `localhost`
- Uses local Express server at `/api/*`

### Production (Cloudflare Pages)

File: `wrangler.toml` (already configured)

```toml
[[redirects]]
from = "/api/*"
to = "/.netlify/functions/api/:splat"
status = 200
force = true
```

API Client behavior:

- Detects `.netlify.app` domain
- Uses local paths `/api/*` (proxied to functions)

### Production (Cloudflare Pages + Worker)

No special config needed.

API Client behavior:

- Detects `.pages.dev` domain
- Uses `https://fixorium-proxy.khanbabusargodha.workers.dev`

---

## API Endpoints Reference

All endpoints are available through both deployment methods:

### Wallet & Balance

- `GET /api/wallet/balance?publicKey=...` - Get SOL balance
- `GET /api/wallet/tokens?publicKey=...` - Get token accounts

### Token Prices

- `GET /api/dexscreener/tokens?mints=...` - DexScreener prices
- `GET /api/dexscreener/search?q=...` - Search tokens
- `GET /api/jupiter/price?ids=...` - Jupiter prices

### Swaps

- `GET /api/swap/quote?inputMint=...&outputMint=...&amount=...` - Quote
- `POST /api/swap/execute` - Execute swap

### P2P Orders

- `GET /api/p2p/orders` - List orders
- `POST /api/p2p/orders` - Create order
- `GET /api/p2p/rooms` - List trade rooms
- `GET /api/p2p/rooms/:id/messages` - Chat messages

### Other

- `GET /api/forex/rate?base=USD&symbols=PKR` - Exchange rates
- `GET /api/stable-24h?symbols=USDC,USDT` - Stablecoin prices
- `POST /api/solana-rpc` - JSON-RPC proxy

---

## Troubleshooting

### API returns 404

- ✅ Cloudflare Pages: Check `wrangler.toml` is deployed correctly
- ✅ Cloudflare Pages: Verify Worker is deployed separately
- ✅ Local: Check Express server is running (`npm run dev`)

### API returns 500 or timeout

- Check Solana RPC endpoint is working
- Check Cloudflare/Cloudflare Pages logs

### CORS errors

- All endpoints have CORS headers enabled
- Ensure requests go through `/api/` proxy, not direct URLs

---

## Performance Notes

### Caching

- DexScreener data cached for 30 seconds
- Binance P2P data cached for 30 seconds

### Rate Limiting

- Free RPC endpoints: ~100 req/min
- For production: Use paid RPC (Helius, Alchemy)

### Timeout Protection

- All requests timeout after 10-20 seconds
- Prevents hanging requests on slow networks

---

## Recommended Setup for Production

For best reliability and ease of maintenance:

1. **Use Cloudflare Pages** - Handles both frontend and backend automatically
2. **Set SOLANA_RPC** to a paid provider (Helius/Alchemy) for better rate limits
3. **Monitor Cloudflare Pages logs** for API errors

This ensures your app remains stable even under high traffic.
