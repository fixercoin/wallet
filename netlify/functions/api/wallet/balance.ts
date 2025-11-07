import type { Handler, HandlerEvent } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const RPC_URL = "https://solana.publicnode.com";

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
    // Support multiple parameter names for flexibility
    const publicKey =
      event.queryStringParameters?.publicKey ||
      event.queryStringParameters?.wallet ||
      event.queryStringParameters?.address ||
      event.queryStringParameters?.walletAddress ||
      "";

    if (!publicKey) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error:
            "Missing publicKey parameter (also accepts: wallet, address, walletAddress)",
        }),
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(RPC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getBalance",
          params: [publicKey],
        }),
        signal: controller.signal,
      });

      const data = await response.json();

      if (data.error) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            error: data.error.message || "Failed to get balance",
          }),
        };
      }

      const balanceLamports = data.result || 0;
      const balanceSol = balanceLamports / 1_000_000_000;

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          publicKey,
          lamports: balanceLamports,
          sol: balanceSol,
        }),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    console.error("[Wallet Balance] Error:", error);
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to fetch balance",
        details: error?.message || String(error),
      }),
    };
  }
};
