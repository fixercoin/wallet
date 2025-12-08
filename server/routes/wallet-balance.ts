import { RequestHandler } from "express";

// Function to get RPC endpoint with public fallback
function getRpcEndpoint(): string {
  // Helper to safely check env vars (trim empty strings)
  const getEnvVar = (value: string | undefined): string | null => {
    if (!value || typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const heliusApiKey = getEnvVar(process.env.HELIUS_API_KEY);
  const heliusRpcUrl = getEnvVar(process.env.HELIUS_RPC_URL);
  const solanaRpcUrl = getEnvVar(process.env.SOLANA_RPC_URL);

  // Priority: Helius API key > HELIUS_RPC_URL > SOLANA_RPC_URL > Public endpoint
  if (heliusApiKey) {
    const endpoint = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
    console.log("[WalletBalance] Using Helius with API key");
    return endpoint;
  }

  if (heliusRpcUrl) {
    console.log("[WalletBalance] Using HELIUS_RPC_URL");
    return heliusRpcUrl;
  }

  if (solanaRpcUrl) {
    console.log("[WalletBalance] Using SOLANA_RPC_URL");
    return solanaRpcUrl;
  }

  // Fallback to reliable public RPC endpoint for dev environments
  const publicEndpoint = "https://solana.publicnode.com";
  console.log(
    "[WalletBalance] Using public Solana RPC endpoint. For production, set HELIUS_API_KEY or HELIUS_RPC_URL environment variable.",
  );
  return publicEndpoint;
}

export const handleWalletBalance: RequestHandler = async (req, res) => {
  try {
    // Accept multiple parameter names: publicKey, wallet, or address
    const publicKey =
      (req.query.publicKey as string) ||
      (req.query.wallet as string) ||
      (req.query.address as string);

    if (!publicKey || typeof publicKey !== "string") {
      console.warn("[WalletBalance] Missing or invalid publicKey:", {
        publicKey,
        query: req.query,
      });
      return res.status(400).json({
        error: "Missing or invalid wallet address parameter",
        details: {
          received: req.query,
          expected: {
            publicKey:
              "Solana wallet address (e.g., 8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV)",
          },
        },
      });
    }

    // Get RPC endpoint with fallback to public
    const rpcEndpoint = getRpcEndpoint();
    const endpointLabel = rpcEndpoint.substring(0, 50);

    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [publicKey],
    };

    console.log(
      `[WalletBalance] Fetching SOL balance for ${publicKey.substring(0, 8)}... using ${endpointLabel}`,
    );

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      let response: Response;
      try {
        response = await fetch(rpcEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error(
          `RPC endpoint returned HTTP ${response.status} ${response.statusText}`,
        );
      }

      let data: any;
      try {
        data = await response.json();
      } catch (parseErr) {
        throw new Error("RPC endpoint returned invalid JSON response");
      }

      if (data.error) {
        throw new Error(
          `RPC error: ${data.error.message || JSON.stringify(data.error)}`,
        );
      }

      let balanceLamports = data.result;

      if (typeof balanceLamports === "object" && balanceLamports !== null) {
        if (typeof balanceLamports.value === "number") {
          balanceLamports = balanceLamports.value;
        }
      }

      if (typeof balanceLamports !== "number" || isNaN(balanceLamports)) {
        throw new Error(
          `Invalid balance type: ${typeof balanceLamports}`,
        );
      }

      if (balanceLamports < 0) {
        throw new Error("Negative balance returned from RPC");
      }

      const balanceSOL = balanceLamports / 1_000_000_000;

      console.log(
        `[WalletBalance] ✅ Success: ${balanceSOL} SOL (${balanceLamports} lamports) from ${endpointLabel}`,
      );

      return res.json({
        publicKey,
        balance: balanceSOL,
        balanceLamports,
        source: endpointLabel,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.error("[WalletBalance] ❌ Error:", {
        publicKey: publicKey.substring(0, 8),
        error: errorMsg,
        endpoint: endpointLabel,
      });

      return res.status(502).json({
        error: errorMsg || "Failed to fetch balance from RPC endpoint",
        details: {
          message: "Could not retrieve SOL balance from RPC provider.",
          hint: "Check your RPC configuration (HELIUS_API_KEY or SOLANA_RPC_URL environment variables).",
          endpoint: endpointLabel,
        },
      });
    }
  } catch (error) {
    console.error("[WalletBalance] Handler error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
      details: {
        hint: "Check that HELIUS_API_KEY or HELIUS_RPC_URL environment variable is configured.",
      },
    });
  }
};
