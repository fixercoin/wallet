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

export const handleSolanaRpc: RequestHandler = async (req, res) => {
  try {
    const body = req.body;

    if (!body) {
      return res.status(400).json({
        error: "Missing request body",
      });
    }

    const method = body.method || "unknown";
    console.log(
      `[RPC Proxy] ${method} request to ${RPC_ENDPOINTS.length} endpoints`,
    );

    let lastError: Error | null = null;
    let lastErrorStatus: number | null = null;
    let lastErrorData: any = null;

    for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
      const endpoint = RPC_ENDPOINTS[i];
      try {
        console.log(
          `[RPC Proxy] ${method} - Attempting endpoint ${i + 1}/${RPC_ENDPOINTS.length}: ${endpoint.substring(0, 50)}...`,
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
          if (i < RPC_ENDPOINTS.length - 1) {
            continue;
          }
        }

        // Treat 403 errors as endpoint being blocked/rate limited, try next
        if (response.status === 403) {
          console.warn(
            `[RPC Proxy] ${method} - Endpoint returned 403 (Access Forbidden), trying next...`,
          );
          lastErrorStatus = 403;
          lastError = new Error(`Endpoint blocked: ${endpoint}`);
          continue;
        }

        // Treat 429 (rate limit) as temporary, skip to next
        if (response.status === 429) {
          console.warn(
            `[RPC Proxy] ${method} - Endpoint rate limited (429), trying next...`,
          );
          lastErrorStatus = 429;
          lastError = new Error(`Rate limited: ${endpoint}`);
          continue;
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
          `[RPC Proxy] ${method} - SUCCESS with endpoint ${i + 1} (status: ${response.status})`,
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
        if (i < RPC_ENDPOINTS.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500)); // Brief delay before retry
        }
        continue;
      }
    }

    console.error(
      `[RPC Proxy] ${method} - All ${RPC_ENDPOINTS.length} RPC endpoints failed`,
    );
    return res.status(lastErrorStatus || 503).json({
      error:
        lastError?.message ||
        "All RPC endpoints failed - no Solana RPC available",
      details: `Last error: ${lastErrorStatus || "unknown"}`,
      rpcErrorDetails: lastErrorData?.error || null,
      configuredEndpoints: RPC_ENDPOINTS.length,
    });
  } catch (error) {
    console.error("[RPC Proxy] Handler error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
};
