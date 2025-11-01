import { RequestHandler } from "express";

const RPC_ENDPOINTS = [
  process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : "",
  process.env.HELIUS_RPC_URL || "",
  process.env.MORALIS_RPC_URL || "",
  process.env.ALCHEMY_RPC_URL || "",
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana.publicnode.com",
].filter(Boolean);

export const handleSolanaRpc: RequestHandler = async (req, res) => {
  try {
    const body = req.body;

    if (!body) {
      return res.status(400).json({
        error: "Missing request body",
      });
    }

    let lastError: Error | null = null;
    let lastErrorStatus: number | null = null;

    for (const endpoint of RPC_ENDPOINTS) {
      try {
        console.log(`[RPC Proxy] Attempting endpoint: ${endpoint}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.text();

        // Treat 403 errors as endpoint being blocked/rate limited, try next
        if (response.status === 403) {
          console.warn(
            `[RPC Proxy] Endpoint ${endpoint} returned 403 (Access Forbidden), trying next endpoint...`,
          );
          lastErrorStatus = 403;
          lastError = new Error(`Endpoint blocked: ${endpoint}`);
          continue;
        }

        // For other errors, still pass through but log them
        if (!response.ok && response.status >= 500) {
          console.warn(
            `[RPC Proxy] Endpoint ${endpoint} returned ${response.status}, trying next endpoint...`,
          );
          lastErrorStatus = response.status;
          lastError = new Error(`Endpoint error: ${response.status}`);
          continue;
        }

        // Success or client error - return response
        console.log(
          `[RPC Proxy] Endpoint ${endpoint} successful (status: ${response.status})`,
        );
        res.set("Content-Type", "application/json");
        return res.status(response.status).send(data);
      } catch (e: any) {
        lastError = e instanceof Error ? e : new Error(String(e));
        console.warn(
          `[RPC Proxy] Endpoint ${endpoint} failed:`,
          lastError.message,
        );
        // Try next endpoint
        continue;
      }
    }

    console.error("[RPC Proxy] All RPC endpoints failed");
    return res.status(lastErrorStatus || 503).json({
      error:
        lastError?.message ||
        "All RPC endpoints failed - no Solana RPC available",
      details: `Last error status: ${lastErrorStatus || "unknown"}`,
    });
  } catch (error) {
    console.error("[RPC Proxy] Handler error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
};
