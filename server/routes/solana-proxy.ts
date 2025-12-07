import { RequestHandler } from "express";

// Get Helius RPC endpoint ONLY
function getHeliusRpcEndpoint(): string {
  const heliusApiKey = process.env.HELIUS_API_KEY?.trim();
  const heliusRpcUrl = process.env.HELIUS_RPC_URL?.trim();
  const solanaRpcUrl = process.env.SOLANA_RPC_URL?.trim();

  if (heliusApiKey) {
    return `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
  }
  if (heliusRpcUrl) {
    return heliusRpcUrl;
  }
  if (solanaRpcUrl) {
    return solanaRpcUrl;
  }

  throw new Error(
    "Helius RPC endpoint is required. Please set HELIUS_API_KEY or HELIUS_RPC_URL environment variable."
  );
}

const RPC_ENDPOINT = getHeliusRpcEndpoint();

export const handleSolanaRpc: RequestHandler = async (req, res) => {
  try {
    const body = req.body;

    if (!body) {
      return res.status(400).json({
        error: "Missing request body",
      });
    }

    const method = body.method || "unknown";

    console.log(`[RPC Proxy] ${method} request via Helius`);

    let lastError: Error | null = null;
    let lastErrorStatus: number | null = null;
    let lastErrorData: any = null;

    try {
      console.log(
        `[RPC Proxy] ${method} - Using Helius: ${RPC_ENDPOINT.substring(0, 50)}...`
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

      const response = await fetch(RPC_ENDPOINT, {
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
          `[RPC Proxy] ${method} - Helius returned RPC error code ${errorCode}: ${errorMsg}`
        );
        lastErrorData = parsedData;
        lastError = new Error(`RPC error (${errorCode}): ${errorMsg}`);
        lastErrorStatus = response.status;

        // Return the error response
        res.set("Content-Type", "application/json");
        return res.status(response.status).send(data);
      }

      // Treat 403 errors as endpoint being blocked
      if (response.status === 403) {
        console.warn(
          `[RPC Proxy] ${method} - Helius returned 403 (Access Forbidden)`
        );
        lastErrorStatus = 403;
        lastError = new Error("Helius endpoint blocked (403)");

        return res.status(403).json({
          error: "RPC endpoint access forbidden",
          details: "The Helius RPC endpoint is not accessible",
        });
      }

      // Treat 429 (rate limit) as temporary issue
      if (response.status === 429) {
        console.warn(
          `[RPC Proxy] ${method} - Helius rate limited (429)`
        );
        lastErrorStatus = 429;
        lastError = new Error("Helius rate limited");

        return res.status(429).json({
          error: "RPC endpoint rate limited",
          message: "Please retry after a moment. The Helius service is experiencing high load.",
          retryAfter: 60,
        });
      }

      // For other server errors
      if (!response.ok && response.status >= 500) {
        console.warn(
          `[RPC Proxy] ${method} - Helius returned ${response.status}`
        );
        lastErrorStatus = response.status;
        lastError = new Error(`Server error: ${response.status}`);

        return res.status(response.status).json({
          error: "RPC endpoint server error",
          status: response.status,
        });
      }

      // Success or client error - return response
      console.log(
        `[RPC Proxy] ${method} - SUCCESS from Helius (status: ${response.status})`
      );
      res.set("Content-Type", "application/json");
      return res.status(response.status).send(data);
    } catch (e: any) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const errorMsg = lastError.message;

      console.error(
        `[RPC Proxy] ${method} - Helius error: ${errorMsg}`
      );

      // Determine error type
      if (
        errorMsg.includes("abort") ||
        errorMsg.includes("timeout")
      ) {
        return res.status(504).json({
          error: "RPC endpoint timeout",
          message: "The Helius RPC endpoint did not respond in time",
          details: "Please retry your request",
        });
      }

      if (
        errorMsg.includes("fetch") ||
        errorMsg.includes("network") ||
        errorMsg.includes("CORS")
      ) {
        return res.status(503).json({
          error: "RPC endpoint unreachable",
          message: "Cannot reach the Helius RPC endpoint",
          details: "Please check your connection and configuration",
        });
      }

      return res.status(502).json({
        error: lastError?.message || "RPC call failed",
        details: "The Helius RPC endpoint returned an error",
      });
    }
  } catch (error) {
    console.error("[RPC Proxy] Handler error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
      details: "Check that HELIUS_API_KEY or HELIUS_RPC_URL is configured",
    });
  }
};
