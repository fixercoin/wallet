# P2P System Configuration

This document describes how the P2P (Peer-to-Peer) trading system is configured to use system-level accounts for secure cryptocurrency and fiat currency transactions.

## System Configuration Overview

The P2P system uses two primary system-level accounts to facilitate all transactions:

### 1. **System Seller Wallet (Crypto Intermediary)**

- **Address**: `7jnAb5imcmxFiS6iMvgtd5Rf1HHAyASYdqoZAQesJeSw`
- **Purpose**: Acts as the intermediary for all cryptocurrency transfers
- **Role**:
  - Receives cryptocurrency from sellers when they create sell orders
  - Sends cryptocurrency to buyers when they complete purchase transactions
  - Ensures secure custody and transfer of digital assets

### 2. **System Buyer Account (Fiat Intermediary)**

- **Account Holder**: AMEER NAWAZ KHAN
- **Account Number**: 03107044833
- **Payment Method**: EASYPAISA
- **Purpose**: Acts as the intermediary for fiat currency (PKR) transfers
- **Role**:
  - Receives PKR from buyers when they confirm payment
  - Pays PKR to sellers after their orders are completed
  - Ensures secure handling of fiat transactions

## Transaction Flow

### Buy Order Flow (Buyer Perspective)

1. **Buyer creates a BUY order** with:
   - Amount of crypto they want to buy
   - Price in PKR
   - Auto-filled with system buyer account details

2. **Order is matched with a seller**

3. **Buyer confirms payment** by:
   - Transferring PKR to the system buyer account
   - Amount: Order Total PKR = Token Amount × Price per Token

4. **System wallet receives crypto transfer**:
   - System wallet receives the cryptocurrency from seller

5. **Buyer receives crypto**:
   - System wallet sends the confirmed crypto to buyer's wallet

### Sell Order Flow (Seller Perspective)

1. **Seller creates a SELL order** with:
   - Amount of crypto they want to sell
   - Price in PKR
   - Auto-filled with system seller wallet address

2. **Order is matched with a buyer**

3. **Seller transfers crypto**:
   - Transfers crypto to the system seller wallet
   - Amount: Exact token amount specified in order

4. **Buyer confirms payment**:
   - Buyer sends PKR to system buyer account
   - Amount: Order Total PKR

5. **Seller receives PKR**:
   - System sends PKR to seller's configured payment method

## Configuration Files

### Client-Side Configuration

**File**: `client/lib/constants/system-config.ts`

```typescript
export const SYSTEM_P2P_CONFIG: SystemP2PConfig = {
  sellerWallet: "7jnAb5imcmxFiS6iMvgtd5Rf1HHAyASYdqoZAQesJeSw",
  buyerAccount: {
    accountName: "AMEER NAWAZ KHAN",
    accountNumber: "03107044833",
    paymentMethod: "EASYPAISA",
  },
  enabled: true,
};
```

To disable system accounts and allow users to specify custom accounts, change `enabled: false`.

## User Interface Integration

### PostOrder Page (`client/pages/PostOrder.tsx`)

- **Buy Mode**: Auto-fills with system buyer account (AMEER NAWAZ KHAN, 03107044833)
- **Sell Mode**: Auto-fills with system seller wallet address
- Fields are disabled when system accounts are enabled
- Green info banner confirms use of official system accounts

### BuyerOrderConfirmation (`client/pages/BuyerOrderConfirmation.tsx`)

- Displays system buyer account details prominently
- Shows where the buyer needs to send payment
- Displays seller details and payment instructions
- Uses `SystemAccountDisplay` component for clear formatting

### SellerOrderConfirmation (`client/pages/SellerOrderConfirmation.tsx`)

- Displays system seller wallet address
- Shows where the seller needs to send crypto
- Displays buyer payment account details
- Uses `SystemAccountDisplay` component for verification

## Components

### SystemAccountDisplay (`client/components/p2p/SystemAccountDisplay.tsx`)

Reusable component that displays system account information with:

- Copy-to-clipboard functionality
- Clear labeling of system accounts
- Security notices and verification messages
- Compact and full variants for different layouts

### P2PTransferInstructions (`client/components/p2p/P2PTransferInstructions.tsx`)

Component that displays step-by-step transfer instructions for:

- Buy orders: How to send payment and receive crypto
- Sell orders: How to send crypto and receive payment

## Libraries and Utilities

### System Configuration (`client/lib/constants/system-config.ts`)

- `getSystemSellerWallet()`: Returns the system seller wallet address
- `getSystemBuyerAccount()`: Returns the system buyer account details
- `isSystemP2PEnabled()`: Checks if system accounts are enabled

### P2P Transfer Logic (`client/lib/p2p-transfer.ts`)

- `getTransferRecipient()`: Determines who receives in a transfer
- `getTransferSender()`: Determines who sends in a transfer
- `getP2PTransferDetails()`: Gets full transfer details
- `validateTransferConfiguration()`: Validates transfer setup
- `generateTransferInstructions()`: Creates user-friendly instructions

## Security Considerations

1. **Immutable Configuration**: System wallet addresses are hardcoded in the configuration
2. **Clear Labeling**: All system accounts are clearly marked as "official system accounts"
3. **Copy Protection**: Account details have easy copy functionality to prevent typos
4. **Verification Messages**: Security notices remind users to verify addresses

## Modifying System Accounts

To change the system accounts:

1. **Edit** `client/lib/constants/system-config.ts`
2. **Update** the `SYSTEM_P2P_CONFIG` object with new wallet/account details
3. **Rebuild** and redeploy the application
4. **Test** the P2P flow to ensure transfers work correctly

Example:

```typescript
export const SYSTEM_P2P_CONFIG: SystemP2PConfig = {
  sellerWallet: "NEW_SOLANA_WALLET_ADDRESS_HERE",
  buyerAccount: {
    accountName: "NEW_ACCOUNT_NAME",
    accountNumber: "NEW_ACCOUNT_NUMBER",
    paymentMethod: "EASYPAISA", // or other method
  },
  enabled: true,
};
```

## Disabling System Accounts

To allow users to specify custom accounts (fallback mode):

```typescript
export const SYSTEM_P2P_CONFIG: SystemP2PConfig = {
  // ... accounts still configured as fallback ...
  enabled: false, // Disable system accounts
};
```

This will:

- Allow users to enter custom wallet addresses
- Not auto-fill form fields
- Show optional system account info instead of enforcement

## Testing the P2P Flow

1. **Create a Buy Order**:
   - Verify system buyer account is auto-filled
   - Check that fields are disabled
   - Confirm green banner shows system account info

2. **Create a Sell Order**:
   - Verify system seller wallet is auto-filled
   - Check that wallet field is disabled
   - Confirm transfer instructions display system wallet

3. **Verify Transfer Instructions**:
   - Check that buy order shows correct payment method
   - Check that sell order shows correct receiving wallet
   - Verify security notices are displayed

## API Integration

The system configuration is used in:

1. **Order Creation** (`createP2POrder`):
   - Account details are stored with the order
   - Transfer details are recorded for audit trail

2. **Order Confirmation** (`SellerOrderConfirmation`, `BuyerOrderConfirmation`):
   - System accounts are displayed to users
   - Transfer instructions guide users through the process

3. **Transfer Logic** (`p2p-transfer.ts`):
   - Validates that transfers use correct accounts
   - Prevents transfers to wrong addresses

## Troubleshooting

### Users can't copy system account details

- Check that `SystemAccountDisplay` component is properly imported
- Verify browser clipboard permissions are granted

### System wallet address not showing in sell orders

- Verify `isSystemP2PEnabled()` returns true
- Check that `system-config.ts` has valid wallet address
- Ensure sell mode is selected when creating order

### System buyer account not auto-filling in buy mode

- Verify `isSystemP2PEnabled()` returns true
- Check that `system-config.ts` has complete buyer account details
- Ensure buy mode is selected when creating order

## Related Files

- `client/lib/constants/system-config.ts` - System configuration
- `client/lib/p2p-transfer.ts` - Transfer logic
- `client/lib/p2p-api.ts` - P2P API client
- `client/pages/PostOrder.tsx` - Order creation page
- `client/pages/BuyerOrderConfirmation.tsx` - Buyer confirmation
- `client/pages/SellerOrderConfirmation.tsx` - Seller confirmation
- `client/components/p2p/SystemAccountDisplay.tsx` - Account display component
- `client/components/p2p/P2PTransferInstructions.tsx` - Transfer instructions
