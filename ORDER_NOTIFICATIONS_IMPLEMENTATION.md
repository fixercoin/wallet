# Order Notifications Implementation Guide

## Overview

A complete notification system has been implemented for P2P buy/sell orders. The system supports:

- **In-app notifications** (toast popups + notification center)
- **Push notifications** (browser notifications)
- **Real-time updates** (polling every 3 seconds)
- **Persistent storage** (Cloudflare KV)

## Architecture

### 1. Notification Levels

**Order Created**

- Triggered when buyer creates a buy order or seller creates a sell order
- Admin wallet receives notification (for manual matching)

**Payment Confirmed**

- Triggered when buyer confirms payment in order details
- Seller receives notification

**Received Confirmed**

- Triggered when seller confirms receiving payment
- Buyer receives notification

### 2. Storage Layer (Cloudflare KV)

Extended `functions/lib/kv-utils.ts`:

- `getNotificationsByWallet()` - Fetch notifications for a wallet
- `saveNotification()` - Save new notification to KV
- `markNotificationAsRead()` - Mark notification as read

### 3. API Endpoints

**GET `/api/p2p/notifications`**

- Query params: `wallet` (required), `unread` (optional boolean)
- Returns paginated notifications for the wallet

**POST `/api/p2p/notifications`**

- Body: `{ recipientWallet, senderWallet, type, orderType, message, orderId, orderData }`
- Creates new notification

**PUT `/api/p2p/notifications`**

- Body: `{ notificationId }`
- Marks notification as read

### 4. Client Components

**`client/hooks/use-order-notifications.ts`**

- Hook for managing order notifications
- `fetchNotifications()` - Fetch from API
- `createNotification()` - Create and send notification
- `markAsRead()` - Mark as read
- `showNotificationToast()` - Show in-app toast

**`client/components/NotificationCenter.tsx`**

- Notification bell icon with badge
- Dropdown showing recent notifications
- Click to mark as read
- Auto-poll every 3 seconds

**`client/lib/services/push-notifications.ts`**

- Web Push API integration
- Service worker management
- Browser notification sending
- Permission handling

### 5. Pages Updated

**`client/pages/buy-now.tsx`**

- Creates "order_created" notification for admin wallet when order placed

**`client/pages/sell-now.tsx`**

- Creates "order_created" notification for admin wallet when order placed

**`client/pages/OrderComplete.tsx`**

- Creates "payment_confirmed" notification when buyer confirms
- Creates "received_confirmed" notification when seller confirms

## Data Model

```typescript
interface OrderNotification {
  id: string;
  orderId: string;
  recipientWallet: string;
  senderWallet: string;
  type: "order_created" | "payment_confirmed" | "received_confirmed";
  orderType: "BUY" | "SELL";
  message: string;
  orderData: {
    token: string;
    amountTokens: number;
    amountPKR: number;
  };
  read: boolean;
  createdAt: number;
}
```

## User Workflow

1. **User creates order** (buy-now or sell-now)
   - Order saved to localStorage + KV
   - Notification created in KV (recipient = admin)
   - Admin receives in-app toast + push notification

2. **Admin matches orders** (manual matching)
   - Buyer and seller can now see order details
   - Navigation to OrderComplete page

3. **Buyer confirms payment** (OrderComplete page)
   - Payment verification submitted
   - "payment_confirmed" notification sent to seller
   - Seller receives in-app toast + push notification

4. **Seller confirms received** (OrderComplete page)
   - Receipt verification submitted
   - "received_confirmed" notification sent to buyer
   - Buyer receives in-app toast + push notification

## Features

### Notification Center

- Bell icon (top right corner of app)
- Red badge showing unread count
- Dropdown panel with last notifications
- Auto-refresh every 3 seconds
- Click to mark as read

### Toast Notifications

- Appear on order events
- Auto-dismiss after 5 seconds
- Uses existing Sonner toast library

### Push Notifications

- Browser notifications (when enabled by user)
- Service worker handles background notifications
- Click opens app

## Browser Support

| Feature         | Chrome | Firefox | Safari | Edge |
| --------------- | ------ | ------- | ------ | ---- |
| Web Push API    | ✅     | ✅      | ❌     | ✅   |
| Service Workers | ✅     | ✅      | ✅     | ✅   |
| Notifications   | ✅     | ✅      | ✅     | ✅   |

**Note**: Safari doesn't support Web Push API but still shows notifications through service worker.

## Configuration

No additional configuration needed. The system:

- Uses existing Cloudflare KV binding (`STAKING_KV`)
- Registers service worker automatically
- Requests notification permission on first use
- Falls back gracefully if unsupported

## Testing

### Test order creation notification:

1. Connect wallet
2. Navigate to /buy-now or /sell-now
3. Create an order
4. Admin wallet should see notification bell badge increase
5. Check notification center dropdown

### Test payment confirmation:

1. Go to order-complete page
2. Click "VERIFY" button (buyer)
3. Seller wallet receives "payment_confirmed" notification

### Test received confirmation:

1. Go to order-complete page
2. Click "VERIFY" button (seller)
3. Buyer wallet receives "received_confirmed" notification

## Future Enhancements

- [ ] Email notifications
- [ ] SMS notifications
- [ ] Notification preferences/settings page
- [ ] Notification history/archive
- [ ] Auto-dismiss notifications after 24 hours
- [ ] Batch notifications for multiple orders
- [ ] Notification sounds

## Troubleshooting

### Notifications not appearing

- Check browser notification permission
- Verify wallet is connected
- Check browser console for errors
- Ensure Cloudflare KV is properly bound

### Push notifications not working

- Safari doesn't support Web Push (limitation)
- Check if service worker is registered (`DevTools > Application > Service Workers`)
- Verify notification permission is "granted"
- Check if service-worker.js is accessible

### Real-time delays

- Notifications are polled every 3 seconds
- Max delay = ~3 seconds after event
- Can be reduced if needed (balance vs. performance)

## Files Changed

```
Created:
- functions/api/p2p/notifications.ts
- client/hooks/use-order-notifications.ts
- client/components/NotificationCenter.tsx
- client/lib/services/push-notifications.ts
- public/service-worker.js

Modified:
- functions/lib/kv-utils.ts (added OrderNotification interface + methods)
- client/pages/buy-now.tsx (added notification creation)
- client/pages/sell-now.tsx (added notification creation)
- client/pages/OrderComplete.tsx (added notification on verify)
- client/App.tsx (added NotificationCenter, push notification init)
```
