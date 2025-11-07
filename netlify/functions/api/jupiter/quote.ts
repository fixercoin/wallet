import type { Handler } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const JUPITER_V6_API = "https://quote-api.jup.ag/v6/quote";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
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
    let slippageBps = "100";
    let onlyDirectRoutes = "false";
    let asLegacyTransaction = "false";

    if (event.httpMethod === "GET") {
      const params = new URLSearchParams(event.rawUrl.split("?")[1] || "");
      inputMint = params.get("inputMint") || "";
      outputMint = params.get("outputMint") || "";
      amount = params.get("amount") || "";
      slippageBps = params.get("slippageBps") || "100";
      onlyDirectRoutes = params.get("onlyDirectRoutes") || "false";
      asLegacyTransaction = params.get("asLegacyTransaction") || "false";
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
      slippageBps = body?.slippageBps || "100";
      onlyDirectRoutes = String(body?.onlyDirectRoutes || false);
      asLegacyTransaction = String(body?.asLegacyTransaction || false);
    }

    if (!inputMint || !outputMint || !amount) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Missing required parameters: inputMint, outputMint, amount",
        }),
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const jupiterParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount: String(amount),
      slippageBps,
      onlyDirectRoutes,
      asLegacyTransaction,
    });

    const response = await fetch(
      `${JUPITER_V6_API}?${jupiterParams.toString()}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (response.status === 404 || response.status === 400) {
      const errorText = await response.text().catch(() => "");
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "No swap route found for this pair",
          code: "NO_ROUTE_FOUND",
          details: errorText.slice(0, 200),
        }),
      };
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Jupiter API error",
          status: response.status,
          details: errorText.slice(0, 200),
        }),
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=5",
      },
      body: JSON.stringify(data),
    };
  } catch (error: any) {
    const isTimeout =
      error?.name === "AbortError" || error?.message?.includes("timeout");
    console.error("Jupiter QUOTE endpoint error:", error);

    return {
      statusCode: isTimeout ? 504 : 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: isTimeout ? "Request timeout" : "Failed to fetch quote",
        details: error?.message || String(error),
      }),
    };
  }
};
