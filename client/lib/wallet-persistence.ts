/**
 * Enhanced wallet persistence with fallback mechanisms
 * Handles localStorage failures and provides robust wallet storage
 */

const WALLETS_STORAGE_KEY = "solana_wallet_accounts";
const ACTIVE_WALLET_KEY = "solana_active_wallet";
const LEGACY_WALLET_KEY = "solana_wallet_data";
const PERSISTENCE_TIMESTAMP_KEY = "wallet_persistence_timestamp";

// In-memory cache as ultimate fallback
let walletInMemoryCache: any = null;
let activeWalletInMemoryCache: string | null = null;

/**
 * Check if localStorage is available and accessible
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const test = "__storage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    console.warn("[Wallet Persistence] localStorage not available:", e);
    return false;
  }
}

/**
 * Check if sessionStorage is available
 */
export function isSessionStorageAvailable(): boolean {
  try {
    const test = "__session_test__";
    sessionStorage.setItem(test, test);
    sessionStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Safely get item from storage with fallback chain
 */
export function getStorageItem(
  key: string,
  storage: "local" | "session" = "local",
): string | null {
  try {
    if (storage === "local" && isLocalStorageAvailable()) {
      return localStorage.getItem(key);
    } else if (storage === "session" && isSessionStorageAvailable()) {
      return sessionStorage.getItem(key);
    }
  } catch (e) {
    console.warn(`[Wallet Persistence] Failed to get ${key}:`, e);
  }

  // Check in-memory cache
  if (key === WALLETS_STORAGE_KEY && walletInMemoryCache) {
    return JSON.stringify(walletInMemoryCache);
  }
  if (key === ACTIVE_WALLET_KEY && activeWalletInMemoryCache) {
    return activeWalletInMemoryCache;
  }

  return null;
}

/**
 * Safely set item to storage with fallback chain
 */
export function setStorageItem(
  key: string,
  value: string,
  storage: "local" | "session" = "local",
): boolean {
  let success = false;

  // Try primary storage first
  try {
    if (storage === "local" && isLocalStorageAvailable()) {
      localStorage.setItem(key, value);
      // Also store timestamp for validation
      localStorage.setItem(PERSISTENCE_TIMESTAMP_KEY, Date.now().toString());
      success = true;
      console.log(`[Wallet Persistence] ✅ Saved to localStorage: ${key}`);
    }
  } catch (e) {
    console.warn(
      `[Wallet Persistence] Failed to save to localStorage: ${key}`,
      e,
    );
  }

  // Try fallback sessionStorage if localStorage failed
  if (!success) {
    try {
      if (isSessionStorageAvailable()) {
        sessionStorage.setItem(key, value);
        success = true;
        console.log(`[Wallet Persistence] ✅ Saved to sessionStorage: ${key}`);
      }
    } catch (e) {
      console.warn(
        `[Wallet Persistence] Failed to save to sessionStorage: ${key}`,
        e,
      );
    }
  }

  // Always maintain in-memory cache as last resort
  try {
    if (key === WALLETS_STORAGE_KEY) {
      walletInMemoryCache = JSON.parse(value);
      console.log(`[Wallet Persistence] ✅ Cached wallets in memory`);
    } else if (key === ACTIVE_WALLET_KEY) {
      activeWalletInMemoryCache = value;
      console.log(`[Wallet Persistence] ✅ Cached active wallet in memory`);
    }
  } catch (e) {
    console.warn(`[Wallet Persistence] Failed to cache in memory:`, e);
  }

  if (!success && !walletInMemoryCache && !activeWalletInMemoryCache) {
    console.error(
      `[Wallet Persistence] ❌ Failed to persist wallet data: no storage available`,
    );
    return false;
  }

  return true;
}

/**
 * Safely remove item from storage
 */
export function removeStorageItem(key: string): void {
  try {
    if (isLocalStorageAvailable()) {
      localStorage.removeItem(key);
    }
  } catch (e) {
    console.warn(`[Wallet Persistence] Failed to remove from localStorage:`, e);
  }

  try {
    if (isSessionStorageAvailable()) {
      sessionStorage.removeItem(key);
    }
  } catch (e) {
    console.warn(
      `[Wallet Persistence] Failed to remove from sessionStorage:`,
      e,
    );
  }

  // Clear in-memory cache
  if (key === WALLETS_STORAGE_KEY) {
    walletInMemoryCache = null;
  } else if (key === ACTIVE_WALLET_KEY) {
    activeWalletInMemoryCache = null;
  }
}

/**
 * Validate wallet data integrity
 */
export function validateWalletData(data: any): boolean {
  if (!Array.isArray(data)) {
    console.warn("[Wallet Persistence] Wallet data is not an array");
    return false;
  }

  if (data.length === 0) {
    console.warn("[Wallet Persistence] Wallet data is empty array");
    return false;
  }

  const firstWallet = data[0];
  if (!firstWallet || !firstWallet.publicKey) {
    console.warn("[Wallet Persistence] Wallet missing publicKey");
    return false;
  }

  if (!firstWallet.secretKey) {
    console.warn("[Wallet Persistence] Wallet missing secretKey");
    return false;
  }

  return true;
}

/**
 * Check if storage contains valid wallet data
 */
export function hasValidWalletData(): boolean {
  try {
    const stored = getStorageItem(WALLETS_STORAGE_KEY);
    if (!stored) {
      console.log("[Wallet Persistence] No wallet data found in storage");
      return false;
    }

    const parsed = JSON.parse(stored);
    const isValid = validateWalletData(parsed);

    if (isValid) {
      console.log("[Wallet Persistence] ✅ Valid wallet data found in storage");
    } else {
      console.warn("[Wallet Persistence] Wallet data validation failed");
    }

    return isValid;
  } catch (e) {
    console.warn("[Wallet Persistence] Error checking wallet data:", e);
    return false;
  }
}

/**
 * Clear all wallet data
 */
export function clearAllWalletData(): void {
  console.log("[Wallet Persistence] Clearing all wallet data...");
  removeStorageItem(WALLETS_STORAGE_KEY);
  removeStorageItem(ACTIVE_WALLET_KEY);
  removeStorageItem(LEGACY_WALLET_KEY);
  removeStorageItem(PERSISTENCE_TIMESTAMP_KEY);

  // Clear in-memory cache
  walletInMemoryCache = null;
  activeWalletInMemoryCache = null;

  console.log("[Wallet Persistence] ✅ All wallet data cleared");
}

/**
 * Get storage diagnostics for debugging
 */
export function getStorageDiagnostics(): {
  localStorageAvailable: boolean;
  sessionStorageAvailable: boolean;
  hasWalletData: boolean;
  inMemoryCached: boolean;
} {
  return {
    localStorageAvailable: isLocalStorageAvailable(),
    sessionStorageAvailable: isSessionStorageAvailable(),
    hasWalletData: hasValidWalletData(),
    inMemoryCached: walletInMemoryCache !== null,
  };
}
