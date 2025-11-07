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
    const fromCurrency = event.queryStringParameters?.from;
    const toCurrency = event.queryStringParameters?.to;

    if (!fromCurrency || !toCurrency) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Missing required parameters: from, to",
        }),
      };
    }

    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`,
    );

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Failed to fetch forex rates" }),
      };
    }

    const data = await response.json();

    const rate = data.rates[toCurrency.toUpperCase()];

    if (rate === undefined) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Currency pair not found" }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        from: fromCurrency.toUpperCase(),
        to: toCurrency.toUpperCase(),
        rate: rate,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("[Forex Rate] Error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
    };
  }
};
