/**
 * Appwrite Configuration
 * Manages connection to Appwrite database for P2P storage
 */

import { Client, Databases, Account } from "node-appwrite";

let appwriteClient: Client | null = null;
let appwriteDatabase: Databases | null = null;

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "p2p_db";

/**
 * Collection IDs for P2P data
 */
export const APPWRITE_COLLECTIONS = {
  ORDERS: "p2p_orders",
  PAYMENT_METHODS: "p2p_payment_methods",
  NOTIFICATIONS: "p2p_notifications",
  ESCROW: "p2p_escrow",
  DISPUTES: "p2p_disputes",
  MATCHES: "p2p_matches",
  ROOMS: "p2p_rooms",
  MESSAGES: "p2p_messages",
  MERCHANT_STATS: "p2p_merchant_stats",
};

export function initializeAppwrite(): { client: Client; database: Databases } {
  if (!appwriteClient || !appwriteDatabase) {
    if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
      throw new Error(
        "Appwrite credentials missing: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY",
      );
    }

    appwriteClient = new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID)
      .setKey(APPWRITE_API_KEY);

    appwriteDatabase = new Databases(appwriteClient);
  }

  return { client: appwriteClient, database: appwriteDatabase };
}

export function getAppwriteDatabase(): Databases {
  const { database } = initializeAppwrite();
  return database;
}

export function getAppwriteClient(): Client {
  const { client } = initializeAppwrite();
  return client;
}

export function getDatabaseId(): string {
  return APPWRITE_DATABASE_ID;
}
