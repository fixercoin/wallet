/**
 * Pump.fun Price Service
 * Fetches prices for pump.fun tokens using the Pump.fun API with timeout, caching, and retry logic
 */

import { saveServicePrice, getCachedServicePrice } from "./offline-cache";
import { fetchWithTimeout } from "./fetch-timeout";

export interface PumpFunToken {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image_uri: string;
  metadata_uri: string;
  twitter: string | null;
  website: string | null;
  show_name: boolean;
  created_timestamp: number;
  raydium_pool: string | null;
  complete: boolean;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  real_sol_reserves: number;
  real_token_reserves: number;
  market_cap: number;
  reply_count: number;
  price?: number;
}

// Fallback prices for pump.fun tokens (in SOL)
const FALLBACK_PRICES: Record<string, number> = {
  FIXERCOIN: 0.000042,
  LOCKER: 0.000008,
  FXM: 0.00000357,
};

class PumpFunPriceService {
  private baseUrl = "https://frontend-api.pump.fun";
  private cache = new Map<string, { data: PumpFunToken; expiresAt: number }>();
  private readonly CACHE_DURATION = 250; // 250ms for live updates
  private readonly TIMEOUT_MS = 55000; // 55 seconds timeout (50-60 range)
  private readonly MAX_RETRIES = 15; // Retry up to 15 times with exponential backoff
  private readonly RETRY_DELAY_MS = 100; // Initial retry delay (exponential backoff)

  /**
   * Get token price with timeout, caching, and retry logic
   */
  async getTokenPrice(mint: string): Promise<number | null> {
    try {
      console.log(`[PumpFun] Getting price for ${mint}...`);
      const token = await this.getToken(mint);
      if (!token) {
        console.warn(`[PumpFun] No token data returned for ${mint}`);
        return null;
      }

      // Calculate price from virtual reserves
      // price = virtualSolReserves / virtualTokenReserves
      if (token.virtual_sol_reserves > 0 && token.virtual_token_reserves > 0) {
        const price = token.virtual_sol_reserves / token.virtual_token_reserves;
        console.log(
          `[PumpFun] ✅ ${mint}: price=$${price.toFixed(8)} SOL (from virtual reserves)`,
        );

        // Save to localStorage for offline support
        saveServicePrice(mint, {
          price,
          priceChange24h: 0,
        });

        return price;
      }

      console.warn(
        `[PumpFun] Invalid reserves for ${mint}: virtual_sol=${token.virtual_sol_reserves}, virtual_token=${token.virtual_token_reserves}`,
      );
      return null;
    } catch (error) {
      console.error(
        `[PumpFun] Error getting price for ${mint}:`,
        error instanceof Error ? error.message : String(error),
      );

      // Return cached price if available
      const cached = getCachedServicePrice(mint);
      if (cached && cached.price > 0) {
        console.log(
          `[PumpFun] Using cached price for ${mint}: ${cached.price}`,
        );
        return cached.price;
      }

      return null;
    }
  }

  /**
   * Get token data with timeout, retry logic, and localStorage fallback
   */
  async getToken(mint: string): Promise<PumpFunToken | null> {
    // Check in-memory cache first
    const cached = this.cache.get(mint);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`[PumpFun] Returning in-memory cached token: ${mint}`);
      return cached.data;
    }

    // Try to fetch with retries
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log(
          `[PumpFun] Fetching token data for ${mint} (attempt ${attempt + 1}/${this.MAX_RETRIES + 1})...`,
        );

        const response = await fetchWithTimeout(
          `${this.baseUrl}/api/token/${encodeURIComponent(mint)}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          },
          this.TIMEOUT_MS,
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: PumpFunToken = await response.json();

        // Cache the result
        this.cache.set(mint, {
          data,
          expiresAt: Date.now() + this.CACHE_DURATION,
        });

        console.log(
          `[PumpFun] ✅ Got token data for ${mint}: ${data.symbol} (${data.name})`,
        );

        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `[PumpFun] Attempt ${attempt + 1} failed for ${mint}:`,
          lastError.message,
        );

        // Exponential backoff before retry
        if (attempt < this.MAX_RETRIES) {
          const backoffDelay = this.RETRY_DELAY_MS * Math.pow(2, attempt);
          console.log(
            `[PumpFun] Retrying in ${backoffDelay}ms... (${this.MAX_RETRIES - attempt} retries left)`,
          );
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        }
      }
    }

    // All retries failed
    console.error(
      `[PumpFun] Failed to fetch token ${mint} after ${this.MAX_RETRIES + 1} attempts:`,
      lastError?.message,
    );

    return null;
  }

  clearCache(): void {
    this.cache.clear();
    console.log("[PumpFun] Cache cleared");
  }
}

export const pumpFunPriceService = new PumpFunPriceService();
