# Appwrite P2P Migration Guide

This guide will help you migrate P2P functions from Cloudflare KV to Appwrite database.

## Prerequisites

1. Appwrite instance running (self-hosted or cloud)
2. Appwrite API credentials (endpoint, project ID, API key)
3. Node.js environment setup

## Step 1: Set up Appwrite Instance

### Option A: Self-Hosted Appwrite
```bash
docker run -d \
  -h localhost \
  -p 80:80 \
  -p 443:443 \
  --name appwrite \
  --volume /var/run/docker.sock:/var/run/docker.sock \
  --volume appwrite_data:/storage/uploads \
  --volume appwrite_cache:/storage/cache \
  appwrite/appwrite:latest
```

### Option B: Cloud Appwrite
Visit https://cloud.appwrite.io and create a project.

## Step 2: Create Database and Collections

### Create Database
1. Go to Appwrite Console
2. Create a new database named "p2p_db" (or note your database ID)
3. Copy the database ID

### Create Collections

Run the following script to create collections:

```typescript
import { Client, Databases, ID } from "node-appwrite";

const client = new Client()
  .setEndpoint("YOUR_APPWRITE_ENDPOINT")
  .setProject("YOUR_PROJECT_ID")
  .setKey("YOUR_API_KEY");

const databases = new Databases(client);

const collections = [
  { id: "p2p_orders", name: "P2P Orders" },
  { id: "p2p_payment_methods", name: "Payment Methods" },
  { id: "p2p_notifications", name: "Notifications" },
  { id: "p2p_escrow", name: "Escrow" },
  { id: "p2p_disputes", name: "Disputes" },
  { id: "p2p_matches", name: "Matches" },
  { id: "p2p_rooms", name: "Trade Rooms" },
  { id: "p2p_messages", name: "Messages" },
  { id: "p2p_merchant_stats", name: "Merchant Stats" },
];

async function setupCollections() {
  const databaseId = "p2p_db";

  for (const collection of collections) {
    try {
      await databases.createCollection(
        databaseId,
        collection.id,
        collection.name,
        "encrypt"
      );
      console.log(`✅ Created collection: ${collection.id}`);
    } catch (error: any) {
      if (error?.code === 409) {
        console.log(`⏭️  Collection already exists: ${collection.id}`);
      } else {
        console.error(`❌ Error creating ${collection.id}:`, error);
      }
    }
  }
}

setupCollections();
```

### Create Attributes for Collections

Each collection needs the following attributes:

```typescript
const attributeConfigs = {
  p2p_orders: [
    { key: "key", type: "string" },
    { key: "value", type: "string" }, // Stores JSON-serialized order
  ],
  p2p_payment_methods: [
    { key: "key", type: "string" },
    { key: "value", type: "string" },
  ],
  p2p_notifications: [
    { key: "key", type: "string" },
    { key: "value", type: "string" },
  ],
  p2p_escrow: [
    { key: "key", type: "string" },
    { key: "value", type: "string" },
  ],
  p2p_disputes: [
    { key: "key", type: "string" },
    { key: "value", type: "string" },
  ],
  p2p_matches: [
    { key: "key", type: "string" },
    { key: "value", type: "string" },
  ],
  p2p_rooms: [
    { key: "key", type: "string" },
    { key: "value", type: "string" },
  ],
  p2p_messages: [
    { key: "key", type: "string" },
    { key: "value", type: "string" },
  ],
  p2p_merchant_stats: [
    { key: "key", type: "string" },
    { key: "value", type: "string" },
  ],
};

async function setupAttributes() {
  const databaseId = "p2p_db";

  for (const [collectionId, attributes] of Object.entries(attributeConfigs)) {
    for (const attr of attributes) {
      try {
        await databases.createStringAttribute(
          databaseId,
          collectionId,
          attr.key,
          attr.key === "key" ? 255 : 65536, // Max sizes
          true // Required
        );
        console.log(`✅ Created attribute: ${collectionId}.${attr.key}`);
      } catch (error: any) {
        if (error?.code === 409) {
          console.log(`⏭️  Attribute exists: ${collectionId}.${attr.key}`);
        } else {
          console.error(`❌ Error creating attribute ${attr.key}:`, error);
        }
      }
    }
  }
}

setupAttributes();
```

## Step 3: Set Environment Variables

Add the following environment variables to your `.env` or deployment configuration:

```bash
# Appwrite Configuration (for P2P storage)
APPWRITE_ENDPOINT=https://your-appwrite-instance.com/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key
APPWRITE_DATABASE_ID=p2p_db
```

## Step 4: Update your configuration

The system will automatically detect Appwrite credentials and use them for P2P storage.

Priority order:
1. **Appwrite** (if APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY are set)
2. **Cloudflare KV** (if CLOUDFLARE_* variables are set)
3. **File-based storage** (development fallback)

## Step 5: Migrate Data from Cloudflare KV to Appwrite

Create a migration script:

```typescript
import { getKVStorage as getCloudflareKV } from "./server/lib/kv-storage";
import { AppwriteKVStore } from "./functions/lib/appwrite-kv-store";

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_NAMESPACE_ID = process.env.CLOUDFLARE_NAMESPACE_ID!;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;

async function migrateP2PData() {
  console.log("Starting P2P data migration from Cloudflare KV to Appwrite...");

  const cloudflareKV = getCloudflareKV();
  const appwriteStore = new AppwriteKVStore(
    process.env.APPWRITE_ENDPOINT!,
    process.env.APPWRITE_PROJECT_ID!,
    process.env.APPWRITE_API_KEY!,
    process.env.APPWRITE_DATABASE_ID || "p2p_db"
  );

  // Get all keys from Cloudflare KV (with prefix filtering)
  const prefixes = [
    "orders:",
    "payment_methods:",
    "notifications:",
    "escrow:",
    "dispute:",
    "p2p_matched_",
    "p2p_merchant_stats_",
    "p2p:",
  ];

  let totalMigrated = 0;

  for (const prefix of prefixes) {
    try {
      console.log(`\nMigrating keys with prefix: ${prefix}`);
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const result = await cloudflareKV.list({
          prefix,
          limit: 100,
          cursor,
        });

        for (const key of result.keys || []) {
          const value = await cloudflareKV.get(key.name);
          if (value) {
            await appwriteStore.put(key.name, value);
            totalMigrated++;
            console.log(`✅ Migrated: ${key.name}`);
          }
        }

        cursor = result.cursor;
        hasMore = !!cursor && result.keys && result.keys.length > 0;
      }
    } catch (error) {
      console.error(`❌ Error migrating prefix ${prefix}:`, error);
    }
  }

  console.log(`\n🎉 Migration complete! Total keys migrated: ${totalMigrated}`);
}

migrateP2PData().catch(console.error);
```

## Step 6: Test the Migration

1. Test P2P order creation
2. Verify payment methods are saved
3. Check notifications and escrow operations
4. Validate dispute creation and resolution

## Step 7: Update Cloudflare Functions (if using)

For Cloudflare Functions, update `functions/api/p2p/*` endpoints to use Appwrite:

```typescript
import { AppwriteKVStore } from "../../lib/appwrite-kv-store";

export const onRequest: PagesFunction = async (context) => {
  const kv = new AppwriteKVStore(
    context.env.APPWRITE_ENDPOINT,
    context.env.APPWRITE_PROJECT_ID,
    context.env.APPWRITE_API_KEY,
    context.env.APPWRITE_DATABASE_ID || "p2p_db"
  );

  // Use kv just like before...
};
```

Update `wrangler.toml` to include Appwrite variables:

```toml
[env.production.vars]
APPWRITE_ENDPOINT = "your-endpoint"
APPWRITE_PROJECT_ID = "your-project-id"
APPWRITE_API_KEY = "your-api-key"
APPWRITE_DATABASE_ID = "p2p_db"
```

## Verification Checklist

- [ ] Appwrite instance is running and accessible
- [ ] Database and collections created
- [ ] Environment variables configured
- [ ] Data migrated from Cloudflare KV
- [ ] P2P orders can be created and retrieved
- [ ] Payment methods work correctly
- [ ] Notifications are saved and marked as read
- [ ] Escrow operations function properly
- [ ] Disputes can be created and resolved
- [ ] Merchant stats are recorded

## Rollback Plan

If issues occur:

1. Keep Cloudflare KV intact (don't delete)
2. Remove Appwrite environment variables
3. System will fall back to Cloudflare KV automatically
4. Troubleshoot and try again

## Support

For issues:
- Check Appwrite logs: `docker logs appwrite`
- Verify API credentials
- Ensure database and collections exist
- Check network connectivity to Appwrite endpoint
