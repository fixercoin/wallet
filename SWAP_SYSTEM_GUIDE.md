# Server-Side Swap System Guide

This document outlines the complete server-side swap system implementation and how to test it.

## System Architecture

The swap system is composed of several key endpoints:

### 1. Quote Endpoint (`GET /api/swap/quote`)

Gets a price quote for swapping tokens using a fallback chain:

1. **Jupiter** - Primary provider, most liquidity
2. **Meteora** - Secondary provider
3. **Bridged Routes** - Multi-leg swaps through USDC/USDT/SOL

**Parameters:**

- `inputMint` (required) - Token mint address to swap from
- `outputMint` (required) - Token mint address to swap to
- `amount` (required) - Amount in smallest unit (lamports for SOL, etc.)
- `slippageBps` (optional, default: 50) - Slippage tolerance in basis points (1 bps = 0.01%)

**Example Request:**

```bash
curl "http://localhost:8080/api/swap/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000"
```

**Response:**

```json
{
  "quote": {
    "inputMint": "So11...",
    "outputMint": "EPj...",
    "inAmount": "1000000000",
    "outAmount": "51234567",
    "priceImpactPct": "0.5"
  },
  "source": "jupiter",
  "inputMint": "So11...",
  "outputMint": "EPj...",
  "amount": "1000000000",
  "slippageBps": 50,
  "attempts": [
    {
      "provider": "jupiter",
      "status": "success"
    }
  ]
}
```

### 2. Execute Endpoint (`POST /api/swap/execute`)

Builds an unsigned swap transaction from a quote.

**Request Body:**

```json
{
  "quoteResponse": {
    "inputMint": "So11...",
    "outputMint": "EPj...",
    "inAmount": "1000000000",
    "outAmount": "51234567"
  },
  "userPublicKey": "YourWalletAddressHere"
}
```

**Response:**

```json
{
  "swapTransaction": "base64-encoded-transaction-data",
  "lastValidBlockHeight": 12345678,
  "prioritizationFeeLamports": 1000
}
```

### 3. Send Transaction Endpoint (`POST /api/solana-send`)

Sends a signed transaction to the blockchain.

**Request Body:**

```json
{
  "signedBase64": "base64-encoded-signed-transaction"
}
```

**Response:**

```json
{
  "success": true,
  "result": "tx-signature",
  "signature": "tx-signature"
}
```

**Note:** Requires `FIXORIUM_API_KEY` environment variable if configured.

### 4. Simulate Transaction Endpoint (`POST /api/solana-simulate`)

Simulates a transaction without sending it.

**Request Body:**

```json
{
  "signedBase64": "base64-encoded-transaction"
}
```

**Response:**

```json
{
  "success": true,
  "result": {
    "err": null,
    "logs": ["...program logs..."],
    "unitsConsumed": 150000
  },
  "unitsConsumed": 150000,
  "logs": ["..."],
  "insufficientLamports": false
}
```

## Testing the Swap Flow

### Step 1: Get a Quote

```bash
# Test SOL -> USDC quote
curl "http://localhost:8080/api/swap/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000&slippageBps=50"
```

Save the `quote` response for the next step.

### Step 2: Build Swap Transaction

```bash
# Build swap (replace with actual quote from step 1)
curl -X POST http://localhost:8080/api/swap/execute \
  -H "Content-Type: application/json" \
  -d '{
    "quoteResponse": {
      "inputMint": "So11111111111111111111111111111111111111112",
      "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "inAmount": "1000000000",
      "outAmount": "51234567"
    },
    "userPublicKey": "YOUR_WALLET_ADDRESS_HERE"
  }'
```

This returns an unsigned transaction that needs to be signed by the wallet.

### Step 3: Sign Transaction

The client (React app) signs the transaction using the wallet:

```javascript
// In SwapInterface.tsx
const kp = getKeypair(); // Get wallet keypair
const tx = VersionedTransaction.deserialize(txBuffer);
tx.sign([kp]);
const signed = tx.serialize();
const signedBase64 = base64FromBytes(signed);
```

### Step 4: Simulate Transaction (Optional but Recommended)

Before sending, simulate to check for errors:

```bash
curl -X POST http://localhost:8080/api/solana-simulate \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY_HERE" \
  -d '{
    "signedBase64": "BASE64_SIGNED_TX_HERE"
  }'
```

### Step 5: Send Transaction

```bash
curl -X POST http://localhost:8080/api/solana-send \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY_HERE" \
  -d '{
    "signedBase64": "BASE64_SIGNED_TX_HERE"
  }'
```

Response:

```json
{
  "success": true,
  "result": "3kDc4F5Kj7sL9mK2wQ1eR4tY8uI9oP0aS3dF6gH7jK8lM9nO0pQ1rS2tU3vW4xY5z"
}
```

## Error Handling

### No Route Found (404)

Returned when no swap route exists between the tokens:

```json
{
  "error": "No swap route found - no liquidity available for this pair",
  "inputMint": "...",
  "outputMint": "...",
  "amount": "...",
  "attempts": [
    {
      "provider": "jupiter",
      "status": "failed",
      "reason": "No liquidity or route found"
    },
    ...
  ]
}
```

**Solution:** Try a different token pair or increase the amount.

### Insufficient SOL (400 on /api/solana-send)

Transaction would fail due to insufficient fees:

```json
{
  "error": "Insufficient SOL for transaction fees",
  "details": "...",
  "insufficientLamports": {
    "message": "Insufficient SOL for transaction fees and rent",
    "diffSol": 0.001
  }
}
```

**Solution:** Add more SOL to the wallet.

### Rate Limiting (429)

If Jupiter or Meteora APIs are rate limited:

```json
{
  "error": "No swap route found - no liquidity available for this pair",
  "attempts": [
    {
      "provider": "jupiter",
      "status": "failed",
      "reason": "No liquidity or route found"
    }
  ]
}
```

**Solution:** Wait a moment and retry.

## Environment Variables

Configure these optional environment variables:

```bash
# Solana RPC endpoint (auto-selects from list if not provided)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# API key for protected endpoints (solana-send, solana-simulate)
FIXORIUM_API_KEY=your-secret-api-key-here

# Helius RPC (if you have a Helius account)
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
HELIUS_API_KEY=YOUR_KEY
```

## Integration with Frontend

The `SwapInterface` component in `client/components/wallet/SwapInterface.tsx` handles:

1. **Quote fetching** - Calls `/api/swap/quote` with fallback logic
2. **Transaction building** - Calls `/api/swap/execute`
3. **Signing** - Uses wallet keypair to sign
4. **Simulation** - Calls `/api/solana-simulate` before sending
5. **Submission** - Calls `/api/solana-send` to broadcast

## Known Limitations

1. **No transaction signing on server** - Transactions are unsigned and must be signed by the client
2. **No persistent swap history** - Swap history is not stored in database
3. **No price impact estimation for bridged routes** - Multi-leg swaps don't show combined impact
4. **Rate limits on external APIs** - Jupiter/Meteora have their own rate limits

## Troubleshooting

### Quote endpoint returns 500

Check server logs for RPC endpoint issues. This usually means all RPC endpoints are rate limited or down.

### Transaction send fails with "Blockhash expired"

The transaction was built too long ago. Rebuild with a fresh quote and transaction.

### Swap succeeds but funds not received

Check `https://solscan.io/tx/{signature}` to see transaction status.

## Cloudflare Worker Migration

To migrate this to Cloudflare Workers:

1. Use the same endpoint structure in `cloudflare/src/`
2. Use Cloudflare's `fetch` API instead of Node's
3. Replace RPC endpoint logic with Cloudflare's KV cache for rate limit tracking
4. Use Cloudflare environment variables instead of process.env

See `CLOUDFLARE_DEPLOYMENT_CHECKLIST.md` for detailed steps.
