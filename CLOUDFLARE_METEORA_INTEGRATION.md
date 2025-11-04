# Cloudflare Worker - Meteora Integration Guide

## Overview

This document describes the updated Cloudflare Worker configuration that prioritizes **Meteora for swap quotes and execution**, uses **DexScreener for price fetching**, and supports **local wallet signing** for enhanced security.

## Key Changes

### 1. Price Fetching - DexScreener (Already Implemented ✅)

**Endpoint:** `/api/birdeye/price` and `/api/dexscreener/tokens`

- Primary source: **DexScreener API**
- Fallback: Jupiter, hardcoded prices
- Status: ✅ Already in production

**Example:**

```bash
curl "https://wallet.fixorium.com.pk/api/birdeye/price?address=H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump"
```

### 2. Swap Quotes - Meteora (Prioritized)

**Endpoint:** `/api/quote` (Unified)

- **Primary Provider:** Meteora
- **Fallback Providers:** Jupiter, DexScreener
- **Order of Preference:** Meteora → Jupiter → DexScreener

**Example:**

```bash
curl "https://wallet.fixorium.com.pk/api/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000"
```

**Response:**

```json
{
  "source": "meteora",
  "quote": {
    "inAmount": "1000000",
    "outAmount": "...",
    "priceImpact": "...",
    "...": "other Meteora fields"
  }
}
```

### 3. Swap Execution - Meteora with Local Signing Support

#### 3a. Meteora-Specific Endpoint

**Endpoint:** `/api/swap/meteora/swap` (POST)

- Builds unsigned transactions from Meteora
- Supports optional local wallet signing (disabled for security)
- Returns base64-encoded transaction

**Request:**

```json
{
  "userPublicKey": "...",
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "inputAmount": "1000000",
  "slippageBps": 500,
  "sign": false
}
```

**Response:**

```json
{
  "swapTransaction": "base64_encoded_transaction",
  "signed": false,
  "warning": "Server-side signing is disabled for security. Please sign this transaction on the client-side using the wallet's signing capability.",
  "_source": "meteora"
}
```

#### 3b. Unified Swap Endpoint

**Endpoint:** `/api/swap` (POST)

- Supports multiple providers: **Meteora, Jupiter, Pumpfun**
- **Auto-selects Meteora** if inputMint + outputMint + amount are provided
- Returns transaction requiring client-side signing

**Request:**

```json
{
  "provider": "meteora",
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amount": "1000000",
  "wallet": "your_wallet_address",
  "slippageBps": 500
}
```

**Response:**

```json
{
  "source": "meteora",
  "swap": {
    "swapTransaction": "base64_encoded_transaction",
    "...": "other fields"
  },
  "signingRequired": true,
  "hint": "The transaction must be signed by the wallet on the client-side"
}
```

## Security Notes ⚠️

### Server-Side Signing: DISABLED

- ❌ Passing private keys to servers is a **security risk**
- ❌ Server-side signing endpoint (`/api/sign/transaction`) is **intentionally disabled**
- ✅ **Recommended:** Sign transactions on the **client-side** using wallet adapters

### How to Sign on Client-Side

Using `@solana/web3.js`:

```typescript
import { Connection, Transaction } from "@solana/web3.js";
import { WalletAdapter } from "@solana/wallet-adapter-base";

// Get unsigned transaction from /api/swap (as base64)
const { swap } = response;
const transactionBuffer = Buffer.from(swap.swapTransaction, "base64");
const transaction = Transaction.from(transactionBuffer);

// Sign with wallet adapter
const signedTransaction = await wallet.signTransaction(transaction);

// Send to RPC
const connection = new Connection("https://api.mainnet-beta.solana.com");
const signature = await connection.sendTransaction(signedTransaction);
```

## Endpoint Summary

| Endpoint                  | Method | Provider                | Purpose            | Status      |
| ------------------------- | ------ | ----------------------- | ------------------ | ----------- |
| `/api/quote`              | GET    | Meteora (preferred)     | Get swap quotes    | ✅ Updated  |
| `/api/swap`               | POST   | Meteora/Jupiter/Pumpfun | Execute swaps      | ✅ Updated  |
| `/api/swap/meteora/quote` | GET    | Meteora                 | Meteora quotes     | ✅ Working  |
| `/api/swap/meteora/swap`  | POST   | Meteora                 | Build transactions | ✅ Updated  |
| `/api/birdeye/price`      | GET    | DexScreener             | Token prices       | ✅ Working  |
| `/api/dexscreener/tokens` | GET    | DexScreener             | Token data         | ✅ Working  |
| `/api/sol/price`          | GET    | DexScreener             | SOL price          | ✅ Working  |
| `/api/sign/transaction`   | POST   | N/A                     | Sign transactions  | ❌ Disabled |

## Deployment Steps

### 1. Update the Worker Code

The updated `cloudflare/src/worker.ts` includes:

- Meteora prioritization for quotes and swaps
- Enhanced error messages with provider-specific requirements
- Security warnings for server-side signing
- Transaction encoding/decoding helpers

### 2. Deploy to Cloudflare

```bash
cd cloudflare
wrangler deploy --config ./wrangler.toml --env production
```

### 3. Verify Deployment

Test the endpoints:

```bash
# Test Meteora quote
curl "https://wallet.fixorium.com.pk/api/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000"

# Test unified swap (Meteora)
curl -X POST https://wallet.fixorium.com.pk/api/swap \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "meteora",
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": "1000000",
    "wallet": "your_wallet_address"
  }'
```

## Architecture

```
Client (Browser)
    ↓
    ├─→ GET /api/quote (Meteora preferred)
    │    ↓
    │    └─→ Meteora API (quote endpoint)
    │
    └─→ POST /api/swap
         ↓
         └─→ Meteora API (swap endpoint)
              ↓
              Returns unsigned transaction
              ↓
              Client signs with wallet adapter
              ↓
              Client submits to RPC
```

## Configuration

### Environment Variables (wrangler.toml)

```toml
[vars]
SOLANA_RPC = "https://rpc.shyft.to?api_key=..."
```

### External APIs Used

- **Meteora:** `https://api.meteora.ag/swap/v3/`
- **Jupiter:** `https://quote-api.jup.ag/v6/`
- **DexScreener:** `https://api.dexscreener.com/latest/`
- **Solana RPC:** Configurable via environment variables

## Client Integration Example

```typescript
// 1. Get quote from Meteora
const quoteResponse = await fetch(
  `https://wallet.fixorium.com.pk/api/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}`,
);
const { quote, source } = await quoteResponse.json();

// 2. Build swap transaction
const swapResponse = await fetch("https://wallet.fixorium.com.pk/api/swap", {
  method: "POST",
  body: JSON.stringify({
    provider: "meteora",
    inputMint,
    outputMint,
    amount,
    wallet: walletPublicKey,
  }),
});
const { swap } = await swapResponse.json();

// 3. Sign transaction on client-side
const transactionBuffer = Buffer.from(swap.swapTransaction, "base64");
const transaction = Transaction.from(transactionBuffer);
const signedTx = await wallet.signTransaction(transaction);

// 4. Send to RPC
const connection = new Connection(RPC_URL);
const signature = await connection.sendTransaction(signedTx);

// 5. Confirm transaction
await connection.confirmTransaction(signature);
```

## Troubleshooting

### Quote Fails

**Error:** `"Failed to fetch quote from any provider"`

**Solution:** Check if Meteora API is available:

```bash
curl "https://api.meteora.ag/swap/v3/quote?inputMint=...&outputMint=...&amount=..."
```

### Swap Fails

**Error:** `"Meteora swap returned 4xx/5xx"`

**Solution:**

1. Verify wallet address is valid
2. Check inputMint and outputMint are correct
3. Ensure amount is in smallest units (lamports for SOL)
4. Check Meteora API status

### Signing Issues

**Error:** `"Server-side signing is disabled for security reasons"`

**Solution:** Use client-side wallet signing instead (see Client Integration Example above)

## Support

For issues or questions:

1. Check Cloudflare Worker logs: https://dash.cloudflare.com
2. Review API response error messages
3. Test with curl before integrating in frontend
4. Verify environment variables are set correctly

## References

- [Meteora API Docs](https://api.meteora.ag/)
- [DexScreener API Docs](https://docs.dexscreener.com/)
- [Solana Web3.js Docs](https://solana-labs.github.io/solana-web3.js/)
- [Wallet Adapter Guide](https://github.com/solana-labs/wallet-adapter)
