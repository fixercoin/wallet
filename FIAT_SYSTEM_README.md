# Fiat System - USDT/PKR Deposit, Withdraw & Exchange

## Overview
The Fiat System replaces the Market Place page and provides users with a complete deposit, withdrawal, and exchange system for USDT (US Dollar Token) and PKR (Pakistani Rupee). It features Cloudflare KV storage for persistent balance tracking and an admin panel for manual price ratio adjustments.

## Features

### User Features
1. **Deposit** - Add funds in USDT or PKR using various Pakistani payment methods
   - Bank Transfer
   - Easypaisa
   - JazzCash
   - Nayapay
   - HBL Mobile
   - Fawry

2. **Withdraw** - Withdraw funds in USDT or PKR to selected payment methods
   - No approval required
   - No limits on withdrawal amounts

3. **Exchange** - Convert between USDT and PKR using current exchange rate
   - Real-time rate based on admin-set ratio
   - Instant execution

4. **Transaction History** - View and export all transactions
   - Filter by type (deposit, withdraw, exchange)
   - Download as CSV

### Admin Features
1. **Price Ratio Management** - Manually set USDT/PKR exchange rate
   - Only hardcoded admin wallets can access
   - Real-time rate updates for all users
   - Historical tracking of rate changes

## Architecture

### Backend
- **Framework**: Express.js (server/routes/fiat-system.ts)
- **Storage**: Cloudflare KV (persistent, no database required)
- **Authentication**: Wallet address based
- **Admin Check**: Hardcoded wallet list

### Frontend
- **Main Page**: `/fiat` - FiatSystem component with tabs
- **Transactions**: `/fiat/transactions` - FiatTransactions component
- **Admin Panel**: `/fiat/admin` - FiatAdmin component (admin only)
- **Old Route**: `/marketplace` - Now redirects to `/fiat`

### Data Structure

#### User Balance (KV Storage)
```json
{
  "wallet": "user_wallet_address",
  "usdt": 100.50,
  "pkr": 27700.00,
  "lastUpdated": "2025-01-01T12:00:00Z"
}
```
Key: `balance:{wallet_address}`

#### Transactions (KV Storage)
```json
{
  "id": "tx_1234567890_abc123",
  "wallet": "user_wallet_address",
  "type": "deposit|withdraw|exchange",
  "fromCurrency": "USDT|PKR",
  "toCurrency": "USDT|PKR",
  "fromAmount": 100.00,
  "toAmount": 27700.00,
  "timestamp": "2025-01-01T12:00:00Z",
  "status": "completed|pending|failed",
  "paymentMethod": "bank_transfer|easypaisa|etc",
  "notes": "optional notes"
}
```
Keys:
- `transaction:{transaction_id}` - Individual transaction
- `transactions:{wallet_address}` - List of transaction IDs for user

#### Price Ratio (KV Storage)
```json
{
  "usdtToPkr": 277.50,
  "pkrToUsdt": 0.003604,
  "updatedBy": "admin_wallet_address",
  "timestamp": "2025-01-01T12:00:00Z"
}
```
Key: `price_ratio`

## Setup Instructions

### 1. Configure Admin Wallets

#### Server Side
Edit `server/routes/fiat-system.ts`:
```typescript
const ADMIN_WALLETS = process.env.FIAT_ADMIN_WALLETS
  ? process.env.FIAT_ADMIN_WALLETS.split(",").map((w) => w.trim())
  : [
      "YOUR_ADMIN_WALLET_ADDRESS_HERE",
      // Add more as needed
    ];
```

**For Production (Recommended)**:
Set environment variable on your server:
```bash
FIAT_ADMIN_WALLETS="wallet1_address,wallet2_address,wallet3_address"
```

#### Client Side
Edit `client/pages/FiatAdmin.tsx`:
```typescript
const ADMIN_WALLETS = [
  "YOUR_ADMIN_WALLET_ADDRESS_HERE",
  // Add more as needed
];
```

**Important**: Keep `ADMIN_WALLETS` in sync between client and server!

### 2. Set Initial Exchange Rate
The system starts with a default rate of 1 USDT = 277 PKR. To change this:
1. Connect with an admin wallet
2. Navigate to `/fiat`
3. Click the settings icon (⚙️) in the header
4. Enter the new USDT to PKR rate
5. Click "Update Rate"

### 3. Verify Cloudflare KV Setup
Ensure you have Cloudflare KV namespace configured in `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "KV"
id = "your_kv_namespace_id"
preview_id = "your_kv_namespace_id"
```

## API Endpoints

All endpoints use wallet address as user identifier (no authentication required beyond wallet address).

### Get User Balance
```
GET /api/fiat/balance?wallet=<wallet_address>
Response:
{
  "wallet": "...",
  "usdt": 100.00,
  "pkr": 27700.00,
  "lastUpdated": "..."
}
```

### Deposit Funds
```
POST /api/fiat/deposit
Body:
{
  "wallet": "user_address",
  "currency": "USDT|PKR",
  "amount": 100.00,
  "paymentMethod": "bank_transfer|easypaisa|..."
}
```

### Withdraw Funds
```
POST /api/fiat/withdraw
Body:
{
  "wallet": "user_address",
  "currency": "USDT|PKR",
  "amount": 100.00,
  "paymentMethod": "bank_transfer|easypaisa|..."
}
```

### Exchange Currency
```
POST /api/fiat/exchange
Body:
{
  "wallet": "user_address",
  "fromCurrency": "USDT|PKR",
  "toAmount": 27700.00  // Amount in target currency
}
```

### Get Current Exchange Rate
```
GET /api/fiat/price-ratio
Response:
{
  "usdtToPkr": 277.50,
  "pkrToUsdt": 0.003604,
  "updatedBy": "...",
  "timestamp": "..."
}
```

### Update Exchange Rate (Admin Only)
```
PUT /api/fiat/price-ratio
Body:
{
  "wallet": "admin_wallet_address",
  "usdtToPkr": 280.00
}
```

### Get User Transactions
```
GET /api/fiat/transactions?wallet=<wallet_address>
Response:
{
  "transactions": [
    {
      "id": "...",
      "wallet": "...",
      "type": "deposit|withdraw|exchange",
      ...
    }
  ]
}
```

## Security Considerations

1. **Wallet Address Based**: Uses connected wallet as sole identifier
2. **No Private Keys Stored**: Only wallet addresses stored in KV
3. **Admin-Only Access**: Price ratio updates require hardcoded wallet list
4. **Cloudflare KV**: Encrypted at rest by Cloudflare
5. **No API Keys Required**: Direct wallet address authentication

## Limitations & Future Improvements

### Current Limitations
- No approval workflow for deposits/withdrawals
- No transaction fees implemented
- Exchange rate manually managed (no API integration)
- No minimum/maximum limits
- No payment gateway integration (mock system)

### Recommended Future Enhancements
1. Payment gateway integration (Stripe, JazCash API, etc.)
2. KYC/AML verification
3. Transaction fees/commission system
4. Rate limiting and fraud detection
5. Email/SMS notifications
6. Multi-signature admin approval for large transactions
7. Audit logs and compliance reporting
8. Rate history and charts

## Troubleshooting

### Admin Panel Not Accessible
- Verify your wallet address is in `ADMIN_WALLETS` on both server and client
- Check that wallet is connected
- Try clearing browser cache and reconnecting wallet

### Balance Not Updating
- Wait 30 seconds (refresh interval)
- Manually refresh the page
- Check browser console for API errors

### Exchange Rate Not Changing
- Ensure connected wallet is an admin wallet
- Verify PUT request to `/api/fiat/price-ratio` succeeds (check console)
- Check server logs for Cloudflare KV errors

### Cloudflare KV Storage Issues
- Verify KV namespace is properly configured
- Check Cloudflare account has KV enabled
- Verify `wrangler.toml` has correct namespace ID
- Test KV connectivity: `curl https://api.cloudflare.com/client/v4/accounts/{account-id}/storage/kv/namespaces`

## File Structure
```
server/
  routes/
    fiat-system.ts          # Backend API routes
  index.ts                  # Updated with new routes

client/
  pages/
    FiatSystem.tsx          # Main fiat system page
    FiatTransactions.tsx    # Transaction history page
    FiatAdmin.tsx           # Admin panel
    Market.tsx              # Redirects to /fiat (legacy)

FIAT_SYSTEM_README.md       # This file
```

## Testing Checklist

- [ ] User can deposit USDT
- [ ] User can deposit PKR
- [ ] User can withdraw USDT
- [ ] User can withdraw PKR
- [ ] User can exchange USDT to PKR
- [ ] User can exchange PKR to USDT
- [ ] Transaction history shows all transactions
- [ ] CSV export works correctly
- [ ] Admin can update exchange rate
- [ ] Non-admin cannot access admin panel
- [ ] Exchange rate updates immediately for all users
- [ ] Balances persist across page refreshes
- [ ] All payment methods display correctly

## Support
For issues or questions, check the API response error messages and server logs for detailed information.
