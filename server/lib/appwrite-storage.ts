/**
 * Appwrite Storage Adapter for Express Server
 * Provides KV-like interface using Appwrite Databases
 */

import { Databases, ID, Query } from "node-appwrite";
import {
  getAppwriteDatabase,
  getDatabaseId,
  APPWRITE_COLLECTIONS,
} from "./appwrite-config";

interface KVStorageBackend {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: any): Promise<any>;
}

/**
 * Appwrite-based KV storage implementation
 */
export class AppwriteKVStorage implements KVStorageBackend {
  private database: Databases;
  private databaseId: string;

  constructor() {
    this.database = getAppwriteDatabase();
    this.databaseId = getDatabaseId();
  }

  /**
   * Parse key to determine collection and document ID
   * Format: collection:type:id or collection:id
   */
  private parseKey(key: string): { collection: string; docId: string } {
    const parts = key.split(":");
    if (parts.length < 2) {
      return { collection: APPWRITE_COLLECTIONS.ORDERS, docId: key };
    }

    const prefix = parts[0];
    let collection = APPWRITE_COLLECTIONS.ORDERS;

    if (prefix === "orders") {
      collection = APPWRITE_COLLECTIONS.ORDERS;
    } else if (prefix === "payment_methods") {
      collection = APPWRITE_COLLECTIONS.PAYMENT_METHODS;
    } else if (prefix === "notifications") {
      collection = APPWRITE_COLLECTIONS.NOTIFICATIONS;
    } else if (prefix === "escrow") {
      collection = APPWRITE_COLLECTIONS.ESCROW;
    } else if (prefix === "dispute") {
      collection = APPWRITE_COLLECTIONS.DISPUTES;
    } else if (prefix === "p2p_matched") {
      collection = APPWRITE_COLLECTIONS.MATCHES;
    } else if (prefix === "p2p") {
      if (parts[1] === "rooms") {
        collection = APPWRITE_COLLECTIONS.ROOMS;
      }
    } else if (prefix === "p2p_merchant_stats") {
      collection = APPWRITE_COLLECTIONS.MERCHANT_STATS;
    }

    const docId = key.replace(/:/g, "_").substring(0, 255); // Appwrite document IDs have limits
    return { collection, docId };
  }

  async get(key: string): Promise<string | null> {
    try {
      const { collection, docId } = this.parseKey(key);

      const document = await this.database.getDocument(
        this.databaseId,
        collection,
        docId
      );

      return document.value || null;
    } catch (error: any) {
      if (error?.code === 404) {
        return null;
      }
      console.error(`Error getting key ${key} from Appwrite:`, error);
      return null;
    }
  }

  async put(key: string, value: string): Promise<void> {
    try {
      const { collection, docId } = this.parseKey(key);

      // Try to get existing document
      let doc;
      try {
        doc = await this.database.getDocument(
          this.databaseId,
          collection,
          docId
        );
      } catch {
        doc = null;
      }

      if (doc) {
        // Update existing document
        await this.database.updateDocument(
          this.databaseId,
          collection,
          docId,
          { value }
        );
      } else {
        // Create new document
        await this.database.createDocument(
          this.databaseId,
          collection,
          docId,
          { value, key }
        );
      }
    } catch (error) {
      console.error(`Error putting key ${key} to Appwrite:`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const { collection, docId } = this.parseKey(key);

      await this.database.deleteDocument(this.databaseId, collection, docId);
    } catch (error: any) {
      if (error?.code !== 404) {
        console.error(`Error deleting key ${key} from Appwrite:`, error);
        throw error;
      }
    }
  }

  async list(options?: { prefix?: string; limit?: number }): Promise<any> {
    try {
      const queries: any[] = [];

      if (options?.prefix) {
        queries.push(Query.startsWith("key", options.prefix));
      }

      if (options?.limit) {
        queries.push(Query.limit(options.limit));
      }

      // For simplicity, we'll list from ORDERS collection
      // In a real implementation, you might need to search across collections
      const collection = APPWRITE_COLLECTIONS.ORDERS;

      const result = await this.database.listDocuments(
        this.databaseId,
        collection,
        queries
      );

      return {
        keys: result.documents.map((doc: any) => ({ name: doc.key || doc.$id })),
        total: result.total,
      };
    } catch (error) {
      console.error("Error listing keys from Appwrite:", error);
      return { keys: [] };
    }
  }
}

export default AppwriteKVStorage;
