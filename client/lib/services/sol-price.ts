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

      // Check content-type before trying to parse as JSON
      if (!this.isJsonResponse(response)) {
        const contentType = response.headers.get("content-type") || "unknown";
        const bodyPreview = await response
          .text()
          .then((t) => t.substring(0, 200))
          .catch(() => "");
        console.error(
          `SOL price API returned invalid content-type: ${contentType}. Response: ${bodyPreview}`,
        );
        throw new Error(
          `Invalid response content-type: ${contentType}. Expected application/json`,
        );
      }

      if (!response.ok) {
        console.warn(`SOL price API returned ${response.status}`);
        throw new Error(`Failed to fetch SOL price: ${response.status}`);
      }

      let data: any;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error(
          "Failed to parse SOL price response as JSON:",
          parseError,
        );
        throw parseError;
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
      console.log("Using fallback SOL price");
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
