# Token Price Loading Indicator - Implementation Summary

## Objective
Show 3 bouncing dots (loading indicator) instead of fallback prices while retrying to fetch token live prices, on both mobile and desktop displays.

## Changes Made

### 1. Enhanced PriceLoader Component
**File:** `client/components/ui/price-loader.tsx`

Improvements:
- Added **3 configurable sizes**: `sm` (4px), `md` (6px), `lg` (8px)
- Improved animation: **blink + vertical bounce** effect (more noticeable than static blinking)
- Animation timing: 1.4s cycle with staggered delays (0s, 0.2s, 0.4s)
- Gradient color: Green (#22c55e to #16a34a) - matches wallet theme
- Better visibility: Opacity range 0.4-1.0 for clear loading state indication

### 2. Dashboard Loading State Detection
**File:** `client/components/wallet/Dashboard.tsx`

Added new helper function:
```typescript
const areTokenPricesLoading = (): boolean => {
  return tokens.some(
    (token) =>
      typeof token.balance === "number" &&
      token.balance > 0 &&
      token.price === undefined
  );
};
```

This function detects when:
- User has token balance
- Token price is still undefined (API hasn't returned a value yet)
- Show PriceLoader instead of fallback price or 0.00

### 3. Portfolio Value Display
**Updated locations:**
- Portfolio total header: Shows `PriceLoader` (size: `lg`) when any prices are loading
- Individual token price: Shows `PriceLoader` (size: `sm`) when price is undefined
- Individual token USD balance: Shows `PriceLoader` (size: `sm`) when price is undefined
- Zero balance state: Shows `PriceLoader` when prices are being fetched

### 4. Price Handling Logic
**Verified in WalletContext:**
- When all APIs fail to fetch prices, `price` field is set to `undefined` (not fallback prices)
- Dashboard component checks for `undefined` and displays loading indicator
- Never shows fallback prices to the user during retry phase

## How It Works

### Mobile & Desktop Behavior:
1. User opens wallet or navigates to dashboard
2. Prices are being fetched from API
3. Instead of showing "0.00" or fallback prices:
   - **Portfolio total**: Shows 3 bouncing dots (large)
   - **Token prices**: Show 3 bouncing dots (small)
   - **Token USD balance**: Show 3 bouncing dots (small)

4. Background retry mechanism:
   - WalletContext has 30-second auto-refresh interval
   - Uses `retryWithExponentialBackoff` with up to 50 retry attempts
   - Keeps retrying until live prices are fetched
   - Once price is available, loading indicator disappears and price is displayed

### Retry Flow:
```
API Call Fails
     ↓
Price = undefined
     ↓
Show PriceLoader ••• 
     ↓
Retry in background (exponential backoff)
     ↓
Live price fetched successfully
     ↓
Price = actual value
     ↓
Display price (PriceLoader disappears)
```

## Technical Details

### Retry Configuration:
- **Development**: Up to 50 retries with short delays (AGGRESSIVE_RETRY_OPTIONS)
- **Background interval**: 30 seconds between full portfolio refreshes
- **Per-API attempts**: Multiple fallback sources (DexScreener → Jupiter → CoinGecko)

### Price Priority:
1. DexScreener API (primary)
2. Jupiter API (fallback)
3. CoinGecko API (secondary fallback)
4. Cached prices from localStorage (offline support)
5. Hardcoded fallback only shown as last resort in retry logic

## Files Modified
1. `client/components/ui/price-loader.tsx` - Enhanced with size options and better animation
2. `client/components/wallet/Dashboard.tsx` - Added loading state detection and updated UI
3. `functions/api/[[path]].ts` - Removed SOL price interception (from previous fix)
4. `functions/api/sol/price.ts` - Enhanced with better fallback chain (from previous fix)

## Testing Notes
- Loading dots appear immediately when wallet loads
- Dots continue showing while prices are being fetched
- Once APIs respond with prices, dots disappear and prices display
- Works on both mobile (375px) and desktop (1024px+) viewports
- Never displays fallback prices during loading phase

## User Experience
✅ Clear visual feedback that prices are loading
✅ No misleading fallback prices displayed
✅ Continuous retry in background (transparent to user)
✅ Professional animation that matches wallet theme
✅ Works consistently across mobile and desktop
