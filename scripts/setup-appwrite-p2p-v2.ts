/**
 * Appwrite P2P Setup Script (v2 - for newer Appwrite versions)
 * Creates database and collections for P2P storage
 * 
 * Usage: npx tsx scripts/setup-appwrite-p2p-v2.ts
 */

import { Client, Databases, ID } from "node-appwrite";

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "p2p_db";

interface Collection {
  id: string;
  name: string;
}

const COLLECTIONS: Collection[] = [
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

async function setupAppwrite() {
  // Validate environment
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
    console.error("❌ Missing Appwrite credentials:");
    console.error(`   APPWRITE_ENDPOINT: ${APPWRITE_ENDPOINT ? "✓" : "✗"}`);
    console.error(`   APPWRITE_PROJECT_ID: ${APPWRITE_PROJECT_ID ? "✓" : "✗"}`);
    console.error(`   APPWRITE_API_KEY: ${APPWRITE_API_KEY ? "✓" : "✗"}`);
    process.exit(1);
  }

  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  const databases = new Databases(client);

  try {
    console.log("🔧 Setting up Appwrite P2P Storage...\n");

    // Step 1: Create Database
    console.log("📦 Creating database...");
    try {
      await databases.create(DATABASE_ID, "P2P Database");
      console.log(`✅ Created database: ${DATABASE_ID}\n`);
    } catch (error: any) {
      if (error?.code === 409) {
        console.log(`⏭️  Database already exists: ${DATABASE_ID}\n`);
      } else {
        throw error;
      }
    }

    // Step 2: Create Collections
    console.log("📋 Creating collections...");
    for (const collection of COLLECTIONS) {
      try {
        await databases.createCollection(
          DATABASE_ID,
          collection.id,
          collection.name,
        );
        console.log(`✅ Created collection: ${collection.id}`);
      } catch (error: any) {
        if (error?.code === 409) {
          console.log(`⏭️  Collection already exists: ${collection.id}`);
        } else {
          console.error(`❌ Error creating ${collection.id}:`, error);
          throw error;
        }
      }
    }

    // Step 3: Create Attributes (using newer API syntax if needed)
    console.log("\n🏷️  Creating attributes...");
    for (const collection of COLLECTIONS) {
      try {
        // Create 'key' attribute (unique identifier)
        try {
          await databases.createStringAttribute(
            DATABASE_ID,
            collection.id,
            "key",
            255,
            true, // required
            undefined,
            true, // unique
          );
          console.log(`✅ Created 'key' attribute for ${collection.id}`);
        } catch (error: any) {
          if (error?.code !== 409) {
            console.warn(`⚠️  Could not create 'key' attribute:`, error?.message);
          } else {
            console.log(`⏭️  'key' attribute already exists for ${collection.id}`);
          }
        }

        // Create 'value' attribute (JSON data storage)
        try {
          await databases.createStringAttribute(
            DATABASE_ID,
            collection.id,
            "value",
            65536,
            true, // required
            "",
          );
          console.log(`✅ Created 'value' attribute for ${collection.id}`);
        } catch (error: any) {
          if (error?.code !== 409) {
            console.warn(`⚠️  Could not create 'value' attribute:`, error?.message);
          } else {
            console.log(`⏭️  'value' attribute already exists for ${collection.id}`);
          }
        }
      } catch (error: any) {
        console.error(`⚠️  Error setting up attributes for ${collection.id}:`, error?.message);
      }
    }

    console.log("\n✨ Setup complete!\n");
    console.log("📝 Environment variables configured:");
    console.log(`   APPWRITE_ENDPOINT=${APPWRITE_ENDPOINT}`);
    console.log(`   APPWRITE_PROJECT_ID=${APPWRITE_PROJECT_ID}`);
    console.log(`   APPWRITE_DATABASE_ID=${DATABASE_ID}`);
    console.log("\n✅ Your Appwrite P2P system is ready to use!");
  } catch (error: any) {
    console.error("❌ Setup failed:", error?.message || error);
    process.exit(1);
  }
}

setupAppwrite();
