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
    const { inputMint, outputMint, amount } = event.queryStringParameters || {};

    if (!inputMint || !outputMint || !amount) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Missing required parameters: inputMint, outputMint, amount",
        }),
      };
    }

    const params = new URLSearchParams({
      inputMint: inputMint,
      outputMint: outputMint,
      amount: amount,
      ...(event.queryStringParameters?.slippageBps && {
        slippageBps: event.queryStringParameters.slippageBps,
      }),
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(
      `https://api.jup.ag/quote?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    const data = await response.text();

    if (!response.ok) {
      console.error(`Jupiter API error: ${response.status}`, data);
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Jupiter API error",
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
    console.error("[Jupiter Quote] Error:", error);

    if (error.name === "AbortError") {
      return {
        statusCode: 504,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Jupiter API request timeout",
          message: "The request took too long to complete",
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
