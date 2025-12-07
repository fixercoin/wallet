export const config = {
  runtime: "nodejs_esmsh",
};

// Multiple price endpoints to try in order
const JUPITER_PRICE_ENDPOINTS = [
  "https://price.jup.ag/v4/price",
  "https://api.jup.ag/price/v2",
];

const fetchWithTimeout = (
  url: string,
  options?: RequestInit,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

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
    const ids = url.searchParams.get("ids");

    if (!ids) {
      return new Response(
        JSON.stringify({
          error: "Missing 'ids' parameter (comma-separated token mints)",
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

    // Try each endpoint with retry logic
    for (
      let endpointIndex = 0;
      endpointIndex < JUPITER_PRICE_ENDPOINTS.length;
      endpointIndex++
    ) {
      const baseUrl = JUPITER_PRICE_ENDPOINTS[endpointIndex];

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const fullUrl = `${baseUrl}?ids=${encodeURIComponent(ids)}`;
          console.log(
            `[Jupiter Price] Trying ${baseUrl} (attempt ${attempt}/2)`,
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

          // Retry on rate limit or server errors
          if (response.status === 429 || response.status >= 500) {
            console.warn(
              `[Jupiter Price] ${response.status} from ${baseUrl} (attempt ${attempt}/2), retrying...`,
            );
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, attempt * 500));
              continue; // Retry same endpoint
            }
            break; // Try next endpoint
          }

          if (!response.ok) {
            console.warn(
              `[Jupiter Price] Error ${response.status} from ${baseUrl}`,
            );
            if (endpointIndex === JUPITER_PRICE_ENDPOINTS.length - 1) {
              return new Response(
                JSON.stringify({
                  error: "Jupiter price API error",
                  status: response.status,
                  data: {},
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

          console.log(`[Jupiter Price] ✅ Success from ${baseUrl}`);
          return new Response(data, {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=10",
            },
          });
        } catch (error: any) {
          const errorMsg = error?.message || String(error);
          const isTimeout =
            errorMsg.includes("timeout") || error?.name === "AbortError";

          console.warn(
            `[Jupiter Price] ${isTimeout ? "Timeout" : "Error"} on ${baseUrl} (attempt ${attempt}/2): ${errorMsg}`,
          );

          if (attempt < 2 && isTimeout) {
            await new Promise((r) => setTimeout(r, attempt * 500));
            continue; // Retry same endpoint
          }
          // Continue to next endpoint on timeout
        }
      }
    }

    // All endpoints exhausted
    return new Response(
      JSON.stringify({
        error: "Failed to fetch prices",
        details: "All price endpoints failed",
        data: {},
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
      `[Jupiter Price] Handler error: ${error?.message || String(error)}`,
    );

    return new Response(
      JSON.stringify({
        error: isTimeout ? "Request timeout" : "Failed to fetch prices",
        details: error?.message || String(error),
        data: {},
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
