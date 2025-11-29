# Frontend RPC Migration Guide

## Overview

The frontend now makes **direct calls to public Solana RPC endpoints** instead of proxying through a backend worker. This eliminates the need for:

- Cloudflare Workers for RPC proxying
- Backend API infrastructure
- Environment variables pointing to worker domains

## What Changed

### Before (Worker-based)

```typescript
// Old approach - calls /api/solana-rpc endpoint
const response = await fetch("/api/solana-rpc", {
  method: "POST",
  body: JSON.stringify({ method: "getBalance", params: [publicKey] }),
});
```

### After (Direct RPC)

```typescript
// New approach - calls public RPC endpoints directly
import { solanaRpc } from "@/lib/rpc-utils";

const balance = await solanaRpc.getBalance(publicKey);
```

## Public RPC Endpoints

The frontend now uses these public endpoints with automatic fallback:

1. **Solana Public Node** (Primary)
   - `https://solana.publicnode.com`
   - Free tier, reliable

2. **Ankr RPC** (Fallback)
   - `https://rpc.ankr.com/solana`
   - Free tier, good uptime

3. **Solana API** (Final fallback)
   - `https://api.mainnet-beta.solana.com`
   - Official, rate-limited but reliable

If `SOLANA_RPC_URL` environment variable is set, it will be tried first.

## Using the RPC Utilities

### Option 1: Type-Safe Method (Recommended)

```typescript
import { solanaRpc } from "@/lib/rpc-utils";

// Get balance
const balance = await solanaRpc.getBalance(publicKey);

// Get token accounts
const tokens = await solanaRpc.getTokenAccountsByOwner(publicKey);

// Get transaction
const tx = await solanaRpc.getTransaction(signature);

// Send transaction
const txId = await solanaRpc.sendTransaction(encodedTx);
```

### Option 2: Generic RPC Call

```typescript
import { rpcCall } from "@/lib/rpc-utils";

const result = await rpcCall("getBalance", [publicKey]);
const tokens = await rpcCall("getTokenAccountsByOwner", [
  publicKey,
  { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
  { encoding: "jsonParsed", commitment: "confirmed" },
]);
```

### Option 3: JSON-RPC Payload

```typescript
import { rpcPayload } from "@/lib/rpc-utils";

const response = await rpcPayload({
  method: "getBalance",
  params: [publicKey],
  id: 1,
});
```

## Migrating Existing Code

### Components using fetch directly

**Before:**

```typescript
const resp = await fetch("/api/solana-rpc", {
  method: "POST",
  body: JSON.stringify({
    method: "getBalance",
    params: [publicKey],
  }),
});
const result = await resp.json();
```

**After:**

```typescript
import { rpcCall } from "@/lib/rpc-utils";

const result = await rpcCall("getBalance", [publicKey]);
```

### Files that need updating

The following files still have direct `/api/solana-rpc` calls and should be updated:

- `client/components/wallet/AutoBot.tsx`
- `client/components/wallet/TokenLock.tsx`
- `client/components/wallet/SendTransaction.tsx`
- `client/components/wallet/SwapInterface.tsx`
- `client/components/wallet/BurnToken.tsx`
- `client/components/wallet/Airdrop.tsx`
- And similar files in `client/components/ui/`

### Migration template

```typescript
// Step 1: Import the RPC utility
import { solanaRpc, rpcCall } from "@/lib/rpc-utils";

// Step 2: Replace fetch calls
// OLD:
// const resp = await fetch("/api/solana-rpc", { ... })
// const result = await resp.json();

// NEW:
const result = await rpcCall("methodName", [param1, param2]);
// Or use the typed version:
const balance = await solanaRpc.getBalance(publicKey);

// Step 3: Remove error handling for HTTP status codes
// (rpcCall throws on actual errors, just handle the promise rejection)
```

## Benefits

✅ **No Backend Required** - Eliminates need for worker deployment  
✅ **Automatic Failover** - Uses multiple public RPC endpoints  
✅ **Lower Latency** - Direct calls instead of proxying through worker  
✅ **Cost Savings** - No worker compute costs  
✅ **Simplified Deployment** - Deploy only frontend

## Available RPC Methods

The `solanaRpc` utility exposes these pre-configured methods:

- `getBalance(publicKey)` - Get SOL balance
- `getTokenAccountsByOwner(publicKey, options)` - Get token accounts
- `getSignaturesForAddress(publicKey, limit)` - Get transaction history
- `getTransaction(signature, commitment)` - Get transaction details
- `sendTransaction(encodedTx)` - Broadcast transaction
- `simulateTransaction(encodedTx, signers)` - Test transaction
- `getAccountInfo(publicKey)` - Get account data
- `getMultipleAccounts(publicKeys)` - Get multiple accounts
- `getTokenSupply(mint)` - Get token info
- `getRecentBlockhash()` - Get latest blockhash

For other RPC methods, use `rpcCall(method, params)`.

## Rate Limiting

The public RPC endpoints have rate limits:

- Solana Public Node: ~100 requests/second
- Ankr: ~200 requests/second
- Solana API: Lower rate limit

If you hit rate limits frequently:

1. Set `SOLANA_RPC_URL` to a private RPC endpoint (Helius, Alchemy, etc.)
2. Implement request caching/batching
3. Use the `Connection` class from `@solana/web3.js` for local batching

## Testing

To test the RPC calls in your browser console:

```javascript
// Import dynamically in console
const { solanaRpc } = await import(
  "http://localhost:5173/src/lib/rpc-utils.ts"
);

// Test a call
const balance = await solanaRpc.getBalance("YourPublicKeyHere");
console.log(balance);
```

## Troubleshooting

### CORS Errors

Public RPC endpoints allow CORS from all origins, so CORS errors shouldn't occur.

### Timeout Errors

If you see timeout errors:

1. Check your internet connection
2. Try a different RPC endpoint
3. Ensure `SOLANA_RPC_URL` is not set to a broken endpoint

### Rate Limit Errors (429)

The system automatically retries with backoff. If persistent:

1. Use a private RPC endpoint (set `SOLANA_RPC_URL`)
2. Reduce request frequency
3. Implement client-side caching

## Environment Variables

No worker-specific variables needed. Optional:

```env
# Use a custom RPC endpoint (tried first, before public endpoints)
SOLANA_RPC_URL=https://api.yourprovider.com

# For deployment, this points to frontend only (no worker)
VITE_API_BASE_URL=
```

## Related Files

- `client/lib/rpc-utils.ts` - Main RPC utility wrapper
- `client/lib/services/solana-rpc.ts` - Core RPC implementation
- `client/lib/services/helius.ts` - Helius-specific features
- `client/api.ts` - API wrapper functions
- `wrangler.toml` - Worker config (no longer needed)
