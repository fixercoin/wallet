import * as fs from "fs";
import * as path from "path";
import AppwriteKVStorage from "./appwrite-storage";
import { BackendlessKVStorage } from "./backendless-storage";

/**
 * KV Storage adapter for Express server
 * Supports file-based storage (development), Cloudflare KV, and Appwrite (production)
 */

interface KVStorageBackend {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: any): Promise<any>;
}

/**
 * File-based KV storage for development
 */
class FileKVStorage implements KVStorageBackend {
  private dataDir: string;

  constructor(dataDir: string = ".kv-data") {
    this.dataDir = dataDir;
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    // Encode key to be a valid filename across all platforms
    // Use URL encoding to preserve key structure
    const encodedKey = encodeURIComponent(key);
    return path.join(this.dataDir, encodedKey);
  }

  async get(key: string): Promise<string | null> {
    try {
      const filePath = this.getFilePath(key);
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, "utf-8");
      }
      return null;
    } catch (error) {
      console.error(`Error getting key ${key}:`, error);
      return null;
    }
  }

  async put(key: string, value: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      fs.writeFileSync(filePath, value, "utf-8");
    } catch (error) {
      console.error(`Error putting key ${key}:`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Error deleting key ${key}:`, error);
      throw error;
    }
  }

  async list(options?: any): Promise<any> {
    try {
      const files = fs.readdirSync(this.dataDir);
      return {
        keys: files.map((f) => ({ name: decodeURIComponent(f) })),
      };
    } catch (error) {
      console.error("Error listing keys:", error);
      return { keys: [] };
    }
  }
}

/**
 * In-memory KV storage (fallback)
 */
class InMemoryKVStorage implements KVStorageBackend {
  private store: Map<string, string> = new Map();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(options?: any): Promise<any> {
    return {
      keys: Array.from(this.store.keys()).map((name) => ({ name })),
    };
  }
}

/**
 * Cloudflare KV storage using REST API
 * For use with Cloudflare Workers or Pages Functions
 */
class CloudflareKVStorage implements KVStorageBackend {
  private accountId: string;
  private namespaceId: string;
  private apiToken: string;
  private baseUrl: string;

  constructor(accountId: string, namespaceId: string, apiToken: string) {
    if (!accountId || !namespaceId || !apiToken) {
      throw new Error(
        "Cloudflare KV credentials missing: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_NAMESPACE_ID, CLOUDFLARE_API_TOKEN",
      );
    }
    this.accountId = accountId;
    this.namespaceId = namespaceId;
    this.apiToken = apiToken;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
    };
  }

  async get(key: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/values/${encodeURIComponent(key)}`,
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
          `Cloudflare KV GET error for key ${key}:`,
          response.status,
          await response.text(),
        );
        return null;
      }

      return await response.text();
    } catch (error) {
      console.error(`Error getting key ${key} from Cloudflare KV:`, error);
      return null;
    }
  }

  async put(key: string, value: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/values/${encodeURIComponent(key)}`,
        {
          method: "PUT",
          headers: this.getHeaders(),
          body: value,
        },
      );

      if (!response.ok) {
        throw new Error(
          `Cloudflare KV PUT error: ${response.status} ${await response.text()}`,
        );
      }
    } catch (error) {
      console.error(`Error putting key ${key} to Cloudflare KV:`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/values/${encodeURIComponent(key)}`,
        {
          method: "DELETE",
          headers: this.getHeaders(),
        },
      );

      if (!response.ok && response.status !== 404) {
        throw new Error(
          `Cloudflare KV DELETE error: ${response.status} ${await response.text()}`,
        );
      }
    } catch (error) {
      console.error(`Error deleting key ${key} from Cloudflare KV:`, error);
      throw error;
    }
  }

  async list(options?: any): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (options?.prefix) {
        params.append("prefix", options.prefix);
      }
      if (options?.limit) {
        params.append("limit", options.limit.toString());
      }
      if (options?.cursor) {
        params.append("cursor", options.cursor);
      }

      const url = `${this.baseUrl}/keys?${params.toString()}`;
      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.error(
          `Cloudflare KV LIST error:`,
          response.status,
          await response.text(),
        );
        return { keys: [] };
      }

      const data = await response.json();
      return {
        keys: data.result || [],
        cursor: data.result_info?.cursor,
      };
    } catch (error) {
      console.error(`Error listing keys from Cloudflare KV:`, error);
      return { keys: [] };
    }
  }
}

/**
 * KV Storage manager that provides a unified interface
 */
export class KVStorage {
  private backend: KVStorageBackend;

  constructor(backend?: KVStorageBackend) {
    this.backend = backend || new FileKVStorage();
  }

  static createFileStorage(dataDir?: string): KVStorage {
    return new KVStorage(new FileKVStorage(dataDir));
  }

  static createMemoryStorage(): KVStorage {
    return new KVStorage(new InMemoryKVStorage());
  }

  static createCloudflareStorage(
    accountId: string,
    namespaceId: string,
    apiToken: string,
  ): KVStorage {
    return new KVStorage(
      new CloudflareKVStorage(accountId, namespaceId, apiToken),
    );
  }

  static createAppwriteStorage(): KVStorage {
    return new KVStorage(new AppwriteKVStorage());
  }

  static createBackendlessStorage(
    appId: string,
    apiKey: string,
    url?: string,
  ): KVStorage {
    return new KVStorage(new BackendlessKVStorage(appId, apiKey, url));
  }

  static createAutoStorage(): KVStorage {
    // Try to auto-detect Cloudflare KV credentials first (primary)
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const namespaceId = process.env.CLOUDFLARE_NAMESPACE_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (accountId && namespaceId && apiToken) {
      console.log("[KVStorage] Using Cloudflare KV storage backend");
      try {
        return new KVStorage(
          new CloudflareKVStorage(accountId, namespaceId, apiToken),
        );
      } catch (error) {
        console.warn(
          "[KVStorage] Cloudflare KV initialization failed, falling back to file-based storage:",
          error instanceof Error ? error.message : String(error),
        );
        // Fall back to file storage if Cloudflare KV fails
        return new KVStorage(new FileKVStorage());
      }
    }

    // Check if all Appwrite credentials are present (legacy support)
    const appwriteEndpoint = process.env.APPWRITE_ENDPOINT;
    const appwriteProjectId = process.env.APPWRITE_PROJECT_ID;
    const appwriteApiKey = process.env.APPWRITE_API_KEY;

    // Only use Appwrite if ALL credentials are provided and non-empty
    if (appwriteEndpoint && appwriteProjectId && appwriteApiKey) {
      console.log(
        "[KVStorage] Using Appwrite storage backend (legacy P2P support)",
      );
      try {
        return new KVStorage(new AppwriteKVStorage());
      } catch (error) {
        console.warn(
          "[KVStorage] Appwrite initialization failed, falling back to file-based storage:",
          error instanceof Error ? error.message : String(error),
        );
        // Fall back to file storage if Appwrite fails
        return new KVStorage(new FileKVStorage());
      }
    }

    // Check if all Backendless credentials are present (fallback)
    const backendlessAppId = process.env.BACKENDLESS_APP_ID;
    const backendlessApiKey = process.env.BACKENDLESS_API_KEY;
    const backendlessUrl = process.env.BACKENDLESS_URL;

    if (backendlessAppId && backendlessApiKey) {
      console.log(
        "[KVStorage] Using Backendless storage backend (fallback)",
      );
      try {
        return new KVStorage(
          new BackendlessKVStorage(
            backendlessAppId,
            backendlessApiKey,
            backendlessUrl,
          ),
        );
      } catch (error) {
        console.warn(
          "[KVStorage] Backendless initialization failed, falling back to file-based storage:",
          error instanceof Error ? error.message : String(error),
        );
        return new KVStorage(new FileKVStorage());
      }
    }

    // Fall back to file-based storage in development
    console.log("[KVStorage] Using file-based KV storage backend");
    return new KVStorage(new FileKVStorage());
  }

  async get(key: string): Promise<string | null> {
    return this.backend.get(key);
  }

  async put(key: string, value: string): Promise<void> {
    return this.backend.put(key, value);
  }

  async delete(key: string): Promise<void> {
    return this.backend.delete(key);
  }

  async list(options?: any): Promise<any> {
    return this.backend.list(options);
  }
}

// Global KV storage instance
let globalKVStorage: KVStorage | null = null;

export function initializeKVStorage(backend?: KVStorageBackend): KVStorage {
  if (!globalKVStorage) {
    if (backend) {
      globalKVStorage = new KVStorage(backend);
    } else {
      // Auto-detect storage backend based on environment
      globalKVStorage = KVStorage.createAutoStorage();
    }
  }
  return globalKVStorage;
}

export function getKVStorage(): KVStorage {
  if (!globalKVStorage) {
    globalKVStorage = KVStorage.createAutoStorage();
  }
  return globalKVStorage;
}
