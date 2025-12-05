import * as fs from "fs";
import * as path from "path";

/**
 * KV Storage adapter for Express server
 * Supports both file-based storage (development) and Cloudflare KV (production)
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
    globalKVStorage = new KVStorage(backend || new FileKVStorage());
  }
  return globalKVStorage;
}

export function getKVStorage(): KVStorage {
  if (!globalKVStorage) {
    globalKVStorage = new KVStorage(new FileKVStorage());
  }
  return globalKVStorage;
}
