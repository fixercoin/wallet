# Backendless P2P Storage Migration

## Overview

This document outlines the complete migration from Appwrite to Backendless for P2P storage in the wallet application.

## What Was Changed

### Files Created

1. **`server/lib/backendless-config.ts`**
   - Backendless configuration management
   - Table mappings for P2P data
   - Initialization functions

2. **`server/lib/backendless-storage.ts`**
   - Express server adapter for Backendless
   - KV-like interface for consistent API
   - Supports all P2P tables: orders, payment_methods, notifications, escrow, disputes, matches, rooms, messages, merchant_stats

3. **`functions/lib/backendless-kv-store.ts`**
   - Cloudflare Functions adapter for Backendless
   - Full compatibility with existing P2P operations
   - Batch operation support

4. **`scripts/migrate-appwrite-to-backendless.ts`**
   - Automated migration script
   - Handles all P2P collections
   - Batch processing with progress reporting
   - Error tracking and recovery

### Files Updated

1. **`functions/lib/kv-store-factory.ts`**
   - Added Backendless support (priority: Backendless > Appwrite > Cloudflare KV)
   - Backward compatible with Appwrite
   - Updated to import BackendlessKVStore

2. **`server/lib/kv-storage.ts`**
   - Added `createBackendlessStorage()` method
   - Updated `createAutoStorage()` to check Backendless first
   - Fallback hierarchy: Backendless > Appwrite > Cloudflare KV > File-based

## Environment Variables

Set the following environment variables:

```bash
BACKENDLESS_APP_ID=A68E8BEA-1070-4690-AD08-90A3D23C5AD0
BACKENDLESS_API_KEY=E24C3F96-2548-4AA8-A4CF-396F049AC63B
BACKENDLESS_URL=https://api.backendless.com (optional, defaults shown)
```

These have been automatically set in your development environment.

## Migration Steps

### Step 1: Create Tables in Backendless

Tables are created automatically on first insert. The following tables will be used:

- `p2p_orders` - Buy/sell orders
- `p2p_payment_methods` - Payment method configurations
- `p2p_notifications` - Order notifications
- `p2p_escrow` - Escrow/fund holding
- `p2p_disputes` - Dispute records
- `p2p_matches` - Matched orders
- `p2p_rooms` - Trade chat rooms
- `p2p_messages` - Room messages
- `p2p_merchant_stats` - Merchant statistics

### Step 2: Migrate Data from Appwrite

Run the migration script:

```bash
npx tsx scripts/migrate-appwrite-to-backendless.ts
```

**Required environment variables for migration:**
- `APPWRITE_ENDPOINT` - Your Appwrite endpoint
- `APPWRITE_PROJECT_ID` - Your Appwrite project ID
- `APPWRITE_API_KEY` - Your Appwrite API key
- `APPWRITE_DATABASE_ID` - Your Appwrite database ID (default: "p2p_db")
- `BACKENDLESS_APP_ID` - Your Backendless application ID
- `BACKENDLESS_API_KEY` - Your Backendless REST API key

The script will:
- Connect to Appwrite and fetch all P2P collections
- Process records in batches of 25
- Migrate each record to Backendless
- Provide detailed progress reporting
- Generate a migration summary with success/failure counts

### Step 3: Verify Migration

Check the migration summary output:
- All records successfully migrated
- No errors reported
- Data accessible in Backendless dashboard

### Step 4: Update Application Configuration

The application will automatically use Backendless if the environment variables are set. The KV storage factory checks for Backendless credentials first:

```typescript
// Priority order:
1. BACKENDLESS_APP_ID + BACKENDLESS_API_KEY (new)
2. APPWRITE_ENDPOINT + APPWRITE_PROJECT_ID + APPWRITE_API_KEY (legacy)
3. STAKING_KV (Cloudflare KV)
4. File-based storage (development fallback)
```

### Step 5: Monitor & Test

- Test P2P order creation
- Verify payment method storage
- Check notification delivery
- Test escrow operations
- Validate dispute handling

## Data Structure

### Key Format

Keys in both storage backends follow this format:

```
prefix:type:id

Examples:
orders:wallet:0x123...        (orders by wallet)
orders:123                     (specific order)
payment_methods:123           (payment method)
notifications:wallet:0x123   (notifications by wallet)
escrow:order:123              (escrow for order)
dispute:123                   (dispute record)
p2p:rooms:123                 (chat room)
```

### Record Schema

Each record in Backendless will have:
- `objectId` - Unique identifier (matches Appwrite $id)
- `key` - Composite key for grouping
- `value` - Serialized JSON data
- Other fields as needed (depends on collection)

## Rollback Procedure

If you need to rollback to Appwrite:

1. Keep your Appwrite environment variables set
2. Remove/unset Backendless environment variables
3. Restart the application
4. The app will automatically fall back to Appwrite

## Performance Considerations

- **Backendless advantage**: Simpler API, automatic table creation
- **Batch size**: Migration uses 25 records per batch (tunable)
- **Network**: Each operation uses single REST API call
- **Caching**: Consider implementing caching layer for frequently accessed data

## Troubleshooting

### Migration Fails

1. Check Backendless credentials
2. Verify Appwrite connection
3. Ensure firewall allows Backendless API access
4. Review error logs for specific collection issues

### Tables Not Created

Backendless creates tables on first insert. If tables don't appear:
1. Verify application ID is correct
2. Check REST API key permissions
3. Monitor Backendless dashboard for creation events

### Records Not Found After Migration

1. Run migration script again with verbose output
2. Check record counts match between Appwrite and Backendless
3. Verify key sanitization (colons replaced with underscores)

## Architecture Overview

### Server-side (Express)

```
server/lib/kv-storage.ts (KVStorage wrapper)
       ↓
server/lib/backendless-storage.ts (BackendlessKVStorage)
       ↓
Backendless REST API
```

### Cloudflare Functions

```
functions/lib/kv-store-factory.ts (getKVStore)
       ↓
functions/lib/backendless-kv-store.ts (BackendlessKVStore)
       ↓
Backendless REST API
```

### P2P Operations

All P2P operations transparently use Backendless:
- Order creation/updates
- Payment method storage
- Notification delivery
- Escrow management
- Dispute handling
- Merchant statistics

## API Endpoints Using Backendless

- `/api/p2p/orders` - Order management
- `/api/p2p/payment-methods` - Payment configuration
- `/api/p2p/notifications` - Order notifications
- `/api/p2p/escrow` - Escrow operations
- `/api/p2p/disputes` - Dispute management
- `/api/p2p/matches` - Order matching

## Next Steps

1. Set Backendless environment variables (✅ Already done)
2. Create Backendless tables (automatic on first use)
3. Run migration script: `npx tsx scripts/migrate-appwrite-to-backendless.ts`
4. Verify data in Backendless dashboard
5. Test P2P functionality
6. Monitor for any issues

## Support

For issues with:
- **Backendless**: Visit https://backendless.com/docs/
- **Migration script**: Check error messages in console output
- **P2P functionality**: Review /api/p2p/* endpoints

## References

- Backendless Documentation: https://backendless.com/docs/
- REST API Guide: https://backendless.com/docs/rest/
- Data Tables: https://backendless.com/docs/rest/data_tables/
