import { saveServicePrice, getCachedServicePrice } from "./offline-cache";
import {
  retryWithExponentialBackoff,
  AGGRESSIVE_RETRY_OPTIONS,
} from "./retry-fetch";

export interface SolPriceData {
  price: number;
  price_change_24h: number;
  market_cap: number;
  volume_24h: number;
}

class SolPriceService {
  private cache: { data: SolPriceData | null; timestamp: number } = {
    data: null,
    timestamp: 0,
  };

  private readonly CACHE_DURATION = 1500; // 1.5 seconds cache - real-time updates

  /**
   * Validate that response is actually JSON
   */
  private isJsonResponse(response: Response): boolean {
    const contentType = response.headers.get("content-type") || "";
    return contentType.includes("application/json");
  }

  /**
   * Fetch SOL price via proxy endpoint with retry logic
   */
  async getSolPrice(): Promise<SolPriceData | null> {
    // Check cache first
    if (
      this.cache.data &&
      Date.now() - this.cache.timestamp < this.CACHE_DURATION
    ) {
      return this.cache.data;
    }

    // Use retry logic with exponential backoff
    const priceData = await retryWithExponentialBackoff(
      async () => {
        console.log("[SOL Price] Fetching fresh SOL price from API...");
        let response: Response;
        try {
          response = await fetch("/api/sol/price");
        } catch (fetchErr) {
          console.error(
            "[SOL Price] Network error fetching /api/sol/price:",
            fetchErr,
          );
          throw fetchErr;
        }

        // Try to parse response as JSON regardless of content-type
        // (server may return errors with wrong content-type)
        let data: any;
        try {
          data = await response.json();
        } catch (parseError) {
          // If JSON parsing fails and response is not ok, log and retry
          if (!response.ok) {
            const contentType =
              response.headers.get("content-type") || "unknown";
            console.warn(
              `[SOL Price] API returned ${response.status} with content-type: ${contentType}`,
            );
            throw new Error(
              `Failed to fetch SOL price: HTTP ${response.status}`,
            );
          }
          console.error(
            "[SOL Price] Failed to parse response as JSON:",
            parseError,
          );
          throw parseError;
        }

        // Validate data structure - even with non-ok status, JSON response is usable
        if (!data || typeof data !== "object") {
          console.error("[SOL Price] Invalid response structure:", data);
          throw new Error("Invalid response structure");
        }

        // Handle both direct price response and nested structure
        let priceData: SolPriceData;

        if (data.price !== undefined) {
          // Direct response format from proxy
          const price = typeof data.price === "number" ? data.price : 0;
          priceData = {
            price: price,
            price_change_24h:
              data.price_change_24h ?? data.priceChange24h ?? 0,
            market_cap: data.market_cap ?? data.marketCap ?? 0,
            volume_24h: data.volume_24h ?? data.volume24h ?? 0,
          };
        } else if (data.priceUsd !== undefined) {
          // Alternative response format (used by fallbacks)
          const price =
            typeof data.priceUsd === "number" ? data.priceUsd : 0;
          priceData = {
            price: price,
            price_change_24h:
              data.price_change_24h ?? data.priceChange24h ?? 0,
            market_cap: data.market_cap ?? data.marketCap ?? 0,
            volume_24h: data.volume_24h ?? data.volume24h ?? 0,
          };
        } else if (data.solana) {
          // CoinGecko response format
          priceData = {
            price: data.solana.usd || 0,
            price_change_24h: data.solana.usd_24h_change || 0,
            market_cap: data.solana.usd_market_cap || 0,
            volume_24h: data.solana.usd_24h_vol || 0,
          };
        } else {
          console.warn(
            "[SOL Price] Response missing price fields - using fallback",
            data,
          );
          // Return fallback but don't throw - server may have returned a valid fallback
          priceData = {
            price: 149.38,
            price_change_24h: 0,
            market_cap: 0,
            volume_24h: 0,
          };
        }

        // Validate price is a valid number
        if (!isFinite(priceData.price) || priceData.price <= 0) {
          console.warn(
            "[SOL Price] Invalid price value:",
            priceData.price,
          );
          // Return fallback instead of throwing
          priceData = {
            price: 149.38,
            price_change_24h: 0,
            market_cap: 0,
            volume_24h: 0,
          };
        }

        // Update cache
        this.cache = {
          data: priceData,
          timestamp: Date.now(),
        };

        // Save to localStorage for offline support
        saveServicePrice("SOL", {
          price: priceData.price,
          priceChange24h: priceData.price_change_24h,
        });

        console.log(
          `[SOL Price] ✅ Updated: $${priceData.price.toFixed(2)} (source: ${data.source || "unknown"})`,
        );

        return priceData;
      },
      "SOL",
      AGGRESSIVE_RETRY_OPTIONS,
    );

    // If retry logic returns price data, return it
    if (priceData) {
      console.log("[SOL Price] Using API response:", priceData);
      return priceData;
    }

    // Fallback to in-memory cache if retry failed
    if (this.cache.data) {
      console.log(
        "[SOL Price] Using in-memory cached price:",
        this.cache.data.price,
      );
      return this.cache.data;
    }

    // Try to get price from localStorage as fallback
    const cachedServicePrice = getCachedServicePrice("SOL");
    if (cachedServicePrice && cachedServicePrice.price > 0) {
      console.log(
        `[SOL Price] Using localStorage cached price: $${cachedServicePrice.price}`,
      );
      return {
        price: cachedServicePrice.price,
        price_change_24h: cachedServicePrice.priceChange24h ?? 0,
        market_cap: 0,
        volume_24h: 0,
      };
    }

    // Final fallback to safe price
    console.log(
      "[SOL Price] All attempts failed, using hardcoded fallback price",
    );
    return {
      price: 149.38,
      price_change_24h: 0,
      market_cap: 0,
      volume_24h: 0,
    };
  }

  /**
   * Get SOL price with simple number return
   */
  async getSolPriceSimple(): Promise<number> {
    const data = await this.getSolPrice();
    return data?.price || 100;
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache = { data: null, timestamp: 0 };
  }
}

export const solPriceService = new SolPriceService();
