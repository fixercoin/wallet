import type { Handler, HandlerEvent } from "@netlify/functions";

const RPC_ENDPOINTS = [
  process.env.SOLANA_RPC_URL || "",
  process.env.ALCHEMY_RPC_URL || "",
  process.env.HELIUS_RPC_URL || "",
  process.env.MORALIS_RPC_URL || "",
  process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : "",
  "https://solana.publicnode.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
].filter(Boolean);

const rateLimitedEndpoints = new Map<
  string,
  { until: number; count: number }
>();

function getEndpointKey(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    return url.hostname;
  } catch {
    return endpoint;
  }
}

function isEndpointRateLimited(endpoint: string): boolean {
  const key = getEndpointKey(endpoint);
  const entry = rateLimitedEndpoints.get(key);
  if (!entry) return false;

  const now = Date.now();
  if (now > entry.until) {
    rateLimitedEndpoints.delete(key);
    return false;
  }

  return true;
}

function markEndpointRateLimited(endpoint: string, delayMs: number): void {
  const key = getEndpointKey(endpoint);
  const entry = rateLimitedEndpoints.get(key) || { count: 0, until: 0 };

  const backoffMultiplier = Math.min(entry.count + 1, 5);
  const cooldownMs = delayMs * backoffMultiplier;

  entry.count = backoffMultiplier;
  entry.until = Date.now() + cooldownMs;

  rateLimitedEndpoints.set(key, entry);
  console.log(
    `[RPC Proxy] Endpoint rate limited for ${cooldownMs / 1000}s: ${key}`,
  );
}

export const handler: Handler = async (event: HandlerEvent) => {
  const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  try {
    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;

    if (!body) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Missing request body" }),
      };
    }

    const method = body.method || "unknown";
    const availableEndpoints = RPC_ENDPOINTS.filter(
      (ep) => !isEndpointRateLimited(ep),
    );
    const totalEndpoints = RPC_ENDPOINTS.length;
    const workingEndpoints = availableEndpoints.length;

    if (workingEndpoints === 0) {
      return {
        statusCode: 429,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "All RPC endpoints are currently rate limited",
          message:
            "Please retry after a moment. The service is experiencing high load.",
          allEndpointsRateLimited: true,
          totalEndpoints: totalEndpoints,
        }),
      };
    }

    console.log(
      `[RPC Proxy] ${method} request - ${workingEndpoints}/${totalEndpoints} endpoints available`,
    );

    let lastError: Error | null = null;
    let lastErrorStatus: number | null = null;
    let lastErrorData: any = null;

    for (let i = 0; i < availableEndpoints.length; i++) {
      const endpoint = availableEndpoints[i];
      try {
        console.log(
          `[RPC Proxy] ${method} - Attempting endpoint ${i + 1}/${workingEndpoints}`,
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.text();
        let parsedData: any = null;
        try {
          parsedData = JSON.parse(data);
        } catch {}

        if (parsedData?.error) {
          const errorCode = parsedData.error.code;
          const errorMsg = parsedData.error.message;
          console.warn(
            `[RPC Proxy] ${method} - Endpoint returned RPC error code ${errorCode}`,
          );
          lastErrorData = parsedData;
          lastError = new Error(`RPC error (${errorCode}): ${errorMsg}`);

          if (i < availableEndpoints.length - 1) {
            continue;
          }
        }

        if (response.status === 403) {
          console.warn(
            `[RPC Proxy] ${method} - Endpoint returned 403, trying next...`,
          );
          lastErrorStatus = 403;
          lastError = new Error(`Endpoint blocked: ${endpoint}`);
          continue;
        }

        if (response.status === 429) {
          console.warn(`[RPC Proxy] ${method} - Endpoint rate limited (429)`);
          markEndpointRateLimited(endpoint, 10000);
          lastErrorStatus = 429;
          lastError = new Error(`Rate limited: ${endpoint}`);

          if (i < availableEndpoints.length - 1) {
            continue;
          }

          break;
        }

        if (!response.ok && response.status >= 500) {
          console.warn(
            `[RPC Proxy] ${method} - Endpoint returned ${response.status}`,
          );
          lastErrorStatus = response.status;
          lastError = new Error(`Server error: ${response.status}`);
          continue;
        }

        console.log(
          `[RPC Proxy] ${method} - SUCCESS (status: ${response.status})`,
        );
        return {
          statusCode: response.status,
          headers: CORS_HEADERS,
          body: data,
        };
      } catch (e: any) {
        lastError = e instanceof Error ? e : new Error(String(e));
        console.warn(
          `[RPC Proxy] ${method} - Endpoint error:`,
          lastError.message,
        );
        if (i < availableEndpoints.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
        continue;
      }
    }

    console.error(`[RPC Proxy] ${method} - All endpoints exhausted`);

    const statusCode = lastErrorStatus === 429 ? 429 : lastErrorStatus || 503;

    return {
      statusCode: statusCode,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error:
          lastError?.message ||
          "All RPC endpoints failed - no Solana RPC available",
        details: `Last error: ${lastErrorStatus || "unknown"}`,
        rpcErrorDetails: lastErrorData?.error || null,
        configuredEndpoints: totalEndpoints,
        availableEndpoints: workingEndpoints,
        rateLimitingActive: statusCode === 429,
      }),
    };
  } catch (error) {
    console.error("[RPC Proxy] Handler error:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
    };
  }
};
