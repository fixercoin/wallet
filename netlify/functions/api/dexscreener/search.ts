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
    const query = event.queryStringParameters?.q || "";

    if (!query) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Missing q (query) parameter" }),
      };
    }

    const data = await fetchFromDexScreener(
      `/search?q=${encodeURIComponent(query)}`,
    );

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(data),
    };
  } catch (error: any) {
    console.error("[DexScreener Search] Error:", error);
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to search tokens",
        details: error?.message || String(error),
      }),
    };
  }
};
