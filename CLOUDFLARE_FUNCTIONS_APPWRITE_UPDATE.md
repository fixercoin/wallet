# Updating Cloudflare Functions for Appwrite P2P Storage

This document shows the pattern for updating all Cloudflare Functions P2P endpoints to support Appwrite storage.

## Pattern: Import KV Store Factory

### Before:
```typescript
import { KVStore } from "../../lib/kv-utils";

interface Env {
  STAKING_KV: any;
  [key: string]: any;
}
```

### After:
```typescript
import { KVStore } from "../../lib/kv-utils";
import { getKVStore } from "../../lib/kv-store-factory";

interface Env {
  STAKING_KV?: any; // Now optional
  APPWRITE_ENDPOINT?: string;
  APPWRITE_PROJECT_ID?: string;
  APPWRITE_API_KEY?: string;
  APPWRITE_DATABASE_ID?: string;
  [key: string]: any;
}
```

## Pattern: Initialize KV Store

### Before:
```typescript
export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    if (!env.STAKING_KV) {
      return jsonResponse(500, { error: "KV storage not configured" });
    }

    const kv = new KVStore(env.STAKING_KV);
    // ... rest of handler
  }
}
```

### After:
```typescript
export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    let kv: any;
    try {
      kv = getKVStore(env);
    } catch (error) {
      return jsonResponse(500, {
        error: "Storage not configured. Provide either STAKING_KV or Appwrite credentials",
      });
    }

    // ... rest of handler (use kv exactly as before)
  }
}
```

## Files to Update

All P2P functions in `functions/api/p2p/` should be updated:

1. ✅ `functions/api/p2p/orders.ts` - **DONE**
2. `functions/api/p2p/orders/[orderId].ts`
3. `functions/api/p2p/notifications.ts`
4. `functions/api/p2p/disputes.ts`
5. `functions/api/p2p/escrow.ts`
6. `functions/api/p2p/payment-methods.ts`
7. `functions/api/p2p/rooms/index.ts`
8. `functions/api/p2p/rooms/[roomId].ts`
9. `functions/api/p2p/rooms/[roomId]/messages.ts`

## Environment Variables in wrangler.toml

Add these to your `[env.production.vars]` section:

```toml
[env.production.vars]
# Existing Cloudflare KV (optional - falls back to if Appwrite not set)
# CLOUDFLARE_ACCOUNT_ID = "..."
# CLOUDFLARE_NAMESPACE_ID = "..."
# CLOUDFLARE_API_TOKEN = "..."

# Appwrite P2P Storage (preferred)
APPWRITE_ENDPOINT = "https://your-appwrite-instance.com/v1"
APPWRITE_PROJECT_ID = "your_project_id"
APPWRITE_API_KEY = "your_api_key"
APPWRITE_DATABASE_ID = "p2p_db"
```

## Testing After Updates

```bash
# Test order creation
curl -X POST http://localhost:8787/api/p2p/orders \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "test_wallet",
    "type": "BUY",
    "token": "SOL",
    "amountTokens": 10,
    "amountPKR": 50000,
    "paymentMethodId": "pm_test"
  }'

# Test order retrieval
curl http://localhost:8787/api/p2p/orders?wallet=test_wallet
```

## Backwards Compatibility

The system maintains backwards compatibility:
1. If Appwrite credentials are present → use Appwrite
2. Else if STAKING_KV is present → use Cloudflare KV
3. Else → return error

This allows gradual migration and easy rollback.

## Quick Update Script

To update all P2P functions at once, you can use this search/replace pattern:

```bash
# In functions/api/p2p/ directory
find . -name "*.ts" -type f -exec sed -i \
  's/import { KVStore } from "..\/..\/lib\/kv-utils";/import { KVStore } from "..\/..\/lib\/kv-utils";\nimport { getKVStore } from "..\/..\/lib\/kv-store-factory";/' \
  {} \;
```

Then manually update each handler to use `getKVStore(env)` instead of `new KVStore(env.STAKING_KV)`.
