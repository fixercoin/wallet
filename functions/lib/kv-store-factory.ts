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
 * Priority: Cloudflare KV > Appwrite > Backendless
 */
export function getKVStore(
  env: PagesEnv,
): KVStore | AppwriteKVStore | BackendlessKVStore {
  // Prioritize Cloudflare KV (primary storage backend)
  if (env.STAKING_KV) {
    console.log("[KV Store Factory] Using Cloudflare KV backend");
    return new KVStore(env.STAKING_KV);
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

  // Fall back to Backendless if available
  if (env.BACKENDLESS_APP_ID && env.BACKENDLESS_API_KEY) {
    console.log("[KV Store Factory] Using Backendless backend (fallback)");
    return new BackendlessKVStore(
      env.BACKENDLESS_APP_ID,
      env.BACKENDLESS_API_KEY,
      env.BACKENDLESS_URL || "https://api.backendless.com",
    ) as any;
  }

  throw new Error(
    "KV namespace is required. Either provide STAKING_KV (Cloudflare), Appwrite, or Backendless credentials",
  );
}

/**
 * Initialize KV store for P2P operations
 */
export function initializeP2PStorage(
  env: PagesEnv,
): KVStore | AppwriteKVStore | BackendlessKVStore {
  return getKVStore(env);
}
