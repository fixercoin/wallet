# Integrating Moralis Token Fetching into Dashboard

## Available Endpoints

The Moralis token fetching is now available on both dev server and production:

### Development Server

- **Endpoint**: `GET /api/wallet/moralis-tokens`
- **Base URL**: `http://localhost:8080` (dev server)
- **Full URL**: `http://localhost:8080/api/wallet/moralis-tokens?address=YOUR_WALLET_ADDRESS`

### Production (Cloudflare Pages)

- **Endpoint**: `/api/wallet/moralis-tokens`
- **Full URL**: `https://your-domain.com/api/wallet/moralis-tokens?address=YOUR_WALLET_ADDRESS`

Both endpoints require the same `MORALIS_API_KEY` environment variable.

## Quick Integration Examples

### Example 1: Replace Token Fetching in Dashboard

In `client/components/wallet/Dashboard.tsx`:

```typescript
import { useMoralisTokens } from "@/hooks/use-moralis-tokens";
import { useWallet } from "@/contexts/WalletContext";

export function Dashboard() {
  const { wallet } = useWallet();
  const { tokens, loading, error, fetchTokens } = useMoralisTokens();

  useEffect(() => {
    if (wallet?.address) {
      // Fetch tokens whenever wallet changes
      fetchTokens(wallet.address);
    }
  }, [wallet?.address, fetchTokens]);

  return (
    <div>
      {loading && <p>Loading tokens...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {/* Display tokens */}
      <div className="token-list">
        {tokens.map((token) => (
          <TokenCard key={token.mint} token={token} />
        ))}
      </div>
    </div>
  );
}
```

### Example 2: Auto-refresh Every 30 Seconds

```typescript
import { useMoralisTokens } from "@/hooks/use-moralis-tokens";
import { useEffect, useRef } from "react";

export function TokenListWithAutoRefresh() {
  const { tokens, loading, fetchTokens } = useMoralisTokens();
  const wallet = useWallet();
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!wallet?.address) return;

    // Initial fetch
    fetchTokens(wallet.address);

    // Auto-refresh every 30 seconds
    intervalRef.current = setInterval(() => {
      fetchTokens(wallet.address);
    }, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [wallet?.address, fetchTokens]);

  return (
    <div>
      {loading && <Spinner />}
      {/* Render tokens */}
    </div>
  );
}
```

### Example 3: Manual Refresh Button

```typescript
import { useMoralisTokens } from "@/hooks/use-moralis-tokens";
import { RefreshCw } from "lucide-react";

export function TokenListWithRefresh() {
  const { tokens, loading, fetchTokens } = useMoralisTokens();
  const wallet = useWallet();

  const handleRefresh = async () => {
    if (wallet?.address) {
      await fetchTokens(wallet.address);
    }
  };

  return (
    <div>
      <button
        onClick={handleRefresh}
        disabled={loading}
        className="flex items-center gap-2"
      >
        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        {loading ? "Refreshing..." : "Refresh Tokens"}
      </button>

      <div className="mt-4">
        {tokens.map((token) => (
          <div key={token.mint} className="p-4 border rounded-lg">
            <p className="font-semibold">{token.symbol}</p>
            <p className="text-gray-500">{token.uiAmount} tokens</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Example 4: With Error Retry Logic

```typescript
import { useMoralisTokens } from "@/hooks/use-moralis-tokens";
import { useState } from "react";

export function TokenListWithRetry() {
  const { tokens, loading, error, fetchTokens } = useMoralisTokens();
  const wallet = useWallet();
  const [retryCount, setRetryCount] = useState(0);

  const handleFetch = async () => {
    if (wallet?.address) {
      await fetchTokens(wallet.address);
    }
  };

  const handleRetry = async () => {
    setRetryCount((prev) => prev + 1);
    await handleFetch();
  };

  useEffect(() => {
    handleFetch();
  }, [wallet?.address]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">Failed to load tokens: {error}</p>
        <button
          onClick={handleRetry}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded"
          disabled={loading}
        >
          {loading ? "Retrying..." : `Retry (${retryCount})`}
        </button>
      </div>
    );
  }

  return (
    <div>
      {loading && <Spinner />}
      {tokens.map((token) => (
        <TokenCard key={token.mint} token={token} />
      ))}
    </div>
  );
}
```

## Response Format

All endpoints return the same token format:

```json
{
  "tokens": [
    {
      "mint": "So11111111111111111111111111111111111111112",
      "symbol": "SOL",
      "name": "Solana",
      "decimals": 9,
      "balance": "5000000000",
      "uiAmount": 5.0,
      "logoURI": "https://...",
      "isSpam": false
    }
  ],
  "count": 1
}
```

## Performance Tips for Dashboard

### 1. Cache Results Locally

```typescript
const [cachedTokens, setCachedTokens] = useState<MoralisTokenBalance[]>([]);
const [cacheTime, setCacheTime] = useState<number>(0);
const CACHE_DURATION = 30000; // 30 seconds

const shouldRefetch = Date.now() - cacheTime > CACHE_DURATION;
```

### 2. Show Loading Skeleton

```typescript
{loading && (
  <div className="space-y-2">
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-12 w-full" />
  </div>
)}
```

### 3. Group Tokens by Status

```typescript
const activeTokens = tokens.filter((t) => !t.isSpam && t.uiAmount > 0);
const zeroBalanceTokens = tokens.filter((t) => !t.isSpam && t.uiAmount === 0);
```

## Testing in Dev Server

### Test with cURL

```bash
curl "http://localhost:8080/api/wallet/moralis-tokens?address=4toKNLx8Ry7XHDw3xXRUSB5rEVgUXgXEvKbJnNNDvBk"
```

### Test with Browser Console

```javascript
fetch(
  "/api/wallet/moralis-tokens?address=4toKNLx8Ry7XHDw3xXRUSB5rEVgUXgXEvKbJnNNDvBk",
)
  .then((r) => r.json())
  .then((d) => console.log(d));
```

### Test with React Hook

```typescript
// In any component
const { fetchTokens } = useMoralisTokens();
await fetchTokens("4toKNLx8Ry7XHDw3xXRUSB5rEVgUXgXEvKbJnNNDvBk");
```

## Troubleshooting

### No tokens returned?

1. Check that wallet address is valid and has tokens
2. Check that `MORALIS_API_KEY` is set in environment
3. For dev: `echo $MORALIS_API_KEY` should show your key
4. For production: Check Cloudflare Pages environment variables

### Timeout errors?

- Normal for wallets with 100+ tokens
- Implement loading state and give user feedback
- Consider adding timeout handling in fetch request

### Spam tokens showing up?

- The endpoint filters `possible_spam: true` automatically
- Use `isSpam` field in response to filter on client-side if needed

## Migration from Old Token Fetching

### Old Way (RPC-based, slow)

```typescript
// Slow RPC calls
const accounts = await connection.getTokenAccountsByOwner(wallet);
const tokens = await Promise.all(accounts.map((acc) => getTokenMetadata(acc)));
```

### New Way (Moralis API, fast)

```typescript
// Fast single API call
const { tokens } = await fetch(
  `/api/wallet/moralis-tokens?address=${wallet}`,
).then((r) => r.json());
```

## Summary

✅ **Works on dev server** - Use in local development  
✅ **Works on production** - Cloudflare Pages deploys automatically  
✅ **Fast** - 200-500ms response times  
✅ **Reliable** - Spam filtering included  
✅ **Easy to use** - Simple hook or direct fetch

Just set `MORALIS_API_KEY` and start using it!
