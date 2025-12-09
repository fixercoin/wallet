# Helius RPC Token Balances Guide

This guide explains how to fetch all token balances (including SOL) using the Helius RPC endpoint that has been integrated into both the dev server and Cloudflare Pages Functions.

## Setup

The Helius API key has been set in the environment variables:

```
HELIUS_API_KEY=aedd2b62-4cf6-4b84-b260-579fa67d1e8e
```

The endpoints will automatically use this key to connect to:

```
https://mainnet.helius-rpc.com/?api-key=aedd2b62-4cf6-4b84-b260-579fa67d1e8e
```

## Dev Server Endpoints

### 1. Get All Balances (Including SOL)

**Endpoint:** `GET /api/wallet/all-balances`

**Parameters:**

- `publicKey` (query param) - Solana wallet address
- OR `wallet` (query param) - Solana wallet address
- OR `address` (query param) - Solana wallet address

**Example Requests:**

```bash
# Using publicKey parameter
curl "http://localhost:3000/api/wallet/all-balances?publicKey=8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV"

# Using wallet parameter
curl "http://localhost:3000/api/wallet/all-balances?wallet=8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV"

# Using address parameter
curl "http://localhost:3000/api/wallet/all-balances?address=8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV"
```

**Response Format:**

```json
{
  "publicKey": "8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV",
  "tokens": [
    {
      "mint": "So11111111111111111111111111111111111111112",
      "symbol": "SOL",
      "name": "Solana",
      "decimals": 9,
      "balance": 5.234,
      "uiAmount": 5.234,
      "rawAmount": "5234000000"
    },
    {
      "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "balance": 100.5,
      "address": "TokenAccount_Address",
      "uiAmount": 100.5,
      "rawAmount": "100500000"
    }
  ],
  "totalTokens": 5,
  "solBalance": 5.234,
  "source": "https://mainnet.helius-rpc.com",
  "timestamp": 1702500000000
}
```

### 2. Existing Endpoints (Still Available)

The following existing endpoints continue to work and can still be used:

#### Get SOL Balance Only

```bash
curl "http://localhost:3000/api/wallet/balance?publicKey=8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV"
```

#### Get Token Accounts (including SOL)

```bash
curl "http://localhost:3000/api/wallet/token-accounts?publicKey=8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV"
```

#### Get Specific Token Balance

```bash
curl "http://localhost:3000/api/wallet/token-balance?wallet=8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV&mint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
```

## Cloudflare Pages Functions

The same functionality is available via Cloudflare Pages Functions at:

**Production URL:** `/api/wallet/all-balances`

**Parameters:** Same as dev server (publicKey, wallet, or address)

**Example Request:**

```bash
curl "https://your-domain.com/api/wallet/all-balances?publicKey=8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV"
```

## JavaScript/TypeScript Usage

### Fetch All Balances in React

```typescript
import { useState, useEffect } from 'react';

interface Token {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  uiAmount?: number;
  rawAmount?: string;
}

interface AllBalancesResponse {
  publicKey: string;
  tokens: Token[];
  totalTokens: number;
  solBalance: number;
  source: string;
  timestamp: number;
}

function WalletBalances({ walletAddress }: { walletAddress: string }) {
  const [balances, setBalances] = useState<AllBalancesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalances = async () => {
      if (!walletAddress) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/wallet/all-balances?publicKey=${walletAddress}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: AllBalancesResponse = await response.json();
        setBalances(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch balances');
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, [walletAddress]);

  if (loading) return <div>Loading balances...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!balances) return <div>No balances found</div>;

  return (
    <div>
      <h2>Wallet Balances</h2>
      <p>SOL Balance: {balances.solBalance}</p>
      <h3>Tokens ({balances.totalTokens})</h3>
      <ul>
        {balances.tokens.map((token) => (
          <li key={token.mint}>
            {token.symbol} ({token.name}): {token.balance}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default WalletBalances;
```

### Server-Side Fetch

```typescript
// Node.js / Express
async function getAllBalances(walletAddress: string) {
  const response = await fetch(
    `http://localhost:3000/api/wallet/all-balances?publicKey=${walletAddress}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch balances: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

// Usage
try {
  const balances = await getAllBalances(
    "8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV",
  );
  console.log("SOL Balance:", balances.solBalance);
  console.log("Total Tokens:", balances.totalTokens);
  console.log("Tokens:", balances.tokens);
} catch (error) {
  console.error("Error:", error);
}
```

## Known Tokens

The endpoints automatically decode and include metadata for these known tokens:

| Symbol    | Mint     | Name       | Decimals |
| --------- | -------- | ---------- | -------- |
| SOL       | So111... | Solana     | 9        |
| USDC      | EPjFW... | USD Coin   | 6        |
| USDT      | Es9vM... | Tether USD | 6        |
| FIXERCOIN | H4qKn... | FIXERCOIN  | 6        |
| LOCKER    | EN1nY... | LOCKER     | 6        |
| FXM       | 7Fnx5... | Fixorium   | 6        |

Unknown tokens will have:

- `symbol`: "UNKNOWN"
- `name`: "Unknown Token"
- `decimals`: Fetched from on-chain data

## RPC Endpoint Priority

The system automatically selects the best RPC endpoint in this order:

1. **HELIUS_API_KEY** - Uses Helius with the configured API key (currently set)
2. **HELIUS_RPC_URL** - Uses a custom Helius RPC URL if provided
3. **SOLANA_RPC_URL** - Uses a custom Solana RPC URL if provided
4. **Public Endpoint** - Falls back to `https://solana.publicnode.com`

## Features

✅ **Parallel Requests** - Fetches SOL balance and SPL tokens simultaneously for better performance
✅ **Automatic SOL Handling** - Includes SOL balance in the token list
✅ **Error Handling** - Graceful degradation if one request fails
✅ **Timeout Protection** - 15-second timeout for RPC requests
✅ **CORS Enabled** - Works from browser requests
✅ **Zero Balance Filtering** - Skips tokens with zero balance
✅ **Metadata Enrichment** - Includes known token symbols and names

## Troubleshooting

### Issue: "Missing wallet address parameter"

**Solution:** Make sure you're passing one of these parameters:

- `?publicKey=...`
- `?wallet=...`
- `?address=...`

### Issue: "Invalid Solana address format"

**Solution:** Verify the wallet address is a valid Solana public key (43-44 characters, base58 encoded)

### Issue: "Failed to fetch balances from RPC endpoint"

**Solution:**

- Check that HELIUS_API_KEY is set in environment variables
- Verify the API key has not expired
- Check network connectivity

### Issue: Endpoint returns empty token list

**Possible causes:**

- The wallet address is valid but has no tokens
- The wallet is on devnet/testnet instead of mainnet
- The RPC endpoint is rate-limited (try again after a moment)

## Testing

### Test with cURL

```bash
# Replace with a real wallet address
WALLET="8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV"

# Dev Server
curl "http://localhost:3000/api/wallet/all-balances?publicKey=$WALLET"

# Or with wallet parameter
curl "http://localhost:3000/api/wallet/all-balances?wallet=$WALLET"
```

### Test in Browser

Navigate to:

```
http://localhost:3000/api/wallet/all-balances?publicKey=8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV
```

Replace `8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV` with any valid Solana wallet address.

## Performance Notes

- **Response Time:** Typically 1-3 seconds depending on Helius performance
- **Rate Limiting:** Helius API limits based on subscription tier
- **Caching:** Consider implementing client-side caching for frequently accessed wallets
- **Parallel Queries:** The endpoint uses parallel requests for better performance

## Additional Resources

- [Helius RPC Documentation](https://docs.helius.dev/)
- [Solana RPC API Reference](https://solana.com/docs/rpc)
- [SPL Token Program](https://spl.solana.com/token)
