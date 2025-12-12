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

    tokens.forEach((t) => {
      const baseMint = t.baseToken?.address;
      const quoteMint = t.quoteToken?.address;
      const baseUsd = t.priceUsd ? parseFloat(t.priceUsd) : NaN;
      const priceNative = t.priceNative ? parseFloat(t.priceNative) : NaN;

      // Base token USD price (as reported by DexScreener)
      if (baseMint && isFinite(baseUsd) && baseUsd > 0) {
        prices[baseMint] = baseUsd;
      }

      // If possible, derive quote token USD price from baseUsd and priceNative
      // priceNative is typically the base price in quote units. Therefore:
      // quoteUsd = baseUsd / priceNative
      if (
        quoteMint &&
        isFinite(baseUsd) &&
        baseUsd > 0 &&
        isFinite(priceNative) &&
        priceNative > 0
      ) {
        const quoteUsd = baseUsd / priceNative;
        if (quoteUsd > 0 && !prices[quoteMint]) {
          prices[quoteMint] = quoteUsd;
        }
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
    let lastError: string = "";

    if (toFetch.length > 0) {
      const mintString = toFetch.join(",");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn(
          `[DexScreener] Request timeout after 15s for ${toFetch.length} mints`,
        );
        controller.abort("Request timeout after 15 seconds");
      }, 15000);
      try {
        const url = `${this.baseUrl}/tokens?mints=${mintString}`;
        console.log(
          `[DexScreener] Requesting: ${url} (${toFetch.length} mints)`,
        );
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (response.ok) {
          try {
            const contentType = response.headers.get("content-type") || "";
            if (!contentType.includes("application/json")) {
              throw new Error(
                `Invalid content-type: ${contentType}. Expected application/json`,
              );
            }

            const data: DexscreenerResponse = await response.json();
            fetchedTokens = data.pairs || [];
            console.log(
              `[DexScreener] ✅ Fetched ${fetchedTokens.length} tokens from DexScreener`,
            );

            // Log which tokens we got
            if (fetchedTokens.length > 0) {
              const gotMints = Array.from(
                new Set(
                  fetchedTokens
                    .flatMap((t) => [
                      t.baseToken?.address,
                      t.quoteToken?.address,
                    ])
                    .filter(Boolean) as string[],
                ),
              );
              const missingMints = toFetch.filter((m) => !gotMints.includes(m));
              console.log(
                `[DexScreener] Got ${fetchedTokens.length} tokens, missing ${missingMints.length}:`,
                missingMints,
              );

              // Log price data for debugging
              const withPrice = fetchedTokens.filter(
                (t) => t.priceUsd && parseFloat(t.priceUsd) > 0,
              );
              console.log(
                `[DexScreener] Tokens with valid prices: ${withPrice.length}/${fetchedTokens.length}`,
              );

              // Log pump fun tokens specifically
              const pumpFunTokens = fetchedTokens.filter(
                (t) =>
                  t.baseToken?.address ===
                    "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump" ||
                  t.baseToken?.address ===
                    "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
              );
              if (pumpFunTokens.length > 0) {
                pumpFunTokens.forEach((pt) => {
                  const isFixercoin =
                    pt.baseToken?.address ===
                    "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump";
                  console.log(
                    `[DexScreener] ${isFixercoin ? "FIXERCOIN" : "LOCKER"}: price=${pt.priceUsd}, change24h=${pt.priceChange?.h24}%`,
                  );
                });
              }
            }
          } catch (parseErr) {
            lastError = `Parse error: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`;
            console.error(
              `[DexScreener] ��� Failed to parse response:`,
              lastError,
            );
            fetchFailed = true;
          }
        } else {
          lastError = `HTTP ${response.status}: ${response.statusText}`;
          console.error(
            `[DexScreener] ❌ Server returned ${response.status}: ${response.statusText}`,
          );
          fetchFailed = true;
        }
      } catch (err) {
        // Handle AbortError specially - it's often a timeout
        if (err instanceof Error && err.name === "AbortError") {
          lastError = "Request timeout (15s) - network might be slow";
          console.warn(
            `[DexScreener] ⏱️ Request timeout fetching ${toFetch.length} mints`,
          );
        } else {
          lastError = err instanceof Error ? err.message : String(err);
          console.warn(
            `[DexScreener] ❌ Network error fetching tokens (${toFetch.length} mints):`,
            lastError,
          );
        }
        fetchFailed = true;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // If fetch failed, try to serve stale cached data or return empty array to allow fallbacks
    if (fetchFailed && toFetch.length > 0) {
      console.warn(
        `[DexScreener] ❌ Fetch failed (${lastError}), trying stale cache for ${toFetch.length} tokens`,
      );
      toFetch.forEach((mint) => {
        const stale = DexscreenerAPI.tokenCache.get(mint);
        if (stale) {
          console.log(
            `[DexScreener] ℹ️ Using stale cache for ${mint} (${stale.token.baseToken?.symbol || "UNKNOWN"})`,
          );
          fetchedTokens.push(stale.token);
        }
      });

      // If we still don't have results for what was requested, just log a warning
      // The caller will handle missing prices with fallback values (Birdeye, Jupiter, or hardcoded)
      const gotMints = new Set(
        fetchedTokens
          .flatMap((t) => [t.baseToken?.address, t.quoteToken?.address])
          .filter(Boolean) as string[],
      );
      const stillMissing = toFetch.filter((m) => !gotMints.has(m));
      if (stillMissing.length > 0) {
        console.warn(
          `[DexScreener] ⚠️ No data available for ${stillMissing.length} tokens (${stillMissing.join(", ")}). Will use fallback prices.`,
        );
      }
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

    const missing = normalizedMints.filter(
      (m) =>
        !result.find(
          (t) => t.baseToken?.address === m || t.quoteToken?.address === m,
        ),
    );
    console.log(
      `[DexScreener] Returned ${result.length}/${normalizedMints.length} tokens (${result.length === normalizedMints.length ? "✅ complete" : "⚠️ partial"}). Missing: ${missing.join(", ")}`,
    );

    return result;
  }

  async getTokenByMint(mint: string): Promise<DexscreenerToken | null> {
    const tokens = await this.getTokensByMints([mint]);

    // If not found and it's FXM, try searching by symbol as fallback
    if (
      tokens.length === 0 &&
      mint === "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump"
    ) {
      console.log(
        `[DexScreener] FXM mint not found in batch, trying symbol search...`,
      );
      const searchResults = await this.searchTokens("FXM");
      if (searchResults.length > 0) {
        // Filter for Solana FXM tokens
        const solanaFXM = searchResults.find(
          (t) =>
            (t.baseToken?.symbol === "FXM" || t.quoteToken?.symbol === "FXM") &&
            t.chainId === "solana",
        );
        if (solanaFXM) {
          console.log(
            `[DexScreener] ✅ Found FXM via symbol search: ${solanaFXM.baseToken?.address}`,
          );
          return solanaFXM;
        }
      }
    }

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
