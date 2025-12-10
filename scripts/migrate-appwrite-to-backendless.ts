/**
 * Migration Script: Appwrite to Backendless
 * Migrates all P2P data from Appwrite to Backendless
 *
 * Usage: npx tsx scripts/migrate-appwrite-to-backendless.ts
 */

import { Client, Databases, Query } from "node-appwrite";

// Appwrite Configuration
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "p2p_db";

// Backendless Configuration
const BACKENDLESS_APP_ID = process.env.BACKENDLESS_APP_ID || "";
const BACKENDLESS_API_KEY = process.env.BACKENDLESS_API_KEY || "";
const BACKENDLESS_URL = process.env.BACKENDLESS_URL || "https://api.backendless.com";

// Collection to Table mappings
const COLLECTION_TABLE_MAP = {
  p2p_orders: "p2p_orders",
  p2p_payment_methods: "p2p_payment_methods",
  p2p_notifications: "p2p_notifications",
  p2p_escrow: "p2p_escrow",
  p2p_disputes: "p2p_disputes",
  p2p_matches: "p2p_matches",
  p2p_rooms: "p2p_rooms",
  p2p_messages: "p2p_messages",
  p2p_merchant_stats: "p2p_merchant_stats",
};

interface MigrationStats {
  totalCollections: number;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errors: Array<{ collection: string; docId: string; error: string }>;
}

const stats: MigrationStats = {
  totalCollections: 0,
  totalRecords: 0,
  successfulRecords: 0,
  failedRecords: 0,
  errors: [],
};

function getBackendlessHeaders(): Record<string, string> {
  return {
    "X-Backendless-Application-Id": BACKENDLESS_APP_ID,
    "X-Backendless-REST-API-Key": BACKENDLESS_API_KEY,
    "Content-Type": "application/json",
  };
}

async function migrateRecordToBackendless(
  table: string,
  record: any,
): Promise<boolean> {
  try {
    const recordId = record.$id;
    const url = `${BACKENDLESS_URL}/${BACKENDLESS_APP_ID}/data/${table}/${recordId}`;

    // Prepare record for Backendless (remove Appwrite-specific fields)
    const backendlessRecord: any = { ...record };
    delete backendlessRecord.$id;
    delete backendlessRecord.$createdAt;
    delete backendlessRecord.$updatedAt;
    delete backendlessRecord.$permissions;
    delete backendlessRecord.$collectionId;
    delete backendlessRecord.$databaseId;

    // Add objectId to match Backendless schema
    backendlessRecord.objectId = recordId;

    // Try to update first, if it fails, create
    let response = await fetch(url, {
      method: "PUT",
      headers: getBackendlessHeaders(),
      body: JSON.stringify(backendlessRecord),
    });

    if (response.status === 404) {
      // Record doesn't exist, create it
      const createUrl = `${BACKENDLESS_URL}/${BACKENDLESS_APP_ID}/data/${table}`;
      response = await fetch(createUrl, {
        method: "POST",
        headers: getBackendlessHeaders(),
        body: JSON.stringify(backendlessRecord),
      });
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return true;
  } catch (error) {
    console.error(`Failed to migrate record ${record.$id}:`, error);
    return false;
  }
}

async function migrateCollection(
  appwriteDb: Databases,
  collectionId: string,
  tableName: string,
): Promise<number> {
  let totalRecords = 0;
  let batchSize = 25;
  let offset = 0;
  let hasMore = true;

  console.log(`\n📦 Migrating collection: ${collectionId} -> ${tableName}`);

  while (hasMore) {
    try {
      const response = await appwriteDb.listDocuments(
        APPWRITE_DATABASE_ID,
        collectionId,
        [Query.limit(batchSize), Query.offset(offset)],
      );

      if (response.documents.length === 0) {
        hasMore = false;
        break;
      }

      console.log(
        `   Processing batch: ${offset}-${offset + response.documents.length}/${response.total}`,
      );

      for (const doc of response.documents) {
        const success = await migrateRecordToBackendless(tableName, doc);
        totalRecords++;

        if (success) {
          stats.successfulRecords++;
        } else {
          stats.failedRecords++;
          stats.errors.push({
            collection: collectionId,
            docId: doc.$id,
            error: "Failed to migrate to Backendless",
          });
        }
      }

      offset += batchSize;

      if (response.documents.length < batchSize) {
        hasMore = false;
      }
    } catch (error) {
      console.error(`Error fetching batch from ${collectionId}:`, error);
      hasMore = false;
    }
  }

  console.log(
    `   ✓ Completed: ${totalRecords} records processed`,
  );
  return totalRecords;
}

async function validateBackendlessSetup(): Promise<boolean> {
  try {
    const response = await fetch(
      `${BACKENDLESS_URL}/${BACKENDLESS_APP_ID}/data/p2p_orders?pageSize=1`,
      {
        method: "GET",
        headers: getBackendlessHeaders(),
      },
    );

    if (!response.ok) {
      if (response.status === 404 || response.status === 400) {
        console.warn("⚠️  Tables not found in Backendless. They will be created on first insert.");
        return true;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error("Error validating Backendless setup:", error);
    return false;
  }
}

async function runMigration() {
  console.clear();
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     APPWRITE → BACKENDLESS P2P DATA MIGRATION TOOL        ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // Validate environment
  console.log("🔍 Validating configuration...");
  const missingVars = [];

  if (!APPWRITE_ENDPOINT) missingVars.push("APPWRITE_ENDPOINT");
  if (!APPWRITE_PROJECT_ID) missingVars.push("APPWRITE_PROJECT_ID");
  if (!APPWRITE_API_KEY) missingVars.push("APPWRITE_API_KEY");
  if (!BACKENDLESS_APP_ID) missingVars.push("BACKENDLESS_APP_ID");
  if (!BACKENDLESS_API_KEY) missingVars.push("BACKENDLESS_API_KEY");

  if (missingVars.length > 0) {
    console.error("\n❌ Missing environment variables:");
    missingVars.forEach((v) => console.error(`   - ${v}`));
    process.exit(1);
  }

  console.log("✅ Configuration valid\n");

  // Validate Backendless
  console.log("🔗 Validating Backendless connection...");
  const isBackendlessValid = await validateBackendlessSetup();
  if (!isBackendlessValid) {
    console.error("❌ Failed to validate Backendless setup");
    process.exit(1);
  }
  console.log("✅ Backendless connection valid\n");

  // Initialize Appwrite
  console.log("🔗 Connecting to Appwrite...");
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  const appwriteDb = new Databases(client);

  console.log("✅ Connected to Appwrite\n");

  // Start migration
  console.log("🚀 Starting P2P data migration...");
  const startTime = Date.now();

  try {
    for (const [collectionId, tableName] of Object.entries(
      COLLECTION_TABLE_MAP,
    )) {
      stats.totalCollections++;

      try {
        const recordsInCollection = await migrateCollection(
          appwriteDb,
          collectionId,
          tableName,
        );
        stats.totalRecords += recordsInCollection;
      } catch (error) {
        console.error(`❌ Error migrating collection ${collectionId}:`, error);
      }
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Print summary
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                   MIGRATION SUMMARY                        ║");
  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log(`║ Collections Processed: ${String(stats.totalCollections).padEnd(45)}║`);
  console.log(`║ Total Records Migrated: ${String(stats.totalRecords).padEnd(43)}║`);
  console.log(
    `║ Successful: ${String(`${stats.successfulRecords} ✓`).padEnd(56)}║`,
  );
  console.log(
    `║ Failed: ${String(`${stats.failedRecords} ✗`).padEnd(59)}║`,
  );
  console.log(`║ Duration: ${String(`${duration}s`).padEnd(57)}║`);
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  if (stats.failedRecords > 0) {
    console.log("⚠️  Failed Records:");
    stats.errors.forEach((error) => {
      console.log(`   - ${error.collection}/${error.docId}: ${error.error}`);
    });
  }

  if (stats.failedRecords === 0) {
    console.log("✅ Migration completed successfully!");
    console.log("\n📋 Next steps:");
    console.log("   1. Verify data in Backendless dashboard");
    console.log("   2. Update your environment variables:");
    console.log("      - BACKENDLESS_APP_ID=" + BACKENDLESS_APP_ID);
    console.log("      - BACKENDLESS_API_KEY=<your-api-key>");
    console.log("   3. Restart your application");
  } else {
    console.log(
      `⚠️  Migration completed with ${stats.failedRecords} errors. Please review and retry.`,
    );
  }
}

runMigration().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
