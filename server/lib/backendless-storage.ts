/**
 * Backendless Storage Adapter for Express Server
 * Provides KV-like interface using Backendless REST API
 */

import { getBackendlessConfig, BACKENDLESS_TABLES } from "./backendless-config";

interface KVStorageBackend {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: any): Promise<any>;
}

/**
 * Backendless-based KV storage implementation
 */
export class BackendlessKVStorage implements KVStorageBackend {
  private appId: string;
  private apiKey: string;
  private url: string;

  constructor() {
    const config = getBackendlessConfig();
    this.appId = config.appId;
    this.apiKey = config.apiKey;
    this.url = config.url;
  }

  private getHeaders(): Record<string, string> {
    return {
      "X-Backendless-Application-Id": this.appId,
      "X-Backendless-REST-API-Key": this.apiKey,
      "Content-Type": "application/json",
    };
  }

  /**
   * Parse key to determine table and record ID
   * Format: collection:type:id or collection:id
   */
  private parseKey(key: string): { table: string; recordId: string } {
    const parts = key.split(":");
    if (parts.length < 2) {
      return { table: BACKENDLESS_TABLES.ORDERS, recordId: key };
    }

    const prefix = parts[0];
    let table = BACKENDLESS_TABLES.ORDERS;

    if (prefix === "orders") {
      table = BACKENDLESS_TABLES.ORDERS;
    } else if (prefix === "payment_methods") {
      table = BACKENDLESS_TABLES.PAYMENT_METHODS;
    } else if (prefix === "notifications") {
      table = BACKENDLESS_TABLES.NOTIFICATIONS;
    } else if (prefix === "escrow") {
      table = BACKENDLESS_TABLES.ESCROW;
    } else if (prefix === "dispute") {
      table = BACKENDLESS_TABLES.DISPUTES;
    } else if (prefix === "p2p_matched") {
      table = BACKENDLESS_TABLES.MATCHES;
    } else if (prefix === "p2p") {
      if (parts[1] === "rooms") {
        table = BACKENDLESS_TABLES.ROOMS;
      }
    } else if (prefix === "p2p_merchant_stats") {
      table = BACKENDLESS_TABLES.MERCHANT_STATS;
    } else if (prefix === "staking") {
      if (parts[1] === "reward") {
        table = BACKENDLESS_TABLES.REWARDS;
      } else {
        table = BACKENDLESS_TABLES.STAKING;
      }
    }

    const recordId = key.replace(/:/g, "_").substring(0, 255);
    return { table, recordId };
  }

  async get(key: string): Promise<string | null> {
    try {
      const { table, recordId } = this.parseKey(key);

      const response = await fetch(
        `${this.url}/${this.appId}/data/${table}/${recordId}`,
        {
          method: "GET",
          headers: this.getHeaders(),
        },
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        console.error(
          `Backendless GET error for key ${key}:`,
          response.status,
          await response.text(),
        );
        return null;
      }

      const doc = await response.json();
      return doc.value || JSON.stringify(doc);
    } catch (error: any) {
      console.error(`Error getting key ${key} from Backendless:`, error);
      return null;
    }
  }

  async put(key: string, value: string): Promise<void> {
    try {
      const { table, recordId } = this.parseKey(key);

      // Try to get existing record
      let isUpdate = false;
      try {
        const response = await fetch(
          `${this.url}/${this.appId}/data/${table}/${recordId}`,
          {
            method: "GET",
            headers: this.getHeaders(),
          },
        );
        isUpdate = response.ok;
      } catch {
        isUpdate = false;
      }

      const method = isUpdate ? "PUT" : "POST";
      const url = isUpdate
        ? `${this.url}/${this.appId}/data/${table}/${recordId}`
        : `${this.url}/${this.appId}/data/${table}`;

      const body: any = {
        objectId: recordId,
        key,
        value,
      };

      const response = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(
          `Backendless ${method} error: ${response.status} ${await response.text()}`,
        );
      }
    } catch (error) {
      console.error(`Error putting key ${key} to Backendless:`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const { table, recordId } = this.parseKey(key);

      const response = await fetch(
        `${this.url}/${this.appId}/data/${table}/${recordId}`,
        {
          method: "DELETE",
          headers: this.getHeaders(),
        },
      );

      if (!response.ok && response.status !== 404) {
        throw new Error(
          `Backendless DELETE error: ${response.status} ${await response.text()}`,
        );
      }
    } catch (error) {
      console.error(`Error deleting key ${key} from Backendless:`, error);
      throw error;
    }
  }

  async list(options?: { prefix?: string; limit?: number }): Promise<any> {
    try {
      const { table } = this.parseKey(options?.prefix || "orders");
      const limit = Math.min(options?.limit || 25, 100);

      const params = new URLSearchParams();
      params.append("pageSize", limit.toString());

      const response = await fetch(
        `${this.url}/${this.appId}/data/${table}?${params.toString()}`,
        {
          method: "GET",
          headers: this.getHeaders(),
        },
      );

      if (!response.ok) {
        console.error(
          `Backendless LIST error:`,
          response.status,
          await response.text(),
        );
        return { keys: [] };
      }

      const data = await response.json();
      const records = Array.isArray(data) ? data : data.data || [];
      return {
        keys: records.map((doc: any) => ({ name: doc.key || doc.objectId })),
        total: records.length,
      };
    } catch (error) {
      console.error("Error listing keys from Backendless:", error);
      return { keys: [] };
    }
  }
}

export default BackendlessKVStorage;
