import { tokenPairPricingService } from "./token-pair-pricing";

export interface LockerPriceData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity?: number;
  lastUpdated: Date;
  derivationMethod?: string;
}

class LockerPriceService {
  private cachedData: LockerPriceData | null = null;
  private lastFetchTime: Date | null = null;
  private readonly CACHE_DURATION = 60000; // 1 minute cache

  async getLockerPrice(): Promise<LockerPriceData | null> {
    try {
      // Check if we have valid cached data
      if (this.cachedData && this.lastFetchTime) {
        const timeSinceLastFetch = Date.now() - this.lastFetchTime.getTime();
        if (timeSinceLastFetch < this.CACHE_DURATION) {
          console.log("Returning cached LOCKER price data");
          return this.cachedData;
        }
      }

      console.log(
        "Fetching fresh LOCKER price using derived pricing (SOL pair)...",
      );

      // Use derived pricing based on SOL pair
      const pairingData =
        await tokenPairPricingService.getDerivedPrice("LOCKER");

      if (!pairingData) {
        console.warn("Failed to derive LOCKER price");
        return this.getFallbackPrice();
      }

      const priceData: LockerPriceData = {
        price: pairingData.derivedPrice,
        priceChange24h: pairingData.priceChange24h,
        volume24h: pairingData.volume24h,
        liquidity: pairingData.liquidity,
        lastUpdated: pairingData.lastUpdated,
        derivationMethod: `derived from SOL pair (1 SOL = ${pairingData.pairRatio.toFixed(0)} LOCKER)`,
      };

      // Only cache if we got valid price data
      if (priceData.price > 0) {
        this.cachedData = priceData;
        this.lastFetchTime = new Date();
        console.log(
          `LOCKER price updated: $${priceData.price.toFixed(8)} (${priceData.derivationMethod})`,
        );
        return priceData;
      } else {
        console.warn("Invalid price data from derivation, using fallback");
        return this.getFallbackPrice();
      }
    } catch (error) {
      console.error("Error fetching LOCKER price:", error);
      return this.getFallbackPrice();
    }
  }

  private getFallbackPrice(): LockerPriceData {
    console.log("Using fallback LOCKER price");
    return {
      price: 0.00001112,
      priceChange24h: 0,
      volume24h: 0,
      lastUpdated: new Date(),
      derivationMethod: "fallback",
    };
  }

  // Get just the price number for quick access
  async getPrice(): Promise<number> {
    const data = await this.getLockerPrice();
    return data?.price || 0.00001112;
  }

  // Clear cache to force fresh fetch
  clearCache(): void {
    this.cachedData = null;
    this.lastFetchTime = null;
    tokenPairPricingService.clearTokenCache("LOCKER");
  }
}

export const lockerPriceService = new LockerPriceService();
