export const config = {
  runtime: "nodejs_esmsh",
};

interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: {
    amount: string;
    feeBps: number;
  } | null;
  priceImpactPct: string;
  routePlan: any[];
  [key: string]: any;
}

interface SwapRequest {
  quoteResponse: QuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  useSharedAccounts?: boolean;
  computeUnitPriceMicroLamports?: number;
  prioritizationFeeLamports?: number;
  asLegacyTransaction?: boolean;
  [key: string]: any;
}

// Multiple endpoints to try in order
const JUPITER_SWAP_ENDPOINTS = [
  "https://quote-api.jup.ag/v6/swap",
  "https://lite-api.jup.ag/swap/v1/swap",
];

const fetchWithTimeout = (
  url: string,
  options?: RequestInit,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

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

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    let body: SwapRequest;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (!body || !body.quoteResponse || !body.userPublicKey) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: quoteResponse, userPublicKey",
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

    // Prepare swap request with safe defaults
    const swapRequest: SwapRequest = {
      quoteResponse: body.quoteResponse,
      userPublicKey: body.userPublicKey,
      wrapAndUnwrapSol: body.wrapAndUnwrapSol !== false,
      useSharedAccounts: body.useSharedAccounts !== false,
      asLegacyTransaction: body.asLegacyTransaction === true,
      ...body,
    };

    // Remove fields that shouldn't be forwarded
    delete (swapRequest as any).computeUnitPriceMicroLamports;
    delete (swapRequest as any).prioritizationFeeLamports;

    const inputMint = body.quoteResponse?.inputMint || "unknown";
    const outputMint = body.quoteResponse?.outputMint || "unknown";

    // Try each endpoint with retry logic
    for (
      let endpointIndex = 0;
      endpointIndex < JUPITER_SWAP_ENDPOINTS.length;
      endpointIndex++
    ) {
      const baseUrl = JUPITER_SWAP_ENDPOINTS[endpointIndex];

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(
            `[Jupiter Swap] Trying ${baseUrl} (attempt ${attempt}/2) for ${inputMint} -> ${outputMint}`,
          );

          const response = await fetchWithTimeout(baseUrl, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
            },
            body: JSON.stringify(swapRequest),
          });

          const data = await response.text();

          if (!response.ok) {
            // Check for stale quote error
            const isStaleQuote =
              data.includes("1016") ||
              data.includes("stale") ||
              data.includes("simulation") ||
              data.includes("Swap simulation failed");

            if (isStaleQuote) {
              console.warn(
                `[Jupiter Swap] Stale quote error detected (attempt ${attempt})`,
              );
              // Return 530 for stale quote - client will refresh and retry
              return new Response(
                JSON.stringify({
                  error: "STALE_QUOTE",
                  message: "Quote expired - market conditions changed",
                  details: "Please refresh the quote and try again",
                  code: 1016,
                }),
                {
                  status: 530,
                  headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                  },
                },
              );
            }

            // Client errors - don't retry
            if (response.status >= 400 && response.status < 500) {
              console.warn(
                `[Jupiter Swap] Client error ${response.status} from ${baseUrl}`,
              );
              if (endpointIndex === JUPITER_SWAP_ENDPOINTS.length - 1) {
                return new Response(
                  JSON.stringify({
                    error: "Swap request failed",
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
              break; // Try next endpoint
            }

            // Server errors or rate limit - retry
            if (response.status === 429 || response.status >= 500) {
              console.warn(
                `[Jupiter Swap] ${response.status} from ${baseUrl} (attempt ${attempt}/2)`,
              );
              if (attempt < 2) {
                await new Promise((r) => setTimeout(r, attempt * 1000));
                continue; // Retry same endpoint
              }
              // Fall through to try next endpoint
              break;
            }

            break; // Try next endpoint for unexpected errors
          }

          console.log(`[Jupiter Swap] ✅ Success from ${baseUrl}`);
          return new Response(data, {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch (error: any) {
          const errorMsg = error?.message || String(error);
          const isTimeout =
            errorMsg.includes("timeout") || error?.name === "AbortError";

          console.warn(
            `[Jupiter Swap] ${isTimeout ? "Timeout" : "Error"} on ${baseUrl} (attempt ${attempt}/2): ${errorMsg}`,
          );

          if (attempt < 2 && isTimeout) {
            await new Promise((r) => setTimeout(r, attempt * 1000));
            continue; // Retry same endpoint
          }
          // Continue to next endpoint on timeout
        }
      }
    }

    // All endpoints exhausted
    return new Response(
      JSON.stringify({
        error: "Swap failed",
        details: "All swap endpoints failed. Jupiter may be unavailable.",
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
      `[Jupiter Swap] Handler error: ${error?.message || String(error)}`,
    );

    return new Response(
      JSON.stringify({
        error: isTimeout ? "Request timeout" : "Failed to create swap",
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
