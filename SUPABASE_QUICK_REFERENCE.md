# Supabase P2P - Quick Reference Card

## 🔐 Credentials

```
URL: https://pcuhmppymboyukkdxuba.supabase.co
Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdWhtcHB5bWJveXVra2R4dWJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNTk3MTIsImV4cCI6MjA3NTgzNTcxMn0.9OhZ6BpUE5K0e1OfGlNN10Vs2lhXa4NXQtEAJBAfspM
```

## 📋 Files Created

| File                                  | Purpose                                      |
| ------------------------------------- | -------------------------------------------- |
| `lib/supabase/niazi.tsx`              | **SQL Schema** - Copy to Supabase SQL Editor |
| `lib/supabase/client.ts`              | Supabase client initialization               |
| `lib/supabase/p2p-orders.ts`          | Order operations                             |
| `lib/supabase/p2p-payment-methods.ts` | Payment management                           |
| `lib/supabase/p2p-escrow.ts`          | Escrow operations                            |
| `lib/supabase/p2p-disputes.ts`        | Dispute management                           |
| `lib/supabase/p2p-notifications.ts`   | Notifications & Chat                         |
| `wrangler-supabase.toml`              | Cloudflare config                            |
| `SUPABASE_P2P_MIGRATION_GUIDE.md`     | Detailed guide                               |
| `SUPABASE_MIGRATION_SUMMARY.md`       | Complete summary                             |

## 🚀 3-Step Quick Start

### 1. Create Database Tables (5 minutes)

```bash
1. Open: https://pcuhmppymboyukkdxuba.supabase.co
2. Go to: SQL Editor
3. Copy entire SQL from: lib/supabase/niazi.tsx
4. Paste and Execute
```

### 2. Update Configuration (2 minutes)

```bash
Update wrangler.toml with Supabase variables:
VITE_SUPABASE_URL = https://pcuhmppymboyukkdxuba.supabase.co
VITE_SUPABASE_ANON_KEY = <the key above>
```

### 3. Update Code (varies)

```typescript
// Replace this:
import { getOrdersByWalletFromAPI } from "@/lib/p2p-order-api";

// With this:
import { getOrdersByWalletFromSupabase } from "@/lib/supabase/p2p-orders";

// Then call:
const orders = await getOrdersByWalletFromSupabase(walletAddress);
```

## 📦 Available Functions

### Orders

```typescript
import * from '@/lib/supabase/p2p-orders';

getOrderFromSupabase(orderId)
getOrdersByWalletFromSupabase(wallet)
getOrdersFromSupabase(filters)
createOrderInSupabase(order)
updateOrderInSupabase(id, updates)
deleteOrderFromSupabase(id)
subscribeToOrderUpdates(id, callback)
```

### Payment Methods

```typescript
import * from '@/lib/supabase/p2p-payment-methods';

getPaymentMethodsByWalletFromSupabase(wallet)
getPaymentMethodFromSupabase(id)
savePaymentMethodToSupabase(method)
deletePaymentMethodFromSupabase(id)
getPaymentMethodByAccountFromSupabase(account)
```

### Escrow

```typescript
import * from '@/lib/supabase/p2p-escrow';

createEscrowInSupabase(data)
getEscrowFromSupabase(id)
getEscrowsByOrderFromSupabase(orderId)
updateEscrowStatusInSupabase(id, status)
getEscrowsByWalletFromSupabase(wallet)
getEscrowsByStatusFromSupabase(status)
subscribeToEscrowUpdates(id, callback)
```

### Disputes

```typescript
import * from '@/lib/supabase/p2p-disputes';

createDisputeInSupabase(data)
getDisputeFromSupabase(id)
getAllDisputesFromSupabase()
getOpenDisputesFromSupabase()
resolveDisputeInSupabase(id, resolution, resolvedBy)
getDisputesByOrderFromSupabase(orderId)
getDisputesByEscrowFromSupabase(escrowId)
subscribeToOpenDisputes(callback)
```

### Notifications & Chat

```typescript
import * from '@/lib/supabase/p2p-notifications';

// Notifications
getNotificationsByWalletFromSupabase(wallet, unreadOnly?)
getNotificationFromSupabase(id)
createNotificationInSupabase(data)
markNotificationAsReadInSupabase(id)
deleteNotificationFromSupabase(id)
subscribeToNotifications(wallet, callback)

// Trade Rooms
createTradeRoomInSupabase(data)
getTradeRoomFromSupabase(id)
updateTradeRoomStatusInSupabase(id, status)
subscribeToTradeRoomUpdates(id, callback)

// Trade Messages
sendTradeMessageInSupabase(data)
getTradeMessagesFromSupabase(roomId)
subscribeToTradeMessages(roomId, callback)
```

## 💡 Common Patterns

### Fetching with Error Handling

```typescript
try {
  const orders = await getOrdersByWalletFromSupabase(wallet);
  if (orders.length === 0) {
    console.log("No orders found");
  }
} catch (error) {
  console.error("Failed to fetch orders:", error);
}
```

### Real-Time Updates (Instead of Polling)

```typescript
// Subscribe to order updates
const unsubscribe = subscribeToOrderUpdates(orderId, (order) => {
  console.log("Order updated:", order);
});

// Clean up when done
unsubscribe();
```

### Creating with Timestamps

```typescript
const order = await createOrderInSupabase({
  wallet_address: wallet,
  type: "BUY",
  token: "SOL",
  amount_tokens: 1,
  amount_pkr: 100000,
  status: "PENDING",
  // created_at and updated_at are automatic
});
```

### Filtering Orders

```typescript
const buyOrders = await getOrdersFromSupabase({
  type: "BUY",
  status: "ACTIVE",
});
```

## 🔄 Real-Time Subscriptions

Use real-time subscriptions instead of polling:

```typescript
// ❌ Old way (polling every second)
setInterval(async () => {
  const orders = await getOrdersByWallet(wallet);
  setOrders(orders);
}, 1000);

// ✅ New way (real-time)
useEffect(() => {
  const unsubscribe = subscribeToOrderUpdates(orderId, (order) => {
    setOrders((prev) => [...prev, order]);
  });
  return () => unsubscribe();
}, []);
```

## 📊 Database Tables

| Table                 | Purpose           | Indexed Columns                     |
| --------------------- | ----------------- | ----------------------------------- |
| `p2p_orders`          | Buy/sell orders   | wallet, status, type, buyer, seller |
| `payment_methods`     | Payment details   | wallet, account_number              |
| `escrow`              | Escrow management | order_id, status, buyer, seller     |
| `disputes`            | Disputes          | status, order_id, escrow_id         |
| `order_notifications` | Notifications     | recipient, read, created_at         |
| `trade_rooms`         | Chat rooms        | buyer, seller, order_id, status     |
| `trade_messages`      | Chat messages     | room_id, sender, created_at         |
| `stakes`              | Staking           | wallet, status                      |
| `rewards`             | Rewards           | wallet, status, stake_id            |

## ⚙️ Environment Variables

### For Frontend (in wrangler.toml)

```
VITE_SUPABASE_URL=https://pcuhmppymboyukkdxuba.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### In Cloudflare Dashboard

Set the same variables in:
Settings > Environment variables > Production

## 🐛 Common Issues

| Issue                   | Solution                                          |
| ----------------------- | ------------------------------------------------- |
| "Table not found"       | Check if SQL was executed in Supabase             |
| "Invalid credentials"   | Verify URL and key are correct                    |
| "No rows returned"      | Check wallet address format                       |
| "Real-time not working" | Ensure table has RLS enabled with proper policies |

## 📚 More Info

- **Detailed Guide**: `SUPABASE_P2P_MIGRATION_GUIDE.md`
- **Full Summary**: `SUPABASE_MIGRATION_SUMMARY.md`
- **SQL Schema**: `lib/supabase/niazi.tsx`
- **Supabase Docs**: https://supabase.com/docs

## 📞 Support

If you need help:

1. Check the detailed migration guide
2. Review Supabase documentation
3. Check browser console for errors
4. Visit Supabase dashboard to inspect data

---

**Ready to migrate?** Start with Step 1: Create Database Tables! 🎯
