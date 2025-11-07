import type { Handler, HandlerEvent } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const JUPITER_API = "https://quote-api.jup.ag/v6";

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
    const queryString = event.rawUrl?.split("?")[1] || "";
    const url = `${JUPITER_API}/quote?${queryString}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          statusCode: response.status,
          headers: CORS_HEADERS,
          body: JSON.stringify(data || { error: "Jupiter API error" }),
        };
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(data),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    console.error("[Jupiter Quote] Error:", error);
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to fetch quote",
        details: error?.message || String(error),
      }),
    };
  }
};
