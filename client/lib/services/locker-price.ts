import { dexscreenerAPI } from "./dexscreener";
import { saveServicePrice } from "./offline-cache";

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

  async getLockerPrice(): Promise<LockerPriceData | null> {
    try {
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

      console.log("Fetching fresh LOCKER price from DexScreener API...");

      // Fetch directly from DexScreener
      const tokens = await dexscreenerAPI.getTokensByMints([LOCKER_MINT]);

      if (!tokens || tokens.length === 0) {
        console.warn("LOCKER not found on DexScreener");
        return null;
      }

      const token = tokens[0];
      const price = token.priceUsd ? parseFloat(token.priceUsd) : null;
      const priceChange24h = token.priceChange?.h24 || 0;
      const volume24h = token.volume?.h24 || 0;
      const liquidity = token.liquidity?.usd;

      if (!price || price <= 0) {
        console.warn("Invalid LOCKER price from DexScreener:", price);
        return null;
      }

      const priceData: LockerPriceData = {
        price,
        priceChange24h,
        volume24h,
        liquidity,
        lastUpdated: new Date(),
        derivationMethod: "DexScreener API (live)",
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
    } catch (error) {
      console.error("Error fetching LOCKER price:", error);
      return null;
    }
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

// Fallback prices for LOCKER when API unavailable due to timeout
const LOCKER_FALLBACK_PRICE: LockerPriceData = {
  price: 0.00001112,
  priceChange24h: 0,
  volume24h: 0,
  liquidity: 0,
  lastUpdated: new Date(),
  derivationMethod: "fallback (API timeout/unavailable)",
  isFallback: true,
};

// Wrap service to add fallback logic
class LockerPriceServiceWithFallback extends LockerPriceService {
  async getLockerPrice(): Promise<LockerPriceData | null> {
    try {
      const result = await super.getLockerPrice();
      if (result) {
        return result;
      }
      console.warn(
        "[LockerPriceService] Falling back to static price due to null result",
      );
      return LOCKER_FALLBACK_PRICE;
    } catch (error) {
      console.warn(
        "[LockerPriceService] Error fetching price, using fallback:",
        error instanceof Error ? error.message : error,
      );
      return LOCKER_FALLBACK_PRICE;
    }
  }
}

export const lockerPriceService = new LockerPriceServiceWithFallback();
