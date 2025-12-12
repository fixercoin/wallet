import { birdeyeAPI } from "./birdeye";
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
  private readonly CACHE_DURATION = 250; // live updates every 250ms
  private readonly TOKEN_NAME = "FXM";

  async getFXMPrice(): Promise<FXMPriceData | null> {
    // Return cached (only from live source)
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

    // Fetch with retry logic
    const priceData = await retryWithExponentialBackoff(
      async () => {
        console.log("Fetching fresh FXM price from Birdeye...");

        try {
          // Fetch FXM price from Birdeye
          const fxmToken = await birdeyeAPI.getTokenByMint(FXM_MINT);

          if (!fxmToken) {
            throw new Error("FXM not found on Birdeye");
          }

          const price = fxmToken.priceUsd;

          if (!price || !isFinite(price) || price <= 0) {
            throw new Error(`Invalid FXM price from Birdeye: ${price}`);
          }

          const result: FXMPriceData = {
            price,
            priceChange24h: fxmToken.priceChange?.h24 || 0,
            volume24h: fxmToken.volume?.h24 || 0,
            liquidity: fxmToken.liquidity?.usd,
            lastUpdated: new Date(),
            derivationMethod: "Birdeye (live)",
          };

          this.cachedData = result;
          this.lastFetchTime = new Date();

          console.log(
            `✅ FXM price updated: $${result.price.toFixed(8)} via ${result.derivationMethod}`,
          );

          return result;
        } catch (err) {
          console.warn(
            `[FXMPrice] Birdeye fetch failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          throw err;
        }
      },
      this.TOKEN_NAME,
      {
        ...AGGRESSIVE_RETRY_OPTIONS,
        timeoutMs: 12000,
      },
    );

    if (!priceData) {
      console.warn(
        `[${this.TOKEN_NAME}] All price fetch attempts failed after ${AGGRESSIVE_RETRY_OPTIONS.maxRetries + 1} attempts. Using static fallback.`,
      );

      const fallbackData: FXMPriceData = {
        price: 0.0000043,
        priceChange24h: 0,
        volume24h: 0,
        liquidity: 0,
        lastUpdated: new Date(),
        derivationMethod: "static fallback (Birdeye unavailable)",
        isFallback: true,
      };

      this.cachedData = fallbackData;
      this.lastFetchTime = new Date();

      return fallbackData;
    }

    return priceData;
  }

  async getPrice(): Promise<number> {
    const data = await this.getFXMPrice();
    return data?.price || 0;
  }

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

  clearCache(): void {
    this.cachedData = null;
    this.lastFetchTime = null;
    console.log("[FXMPriceService] Cache cleared");
  }
}

export const fxmPriceService = new FXMPriceService();
