// DexTools API Service for Solana token pricing
// Uses DexTools API as a reliable alternative to Jupiter for price fetching

export interface DexToolsTokenData {
  address: string;
  name: string;
  symbol: string;
  priceUsd?: number;
  priceUsdChange24h?: number;
  marketCap?: number;
  liquidity?: number;
  volume24h?: number;
}

interface DexToolsResponse {
  data?: DexToolsTokenData;
  errorCode?: string;
  errorMsg?: string;
}

class DexToolsAPI {
  private readonly baseUrl = "https://api.dextools.io/v1";
  private readonly cacheTimeout = 60000; // 1 minute
  private priceCache = new Map<string, { price: number; timestamp: number }>();

  /**
   * Fetch token price from DexTools API
   * Supports both direct API calls and proxy-based calls
   */
  async getTokenPrice(
    tokenMint: string,
    chainId: string = "solana",
  ): Promise<number | null> {
    try {
      // Check cache first
      const cached = this.priceCache.get(tokenMint);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`[DexTools] Using cached price for ${tokenMint}`);
        return cached.price;
      }

      // First, try using proxy endpoint if available
      try {
        const proxyUrl = `/api/dextools/price?tokenAddress=${tokenMint}&chainId=${chainId}`;
        console.log(`[DexTools] Fetching via proxy: ${proxyUrl}`);

        const response = await fetch(proxyUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.priceUsd && typeof data.priceUsd === "number") {
            this.priceCache.set(tokenMint, {
              price: data.priceUsd,
              timestamp: Date.now(),
            });
            console.log(
              `[DexTools] Price via proxy: ${tokenMint} = $${data.priceUsd}`,
            );
            return data.priceUsd;
          }
        }
      } catch (proxyErr) {
        console.warn(
          "[DexTools] Proxy request failed, trying direct API:",
          proxyErr,
        );
      }

      console.warn(
        "[DexTools] Proxy request failed and no fallback available. Use /api/dextools endpoint.",
        tokenMint,
      );
      return null;
    } catch (error) {
      console.error(`[DexTools] Error fetching price for ${tokenMint}:`, error);
      return null;
    }
  }

  /**
   * Fetch multiple token prices
   */
  async getTokenPrices(
    tokenMints: string[],
    chainId: string = "solana",
  ): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};

    // Fetch in parallel with concurrency control
    const concurrency = 3;
    for (let i = 0; i < tokenMints.length; i += concurrency) {
      const batch = tokenMints.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map((mint) => this.getTokenPrice(mint, chainId)),
      );

      results.forEach((result, idx) => {
        const mint = batch[idx];
        if (result.status === "fulfilled" && result.value !== null) {
          prices[mint] = result.value;
        }
      });
    }

    return prices;
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    this.priceCache.clear();
  }
}

export const dextoolsAPI = new DexToolsAPI();
