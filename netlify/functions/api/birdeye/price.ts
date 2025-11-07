import type { Handler, HandlerEvent } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const BIRDEYE_API_KEY =
  process.env.BIRDEYE_API_KEY || "cecae2ad38d7461eaf382f533726d9bb";
const BIRDEYE_API = "https://public-api.birdeye.so";

const FALLBACK_PRICES: Record<string, number> = {
  So11111111111111111111111111111111111111112: 100, // SOL
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 1, // USDC
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns: 1, // USDT
};

async function getPriceFromBirdeye(address: string): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(
        `${BIRDEYE_API}/defi/price?address=${encodeURIComponent(address)}`,
        {
          headers: {
            "x-chain": "solana",
            "X-API-KEY": BIRDEYE_API_KEY,
          },
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`Birdeye returned ${response.status}`);
      }

      const data = await response.json();
      return data?.data?.value || null;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.warn("[Birdeye Price] Error:", error);
    return null;
  }
}

async function getPriceFromDexScreener(
  address: string,
): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(address)}`,
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
    console.warn("[DexScreener Fallback] Error:", error);
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
    const address = event.queryStringParameters?.address || "";

    if (!address) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Missing address parameter" }),
      };
    }

    // Try Birdeye first
    let price = await getPriceFromBirdeye(address);

    // Fallback to DexScreener
    if (price === null) {
      price = await getPriceFromDexScreener(address);
    }

    // Final fallback to hardcoded prices
    if (price === null) {
      price = FALLBACK_PRICES[address] || null;
    }

    if (price === null) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Price not found" }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        data: {
          address,
          value: price,
          updateUnixTime: Math.floor(Date.now() / 1000),
        },
      }),
    };
  } catch (error: any) {
    console.error("[Birdeye Price] Error:", error);
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
