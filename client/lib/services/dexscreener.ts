import { TokenInfo } from "../wallet";

export interface DexscreenerToken {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd?: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  marketCap?: number;
  info?: {
    imageUrl?: string;
    websites?: Array<{ label: string; url: string }>;
    socials?: Array<{ type: string; url: string }>;
  };
}

export interface DexscreenerResponse {
  schemaVersion: string;
  pairs: DexscreenerToken[];
}

class DexscreenerAPI {
  // Using server proxy routes to avoid CORS issues
  private readonly baseUrl = "/api/dexscreener";
  private static TOKEN_CACHE_TTL_MS = 30_000;
  private static PERSISTENT_CACHE_KEY = "dexscreener_persistent_cache";
  private static tokenCache = new Map<
    string,
    { token: DexscreenerToken; expiresAt: number }
  >();

  constructor() {
    this.loadPersistentCache();
  }

  private loadPersistentCache(): void {
    try {
      const cached = localStorage.getItem(DexscreenerAPI.PERSISTENT_CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached) as Record<
          string,
          { token: DexscreenerToken; expiresAt: number }
        >;
        Object.entries(data).forEach(([mint, entry]) => {
          DexscreenerAPI.tokenCache.set(mint, entry);
        });
        console.log(
          `DexScreener: Loaded ${Object.keys(data).length} tokens from persistent cache`,
        );
      }
    } catch (err) {
      console.warn("Failed to load DexScreener persistent cache:", err);
    }
  }

  private savePersistentCache(): void {
    try {
      const data: Record<
        string,
        { token: DexscreenerToken; expiresAt: number }
      > = {};
      DexscreenerAPI.tokenCache.forEach((value, key) => {
        data[key] = value;
      });
      localStorage.setItem(
        DexscreenerAPI.PERSISTENT_CACHE_KEY,
        JSON.stringify(data),
      );
    } catch (err) {
      console.warn("Failed to save DexScreener persistent cache:", err);
    }
  }

  // Helper method to extract prices from DexScreener data
  getTokenPrices(tokens: DexscreenerToken[]): Record<string, number> {
    const prices: Record<string, number> = {};

    tokens.forEach((token) => {
      const mint = token.baseToken.address;
      const price = token.priceUsd ? parseFloat(token.priceUsd) : null;

      if (mint && price && price > 0) {
        prices[mint] = price;
      }
    });

    console.log(
      `[DexScreener] Extracted ${Object.keys(prices).length} prices from ${tokens.length} tokens`,
    );
    return prices;
  }

  async getTokensByMints(mints: string[]): Promise<DexscreenerToken[]> {
    const normalizedMints = Array.from(
      new Set((mints || []).map((m) => m.trim()).filter(Boolean)),
    ).sort();

    // Serve from cache when fresh
    const now = Date.now();
    const cachedResults: DexscreenerToken[] = [];
    const toFetch: string[] = [];
    normalizedMints.forEach((mint) => {
      const cached = DexscreenerAPI.tokenCache.get(mint);
      if (cached && cached.expiresAt > now) {
        cachedResults.push(cached.token);
      } else {
        toFetch.push(mint);
      }
    });

    console.log(
      `[DexScreener] Fetching ${normalizedMints.length} tokens: ${cachedResults.length} from cache, ${toFetch.length} to fetch`,
    );

    let fetchedTokens: DexscreenerToken[] = [];
    let fetchFailed = false;

    if (toFetch.length > 0) {
      const mintString = toFetch.join(",");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const url = `${this.baseUrl}/tokens?mints=${mintString}`;
        console.log(`[DexScreener] Requesting: ${url}`);
        const response = await fetch(url, { signal: controller.signal });

        if (response.ok) {
          try {
            const data: DexscreenerResponse = await response.json();
            fetchedTokens = data.pairs || [];
            console.log(
              `[DexScreener] ✅ Fetched ${fetchedTokens.length} tokens successfully`,
            );
            // Validate that we got meaningful data (especially priceChange)
            const withPriceChange = fetchedTokens.filter(
              (t) =>
                t.priceChange &&
                (typeof t.priceChange.h24 === "number" ||
                  typeof t.priceChange.h6 === "number" ||
                  typeof t.priceChange.h1 === "number" ||
                  typeof t.priceChange.m5 === "number"),
            );
            console.log(
              `[DexScreener] Tokens with price change data: ${withPriceChange.length}/${fetchedTokens.length}`,
            );
          } catch (parseErr) {
            console.error(
              `[DexScreener] ❌ Failed to parse response:`,
              parseErr,
            );
            fetchFailed = true;
          }
        } else {
          console.error(
            `[DexScreener] ❌ Server returned ${response.status}: ${response.statusText}`,
          );
          fetchFailed = true;
        }
      } catch (err) {
        // network/timeout -> swallow; fallback to stale cache
        fetchFailed = true;
        console.warn(
          `[DexScreener] ❌ Network error fetching tokens:`,
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // If fetch failed, try to serve stale cached data instead of failing completely
    if (fetchFailed && toFetch.length > 0) {
      console.log(
        `[DexScreener] ⚠️ Serving stale cache for ${toFetch.length} tokens`,
      );
      toFetch.forEach((mint) => {
        const stale = DexscreenerAPI.tokenCache.get(mint);
        if (stale) {
          fetchedTokens.push(stale.token);
        }
      });
    }

    // Update cache with fetched results (only if we got meaningful data)
    const ttl = now + DexscreenerAPI.TOKEN_CACHE_TTL_MS;
    fetchedTokens.forEach((t) => {
      const matchMint = normalizedMints.find(
        (m) => m === t.baseToken?.address || m === t.quoteToken?.address,
      );
      if (matchMint) {
        DexscreenerAPI.tokenCache.set(matchMint, { token: t, expiresAt: ttl });
      }
    });

    // Save to persistent cache after successful fetch
    if (fetchedTokens.length > 0) {
      this.savePersistentCache();
    }

    const allTokensMap = new Map<string, DexscreenerToken>();
    [...cachedResults, ...fetchedTokens].forEach((t) => {
      const matchMint = normalizedMints.find(
        (m) => m === t.baseToken?.address || m === t.quoteToken?.address,
      );
      if (matchMint && !allTokensMap.has(matchMint)) {
        allTokensMap.set(matchMint, t);
      }
    });

    const result = normalizedMints
      .map((m) => allTokensMap.get(m))
      .filter((t): t is DexscreenerToken => Boolean(t));

    console.log(
      `[DexScreener] Returned ${result.length}/${normalizedMints.length} tokens (${result.length === normalizedMints.length ? "✅ complete" : "⚠️ partial"})`,
    );

    return result;
  }

  async getTokenByMint(mint: string): Promise<DexscreenerToken | null> {
    const tokens = await this.getTokensByMints([mint]);
    return tokens.length > 0 ? tokens[0] : null;
  }

  async searchTokens(query: string): Promise<DexscreenerToken[]> {
    try {
      const url = `/api/dexscreener/search?q=${encodeURIComponent(query)}`;
      console.log(`[DexScreener] Searching: ${url}`);

      const response = await fetch(url).catch(
        () => new Response("", { status: 0 } as any),
      );

      if (!response.ok) {
        console.warn(
          `[DexScreener] Search failed with status ${response.status}`,
        );
        return [];
      }

      const data: DexscreenerResponse = await response.json();
      console.log(
        `[DexScreener] Search returned ${(data.pairs || []).length} results`,
      );
      return data.pairs || [];
    } catch (error) {
      console.warn(
        `[DexScreener] Search error:`,
        error instanceof Error ? error.message : String(error),
      );
      return [];
    }
  }

  enhanceTokenWithDexscreenerData(
    token: TokenInfo,
    dexData: DexscreenerToken,
  ): TokenInfo {
    return {
      ...token,
      logoURI: dexData.info?.imageUrl || token.logoURI,
      price: dexData.priceUsd ? parseFloat(dexData.priceUsd) : undefined,
      priceChange24h: [
        dexData.priceChange?.h24,
        dexData.priceChange?.h6,
        dexData.priceChange?.h1,
        dexData.priceChange?.m5,
      ].find((v) => typeof v === "number" && isFinite(v as number)) as
        | number
        | undefined,
      volume24h: dexData.volume?.h24,
      marketCap: dexData.marketCap,
      liquidity: dexData.liquidity?.usd,
    };
  }

  async getPopularTokens(): Promise<DexscreenerToken[]> {
    try {
      console.log(`[DexScreener] Fetching trending tokens...`);
      // Get trending tokens on Solana via proxy
      const response = await fetch("/api/dexscreener/trending").catch(
        () => new Response("", { status: 0 } as any),
      );

      if (!response.ok) {
        console.warn(
          `[DexScreener] Trending request failed with status ${response.status}`,
        );
        return [];
      }

      const data: DexscreenerResponse = await response.json();
      const trending = data.pairs?.slice(0, 20) || [];
      console.log(`[DexScreener] ✅ Got ${trending.length} trending tokens`);
      return trending;
    } catch (error) {
      console.warn(
        `[DexScreener] Trending error:`,
        error instanceof Error ? error.message : String(error),
      );
      return [];
    }
  }
}

export const dexscreenerAPI = new DexscreenerAPI();
