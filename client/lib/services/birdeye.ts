export interface BirdeyeToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  priceUsd?: number;
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  volume?: {
    h24?: number;
  };
  liquidity?: {
    usd?: number;
  };
  marketCap?: number;
  logoURI?: string;
}

export interface BirdeyePriceResponse {
  success: boolean;
  data?: {
    address: string;
    value: number;
    updateUnixTime: number;
    priceChange24h?: number;
  };
  error?: string;
}

class BirdeyeAPI {
  private readonly baseUrl = "/api/birdeye";
  private static TOKEN_CACHE_TTL_MS = 30_000;
  private static tokenCache = new Map<
    string,
    { data: BirdeyeToken; expiresAt: number }
  >();

  async getTokenPrice(mint: string): Promise<BirdeyeToken | null> {
    if (!mint) return null;

    try {
      const url = `${this.baseUrl}/price?address=${encodeURIComponent(mint)}`;
      console.log(`[Birdeye] Fetching price for ${mint}: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(url, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.debug(
            `[Birdeye] Price request failed with status ${response.status} for ${mint} (will use fallback)`,
          );
          return null;
        }

        const data: BirdeyePriceResponse = await response.json();

        if (!data.success || !data.data) {
          console.debug(
            `[Birdeye] Price API returned no data for ${mint} (will use fallback)`,
          );
          return null;
        }

        const token: BirdeyeToken = {
          address: mint,
          symbol: mint.slice(0, 6).toUpperCase(),
          name: mint.slice(0, 10),
          decimals: 6,
          priceUsd: data.data.value,
          priceChange: {
            h24: data.data.priceChange24h || 0,
          },
        };

        console.log(
          `[Birdeye] ✅ Got price for ${mint}: $${data.data.value || "N/A"}`,
        );
        return token;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        const errorMsg =
          fetchError instanceof Error ? fetchError.message : String(fetchError);
        console.debug(
          `[Birdeye] Network error fetching price for ${mint}: ${errorMsg} (will use fallback)`,
        );
        return null;
      }
    } catch (error) {
      console.debug(
        `[Birdeye] Unexpected error for ${mint}: ${error instanceof Error ? error.message : String(error)} (will use fallback)`,
      );
      return null;
    }
  }

  async getTokensByMints(mints: string[]): Promise<BirdeyeToken[]> {
    const normalizedMints = Array.from(
      new Set(mints.filter((m) => m && typeof m === "string")),
    );

    if (normalizedMints.length === 0) return [];

    const now = Date.now();
    const cachedResults: BirdeyeToken[] = [];
    const toFetch: string[] = [];

    normalizedMints.forEach((mint) => {
      const cached = BirdeyeAPI.tokenCache.get(mint);
      if (cached && cached.expiresAt > now) {
        cachedResults.push(cached.data);
      } else {
        toFetch.push(mint);
      }
    });

    console.log(
      `[Birdeye] Cache hit: ${cachedResults.length}, Need to fetch: ${toFetch.length}`,
    );

    let fetchedTokens: BirdeyeToken[] = [];

    if (toFetch.length > 0) {
      try {
        const promises = toFetch.map((mint) =>
          this.getTokenPrice(mint).catch((error) => {
            console.warn(`[Birdeye] Failed to fetch price for ${mint}:`, error);
            return null;
          }),
        );
        const results = await Promise.all(promises);
        fetchedTokens = results.filter((t): t is BirdeyeToken => t !== null);

        const ttl = now + BirdeyeAPI.TOKEN_CACHE_TTL_MS;
        fetchedTokens.forEach((token) => {
          BirdeyeAPI.tokenCache.set(token.address, {
            data: token,
            expiresAt: ttl,
          });
        });
      } catch (error) {
        console.error(
          `[Birdeye] Error fetching tokens:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    const allTokens = [...cachedResults, ...fetchedTokens];
    console.log(`[Birdeye] Returning ${allTokens.length} tokens`);
    return allTokens;
  }

  async getTokenByMint(mint: string): Promise<BirdeyeToken | null> {
    const tokens = await this.getTokensByMints([mint]);
    return tokens[0] || null;
  }

  getTokenPrices(tokens: BirdeyeToken[]): Record<string, number> {
    const prices: Record<string, number> = {};

    tokens.forEach((token) => {
      if (token.address && token.priceUsd && isFinite(token.priceUsd)) {
        prices[token.address] = token.priceUsd;
      }
    });

    return prices;
  }

  clearCache(): void {
    BirdeyeAPI.tokenCache.clear();
    console.log("[Birdeye] Cache cleared");
  }
}

export const birdeyeAPI = new BirdeyeAPI();
