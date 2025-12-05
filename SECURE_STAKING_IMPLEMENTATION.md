# Secure Staking System Implementation

## Overview

This document explains the secure staking system architecture where private keys are **never exposed to the client**.

## Architecture Flow

### Create Stake Flow ✅ (Already Secure)

```
1. USER → CLIENT: Selects token amount & period
2. CLIENT: Uses user's wallet to sign transfer to vault
3. CLIENT → BACKEND: Sends signed transfer + signature proof
4. BACKEND: Verifies signature, records stake, transfers tokens
5. BACKEND → USER: Confirms stake created
```

**Why it's secure:**

- User's private key never leaves the wallet
- Client only sends transaction signature (already signed)
- Backend verifies the signature before processing

---

### Withdraw Stake Flow ✅ (Now Secure)

```
1. USER → CLIENT: Requests withdrawal (after lock period ends)
2. CLIENT: User signs withdrawal request message with wallet
3. CLIENT → BACKEND: Sends signed message + signature
4. BACKEND:
   - Verifies user signature
   - Gets VAULT private key from secure environment
   - Builds return transaction (vault → user with tokens + rewards)
   - Signs transaction with vault key
   - Submits signed transaction to blockchain
   - Updates stake status to "withdrawn"
5. BACKEND → USER: Confirms withdrawal processed
```

**Why it's secure:**

- User's private key never involved in return transaction
- Vault private key **never leaves the backend**
- Backend controls all fund movements
- User only signs ownership verification message
- All sensitive operations happen server-side only

---

## Implementation Details

### Client-Side Changes (use-staking.ts)

**Before (INSECURE):**

```typescript
if (!wallet?.secretKey) throw new Error("Wallet secret key not available");
// ❌ Secret key was required on client
```

**After (SECURE):**

```typescript
if (!wallet?.publicKey) throw new Error("No wallet connected");
// ✅ Only public key needed for verification
```

### Backend Changes

#### 1. Staking Creation (Verified & Signed by User)

- File: `server/routes/staking.ts` → `handleCreateStake`
- Verifies user's signature on the token transfer
- Records the stake in KV storage
- No vault private key needed here

#### 2. Staking Withdrawal (Signed by Backend with Vault Key)

- File: `server/routes/staking.ts` → `handleWithdrawStake`
- Verifies user owns the stake
- **Retrieves vault private key from environment** (`VAULT_PRIVATE_KEY`)
- Signs and sends return transaction
- Updates stake status

#### 3. Configuration Endpoint

- File: `server/routes/staking.ts` → `handleStakingConfig`
- Returns vault wallet address and APY info
- Client uses this to show vault address for transfers

---

## Environment Variables Setup

### Required for Production

```bash
# Add to your backend environment (Cloudflare Workers, Node.js server, etc.)

# Vault Wallet Address (public key - safe to expose)
VAULT_WALLET=<your-vault-solana-address>

# Vault Private Key (SECRET - MUST be kept secure)
VAULT_PRIVATE_KEY=<base58-encoded-vault-secret-key>

# Optional: Reward Configuration
REWARD_TOKEN_MINT=FxmrDJB16th5FeZ3RBwAScwxt6iGz5pmpKGisTJQcWMf
APY_PERCENTAGE=10
```

### How to Set Environment Variables

#### Option 1: Cloudflare Workers (Recommended)

```bash
# Create/edit wrangler.toml
[env.production]
vars = { VAULT_WALLET = "Your-Vault-Address" }

[[env.production.kv_namespaces]]
binding = "STAKES"
id = "your-kv-id"

# Set the secret via Cloudflare CLI
wrangler secret put VAULT_PRIVATE_KEY --env production
# Paste your base58-encoded vault private key when prompted
```

#### Option 2: Node.js Server

```bash
# Create .env file (add to .gitignore)
VAULT_WALLET=<your-vault-address>
VAULT_PRIVATE_KEY=<base58-encoded-private-key>

# Or set via DevServerControl:
# set_env_variable: ['VAULT_PRIVATE_KEY', '<key>']
```

#### Option 3: Netlify Functions

```bash
# Via Netlify UI: Site Settings → Build & Deploy → Environment
# Or via netlify.toml:
[build.environment]
VAULT_WALLET = "your-vault-address"

# For secrets, use Netlify CLI:
netlify env:set VAULT_PRIVATE_KEY "<key>"
```

---

## Security Best Practices

### ✅ DO

- ✅ Store vault private key in secure environment variables only
- ✅ Verify user signatures before processing requests
- ✅ Use HTTPS/TLS for all API communication
- ✅ Implement rate limiting on staking endpoints
- ✅ Log all staking transactions for auditing
- ✅ Use separate vault wallet for staking (not user wallets)
- ✅ Keep vault private key encrypted in KV storage if possible

### ❌ DON'T

- ❌ Send vault private key to the client
- ❌ Log or expose vault private key anywhere
- ❌ Store vault private key in code/git
- ❌ Use vault private key for user transactions
- ❌ Trust unverified signature requests
- ❌ Store private keys in localStorage/cookies
- ❌ Send secrets through unencrypted connections

---

## Testing the Secure Flow

### Test Create Stake

```javascript
// Client code
const { useStaking } = require("@/hooks/use-staking");

const { createStake } = useStaking();

// This should work WITHOUT requiring wallet.secretKey
await createStake(
  "EPjFWaLb3odcccccccccccccccccccccccccccccccc", // USDC mint
  1000, // amount
  30, // period in days
);
```

### Test Withdraw Stake

```javascript
// Client code
const { withdrawStake } = useStaking();

// After lock period ends, user can withdraw
// This only requires wallet.publicKey, NOT secretKey
await withdrawStake("stake_123456789");
```

### Verify Backend Vault Signing

Check the backend logs:

```
GET /api/staking/config → Returns vault wallet address
POST /api/staking/create → Creates stake with user signature
POST /api/staking/withdraw → Backend signs with vault key
```

---

## Migration Checklist

- [ ] Remove `wallet?.secretKey` references from client
- [ ] Add `VAULT_PRIVATE_KEY` to environment variables
- [ ] Update `VAULT_WALLET` address in environment
- [ ] Test create stake flow
- [ ] Test withdraw stake flow after lock period
- [ ] Verify vault receives tokens during staking
- [ ] Verify users receive tokens + rewards on withdrawal
- [ ] Set up monitoring/alerts for failed withdrawals
- [ ] Document vault wallet recovery procedure
- [ ] Set up backup for vault private key (encrypted)

---

## Troubleshooting

### "Vault private key not configured"

**Solution:** Add `VAULT_PRIVATE_KEY` environment variable to your backend

### "Invalid signature on withdrawal"

**Solution:** Ensure user's wallet is signing the message properly. Check client browser console for errors.

### "Stake is not active"

**Solution:** User might already have withdrawn this stake, or the stake doesn't exist.

### "Staking period has not ended yet"

**Solution:** Lock period hasn't completed. User must wait until `endTime`.

---

## Next Steps

1. Configure your vault wallet address and private key in environment variables
2. Test the staking flow in your staging environment
3. Monitor first few staking/withdrawal transactions for any issues
4. Set up automated daily reconciliation between chain and KV store
5. Implement withdrawal transaction retry logic for failed submissions
