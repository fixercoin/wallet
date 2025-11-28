import { tokenPairPricingService } from "./token-pair-pricing";
import { saveServicePrice, getCachedServicePrice } from "./offline-cache";

export interface FXMPriceData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity?: number;
  lastUpdated: Date;
  derivationMethod?: string;
  isFallback?: boolean;
}

const FXM_MINT = "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump";

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
        this.cachedData.derivationMethod !== "fallback" &&
        this.cachedData.derivationMethod !== "hardcoded fallback"
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

      // Try derived pricing based on SOL pair (uses DexScreener and Jupiter, no Birdeye)
      const pairingData = await tokenPairPricingService.getDerivedPrice("FXM");

      if (
        pairingData &&
        pairingData.derivedPrice > 0 &&
        isFinite(pairingData.derivedPrice)
      ) {
        const priceData: FXMPriceData = {
          price: pairingData.derivedPrice,
          priceChange24h: pairingData.priceChange24h,
          volume24h: pairingData.volume24h,
          liquidity: pairingData.liquidity,
          lastUpdated: pairingData.lastUpdated,
          derivationMethod: `derived from SOL pair (1 SOL = ${pairingData.pairRatio.toFixed(0)} FXM)`,
        };

        this.cachedData = priceData;
        this.lastFetchTime = new Date();
        console.log(
          `✅ FXM price updated: $${priceData.price.toFixed(8)} (${priceData.derivationMethod})`,
        );

        // Save to localStorage for offline support
        saveServicePrice("FXM", {
          price: priceData.price,
          priceChange24h: priceData.priceChange24h,
        });

        return priceData;
      }

      console.warn(
        "Failed to fetch FXM price from DexScreener/Jupiter - service unavailable",
      );
      return null;
    } catch (error) {
      console.error("Error fetching FXM price:", error);
      return null;
    }
  }

  // Get just the price number for quick access
  async getPrice(): Promise<number> {
    const data = await this.getFXMPrice();
    return data?.price || 0;
  }

  // Get the price with derivation method info
  async getFXMPriceWithMethod(): Promise<{
    price: number;
    derivationMethod: string;
  }> {
    const data = await this.getFXMPrice();
    return {
      price: data?.price || 0,
      derivationMethod: data?.derivationMethod || "unavailable",
    };
  }

  // Clear cache to force fresh fetch
  clearCache(): void {
    this.cachedData = null;
    this.lastFetchTime = null;
    tokenPairPricingService.clearTokenCache("FXM");
  }
}

export const fxmPriceService = new FXMPriceService();
