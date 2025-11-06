import type { Handler } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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

  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Method not allowed. Use GET or POST.",
      }),
    };
  }

  try {
    let inputMint = "";
    let outputMint = "";
    let amount = "";

    if (event.httpMethod === "GET") {
      const params = new URLSearchParams(event.rawUrl.split("?")[1] || "");
      inputMint = params.get("inputMint") || "";
      outputMint = params.get("outputMint") || "";
      amount = params.get("amount") || "";
    } else {
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
      inputMint = body?.inputMint || "";
      outputMint = body?.outputMint || "";
      amount = body?.amount || "";
    }

    if (!inputMint || !outputMint || !amount) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error:
            "Missing required parameters: inputMint, outputMint, amount",
        }),
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const quoteUrl = `https://pumpportal.fun/api/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}`;

    const res = await fetch(quoteUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      return {
        statusCode: res.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: `Pump.fun API returned ${res.status}`,
          details: errorText,
        }),
      };
    }

    const quoteData = await res.json();
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(quoteData),
    };
  } catch (error: any) {
    const message = error?.message || "Unknown error";
    console.error("Pump.fun QUOTE endpoint error:", error);

    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to fetch Pump.fun quote",
        details: message,
      }),
    };
  }
};
