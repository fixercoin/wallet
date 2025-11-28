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
        console.warn("Invalid price data from derivation - trying cache");
        // Try to get price from localStorage as fallback
        const cachedServicePrice = getCachedServicePrice("LOCKER");
        if (cachedServicePrice && cachedServicePrice.price > 0) {
          console.log(
            `[LOCKER Price Service] Using localStorage cached price: $${cachedServicePrice.price.toFixed(8)}`,
          );
          return {
            price: cachedServicePrice.price,
            priceChange24h: cachedServicePrice.priceChange24h ?? 0,
            volume24h: 0,
            lastUpdated: new Date(),
            derivationMethod: "cache",
            isFallback: true,
          };
        }
        return null;
      }
    } catch (error) {
      console.error("Error fetching LOCKER price:", error);

      // Try to get price from localStorage as fallback on error
      const cachedServicePrice = getCachedServicePrice("LOCKER");
      if (cachedServicePrice && cachedServicePrice.price > 0) {
        console.log(
          `[LOCKER Price Service] Using localStorage cached price on error: $${cachedServicePrice.price.toFixed(8)}`,
        );
        return {
          price: cachedServicePrice.price,
          priceChange24h: cachedServicePrice.priceChange24h ?? 0,
          volume24h: 0,
          lastUpdated: new Date(),
          derivationMethod: "cache",
          isFallback: true,
        };
      }
      return null;
    }
  }

  private getFallbackPrice(): LockerPriceData | null {
    console.log(
      "LOCKER price service unavailable - returning null to show loading state",
    );
    return null;
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

export const lockerPriceService = new LockerPriceService();
