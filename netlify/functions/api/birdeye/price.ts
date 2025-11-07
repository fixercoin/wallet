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
    const address = event.queryStringParameters?.address || "";
    if (!address) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Missing 'address' parameter",
        }),
      };
    }

    const data = await fetchDexData(`/tokens/${address}`);
    const pair = Array.isArray(data?.pairs)
      ? data.pairs.find((p: any) => p?.chainId === "solana") || data.pairs[0]
      : null;

    if (!pair || !pair.priceUsd) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Token not found",
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=5",
      },
      body: JSON.stringify({
        success: true,
        data: {
          address,
          value: parseFloat(pair.priceUsd || "0"),
          updateUnixTime: Math.floor(Date.now() / 1000),
          priceChange24h: pair.priceChange?.h24 || 0,
        },
      }),
    };
  } catch (error: any) {
    console.error("Birdeye PRICE endpoint error:", error);

    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: "Failed to fetch token price",
        details: error?.message || String(error),
      }),
    };
  }
};
