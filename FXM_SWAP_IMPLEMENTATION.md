# Fixorium FXM↔SOL Custom Swap Implementation

## Overview
Implemented a custom internal swap flow for the Fixorium (FXM) ↔ SOL token pair in the Wallet Swap page. When users select FXM and SOL (in either direction), the system bypasses Jupiter and uses the Fixorium internal swap engine.

## Key Constants
- **FXM Mint**: `Ghj3B53xFd3qUw3nywhRFbqAnoTEmLbLPaToM7gABm63`
- **Liquidity Wallet**: `Ec72XPYcxYgpRFaNb9b6BHe1XdxtqFjzz2wLRTnx1owA`
- **Memo Format**: `Fixorium Swap FXM↔SOL | SwapID: ####`

## Implementation Files

### Backend
1. **server/routes/fixorium-swap.ts** (NEW)
   - `handleFixoriumSwapRate`: GET endpoint to fetch live FXM↔SOL rates
   - `handleFixoriumSwap`: POST endpoint to execute swaps and return signed transactions
   - Price fetching from Jupiter and DexScreener APIs
   - Transaction building with proper ATA creation and memo inclusion
   - Two-phase swap: User transfer first, backend handles reciprocal transfer

2. **server/index.ts** (MODIFIED)
   - Registered `/api/fixorium-swap/rate` (GET) route
   - Registered `/api/fixorium-swap` (POST) route

### Frontend
1. **client/lib/services/fixorium-swap.ts** (NEW)
   - `FixoriumSwapService` class with methods:
     - `isFxmSolPair()`: Check if swap pair is FXM↔SOL
     - `getSwapRate()`: Fetch the current swap rate
     - `executeSwap()`: Get the signed transaction for the swap

2. **client/components/wallet/SwapInterface.tsx** (MODIFIED)
   - Added state for FXM swaps:
     - `useFxmSwap`: Track if current swap is FXM
     - `fxmSwapQuote`: Store FXM swap rate information
     - `fxmSwapId`: Track the swap ID for traceability
     - `secondaryTxSignature`: For future two-transaction flows
   
   - Modified execution flows:
     - `executeBuySwap()`: Now checks for FXM↔SOL pairs and routes accordingly
     - `executeSellSwap()`: Checks for FXM↔SOL before Jupiter fallback
     - Added `executeFxmBuySwap()`: Handles FXM purchase swaps
     - Added `executeFxmSellSwap()`: Handles FXM sale swaps
     - Added `submitJupiterQuote()`: Extracted Jupiter submission logic
     - Added `submitJupiterQuoteSell()`: Extracted Jupiter sell logic
   
   - Updated success screen:
     - Shows "Fixorium Internal" swap type for FXM swaps
     - Displays Phase 1 transaction with Solscan link
     - Shows Swap ID for traceability
     - Provides clear messaging about when the reciprocal transfer will arrive

## Swap Flow

### FXM → SOL
1. User enters USD amount → Frontend calculates FXM needed
2. User clicks "Buy FXM"
3. System detects it's FXM (input: SOL, output: FXM)
4. Frontend calls `/api/fixorium-swap/rate` to get exchange rate
5. Frontend calls `/api/fixorium-swap` to get signed transaction
6. User signs transaction (transfers FXM from user to liquidity wallet)
7. Transaction submitted to Solana network
8. Success screen shows Phase 1 transaction with Swap ID
9. Backend monitors and sends SOL back from liquidity wallet

### SOL → FXM (Sell)
1. User enters token amount
2. User clicks "Sell FXM"
3. System detects FXM↔SOL pair
4. Frontend calls `/api/fixorium-swap/rate` to get exchange rate
5. Frontend calls `/api/fixorium-swap` to get signed transaction
6. User signs transaction (transfers SOL to liquidity wallet)
7. Transaction submitted to Solana network
8. Success screen shows Phase 1 transaction with Swap ID
9. Backend monitors and sends FXM back from liquidity wallet

## Transaction Features
- **Memo Instruction**: Every swap includes a memo with format "Fixorium Swap FXM↔SOL | SwapID: ####"
- **Traceability**: Swap ID in memo allows tracking individual swaps
- **Solscan Links**: Both transaction links visible on success screen
- **Token ATAs**: Automatic creation of Associated Token Accounts if needed

## Behavior Matrix
| Input | Output | Route | Handler |
|-------|--------|-------|---------|
| SOL | FXM | Fixorium | executeFxmBuySwap |
| FXM | SOL | Fixorium | executeFxmSellSwap |
| Other | Other | Jupiter | Standard Jupiter flow |
| FXM | Other | Jupiter | Standard Jupiter flow |
| Other | FXM | Jupiter | Standard Jupiter flow |

## Future Enhancements
1. Real-time two-transaction monitoring
2. Automatic backend processing of reciprocal transfers
3. Custom slippage settings for Fixorium swaps
4. Enhanced price feeds for more accurate rates
5. Audit logging for all Fixorium swaps

## Testing Checklist
- [ ] FXM → SOL swap with various amounts
- [ ] SOL → FXM swap with various amounts
- [ ] Verify memo is included in transaction
- [ ] Verify Swap ID is displayed
- [ ] Verify Solscan links are correct
- [ ] Verify Jupiter still works for non-FXM pairs
- [ ] Test error handling for insufficient balances
- [ ] Test with missing ATAs (creation should be automatic)
