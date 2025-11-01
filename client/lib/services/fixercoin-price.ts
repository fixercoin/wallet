import { dexscreenerAPI } from "./dexscreener";
import { FIXERCOIN_TOKEN_INFO } from "./fixercoin";
import { dexscreenerAPI } from "./dexscreener";

export interface FixercoinPriceData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap?: number;
  liquidity?: number;
  lastUpdated: Date;
}

class FixercoinPriceService {
  private cachedData: FixercoinPriceData | null = null;
  private lastFetchTime: Date | null = null;
  private readonly CACHE_DURATION = 60000; // 1 minute cache

  async getFixercoinPrice(): Promise<FixercoinPriceData | null> {
    try {
      // Check if we have valid cached data
      if (this.cachedData && this.lastFetchTime) {
        const timeSinceLastFetch = Date.now() - this.lastFetchTime.getTime();
        if (timeSinceLastFetch < this.CACHE_DURATION) {
          console.log("Returning cached FIXERCOIN price data");
          return this.cachedData;
        }
      }

      console.log("Fetching fresh FIXERCOIN price from DexScreener...");

      // Fetch FIXERCOIN data from DexScreener
      const dexData = await dexscreenerAPI.getTokenByMint(
        FIXERCOIN_TOKEN_INFO.mintAddress,
      );

      if (!dexData) {
        console.warn("No DexScreener data found for FIXERCOIN");
        return this.getFallbackPrice();
      }

      // Extract price data
      const priceData: FixercoinPriceData = {
        price: dexData.priceUsd ? parseFloat(dexData.priceUsd) : 0,
        priceChange24h: dexData.priceChange?.h24 || 0,
        volume24h: dexData.volume?.h24 || 0,
        marketCap: dexData.marketCap,
        liquidity: dexData.liquidity?.usd,
        lastUpdated: new Date(),
      };

      // Only cache if we got valid price data
      if (priceData.price > 0) {
        this.cachedData = priceData;
        this.lastFetchTime = new Date();
        console.log(`FIXERCOIN price updated: $${priceData.price.toFixed(8)}`);
        return priceData;
      } else {
        console.warn("Invalid price data from DexScreener, using fallback");
        return this.getFallbackPrice();
      }
    } catch (error) {
      console.error("Error fetching FIXERCOIN price from DexScreener:", error);
      return this.getFallbackPrice();
    }
  }

  private getFallbackPrice(): FixercoinPriceData {
    console.log("Using fallback FIXERCOIN price");
    return {
      price: 0.000023, // Conservative fallback price
      priceChange24h: 0,
      volume24h: 0,
      lastUpdated: new Date(),
    };
  }

  // Get just the price number for quick access
  async getPrice(): Promise<number> {
    const data = await this.getFixercoinPrice();
    return data?.price || 0.000023;
  }

  // Clear cache to force fresh fetch
  clearCache(): void {
    this.cachedData = null;
    this.lastFetchTime = null;
  }
}

export const fixercoinPriceService = new FixercoinPriceService();
