# Supabase P2P Migration Guide

This guide explains how to migrate P2P functionality from Cloudflare KV to Supabase.

## Project Credentials

- **Supabase URL**: `https://pcuhmppymboyukkdxuba.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdWhtcHB5bWJveXVra2R4dWJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNTk3MTIsImV4cCI6MjA3NTgzNTcxMn0.9OhZ6BpUE5K0e1OfGlNN10Vs2lhXa4NXQtEAJBAfspM`

## Files Created

### 1. **lib/supabase/niazi.tsx** - SQL Schema & Interfaces
Complete SQL schema definitions for all P2P tables and TypeScript interfaces for type safety.

**Tables Created:**
- `p2p_orders` - All buy/sell orders
- `payment_methods` - Payment method details
- `escrow` - Escrow management
- `disputes` - Dispute tracking
- `order_notifications` - Order notifications
- `trade_rooms` - Trade chat rooms
- `trade_messages` - Trade messages
- `stakes` - Staking data
- `rewards` - Reward distribution

**How to Use:**
1. Go to your Supabase dashboard: https://pcuhmppymboyukkdxuba.supabase.co
2. Navigate to SQL Editor
3. Copy the entire SQL schema from `P2P_SQL_SCHEMAS` constant in `niazi.tsx`
4. Paste into a new SQL query
5. Click Execute to create all tables

### 2. **lib/supabase/client.ts** - Supabase Client
Initializes and exports the Supabase client with proper configuration.

**Usage:**
```typescript
import { supabase } from '@/lib/supabase/client';

// Use in any component or function
const { data, error } = await supabase.from('p2p_orders').select('*');
```

### 3. **lib/supabase/p2p-orders.ts** - Order Management
Functions for managing P2P orders:
- `getOrderFromSupabase()` - Get single order
- `getOrdersByWalletFromSupabase()` - Get wallet's orders
- `getOrdersFromSupabase()` - Get filtered orders
- `createOrderInSupabase()` - Create new order
- `updateOrderInSupabase()` - Update order
- `deleteOrderFromSupabase()` - Delete order
- `subscribeToOrderUpdates()` - Real-time subscriptions

### 4. **lib/supabase/p2p-payment-methods.ts** - Payment Methods
Functions for managing payment methods:
- `getPaymentMethodsByWalletFromSupabase()`
- `getPaymentMethodFromSupabase()`
- `savePaymentMethodToSupabase()`
- `deletePaymentMethodFromSupabase()`
- `getPaymentMethodByAccountFromSupabase()`

### 5. **lib/supabase/p2p-escrow.ts** - Escrow Management
Functions for escrow operations:
- `createEscrowInSupabase()`
- `getEscrowFromSupabase()`
- `getEscrowsByOrderFromSupabase()`
- `updateEscrowStatusInSupabase()`
- `getEscrowsByWalletFromSupabase()`
- `subscribeToEscrowUpdates()` - Real-time updates

### 6. **lib/supabase/p2p-disputes.ts** - Dispute Management
Functions for dispute handling:
- `createDisputeInSupabase()`
- `getDisputeFromSupabase()`
- `getAllDisputesFromSupabase()`
- `getOpenDisputesFromSupabase()`
- `resolveDisputeInSupabase()`
- `subscribeToOpenDisputes()` - Real-time updates

### 7. **lib/supabase/p2p-notifications.ts** - Notifications & Chat
Functions for notifications and trade messages:

**Notifications:**
- `getNotificationsByWalletFromSupabase()`
- `createNotificationInSupabase()`
- `markNotificationAsReadInSupabase()`
- `subscribeToNotifications()` - Real-time updates

**Trade Rooms:**
- `createTradeRoomInSupabase()`
- `getTradeRoomFromSupabase()`
- `updateTradeRoomStatusInSupabase()`

**Trade Messages:**
- `sendTradeMessageInSupabase()`
- `getTradeMessagesFromSupabase()`
- `subscribeToTradeMessages()` - Real-time updates

### 8. **wrangler-supabase.toml** - Cloudflare Configuration
Updated Cloudflare Pages configuration with Supabase environment variables.

**Key Changes:**
- Removed KV namespace bindings (no longer needed)
- Added Supabase URL and Anon Key to environment variables
- Kept all other Cloudflare Pages settings

## Step-by-Step Migration

### Step 1: Create Supabase Tables

1. Open Supabase dashboard: https://pcuhmppymboyukkdxuba.supabase.co
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Open `lib/supabase/niazi.tsx`
5. Copy the entire SQL from `P2P_SQL_SCHEMAS` constant
6. Paste into the SQL editor
7. Click "Run" button
8. Verify all 9 tables are created under "Tables" section

### Step 2: Update Cloudflare Configuration

1. Replace your `wrangler.toml` with `wrangler-supabase.toml`
   - OR copy the contents and update your existing file
2. The Supabase credentials are already included in environment variables

### Step 3: Update Your Code

Replace all API calls to Cloudflare KV endpoints with Supabase functions.

**Before (Cloudflare KV):**
```typescript
import { getOrdersByWalletFromAPI } from '@/lib/p2p-order-api';

const orders = await getOrdersByWalletFromAPI(walletAddress);
```

**After (Supabase):**
```typescript
import { getOrdersByWalletFromSupabase } from '@/lib/supabase/p2p-orders';

const orders = await getOrdersByWalletFromSupabase(walletAddress);
```

### Step 4: Update Environment Variables in Cloudflare

1. Go to Cloudflare Dashboard
2. Navigate to Pages > Your Project > Settings
3. Go to "Environment variables"
4. Set for all environments:
   - `VITE_SUPABASE_URL` = `https://pcuhmppymboyukkdxuba.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Step 5: Test & Deploy

1. Test all P2P functionality locally
2. Deploy to Cloudflare Pages
3. Monitor logs for any errors
4. Verify all features work correctly

## API Function Mapping

### Orders
| Old Function | New Function |
|---|---|
| `getOrderFromAPI()` | `getOrderFromSupabase()` |
| `getOrdersByWalletFromAPI()` | `getOrdersByWalletFromSupabase()` |
| `createOrderInAPI()` | `createOrderInSupabase()` |
| `updateOrderInAPI()` | `updateOrderInSupabase()` |
| `deleteOrderFromAPI()` | `deleteOrderFromSupabase()` |

### Payment Methods
| Old Function | New Function |
|---|---|
| `getPaymentMethodsByWallet()` | `getPaymentMethodsByWalletFromSupabase()` |
| `savePaymentMethod()` | `savePaymentMethodToSupabase()` |
| `deletePaymentMethod()` | `deletePaymentMethodFromSupabase()` |

### Escrow
| Old Function | New Function |
|---|---|
| `createEscrow()` | `createEscrowInSupabase()` |
| `getEscrow()` | `getEscrowFromSupabase()` |
| `updateEscrowStatus()` | `updateEscrowStatusInSupabase()` |

### Disputes
| Old Function | New Function |
|---|---|
| `createDispute()` | `createDisputeInSupabase()` |
| `getDispute()` | `getDisputeFromSupabase()` |
| `resolveDispute()` | `resolveDisputeInSupabase()` |

## Real-Time Subscriptions

Supabase supports real-time updates using PostgreSQL's LISTEN/NOTIFY.

**Example:**
```typescript
import { subscribeToOrderUpdates } from '@/lib/supabase/p2p-orders';

// Subscribe to updates for a specific order
const unsubscribe = subscribeToOrderUpdates(orderId, (updatedOrder) => {
  console.log('Order updated:', updatedOrder);
});

// Clean up subscription when component unmounts
// unsubscribe();
```

## Benefits of Supabase

1. **Real-time capabilities** - Built-in PostgreSQL LISTEN/NOTIFY
2. **Better querying** - Full SQL support, filtering, ordering
3. **Scale easily** - Managed PostgreSQL database
4. **Type-safe** - TypeScript support for all queries
5. **Auth support** - Integrated authentication
6. **Row-level security** - Control data access with policies
7. **Backups** - Automatic daily backups
8. **API integration** - RESTful API in addition to client SDK

## Troubleshooting

### Tables not created
- Check if SQL was pasted correctly
- Verify all SQL statements executed without errors
- Try creating tables one at a time

### Authentication errors
- Verify Supabase credentials are correct
- Check environment variables in Cloudflare
- Ensure anon key has proper permissions

### Data not syncing
- Check browser console for errors
- Verify Supabase project is active
- Test with Supabase SQL editor directly

## Files to Remove/Update

### Can Remove:
- `functions/api/p2p/orders.ts` - KV-based orders endpoint
- `functions/api/p2p/notifications.ts` - KV-based notifications endpoint
- `functions/api/p2p/payment-methods.ts` - KV-based payments endpoint
- `server/routes/p2p-orders.ts` - Express KV routes
- `server/routes/p2p-notifications.ts` - Express KV routes
- `server/routes/p2p-payment-methods.ts` - Express KV routes

### Need to Update:
- Any component using old API endpoints
- Replace with Supabase client functions
- Update imports and function calls

## Support

For issues:
1. Check Supabase documentation: https://supabase.com/docs
2. Review the SQL schema in `niazi.tsx`
3. Check browser console for client-side errors
4. Check Supabase dashboard > Logs for server-side errors

## Next Steps

1. ✅ Create Supabase tables
2. ✅ Update wrangler.toml
3. ✅ Update code to use Supabase functions
4. ✅ Set environment variables in Cloudflare
5. ✅ Test all P2P features
6. ✅ Deploy to production
7. ✅ Monitor and optimize
