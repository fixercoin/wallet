# Cloudflare Worker Swap System Migration

This guide explains how to migrate the server-side swap system from Express to Cloudflare Workers.

## Overview

The swap system has been successfully implemented and tested on the Express server. This guide will help you migrate the proven implementation to Cloudflare Workers for better scalability and performance.

## Current Implementation (Express)

The Express server has:

- ✅ Quote endpoint (`GET /api/swap/quote`) with fallback chain (Jupiter → Meteora → Bridged)
- ✅ Execute endpoint (`POST /api/swap/execute`) for building unsigned transactions
- ✅ Transaction handlers (`/api/solana-send`, `/api/solana-simulate`) for RPC calls
- ✅ Comprehensive error handling and logging
- ✅ Rate limiting recovery with exponential backoff

**Files:**

- `server/routes/swap-v2.ts` - Main swap quote & execute handlers
- `server/routes/solana-transaction.ts` - Transaction send/simulate handlers
- `server/index.ts` - Server setup and route registration

## Cloudflare Implementation

The Cloudflare version is being prepared in:

- `cloudflare/src/swap-handlers.ts` - New swap quote & execute handlers for Cloudflare
- `cloudflare/src/worker.ts` - Main worker file (needs integration)

## Migration Steps

### Step 1: Integrate Swap Handlers into Cloudflare Worker

Update `cloudflare/src/worker.ts` to import and use the new handlers:

```typescript
import { handleSwapQuote, handleSwapExecute } from "./swap-handlers";

// In the fetch handler, add these routes BEFORE the catch-all:

// GET /api/swap/quote - Unified quote with fallback chain
if (pathname === "/api/swap/quote" && req.method === "GET") {
  return await handleSwapQuote(req, corsHeaders);
}

// POST /api/swap/execute - Build unsigned swap transaction
if (pathname === "/api/swap/execute" && req.method === "POST") {
  return await handleSwapExecute(req, corsHeaders);
}
```

### Step 2: Add RPC Handler for Solana Transactions

Since Cloudflare Workers don't support arbitrary RPC calls the same way, create transaction handlers:

```typescript
// POST /api/solana-send
if (pathname === "/api/solana-send" && req.method === "POST") {
  try {
    const body = await parseJSON(req);
    const { signedBase64 } = body;

    if (!signedBase64 || typeof signedBase64 !== "string") {
      return json(
        { error: "Missing required field: signedBase64" },
        { status: 400, headers: corsHeaders },
      );
    }

    // Call Solana RPC to send transaction
    const rpcUrl = env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";
    const rpcResult = await callRpc(env, "sendTransaction", [
      signedBase64,
      { skipPreflight: false, preflightCommitment: "processed" },
    ]);

    return json(
      { success: true, result: rpcResult, signature: rpcResult },
      { headers: corsHeaders },
    );
  } catch (e: any) {
    return json(
      { error: "Failed to send transaction", details: e?.message },
      { status: 500, headers: corsHeaders },
    );
  }
}

// POST /api/solana-simulate
if (pathname === "/api/solana-simulate" && req.method === "POST") {
  try {
    const body = await parseJSON(req);
    const { signedBase64 } = body;

    if (!signedBase64) {
      return json(
        { error: "Missing required field: signedBase64" },
        { status: 400, headers: corsHeaders },
      );
    }

    const rpcResult = await callRpc(env, "simulateTransaction", [
      signedBase64,
      { signers: [], commitment: "processed" },
    ]);

    return json(
      {
        success: true,
        result: rpcResult,
        unitsConsumed: rpcResult?.unitsConsumed || 0,
        logs: rpcResult?.logs || [],
      },
      { headers: corsHeaders },
    );
  } catch (e: any) {
    return json(
      { error: "Failed to simulate transaction", details: e?.message },
      { status: 500, headers: corsHeaders },
    );
  }
}
```

### Step 3: Configure Environment Variables

Set these variables in your Cloudflare Workers environment:

```bash
# wrangler.toml
[env.production]
vars = { SOLANA_RPC = "https://api.mainnet-beta.solana.com" }
```

Or via Cloudflare Dashboard:

- Settings → Variables → Environment Variables
- Add `SOLANA_RPC` = your RPC endpoint URL

### Step 4: Deploy to Cloudflare

```bash
# Test locally
wrangler dev

# Deploy to production
wrangler deploy
```

### Step 5: Update Client Configuration (Optional)

If your client points to a specific API base URL, update it to use your Cloudflare Worker URL:

```typescript
// In client/lib/api-client.ts or similar
const API_BASE = "https://your-worker.your-domain.workers.dev";
```

Or if you're using the proxy feature:

```bash
# In vite.config.mjs, the proxy will automatically route /api calls
```

## Key Differences: Express vs Cloudflare

| Aspect               | Express                       | Cloudflare                             |
| -------------------- | ----------------------------- | -------------------------------------- |
| **RPC Calls**        | Direct fetch to RPC endpoints | Via `callRpc()` helper with KV caching |
| **Rate Limiting**    | In-memory Map tracking        | KV storage for persistence             |
| **Logging**          | console.log                   | console.log (Cloudflare Logs)          |
| **Timeouts**         | Node.js AbortController       | Cloudflare request timeout             |
| **External Fetches** | Node.js fetch                 | Web APIs fetch                         |
| **File System**      | Node.js fs module             | Cloudflare R2 (if needed)              |

## API Compatibility

Both implementations expose identical API endpoints:

### Quote Endpoint

```
GET /api/swap/quote?inputMint=...&outputMint=...&amount=...&slippageBps=50
```

**Response:**

```json
{
  "quote": { ... },
  "source": "jupiter|meteora|bridged",
  "inputMint": "...",
  "outputMint": "...",
  "amount": "...",
  "attempts": [{ "provider": "...", "status": "success|failed" }]
}
```

### Execute Endpoint

```
POST /api/swap/execute
Content-Type: application/json

{
  "quoteResponse": { ... from /api/swap/quote },
  "userPublicKey": "..."
}
```

**Response:**

```json
{
  "swapTransaction": "base64-encoded-transaction",
  "lastValidBlockHeight": 12345678
}
```

### Send Transaction Endpoint

```
POST /api/solana-send
Content-Type: application/json

{
  "signedBase64": "base64-encoded-signed-transaction"
}
```

**Response:**

```json
{
  "success": true,
  "result": "tx-signature"
}
```

## Testing the Migration

### 1. Test Quote Endpoint

```bash
curl "https://your-worker.workers.dev/api/swap/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000"
```

Expected: Quote from Jupiter, Meteora, or bridged route

### 2. Test Execute Endpoint

```bash
curl -X POST https://your-worker.workers.dev/api/swap/execute \
  -H "Content-Type: application/json" \
  -d '{
    "quoteResponse": { ... quote from step 1 ... },
    "userPublicKey": "YourWalletAddress"
  }'
```

Expected: Unsigned swap transaction in base64

### 3. Test Send Endpoint

```bash
curl -X POST https://your-worker.workers.dev/api/solana-send \
  -H "Content-Type: application/json" \
  -d '{ "signedBase64": "..." }'
```

Expected: Transaction signature

## Monitoring & Debugging

### Cloudflare Logs

View logs in real-time:

```bash
wrangler tail
```

### Metrics to Monitor

- Quote response times
- Success rate of fallback chain
- RPC endpoint performance
- Transaction send/simulate success rates

### Common Issues

**Issue: "All RPC endpoints failed"**

- Check SOLANA_RPC environment variable is set
- Verify RPC endpoint is accessible
- Check rate limiting on your RPC provider

**Issue: "No swap route found"**

- Normal for illiquid token pairs
- Check both tokens exist and have liquidity
- Try intermediate token pair (SOL → USDC → Token)

**Issue: "Invalid response from swap API"**

- Jupiter API format changed (unlikely)
- May need to update fallback endpoint URLs

## Performance Considerations

1. **Cold Starts**: Cloudflare Workers have minimal cold start times
2. **Caching**: Consider caching quotes for 10-30 seconds to reduce external API calls
3. **Rate Limits**: Jupiter & Meteora have rate limits; implement KV-backed rate limiting
4. **Timeout**: Cloudflare has a 30-second timeout; our 20s timeout leaves buffer

## Future Enhancements

1. **KV Caching**: Cache quotes to reduce external API calls

   ```typescript
   const cached = await env.SWAP_CACHE.get(`quote:${inputMint}:${outputMint}`);
   ```

2. **Durable Objects**: Maintain state for complex swap workflows

3. **Analytics**: Track swap success rates, popular pairs, average slippage

4. **Advanced Routing**: Implement A\* or dynamic programming for better multi-leg routes

## Rollback Plan

If issues occur after migration:

1. **Keep Express Running**: Don't shut down Express server immediately
2. **DNS Switch**: Point API calls back to Express
   ```
   api.example.com → Express (original)
   worker.example.com → Cloudflare (new)
   ```
3. **Gradual Rollout**: Route 10% → 50% → 100% of traffic to Cloudflare

## References

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Solana RPC Specification](https://docs.solana.com/api)
- [Jupiter Swap API](https://station.jup.ag/docs/apis/swap-api)
- [Meteora Swap API](https://api.meteora.ag/)

## Support

For issues during migration:

1. Check server logs: `wrangler tail`
2. Test individual endpoints with curl
3. Compare responses with Express implementation
4. Check Cloudflare status page for outages
