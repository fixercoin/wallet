# Cloudflare Staking System Setup

## Overview

The staking system has been migrated from PHP backend to Cloudflare Workers with KV storage. This allows the system to deploy seamlessly on Cloudflare Pages with full data persistence.

## Architecture

### Cloudflare Components

1. **Cloudflare Pages** - Hosts the React frontend (dist folder)
2. **Cloudflare Functions** - Serverless functions in `/functions/api/`
3. **Cloudflare KV** - Key-value storage for persistent data

### File Structure

```
functions/
├── lib/
│   ├── reward-config.ts    # Shared configuration and types
│   └── kv-utils.ts         # KV storage operations
└── api/
    └── staking/
        ├── list.ts          # GET /api/staking/list
        ├── create.ts        # POST /api/staking/create
        ├── withdraw.ts      # POST /api/staking/withdraw
        └── rewards-status.ts # GET /api/staking/rewards-status
```

## Configuration

### Reward Wallet

**Wallet Address:** `FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM`

Configured in `functions/lib/reward-config.ts`

### Cloudflare KV Setup

In `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "STAKING_KV"
id = "staking_kv_prod"
preview_id = "staking_kv_preview"
```

**What you need to do:**

1. Create a KV namespace in Cloudflare:
   - Go to Cloudflare Dashboard → Workers → KV
   - Create namespace named `staking_kv_prod`
   - Get the namespace ID
   - Replace `staking_kv_prod` in wrangler.toml with your ID

2. Create preview namespace for local testing:
   - Create another namespace named `staking_kv_preview`
   - Get the namespace ID
   - Replace `staking_kv_preview` in wrangler.toml with your ID

## API Endpoints

All endpoints are at `/api/staking/*`

### 1. List Stakes

**GET /api/staking/list**

Query Parameters:

- `wallet` (required) - User's wallet address
- `message` (optional) - Auth message for signature verification
- `signature` (optional) - Message signature

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "stake_1234567890_abc123def",
      "walletAddress": "user_wallet_address",
      "tokenMint": "FxmrDJB16th5FeZ3RBwAScwxt6iGz5pmpKGisTJQcWMf",
      "amount": 1000,
      "stakePeriodDays": 30,
      "startTime": 1704067200000,
      "endTime": 1706745600000,
      "rewardAmount": 82.19,
      "status": "active",
      "createdAt": 1704067200000,
      "updatedAt": 1704067200000,
      "timeRemainingMs": 2592000000
    }
  ],
  "count": 1
}
```

### 2. Create Stake

**POST /api/staking/create**

Request Body:

```json
{
  "wallet": "user_wallet_address",
  "tokenMint": "FxmrDJB16th5FeZ3RBwAScwxt6iGz5pmpKGisTJQcWMf",
  "amount": 1000,
  "periodDays": 30,
  "message": "Create stake:wallet:timestamp",
  "signature": "base58_encoded_signature"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "stake_1234567890_abc123def",
    "walletAddress": "user_wallet_address",
    "tokenMint": "FxmrDJB16th5FeZ3RBwAScwxt6iGz5pmpKGisTJQcWMf",
    "amount": 1000,
    "stakePeriodDays": 30,
    "startTime": 1704067200000,
    "endTime": 1706745600000,
    "rewardAmount": 82.19,
    "status": "active",
    "createdAt": 1704067200000,
    "updatedAt": 1704067200000,
    "timeRemainingMs": 2592000000
  }
}
```

### 3. Withdraw Stake

**POST /api/staking/withdraw**

Request Body:

```json
{
  "wallet": "user_wallet_address",
  "stakeId": "stake_1234567890_abc123def",
  "message": "Withdraw stake:stakeId:wallet:timestamp",
  "signature": "base58_encoded_signature"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "stake": {
      /* updated stake object */
    },
    "totalAmount": 1082.19,
    "reward": {
      "amount": 82.19,
      "tokenMint": "FxmrDJB16th5FeZ3RBwAScwxt6iGz5pmpKGisTJQcWMf",
      "payerWallet": "FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM",
      "recipientWallet": "user_wallet_address",
      "status": "ready_for_distribution"
    }
  }
}
```

### 4. Rewards Status

**GET /api/staking/rewards-status**

Query Parameters:

- `wallet` (required) - User's wallet address
- `message` (optional) - Auth message
- `signature` (optional) - Message signature

Response:

```json
{
  "success": true,
  "data": {
    "walletAddress": "user_wallet_address",
    "totalRewardsEarned": 250.5,
    "rewardCount": 3,
    "rewardPayerWallet": "FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM",
    "rewards": [
      {
        "id": "reward_1234567890_abc123def",
        "stakeId": "stake_1234567890_abc123def",
        "walletAddress": "user_wallet_address",
        "rewardAmount": 82.19,
        "tokenMint": "FxmrDJB16th5FeZ3RBwAScwxt6iGz5pmpKGisTJQcWMf",
        "status": "processed",
        "createdAt": 1706745600000,
        "processedAt": 1706745600000
      }
    ],
    "summary": {
      "totalProcessed": 3,
      "totalPending": 0,
      "currencySymbol": "FIXERCOIN"
    }
  }
}
```

## Data Storage

### KV Storage Format

**Stakes:**

- Key: `stakes:<stakeId>`
- Value: JSON stake object

**Wallet Stakes Index:**

- Key: `stakes:wallet:<walletAddress>`
- Value: JSON array of stake IDs

**Rewards:**

- Key: `rewards:<rewardId>`
- Value: JSON reward object

**Wallet Rewards Index:**

- Key: `rewards:wallet:<walletAddress>`
- Value: JSON array of reward IDs

## Deployment

### Local Development

```bash
npm run dev:frontend   # Frontend only
npm run dev           # Frontend + Node backend
```

Note: For local development with Cloudflare Functions, you can run:

```bash
wrangler pages dev dist
```

### Production Deployment to Cloudflare Pages

```bash
npm run build
npm run deploy:pages
```

The `deploy:pages` command:

1. Builds the React app to `dist/`
2. Builds and deploys Cloudflare Functions
3. Publishes to Cloudflare Pages

### Environment Setup

1. Install Wrangler CLI:

```bash
npm install -g wrangler
```

2. Authenticate:

```bash
wrangler login
```

3. Create KV namespaces (if not already created):

```bash
wrangler kv:namespace create staking_kv_prod
wrangler kv:namespace create staking_kv_preview
```

4. Update `wrangler.toml` with your namespace IDs

## Frontend Integration

The client automatically uses `/api/staking/*` endpoints:

- `client/hooks/use-staking.ts` - Main staking hook
- Endpoints are dynamically resolved via `resolveApiUrl()`
- Works both locally and on Cloudflare

## Reward System

### Flow

1. User creates stake
2. Reward amount is calculated at creation time
3. User waits for staking period to complete
4. User withdraws from completed stake
5. System records reward distribution
6. Reward details are returned with payer wallet info

### Automatic Processing

When a user withdraws:

1. Stake status is updated to "withdrawn"
2. Reward distribution is recorded
3. Response includes:
   - Total amount (stake + rewards)
   - Reward details with payer wallet
   - Status: "ready_for_distribution"

### Manual Transfer Required

The current system records rewards but does not automatically transfer tokens. You need to:

1. Monitor rewards via the dashboard
2. Manually send FIXERCOIN transfers from the reward wallet
3. Future: Implement automatic SPL token transfers using Solana web3.js

## Troubleshooting

### Stakes Not Persisting

1. Verify KV namespace is created in Cloudflare
2. Check namespace ID matches in wrangler.toml
3. Ensure STAKING_KV binding is correct

### Deployment Issues

1. Check Cloudflare account is authenticated: `wrangler whoami`
2. Verify dist/ folder exists: `npm run build`
3. Check wrangler.toml syntax

### API Errors

1. Check response status codes
2. Review error messages in response
3. Verify wallet address format (base58)
4. Check signature verification if using auth

## Security Considerations

1. **Signature Verification**: Always verify signatures from authenticated requests
2. **Rate Limiting**: Implement rate limits on production
3. **Access Control**: Ensure users can only access their own stakes
4. **Audit Trail**: Log all transactions for compliance
5. **Secret Management**: Keep reward wallet address secure

## Future Enhancements

1. **Automatic Token Transfer**: Use Solana web3.js to send SPL transfers
2. **Transaction Webhooks**: Notify users of reward distributions
3. **Staking Dashboard**: Admin panel to manage rewards
4. **Multiple Tokens**: Support staking different tokens
5. **Compound Rewards**: Allow re-staking earned rewards
6. **Early Withdrawal**: Allow early withdrawal with penalty

## Performance Notes

- KV reads/writes are fast (<100ms typically)
- List operations filter in-memory (acceptable for typical wallet loads)
- For high-volume scenarios, consider pagination
- KV has rate limits - monitor usage in production

## References

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare KV Storage](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/platform/functions/)
