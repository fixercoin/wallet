/**
 * CoinMarketCap API Service for token price fetching
 * Replaces Jupiter as primary price provider
 */

interface CoinMarketCapToken {
  id: number;
  symbol: string;
  name: string;
  slug: string;
  rank: number;
  is_active: number;
  first_historical_data: string;
  last_historical_data: string;
  platform?: {
    id: number;
    name: string;
    symbol: string;
    slug: string;
    token_address: string;
  };
}

interface CoinMarketCapQuote {
  price: number;
  volume_24h?: number;
  volume_7d?: number;
  volume_30d?: number;
  market_cap?: number;
  market_cap_dominance?: number;
  circulating_supply?: number;
  total_supply?: number;
  max_supply?: number;
  percent_change_1h?: number;
  percent_change_24h?: number;
  percent_change_7d?: number;
  percent_change_30d?: number;
  last_updated?: string;
}

interface CoinMarketCapResponse {
  status: {
    timestamp: string;
    error_code: number;
    error_message: string | null;
    elapsed: number;
    credit_count: number;
    notice: string | null;
  };
  data?: Record<
    string,
    {
      id: number;
      name: string;
      symbol: string;
      slug: string;
      cmc_rank: number;
      num_market_pairs: number;
      circulating_supply: number;
      total_supply: number;
      max_supply?: number;
      last_updated: string;
      date_added: string;
      tags: string[];
      platform?: CoinMarketCapToken["platform"];
      quote?: {
        USD: CoinMarketCapQuote;
      };
    }
  >;
}

// Map Solana token mints to CoinMarketCap symbols or IDs
const MINT_TO_CMC_SYMBOL: Record<string, string> = {
  // Major tokens
  So11111111111111111111111111111111111111112: "SOL", // Solana
  EPjFWaLb3iNxoeiKCBL7E3em9nYvRyBjBP9v4G29jkn6: "USDC", // USDC
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns: "USDT", // USDT
  // Pump.fun tokens - use contract addresses for lookup
  H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: "FIXERCOIN",
  EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: "LOCKER",
};

class CoinMarketCapAPI {
  private apiKey: string = "";
  private readonly baseUrl = "https://pro-api.coinmarketcap.com/v1";
  private readonly proxyUrl = "/api/coinmarketcap"; // Proxy endpoint for client
  private tokenCache = new Map<string, { price: number; timestamp: number }>();
  private cacheTTL = 60000; // 60 seconds cache

  constructor(apiKey?: string) {
    this.apiKey = apiKey || "";
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Get price for a single token
   */
  async getTokenPrice(tokenMint: string): Promise<number | null> {
    try {
      const prices = await this.getTokenPrices([tokenMint]);
      return prices[tokenMint] || null;
    } catch (error) {
      console.error(
        `[CoinMarketCap] Error fetching price for ${tokenMint}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get prices for multiple tokens
   */
  async getTokenPrices(tokenMints: string[]): Promise<Record<string, number>> {
    try {
      const uniqueMints = Array.from(new Set(tokenMints));
      const prices: Record<string, number> = {};

      // Check cache first
      const now = Date.now();
      const cachedMints: string[] = [];
      const uncachedMints: string[] = [];

      for (const mint of uniqueMints) {
        const cached = this.tokenCache.get(mint);
        if (cached && now - cached.timestamp < this.cacheTTL) {
          prices[mint] = cached.price;
          cachedMints.push(mint);
        } else {
          uncachedMints.push(mint);
        }
      }

      if (cachedMints.length > 0) {
        console.log(`[CoinMarketCap] ${cachedMints.length} prices from cache`);
      }

      if (uncachedMints.length === 0) {
        return prices;
      }

      // Fetch uncached prices
      const symbols = uncachedMints
        .map((mint) => MINT_TO_CMC_SYMBOL[mint] || mint)
        .filter(Boolean);

      if (symbols.length === 0) {
        return prices;
      }

      console.log(
        `[CoinMarketCap] Fetching ${symbols.length} token prices: ${symbols.join(", ")}`,
      );

      // Use proxy endpoint if available, otherwise direct API
      const response = await this.fetchPrices(symbols);
      if (!response) {
        return prices;
      }

      // Map response data back to mints
      for (const mint of uncachedMints) {
        const symbol = MINT_TO_CMC_SYMBOL[mint] || mint;
        const tokenData = response[symbol];

        if (tokenData?.quote?.USD?.price) {
          const price = tokenData.quote.USD.price;
          prices[mint] = price;
          this.tokenCache.set(mint, { price, timestamp: now });
        }
      }

      const foundCount = Object.keys(prices).length;
      console.log(
        `[CoinMarketCap] ✅ Got ${foundCount} prices (${cachedMints.length} cached, ${uncachedMints.length} fetched)`,
      );

      return prices;
    } catch (error) {
      console.error("[CoinMarketCap] Error fetching prices:", error);
      return {};
    }
  }

  /**
   * Fetch prices from CoinMarketCap API
   */
  private async fetchPrices(
    symbols: string[],
  ): Promise<CoinMarketCapResponse["data"] | null> {
    try {
      // Always try proxy first (server-side with API key configured)
      try {
        return await this.fetchViaProxy(symbols);
      } catch (proxyError) {
        console.warn(
          "[CoinMarketCap] Proxy fetch failed, falling back to direct API:",
          proxyError,
        );
        // If proxy fails, try direct API as fallback
        if (this.apiKey) {
          return await this.fetchDirect(symbols);
        }
      }

      return null;
    } catch (error) {
      console.error("[CoinMarketCap] Fetch error:", error);
      return null;
    }
  }

  /**
   * Fetch via proxy endpoint
   */
  private async fetchViaProxy(
    symbols: string[],
  ): Promise<CoinMarketCapResponse["data"] | null> {
    try {
      const params = new URLSearchParams({
        symbols: symbols.join(","),
      });

      const response = await fetch(
        `${this.proxyUrl}/quotes?${params.toString()}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Proxy error: ${response.status} ${response.statusText}`,
        );
      }

      const data: CoinMarketCapResponse = await response.json();
      if (data.data) {
        return data.data;
      }

      return null;
    } catch (error) {
      console.warn("[CoinMarketCap] Proxy fetch failed:", error);
      return null;
    }
  }

  /**
   * Fetch directly from CoinMarketCap API (limited without auth)
   */
  private async fetchDirect(
    symbols: string[],
  ): Promise<CoinMarketCapResponse["data"] | null> {
    try {
      const params = new URLSearchParams({
        symbol: symbols.join(","),
        convert: "USD",
        ...(this.apiKey && { CMC_PRO_API_KEY: this.apiKey }),
      });

      const url = `${this.baseUrl}/cryptocurrency/quotes/latest?${params.toString()}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(this.apiKey && { "X-CMC_PRO_API_KEY": this.apiKey }),
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data: CoinMarketCapResponse = await response.json();
      if (data.status.error_code !== 0) {
        throw new Error(
          `API error: ${data.status.error_message || "Unknown error"}`,
        );
      }

      return data.data || null;
    } catch (error) {
      console.warn("[CoinMarketCap] Direct fetch failed:", error);
      return null;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.tokenCache.clear();
    console.log("[CoinMarketCap] Cache cleared");
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; hits: number } {
    return {
      size: this.tokenCache.size,
      hits: this.tokenCache.size,
    };
  }
}

// Singleton instance
export const coinmarketcapAPI = new CoinMarketCapAPI(
  import.meta.env.VITE_COINMARKETCAP_API_KEY || "",
);

export type { CoinMarketCapResponse, CoinMarketCapToken, CoinMarketCapQuote };
