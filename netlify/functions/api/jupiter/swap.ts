import type { Handler } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const JUPITER_V6_SWAP_API = "https://quote-api.jup.ag/v6/swap";

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

    if (!body || !body.quoteResponse || !body.userPublicKey) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Missing required fields: quoteResponse, userPublicKey",
        }),
      };
    }

    const swapRequest = {
      quoteResponse: body.quoteResponse,
      userPublicKey: body.userPublicKey,
      wrapAndUnwrapSol: body.wrapAndUnwrapSol !== false,
      useSharedAccounts: body.useSharedAccounts !== false,
      asLegacyTransaction: body.asLegacyTransaction === true,
      ...body,
    };

    delete (swapRequest as any).computeUnitPriceMicroLamports;
    delete (swapRequest as any).prioritizationFeeLamports;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const response = await fetch(JUPITER_V6_SWAP_API, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(swapRequest),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");

      if (
        errorText.includes("1016") ||
        errorText.includes("stale") ||
        errorText.includes("simulation")
      ) {
        return {
          statusCode: 530,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            error: "STALE_QUOTE",
            message: "Quote expired - market conditions changed",
            details: "Please refresh the quote and try again",
            code: 1016,
          }),
        };
      }

      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Swap failed",
          status: response.status,
          details: errorText.slice(0, 200),
        }),
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(data),
    };
  } catch (error: any) {
    const isTimeout =
      error?.name === "AbortError" || error?.message?.includes("timeout");
    console.error("Jupiter SWAP endpoint error:", error);

    return {
      statusCode: isTimeout ? 504 : 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: isTimeout ? "Request timeout" : "Failed to create swap",
        details: error?.message || String(error),
      }),
    };
  }
};
