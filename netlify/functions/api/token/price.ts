import type { Handler } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const DEX_CACHE_TTL_MS = 30_000;
const DEX_CACHE = new Map<string, { data: any; expiresAt: number }>();
const DEX_INFLIGHT = new Map<string, Promise<any>>();

const DEXSCREENER_ENDPOINTS = [
  "https://api.dexscreener.com/latest/dex",
  "https://api.dexscreener.io/latest/dex",
];
let currentDexIdx = 0;

async function tryDexEndpoints(path: string) {
  let lastError: Error | null = null;
  for (let i = 0; i < DEXSCREENER_ENDPOINTS.length; i++) {
    const idx = (currentDexIdx + i) % DEXSCREENER_ENDPOINTS.length;
    const endpoint = DEXSCREENER_ENDPOINTS[idx];
    const url = `${endpoint}${path}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const resp = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        if (resp.status === 429) continue;
        const t = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}. ${t}`);
      }
      const data = await resp.json();
      currentDexIdx = idx;
      return data;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (i < DEXSCREENER_ENDPOINTS.length - 1)
        await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(lastError?.message || "All DexScreener endpoints failed");
}

async function fetchDexData(path: string) {
  const now = Date.now();
  const cached = DEX_CACHE.get(path);
  if (cached && cached.expiresAt > now) {
    const hasPriceChangeData =
      Array.isArray(cached.data?.pairs) &&
      cached.data.pairs.some(
        (p: any) =>
          p?.priceChange &&
          (typeof p.priceChange.h24 === "number" ||
            typeof p.priceChange.h6 === "number" ||
            typeof p.priceChange.h1 === "number" ||
            typeof p.priceChange.m5 === "number"),
      );
    if (hasPriceChangeData) {
      return cached.data;
    }
  }
  const existing = DEX_INFLIGHT.get(path);
  if (existing) return existing;
  const request = (async () => {
    try {
      const data = await tryDexEndpoints(path);
      DEX_CACHE.set(path, { data, expiresAt: Date.now() + DEX_CACHE_TTL_MS });
      return data;
    } finally {
      DEX_INFLIGHT.delete(path);
    }
  })();
  DEX_INFLIGHT.set(path, request);
  return request;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Method not allowed. Use GET.",
      }),
    };
  }

  try {
    const tokenParam = (
      (event.queryStringParameters?.token as string) ||
      (event.queryStringParameters?.symbol as string) ||
      "FIXERCOIN"
    ).toUpperCase();
    const mintParam = (event.queryStringParameters?.mint as string) || "";

    const TOKEN_MINTS: Record<string, string> = {
      SOL: "So11111111111111111111111111111111111111112",
      USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
      FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
      LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
    };

    const FALLBACK_USD: Record<string, number> = {
      FIXERCOIN: 0.00008139,
      SOL: 149.38,
      USDC: 1.0,
      USDT: 1.0,
      LOCKER: 0.00001112,
    };

    const PKR_PER_USD = 280;
    const MARKUP = 1.0425;
    const MIN_REALISTIC_PRICE = 0.00001;

    let token = tokenParam;
    let mint = mintParam || TOKEN_MINTS[token] || "";

    if (!mint && tokenParam && tokenParam.length > 40) {
      mint = tokenParam;
      const inv = Object.entries(TOKEN_MINTS).find(([, m]) => m === mint);
      if (inv) token = inv[0];
    }

    let priceUsd: number | null = null;
    let priceChange24h = 0;
    let volume24h = 0;
    let matchingPair: any = null;

    try {
      if (token === "USDC" || token === "USDT") {
        priceUsd = 1.0;
        priceChange24h = 0;
        volume24h = 0;
      } else if (mint) {
        try {
          const data = await fetchDexData(`/tokens/${mint}`);
          const pairs = Array.isArray(data?.pairs) ? data.pairs : [];

          if (pairs.length > 0) {
            matchingPair = pairs.find(
              (p: any) =>
                p?.baseToken?.address === mint && p?.chainId === "solana",
            );

            if (!matchingPair) {
              matchingPair = pairs.find(
                (p: any) =>
                  p?.quoteToken?.address === mint && p?.chainId === "solana",
              );
            }

            if (!matchingPair) {
              matchingPair = pairs[0];
            }

            if (matchingPair && matchingPair.priceUsd) {
              priceUsd = parseFloat(matchingPair.priceUsd);
              priceChange24h = matchingPair.priceChange?.h24 || 0;
              volume24h = matchingPair.volume?.h24 || 0;
            }
          }
        } catch (e) {
          console.warn(`[Token Price] Token lookup failed for ${token}:`, e);
        }
      }
    } catch (e) {
      console.warn(`[Token Price] Price lookup error:`, e);
    }

    if (
      priceUsd === null ||
      !isFinite(priceUsd) ||
      priceUsd < MIN_REALISTIC_PRICE
    ) {
      priceUsd = FALLBACK_USD[token] ?? FALLBACK_USD.FIXERCOIN;
      priceChange24h = 0;
      volume24h = 0;
    }

    const rateInPKR = priceUsd * PKR_PER_USD * MARKUP;

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=5",
      },
      body: JSON.stringify({
        token,
        priceUsd,
        priceInPKR: rateInPKR,
        rate: rateInPKR,
        pkrPerUsd: PKR_PER_USD,
        markup: MARKUP,
        priceChange24h,
        volume24h,
        pair: matchingPair || undefined,
      }),
    };
  } catch (error: any) {
    console.error("TOKEN PRICE endpoint error:", error);

    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to fetch token price",
        details: error?.message || String(error),
      }),
    };
  }
};
