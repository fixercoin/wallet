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
        const contentType = resp.headers.get("content-type") || "";
        console.error(
          `[DexScreener Tokens] Error - Status: ${resp.status}, Content-Type: ${contentType}, Response preview: ${t.substring(0, 200)}`,
        );
        throw new Error(
          `HTTP ${resp.status}: ${resp.statusText}. Content-Type: ${contentType}`,
        );
      }
      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const t = await resp.text().catch(() => "");
        console.error(
          `[DexScreener Tokens] Invalid content-type: ${contentType}. Response preview: ${t.substring(0, 200)}`,
        );
        throw new Error(
          `Invalid content-type: ${contentType}. Expected application/json`,
        );
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
    const mints = event.queryStringParameters?.mints;
    if (!mints) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Missing 'mints' query parameter",
        }),
      };
    }

    const rawMints = String(mints)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const uniqSorted = Array.from(new Set(rawMints)).sort();

    if (uniqSorted.length === 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "No valid token mints provided",
        }),
      };
    }

    const data = await fetchDexData(`/tokens/${uniqSorted.join(",")}`);
    const pairs = Array.isArray(data?.pairs)
      ? data.pairs.filter((p: any) => p?.chainId === "solana")
      : [];

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=5",
      },
      body: JSON.stringify({
        schemaVersion: data?.schemaVersion || "1.0.0",
        pairs,
      }),
    };
  } catch (error: any) {
    console.error("DexScreener TOKENS endpoint error:", error);

    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to fetch tokens",
        details: error?.message || String(error),
      }),
    };
  }
};
