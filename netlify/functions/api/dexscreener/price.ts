import type { Handler, HandlerEvent } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const DEXSCREENER_ENDPOINTS = [
  "https://api.dexscreener.com/latest/dex",
  "https://api.dexscreener.io/latest/dex",
];

async function fetchFromDexScreener(path: string): Promise<any> {
  for (const baseUrl of DEXSCREENER_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(`${baseUrl}${path}`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; WalletApp/1.0)",
          },
          signal: controller.signal,
        });

        if (response.ok) {
          return await response.json();
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.warn(`[DexScreener] Endpoint failed:`, error);
    }
  }

  throw new Error("All DexScreener endpoints failed");
}

export const handler: Handler = async (event: HandlerEvent) => {
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
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const tokenAddress = event.queryStringParameters?.tokenAddress || "";

    if (!tokenAddress) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Missing tokenAddress parameter" }),
      };
    }

    const data = await fetchFromDexScreener(`/tokens/${tokenAddress}`);

    if (!data.pairs || data.pairs.length === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Token not found on DexScreener" }),
      };
    }

    const pair = data.pairs[0];
    const price = parseFloat(pair.priceUsd || "0");

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        address: tokenAddress,
        price: price,
        priceUsd: price,
        priceChange24h: parseFloat(pair.priceChange?.h24 || "0") || 0,
        volume24h: parseFloat(pair.volume?.h24 || "0") || 0,
        marketCap: parseFloat(pair.marketCap || "0") || 0,
        liquidity: parseFloat(pair.liquidity?.usd || "0") || 0,
      }),
    };
  } catch (error: any) {
    console.error("[DexScreener Price] Error:", error);
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to fetch price",
        details: error?.message || String(error),
      }),
    };
  }
};
