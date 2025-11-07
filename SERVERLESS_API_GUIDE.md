# Serverless API Functions Guide

This document provides a complete reference for all serverless API endpoints deployed on Cloudflare Pages.

## Overview

All API endpoints are implemented as serverless functions in the `functions/` directory. No Express server is required for production deployment.

### Key Features

- ✅ Zero-cold-start deployment (Cloudflare edge optimization)
- ✅ Automatic scaling (handles 1000+ concurrent requests)
- ✅ Built-in CORS support
- ✅ Timeout handling (15-45 seconds depending on endpoint)
- ✅ Fallback endpoints for RPC and price feeds
- ✅ Jupiter API v6 integration for token swaps

## API Endpoints Reference

### Jupiter v6 Swap Endpoints

#### Quote

```
GET /api/jupiter/quote?inputMint=...&outputMint=...&amount=...&slippageBps=100
```

**Parameters:**

- `inputMint` (required): Token to swap from (mint address)
- `outputMint` (required): Token to swap to (mint address)
- `amount` (required): Amount in smallest units
- `slippageBps` (optional, default 100): Slippage tolerance in basis points (100 = 1%)
- `onlyDirectRoutes` (optional): Only direct routes (true/false)
- `asLegacyTransaction` (optional): Use legacy transaction format (true/false)

**Example:**

```bash
curl "http://localhost:8788/api/jupiter/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump&amount=1000000000&slippageBps=100"
```

**Response:**

```json
{
  "inputMint": "So11...",
  "inAmount": "1000000000",
  "outputMint": "H4qK...",
  "outAmount": "12345678",
  "slippageBps": 100,
  "priceImpactPct": "0.45",
  "routePlan": [...]
}
```

#### Swap

```
POST /api/jupiter/swap
Content-Type: application/json

{
  "quoteResponse": {...},
  "userPublicKey": "Your wallet address",
  "wrapAndUnwrapSol": true,
  "useSharedAccounts": true,
  "asLegacyTransaction": false
}
```

**Response:**

```json
{
  "swapTransaction": "base64_encoded_transaction",
  "lastValidBlockHeight": 123456,
  "prioritizationFeeLamports": null
}
```

#### Price

```
GET /api/jupiter/price?ids=mint1,mint2,mint3
```

**Response:**

```json
{
  "data": {
    "So11111111111111111111111111111111111111112": {
      "id": "So11...",
      "type": "token",
      "price": 149.38
    }
  }
}
```

### Solana RPC Endpoints

#### RPC Proxy

```
POST /api/solana-rpc
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getBalance",
  "params": ["wallet_address"]
}
```

Supports all standard Solana RPC methods:

- `getBalance` - Get SOL balance
- `getTokenAccountsByOwner` - Get token accounts
- `getTransaction` - Get transaction details
- `sendRawTransaction` - Submit signed transaction
- And more...

### Wallet Endpoints

#### Balance

```
GET /api/wallet/balance?publicKey=wallet_address
```

**Response:**

```json
{
  "publicKey": "Address1...",
  "balance": 5.123456,
  "balanceLamports": 5123456000
}
```

#### Tokens

```
GET /api/wallet/tokens?publicKey=wallet_address
```

**Response:**

```json
{
  "publicKey": "Address1...",
  "tokens": [
    {
      "mint": "EPjFWdd5...",
      "address": "TokenAccount...",
      "amount": "1000000000",
      "decimals": 6,
      "isNative": false
    }
  ],
  "total": 5
}
```

### Price Endpoints

#### Birdeye Price (with fallbacks)

```
GET /api/birdeye/price?address=token_mint
```

Uses fallback chain:

1. Birdeye API
2. DexScreener API
3. Jupiter API
4. Hardcoded fallback prices

**Response:**

```json
{
  "success": true,
  "data": {
    "address": "So11...",
    "value": 149.38,
    "updateUnixTime": 1703123456,
    "priceChange24h": 2.45,
    "source": "birdeye"
  }
}
```

#### DexScreener Price

```
GET /api/dexscreener/price?mint=token_mint
```

#### Token Price Utility

```
GET /api/token/price?token=SOL&symbol=SOL
GET /api/token/price?mint=token_mint
```

### Pump.fun Endpoints

#### Buy

```
POST /api/pumpfun/buy
Content-Type: application/json

{
  "mint": "token_mint",
  "amount": 1000000,
  "buyer": "buyer_address",
  "slippageBps": 350,
  "priorityFeeLamports": 10000
}
```

#### Sell

```
POST /api/pumpfun/sell
Content-Type: application/json

{
  "mint": "token_mint",
  "amount": 1000000,
  "seller": "seller_address",
  "slippageBps": 350,
  "priorityFeeLamports": 10000
}
```

### Health Check

```
GET /api/health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T12:34:56.789Z",
  "environment": "cloudflare-pages"
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "details": "Additional error details",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

- `400` - Bad Request (missing/invalid parameters)
- `404` - Not Found (invalid endpoint)
- `502` - Bad Gateway (external API error)
- `504` - Gateway Timeout (request took too long)
- `STALE_QUOTE` - Quote expired
- `NO_ROUTE_FOUND` - No swap route available

## Rate Limits

Cloudflare Pages has these built-in limits:

- **Requests per minute**: Unlimited (fair use)
- **Concurrent requests**: 1000+
- **Function timeout**: 30 seconds
- **Memory**: 128MB per function

For production usage:

- Implement client-side rate limiting
- Cache quote responses (5-10 seconds)
- Batch price requests

## Performance Tips

### 1. Cache Quote Responses

Quotes are valid for ~30 seconds:

```typescript
const quoteCache = new Map();
const cacheKey = `${inputMint}-${outputMint}-${amount}`;
if (quoteCache.has(cacheKey)) {
  return quoteCache.get(cacheKey);
}
```

### 2. Batch Price Requests

```bash
# Instead of multiple requests
GET /api/jupiter/price?ids=mint1,mint2,mint3,mint4,mint5
```

### 3. Use DexScreener for High-Traffic

DexScreener is fastest for price feeds:

```bash
GET /api/dexscreener/price?mint=token_mint
```

### 4. Connection Pooling

Cloudflare automatically handles connection pooling.

## Development

### Local Testing

```bash
# Start dev server with functions
wrangler pages dev dist --local

# Or use Vite + Node server
npm run dev
```

### Testing Specific Endpoints

```bash
# Quote endpoint
curl "http://localhost:8788/api/jupiter/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump&amount=1000000000"

# RPC endpoint
curl -X POST http://localhost:8788/api/solana-rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["wallet_address"]}'

# Wallet balance
curl "http://localhost:8788/api/wallet/balance?publicKey=wallet_address"
```

### Adding New Endpoints

1. Create file in `functions/api/...`
2. Export default handler function:

```typescript
export const config = {
  runtime: "nodejs_esmsh",
};

async function handler(request: Request): Promise<Response> {
  // Implementation
  return new Response(JSON.stringify(response), {
    headers: { "Content-Type": "application/json" },
  });
}

export default handler;
```

3. Function is automatically available at `/api/...` matching file path

## Security

### CORS

All endpoints have CORS headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

### Input Validation

- All functions validate required parameters
- Query parameters are sanitized
- JSON bodies are validated before processing

### Timeout Protection

- All external HTTP calls have timeouts (15-45s)
- Functions abort on timeout
- Request/response limits enforced

### API Keys

Store sensitive keys in Cloudflare Secrets:

```bash
wrangler secret put BIRDEYE_API_KEY
wrangler secret put SOLANA_RPC
```

Never commit `.env` with secrets!

## Monitoring

### Cloudflare Analytics

View in Cloudflare Dashboard → Pages → Analytics

### Real-time Logs

```bash
wrangler tail --project-name wallet-c36
```

### Key Metrics

- Requests per second
- Error rate
- P95/P99 latency
- Origin errors

## Troubleshooting

### Function Returns 404

- Check file path matches route
- Verify correct TypeScript syntax
- Rebuild: `npm run build`

### CORS Errors

- Functions include CORS headers
- Ensure preflight OPTIONS is handled
- Check browser console for error details

### Timeout Errors (504)

- Increase timeout in function
- Check external API health
- Implement retry logic

### Quote Stale Error

- Request new quote
- Quote valid for ~30 seconds
- Use lower slippage for volatile tokens

## Migration from Express

Old setup:

```
Express Server (port 3000)
    → /api/jupiter/quote
    → /api/wallet/balance
    → etc.
```

New setup:

```
Cloudflare Pages (serverless)
    → /api/jupiter/quote (functions/api/jupiter/quote.ts)
    → /api/wallet/balance (functions/api/wallet/balance.ts)
    → etc.
```

**No client code changes required!** Same API URLs, serverless backend.

## Next Steps

1. Deploy to Cloudflare Pages: `npm run deploy:cloudflare`
2. Monitor real-time logs: `wrangler tail`
3. Review analytics in dashboard
4. Scale horizontally (automatic)
5. Add caching (KV store) if needed

See `CLOUDFLARE_PAGES_DEPLOYMENT.md` for deployment instructions.
