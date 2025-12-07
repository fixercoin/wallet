# Jupiter Swap 409 Conflict Error - Fix Summary

## Problem Analysis

- **Error**: POST https://wallet.fixorium.com.pk/api/jupiter/swap 409 (Conflict)
- **Root Cause**:
  1. Cloudflare worker (functions/api/[[path]].ts) was returning 409 for stale quotes (inconsistent with server's 530)
  2. Request parameters weren't being normalized properly in Cloudflare implementation
  3. Jupiter quotes expire after ~30 seconds, and the client wasn't being aggressive enough about quote freshness

## Changes Made

### 1. Fixed Cloudflare Worker Handler (functions/api/[[path]].ts)

**Issues Fixed:**

- Now properly normalizes request parameters with defaults (wrapAndUnwrapSol, useSharedAccounts, asLegacyTransaction)
- Prioritizes lite-api v1 endpoint first (more reliable than v6)
- Returns 530 status for stale quotes (matching server implementation)
- Added proper error handling for non-retryable client errors (400, 401, 403)
- Better logging for debugging

**Key Changes:**

```typescript
// Before: parameters not normalized, returned 409 for stale quotes
// After: proper parameter defaults, returns 530 for stale quotes
const swapRequest = {
  quoteResponse: body.quoteResponse,
  userPublicKey: body.userPublicKey,
  wrapAndUnwrapSol:
    body.wrapAndUnwrapSol !== undefined ? body.wrapAndUnwrapSol : true,
  useSharedAccounts:
    body.useSharedAccounts !== undefined ? body.useSharedAccounts : true,
  // ... other defaults
};
```

### 2. Improved src/worker.ts Implementation

**Issues Fixed:**

- Now properly normalizes request parameters
- Added retry logic with multiple Jupiter endpoints
- Proper stale quote detection returning 530 status
- Better error handling matching Cloudflare function

### 3. Enhanced Client-Side Quote Validation (client/components/wallet/SwapInterface.tsx)

**Improvements:**

- Reduced quote freshness threshold from 15 seconds to 10 seconds for refresh
- Added explicit check to prevent execution of quotes older than 30 seconds
- Better error handling with specific message for expired quotes
- More aggressive quote refresh to prevent stale quote errors

**Key Changes:**

```typescript
// More aggressive refresh threshold
const shouldRefresh = timeRemaining <= 10; // was 15

// Added validation before swap execution
if (quoteAge >= QUOTE_MAX_AGE_MS) {
  throw new Error(
    "Quote expired during execution. Please get a new quote and try again.",
  );
}
```

### 4. Updated Quote Validation (client/lib/services/jupiter-v6.ts)

- Added new method `isQuoteAgeAcceptable()` for proper quote age validation
- More robust quote validation checking contextSlot

## Testing Checklist

- [ ] Test swap on deployed version (wallet.fixorium.com.pk)
- [ ] Verify quotes refresh automatically when getting old
- [ ] Confirm swap executes successfully with fresh quotes
- [ ] Test with different token pairs to ensure reliability
- [ ] Monitor logs for "Quote expired" errors (should be rare now)

## Expected Behavior After Fix

1. When user initiates a swap, the quote age is checked
2. If quote is >10 seconds old, a fresh quote is automatically fetched
3. Before sending the swap to Jupiter, the quote age is validated (<30 seconds)
4. If any stale quote error occurs, user gets clear error message to try again
5. Cloudflare and server implementations handle errors consistently (530 for stale quotes)

## Error Handling Flow

```
User clicks "Swap"
  ↓
Check quote age
  ↓
If >10s old: Refresh quote
  ↓
Validate quote is <30s old
  ��
Send swap to Jupiter
  ↓
If 1016 error (stale): Return 530 with STALE_QUOTE error
  ↓
Client shows: "Quote expired - please refresh and try again"
```

## Files Modified

1. `functions/api/[[path]].ts` - Cloudflare worker handler
2. `src/worker.ts` - Backup worker implementation
3. `client/components/wallet/SwapInterface.tsx` - Client swap logic
4. `client/lib/services/jupiter-v6.ts` - Quote validation
