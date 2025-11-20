# Fee Transfer Fix - Fees Not Being Received at Fee Wallet

## Problem
After deploying to Cloudflare, token swaps were executing successfully, but:
1. **Fee transfer instructions were not being added** to swap transactions
2. **MarketMaker bot fees were not reaching** the fee wallet

When checking Solscan, there were no fee transfer instructions visible in transactions.

## Root Causes

### Issue #1: Async getAssociatedTokenAddress Not Awaited
The `getAssociatedTokenAddress` function from `@solana/spl-token` is **async** and returns a Promise, but it was being used **without await** in multiple components. This caused:
- Promise objects to be passed instead of PublicKey instances to transaction instruction creation
- Instructions to fail silently due to invalid parameters
- Fee transfer instructions to never be added to transactions

### Issue #2: MarketMaker Sending Transactions Directly to RPC (CORS Blocked)
The MarketMaker bot was trying to send fee transfer transactions directly to public RPC endpoints from the browser, which gets **blocked by CORS** restrictions. The browser silently fails these requests, causing fees to never be submitted.

## Components Fixed

### 1. **SwapInterface.tsx** (Lines 110-166, 652-662)
**Issue**: Fee transfer instruction not added to swap transactions
- Made `addFeeTransferInstruction()` async and properly awaited `getAssociatedTokenAddress()`
- Added comprehensive logging to debug fee transfer process
- Updated call site to await the function

**Changes**:
```typescript
// Before: getAssociatedTokenAddress used without await (returns Promise)
const userTokenAccount = getAssociatedTokenAddress(fromMintPubkey, userPubkey, false);

// After: Properly awaited
const userTokenAccount = await getAssociatedTokenAddress(fromMintPubkey, userPubkey, false);
```

### 2. **BurnToken.tsx** (Lines 131-184, 456-462)
**Issue**: Fee transfer instruction for token burns not working
- Made `addFeeTransferInstruction()` async
- Added awaits to both `getAssociatedTokenAddress()` calls
- Updated caller to await the function with assignment: `tx = await addFeeTransferInstruction(...)`

### 3. **TokenLock.tsx** (Lines 274-315, 679-685)
**Issue**: Fee transfer instruction for token locks not working  
- Made `addFeeTransferInstruction()` async
- Added awaits to both `getAssociatedTokenAddress()` calls
- Updated caller to await the function

### 4. **Airdrop.tsx** (Lines 458-475)
**Issue**: Fee transfer instruction for airdrops not working
- Added await to the `getAssociatedTokenAddress()` call for fee wallet account

### 5. **MarketMaker.tsx** (Lines 361-434)
**Issue**: Fee transfer transactions not reaching fee wallet due to CORS blocking
- Changed from direct RPC call (`rpcCall("sendTransaction", ...)`) to backend proxy
- Now uses `/api/solana-send` endpoint like SwapInterface
- Added better error handling and logging
- Validates blockhash response properly

**Changes**:
```typescript
// Before: Direct RPC call blocked by browser CORS
const result = await rpcCall("sendTransaction", [txBase64, {...}]);

// After: Uses backend proxy to avoid CORS issues
const response = await fetch("/api/solana-send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ signedBase64: txBase64 }),
});
```

## Expected Behavior After Fix

When users perform swaps (or other token operations), the fee transfer instruction will now be properly added to transactions:

1. **1% fee is calculated** based on the input token amount
2. **Associated token account is resolved** (async call properly awaited)
3. **Fee transfer instruction is created** with correct PublicKey objects
4. **Instruction is added to transaction** before signing
5. **User sees fee deducted** in their balance
6. **Fee reaches the wallet**: `FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM`

## Verification Steps

To verify the fix is working:

1. **Check browser console** for the new debug logs:
   - `[SwapInterface] Attempting to add fee for token: ...`
   - `[SwapInterface] Adding SOL fee instruction: ... lamports to ...`
   - `[SwapInterface] Adding SPL token fee instruction: ...`
   - `[SwapInterface] Fee instruction added successfully`

2. **Check Solscan** for swap transactions:
   - Should now see fee transfer instruction
   - Fee should be transferred to `FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM`

3. **Check user balance** after swap:
   - Should see 1% fee deducted from swap input amount

## Technical Details

- **@solana/spl-token version**: 0.4.14 (async getAssociatedTokenAddress)
- **Fee percentage**: 0.01 (1%)
- **Fee wallet**: `FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM`
- **Affected operations**: Swaps, Token Burns, Token Locks, Airdrops

## Deployment Notes

These changes fix fee collection across all token operations:
- ✅ Token swaps (SwapInterface)
- ✅ Token burns (BurnToken)
- ✅ Token locks (TokenLock)
- ✅ Airdrops (Airdrop)

All changes are backward compatible and do not affect transaction execution, only the fee transfer instruction generation.
