import type { Handler } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Method not allowed. Use POST.",
      }),
    };
  }

  try {
    let body: any = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            error: "Invalid JSON body",
          }),
        };
      }
    }

    const { mint, amount, buyer } = body;

    if (!mint || typeof amount !== "number" || !buyer) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error:
            "Missing required fields: mint, amount (number), buyer (string)",
        }),
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const pumpFunUrl = "https://pump.fun/api/trade";
    const res = await fetch(pumpFunUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mint,
        amount,
        buyer,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const text = await res.text();

    return {
      statusCode: res.status,
      headers: CORS_HEADERS,
      body: text,
    };
  } catch (error: any) {
    const message = error?.message || "Unknown error";
    console.error("Pump.fun BUY endpoint error:", error);

    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to request BUY transaction",
        details: message,
      }),
    };
  }
};
