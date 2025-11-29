import { tokenPairPricingService } from "./token-pair-pricing";
import { saveServicePrice, getCachedServicePrice } from "./offline-cache";

export interface LockerPriceData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity?: number;
  lastUpdated: Date;
  derivationMethod?: string;
  isFallback?: boolean;
}

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

      console.log(
        "Fetching fresh LOCKER price using derived pricing (SOL pair)...",
      );

      // Use derived pricing based on SOL pair
      const pairingData =
        await tokenPairPricingService.getDerivedPrice("LOCKER");

      if (!pairingData) {
        console.warn("Failed to derive LOCKER price - service unavailable");
        return null;
      }

      const priceData: LockerPriceData = {
        price: pairingData.derivedPrice,
        priceChange24h: pairingData.priceChange24h,
        volume24h: pairingData.volume24h,
        liquidity: pairingData.liquidity,
        lastUpdated: pairingData.lastUpdated,
        derivationMethod: `derived from SOL pair (1 SOL = ${pairingData.pairRatio.toFixed(0)} LOCKER)`,
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
          `✅ LOCKER price updated: $${priceData.price.toFixed(8)} (${priceData.derivationMethod})`,
        );

        // Save to localStorage for offline support
        saveServicePrice("LOCKER", {
          price: priceData.price,
          priceChange24h: priceData.priceChange24h,
        });

        return priceData;
      } else {
        console.warn("Invalid price data from derivation");
        return null;
      }
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
    tokenPairPricingService.clearTokenCache("LOCKER");
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
