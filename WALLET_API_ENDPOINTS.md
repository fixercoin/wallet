# Wallet API Endpoints - Cloudflare Worker

## Base URL

- **Production:** `https://proxy.fixorium.com.pk`
- **Frontend:** `https://wallet-c36.fixorium.com.pk/api`

---

## Wallet Management

### Get Wallet Balance

```
GET /api/wallet/balance?wallet={walletAddress}
```

**Parameters:**

- `wallet` (required): Solana wallet address
- Alternative param names: `publicKey`, `public_key`, `address`, `walletAddress`

**Response:**

```json
{
  "walletAddress": "...",
  "balances": {
    "FIXERCOIN": 100.5,
    "SOL": 2.3,
    "USDC": 500.0,
    "USDT": 250.0,
    "LOCKER": 10.5
  }
}
```

### Credit Wallet (Admin Only)

```
POST /api/wallet/credit
Authorization: Bearer {ADMIN_TOKEN}
```

**Body:**

```json
{
  "walletAddress": "...",
  "tokenType": "USDC",
  "amount": 100
}
```

---

## Token Price Data

### DexScreener Price Lookup

```
GET /api/dexscreener/price?token={tokenAddress}
```

**Parameters:**

- `token` (required): Token contract address

---

## Swap Operations

### Get Pump.fun Swap Quote

```
GET /api/swap/quote?mint={tokenMint}
```

**Parameters:**

- `mint` (required): Token mint address

**Response:**

```json
{
  "success": true,
  "mint": "...",
  "quote": {...}
}
```

### Execute Pump.fun Swap

```
POST /api/swap/execute
```

**Body:**

```json
{
  "mint": "token_mint_address",
  "amount": 1000000,
  "decimals": 6,
  "slippage": 10,
  "txVersion": "V0",
  "priorityFee": 0.0005,
  "wallet": "wallet_address_optional"
}
```

### Get Jupiter Swap Quote

```
GET /api/swap/jupiter/quote?inputMint={mint}&outputMint={mint}&amount={amount}
```

**Parameters:**

- `inputMint` (required): Input token mint address
- `outputMint` (required): Output token mint address
- `amount` (required): Amount in smallest units

**Response:**

```json
{
  "inputMint": "...",
  "outputMint": "...",
  "inAmount": "1000000",
  "outAmount": "5000000",
  "otherAmountThreshold": "...",
  "swapMode": "ExactIn",
  "priceImpactPct": "0.5",
  "routePlan": [...]
}
```

---

## Solana RPC Operations

### Execute RPC Call

```
POST /api/rpc
```

**Body:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getBalance",
  "params": ["wallet_address"]
}
```

**Note:** Uses Shyft RPC endpoint with API key: `3hAwrhOAmJG82eC7`

### Get Transaction Details

```
GET /api/transaction?signature={txSignature}
```

**Parameters:**

- `signature` (required): Transaction signature

### Get Account Information

```
GET /api/account?publicKey={walletAddress}
```

**Parameters:**

- `publicKey` (required): Wallet address to query

---

---

## Utility Endpoints

### Health Check

```
GET /api/health
```

**Response:**

```json
{
  "status": "ok",
  "upstream": {
    "pumpfun": "ok",
    "solana_rpc": "set",
    "dexscreener": "mirror"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Error Handling

All endpoints return error responses in the format:

```json
{
  "error": "Error message",
  "details": "Additional context if available",
  "status": 400
}
```

**Common Status Codes:**

- `200`: Success
- `201`: Created
- `400`: Bad Request (missing/invalid parameters)
- `401`: Unauthorized (auth header missing/invalid)
- `404`: Not Found
- `500`: Server Error
- `502`: Bad Gateway (upstream API error)
- `503`: Service Unavailable

---

## CORS Headers

All endpoints include:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## Environment Setup

The worker uses the following fixed configuration:

- **Solana RPC:** `https://rpc.shyft.to?api_key=3hAwrhOAmJG82eC7`
- **Pump.fun Quote API:** `https://pumpportal.fun/api/quote`
- **Pump.fun Trade API:** `https://pumpportal.fun/api/trade`
- **Jupiter API:** `https://quote-api.jup.ag/v6/quote`
- **DexScreener:** `https://api.dexscreener.io/latest/dex`

---

## Integration Examples

### Get Token Price

```javascript
const response = await fetch(
  "https://fixorium-proxy.khanbabusargodha.workers.dev/api/dexscreener/price?token=EPjFWaLb3odcccccccccccccccccccccccccccccc",
);
const data = await response.json();
console.log(data);
```

### Get Wallet Balance

```javascript
const response = await fetch(
  "https://fixorium-proxy.khanbabusargodha.workers.dev/api/wallet/balance?wallet=YourWalletAddress",
);
const data = await response.json();
console.log(data.balances);
```

### Get Swap Quote

```javascript
const response = await fetch(
  "https://fixorium-proxy.khanbabusargodha.workers.dev/api/swap/quote?mint=TokenMintAddress",
);
const data = await response.json();
console.log(data.quote);
```

### Execute Swap

```javascript
const response = await fetch(
  "https://fixorium-proxy.khanbabusargodha.workers.dev/api/swap/execute",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mint: "token_mint",
      amount: 1000000,
      decimals: 6,
      slippage: 10,
    }),
  },
);
const data = await response.json();
console.log(data);
```
