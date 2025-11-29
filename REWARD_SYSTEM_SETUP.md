# Staking Reward System Setup

## Overview

The staking reward system automatically processes and tracks reward distributions when users withdraw from completed stakes.

## Configuration

### Reward Wallet Address

**Wallet:** `FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM`

This wallet is configured as the reward payer and will be responsible for distributing staking rewards to users.

The configuration file is located at: `backend/config/reward-config.php`

```php
return [
  'reward_wallet' => 'FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM',
  'apy_percentage' => 10,
  'reward_token_mint' => 'FxmrDJB16th5FeZ3RBwAScwxt6iGz5pmpKGisTJQcWMf',
  'auto_process_rewards' => true,
];
```

## How It Works

### 1. Staking Creation

- User stakes tokens for 30, 60, or 90 days
- Reward amount is calculated: `(amount * 0.1) / 365 * stake_period_days`
- Stake is stored with `status: 'active'`

### 2. Staking Period

- Stake remains active until the `end_time` is reached
- User cannot withdraw until the period completes

### 3. Reward Processing

When a user withdraws from a completed stake:

1. **Validation**: Check that the staking period has ended
2. **Status Update**: Mark stake as `withdrawn`
3. **Reward Recording**: Record the reward distribution with details:
   - Recipient wallet address
   - Reward amount
   - Token mint
   - Payer wallet address
   - Status: `processed`
4. **Response**: Return reward details for frontend processing

### API Endpoints

#### GET `/backend/api/staking-list.php`

Fetch all stakes for a wallet

```
Query: ?wallet=<address>
Response: { data: [{ stake objects }] }
```

#### POST `/backend/api/staking-create.php`

Create a new stake

```
Body: {
  wallet: string,
  tokenMint: string,
  amount: number,
  periodDays: 30|60|90,
  message: string,
  signature: string
}
Response: { data: { stake object with reward_amount } }
```

#### POST `/backend/api/staking-withdraw.php`

Withdraw from a completed stake

```
Body: {
  wallet: string,
  stakeId: string,
  message: string,
  signature: string
}
Response: {
  data: {
    stake: { stake object },
    totalAmount: number,
    reward: {
      amount: number,
      tokenMint: string,
      payerWallet: "FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM",
      recipientWallet: string,
      status: "ready_for_distribution"
    }
  }
}
```

#### GET `/backend/api/rewards-status.php`

Get reward status for a wallet

```
Query: ?wallet=<address>
Response: {
  data: {
    walletAddress: string,
    totalRewardsEarned: number,
    rewardCount: number,
    rewardPayerWallet: "FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM",
    rewards: [{ reward objects }],
    summary: { totalProcessed, totalPending, currencySymbol }
  }
}
```

## Data Storage

### Stakes File: `backend/data/stakes.json`

Contains all stake records with:

- Stake ID
- Wallet address
- Token mint
- Amount and reward
- Time period (start_time, end_time)
- Status (active, withdrawn, completed)

### Rewards File: `backend/data/rewards.json`

Contains all reward distributions with:

- Reward ID
- Stake ID reference
- Wallet address
- Reward amount and token
- Distribution timestamp
- Status (pending, processed)
- Transaction hash (if applicable)

## Frontend Integration

### useStaking Hook

The `client/hooks/use-staking.ts` hook now includes:

```typescript
interface UseStakingReturn {
  stakes: Stake[];
  loading: boolean;
  error: string | null;
  rewardPayerWallet: string;  // "FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM"
  createStake: (...) => Promise<Stake>;
  withdrawStake: (...) => Promise<{ stake, totalAmount, reward }>;
  refreshStakes: () => Promise<void>;
  getRewardStatus: () => Promise<any>;
}
```

### Reward Distribution Response

When user withdraws, the response includes:

```typescript
reward: {
  amount: number,           // Reward amount in tokens
  tokenMint: string,        // FIXERCOIN mint
  payerWallet: string,      // Reward payer wallet
  recipientWallet: string,  // User's wallet
  status: string            // "ready_for_distribution"
}
```

## Future Enhancements

1. **Automatic Transfer**: Implement automatic token transfer from reward wallet
2. **Solana Integration**: Use Solana web3.js to send SPL token transfers
3. **Transaction Tracking**: Store transaction hashes for audit trail
4. **Email Notifications**: Notify users when rewards are distributed
5. **Admin Dashboard**: View reward distribution history and pending transfers

## Security Considerations

1. **Signature Verification**: All API calls should be verified with wallet signatures
2. **Rate Limiting**: Implement rate limiting on API endpoints
3. **Access Control**: Ensure users can only access their own stakes and rewards
4. **Audit Trail**: Log all reward distributions for compliance
5. **Wallet Protection**: Keep reward wallet address secure and monitored

## Troubleshooting

### Rewards Not Appearing

1. Check that stake end_time has passed
2. Verify wallet address is correct
3. Check `backend/data/rewards.json` for distribution records
4. Check browser console for API errors

### Missing Reward Wallet Address

- Ensure `backend/config/reward-config.php` exists
- Verify reward_wallet is set correctly
- Restart the dev server

### Staking Period Not Ended

- Stake cannot be withdrawn until `end_time` is reached
- Check the `timeRemainingMs` in stake object
- Wait for the period to complete
