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
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

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

      const data = (await response.json()) as DexscreenerResponse;

      // Success - update current endpoint
      currentEndpointIndex = endpointIndex;
      console.log(`DexScreener API call successful via ${endpoint}`);
      return data;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`DexScreener endpoint ${endpoint} failed:`, errorMsg);
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

const fetchDexscreenerData = async (
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

    console.log(
      `[DexScreener] ✅ Response: ${solanaPairs.length} Solana pairs found across ${batches.length} batch(es)`,
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

    console.log(`[DexScreener] Search request for: ${q}`);

    const data = await fetchDexscreenerData(
      `/search/?q=${encodeURIComponent(q)}`,
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
