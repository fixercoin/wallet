import { tokenPairPricingService } from "./token-pair-pricing";

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
  private readonly CACHE_DURATION = 5000; // 5 seconds cache for responsive limit orders

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
        "Fetching fresh FIXERCOIN price using derived pricing (SOL pair)...",
      );

      // Use derived pricing based on SOL pair
      const pairingData =
        await tokenPairPricingService.getDerivedPrice("FIXERCOIN");

      if (!pairingData) {
        console.warn("Failed to derive FIXERCOIN price");
        return this.getFallbackPrice();
      }

      const priceData: FixercoinPriceData = {
        price: pairingData.derivedPrice,
        priceChange24h: pairingData.priceChange24h,
        volume24h: pairingData.volume24h,
        liquidity: pairingData.liquidity,
        lastUpdated: pairingData.lastUpdated,
        derivationMethod: `derived from SOL pair (1 SOL = ${pairingData.pairRatio.toFixed(2)} FIXERCOIN)`,
      };

      // Only cache if we got valid, live price data (not fallback)
      if (
        priceData.price > 0 &&
        isFinite(priceData.price) &&
        pairingData.derivedPrice > 0
      ) {
        this.cachedData = priceData;
        this.lastFetchTime = new Date();
        console.log(
          `✅ FIXERCOIN price updated: $${priceData.price.toFixed(8)} (${priceData.derivationMethod})`,
        );
        return priceData;
      } else {
        console.warn(
          "Invalid price data from derivation, using fallback (not cached)",
        );
        // Don't cache fallback prices so they retry on next call
        return this.getFallbackPrice();
      }
    } catch (error) {
      console.error("Error fetching FIXERCOIN price:", error);
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
