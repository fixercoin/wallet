/**
 * Offline Cache Service
 * Stores token prices, balances, and wallet data in localStorage for offline support
 */

export interface CachedPrice {
  price: number;
  priceChange24h?: number;
  timestamp: number;
}

export interface CachedToken {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance?: number;
  price?: number;
  priceChange24h?: number;
}

export interface CachedWalletBalance {
  publicKey: string;
  balance: number;
  timestamp: number;
}

const CACHE_PREFIX = "offline_cache_";
const PRICES_KEY = `${CACHE_PREFIX}prices`;
const BALANCES_KEY = `${CACHE_PREFIX}balances`;
const TOKENS_KEY = (walletAddress: string) =>
  `${CACHE_PREFIX}tokens_${walletAddress}`;
const CACHE_TIMESTAMP_KEY = `${CACHE_PREFIX}timestamp`;
const SERVICE_PRICES_KEY = (serviceName: string) =>
  `${CACHE_PREFIX}service_price_${serviceName}`;
const CONNECTION_STATUS_KEY = `${CACHE_PREFIX}connection_status`;

// Cache validity: 5 minutes for prices/balances, 1 hour for token list
const CACHE_VALIDITY_PRICES = 5 * 60 * 1000; // 5 minutes
const CACHE_VALIDITY_TOKENS = 60 * 60 * 1000; // 1 hour
const CACHE_VALIDITY_SERVICE_PRICES = 24 * 60 * 60 * 1000; // 24 hours for service prices

export {
  CACHE_VALIDITY_PRICES,
  CACHE_VALIDITY_TOKENS,
  CACHE_VALIDITY_SERVICE_PRICES,
};

/**
 * Check if device is mobile - always returns false for desktop-only mode
 */
function isMobileDevice(): boolean {
  return false;
}

/**
 * Save token prices to localStorage
 */
export function savePricesToCache(
  prices: Record<string, CachedPrice>,
): boolean {
  try {
    localStorage.setItem(PRICES_KEY, JSON.stringify(prices));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    return true;
  } catch (error) {
    console.warn("[OfflineCache] Failed to save prices:", error);
    return false;
  }
}

/**
 * Get cached token prices
 */
export function getCachedPrices(
  maxAge?: number,
): Record<string, CachedPrice> | null {
  try {
    const cached = localStorage.getItem(PRICES_KEY);
    if (!cached) return null;

    const prices = JSON.parse(cached) as Record<string, CachedPrice>;

    // Check if cache is still valid
    if (maxAge) {
      const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
      if (timestamp) {
        const age = Date.now() - parseInt(timestamp, 10);
        if (age > maxAge) {
          return null;
        }
      }
    }

    return prices;
  } catch (error) {
    console.warn("[OfflineCache] Failed to read prices:", error);
    return null;
  }
}

/**
 * Save wallet balance to cache
 */
export function saveBalanceToCache(
  publicKey: string,
  balance: number,
): boolean {
  try {
    const balances = getBalancesFromCache() || {};
    balances[publicKey] = {
      publicKey,
      balance,
      timestamp: Date.now(),
    };
    localStorage.setItem(BALANCES_KEY, JSON.stringify(balances));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    return true;
  } catch (error) {
    console.warn("[OfflineCache] Failed to save balance:", error);
    return false;
  }
}

/**
 * Get cached wallet balance
 */
export function getCachedBalance(
  publicKey: string,
  maxAge?: number,
): number | null {
  try {
    const balances = getBalancesFromCache();
    if (!balances || !balances[publicKey]) return null;

    const cachedBalance = balances[publicKey];

    // Check if cache is still valid
    if (maxAge) {
      const age = Date.now() - cachedBalance.timestamp;
      if (age > maxAge) {
        return null;
      }
    }

    return cachedBalance.balance;
  } catch (error) {
    console.warn("[OfflineCache] Failed to read balance:", error);
    return null;
  }
}

/**
 * Get all cached balances
 */
function getBalancesFromCache(): Record<string, CachedWalletBalance> | null {
  try {
    const cached = localStorage.getItem(BALANCES_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

/**
 * Save tokens for a wallet to cache
 */
export function saveTokensToCache(
  walletAddress: string,
  tokens: CachedToken[],
): boolean {
  try {
    const key = TOKENS_KEY(walletAddress);
    localStorage.setItem(key, JSON.stringify(tokens));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    return true;
  } catch (error) {
    console.warn("[OfflineCache] Failed to save tokens:", error);
    return false;
  }
}

/**
 * Get cached tokens for a wallet
 */
export function getCachedTokens(
  walletAddress: string,
  maxAge?: number,
): CachedToken[] | null {
  try {
    const key = TOKENS_KEY(walletAddress);
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const tokens = JSON.parse(cached) as CachedToken[];

    // Check if cache is still valid
    if (maxAge) {
      const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
      if (timestamp) {
        const age = Date.now() - parseInt(timestamp, 10);
        if (age > maxAge) {
          return null;
        }
      }
    }

    return tokens;
  } catch (error) {
    console.warn("[OfflineCache] Failed to read tokens:", error);
    return null;
  }
}

/**
 * Merge cached prices with fresh prices, preferring fresh data
 */
export function mergePrices(
  freshPrices: Record<string, number>,
  cachedPrices: Record<string, CachedPrice> | null,
): Record<string, number> {
  if (!cachedPrices) return freshPrices;

  const merged = { ...freshPrices };

  // Only use cached prices for mints that don't have fresh prices
  Object.entries(cachedPrices).forEach(([mint, cachedPrice]) => {
    if (!merged[mint] || merged[mint] <= 0) {
      merged[mint] = cachedPrice.price;
    }
  });

  return merged;
}

/**
 * Merge cached tokens with fresh tokens
 */
export function mergeTokens(
  freshTokens: any[],
  cachedTokens: CachedToken[] | null,
): any[] {
  if (!cachedTokens || freshTokens.length > 0) {
    return freshTokens;
  }

  // Only use cached tokens if we have no fresh tokens
  return cachedTokens;
}

/**
 * Check if offline (cache-first mode)
 */
export function isLikelyOffline(): boolean {
  // Simple check: if we have cached data and no recent updates, we might be offline
  const cachedPrices = getCachedPrices();
  return cachedPrices !== null;
}

/**
 * Clear all cached data
 */
export function clearOfflineCache(): void {
  try {
    localStorage.removeItem(PRICES_KEY);
    localStorage.removeItem(BALANCES_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);

    // Clear wallet-specific token caches
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(`${CACHE_PREFIX}tokens_`)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn("[OfflineCache] Failed to clear cache:", error);
  }
}

/**
 * Get cache timestamp
 */
export function getCacheTimestamp(): number | null {
  try {
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    return timestamp ? parseInt(timestamp, 10) : null;
  } catch {
    return null;
  }
}

/**
 * Check if cache is fresh (within validity period)
 */
export function isCacheFresh(maxAge: number = CACHE_VALIDITY_PRICES): boolean {
  const timestamp = getCacheTimestamp();
  if (!timestamp) return false;

  const age = Date.now() - timestamp;
  return age <= maxAge;
}

/**
 * Save a service price to cache (SOL, FIXERCOIN, etc.)
 */
export function saveServicePrice(
  serviceName: string,
  priceData: { price: number; priceChange24h?: number },
): boolean {
  try {
    const key = SERVICE_PRICES_KEY(serviceName);
    const cached = {
      ...priceData,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cached));
    return true;
  } catch (error) {
    console.warn(`[OfflineCache] Failed to save ${serviceName} price:`, error);
    return false;
  }
}

/**
 * Get cached service price (SOL, FIXERCOIN, etc.)
 */
export function getCachedServicePrice(
  serviceName: string,
): { price: number; priceChange24h?: number; timestamp: number } | null {
  try {
    const key = SERVICE_PRICES_KEY(serviceName);
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const data = JSON.parse(cached);

    // Check if cache is within validity period (24 hours)
    const age = Date.now() - data.timestamp;
    if (age > CACHE_VALIDITY_SERVICE_PRICES) {
      localStorage.removeItem(key);
      return null;
    }

    return data;
  } catch (error) {
    console.warn(`[OfflineCache] Failed to read ${serviceName} price:`, error);
    return null;
  }
}

/**
 * Check if we're using cached data (offline/unstable connection)
 */
export function setConnectionStatus(isStable: boolean): void {
  try {
    localStorage.setItem(
      CONNECTION_STATUS_KEY,
      JSON.stringify({ isStable, timestamp: Date.now() }),
    );
  } catch (error) {
    console.warn("[OfflineCache] Failed to set connection status:", error);
  }
}

/**
 * Get current connection status
 */
export function getConnectionStatus(): {
  isStable: boolean;
  isUsingCache: boolean;
} {
  try {
    const cached = localStorage.getItem(CONNECTION_STATUS_KEY);
    if (!cached) {
      return { isStable: true, isUsingCache: false };
    }

    const data = JSON.parse(cached);
    return {
      isStable: data.isStable ?? true,
      isUsingCache: !data.isStable,
    };
  } catch (error) {
    console.warn("[OfflineCache] Failed to read connection status:", error);
    return { isStable: true, isUsingCache: false };
  }
}
