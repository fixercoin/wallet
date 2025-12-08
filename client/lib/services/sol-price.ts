import { retryWithExponentialBackoff } from "./retry-fetch";

export interface SolPriceData {
  price: number;
  price_change_24h: number;
  market_cap: number;
  volume_24h: number;
}

class SolPriceService {
  private cache: { data: SolPriceData | null; timestamp: number } = {
    data: null,
    timestamp: 0,
  };

  private readonly CACHE_DURATION = 1500; // 1.5 seconds in-memory only

  async getSolPrice(): Promise<SolPriceData | null> {
    // Use in-memory short cache only
    if (
      this.cache.data &&
      Date.now() - this.cache.timestamp < this.CACHE_DURATION
    ) {
      return this.cache.data;
    }

    const priceData = await retryWithExponentialBackoff(
      async () => {
        console.log("[SOL Price] Fetching fresh SOL price...");

        let response: Response;
        try {
          response = await fetch("/api/sol/price");
        } catch (err) {
          console.error("[SOL Price] Network error:", err);
          throw err;
        }

        let data: any;
        try {
          data = await response.json();
        } catch (parseErr) {
          console.error("[SOL Price] JSON parse error:", parseErr);
          throw parseErr;
        }

        if (!data || typeof data !== "object") {
          throw new Error("Invalid SOL price response");
        }

        let priceData: SolPriceData;

        // Direct proxy format
        if (data.price !== undefined) {
          priceData = {
            price: data.price || 0,
            price_change_24h: data.price_change_24h ?? 0,
            market_cap: data.market_cap ?? 0,
            volume_24h: data.volume_24h ?? 0,
          };
        }
        // Fallback formats
        else if (data.priceUsd !== undefined) {
          priceData = {
            price: data.priceUsd || 0,
            price_change_24h: data.price_change_24h ?? 0,
            market_cap: data.market_cap ?? 0,
            volume_24h: data.volume_24h ?? 0,
          };
        }
        else if (data.solana) {
          priceData = {
            price: data.solana.usd || 0,
            price_change_24h: data.solana.usd_24h_change || 0,
            market_cap: data.solana.usd_market_cap || 0,
            volume_24h: data.solana.usd_24h_vol || 0,
          };
        }
        else {
          console.warn("[SOL Price] Missing price fields");
          priceData = { price: 0, price_change_24h: 0, market_cap: 0, volume_24h: 0 };
        }

        if (!isFinite(priceData.price) || priceData.price <= 0) {
          console.warn("[SOL Price] Invalid price value, using fallback 100");
          priceData.price = 100;
        }

        // Save only to memory, no offline cache
        this.cache = {
          data: priceData,
          timestamp: Date.now(),
        };

        console.log(`[SOL Price] Updated: $${priceData.price.toFixed(2)}`);

        return priceData;
      },
      "SOL",
      AGGRESSIVE_RETRY_OPTIONS,
    );

    // If retry returned data, return it
    if (priceData) return priceData;

    // Use last in-memory cache if available
    if (this.cache.data) return this.cache.data;

    // Final fallback
    return {
      price: 100,
      price_change_24h: 0,
      market_cap: 0,
      volume_24h: 0,
    };
  }

  async getSolPriceSimple(): Promise<number> {
    const data = await this.getSolPrice();
    return data?.price || 100;
  }

  clearCache(): void {
    this.cache = { data: null, timestamp: 0 };
  }
}

export const solPriceService = new SolPriceService();
