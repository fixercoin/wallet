# Fixorium Wallet API - Quick Reference Guide

## All Endpoints at a Glance

### Base URL

```
https://abc.khanbabusargodha.workers.dev
```

---

## 1. Health & Status

| Endpoint      | Method | Purpose                        |
| ------------- | ------ | ------------------------------ |
| `/api`        | GET    | API info & available endpoints |
| `/api/health` | GET    | Health check                   |
| `/api/ping`   | GET    | Ping response                  |

### Examples

```bash
# Health check
curl https://abc.khanbabusargodha.workers.dev/api/health

# Ping
curl https://abc.khanbabusargodha.workers.dev/api/ping

# API info
curl https://abc.khanbabusargodha.workers.dev/api
```

---

## 2. Wallet Balance

| Endpoint              | Method | Parameters             |
| --------------------- | ------ | ---------------------- |
| `/api/wallet/balance` | GET    | `publicKey` (required) |

### Examples

```bash
# Get SOL balance
curl "https://abc.khanbabusargodha.workers.dev/api/wallet/balance?publicKey=YOUR_PUBLIC_KEY"

# Alternative parameter names (wallet, address also work)
curl "https://abc.khanbabusargodha.workers.dev/api/wallet/balance?wallet=YOUR_PUBLIC_KEY"
curl "https://abc.khanbabusargodha.workers.dev/api/wallet/balance?address=YOUR_PUBLIC_KEY"
```

### Response

```json
{
  "publicKey": "So11111111111111111111111111111111111111112",
  "balance": 1.5,
  "balanceLamports": 1500000000
}
```

---

## 3. Forex Rates

| Endpoint          | Method | Parameters                    |
| ----------------- | ------ | ----------------------------- |
| `/api/forex/rate` | GET    | `base` (USD), `symbols` (PKR) |

### Examples

```bash
# Get USD to PKR rate
curl "https://abc.khanbabusargodha.workers.dev/api/forex/rate?base=USD&symbols=PKR"

# Get EUR to GBP
curl "https://abc.khanbabusargodha.workers.dev/api/forex/rate?base=EUR&symbols=GBP"

# Default (USD to PKR)
curl https://abc.khanbabusargodha.workers.dev/api/forex/rate
```

### Response

```json
{
  "base": "USD",
  "symbols": ["PKR"],
  "rates": {
    "PKR": 277.5
  },
  "provider": "exchangerate.host"
}
```

---

## 4. DexScreener Integration

### 4.1 Token Price

| Endpoint                 | Method | Parameters                |
| ------------------------ | ------ | ------------------------- |
| `/api/dexscreener/price` | GET    | `tokenAddress` (required) |

```bash
# Get token price
curl "https://abc.khanbabusargodha.workers.dev/api/dexscreener/price?tokenAddress=EPjFWdd5Au17w..."

# Alternative: token, mint
curl "https://abc.khanbabusargodha.workers.dev/api/dexscreener/price?mint=EPjFWdd5Au17w..."
```

**Response:**

```json
{
  "token": "EPjFWdd5Au17w...",
  "priceUsd": 1.0
}
```

### 4.2 Multiple Tokens

| Endpoint                  | Method | Parameters                           |
| ------------------------- | ------ | ------------------------------------ |
| `/api/dexscreener/tokens` | GET    | `mints` (required) - comma-separated |

```bash
# Get multiple tokens data
curl "https://abc.khanbabusargodha.workers.dev/api/dexscreener/tokens?mints=MINT1,MINT2,MINT3"
```

**Response:**

```json
{
  "schemaVersion": "1.0.0",
  "pairs": [
    {
      "baseToken": { "address": "...", "name": "..." },
      "quoteToken": { "address": "...", "name": "..." },
      "priceUsd": 1.0,
      "liquidity": { "usd": 10000 }
    }
  ]
}
```

### 4.3 Search Tokens

| Endpoint                  | Method | Parameters                    |
| ------------------------- | ------ | ----------------------------- |
| `/api/dexscreener/search` | GET    | `q` (required) - search query |

```bash
# Search for a token
curl "https://abc.khanbabusargodha.workers.dev/api/dexscreener/search?q=USDC"

# Search returns max 20 Solana pairs
curl "https://abc.khanbabusargodha.workers.dev/api/dexscreener/search?q=raydium"
```

**Response:**

```json
{
  "schemaVersion": "1.0.0",
  "pairs": [
    {
      "baseToken": { "address": "...", "name": "..." },
      "quoteToken": { "address": "...", "name": "..." },
      "priceUsd": 1.0
    }
  ]
}
```

---

## 5. Jupiter DEX Integration

### 5.1 Token Prices

| Endpoint             | Method | Parameters                                     |
| -------------------- | ------ | ---------------------------------------------- |
| `/api/jupiter/price` | GET    | `ids` (required) - comma-separated token mints |

```bash
# Get single token price
curl "https://abc.khanbabusargodha.workers.dev/api/jupiter/price?ids=So11111111111111111111111111111111111111112"

# Get multiple token prices
curl "https://abc.khanbabusargodha.workers.dev/api/jupiter/price?ids=So11...,EPjFWdd5...,TokenMint3"
```

**Response:**

```json
{
  "data": {
    "So11111111111111111111111111111111111111112": {
      "id": "So11111111111111111111111111111111111111112",
      "price": 150.25
    }
  }
}
```

### 5.2 SOL Price

| Endpoint         | Method | Parameters |
| ---------------- | ------ | ---------- |
| `/api/sol/price` | GET    | None       |

```bash
# Get current SOL price
curl https://abc.khanbabusargodha.workers.dev/api/sol/price
```

**Response:**

```json
{
  "token": "SOL",
  "mint": "So11111111111111111111111111111111111111112",
  "price": 150.25,
  "priceUsd": 150.25,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 5.3 Quote (Swap Route)

| Endpoint             | Method | Parameters                                     |
| -------------------- | ------ | ---------------------------------------------- |
| `/api/jupiter/quote` | GET    | `inputMint`, `outputMint`, `amount` (required) |

```bash
# Get swap quote
curl "https://abc.khanbabusargodha.workers.dev/api/jupiter/quote?inputMint=EPjFWdd5Au...&outputMint=So11111...&amount=1000000"

# With slippage tolerance
curl "https://abc.khanbabusargodha.workers.dev/api/jupiter/quote?inputMint=EPjFWdd5Au...&outputMint=So11111...&amount=1000000&slippageBps=50"
```

**Response:**

```json
{
  "inputMint": "EPjFWdd5...",
  "outputMint": "So11111...",
  "inAmount": "1000000",
  "outAmount": "150000000",
  "priceImpactPct": "0.05",
  "routePlan": []
}
```

### 5.4 Execute Swap

| Endpoint            | Method | Parameters                      |
| ------------------- | ------ | ------------------------------- |
| `/api/jupiter/swap` | POST   | JSON body with quote & user key |

```bash
# Execute swap (POST)
curl -X POST https://abc.khanbabusargodha.workers.dev/api/jupiter/swap \
  -H "Content-Type: application/json" \
  -d '{
    "quoteResponse": {
      "inputMint": "EPjFWdd5Au...",
      "outputMint": "So11111...",
      "inAmount": "1000000",
      "outAmount": "150000000"
    },
    "userPublicKey": "YOUR_PUBLIC_KEY",
    "wrapUnwrapSOL": true
  }'
```

**Response:**

```json
{
  "swapTransaction": "base64_encoded_transaction",
  "lastValidBlockHeight": 123456
}
```

---

## 6. Solana RPC Direct Proxy

| Endpoint          | Method | Parameters               |
| ----------------- | ------ | ------------------------ |
| `/api/solana-rpc` | POST   | Any Solana JSON-RPC body |

```bash
# Get balance via RPC
curl -X POST https://abc.khanbabusargodha.workers.dev/api/solana-rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getBalance",
    "params": ["YOUR_PUBLIC_KEY"]
  }'

# Get transaction
curl -X POST https://abc.khanbabusargodha.workers.dev/api/solana-rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getTransaction",
    "params": ["TRANSACTION_SIGNATURE"]
  }'

# Get account info
curl -X POST https://abc.khanbabusargodha.workers.dev/api/solana-rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getAccountInfo",
    "params": ["ACCOUNT_ADDRESS"]
  }'
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "value": 1500000000
  },
  "id": 1
}
```

---

## Complete Endpoint Summary

```
GET   /api                        - API info
GET   /api/health                 - Health check
GET   /api/ping                   - Ping
GET   /api/wallet/balance         - Wallet balance (SOL)
GET   /api/forex/rate             - Exchange rate
GET   /api/dexscreener/price      - Token price
GET   /api/dexscreener/tokens     - Multiple tokens
GET   /api/dexscreener/search     - Search tokens
GET   /api/jupiter/price          - Token prices
GET   /api/sol/price              - SOL price
GET   /api/jupiter/quote          - Swap quote
POST  /api/jupiter/swap           - Execute swap
POST  /api/solana-rpc             - Direct RPC proxy
```

---

## Common Query Parameters

| Param          | Aliases             | Used In                   |
| -------------- | ------------------- | ------------------------- |
| `publicKey`    | `wallet`, `address` | `/api/wallet/balance`     |
| `base`         | -                   | `/api/forex/rate`         |
| `symbols`      | -                   | `/api/forex/rate`         |
| `tokenAddress` | `token`, `mint`     | `/api/dexscreener/price`  |
| `mints`        | -                   | `/api/dexscreener/tokens` |
| `q`            | -                   | `/api/dexscreener/search` |
| `ids`          | -                   | `/api/jupiter/price`      |
| `inputMint`    | -                   | `/api/jupiter/quote`      |
| `outputMint`   | -                   | `/api/jupiter/quote`      |
| `amount`       | -                   | `/api/jupiter/quote`      |
| `slippageBps`  | -                   | `/api/jupiter/quote`      |

---

## Environment Variables (Optional)

Configure in Cloudflare Workers:

```
SOLANA_RPC_URL=https://your-rpc-url
ALCHEMY_RPC_URL=https://your-alchemy-url
HELIUS_RPC_URL=https://your-helius-url
HELIUS_API_KEY=your-api-key
MORALIS_RPC_URL=https://your-moralis-url
JUPITER_QUOTE_BASE=https://custom-jupiter-url
JUPITER_PRICE_BASE=https://custom-jupiter-price-url
JUPITER_SWAP_BASE=https://custom-jupiter-swap-url
JUPITER_API_KEY=your-jupiter-key
```

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "error": "Human-readable error message",
  "details": "Technical details if available"
}
```

### Common Status Codes

- `200` - Success
- `400` - Missing required parameters
- `404` - Not found (e.g., token not available)
- `502` - Upstream service failed
- `503` - Service unavailable
- `500` - Internal error

---

## CORS Headers

All endpoints support CORS:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## Timeout Configuration

- Forex: 4 seconds
- Wallet Balance: 6 seconds
- DexScreener: 8 seconds
- Jupiter Price: 7 seconds
- Jupiter Quote: 8 seconds
- Jupiter Swap: 10 seconds
- Solana RPC: 7 seconds

---

## Implementation Notes

1. All endpoints are stateless
2. No authentication required (public API)
3. Fallback endpoints built-in for reliability
4. Automatic retry on timeout
5. Deduplication for batch requests
6. Price normalization from multiple sources

---

## Common Use Cases

### Get User Balance

```bash
curl "https://abc.khanbabusargodha.workers.dev/api/wallet/balance?publicKey=USER_ADDRESS"
```

### Check if Token is Tradeable

```bash
curl "https://abc.khanbabusargodha.workers.dev/api/dexscreener/price?tokenAddress=MINT_ADDRESS"
```

### Get Best Swap Route

```bash
curl "https://abc.khanbabusargodha.workers.dev/api/jupiter/quote?inputMint=INPUT_MINT&outputMint=OUTPUT_MINT&amount=AMOUNT"
```

### Get Real-time Token Prices

```bash
curl "https://abc.khanbabusargodha.workers.dev/api/jupiter/price?ids=MINT1,MINT2,MINT3"
```

### Execute Complex RPC Call

```bash
curl -X POST https://abc.khanbabusargodha.workers.dev/api/solana-rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"METHOD_NAME","params":[]}'
```
