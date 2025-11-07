# Cloudflare Deployment Checklist

## Pre-Deployment ✅

- [x] Fixed all API endpoints for proper error handling
- [x] Updated `/api/health` endpoint to return JSON
- [x] Fixed `/api/solana-rpc` endpoint with proper JSON validation
- [x] Fixed `/api/wallet/balance` parameter handling
- [x] Improved `/api/pumpfun/quote` timeout handling (15s)
- [x] Added error handling to DexScreener endpoints
- [x] Updated Cloudflare wrangler.toml with environment variables
- [x] Created deployment configuration documentation

## Environment Variables Setup

Create `cloudflare/.env.production.vars`:

```
SOLANA_RPC=https://rpc.shyft.to?api_key=3hAwrhOAmJG82eC7
HELIUS_API_KEY=
BIRDEYE_API_KEY=cecae2ad38d7461eaf382f533726d9bb
PUMPFUN_QUOTE=https://pumpportal.fun/api/quote
PUMPFUN_API_BASE=https://pump.fun/api
DEXSCREENER_BASE=https://api.dexscreener.com/latest/dex
BACKEND_URL=https://wallet.fixorium.com.pk
```

## API Endpoints Status

### ✅ Core Endpoints (Fixed & Working)

- `GET /health` → JSON response ✅
- `GET /api/health` → JSON response ✅
- `POST /api/solana-rpc` → JSON-RPC proxy ✅
- `GET /api/wallet/balance` → All parameter aliases supported ✅

### ✅ Price & Market Data

- `GET /api/sol/price` → SOL price ✅
- `GET /api/token/price` → Token price lookup ✅
- `GET /api/exchange-rate` → Exchange rates ✅
- `GET /api/birdeye/price` → Birdeye integration ✅
- `GET /api/dexscreener/price` → DexScreener integration ✅

### ✅ Swap & Trading

- `GET /api/quote` → Jupiter unified quote ✅
- `GET /api/swap/quote` → Swap quote v2 ✅
- `POST /api/swap/execute` → Execute swap ✅
- `GET /api/pumpfun/quote` → Pump.fun quote (15s timeout) ✅
- `POST /api/pumpfun/buy` → Buy pump.fun tokens ✅
- `POST /api/pumpfun/sell` → Sell pump.fun tokens ✅

### ✅ Data Management

- `GET /api/orders` → Order listing ✅
- `POST /api/orders` → Create order ✅
- `GET /api/p2p/rooms` → P2P rooms ✅
- `POST /api/p2p/rooms` → Create P2P room ✅

## Deployment Steps

### 1. Verify Local Functionality

```bash
# Test health endpoint
curl http://localhost:5173/health
curl http://localhost:5173/api/health

# Test key endpoints
curl "http://localhost:5173/api/wallet/balance?walletAddress=11111111111111111111111111111111"
curl "http://localhost:5173/api/token/price?token=FIXERCOIN"
curl "http://localhost:5173/api/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000"
```

### 2. Deploy to Cloudflare

```bash
cd cloudflare
# Install dependencies
npm install

# Deploy to production
npx wrangler deploy --env production

# Or deploy to staging first
npx wrangler deploy
```

### 3. Set Environment Variables in Cloudflare Dashboard

1. Go to Cloudflare Workers dashboard
2. Select the deployed worker
3. Go to Settings > Environment Variables
4. Add production environment variables from `.env.production.vars`
5. Redeploy after setting variables

### 4. Post-Deployment Testing

```bash
# Test health endpoints
curl https://wallet.fixorium.com.pk/health
curl https://wallet.fixorium.com.pk/api/health

# Test Solana RPC
curl -X POST https://wallet.fixorium.com.pk/api/solana-rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["11111111111111111111111111111111"]}'

# Test wallet balance
curl "https://wallet.fixorium.com.pk/api/wallet/balance?walletAddress=11111111111111111111111111111111"

# Test token price
curl "https://wallet.fixorium.com.pk/api/token/price?token=SOL"

# Test exchange rate
curl "https://wallet.fixorium.com.pk/api/exchange-rate"

# Test swap quote
curl "https://wallet.fixorium.com.pk/api/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000"

# Test orders
curl "https://wallet.fixorium.com.pk/api/orders"

# Test P2P rooms
curl "https://wallet.fixorium.com.pk/api/p2p/rooms"
```

## Key Fixes Applied

### 1. `/health` Endpoint

- **Before**: Returned HTML
- **After**: Returns JSON with status, timestamp, environment, uptime

### 2. `/api/solana-rpc` Endpoint

- **Before**: Parse error for JSON requests
- **After**: Proper JSON validation and error handling with clear error messages

### 3. `/api/wallet/balance` Endpoint

- **Before**: Only supported `publicKey` parameter
- **After**: Supports `publicKey`, `wallet`, `address`, and `walletAddress`

### 4. Timeout Management

- **Before**: Inconsistent timeout handling
- **After**:
  - Solana RPC: 30 seconds
  - Pump.fun: 15 seconds
  - Other APIs: 10-15 seconds

### 5. Error Handling

- **Before**: Generic error messages
- **After**: Specific error messages with examples and documentation

## Monitoring & Logs

### View Cloudflare Worker Logs

```bash
npx wrangler tail --env production
```

### Key Metrics to Monitor

- RPC endpoint availability
- API response times
- Error rates by endpoint
- Timeout occurrences
- Rate limiting from external APIs

## Troubleshooting

### If Endpoints Return 502 After Deployment

1. **Check RPC Connectivity**
   - Verify `SOLANA_RPC` environment variable is set
   - Test public RPC endpoints are accessible
   - Check if rate limits are being hit

2. **Check Backend Service**
   - Verify backend services are running
   - Check network connectivity from Cloudflare to backend

3. **Review Logs**
   ```bash
   npx wrangler tail --env production
   ```

### If Endpoints Return 504 (Timeout)

1. **Check External API Status**
   - Verify Jupiter, DexScreener, Pump.fun APIs are operational
   - Check response times from external services

2. **Increase Timeout (if needed)**
   - Edit `cloudflare/src/worker.ts`
   - Adjust timeout values in fetch calls
   - Redeploy

### If JSON Parse Error Occurs

1. **Check Request Format**
   - Verify Content-Type header is `application/json`
   - Validate JSON body structure
   - Check required fields are present

2. **Check Logs**
   - Review request body in Cloudflare logs
   - Verify JSON structure is valid

## Success Criteria

All of the following endpoints should return 200 status code:

- [ ] GET `/health`
- [ ] GET `/api/health`
- [ ] POST `/api/solana-rpc` (with valid JSON-RPC)
- [ ] GET `/api/wallet/balance` (with wallet address)
- [ ] GET `/api/token/price` (with token param)
- [ ] GET `/api/sol/price`
- [ ] GET `/api/exchange-rate`
- [ ] GET `/api/quote` (with swap params)
- [ ] GET `/api/orders`
- [ ] GET `/api/p2p/rooms`

All endpoints should return proper JSON responses with appropriate error messages on failure.

## Rollback Plan

If issues occur after deployment:

1. **Keep Previous Version**

   ```bash
   # Tag current version
   git tag cloudflare-v1
   git push origin cloudflare-v1
   ```

2. **Revert if Necessary**

   ```bash
   # Deploy previous version
   npx wrangler deploy --env production
   ```

3. **Check What Changed**
   ```bash
   git diff HEAD~1
   ```

## Support & Documentation

- **API Documentation**: See `API_ENDPOINT_FIXES.md`
- **Cloudflare Docs**: https://developers.cloudflare.com/workers/
- **Wrangler CLI**: https://developers.cloudflare.com/workers/wrangler/install-and-update/
