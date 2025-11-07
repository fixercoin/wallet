export const config = {
  runtime: "nodejs_esmsh",
};

interface JupiterQuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: number | string;
  slippageBps?: number;
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
  platformFeeBps?: number;
  maxAccounts?: number;
}

const JUPITER_V6_API = "https://quote-api.jup.ag/v6/quote";

async function handler(request: Request): Promise<Response> {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const url = new URL(request.url);

    // Parse parameters from query string
    const inputMint = url.searchParams.get("inputMint");
    const outputMint = url.searchParams.get("outputMint");
    const amount = url.searchParams.get("amount");
    const slippageBps = url.searchParams.get("slippageBps") || "100";
    const onlyDirectRoutes =
      url.searchParams.get("onlyDirectRoutes") === "true";
    const asLegacyTransaction =
      url.searchParams.get("asLegacyTransaction") === "true";

    if (!inputMint || !outputMint || !amount) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameters: inputMint, outputMint, amount",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Build Jupiter API request
    const jupiterParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount: String(amount),
      slippageBps,
      onlyDirectRoutes: String(onlyDirectRoutes),
      asLegacyTransaction: String(asLegacyTransaction),
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

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

    const data = await response.text();

    if (response.status === 404 || response.status === 400) {
      return new Response(
        JSON.stringify({
          error: "No swap route found for this pair",
          code: "NO_ROUTE_FOUND",
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: "Jupiter API error",
          status: response.status,
          details: data.slice(0, 200),
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=5",
      },
    });
  } catch (error: any) {
    const isTimeout =
      error?.name === "AbortError" || error?.message?.includes("timeout");

    return new Response(
      JSON.stringify({
        error: isTimeout ? "Request timeout" : "Failed to fetch quote",
        details: error?.message || String(error),
      }),
      {
        status: isTimeout ? 504 : 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

export default handler;
