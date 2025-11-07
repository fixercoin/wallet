import type { Handler, HandlerEvent } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const TOKEN_MINTS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
  FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
  LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
};

const FALLBACK_PRICES: Record<string, number> = {
  SOL: 100,
  USDC: 1,
  USDT: 1,
  FIXERCOIN: 0.00008,
  LOCKER: 0.00001,
};

async function getPriceFromDexScreener(mint: string): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`,
        { signal: controller.signal },
      );

      if (!response.ok) throw new Error("DexScreener failed");

      const data = await response.json();
      const pair = data?.pairs?.[0];
      return pair?.priceUsd ? parseFloat(pair.priceUsd) : null;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.warn("[DexScreener] Price lookup failed:", error);
    return null;
  }
}

async function getPriceFromJupiter(mint: string): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(
        `https://price.jup.ag/v4/price?ids=${encodeURIComponent(mint)}`,
        { signal: controller.signal },
      );

      if (!response.ok) throw new Error("Jupiter price failed");

      const data = await response.json();
      return data?.data?.[mint]?.price || null;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.warn("[Jupiter] Price lookup failed:", error);
    return null;
  }
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
    const token = event.queryStringParameters?.token || "";
    const mint = event.queryStringParameters?.mint || "";

    if (!token && !mint) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Missing token or mint parameter",
        }),
      };
    }

    // Resolve mint address
    let tokenMint = mint || TOKEN_MINTS[token.toUpperCase()] || token;

    // Try multiple sources
    let price = await getPriceFromDexScreener(tokenMint);

    if (price === null) {
      price = await getPriceFromJupiter(tokenMint);
    }

    if (price === null) {
      price = FALLBACK_PRICES[token.toUpperCase()] || null;
    }

    if (price === null) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Price not found for token" }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        token: token || tokenMint,
        mint: tokenMint,
        price: price,
        priceUsd: price,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error: any) {
    console.error("[Token Price] Error:", error);
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
