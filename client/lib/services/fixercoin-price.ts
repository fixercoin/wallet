import { dexscreenerAPI } from "./dexscreener";

export interface FixercoinPriceData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap?: number;
  liquidity?: number;
  lastUpdated: Date;
  derivationMethod?: string;
}

class FixercoinPriceService {
  private cachedData: FixercoinPriceData | null = null;
  private lastFetchTime: Date | null = null;
  private readonly CACHE_DURATION = 3000; // 3 seconds cache for responsive limit orders
  private readonly FIXERCOIN_MINT = "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump";

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

      console.log(
        "Fetching fresh FIXERCOIN price directly from DexScreener API...",
      );

      // Fetch directly from DexScreener for most accurate real-time price
      const tokenData = await dexscreenerAPI.getTokenByMint(this.FIXERCOIN_MINT);

      if (!tokenData || !tokenData.priceUsd) {
        console.warn("Failed to fetch FIXERCOIN price from DexScreener");
        return this.getFallbackPrice();
      }

      const price = parseFloat(tokenData.priceUsd);
      const priceChange24h = tokenData.priceChange24h || 0;
      const volume24h = tokenData.volume24h || 0;

      const priceData: FixercoinPriceData = {
        price,
        priceChange24h,
        volume24h,
        liquidity: tokenData.liquidity,
        lastUpdated: new Date(),
        derivationMethod: "DexScreener API",
      };

      // Only cache if we got valid, live price data (not fallback)
      if (price > 0 && isFinite(price)) {
        this.cachedData = priceData;
        this.lastFetchTime = new Date();
        console.log(
          `✅ FIXERCOIN price updated: $${priceData.price.toFixed(8)} (24h: ${priceChange24h.toFixed(2)}%) via DexScreener`,
        );
        return priceData;
      } else {
        console.warn(
          "Invalid price data from DexScreener, using fallback (not cached)",
        );
        // Don't cache fallback prices so they retry on next call
        return this.getFallbackPrice();
      }
    } catch (error) {
      console.error("Error fetching FIXERCOIN price from DexScreener:", error);
      // Don't cache fallback prices - force retry next time
      return this.getFallbackPrice();
    }
  }

  private getFallbackPrice(): FixercoinPriceData {
    console.log("Using fallback FIXERCOIN price");
    return {
      price: 0.00008139,
      priceChange24h: 0,
      volume24h: 0,
      lastUpdated: new Date(),
      derivationMethod: "fallback",
    };
  }

  // Get just the price number for quick access
  async getPrice(): Promise<number> {
    const data = await this.getFixercoinPrice();
    return data?.price || 0.00008139;
  }

  // Clear cache to force fresh fetch
  clearCache(): void {
    this.cachedData = null;
    this.lastFetchTime = null;
    tokenPairPricingService.clearTokenCache("FIXERCOIN");
  }
}

export const fixercoinPriceService = new FixercoinPriceService();
