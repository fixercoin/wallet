import { birdeyeAPI } from "./birdeye";
import { saveServicePrice } from "./offline-cache";
import {
  retryWithExponentialBackoff,
  AGGRESSIVE_RETRY_OPTIONS,
} from "./retry-fetch";

export interface LockerPriceData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity?: number;
  lastUpdated: Date;
  derivationMethod?: string;
  isFallback?: boolean;
}

const LOCKER_MINT = "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump";

class LockerPriceService {
  private cachedData: LockerPriceData | null = null;
  private lastFetchTime: Date | null = null;
  private readonly CACHE_DURATION = 250; // 250ms - ensures live price updates every 250ms for real-time display
  private readonly TOKEN_NAME = "LOCKER";

  async getLockerPrice(): Promise<LockerPriceData | null> {
    // Check if we have valid cached data (only from live prices, not fallbacks)
    if (
      this.cachedData &&
      this.lastFetchTime &&
      this.cachedData.derivationMethod !== "fallback"
    ) {
      const timeSinceLastFetch = Date.now() - this.lastFetchTime.getTime();
      if (timeSinceLastFetch < this.CACHE_DURATION) {
        console.log("Returning cached LOCKER price data");
        return this.cachedData;
      }
    }

    // Use retry logic to fetch price from Birdeye
    const priceData = await retryWithExponentialBackoff(
      async () => {
        console.log("Fetching fresh LOCKER price from Birdeye...");

        try {
          // Fetch LOCKER price from Birdeye
          const lockerToken = await birdeyeAPI.getTokenByMint(LOCKER_MINT);

          if (!lockerToken) {
            throw new Error("LOCKER not found on Birdeye");
          }

          const price = lockerToken.priceUsd;
          const priceChange24h = lockerToken.priceChange?.h24 || 0;
          const volume24h = lockerToken.volume?.h24 || 0;

          if (!price || price <= 0) {
            throw new Error(
              `Invalid LOCKER price from Birdeye: ${price}`,
            );
          }

          const priceData: LockerPriceData = {
            price,
            priceChange24h,
            volume24h,
            liquidity: lockerToken.liquidity?.usd,
            lastUpdated: new Date(),
            derivationMethod: "Birdeye (live)",
          };

          this.cachedData = priceData;
          this.lastFetchTime = new Date();
          console.log(
            `✅ LOCKER price updated: $${priceData.price.toFixed(8)} (24h: ${priceChange24h.toFixed(2)}%) via ${priceData.derivationMethod}`,
          );

          // Save to localStorage for offline support
          saveServicePrice("LOCKER", {
            price: priceData.price,
            priceChange24h: priceData.priceChange24h,
          });

          return priceData;
        } catch (err) {
          console.warn(
            `[LockerPrice] Birdeye fetch failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          throw err;
        }
      },
      this.TOKEN_NAME,
      {
        ...AGGRESSIVE_RETRY_OPTIONS,
        timeoutMs: 12000,
      },
    );

    // If all retries failed, return a static fallback price
    if (!priceData) {
      console.warn(
        `[${this.TOKEN_NAME}] All price fetch attempts failed. Using static fallback price after ${AGGRESSIVE_RETRY_OPTIONS.maxRetries + 1} attempts.`,
      );
      const fallbackData: LockerPriceData = {
        price: 0.00001112,
        priceChange24h: 0,
        volume24h: 0,
        liquidity: 0,
        lastUpdated: new Date(),
        derivationMethod: "static fallback (Birdeye unavailable)",
        isFallback: true,
      };
      this.cachedData = fallbackData;
      this.lastFetchTime = new Date();
      console.log(
        `[${this.TOKEN_NAME}] Returning static fallback price: $${fallbackData.price.toFixed(8)}`,
      );
      return fallbackData;
    }

    return priceData;
  }

  // Get just the price number for quick access
  async getPrice(): Promise<number> {
    const data = await this.getLockerPrice();
    return data?.price || 0;
  }

  // Clear cache to force fresh fetch
  clearCache(): void {
    this.cachedData = null;
    this.lastFetchTime = null;
    console.log(
      "[LockerPriceService] Cache cleared - next fetch will be fresh",
    );
  }
}

export const lockerPriceService = new LockerPriceService();
