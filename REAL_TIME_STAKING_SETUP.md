# Real-Time Staking System - Complete Implementation

## Overview

This document describes the real-time staking system implementation using Option A (direct SPL token transfers). The system now performs **actual token transfers** to and from the vault wallet.

## Architecture

### Components

1. **Client Side** (`client/hooks/use-staking.ts`):
   - Builds SPL transfer transactions
   - Signs transactions with user's wallet
   - Broadcasts to Solana blockchain
   - Waits for confirmation
   - Records stakes in KV after blockchain confirmation

2. **Backend** (`functions/api/staking/`):
   - `create.ts` - Records stakes after transfer confirmation
   - `withdraw.ts` - Signs and sends withdrawal transfers from vault
   - `config.ts` - Returns staking configuration (vault wallet address)
   - `list.ts` - Lists stakes for a wallet
   - `rewards-status.ts` - Returns reward information

3. **Utilities**:
   - `functions/lib/spl-transfer.ts` - SPL transfer instruction building
   - `functions/lib/vault-transfer.ts` - Vault-signed transaction handling
   - `client/lib/spl-token-transfer.ts` - Client-side transfer utilities
   - `functions/lib/reward-config.ts` - Staking configuration

## Staking Flow

### Deposit (User Stakes Tokens)

```
1. User enters amount and period
2. Client builds transfer transaction:
   - Source: User's token account
   - Destination: Vault token account
   - Amount: Staked amount
3. User signs transaction with Fixorium provider
4. Transaction broadcast to Solana
5. Wait for blockchain confirmation
6. Client signs message for authentication
7. Call /api/staking/create with:
   - Token details
   - Staked amount
   - Period
   - Transfer transaction signature (proof of on-chain transfer)
   - Message signature
8. Backend saves stake to KV
9. User's balance updated to reflect locked tokens
```

### Withdrawal (User Withdraws After Period Ends)

```
1. User clicks "WITHDRAW" on completed stake
2. Check that staking period has ended
3. Backend validates vault has sufficient balance
4. Backend uses vault private key to sign transfer:
   - Source: Vault token account
   - Destination: User's token account
   - Amount: Staked amount + Rewards
5. Transaction broadcast to Solana
6. Backend records withdrawal and reward distribution
7. User receives tokens in wallet
```

## Configuration Required

### 1. Vault Private Key Setup

The withdrawal system requires the vault wallet's private key to sign transactions.

**IMPORTANT SECURITY NOTES:**

- ⚠️ Never commit private keys to version control
- ⚠️ Use secure secret management (Cloudflare Secrets, AWS Secrets Manager, etc.)
- ⚠️ Rotate keys regularly
- ⚠️ Use a dedicated vault wallet (not your main wallet)

**To set up:**

1. Export your vault wallet's private key in base58 format:

   ```typescript
   // In Solana.js:
   const keypair = Keypair.fromSecretKey(secretKeyArray);
   const privateKeyBase58 = bs58.encode(keypair.secretKey);
   console.log(privateKeyBase58);
   ```

2. Set the environment variable:
   - **For Cloudflare Pages Functions**: Use Wrangler secrets
     ```bash
     wrangler secret put VAULT_PRIVATE_KEY
     # Paste the base58-encoded private key
     ```
   - **For local development**: Add to `.env`:
     ```
     VAULT_PRIVATE_KEY=your_base58_encoded_private_key
     ```

### 2. Vault Wallet Pre-funding

The vault wallet (`5bW3uEyoP1jhXBMswgkB8xZuKUY3hscMaLJcsuzH2LNU`) must have:

- **SOL for transaction fees** (1-2 SOL recommended for hundreds of transactions)
- **Token reserves for reward payouts**

Example: If you allow stakes of 1000 tokens for 30/60/90 days with 10% APY:

```
30 days: 1000 + 82 tokens (reward)
60 days: 1000 + 164 tokens (reward)
90 days: 1000 + 246 tokens (reward)
```

Pre-fund the vault with enough tokens to cover all potential rewards.

### 3. Token Decimals

The system assumes 6 decimals for token transfers. If your token has different decimals, update:

- `functions/api/staking/withdraw.ts` (line ~186): Change `decimals: 6`
- `client/lib/spl-token-transfer.ts`: Add configurable decimals

## Endpoints

### GET /api/staking/config

Returns staking configuration.

```json
{
  "success": true,
  "data": {
    "vaultWallet": "5bW3uEyoP1jhXBMswgkB8xZuKUY3hscMaLJcsuzH2LNU",
    "rewardWallet": "FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM",
    "apyPercentage": 10,
    "rewardTokenMint": "FxmrDJB16th5FeZ3RBwAScwxt6iGz5pmpKGisTJQcWMf"
  }
}
```

### POST /api/staking/create

Create a new stake.

**Request:**

```json
{
  "wallet": "user_public_key",
  "tokenMint": "token_mint_address",
  "amount": 1000,
  "periodDays": 30,
  "transferTxSignature": "signature_of_transfer_tx",
  "message": "Create stake:wallet:timestamp",
  "messageSignature": "signature_of_message"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "stake_timestamp_random",
    "walletAddress": "user_public_key",
    "tokenMint": "token_mint",
    "amount": 1000,
    "stakePeriodDays": 30,
    "startTime": 1234567890000,
    "endTime": 1234567890000,
    "rewardAmount": 82.19,
    "status": "active",
    "vaultWallet": "5bW3uEyoP1jhXBMswgkB8xZuKUY3hscMaLJcsuzH2LNU",
    "transferTxSignature": "signature"
  }
}
```

### POST /api/staking/withdraw

Withdraw completed stake with rewards.

**Request:**

```json
{
  "wallet": "user_public_key",
  "stakeId": "stake_id",
  "transferTxSignature": "will_be_generated",
  "message": "Withdraw stake:stakeId:wallet:timestamp",
  "signature": "signature_of_message"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "stake": {
      /* updated stake */
    },
    "totalAmount": 1082.19,
    "transferTxSignature": "withdrawal_tx_signature",
    "reward": {
      "amount": 82.19,
      "tokenMint": "token_mint",
      "status": "processed",
      "txHash": "withdrawal_tx_signature"
    }
  }
}
```

## Testing the System

### 1. Test Deposit

```
1. Create a test stake for 30 days
2. Check vault wallet receives tokens on Solana
3. Verify stake appears in /api/staking/list
4. Check user's balance is deducted
```

### 2. Test Withdrawal

```
1. Wait for staking period to end (or test on devnet with reduced times)
2. Click withdraw on completed stake
3. Verify vault private key is set
4. Check user wallet receives tokens + rewards
5. Verify stake status changes to "withdrawn"
```

### 3. Monitor Transactions

```
- Check vault wallet balance: https://solscan.io/account/{vault_address}
- Monitor transaction signatures from API responses
- Verify all transfers are confirmed on-chain
```

## Error Handling

### Common Issues

1. **"VAULT_PRIVATE_KEY not configured"**
   - Set environment variable with vault private key
   - Use `wrangler secret put VAULT_PRIVATE_KEY` for production

2. **"Vault does not have sufficient balance"**
   - Pre-fund vault with more tokens
   - Adjust reward calculation or stake limits

3. **"Token transfer failed to confirm"**
   - Network congestion - user can retry
   - Transaction fee issue - check SOL balance in vault
   - RPC endpoint down - system will retry with fallback endpoints

4. **"Staking period has not ended yet"**
   - User tried to withdraw before period ends
   - Show time remaining in UI

## Monitoring & Maintenance

### Vault Balance Monitoring

```typescript
// Check vault balance periodically
async function checkVaultBalance() {
  const conn = new Connection("https://solana.publicnode.com");
  const vault = new PublicKey("5bW3uEyoP1jhXBMswgkB8xZuKUY3hscMaLJcsuzH2LNU");
  const ata = await getAssociatedTokenAddress(mint, vault);
  const balance = await conn.getTokenAccountBalance(ata);
  console.log(`Vault balance: ${balance.value.uiAmount}`);
}
```

### Reward Distribution Tracking

- All reward distributions are recorded in KV
- Check `/api/staking/rewards-status` endpoint
- Monitor transaction hashes for on-chain verification

## Future Improvements

1. **Smart Contract**: Implement a Solana program for trustless escrow
2. **Flexible Decimals**: Make token decimals configurable per token
3. **Variable APY**: Different rewards for different tokens/periods
4. **Auto-compound**: Automatically re-stake rewards
5. **Delegation**: Allow staking for other users
6. **Emergency Pause**: Circuit breaker for vault transfers

## Support

If the vault private key is not set, withdrawals will fail with clear error messages. Administrator must:

1. Generate and securely store vault private key
2. Set environment variable
3. Pre-fund vault with tokens and SOL
4. Test withdrawal process

All transactions are immutable on the Solana blockchain - verify everything works on devnet before mainnet deployment.
