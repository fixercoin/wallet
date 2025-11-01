# Razorpay Integration Setup Guide

This document outlines the steps required to set up Razorpay payment processing for the BuyCrypto feature in Fixorium Wallet.

## Overview

The BuyCrypto page allows users to purchase crypto tokens (FIXERCOIN, SOL, USDC, USDT, LOCKER) using card/ATM payments through Razorpay. Payments are processed via Cloudflare Workers with automatic wallet crediting upon successful payment.

## Prerequisites

- Razorpay account with API access ([https://razorpay.com](https://razorpay.com))
- Cloudflare account with Workers and KV namespace access
- Admin access to manage environment variables and secrets

## Setup Steps

### 1. Obtain Razorpay API Credentials

1. Log in to your Razorpay Dashboard
2. Navigate to **Settings → API Keys**
3. Copy your:
   - **Key ID** (e.g., `rzp_live_xxxxx`)
   - **Key Secret** (e.g., `xxxxx`)

### 2. Set Razorpay Secrets in Cloudflare Workers

Run these commands in your terminal:

```bash
cd cloudflare

# Set Razorpay Key ID
wrangler secret put RAZORPAY_KEY_ID
# Paste your Key ID when prompted

# Set Razorpay Key Secret
wrangler secret put RAZORPAY_KEY_SECRET
# Paste your Key Secret when prompted

# Set Admin Token (for manual wallet crediting)
wrangler secret put ADMIN_TOKEN
# Create a secure random token for admin operations
```

### 3. Create Cloudflare KV Namespace

If you don't have a KV namespace, create one:

```bash
wrangler kv:namespace create WALLET_KV
wrangler kv:namespace create WALLET_KV --preview
```

You'll receive namespace IDs. Update `cloudflare/wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "WALLET_KV"
id = "your_production_kv_id"
preview_id = "your_preview_kv_id"
```

### 4. Configure Razorpay Webhook

1. Go to **Razorpay Dashboard → Settings → Webhooks**
2. Add a new webhook with:
   - **URL**: `https://your-worker-url.workers.dev/api/webhooks/payment`
   - **Events**: Select these events:
     - `payment.authorized`
     - `payment.captured`
3. Generate and save your **Webhook Secret** (you'll need this for production)

### 5. Update Exchange Rates (Optional)

The current implementation uses mock exchange rates. To use real rates, replace the rates object in `/api/exchange-rate` with calls to a real API:

```typescript
// Example: Call an external price API
const rates = await fetch("https://api.coingecko.com/api/v3/...").then((r) =>
  r.json(),
);
```

Current mock rates:

- FIXERCOIN: 0.0003 PKR per token
- SOL: 6000 PKR per token
- USDC: 280 PKR per token
- USDT: 280 PKR per token
- LOCKER: 0.5 PKR per token

## API Endpoints

### 1. Create Payment Intent

**POST** `/api/payments/create-intent`

Request:

```json
{
  "walletAddress": "Aso...xxx",
  "amount": 100000,
  "currency": "PKR",
  "tokenType": "SOL",
  "email": "user@example.com",
  "contact": "+92123456789"
}
```

Response:

```json
{
  "orderId": "order_xxx",
  "key": "rzp_live_xxx",
  "amount": 100000,
  "currency": "PKR"
}
```

### 2. Payment Webhook

**POST** `/api/webhooks/payment`

Razorpay sends webhook events here. The worker:

- Verifies the webhook signature
- Checks if payment was authorized/captured
- Credits the user's wallet with tokens
- Stores payment records in KV

### 3. Get Wallet Balance

**GET** `/api/wallet/balance?wallet=Aso...xxx`

Response:

```json
{
  "walletAddress": "Aso...xxx",
  "balances": {
    "FIXERCOIN": 1000,
    "SOL": 0.5,
    "USDC": 100,
    "USDT": 50,
    "LOCKER": 0
  }
}
```

### 4. Manual Wallet Credit (Admin Only)

**POST** `/api/wallet/credit`

Headers:

```
Authorization: Bearer <ADMIN_TOKEN>
```

Request:

```json
{
  "walletAddress": "Aso...xxx",
  "tokenType": "SOL",
  "amount": 1.5
}
```

### 5. Get Exchange Rate

**GET** `/api/exchange-rate?token=SOL`

Response:

```json
{
  "token": "SOL",
  "rate": 6000
}
```

## Testing

### Local Testing

1. Start the dev server:

```bash
npm run dev
```

2. Navigate to `/buy-crypto` page

3. Test with Razorpay test mode (if available in your plan):
   - Use test card: 4111 1111 1111 1111
   - Any future expiry date
   - Any CVV

### Webhook Testing

Use Razorpay's webhook tester or tools like `ngrok` to expose your local server and test webhook delivery.

## Production Deployment

1. Update `cloudflare/wrangler.toml` with production KV namespace IDs
2. Deploy to Cloudflare:

```bash
cd cloudflare
wrangler deploy
```

3. Configure production webhook URL in Razorpay dashboard
4. Monitor webhook deliveries in Razorpay dashboard

## Troubleshooting

### Issue: "Razorpay not loaded"

- Ensure the Razorpay script loads from CDN (`https://checkout.razorpay.com/v1/checkout.js`)
- Check browser console for network errors

### Issue: "Invalid signature"

- Verify `RAZORPAY_KEY_SECRET` is set correctly in Cloudflare
- Ensure webhook secret matches if using custom webhook verification

### Issue: Wallet not being credited

- Check Cloudflare Workers logs for errors
- Verify KV namespace is accessible
- Check that payment webhook was received by examining Razorpay webhook logs

### Issue: Exchange rate not loading

- Verify `/api/exchange-rate` endpoint is accessible
- Check for CORS issues if using external API
- Review browser console network tab

## Security Considerations

1. **API Keys**: Always use `wrangler secret put` for sensitive credentials
2. **Webhook Signature**: Always verify webhook signatures from Razorpay
3. **Admin Token**: Use a strong, random token for admin operations
4. **CORS**: Current setup allows all origins; consider restricting to your domain in production
5. **Rate Limiting**: Consider implementing rate limits for payment endpoints

## Support

For issues with:

- **Razorpay Integration**: Contact Razorpay support
- **Cloudflare Workers**: Check Cloudflare documentation
- **Application Logic**: Review the implementation in `cloudflare/src/worker.ts` and `client/pages/BuyCrypto.tsx`

## Future Enhancements

1. Implement real-time price feeds for exchange rates
2. Add payment status tracking UI
3. Implement batch payment processing
4. Add refund handling
5. Create admin dashboard for payment analytics
6. Support additional payment methods via Razorpay
