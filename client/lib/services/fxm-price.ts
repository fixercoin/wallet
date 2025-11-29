import { dexscreenerAPI } from "./dexscreener";
import { saveServicePrice } from "./offline-cache";
import {
  retryWithExponentialBackoff,
  AGGRESSIVE_RETRY_OPTIONS,
} from "./retry-fetch";

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
  private readonly TOKEN_NAME = "FXM";

  async getFXMPrice(): Promise<FXMPriceData | null> {
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

    // Use retry logic to fetch price from DexScreener
    const priceData = await retryWithExponentialBackoff(
      async () => {
        console.log("Fetching fresh FXM price from DexScreener API...");

        // Fetch directly from DexScreener with no fallback
        const tokens = await dexscreenerAPI.getTokensByMints([FXM_MINT]);

        if (!tokens || tokens.length === 0) {
          throw new Error("FXM not found on DexScreener");
        }

        const token = tokens[0];
        const price = token.priceUsd ? parseFloat(token.priceUsd) : null;
        const priceChange24h = token.priceChange?.h24 || 0;
        const volume24h = token.volume?.h24 || 0;
        const liquidity = token.liquidity?.usd;

        if (!price || price <= 0) {
          throw new Error(`Invalid FXM price from DexScreener: ${price}`);
        }

        const priceData: FXMPriceData = {
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
          `✅ FXM price updated: $${priceData.price.toFixed(8)} (24h: ${priceChange24h.toFixed(2)}%) via ${priceData.derivationMethod}`,
        );

        // Save to localStorage for offline support
        saveServicePrice("FXM", {
          price: priceData.price,
          priceChange24h: priceData.priceChange24h,
        });

        return priceData;
      },
      this.TOKEN_NAME,
      AGGRESSIVE_RETRY_OPTIONS,
    );

    // Return null only if all retries failed - never return fallback
    if (!priceData) {
      console.warn(
        `[${this.TOKEN_NAME}] All price fetch attempts failed. Will retry on next request.`,
      );
    }

    return priceData;
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
    console.log("[FXMPriceService] Cache cleared - next fetch will be fresh");
  }
}

export const fxmPriceService = new FXMPriceService();
