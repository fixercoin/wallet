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

  private readonly CACHE_DURATION = 60000; // 1 minute cache

  /**
   * Fetch SOL price from CoinGecko API
   */
  async getSolPrice(): Promise<SolPriceData | null> {
    // Check cache first
    if (
      this.cache.data &&
      Date.now() - this.cache.timestamp < this.CACHE_DURATION
    ) {
      return this.cache.data;
    }

    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true",
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch SOL price: ${response.status}`);
      }

      const data = await response.json();

      if (data.solana) {
        const priceData: SolPriceData = {
          price: data.solana.usd || 0,
          price_change_24h: data.solana.usd_24h_change || 0,
          market_cap: data.solana.usd_market_cap || 0,
          volume_24h: data.solana.usd_24h_vol || 0,
        };

        // Update cache
        this.cache = {
          data: priceData,
          timestamp: Date.now(),
        };

        return priceData;
      }

      return null;
    } catch (error) {
      console.error("Error fetching SOL price:", error);

      // Return fallback price if available in cache
      if (this.cache.data) {
        return this.cache.data;
      }

      // Fallback to approximate price
      return {
        price: 100,
        price_change_24h: 0,
        market_cap: 0,
        volume_24h: 0,
      };
    }
  }

  /**
   * Get SOL price with simple number return
   */
  async getSolPriceSimple(): Promise<number> {
    const data = await this.getSolPrice();
    return data?.price || 100;
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache = { data: null, timestamp: 0 };
  }
}

export const solPriceService = new SolPriceService();
