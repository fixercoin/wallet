import type { Handler, HandlerEvent } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (process.env.BIRDEYE_API_KEY) {
      headers["X-API-Key"] = process.env.BIRDEYE_API_KEY;
    }

    const response = await fetch(
      `https://public-api.birdeye.so/defi/token_price?address=${token}`,
      {
        method: "GET",
        headers: headers,
      },
    );

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Failed to fetch Birdeye price" }),
      };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("[Birdeye Price] Error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
    };
  }
};
