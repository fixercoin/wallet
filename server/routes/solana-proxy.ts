import { RequestHandler } from "express";

const RPC_ENDPOINTS = [
  // Prefer environment-configured RPC first
  process.env.SOLANA_RPC_URL || "",
  // Provider-specific overrides
  process.env.ALCHEMY_RPC_URL || "",
  process.env.HELIUS_RPC_URL || "",
  process.env.MORALIS_RPC_URL || "",
  process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : "",
  // Fallback public endpoints (prefer more reliable public node providers first)
  "https://solana.publicnode.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
].filter(Boolean);

// Track rate-limited endpoints with cooldown periods
const rateLimitedEndpoints = new Map<
  string,
  { until: number; count: number }
>();

function getEndpointKey(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    return `${url.hostname}`;
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

  // Exponential backoff: each rate limit increases the cooldown
  const backoffMultiplier = Math.min(entry.count + 1, 5);
  const cooldownMs = delayMs * backoffMultiplier;

  entry.count = backoffMultiplier;
  entry.until = Date.now() + cooldownMs;

  rateLimitedEndpoints.set(key, entry);
  console.log(
    `[RPC Proxy] Endpoint rate limited for ${cooldownMs / 1000}s (${backoffMultiplier}x backoff): ${key}`,
  );
}

export const handleSolanaRpc: RequestHandler = async (req, res) => {
  try {
    const body = req.body;

    if (!body) {
      return res.status(400).json({
        error: "Missing request body",
      });
    }

    const method = body.method || "unknown";

    // Filter out currently rate-limited endpoints
    const availableEndpoints = RPC_ENDPOINTS.filter(
      (ep) => !isEndpointRateLimited(ep),
    );
    const totalEndpoints = RPC_ENDPOINTS.length;
    const workingEndpoints = availableEndpoints.length;

    if (workingEndpoints === 0) {
      console.warn(
        `[RPC Proxy] ${method} - All ${totalEndpoints} endpoints currently rate limited, returning 429`,
      );
      return res.status(429).json({
        error: "All RPC endpoints are currently rate limited",
        message:
          "Please retry after a moment. The service is experiencing high load.",
        allEndpointsRateLimited: true,
        totalEndpoints: totalEndpoints,
      });
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
          `[RPC Proxy] ${method} - Attempting endpoint ${i + 1}/${workingEndpoints}: ${endpoint.substring(0, 50)}...`,
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

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

        // Check for RPC errors in response
        if (parsedData?.error) {
          const errorCode = parsedData.error.code;
          const errorMsg = parsedData.error.message;
          console.warn(
            `[RPC Proxy] ${method} - Endpoint returned RPC error code ${errorCode}: ${errorMsg}`,
          );
          lastErrorData = parsedData;
          lastError = new Error(`RPC error (${errorCode}): ${errorMsg}`);

          // Some endpoints don't support certain methods, skip and try next
          if (i < availableEndpoints.length - 1) {
            continue;
          }
        }

        // Treat 403 errors as endpoint being blocked, try next
        if (response.status === 403) {
          console.warn(
            `[RPC Proxy] ${method} - Endpoint returned 403 (Access Forbidden), trying next...`,
          );
          lastErrorStatus = 403;
          lastError = new Error(`Endpoint blocked: ${endpoint}`);
          continue;
        }

        // Treat 429 (rate limit) as temporary, mark endpoint and try next
        if (response.status === 429) {
          console.warn(
            `[RPC Proxy] ${method} - Endpoint rate limited (429), marking for cooldown...`,
          );
          markEndpointRateLimited(endpoint, 10000); // 10 second base cooldown
          lastErrorStatus = 429;
          lastError = new Error(`Rate limited: ${endpoint}`);

          // If more endpoints available, continue to next
          if (i < availableEndpoints.length - 1) {
            continue;
          }

          // If this was the last available endpoint, return 429 to client
          break;
        }

        // For other server errors, try next endpoint
        if (!response.ok && response.status >= 500) {
          console.warn(
            `[RPC Proxy] ${method} - Endpoint returned ${response.status}, trying next...`,
          );
          lastErrorStatus = response.status;
          lastError = new Error(`Server error: ${response.status}`);
          continue;
        }

        // Success or client error - return response
        console.log(
          `[RPC Proxy] ${method} - SUCCESS with endpoint ${i + 1}/${workingEndpoints} (status: ${response.status})`,
        );
        res.set("Content-Type", "application/json");
        return res.status(response.status).send(data);
      } catch (e: any) {
        lastError = e instanceof Error ? e : new Error(String(e));
        console.warn(
          `[RPC Proxy] ${method} - Endpoint ${i + 1} error:`,
          lastError.message,
        );
        // Try next endpoint
        if (i < availableEndpoints.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300)); // Brief delay before retry
        }
        continue;
      }
    }

    console.error(
      `[RPC Proxy] ${method} - All ${workingEndpoints} available RPC endpoints exhausted`,
    );

    // Return 429 if rate limiting was the issue, otherwise 503
    const statusCode = lastErrorStatus === 429 ? 429 : lastErrorStatus || 503;

    return res.status(statusCode).json({
      error:
        lastError?.message ||
        "All RPC endpoints failed - no Solana RPC available",
      details: `Last error: ${lastErrorStatus || "unknown"}`,
      rpcErrorDetails: lastErrorData?.error || null,
      configuredEndpoints: totalEndpoints,
      availableEndpoints: workingEndpoints,
      rateLimitingActive: statusCode === 429,
    });
  } catch (error) {
    console.error("[RPC Proxy] Handler error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
};
