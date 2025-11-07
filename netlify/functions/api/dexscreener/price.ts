import type { Handler, HandlerEvent } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  try {
    const token = event.queryStringParameters?.token;

    if (!token) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Missing required parameter: token",
        }),
      };
    }

    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${token}`,
    );

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Failed to fetch token price" }),
      };
    }

    const data = await response.json();

    if (!data.pairs || data.pairs.length === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Token pair data not found" }),
      };
    }

    const pair = data.pairs[0];

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        token: token,
        symbol: pair.baseToken?.symbol || "UNKNOWN",
        priceUsd: parseFloat(pair.priceUsd || "0"),
        priceNative: pair.priceNative,
        volume24h: parseFloat(pair.volume?.h24 || "0"),
        fdv: parseFloat(pair.fdv || "0"),
        marketCap: parseFloat(pair.marketCap || "0"),
        liquidity: parseFloat(pair.liquidity?.usd || "0"),
        pairAddress: pair.pairAddress,
      }),
    };
  } catch (error) {
    console.error("[DexScreener Price] Error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
    };
  }
};
