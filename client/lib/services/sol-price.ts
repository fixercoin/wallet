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
   * Validate that response is actually JSON
   */
  private isJsonResponse(response: Response): boolean {
    const contentType = response.headers.get("content-type") || "";
    return contentType.includes("application/json");
  }

  /**
   * Fetch SOL price via proxy endpoint
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
      const response = await fetch("/api/sol/price");

      // Try to parse response as JSON regardless of content-type
      // (server may return errors with wrong content-type)
      let data: any;
      try {
        data = await response.json();
      } catch (parseError) {
        // If JSON parsing fails and response is not ok, log and use fallback
        if (!response.ok) {
          const contentType = response.headers.get("content-type") || "unknown";
          console.warn(
            `SOL price API returned ${response.status} with content-type: ${contentType}. Using fallback.`,
          );
          throw new Error(`Failed to fetch SOL price: HTTP ${response.status}`);
        }
        console.error(
          "Failed to parse SOL price response as JSON:",
          parseError,
        );
        throw parseError;
      }

      // Check if response status is ok after successful JSON parse
      if (!response.ok) {
        console.warn(
          `SOL price API returned ${response.status}, but JSON was parsed. Using fallback.`,
        );
        throw new Error(`Failed to fetch SOL price: ${response.status}`);
      }

      // Validate data structure
      if (!data || typeof data !== "object") {
        console.error("Invalid SOL price response structure:", data);
        throw new Error("Invalid response structure");
      }

      // Handle both direct price response and nested structure
      let priceData: SolPriceData;

      if (data.price !== undefined) {
        // Direct response format from proxy
        priceData = {
          price: data.price || 0,
          price_change_24h: data.price_change_24h ?? data.priceChange24h ?? 0,
          market_cap: data.market_cap ?? data.marketCap ?? 0,
          volume_24h: data.volume_24h ?? data.volume24h ?? 0,
        };
      } else if (data.solana) {
        // CoinGecko response format
        priceData = {
          price: data.solana.usd || 0,
          price_change_24h: data.solana.usd_24h_change || 0,
          market_cap: data.solana.usd_market_cap || 0,
          volume_24h: data.solana.usd_24h_vol || 0,
        };
      } else {
        console.warn("SOL price response missing expected fields:", data);
        throw new Error("Missing price data in response");
      }

      // Validate price is a valid number
      if (!isFinite(priceData.price)) {
        console.warn("SOL price is not a valid number:", priceData.price);
        throw new Error("Invalid price value");
      }

      // Update cache
      this.cache = {
        data: priceData,
        timestamp: Date.now(),
      };

      return priceData;
    } catch (error) {
      console.error("Error fetching SOL price:", error);

      // Return cached price if available
      if (this.cache.data) {
        console.log("Returning cached SOL price due to error");
        return this.cache.data;
      }

      // Fallback to approximate price
      console.log("Using fallback SOL price ($100)");
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
