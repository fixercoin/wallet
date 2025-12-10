# Seller Order Confirmation Flow - Issue & Fix

## Problem Identified

When a buyer creates a generic buy order and a seller receives the notification:

1. **Buyer creates a BUY order** → Order stored with `sellerWallet: ""` (empty)
2. **Seller receives notification** → Navigates to `/seller-order-confirmation/{orderId}`
3. **Page loads** → Order loads from storage correctly
4. **Seller clicks Accept** → Order status updates to "ACCEPTED"
5. **BUG**: Order's `sellerWallet` is NOT updated with the seller's wallet address

## Root Cause

When a seller accepts a generic buy order, the system was:

- ✅ Updating order status to "ACCEPTED"
- ✅ Creating a chat room
- ❌ **NOT recording which seller accepted the order** (missing `sellerWallet` update)

This caused downstream issues:

- Buyer notifications wouldn't know which seller accepted the order
- Trade room wouldn't be created properly (requires both buyer and seller wallets)
- Order data would be incomplete for further operations

## Solution Implemented

Updated `client/pages/SellerOrderConfirmation.tsx` with three key changes:

### 1. **handleAcceptOrder** - Record seller's wallet

```typescript
// Before: only updated status
await updateOrderInBothStorages(order.id, {
  status: "ACCEPTED",
});

// After: also records which seller accepted
await updateOrderInBothStorages(order.id, {
  status: "ACCEPTED",
  sellerWallet: wallet.publicKey, // ← NEW: Record the seller's wallet
});
```

### 2. **Auto-create Trade Room if Missing**

```typescript
// If order doesn't have a room, create one when seller accepts
let roomId = order.roomId;
if (!roomId && order.buyerWallet && wallet.publicKey) {
  const room = await createTradeRoom({
    buyer_wallet: order.buyerWallet,
    seller_wallet: wallet.publicKey,
    order_id: order.id,
  });
  roomId = room.id;
  // Persist the new room ID
  await updateOrderInBothStorages(order.id, { roomId });
}
```

### 3. **Similar Fixes for Other Actions**

- `handleRejectOrder`: Also records seller's wallet when rejecting
- `handleCompleteOrder`: Auto-creates room if needed when marking order as complete

## Flow After Fix

```
1. Buyer creates BUY order
   ↓ (Order stored with sellerWallet: "")

2. Seller receives notification "new_buy_order"
   ↓ (Navigates to /seller-order-confirmation/{orderId})

3. Page loads and displays:
   - Order details (token, amount, buyer wallet)
   - Accept Order button
   - Reject Order button

4. Seller clicks "Accept Order"
   ↓ (Order updated with: status="ACCEPTED", sellerWallet="{seller_public_key}")
   ↓ (Trade room created if not exists)

5. Buyer receives notification "order_accepted"
   ↓ (Now knows which seller accepted and seller's wallet is recorded)

6. Order is now complete and properly linked between buyer and seller
```

## Testing

To verify the fix:

1. **Create a BUY order** as Buyer A
2. **Login as Seller B** (different wallet)
3. **Check notifications** → Should see "New Buy Order"
4. **Click notification** → Navigate to `/seller-order-confirmation/{orderId}`
5. **See order details** and confirmation buttons
6. **Click "Accept Order"** button
7. **Verify**:
   - ✅ Order status changes to "ACCEPTED"
   - ✅ Toast shows "Order accepted!"
   - ✅ Buyer A receives notification "order_accepted"
   - ✅ Order now has seller's wallet recorded

## Files Modified

- `client/pages/SellerOrderConfirmation.tsx`
  - Updated `handleAcceptOrder()` function
  - Updated `handleRejectOrder()` function
  - Updated `handleCompleteOrder()` function

## Impact

- ✅ Generic buy orders now work properly
- ✅ Sellers can confirm orders and have their wallet recorded
- ✅ Trade rooms are created automatically if needed
- ✅ Buyer gets proper notifications with seller info
- ✅ No breaking changes to existing functionality
