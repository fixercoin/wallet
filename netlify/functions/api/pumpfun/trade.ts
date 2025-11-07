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

    const { mint, amount, type, action, buyer, seller } = body;
    const tradeType = (type || action || "").toLowerCase();
    const isBuy = tradeType === "buy";
    const isSell = tradeType === "sell";

    if (!mint || typeof amount !== "number" || (!isBuy && !isSell)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error:
            "Missing or invalid required fields: mint, amount (number), type/action (buy|sell)",
        }),
      };
    }

    if (isBuy && !buyer) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Missing required field for buy trade: buyer",
        }),
      };
    }

    if (isSell && !seller) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Missing required field for sell trade: seller",
        }),
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const tradePayload: any = {
      mint,
      amount,
    };

    if (isBuy) {
      tradePayload.buyer = buyer;
    } else if (isSell) {
      tradePayload.seller = seller;
    }

    const pumpFunUrl = "https://pump.fun/api/trade";
    const res = await fetch(pumpFunUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tradePayload),
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
    console.error("Pump.fun TRADE endpoint error:", error);

    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to execute trade",
        details: message,
      }),
    };
  }
};
