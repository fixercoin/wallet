import { RequestHandler } from "express";

interface DexscreenerToken {
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

interface DexscreenerResponse {
  schemaVersion: string;
  pairs: DexscreenerToken[];
}

// DexScreener endpoints for failover
const DEXSCREENER_ENDPOINTS = [
  "https://api.dexscreener.com/latest/dex",
  "https://api.dexscreener.io/latest/dex", // Alternative domain
];

const CACHE_TTL_MS = 30_000; // 30 seconds
const MAX_TOKENS_PER_BATCH = 20;

let currentEndpointIndex = 0;
const cache = new Map<
  string,
  { data: DexscreenerResponse; expiresAt: number }
>();
const inflightRequests = new Map<string, Promise<DexscreenerResponse>>();

const tryDexscreenerEndpoints = async (
  path: string,
): Promise<DexscreenerResponse> => {
  let lastError: Error | null = null;

  for (let i = 0; i < DEXSCREENER_ENDPOINTS.length; i++) {
    const endpointIndex =
      (currentEndpointIndex + i) % DEXSCREENER_ENDPOINTS.length;
    const endpoint = DEXSCREENER_ENDPOINTS[endpointIndex];
    const url = `${endpoint}${path}`;

    try {
      console.log(`Trying DexScreener API: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - try next endpoint
          console.warn(`Rate limited on ${endpoint}, trying next...`);
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await response.text();
        if (text.startsWith("<!doctype") || text.startsWith("<html")) {
          console.warn(
            `Got HTML response from ${endpoint} instead of JSON. Status: ${response.status}`,
          );
          throw new Error(
            `Invalid response from ${endpoint}: Got HTML instead of JSON (Status ${response.status})`,
          );
        }
        throw new Error(
          `Invalid content-type from ${endpoint}: ${contentType}`,
        );
      }

      let data: DexscreenerResponse;
      try {
        data = (await response.json()) as DexscreenerResponse;
      } catch (parseError) {
        const text = await response.text();
        console.error(`Failed to parse JSON from ${endpoint}:`, parseError);
        if (text.startsWith("<!doctype") || text.startsWith("<html")) {
          throw new Error(
            `DexScreener returned HTML instead of JSON (likely a 5xx error). Status: ${response.status}`,
          );
        }
        throw new Error(
          `Failed to parse JSON response from DexScreener: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        );
      }

      // Success - update current endpoint
      currentEndpointIndex = endpointIndex;
      console.log(`DexScreener API call successful via ${endpoint}`);
      return data;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`DexScreener endpoint ${endpoint} failed: ${errorMsg}`);
      lastError = error instanceof Error ? error : new Error(String(error));

      // Small delay before trying next endpoint
      if (i < DEXSCREENER_ENDPOINTS.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  throw new Error(
    `All DexScreener endpoints failed. Last error: ${lastError?.message || "Unknown error"}`,
  );
};

export const fetchDexscreenerData = async (
  path: string,
): Promise<DexscreenerResponse> => {
  const cached = cache.get(path);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const existing = inflightRequests.get(path);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    try {
      const data = await tryDexscreenerEndpoints(path);
      cache.set(path, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    } finally {
      inflightRequests.delete(path);
    }
  })();

  inflightRequests.set(path, request);
  return request;
};

const mergePairsByToken = (pairs: DexscreenerToken[]): DexscreenerToken[] => {
  const byMint = new Map<string, DexscreenerToken>();

  pairs.forEach((pair) => {
    const mint = pair.baseToken?.address || pair.pairAddress;
    if (!mint) return;

    const existing = byMint.get(mint);
    const existingLiquidity = existing?.liquidity?.usd ?? 0;
    const candidateLiquidity = pair.liquidity?.usd ?? 0;

    if (!existing || candidateLiquidity > existingLiquidity) {
      byMint.set(mint, pair);
    }
  });

  return Array.from(byMint.values());
};

// Mint to pair address mapping for pump.fun tokens
export const MINT_TO_PAIR_ADDRESS: Record<string, string> = {
  H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump:
    "5CgLEWq9VJUEQ8my8UaxEovuSWArGoXCvaftpbX4RQMy", // FIXERCOIN
  EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump:
    "7X7KkV94Y9jFhkXEMhgVcMHMRzALiGj5xKmM6TT3cUvK", // LOCKER
  "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump":
    "BczJ8jo8Xghx2E6G3QKZiHQ6P5xYa5xP4oWc1F5HPXLX", // FXM
};

// Mint to search symbol mapping for tokens not found via mint lookup
const MINT_TO_SEARCH_SYMBOL: Record<string, string> = {
  H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: "FIXERCOIN",
  EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: "LOCKER",
  "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump": "FXM",
};

// Fallback prices for tokens when DexScreener returns nothing
const FALLBACK_USD: Record<string, number> = {
  FIXERCOIN: 0.005,
  LOCKER: 0.00001112,
  FXM: 0.000003567,
  USDC: 1.0,
  USDT: 1.0,
};

export const handleDexscreenerTokens: RequestHandler = async (req, res) => {
  try {
    const { mints } = req.query;

    if (!mints || typeof mints !== "string") {
      console.warn(`[DexScreener] Invalid mints parameter:`, mints);
      return res.status(400).json({
        error:
          "Missing or invalid 'mints' parameter. Expected comma-separated token mints.",
      });
    }

    console.log(`[DexScreener] Tokens request for mints: ${mints}`);

    const rawMints = mints
      .split(",")
      .map((mint) => mint.trim())
      .filter(Boolean);

    const uniqueMints = Array.from(new Set(rawMints));

    if (uniqueMints.length === 0) {
      return res.status(400).json({
        error: "No valid token mints provided.",
      });
    }

    const batches: string[][] = [];
    for (let i = 0; i < uniqueMints.length; i += MAX_TOKENS_PER_BATCH) {
      batches.push(uniqueMints.slice(i, i + MAX_TOKENS_PER_BATCH));
    }

    const results: DexscreenerToken[] = [];
    const requestedMintsSet = new Set(uniqueMints);
    const foundMintsSet = new Set<string>();
    let schemaVersion = "1.0.0";

    for (const batch of batches) {
      const path = `/tokens/${batch.join(",")}`;
      const data = await fetchDexscreenerData(path);
      if (data?.schemaVersion) {
        schemaVersion = data.schemaVersion;
      }

      if (!data || !Array.isArray(data.pairs)) {
        console.warn("Invalid response format from DexScreener API batch");
        continue;
      }

      results.push(...data.pairs);

      // Track which mints we found (both base and quote tokens)
      data.pairs.forEach((pair) => {
        if (pair.baseToken?.address) {
          foundMintsSet.add(pair.baseToken.address);
        }
        if (pair.quoteToken?.address) {
          foundMintsSet.add(pair.quoteToken.address);
        }
      });
    }

    // Find mints that weren't found in the initial batch request
    const missingMints = Array.from(requestedMintsSet).filter(
      (m) => !foundMintsSet.has(m),
    );

    // For missing mints, try pair address lookup first, then search fallback
    if (missingMints.length > 0) {
      console.log(
        `[DexScreener] ${missingMints.length} mints not found via batch, trying pair/search fallback`,
      );

      for (const mint of missingMints) {
        let found = false;

        // First, try pair address lookup if available
        const pairAddress = MINT_TO_PAIR_ADDRESS[mint];
        if (pairAddress) {
          try {
            console.log(
              `[DexScreener] Trying pair address lookup for ${mint}: ${pairAddress}`,
            );
            const pairData = await fetchDexscreenerData(
              `/pairs/solana/${pairAddress}`,
            );

            console.log(
              `[DexScreener] Pair lookup response: ${pairData ? "received" : "null"}, pairs: ${pairData?.pairs?.length || 0}`,
            );

            if (
              pairData?.pairs &&
              Array.isArray(pairData.pairs) &&
              pairData.pairs.length > 0
            ) {
              let pair = pairData.pairs[0];

              console.log(
                `[DexScreener] Pair address lookup raw data: baseToken=${pair.baseToken?.address}, quoteToken=${pair.quoteToken?.address}, priceUsd=${pair.priceUsd}`,
              );

              // If the requested mint is the quoteToken, we need to swap the tokens
              // and invert the price to get the correct representation
              if (
                pair.quoteToken?.address === mint &&
                pair.baseToken?.address !== mint
              ) {
                const basePrice = pair.priceUsd ? parseFloat(pair.priceUsd) : 0;
                const invertedPrice =
                  basePrice > 0 ? (1 / basePrice).toFixed(20) : "0";

                console.log(
                  `[DexScreener] Swapping tokens: ${mint} was quoteToken, inverting price ${pair.priceUsd} -> ${invertedPrice}`,
                );

                pair = {
                  ...pair,
                  baseToken: pair.quoteToken,
                  quoteToken: pair.baseToken,
                  priceUsd: invertedPrice,
                  priceNative: pair.priceNative
                    ? (1 / parseFloat(pair.priceNative)).toString()
                    : "0",
                };
              }

              console.log(
                `[DexScreener] ✅ Found ${mint} via pair address, baseToken=${pair.baseToken?.symbol || "UNKNOWN"}, priceUsd: ${pair.priceUsd || "N/A"}`,
              );
              results.push(pair);
              foundMintsSet.add(mint);
              found = true;
            } else {
              console.warn(
                `[DexScreener] Pair lookup returned no pairs for ${mint}`,
              );
            }
          } catch (pairErr) {
            console.warn(
              `[DexScreener] ⚠️ Pair address lookup failed for ${mint}:`,
              pairErr instanceof Error ? pairErr.message : String(pairErr),
            );
          }
        }

        // If pair lookup failed or unavailable, try search-based lookup
        if (!found) {
          const searchSymbol = MINT_TO_SEARCH_SYMBOL[mint];
          if (searchSymbol) {
            try {
              console.log(
                `[DexScreener] Searching for ${mint} using symbol: ${searchSymbol}`,
              );
              const searchData = await fetchDexscreenerData(
                `/search/?q=${encodeURIComponent(searchSymbol)}`,
              );

              if (searchData?.pairs && Array.isArray(searchData.pairs)) {
                // Find the pair that matches our mint
                // Look for pairs where this token is the base on Solana
                let matchingPair = searchData.pairs.find(
                  (p) =>
                    p.baseToken?.address === mint && p.chainId === "solana",
                );

                // If not found as base on Solana, try as quote token on Solana
                if (!matchingPair) {
                  matchingPair = searchData.pairs.find(
                    (p) =>
                      p.quoteToken?.address === mint && p.chainId === "solana",
                  );
                }

                // If still not found on Solana, try any chain as base
                if (!matchingPair) {
                  matchingPair = searchData.pairs.find(
                    (p) => p.baseToken?.address === mint,
                  );
                }

                // If still not found, try as quote on any chain
                if (!matchingPair) {
                  matchingPair = searchData.pairs.find(
                    (p) => p.quoteToken?.address === mint,
                  );
                }

                // Last resort: just take the first result
                if (!matchingPair && searchData.pairs.length > 0) {
                  matchingPair = searchData.pairs[0];
                }

                if (matchingPair) {
                  console.log(
                    `[DexScreener] �� Found ${searchSymbol} (${mint}) via search, chainId: ${matchingPair.chainId}, priceUsd: ${matchingPair.priceUsd || "N/A"}`,
                  );
                  results.push(matchingPair);
                  foundMintsSet.add(mint);
                } else {
                  console.warn(
                    `[DexScreener] ⚠️ Search returned 0 results for ${mint}`,
                  );
                }
              }
            } catch (searchErr) {
              console.warn(
                `[DexScreener] ⚠️ Search fallback failed for ${mint}:`,
                searchErr instanceof Error
                  ? searchErr.message
                  : String(searchErr),
              );
            }
          }
        }

        // Do NOT create synthetic fallback - let the client retry
        // Synthetic prices prevent proper retry logic and show stale prices
        if (!found) {
          console.warn(
            `[DexScreener] ⚠️ Failed to find live price for ${mint} - will NOT create fallback. Returning error so client retries.`,
          );
        }
      }
    }

    const solanaPairs = mergePairsByToken(results)
      .filter((pair: DexscreenerToken) => pair.chainId === "solana")
      .sort((a: DexscreenerToken, b: DexscreenerToken) => {
        const aLiquidity = a.liquidity?.usd || 0;
        const bLiquidity = b.liquidity?.usd || 0;
        if (bLiquidity !== aLiquidity) return bLiquidity - aLiquidity;

        const aVolume = a.volume?.h24 || 0;
        const bVolume = b.volume?.h24 || 0;
        return bVolume - aVolume;
      });

    // If we couldn't find live prices for the requested tokens, return error so client retries
    if (solanaPairs.length === 0 && uniqueMints.length > 0) {
      console.error(
        `[DexScreener] ❌ No live prices found for any of ${uniqueMints.length} requested tokens. Returning 503 so client retries.`,
      );
      return res.status(503).json({
        error: "No live price data available from DexScreener",
        details: `Could not find prices for: ${uniqueMints.join(", ")}`,
        schemaVersion,
        pairs: [],
      });
    }

    console.log(
      `[DexScreener] ✅ Response: ${solanaPairs.length} Solana pairs found across ${batches.length} batch(es)` +
        (missingMints.length > 0
          ? ` (${missingMints.length} required search fallback)`
          : ""),
    );
    res.json({ schemaVersion, pairs: solanaPairs });
  } catch (error) {
    console.error("[DexScreener] ❌ Tokens proxy error:", {
      mints: req.query.mints,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : "Internal error",
        details: String(error),
      },
      schemaVersion: "1.0.0",
      pairs: [],
    });
  }
};

export const handleDexscreenerSearch: RequestHandler = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({
        error: "Missing or invalid 'q' parameter for search query.",
      });
    }

    // Strip ":N" suffix if present (e.g., "FXM:1" -> "FXM")
    const cleanQuery = q.split(":")[0];
    console.log(
      `[DexScreener] Search request for: ${cleanQuery}${cleanQuery !== q ? " (cleaned from: " + q + ")" : ""}`,
    );

    const data = await fetchDexscreenerData(
      `/search/?q=${encodeURIComponent(cleanQuery)}`,
    );

    // Filter for Solana pairs and limit results
    const solanaPairs = (data.pairs || [])
      .filter((pair: DexscreenerToken) => pair.chainId === "solana")
      .slice(0, 20); // Limit to 20 results

    console.log(
      `[DexScreener] ✅ Search response: ${solanaPairs.length} results`,
    );
    res.json({
      schemaVersion: data.schemaVersion || "1.0.0",
      pairs: solanaPairs,
    });
  } catch (error) {
    console.error("[DexScreener] ❌ Search proxy error:", {
      query: req.query.q,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : "Internal error",
        details: String(error),
      },
      schemaVersion: "1.0.0",
      pairs: [],
    });
  }
};

export const handleDexscreenerTrending: RequestHandler = async (req, res) => {
  try {
    console.log("[DexScreener] Trending tokens request");

    const data = await fetchDexscreenerData("/pairs/solana");

    // Get top trending pairs, sorted by volume and liquidity
    const trendingPairs = (data.pairs || [])
      .filter(
        (pair: DexscreenerToken) =>
          pair.volume?.h24 > 1000 && // Minimum volume filter
          pair.liquidity?.usd &&
          pair.liquidity.usd > 10000, // Minimum liquidity filter
      )
      .sort((a: DexscreenerToken, b: DexscreenerToken) => {
        // Sort by 24h volume
        const aVolume = a.volume?.h24 || 0;
        const bVolume = b.volume?.h24 || 0;
        return bVolume - aVolume;
      })
      .slice(0, 50); // Top 50 trending

    console.log(
      `[DexScreener] ✅ Trending response: ${trendingPairs.length} trending pairs`,
    );
    res.json({
      schemaVersion: data.schemaVersion || "1.0.0",
      pairs: trendingPairs,
    });
  } catch (error) {
    console.error("[DexScreener] ❌ Trending proxy error:", {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : "Internal error",
        details: String(error),
      },
      schemaVersion: "1.0.0",
      pairs: [],
    });
  }
};
