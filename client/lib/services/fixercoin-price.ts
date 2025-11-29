import { dexscreenerAPI } from "./dexscreener";
import { saveServicePrice } from "./offline-cache";

export interface FixercoinPriceData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap?: number;
  liquidity?: number;
  lastUpdated: Date;
  derivationMethod?: string;
  isFallback?: boolean;
}

const FIXERCOIN_MINT = "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump";

class FixercoinPriceService {
  private cachedData: FixercoinPriceData | null = null;
  private lastFetchTime: Date | null = null;
  private readonly CACHE_DURATION = 250; // 250ms - ensures live price updates every 250ms for real-time display

  async getFixercoinPrice(): Promise<FixercoinPriceData | null> {
    try {
      // Check if we have valid cached data (only from live prices, not fallbacks)
      if (
        this.cachedData &&
        this.lastFetchTime &&
        this.cachedData.derivationMethod !== "fallback"
      ) {
        const timeSinceLastFetch = Date.now() - this.lastFetchTime.getTime();
        if (timeSinceLastFetch < this.CACHE_DURATION) {
          console.log("Returning cached FIXERCOIN price data");
          return this.cachedData;
        }
      }

      console.log("Fetching fresh FIXERCOIN price from DexScreener API...");

      // Fetch directly from DexScreener
      const tokens = await dexscreenerAPI.getTokensByMints([FIXERCOIN_MINT]);

      if (!tokens || tokens.length === 0) {
        console.warn("FIXERCOIN not found on DexScreener");
        return null;
      }

      const token = tokens[0];
      const price = token.priceUsd ? parseFloat(token.priceUsd) : null;
      const priceChange24h = token.priceChange?.h24 || 0;
      const volume24h = token.volume?.h24 || 0;
      const liquidity = token.liquidity?.usd;
      const marketCap = token.marketCap;

      if (!price || price <= 0) {
        console.warn("Invalid FIXERCOIN price from DexScreener:", price);
        return null;
      }

      const priceData: FixercoinPriceData = {
        price,
        priceChange24h,
        volume24h,
        liquidity,
        marketCap,
        lastUpdated: new Date(),
        derivationMethod: "DexScreener API (live)",
      };

      this.cachedData = priceData;
      this.lastFetchTime = new Date();
      console.log(
        `✅ FIXERCOIN price updated: $${priceData.price.toFixed(8)} (24h: ${priceChange24h.toFixed(2)}%) via ${priceData.derivationMethod}`,
      );

      // Save to localStorage for offline support
      saveServicePrice("FIXERCOIN", {
        price: priceData.price,
        priceChange24h: priceData.priceChange24h,
      });

      return priceData;
    } catch (error) {
      console.error("Error fetching FIXERCOIN price:", error);
      return null;
    }
  }

  // Get just the price number for quick access
  async getPrice(): Promise<number> {
    const data = await this.getFixercoinPrice();
    return data?.price || 0;
  }

  // Clear cache to force fresh fetch
  clearCache(): void {
    this.cachedData = null;
    this.lastFetchTime = null;
    console.log(
      "[FixercoinPriceService] Cache cleared - next fetch will be fresh",
    );
  }
}

// Fallback prices for FIXERCOIN when API unavailable due to timeout
const FIXERCOIN_FALLBACK_PRICE: FixercoinPriceData = {
  price: 0.00008139,
  priceChange24h: 0,
  volume24h: 0,
  liquidity: 0,
  lastUpdated: new Date(),
  derivationMethod: "fallback (API timeout/unavailable)",
  isFallback: true,
};

// Wrap service to add fallback logic
class FixercoinPriceServiceWithFallback extends FixercoinPriceService {
  async getFixercoinPrice(): Promise<FixercoinPriceData | null> {
    try {
      const result = await super.getFixercoinPrice();
      if (result) {
        return result;
      }
      console.warn(
        "[FixercoinPriceService] Falling back to static price due to null result",
      );
      return FIXERCOIN_FALLBACK_PRICE;
    } catch (error) {
      console.warn(
        "[FixercoinPriceService] Error fetching price, using fallback:",
        error instanceof Error ? error.message : error,
      );
      return FIXERCOIN_FALLBACK_PRICE;
    }
  }
}

export const fixercoinPriceService = new FixercoinPriceServiceWithFallback();
