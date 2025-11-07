import type { Handler } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const JUPITER_PRICE_API = "https://api.jup.ag/price/v2";

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
    const ids = event.queryStringParameters?.ids;

    if (!ids) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Missing 'ids' parameter (comma-separated token mints)",
        }),
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(
      `${JUPITER_PRICE_API}?ids=${encodeURIComponent(ids)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Jupiter price API error",
          status: response.status,
        }),
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=10",
      },
      body: JSON.stringify(data),
    };
  } catch (error: any) {
    const isTimeout =
      error?.name === "AbortError" || error?.message?.includes("timeout");
    console.error("Jupiter PRICE endpoint error:", error);

    return {
      statusCode: isTimeout ? 504 : 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: isTimeout ? "Request timeout" : "Failed to fetch prices",
        details: error?.message || String(error),
        data: {},
      }),
    };
  }
};
