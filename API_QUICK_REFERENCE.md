# API Quick Reference Guide

## Base URL

```
https://wallet.fixorium.com.pk
```

## Health & Status Endpoints

### Health Check

```bash
GET /health
GET /api/health

# Response
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "server",
  "uptime": 123456
}
```

## Wallet Endpoints

### Get Wallet Balance

```bash
GET /api/wallet/balance?walletAddress=<pubkey>
# OR
GET /api/wallet/balance?publicKey=<pubkey>
GET /api/wallet/balance?wallet=<pubkey>
GET /api/wallet/balance?address=<pubkey>

# Response
{
  "publicKey": "11111111111111111111111111111111",
  "balance": 0.000000001,
  "balanceLamports": 1
}
```

## Price & Market Data Endpoints

### Get Token Price

```bash
GET /api/token/price?token=FIXERCOIN
GET /api/token/price?token=SOL
GET /api/token/price?token=USDC

# Response
{
  "token": "FIXERCOIN",
  "priceUsd": 0.0000776,
  "priceInPKR": 0.022651440000000002,
  "priceChange24h": 0,
  "volume24h": 17.46
}
```

### Get SOL Price

```bash
GET /api/sol/price

# Response
{
  "token": "SOL",
  "price": 154.022,
  "priceUsd": 154.022,
  "priceChange24h": -2.82,
  "volume24h": 272706751.13
}
```

### Get Exchange Rate

```bash
GET /api/exchange-rate

# Response
{
  "token": "FIXERCOIN",
  "priceUsd": 0.0000776,
  "priceInPKR": 0.022651440000000002,
  "rate": 0.022651440000000002,
  "pkrPerUsd": 280,
  "markup": 1.0425
}
```

### Get Token Price (Birdeye)

```bash
GET /api/birdeye/price?address=<mint>

# Response
{
  "success": true,
  "data": {
    "address": "So11111111111111111111111111111111111111112",
    "value": 154.022,
    "updateUnixTime": 1705315800,
    "priceChange24h": -2.82
  }
}
```

## Swap & Trading Endpoints

### Get Swap Quote (Unified)

```bash
GET /api/quote?inputMint=<mint>&outputMint=<mint>&amount=<lamports>

# Response
{
  "source": "jupiter",
  "quote": {
    "inputMint": "So11111111111111111111111111111111111111112",
    "inAmount": "1000000",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "outAmount": "153718",
    "slippageBps": 50,
    "priceImpactPct": "0"
  }
}
```

### Get Swap Quote v2

```bash
GET /api/swap/quote?inputMint=<mint>&outputMint=<mint>&amount=<lamports>

# Response (same as /api/quote)
```

### Execute Swap

```bash
POST /api/swap/execute

# Request
{
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amount": 1000000,
  "slippageBps": 50,
  "wallet": "<wallet_address>"
}

# Response
{
  "swap": {
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": 1000000,
    "slippageBps": 50
  }
}
```

## Pump.fun Endpoints

### Get Pump.fun Quote

```bash
GET /api/pumpfun/quote?inputMint=<mint>&outputMint=<mint>&amount=<lamports>
POST /api/pumpfun/quote

# Response
{
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "outAmount": "153718",
  "slippageBps": 350
}
```

### Buy Pump.fun Token

```bash
POST /api/pumpfun/buy

# Request
{
  "mint": "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
  "amount": 1000000,
  "buyer": "<wallet_address>",
  "slippageBps": 350,
  "priorityFeeLamports": 10000
}

# Response
{
  "txid": "...",
  "signature": "..."
}
```

### Sell Pump.fun Token

```bash
POST /api/pumpfun/sell

# Request
{
  "mint": "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
  "amount": 1000000,
  "seller": "<wallet_address>",
  "slippageBps": 350,
  "priorityFeeLamports": 10000
}

# Response
{
  "txid": "...",
  "signature": "..."
}
```

## Solana RPC Proxy

### Call Solana RPC

```bash
POST /api/solana-rpc

# Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getBalance",
  "params": ["11111111111111111111111111111111"]
}

# Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "context": {
      "apiVersion": "3.0.6",
      "slot": 378501965
    },
    "value": 1
  }
}
```

## Order Management Endpoints

### List Orders

```bash
GET /api/orders

# Response
{
  "orders": []
}
```

### Create Order

```bash
POST /api/orders

# Request
{
  "type": "buy|sell",
  "mint": "<token_mint>",
  "amount": 1000000,
  "price": 0.00000001,
  "wallet": "<wallet_address>"
}

# Response
{
  "id": "order-123",
  "type": "buy",
  "mint": "<token_mint>",
  "amount": 1000000,
  "price": 0.00000001,
  "status": "pending",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### Get Order

```bash
GET /api/orders/<orderId>

# Response
{
  "id": "order-123",
  "type": "buy",
  "mint": "<token_mint>",
  "amount": 1000000,
  "price": 0.00000001,
  "status": "pending",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### Update Order

```bash
PUT /api/orders/<orderId>

# Request
{
  "price": 0.00000002,
  "amount": 500000
}

# Response (updated order)
```

### Delete Order

```bash
DELETE /api/orders/<orderId>

# Response
{
  "success": true,
  "message": "Order deleted"
}
```

## P2P Trading Endpoints

### List P2P Rooms

```bash
GET /api/p2p/rooms

# Response
{
  "rooms": []
}
```

### Create P2P Room

```bash
POST /api/p2p/rooms

# Request
{
  "title": "SOL Trading",
  "description": "Trading SOL tokens",
  "creator": "<wallet_address>",
  "type": "public|private"
}

# Response
{
  "id": "room-123",
  "title": "SOL Trading",
  "creator": "<wallet_address>",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "messages": []
}
```

### Get P2P Room

```bash
GET /api/p2p/rooms/<roomId>

# Response (room with messages)
```

### Get Room Messages

```bash
GET /api/p2p/rooms/<roomId>/messages

# Response
{
  "messages": [
    {
      "id": "msg-1",
      "roomId": "<roomId>",
      "sender": "<wallet_address>",
      "content": "Hello!",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### Add Message to Room

```bash
POST /api/p2p/rooms/<roomId>/messages

# Request
{
  "sender": "<wallet_address>",
  "content": "Hello!"
}

# Response
{
  "id": "msg-1",
  "roomId": "<roomId>",
  "sender": "<wallet_address>",
  "content": "Hello!",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Common Mints

```
SOL: So11111111111111111111111111111111111111112
USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
USDT: Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns
FIXERCOIN: H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump
LOCKER: EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump
```

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "details": "Additional details (optional)",
  "examples": ["Example 1", "Example 2"] (optional)
}
```

HTTP Status Codes:

- `200`: Success
- `400`: Bad Request (missing parameters)
- `401`: Unauthorized (API key required)
- `404`: Not Found
- `500`: Internal Server Error
- `502`: Bad Gateway (API error)
- `504`: Gateway Timeout
