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

    const {
      mint,
      amount,
      buyer,
      slippageBps = 350,
      priorityFeeLamports = 10000,
    } = body;

    if (!mint || amount === undefined || !buyer) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Missing required fields: mint, amount, buyer",
        }),
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const pumpPortalUrl = "https://pumpportal.fun/api/trade";
    const res = await fetch(pumpPortalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mint,
        amount: String(amount),
        buyer,
        slippageBps,
        priorityFeeLamports,
        txVersion: "V0",
        operation: "buy",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const text = await res.text();

    if (!res.ok) {
      console.error(`[Pump.fun BUY] API error ${res.status}:`, text);
    }

    return {
      statusCode: res.status,
      headers: CORS_HEADERS,
      body: text,
    };
  } catch (error: any) {
    const isTimeout = error?.name === "AbortError";
    const message = isTimeout
      ? "Request timeout - Pump.fun API took too long to respond"
      : error?.message || "Unknown error";
    console.error("Pump.fun BUY endpoint error:", error);

    return {
      statusCode: isTimeout ? 504 : 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to request BUY transaction",
        details: message,
      }),
    };
  }
};
