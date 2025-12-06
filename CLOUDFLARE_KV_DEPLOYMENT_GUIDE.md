# Cloudflare KV Deployment Guide

## Overview

This guide explains how to deploy the buy/sell order system to Cloudflare with KV storage enabled.

## Configuration

### Cloudflare KV Namespace

- **Namespace ID**: `295bfeb238c344ccb5afdd2bb93e497f`
- **Namespace Name**: `staking_kv_prod`
- **Binding**: `STAKING_KV`

The namespace is configured in `wrangler.toml` and automatically bound to:

- Cloudflare Pages Functions at `functions/api/p2p/orders.ts`
- Development and production environments

### Environment Variables

No additional environment variables are needed as the KV binding is configured in `wrangler.toml`.

## API Endpoints

### POST /api/p2p/orders

Create a new buy or sell order

**Request Body:**

```json
{
  "walletAddress": "your_wallet_address",
  "type": "BUY" or "SELL",
  "token": "USDC",
  "minAmountPKR": 1000,
  "maxAmountPKR": 5000,
  "minAmountTokens": 10,
  "maxAmountTokens": 50,
  "pricePKRPerQuote": 280,
  "paymentMethodId": "pm_xxx",
  "status": "PENDING"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "order_xxx",
    "walletAddress": "your_wallet_address",
    "type": "BUY",
    "token": "USDC",
    "minAmountPKR": 1000,
    "maxAmountPKR": 5000,
    "pricePKRPerQuote": 280,
    "status": "PENDING",
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  },
  "order": {
    /* same as data */
  }
}
```

### GET /api/p2p/orders

Fetch orders with various filters

**Query Parameters:**

- `type`: "BUY" or "SELL" (optional)
- `status`: "PENDING", "COMPLETED", "CANCELLED", "active" (optional)
- `wallet`: wallet address to get orders for (optional)
- `id`: specific order ID (optional)

**Examples:**

Get all active buy orders:

```
GET /api/p2p/orders?type=BUY&status=active
```

Get orders for a specific wallet:

```
GET /api/p2p/orders?wallet=your_wallet_address
```

Get a specific order:

```
GET /api/p2p/orders?id=order_xxx
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "order_xxx",
      "walletAddress": "seller_wallet",
      "type": "BUY",
      "token": "USDC",
      "minAmountPKR": 1000,
      "maxAmountPKR": 5000,
      "pricePKRPerQuote": 280,
      "status": "PENDING",
      "createdAt": 1234567890
    }
  ],
  "orders": [
    /* same as data */
  ],
  "count": 1
}
```

### PUT /api/p2p/orders

Update an order's status

**Request Body:**

```json
{
  "orderId": "order_xxx",
  "status": "COMPLETED"
}
```

### DELETE /api/p2p/orders

Delete an order

**Query Parameters:**

- `wallet`: wallet address (required)
- `id`: order ID (required)

## Data Flow

### Creating Orders (BuyCrypto/SellNow pages)

1. User fills in order details (min/max amounts, token, payment method)
2. Form is validated
3. Order is sent to `POST /api/p2p/orders`
4. API stores order in Cloudflare KV with key: `orders:{orderId}`
5. Order ID is added to wallet's order list: `orders:wallet:{walletAddress}`

### Fetching Orders (BuyData/SellData pages)

1. Page loads and requests `GET /api/p2p/orders?type=BUY&status=active`
2. API scans all order keys in KV (`orders:*`)
3. Orders are filtered by type and status
4. Results are sorted by creation date (newest first)
5. Orders are displayed in the P2POffersTable component
6. Page auto-refreshes every 10 seconds
7. User can manually click "REFRESH" button for immediate update

## KV Storage Keys

### Order Storage

- `orders:{orderId}` - Individual order data (JSON)
- `orders:wallet:{walletAddress}` - Array of order IDs for a wallet (JSON)

### Example Key Structure

```
orders:order_1705680000000_abc123
{
  "id": "order_1705680000000_abc123",
  "walletAddress": "your_wallet...",
  "type": "BUY",
  "token": "USDC",
  "minAmountPKR": 1000,
  "maxAmountPKR": 5000,
  "pricePKRPerQuote": 280,
  "status": "PENDING",
  "createdAt": 1705680000000,
  "updatedAt": 1705680000000,
  "paymentMethodId": "pm_xxx"
}

orders:wallet:your_wallet...
["order_1705680000000_abc123", "order_1705680000000_def456"]
```

## Deployment Steps

### 1. Prerequisites

- Cloudflare account with KV namespace created
- `wrangler` CLI installed (`npm install -g wrangler`)
- Proper authentication: `wrangler login`

### 2. Deploy to Cloudflare Pages

```bash
# Build the project
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist
```

### 3. Verify Deployment

1. Check Cloudflare Pages dashboard for deployment status
2. Test API endpoints:
   ```bash
   curl "https://your-project.pages.dev/api/p2p/orders?type=BUY&status=active"
   ```

### 4. Monitor KV Storage

- Visit Cloudflare Dashboard → KV
- Select `staking_kv_prod` namespace
- View stored keys and data

## Troubleshooting

### Orders Not Saving

1. Check that `STAKING_KV` binding is configured in wrangler.toml
2. Verify KV namespace ID is correct: `295bfeb238c344ccb5afdd2bb93e497f`
3. Check browser console for API errors
4. Check Cloudflare dashboard for function logs

### Orders Not Displaying

1. Ensure orders are being created (check KV Dashboard)
2. Verify API endpoint returns correct data
3. Check network tab in browser DevTools
4. Ensure wallet address matches

### Performance Issues

- For large number of orders, consider implementing pagination
- KV list operation scans all keys, may be slow with millions of orders
- Consider adding date-based key prefixes for better scanning

## Features

### Auto-Refresh

- BuyData and SellData pages auto-refresh every 10 seconds
- Manual refresh button available for immediate updates

### Order Fields

- **minAmountPKR/maxAmountPKR**: Price range in PKR
- **minAmountTokens/maxAmountTokens**: Token amount range
- **pricePKRPerQuote**: Exchange rate (PKR per token unit)
- **status**: PENDING, COMPLETED, CANCELLED
- **createdAt/updatedAt**: Timestamps in milliseconds

### Data Persistence

- All orders persisted in Cloudflare KV
- Data survives function restarts
- Automatically replicated across Cloudflare edge locations

## Security Notes

1. **No authentication required** for fetching public orders (by design)
2. **Wallet address validation** should be added for sensitive operations
3. **Rate limiting** should be configured in Cloudflare dashboard
4. **CORS** is enabled for all origins (can be restricted if needed)

## Next Steps

1. Test order creation in development
2. Test order fetching and filtering
3. Deploy to Cloudflare Pages
4. Monitor KV storage usage
5. Implement additional features:
   - Order pagination
   - Advanced filtering
   - Real-time updates with WebSockets
   - Order matching algorithm

---

**Last Updated**: 2025
**Cloudflare KV Documentation**: https://developers.cloudflare.com/kv/
