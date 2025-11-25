import { tokenPairPricingService } from "./token-pair-pricing";

export interface FXMPriceData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity?: number;
  lastUpdated: Date;
  derivationMethod?: string;
}

class FXMPriceService {
  private cachedData: FXMPriceData | null = null;
  private lastFetchTime: Date | null = null;
  private readonly CACHE_DURATION = 250; // 250ms - ensures live price updates every 250ms for real-time display

  async getFXMPrice(): Promise<FXMPriceData | null> {
    try {
      // Check if we have valid cached data (only from live prices, not fallbacks)
      if (
        this.cachedData &&
        this.lastFetchTime &&
        this.cachedData.derivationMethod !== "fallback"
      ) {
        const timeSinceLastFetch = Date.now() - this.lastFetchTime.getTime();
        if (timeSinceLastFetch < this.CACHE_DURATION) {
          console.log("Returning cached FXM price data");
          return this.cachedData;
        }
      }

      console.log(
        "Fetching fresh FXM price using derived pricing (SOL pair)...",
      );

      // Use derived pricing based on SOL pair
      const pairingData = await tokenPairPricingService.getDerivedPrice("FXM");

      if (!pairingData) {
        console.warn("Failed to derive FXM price");
        return this.getFallbackPrice();
      }

      const priceData: FXMPriceData = {
        price: pairingData.derivedPrice,
        priceChange24h: pairingData.priceChange24h,
        volume24h: pairingData.volume24h,
        liquidity: pairingData.liquidity,
        lastUpdated: pairingData.lastUpdated,
        derivationMethod: `derived from SOL pair (1 SOL = ${pairingData.pairRatio.toFixed(0)} FXM)`,
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
          `✅ FXM price updated: $${priceData.price.toFixed(8)} (${priceData.derivationMethod})`,
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
      console.error("Error fetching FXM price:", error);
      // Don't cache fallback prices - force retry next time
      return this.getFallbackPrice();
    }
  }

  private getFallbackPrice(): FXMPriceData {
    console.log("Using fallback FXM price");
    return {
      price: 0.000003567,
      priceChange24h: 0,
      volume24h: 0,
      lastUpdated: new Date(),
      derivationMethod: "fallback",
    };
  }

  // Get just the price number for quick access
  async getPrice(): Promise<number> {
    const data = await this.getFXMPrice();
    return data?.price || 0.000003567;
  }

  // Clear cache to force fresh fetch
  clearCache(): void {
    this.cachedData = null;
    this.lastFetchTime = null;
    tokenPairPricingService.clearTokenCache("FXM");
  }
}

export const fxmPriceService = new FXMPriceService();
