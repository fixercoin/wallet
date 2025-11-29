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

// Multiple endpoints to try in order
const JUPITER_QUOTE_ENDPOINTS = [
  "https://quote-api.jup.ag/v6/quote",
  "https://lite-api.jup.ag/swap/v1/quote",
];

const fetchWithTimeout = (
  url: string,
  options?: RequestInit,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId),
  );
};

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

    // Try each endpoint with retry logic
    for (
      let endpointIndex = 0;
      endpointIndex < JUPITER_QUOTE_ENDPOINTS.length;
      endpointIndex++
    ) {
      const baseUrl = JUPITER_QUOTE_ENDPOINTS[endpointIndex];

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const fullUrl = `${baseUrl}?${jupiterParams.toString()}`;
          console.log(
            `[Jupiter Quote] Trying ${baseUrl} (attempt ${attempt}/2)`,
          );

          const response = await fetchWithTimeout(fullUrl, {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
            },
          });

          const data = await response.text();

          // Special handling for 404/400 - no route found
          if (response.status === 404 || response.status === 400) {
            console.warn(
              `[Jupiter Quote] ${response.status} from ${baseUrl} - likely no route for this pair`,
            );
            // Don't retry other endpoints for 404/400, but try next endpoint
            if (
              endpointIndex === JUPITER_QUOTE_ENDPOINTS.length - 1 &&
              attempt === 1
            ) {
              return new Response(
                JSON.stringify({
                  error: "No swap route found for this pair",
                  code: "NO_ROUTE_FOUND",
                }),
                {
                  status: 404,
                  headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                  },
                },
              );
            }
            break; // Try next endpoint
          }

          // Retry on rate limit or server errors
          if (response.status === 429 || response.status >= 500) {
            console.warn(
              `[Jupiter Quote] ${response.status} from ${baseUrl}, retrying (attempt ${attempt}/2)`,
            );
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, attempt * 500));
              continue; // Retry same endpoint
            }
            break; // Try next endpoint
          }

          if (!response.ok) {
            console.warn(
              `[Jupiter Quote] Unexpected error ${response.status} from ${baseUrl}`,
            );
            break; // Try next endpoint
          }

          console.log(`[Jupiter Quote] ✅ Success from ${baseUrl}`);
          return new Response(data, {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=5",
            },
          });
        } catch (error: any) {
          const errorMsg = error?.message || String(error);
          const isTimeout =
            errorMsg.includes("timeout") || error?.name === "AbortError";

          console.warn(
            `[Jupiter Quote] ${isTimeout ? "Timeout" : "Error"} on ${baseUrl} (attempt ${attempt}/2): ${errorMsg}`,
          );

          if (attempt < 2 && isTimeout) {
            await new Promise((r) => setTimeout(r, attempt * 500));
            continue; // Retry same endpoint
          }
          // Timeout on last attempt of last endpoint - will return error
        }
      }
    }

    // All endpoints exhausted
    return new Response(
      JSON.stringify({
        error: "Jupiter API error",
        details: "All quote endpoints failed. Jupiter may be unavailable.",
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error: any) {
    const isTimeout =
      error?.name === "AbortError" || error?.message?.includes("timeout");

    console.error(
      `[Jupiter Quote] Handler error: ${error?.message || String(error)}`,
    );

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

export const onRequest = async ({ request }: { request: Request }) =>
  handler(request);
