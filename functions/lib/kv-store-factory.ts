/**
 * KV Store Factory for Cloudflare Functions
 * Detects storage backend and returns appropriate KVStore instance
 */

import { KVStore } from "./kv-utils";
import { AppwriteKVStore } from "./appwrite-kv-store";

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: any): Promise<any>;
}

interface PagesEnv {
  STAKING_KV?: KVNamespace;
  APPWRITE_ENDPOINT?: string;
  APPWRITE_PROJECT_ID?: string;
  APPWRITE_API_KEY?: string;
  APPWRITE_DATABASE_ID?: string;
}

/**
 * Get KV Store instance based on available credentials
 * Priority: Appwrite > Cloudflare KV > throws error
 */
export function getKVStore(env: PagesEnv): KVStore | AppwriteKVStore {
  // Check for Appwrite credentials first (preferred for P2P)
  if (
    env.APPWRITE_ENDPOINT &&
    env.APPWRITE_PROJECT_ID &&
    env.APPWRITE_API_KEY
  ) {
    console.log("[KV Store Factory] Using Appwrite backend (P2P optimized)");
    return new AppwriteKVStore(
      env.APPWRITE_ENDPOINT,
      env.APPWRITE_PROJECT_ID,
      env.APPWRITE_API_KEY,
      env.APPWRITE_DATABASE_ID || "p2p_db",
    ) as any;
  }

  // Fall back to Cloudflare KV
  if (!env.STAKING_KV) {
    throw new Error(
      "KV namespace is required. Either provide STAKING_KV (Cloudflare) or Appwrite credentials",
    );
  }

  console.log("[KV Store Factory] Using Cloudflare KV backend");
  return new KVStore(env.STAKING_KV);
}

/**
 * Initialize KV store for P2P operations
 */
export function initializeP2PStorage(env: PagesEnv): KVStore | AppwriteKVStore {
  return getKVStore(env);
}
