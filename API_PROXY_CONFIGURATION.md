# Frontend API Proxy Configuration

## Overview

The Fixorium Wallet frontend has been configured to route **ALL** API calls through a single base URL (`https://wallet.fixorium.com.pk/api`). The Cloudflare Worker proxy internally handles connections to all external services including Solana RPC, Pump.fun, Dexscreener, Jupiter, and other blockchain data providers.

This architecture ensures:

- ✅ No direct external API calls from the frontend
- ✅ Centralized request handling and authentication
- ✅ Protection against regional blocking and CORS issues
- ✅ Single point for rate limiting and caching

## Environment Configuration

### VITE_API_BASE_URL

**Location**: `.env` file in the project root

**Value**: `https://wallet.fixorium.com.pk/api`

**Purpose**: All frontend API requests are resolved through this base URL via the `resolveApiUrl()` utility function in `client/lib/api-client.ts`.

```bash
# Set in .env
VITE_API_BASE_URL=https://wallet.fixorium.com.pk/api
```

## Frontend API Endpoints

All frontend fetch requests use relative paths that get resolved through the VITE_API_BASE_URL. The Cloudflare Worker proxy handles the actual external service calls.

### Wallet & Balance Endpoints

```
GET  /api/wallet/balance?publicKey={address}
POST /api/solana-rpc                           # JSON-RPC calls
POST /api/rpc                                  # Alternative RPC endpoint
```

**Used by**:

- `client/lib/wallet-proxy.ts`
- `client/lib/services/solana-rpc.ts`
- `client/components/wallet/Dashboard.tsx`

---

### Jupiter Swap Endpoints

```
GET  /api/jupiter/quote?inputMint={mint}&outputMint={mint}&amount={amount}&slippageBps={bps}
POST /api/jupiter/swap                         # Body: JupiterSwapRequest
GET  /api/jupiter/price?ids={mint}             # Get token prices
GET  /api/jupiter/tokens?type=strict|all       # Get token lists
```

**Used by**:

- `client/lib/services/jupiter.ts`
- `client/components/ui/SwapInterface.tsx`
- `client/components/wallet/SwapInterface.tsx`

**Note**: Jupiter hardcoded URLs are no longer used; all calls route through the proxy.

---

### Pump.fun Swap Endpoints

```
GET  /api/pumpfun/quote?inputMint={mint}&outputMint={mint}&amount={amount}
POST /api/pumpfun/quote                        # Health check (POST with JSON body)
POST /api/pumpfun/trade                        # Execute swap
GET  /api/pumpfun/pool?base={mint}&quote={mint}
```

**Used by**:

- `client/lib/services/pumpswap.ts`
- `client/components/wallet/Dashboard.tsx` (health check)

**Health Check Usage**:

```javascript
// Instead of /api/ping (which doesn't exist), use:
const res = await fetch("/api/pumpfun/quote", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    amount: 1000000,
  }),
});
```

---

### DexScreener Endpoints

```
GET /api/dexscreener/tokens?mints={mint1},{mint2}...
GET /api/dexscreener/search?q={query}
GET /api/dexscreener/trending
```

**Used by**:

- `client/lib/services/dexscreener.ts`
- `client/pages/buy-now.tsx`
- `client/pages/BuyCrypto.tsx`

**Note**: Direct DexScreener API calls have been removed; all requests go through proxy.

---

### Price & Exchange Rate Endpoints

```
GET /api/sol/price                             # SOL price data
GET /api/exchange-rate?token={symbol}          # Exchange rates
GET /api/token/price?symbol={symbol}           # Token prices
```

**Used by**:

- `client/lib/services/sol-price.ts`
- `client/pages/buy-now.tsx`
- `client/pages/sell-now.tsx`

---

### P2P & Trading Endpoints

```
GET  /api/p2p/orders?roomId={roomId}
GET  /api/p2p/orders/{orderId}
POST /api/p2p/orders                           # Create order
PUT  /api/p2p/orders/{orderId}                 # Update order
DELETE /api/p2p/orders/{orderId}               # Cancel order

GET  /api/p2p/rooms?limit={limit}&offset={offset}
GET  /api/p2p/rooms/{roomId}
POST /api/p2p/rooms                            # Create room
PUT  /api/p2p/rooms/{roomId}                   # Update room

POST /api/p2p/rooms/{roomId}/messages          # Send message
GET  /api/p2p/rooms/{roomId}/messages
```

**Used by**:

- `client/lib/p2p.ts`
- `client/lib/p2p-api.ts`
- `client/hooks/useDurableRoom.ts`

---

### Additional Endpoints

```
GET  /api/forex/rate?base=USD&symbols=PKR
GET  /api/stable-24h?symbols=USDC,USDT,...
GET  /ws/{roomId}                              # WebSocket for P2P rooms
POST /api/reward-locker                        # Token locking rewards
```

---

## Service Files Updated

The following service files have been updated to use proxy endpoints:

### ✅ Updated Services

1. **client/lib/services/jupiter.ts**
   - Removed fallback to direct Jupiter API
   - All calls route through `/api/jupiter/*` proxy

2. **client/lib/services/pumpswap.ts**
   - Replaced direct Shyft API calls with `/api/pumpfun/*` proxy
   - Updated `getPoolForPair()` to use proxy endpoint

3. **client/lib/services/helius.ts**
   - Updated `baseUrl` from Helius direct URL to `/api/rpc` proxy
   - All RPC calls now route through proxy

4. **client/lib/services/sol-price.ts**
   - Replaced direct CoinGecko API call with `/api/sol/price` proxy

5. **client/components/wallet/Dashboard.tsx**
   - Updated health check from `/health` to `/api/pumpfun/quote` (POST with body)

### ✅ No Changes Needed

- `client/lib/services/dexscreener.ts` - Already using proxy
- All other component fetch calls - Already routing through `/api/*`

---

## API Client Utility

The `client/lib/api-client.ts` module provides the utility function for resolving API URLs:

```typescript
import { resolveApiUrl, getApiBaseUrl } from "@/lib/api-client";

// Get the base URL
const base = getApiBaseUrl(); // Returns: https://wallet.fixorium.com.pk/api

// Resolve a path to full URL
const fullUrl = resolveApiUrl("/api/jupiter/quote?inputMint=...");
// Returns: https://wallet.fixorium.com.pk/api/api/jupiter/quote?inputMint=...
// (Note: path already includes /api prefix)

// Or use it with relative paths
const fullUrl = resolveApiUrl("jupiter/quote?inputMint=...");
// Returns: https://wallet.fixorium.com.pk/api/jupiter/quote?inputMint=...
```

---

## Important Notes

### ❌ Do NOT Call These External APIs Directly

The frontend should **NEVER** make direct calls to:

- `https://api.shyft.to` - Shyft API
- `https://mainnet.helius-rpc.com` - Helius RPC
- `https://lite-api.jup.ag` - Jupiter API
- `https://api.dexscreener.com` or `.io` - DexScreener API
- `https://api.dextools.io` - DexTools API
- `https://pro-api.coinmarketcap.com` - CoinMarketCap API
- `https://api.coingecko.com` - CoinGecko API
- `https://api.mainnet-beta.solana.com` - Public Solana RPC
- Any other public RPC endpoints (Ankr, Shyft, etc.)

All these calls must go through the Cloudflare Worker proxy at `https://wallet.fixorium.com.pk/api`.

### ✅ Request Method Requirements

- **GET requests**: Used for read-only operations (quotes, prices, data lookup)
- **POST requests**: Used for state-changing operations (trades, swaps, messages)
  - **IMPORTANT**: Do NOT include request bodies in GET requests
  - Health checks should use POST with a valid JSON body (e.g., `/api/pumpfun/quote`)

### Example: Correct vs Incorrect

**❌ INCORRECT - Direct External Call**

```javascript
const res = await fetch(
  "https://api.dexscreener.com/latest/dex/tokens/EPjFWaLb3iNxoeiKCBL7E3em9nYvRyBjBP9v4G29jkn6",
);
```

**✅ CORRECT - Through Proxy**

```javascript
const res = await fetch(
  "/api/dexscreener/tokens?mints=EPjFWaLb3iNxoeiKCBL7E3em9nYvRyBjBP9v4G29jkn6",
);
```

---

## Deployment Checklist

- [x] VITE_API_BASE_URL configured in `.env`
- [x] All service files updated to use proxy endpoints
- [x] No fallback to direct external APIs
- [x] Health checks use `/api/pumpfun/quote` with POST body
- [x] No direct RPC calls from frontend
- [x] Frontend only calls `/api/*` endpoints

---

## Troubleshooting

### "404 Not Found" on API Calls

**Cause**: Endpoint path is incorrect or not implemented on the Cloudflare Worker.

**Solution**:

1. Verify the endpoint path matches the proxy route
2. Check Cloudflare Worker logs
3. Ensure POST requests use correct headers: `"Content-Type": "application/json"`

### "CORS Error" or "Request Blocked"

**Cause**: Frontend is trying to call an external API directly (not through proxy).

**Solution**: Use the correct `/api/*` proxy endpoint instead.

### Health Check Fails

**Cause**: Using `/api/ping` or `/health` (these don't exist).

**Solution**: Use `/api/pumpfun/quote` with POST method and valid JSON body.

---

## Additional Resources

- `client/lib/api-client.ts` - API URL resolution utility
- `client/lib/wallet.ts` - Wallet data structures
- Cloudflare Worker configuration - See `cloudflare/src/worker.ts`
