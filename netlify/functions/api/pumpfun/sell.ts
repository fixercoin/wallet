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

    const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;

    const response = await fetch("https://pumpportal.fun/api/sell", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.text();

    if (!response.ok) {
      console.error(`Pumpfun sell error: ${response.status}`);
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Pumpfun sell API error",
          status: response.status,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: data,
    };
  } catch (error) {
    console.error("[Pumpfun Sell] Error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
    };
  }
};
