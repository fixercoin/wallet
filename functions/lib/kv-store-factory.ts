/**
 * KV Store Factory for Cloudflare Functions
 * Detects storage backend and returns appropriate KVStore instance
 */

import { KVStore } from "./kv-utils";
import { AppwriteKVStore } from "./appwrite-kv-store";
import { BackendlessKVStore } from "./backendless-kv-store";

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
  BACKENDLESS_APP_ID?: string;
  BACKENDLESS_API_KEY?: string;
  BACKENDLESS_URL?: string;
}

/**
 * Get KV Store instance based on available credentials
 * Priority: Backendless > Appwrite > Cloudflare KV > throws error
 */
export function getKVStore(
  env: PagesEnv,
): KVStore | AppwriteKVStore | BackendlessKVStore {
  // Check for Backendless credentials first (preferred for P2P)
  if (env.BACKENDLESS_APP_ID && env.BACKENDLESS_API_KEY) {
    console.log("[KV Store Factory] Using Backendless backend (P2P optimized)");
    return new BackendlessKVStore(
      env.BACKENDLESS_APP_ID,
      env.BACKENDLESS_API_KEY,
      env.BACKENDLESS_URL || "https://api.backendless.com",
    ) as any;
  }

  // Check for Appwrite credentials (legacy support)
  if (
    env.APPWRITE_ENDPOINT &&
    env.APPWRITE_PROJECT_ID &&
    env.APPWRITE_API_KEY
  ) {
    console.log(
      "[KV Store Factory] Using Appwrite backend (legacy P2P support)",
    );
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
      "KV namespace is required. Either provide STAKING_KV (Cloudflare), Backendless, or Appwrite credentials",
    );
  }

  console.log("[KV Store Factory] Using Cloudflare KV backend");
  return new KVStore(env.STAKING_KV);
}

/**
 * Initialize KV store for P2P operations
 */
export function initializeP2PStorage(
  env: PagesEnv,
): KVStore | AppwriteKVStore | BackendlessKVStore {
  return getKVStore(env);
}
