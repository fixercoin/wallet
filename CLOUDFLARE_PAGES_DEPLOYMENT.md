# Cloudflare Pages Serverless Deployment Guide

This guide explains how to deploy the wallet application as serverless functions on Cloudflare Pages with Jupiter API v6 integration for token swaps.

## Architecture Overview

The application is now fully serverless using Cloudflare Pages Functions:

- **Frontend**: React application built with Vite, served as static files
- **API Layer**: TypeScript-based serverless functions in the `functions/` directory
- **Jupiter Integration**: v6 API with quote and swap endpoints via serverless functions
- **Solana RPC**: Proxied through serverless functions with fallback endpoints
- **Storage**: Optional D1 database or KV store for persistent data

## Directory Structure

```
functions/
├── api/
│   ├── jupiter/
│   │   ├── quote.ts          # Jupiter v6 quote endpoint
│   │   ├── swap.ts           # Jupiter v6 swap endpoint
│   │   └── price.ts          # Jupiter v6 price endpoint
│   ├── wallet/
│   │   ├── balance.ts        # Get wallet balance
│   │   └── tokens.ts         # Get wallet tokens
│   ├── birdeye/
│   │   └── price.ts          # Birdeye price with fallbacks
│   ├── dexscreener/
│   │   └── price.ts          # DexScreener price endpoint
│   ├── pumpfun/
│   │   ├── buy.ts            # Pump.fun buy transactions
│   │   └── sell.ts           # Pump.fun sell transactions
│   ├── token/
│   │   └── price.ts          # Token price utility
│   ├── solana-rpc.ts         # Solana RPC proxy
│   └── [[path]].ts           # Catch-all handler

client/                        # React frontend (built to dist/)
├── components/               # React components
├── pages/                   # Page components
├── lib/
��   └── services/
│       ├── jupiter-v6.ts    # Jupiter v6 API client
│       └── ...
└── App.tsx                  # Main app component

dist/                        # Build output (served by Cloudflare Pages)
```

## Serverless API Endpoints

All API endpoints are now serverless and don't require an Express server:

### Jupiter v6 Swap

```
GET /api/jupiter/quote?inputMint=...&outputMint=...&amount=...&slippageBps=100
POST /api/jupiter/swap (with quoteResponse JSON body)
GET /api/jupiter/price?ids=mint1,mint2,...
```

### Solana RPC

```
POST /api/solana-rpc (with JSON-RPC body)
```

### Wallet

```
GET /api/wallet/balance?publicKey=...
GET /api/wallet/tokens?publicKey=...
```

### Prices

```
GET /api/birdeye/price?address=mint
GET /api/dexscreener/price?mint=mint
GET /api/token/price?token=SOL&symbol=SOL
```

### Pump.fun

```
POST /api/pumpfun/buy (with mint, amount, buyer)
POST /api/pumpfun/sell (with mint, amount, seller)
```

## Deployment to Cloudflare Pages

### Prerequisites

1. Cloudflare account with Pages enabled
2. Git repository (GitHub, GitLab, or Gitea)
3. `wrangler` CLI installed locally (optional, for testing)

### Step 1: Connect Your Repository

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to Pages
3. Click "Create a project" → "Connect to Git"
4. Select your Git provider and repository
5. Authorize Cloudflare to access your repository

### Step 2: Configure Build Settings

In the Cloudflare Pages setup:

- **Framework preset**: None (or Custom)
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Node.js version**: 18.x or higher

### Step 3: Set Environment Variables

In Cloudflare Pages Settings → Environment Variables:

```
SOLANA_RPC=https://rpc.shyft.to?api_key=YOUR_KEY
BIRDEYE_API_KEY=your_birdeye_api_key
```

### Step 4: Deploy

Option A: Automatic (recommended)

- Push code to your connected branch
- Cloudflare automatically builds and deploys

Option B: Manual using Wrangler

```bash
npm install -g @cloudflare/wrangler
wrangler pages deploy dist --project-name wallet-c36
```

## Local Development

For local testing with serverless functions:

```bash
# Install Wrangler
npm install -D @cloudflare/wrangler

# Run locally with functions
wrangler pages dev dist --local

# Or run Vite dev server + functions
npm run dev
```

The dev server will:

- Serve frontend on http://localhost:5173 (Vite)
- Serve API functions on http://localhost:8788/api/\* (Wrangler)

## Jupiter API v6 Integration

The swap interface now uses Jupiter API v6 through serverless endpoints:

```typescript
import { jupiterV6API } from "@/lib/services/jupiter-v6";

// Get quote
const quote = await jupiterV6API.getQuote(
  inputMint,
  outputMint,
  amount,
  100, // slippageBps
);

// Create swap
const swap = await jupiterV6API.createSwap(quote, userPublicKey, {
  wrapAndUnwrapSol: true,
});
```

## Monitoring and Debugging

### Cloudflare Pages Analytics

Access via Cloudflare Dashboard → Pages → Your Project → Analytics

### Real-time Logs

```bash
wrangler tail --project-name wallet-c36
```

### Performance Metrics

Monitor:

- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- API endpoint response times

## Scaling and Rate Limiting

Cloudflare Pages provides automatic scaling:

- **Requests**: Unlimited (within fair use)
- **Functions**: Auto-scaled per region
- **Concurrent Executions**: 1000+ simultaneously
- **CPU time**: 30 seconds per request
- **Memory**: 128MB per function

For high-traffic swaps, consider:

1. Implementing request rate limiting in functions
2. Caching quote responses in Cloudflare KV
3. Using Cloudflare Workers KV for session state

## Database Integration (Optional)

To add persistent storage:

### Option 1: Cloudflare D1 (SQLite)

```bash
wrangler d1 create wallet-db
```

### Option 2: Cloudflare KV

```bash
wrangler kv:namespace create wallet-cache
```

### Option 3: External Database

- Neon (PostgreSQL)
- Supabase
- MongoDB Atlas

## Security Best Practices

1. **API Keys**: Store in Cloudflare Workers Secrets, not in code

```bash
wrangler secret put SOLANA_RPC
wrangler secret put BIRDEYE_API_KEY
```

2. **CORS**: Already configured in functions
3. **Rate Limiting**: Implement per IP/wallet
4. **Input Validation**: All functions validate inputs
5. **Timeouts**: All external calls have timeouts (15-45s)

## Troubleshooting

### Functions Not Found

Check that:

- Files are in `functions/api/` directory
- File names match the route structure
- No syntax errors in TypeScript

### Build Failures

```bash
# Clear build cache
npm run build

# Check for errors
npm run typecheck
```

### API Timeout

Increase timeout or:

1. Check RPC endpoint health
2. Use fallback endpoints
3. Implement retry logic

### CORS Issues

Functions have CORS headers enabled:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

## Migration from Express Server

Old: `/api/...` → Express server on port 3000  
New: `/api/...` → Cloudflare Pages Functions

No client changes needed! The API routes remain identical; the backend is now fully serverless.

## Cost Estimation

Cloudflare Pages pricing:

- **Unlimited requests**: No per-request charge
- **Functions**: $0.50 per million requests
- **Static files**: Free
- **KV storage**: $0.50 per month (includes 1GB)
- **D1 database**: $0.75 per month

Example: 10M API requests/month = ~$5 cost

## Next Steps

1. Push code to your Git repository
2. Connect repository to Cloudflare Pages
3. Configure environment variables
4. Monitor initial deployment
5. Test swap functionality with Jupiter v6
6. Optimize based on analytics

## Support

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Cloudflare Functions Docs](https://developers.cloudflare.com/pages/functions/)
- [Jupiter API Docs](https://station.jup.ag/docs/)
- [Solana RPC API Docs](https://docs.solana.com/api)
