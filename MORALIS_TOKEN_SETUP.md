# Moralis API Token Fetching Setup

## Overview

This guide explains why Moralis API is the best choice for wallet token fetching and how to set it up for both development and production (Cloudflare Pages).

## Why Moralis API is Better

### Current Approach (Slow)
- **Method**: RPC calls using `getTokenAccountsByOwner`
- **Process**: 
  1. Makes RPC call to get all token accounts for wallet
  2. Iterates through each token account
  3. Fetches metadata for each token
  4. Calculates balances
- **Speed**: 2-5+ seconds per wallet (depends on RPC endpoint and number of tokens)
- **Bottlenecks**: Network latency, RPC rate limits, metadata fetching

### Moralis API (Fast)
- **Method**: Direct REST API call to `/wallets/{address}/tokens`
- **Process**:
  1. Single API call returns all token balances with metadata
  2. Filtered spam tokens automatically
  3. All data in one response
- **Speed**: 200-500ms per wallet (REST API is optimized for this use case)
- **Benefits**: 
  - ✅ Fast response times
  - ✅ Spam token filtering included
  - ✅ Complete token metadata
  - ✅ Reliable and production-ready
  - ✅ No RPC rate limit issues

## Setup Instructions

### Step 1: Get Moralis API Key

1. Visit [https://moralis.io/](https://moralis.io/) and sign up (free tier available)
2. Go to your dashboard and find your API key
3. Copy your API key (looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

### Step 2: Configure for Local Development

#### Option A: Using `.env.local` (Recommended for local testing)

Create or edit `.env.local` in the project root:

```env
MORALIS_API_KEY=your_moralis_api_key_here
```

Then update `wrangler.toml` to read from environment:

```toml
[env.development.vars]
MORALIS_API_KEY = "your_moralis_api_key_here"
```

#### Option B: Direct in `wrangler.toml`

```toml
[env.development.vars]
SOLANA_RPC_URL = "https://api.mainnet-beta.solflare.network"
MORALIS_API_KEY = "your_moralis_api_key_here"
```

### Step 3: Configure for Production (Cloudflare Pages)

1. Go to your Cloudflare Pages project dashboard
2. Navigate to **Settings > Environment variables**
3. Add a new environment variable:
   - **Name**: `MORALIS_API_KEY`
   - **Value**: Your Moralis API key
   - **Environments**: Check both "Production" and "Preview" (or your preferred environment)
4. Click **Save**

The system will now use this API key in your production deployment.

## API Endpoints

### Fast Token Fetching Endpoint

**GET `/api/wallet/moralis-tokens`**

Query Parameters:
- `address` - Solana wallet address (required)

Example Request:
```javascript
const walletAddress = "4toKNLx8Ry7XHDw3xXRUSB5rEVgUXgXEvKbJnNNDvBk";
const response = await fetch(
  `/api/wallet/moralis-tokens?address=${walletAddress}`
);
const data = await response.json();
```

Example Response:
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

## Using in Your Components

### Example 1: Using the Hook

```typescript
import { useMoralisTokens } from "@/hooks/use-moralis-tokens";

function MyComponent() {
  const { tokens, loading, error, fetchTokens } = useMoralisTokens();

  const handleFetchTokens = async () => {
    await fetchTokens("4toKNLx8Ry7XHDw3xXRUSB5rEVgUXgXEvKbJnNNDvBk");
  };

  return (
    <div>
      {loading && <p>Loading tokens...</p>}
      {error && <p>Error: {error}</p>}
      {tokens.map((token) => (
        <div key={token.mint}>
          <p>{token.symbol}: {token.uiAmount}</p>
        </div>
      ))}
      <button onClick={handleFetchTokens}>Fetch Tokens</button>
    </div>
  );
}
```

### Example 2: Direct Fetch

```typescript
async function getWalletTokens(walletAddress: string) {
  try {
    const response = await fetch(
      `/api/wallet/moralis-tokens?address=${encodeURIComponent(walletAddress)}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.tokens;
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return [];
  }
}
```

## Comparison: Before vs After

### Before (RPC-based)
```
Request → RPC Call → Get Token Accounts → Fetch Each Token's Metadata → Response
├─ 2-5+ seconds
├─ Multiple network calls
└─ RPC rate limit concerns
```

### After (Moralis API)
```
Request → Moralis REST API → Response
├─ 200-500ms
├─ Single network call
└─ No rate limit issues
```

## Troubleshooting

### Error: "Moralis API key not configured"
**Solution**: Make sure `MORALIS_API_KEY` is set in:
- For local dev: `.env.local` or `wrangler.toml` [env.development.vars]
- For production: Cloudflare Pages environment variables dashboard

### Error: "Invalid API key"
**Solution**: 
1. Verify your API key is correct (copy-paste from Moralis dashboard)
2. Check there are no spaces or extra characters
3. Make sure the key is active in your Moralis account

### Getting timeout errors
**Solution**: This is normal if:
- Wallet has 100+ tokens (Moralis may take 1-2 seconds)
- First request to a wallet (data is being cached)
- Solution: Implement client-side caching and loading indicators

## Performance Tips

1. **Cache Results**: Store token data for 30-60 seconds to avoid repeated API calls
2. **Show Loading State**: Display skeleton loaders while fetching
3. **Batch Multiple Wallets**: If fetching multiple wallets, do it in parallel:
   ```typescript
   const allTokens = await Promise.all(
     addresses.map(addr => fetchTokens(addr))
   );
   ```
4. **Filter Tokens**: Use the `isSpam` flag to exclude spam tokens from UI

## Cost Information

- **Moralis Free Tier**: 
  - Up to 10,000 requests/month
  - Sufficient for development and small apps
  - Great for testing

- **Moralis Paid Plans**:
  - Start at $99/month for 1M+ requests
  - Per-endpoint pricing available
  - See pricing at https://moralis.io/pricing

## Next Steps

1. ✅ Get your Moralis API key
2. ✅ Set `MORALIS_API_KEY` environment variable
3. ✅ Use the `/api/wallet/moralis-tokens` endpoint
4. ✅ Replace slow RPC token fetching with this fast endpoint

## References

- Moralis Documentation: https://moralis.io/api/solana/
- Solana on Moralis: https://docs.moralis.io/web3-data-api/solana
- API Reference: https://deep-index.moralis.io/api-docs/
