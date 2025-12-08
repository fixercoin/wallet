# SOL Balance Fetching Implementation

## Overview

Implemented direct SOL balance fetching from the Solana blockchain via the backend API endpoint. The balance is displayed on the wallet setup page and dashboard, using the existing backend infrastructure.

## Architecture

### Backend API Endpoint

**Endpoint:** `GET /api/wallet/balance?publicKey=<address>`

**Location:** `server/routes/wallet-balance.ts`

**Features:**

- Accepts multiple parameter names: `publicKey`, `wallet`, `address`, `walletAddress`
- Supports multiple RPC providers via environment variables:
  - `HELIUS_API_KEY` (preferred for production)
  - `HELIUS_RPC_URL`
  - `SOLANA_RPC_URL`
  - Falls back to public RPC if none configured
- Returns JSON with balance in both SOL and lamports
- Includes 15-second timeout protection
- Comprehensive error handling with diagnostic messages

**Response Example:**

```json
{
  "publicKey": "EtZ2AqEHo53BN4CbGeXwtDsqkVJktSc6nqKnCNtpeA4Y",
  "balance": 2.5,
  "balanceLamports": 2500000000,
  "source": "mainnet.helius-rpc.com"
}
```

### Frontend Service Layer

**File:** `client/lib/services/sol-balance.ts`

**Functions:**

1. `fetchSolBalance(publicKey)` - Fetch balance from API
   - Returns: Promise<number> (balance in SOL)
   - Throws: Error on failure
   - Includes timeout handling (15 seconds)

2. `formatSolBalance(balance, decimals)` - Format balance for display
   - Default decimals: 9
   - Returns: Formatted string (e.g., "2.500000000")

3. `displaySolBalance(balance, decimals)` - Display with SOL symbol
   - Returns: Formatted string with "SOL" suffix (e.g., "2.500000000 SOL")

### Re-exports for Backward Compatibility

The `getBalance` function is also exported from `client/lib/wallet.ts` (re-exported from `wallet-proxy.ts`) for backward compatibility with existing code.

## Implementation Details

### Wallet Setup Page

**File:** `client/components/wallet/WalletSetup.tsx`

**Changes:**

1. Added state management for SOL balance:
   - `solBalance`: Stores fetched balance
   - `isFetchingBalance`: Loading state during fetch

2. Updated `handleWalletSetup()` function:
   - After wallet creation/import, fetches SOL balance
   - Displays balance in a prominent card
   - Shows loading indicator while fetching

3. Balance Display:
   - Located after wallet confirmation
   - Shows full 9-decimal precision
   - Includes helpful message about wallet readiness

**UX Flow:**

```
1. User creates/imports wallet
2. [Wallet setup confirms]
3. [Fetching SOL balance...] ← Loading indicator
4. Balance card displays ← Shows actual balance
5. User completes setup
```

### Dashboard Integration

**File:** `client/components/wallet/Dashboard.tsx`

**Features:**

1. Auto-refresh every 1 minute
2. Manual refresh via button click
3. Scroll-triggered refresh (50px threshold)
4. Displays total portfolio value in USD
5. Shows individual token balances (including SOL)
6. Caches balance for offline support

## Usage Examples

### In React Components

#### Using the Service Functions

```typescript
import { fetchSolBalance, displaySolBalance } from "@/lib/services/sol-balance";

// Fetch balance
const balance = await fetchSolBalance(publicKey);
console.log(`Balance: ${displaySolBalance(balance)}`);

// Format for display
const formatted = displaySolBalance(5.123456789, 4); // "5.1235 SOL"
```

#### Using the Context

```typescript
import { useWallet } from "@/contexts/WalletContext";

const { balance, refreshBalance } = useWallet();

// Manually refresh
await refreshBalance();

// Access balance
console.log(`SOL: ${balance}`);
```

### Direct API Calls

```typescript
// Fetch directly from endpoint
const response = await fetch(
  `/api/wallet/balance?publicKey=EtZ2AqEHo53BN4CbGeXwtDsqkVJktSc6nqKnCNtpeA4Y`,
);
const data = await response.json();
console.log(`Balance: ${data.balance} SOL`);
```

## Environment Configuration

### Required Variables

For production deployments, set one of:

**Option 1: Helius API Key (Recommended)**

```bash
HELIUS_API_KEY=your_helius_api_key
```

**Option 2: Helius RPC URL**

```bash
HELIUS_RPC_URL=https://mainnet.helius-rpc.com
```

**Option 3: Custom Solana RPC**

```bash
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

### Default Behavior

If no variables are set, the system falls back to the public Solana RPC endpoint:

```
https://solana.publicnode.com
```

**Note:** Public RPC has rate limits. For production use, configure at least one of the above.

## Pages Using SOL Balance

### 1. **Wallet Setup Page**

- **Component:** `client/components/wallet/WalletSetup.tsx`
- **When:** After wallet creation or import
- **Display:** Full 9-decimal balance in green card
- **Purpose:** Confirm wallet is ready to receive funds

### 2. **Dashboard Page**

- **Component:** `client/components/wallet/Dashboard.tsx`
- **When:** Main wallet view
- **Display:**
  - Total portfolio value (USD)
  - Individual SOL token card
  - Automatic refresh every 60 seconds
- **Purpose:** Real-time balance monitoring

### 3. **Other Pages**

Balance can be accessed from any page using the `useWallet()` hook:

- **Accounts Page:** Account selection and balance display
- **Send/Receive Pages:** Display sender/recipient balance
- **Token Detail Pages:** Show SOL balance context

## Error Handling

### API Errors

- **500 Server Error:** RPC provider unreachable
  - **Recovery:** Retries with fallback endpoints
  - **User Impact:** Falls back to cached balance

- **400 Bad Request:** Missing/invalid public key
  - **Recovery:** Validates input before API call
  - **User Impact:** Shows validation error

### Network Errors

- **Timeout:** RPC endpoint takes >15 seconds
  - **Recovery:** AbortController cancels request
  - **User Impact:** Shows timeout error, uses cached balance

### Fallback Behavior

1. Try primary RPC endpoint
2. If fails, try fallback endpoint
3. If all fail, use cached balance
4. If no cache, show 0 SOL with error message

## Testing

### Manual Testing Checklist

- [ ] Create new wallet and verify balance displays
- [ ] Import wallet and verify balance displays
- [ ] Check balance updates on dashboard refresh
- [ ] Verify auto-refresh works (1 minute interval)
- [ ] Test with different public keys
- [ ] Verify error handling with invalid addresses
- [ ] Check mobile responsiveness of balance card
- [ ] Verify offline mode uses cached balance

### Test Cases

```typescript
// Valid wallet with balance
const testKey = "EtZ2AqEHo53BN4CbGeXwtDsqkVJktSc6nqKnCNtpeA4Y";
const balance = await fetchSolBalance(testKey);
expect(balance).toBeGreaterThanOrEqual(0);

// Invalid wallet address
expect(() => fetchSolBalance("invalid")).toThrow();

// Format balance
expect(displaySolBalance(2.5)).toBe("2.5 SOL");
expect(displaySolBalance(0.123456789, 4)).toBe("0.1235 SOL");
```

## Performance Considerations

### Caching Strategy

- **Setup Page:** Fetches once after wallet creation
- **Dashboard:** Uses WalletContext cache + periodic refresh
- **Offline Support:** LocalStorage caches last known balance
- **TTL:** No explicit TTL; refreshes on demand or interval

### Optimization Tips

1. **Reduce Refresh Frequency:** Adjust 60-second interval in Dashboard
2. **Batch Requests:** Group multiple balance queries together
3. **Use Cache:** Implement stale-while-revalidate pattern
4. **Debounce:** Debounce manual refresh button clicks

## Troubleshooting

### Balance Shows 0 or Won't Update

1. Check RPC configuration (`HELIUS_API_KEY`, `SOLANA_RPC_URL`)
2. Verify public key is valid Solana address
3. Check browser console for error messages
4. Try manual refresh button
5. Clear browser cache and localStorage

### API Returns 502 Error

1. Verify RPC endpoint is responding
2. Check network connectivity
3. Ensure no rate limiting issues
4. Try fallback RPC endpoint

### Balance Takes Long to Load

1. Check RPC endpoint performance
2. Increase timeout if needed
3. Consider using Helius API for better performance
4. Monitor network requests in browser dev tools

## Future Enhancements

1. **Price Conversion:** Display balance in USD
2. **Notifications:** Alert on balance changes
3. **Transaction History:** Show recent transactions
4. **Balance Predictions:** Estimate balance after pending transactions
5. **Multi-Wallet Support:** Display aggregate balance across accounts
6. **Mobile Optimization:** Larger touch targets for mobile users

## References

- Backend implementation: `server/routes/wallet-balance.ts`
- Service layer: `client/lib/services/sol-balance.ts`
- Context management: `client/contexts/WalletContext.tsx`
- Component: `client/components/wallet/WalletSetup.tsx`
- API documentation: `API_ENDPOINTS_REFERENCE.md`

## Support

For issues or questions:

1. Check error messages in browser console
2. Review this documentation
3. Check RPC provider status
4. Contact development team with error details
