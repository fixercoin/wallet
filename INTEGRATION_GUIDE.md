# Frontend Integration Guide

This guide shows how to integrate the Cloudflare Worker APIs into your React frontend application.

## Configuration

### 1. Set API Base URL

In your `.env.local` or environment variables, set:

```
VITE_API_BASE_URL=https://proxy.fixorium.com.pk
```

Or for development:

```
VITE_API_BASE_URL=/api
```

### 2. Create API Client

Create `client/lib/wallet-api.ts`:

```typescript
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export const walletApi = {
  // Get wallet balance for all tokens
  async getBalance(walletAddress: string) {
    const response = await fetch(
      `${API_BASE}/wallet/balance?wallet=${encodeURIComponent(walletAddress)}`,
    );
    if (!response.ok) throw new Error("Failed to fetch balance");
    return response.json();
  },

  // Get token price from DexScreener
  async getTokenPrice(tokenAddress: string) {
    const response = await fetch(
      `${API_BASE}/dexscreener/price?token=${encodeURIComponent(tokenAddress)}`,
    );
    if (!response.ok) throw new Error("Failed to fetch price");
    return response.json();
  },

  // Get Pump.fun swap quote
  async getSwapQuote(mint: string) {
    const response = await fetch(
      `${API_BASE}/swap/quote?mint=${encodeURIComponent(mint)}`,
    );
    if (!response.ok) throw new Error("Failed to fetch swap quote");
    return response.json();
  },

  // Execute Pump.fun swap
  async executeSwap(params: {
    mint: string;
    amount: number;
    decimals?: number;
    slippage?: number;
    txVersion?: string;
    priorityFee?: number;
    wallet?: string;
  }) {
    const response = await fetch(`${API_BASE}/swap/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decimals: 6,
        slippage: 10,
        txVersion: "V0",
        priorityFee: 0.0005,
        ...params,
      }),
    });
    if (!response.ok) throw new Error("Failed to execute swap");
    return response.json();
  },

  // Get Jupiter swap quote
  async getJupiterQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: string;
  }) {
    const url = new URL(`${API_BASE}/swap/jupiter/quote`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error("Failed to fetch Jupiter quote");
    return response.json();
  },

  // Execute RPC call
  async rpc(method: string, params: any[]) {
    const response = await fetch(`${API_BASE}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });
    if (!response.ok) throw new Error(`RPC call failed: ${method}`);
    return response.json();
  },

  // Get transaction details
  async getTransaction(signature: string) {
    const response = await fetch(
      `${API_BASE}/transaction?signature=${encodeURIComponent(signature)}`,
    );
    if (!response.ok) throw new Error("Failed to fetch transaction");
    return response.json();
  },

  // Get account info
  async getAccountInfo(publicKey: string) {
    const response = await fetch(
      `${API_BASE}/account?publicKey=${encodeURIComponent(publicKey)}`,
    );
    if (!response.ok) throw new Error("Failed to fetch account");
    return response.json();
  },

  // Health check
  async health() {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) throw new Error("Health check failed");
    return response.json();
  },
};
```

## Usage Examples

### 1. Display Wallet Balance

```typescript
import { useEffect, useState } from 'react';
import { walletApi } from '@/lib/wallet-api';

export function WalletBalance({ walletAddress }: { walletAddress: string }) {
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    walletApi
      .getBalance(walletAddress)
      .then((data) => setBalances(data.balances))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [walletAddress]);

  if (loading) return <div>Loading balances...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Wallet Balances</h2>
      {Object.entries(balances).map(([token, amount]) => (
        <div key={token}>
          {token}: {amount.toFixed(4)}
        </div>
      ))}
    </div>
  );
}
```

### 2. Display Token Price

```typescript
import { useEffect, useState } from 'react';
import { walletApi } from '@/lib/wallet-api';

export function TokenPrice({ tokenAddress }: { tokenAddress: string }) {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    walletApi
      .getTokenPrice(tokenAddress)
      .then((data) => {
        // Extract price from DexScreener response
        const pair = data.pair?.[0];
        if (pair?.priceUsd) {
          setPrice(parseFloat(pair.priceUsd));
        }
      })
      .finally(() => setLoading(false));
  }, [tokenAddress]);

  if (loading) return <span>Loading...</span>;
  if (!price) return <span>Price unavailable</span>;

  return <span>${price.toFixed(8)}</span>;
}
```

### 3. Swap Quote and Execution

```typescript
import { useEffect, useState } from 'react';
import { walletApi } from '@/lib/wallet-api';

export function SwapPanel({ tokenMint }: { tokenMint: string }) {
  const [quote, setQuote] = useState<any>(null);
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const handleGetQuote = async () => {
    setLoading(true);
    try {
      const quoteData = await walletApi.getSwapQuote(tokenMint);
      setQuote(quoteData);
    } catch (error) {
      console.error('Quote error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!amount) return;
    setLoading(true);
    try {
      const result = await walletApi.executeSwap({
        mint: tokenMint,
        amount: parseFloat(amount),
        decimals: 6,
        slippage: 10,
      });
      if (result.tx) {
        setTxSignature(result.tx);
        setAmount('');
      }
    } catch (error) {
      console.error('Swap error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>Swap Token</h3>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
      />
      <button onClick={handleGetQuote} disabled={loading}>
        Get Quote
      </button>
      {quote && <div>Quote: {JSON.stringify(quote)}</div>}
      <button onClick={handleSwap} disabled={loading || !amount}>
        Execute Swap
      </button>
      {txSignature && <div>Transaction: {txSignature}</div>}
    </div>
  );
}
```

### 4. Display Multiple Tokens with Prices

```typescript
import { useEffect, useState } from 'react';
import { walletApi } from '@/lib/wallet-api';

const TOKENS = [
  {
    symbol: 'USDC',
    address: 'EPjFWaLb3odcccccccccccccccccccccccccccccc',
  },
  {
    symbol: 'SOL',
    address: 'So11111111111111111111111111111111111111112',
  },
];

export function TokenPriceList() {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      const priceData: Record<string, number> = {};
      for (const token of TOKENS) {
        try {
          const data = await walletApi.getTokenPrice(token.address);
          const pair = data.pair?.[0];
          if (pair?.priceUsd) {
            priceData[token.symbol] = parseFloat(pair.priceUsd);
          }
        } catch (error) {
          console.error(`Error fetching price for ${token.symbol}:`, error);
        }
      }
      setPrices(priceData);
      setLoading(false);
    };

    fetchPrices();
  }, []);

  if (loading) return <div>Loading prices...</div>;

  return (
    <div>
      {TOKENS.map((token) => (
        <div key={token.symbol}>
          {token.symbol}: ${(prices[token.symbol] || 0).toFixed(2)}
        </div>
      ))}
    </div>
  );
}
```

## React Query Integration

For better state management, use React Query:

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { walletApi } from '@/lib/wallet-api';

// Hook for fetching balance
export function useWalletBalance(walletAddress: string) {
  return useQuery({
    queryKey: ['walletBalance', walletAddress],
    queryFn: () => walletApi.getBalance(walletAddress),
    enabled: !!walletAddress,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Hook for token price
export function useTokenPrice(tokenAddress: string) {
  return useQuery({
    queryKey: ['tokenPrice', tokenAddress],
    queryFn: () => walletApi.getTokenPrice(tokenAddress),
    enabled: !!tokenAddress,
    refetchInterval: 60000, // Refresh every minute
  });
}

// Hook for swap quote
export function useSwapQuote(tokenMint: string) {
  return useQuery({
    queryKey: ['swapQuote', tokenMint],
    queryFn: () => walletApi.getSwapQuote(tokenMint),
    enabled: !!tokenMint,
  });
}

// Hook for executing swap
export function useExecuteSwap() {
  return useMutation({
    mutationFn: (params: Parameters<typeof walletApi.executeSwap>[0]) =>
      walletApi.executeSwap(params),
  });
}

// Usage
function MyComponent({ walletAddress }: { walletAddress: string }) {
  const { data, isLoading, error } = useWalletBalance(walletAddress);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading balance</div>;

  return <div>Balances: {JSON.stringify(data?.balances)}</div>;
}
```

## Error Handling Best Practices

```typescript
import { walletApi } from "@/lib/wallet-api";

async function fetchWithErrorHandling(
  apiCall: () => Promise<any>,
  onError?: (error: Error) => void,
) {
  try {
    return await apiCall();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("API Error:", message);
    onError?.(error as Error);

    // Show user-friendly error message
    if (message.includes("Failed to fetch")) {
      return { error: "Network error. Please check your connection." };
    } else if (message.includes("429")) {
      return { error: "Too many requests. Please try again later." };
    } else if (message.includes("502")) {
      return { error: "Upstream service unavailable. Please try again." };
    }

    return { error: message };
  }
}

// Usage
const result = await fetchWithErrorHandling(
  () => walletApi.getBalance(walletAddress),
  (error) => {
    // Handle error - show toast, etc.
    console.log("Balance fetch failed:", error);
  },
);
```

## Deployment Notes

1. **Production Deployment:**
   - Update `VITE_API_BASE_URL` to `https://fixorium-proxy.khanbabusargodha.workers.dev`
   - Ensure CORS is configured correctly in Cloudflare Worker

2. **Local Development:**
   - Use `VITE_API_BASE_URL=/api` to proxy through Vite dev server
   - The dev server routes `/api/*` to Express backend

3. **Rate Limiting:**
   - Implement client-side rate limiting to avoid excessive API calls
   - Use React Query's `refetchInterval` wisely
   - Consider debouncing user inputs

## Testing the APIs

```bash
# Health check
curl https://fixorium-proxy.khanbabusargodha.workers.dev/api/health

# Get wallet balance
curl "https://fixorium-proxy.khanbabusargodha.workers.dev/api/wallet/balance?wallet=YourWalletAddress"

# Get token price
curl "https://fixorium-proxy.khanbabusargodha.workers.dev/api/dexscreener/price?token=EPjFWaLb3odcccccccccccccccccccccccccccccc"

# Get swap quote
curl "https://fixorium-proxy.khanbabusargodha.workers.dev/api/swap/quote?mint=TokenMintAddress"
```
