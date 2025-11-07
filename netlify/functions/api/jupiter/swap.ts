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
    if (!event.body) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Missing request body",
        }),
      };
    }

    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch("https://api.jup.ag/swap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.text();

    if (!response.ok) {
      console.error(`Jupiter swap error: ${response.status}`);
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Jupiter swap API error",
          status: response.status,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: data,
    };
  } catch (error: any) {
    console.error("[Jupiter Swap] Error:", error);

    if (error.name === "AbortError") {
      return {
        statusCode: 504,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Jupiter API request timeout",
        }),
      };
    }

    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: error.message || "Internal server error",
      }),
    };
  }
};
