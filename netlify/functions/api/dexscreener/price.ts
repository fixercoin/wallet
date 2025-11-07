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
          "User-Agent":
            "Mozilla/5.0 (compatible; SolanaWallet/1.0; +http://example.com)",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        if (resp.status === 429) {
          console.warn(
            `[DexScreener] Rate limited on ${endpoint}, trying next endpoint`,
          );
          continue;
        }
        const preview = await resp.text().catch(() => "");
        const contentType = resp.headers.get("content-type") || "";
        console.error(
          `[DexScreener] HTTP ${resp.status}: ${contentType} | ${preview.substring(0, 100)}`,
        );
        throw new Error(
          `HTTP ${resp.status}: ${resp.statusText}. Content-Type: ${contentType}`,
        );
      }

      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const preview = await resp.text().catch(() => "");
        console.error(
          `[DexScreener] Invalid content-type: ${contentType}. Response: ${preview.substring(0, 100)}`,
        );
        throw new Error(
          `Invalid content-type: ${contentType}. Expected application/json`,
        );
      }

      const data = await resp.json();
      currentDexIdx = idx;
      console.log(
        `[DexScreener] Successfully fetched from ${endpoint} for path: ${path}`,
      );
      return data;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (i < DEXSCREENER_ENDPOINTS.length - 1) {
        console.log(`[DexScreener] Retrying next endpoint...`);
        await new Promise((r) => setTimeout(r, 1000));
      }
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
      console.log(`[DexScreener] Cache hit for ${path}`);
      return cached.data;
    }
  }
  const existing = DEX_INFLIGHT.get(path);
  if (existing) {
    console.log(`[DexScreener] Reusing in-flight request for ${path}`);
    return existing;
  }
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

  const token = event.queryStringParameters?.token || "";

  if (!token) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Missing 'token' parameter",
      }),
    };
  }

  try {
    const data = await fetchDexData(`/tokens/${token}`);
    const pair = Array.isArray(data?.pairs) ? data.pairs[0] : null;

    if (pair && pair.priceUsd) {
      const price = parseFloat(pair.priceUsd);
      if (isFinite(price) && price > 0) {
        return {
          statusCode: 200,
          headers: {
            ...CORS_HEADERS,
            "Cache-Control": "public, max-age=5",
          },
          body: JSON.stringify({
            token,
            price,
            priceUsd: pair.priceUsd,
            data: pair,
            source: "dexscreener",
          }),
        };
      }
    }

    // Fallback: return zero price for unknown token
    console.warn(`[DexScreener] No valid price found for ${token}`);
    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=60",
      },
      body: JSON.stringify({
        token,
        price: 0,
        priceUsd: "0",
        data: null,
        source: "fallback",
      }),
    };
  } catch (error: any) {
    console.error(
      `[DexScreener] Endpoint error for token ${token}:`,
      error?.message || String(error),
    );

    // Always return 200 with valid JSON, not error status
    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=60",
      },
      body: JSON.stringify({
        token,
        price: 0,
        priceUsd: "0",
        data: null,
        source: "fallback",
        error: "Failed to fetch from DexScreener - using fallback",
      }),
    };
  }
};
