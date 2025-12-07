import { RequestHandler } from "express";

// Function to get HELIUS RPC endpoint ONLY
function getHeliusRpcEndpoint(): string {
  // Helper to safely check env vars (trim empty strings)
  const getEnvVar = (value: string | undefined): string | null => {
    if (!value || typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const heliusApiKey = getEnvVar(process.env.HELIUS_API_KEY);
  const heliusRpcUrl = getEnvVar(process.env.HELIUS_RPC_URL);
  const solanaRpcUrl = getEnvVar(process.env.SOLANA_RPC_URL);

  console.log("[WalletBalance] Helius-only configuration:", {
    hasHeliusApiKey: !!heliusApiKey,
    hasHeliusRpcUrl: !!heliusRpcUrl,
    hasSolanaRpcUrl: !!solanaRpcUrl,
  });

  // HELIUS ONLY - Priority: API key > HELIUS_RPC_URL > SOLANA_RPC_URL
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
    console.log("[WalletBalance] Using SOLANA_RPC_URL (Helius)");
    return solanaRpcUrl;
  }

  // No Helius endpoint found - this is a configuration error
  throw new Error(
    "Helius RPC endpoint is required. Please set HELIUS_API_KEY or HELIUS_RPC_URL environment variable.",
  );
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

    // Use Helius RPC ONLY
    const heliusEndpoint = getHeliusRpcEndpoint();
    const endpointLabel = heliusEndpoint.substring(0, 50);

    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [publicKey],
    };

    console.log(
      `[WalletBalance] Fetching balance from Helius for ${publicKey}`,
    );

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      let response: Response;
      try {
        response = await fetch(heliusEndpoint, {
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
          `Helius RPC returned HTTP ${response.status} ${response.statusText}`,
        );
      }

      let data: any;
      try {
        data = await response.json();
      } catch (parseErr) {
        throw new Error("Helius RPC returned invalid JSON response");
      }

      if (data.error) {
        throw new Error(data.error.message || "Helius RPC error");
      }

      let balanceLamports = data.result;

      if (typeof balanceLamports === "object" && balanceLamports !== null) {
        if (typeof balanceLamports.value === "number") {
          balanceLamports = balanceLamports.value;
        }
      }

      if (typeof balanceLamports !== "number" || isNaN(balanceLamports)) {
        throw new Error(
          `Invalid balance type from Helius: ${typeof balanceLamports}`,
        );
      }

      if (balanceLamports < 0) {
        throw new Error("Invalid negative balance from Helius RPC");
      }

      const balanceSOL = balanceLamports / 1_000_000_000;

      console.log(`[WalletBalance] ✅ Success from Helius: ${balanceSOL} SOL`);

      return res.json({
        publicKey,
        balance: balanceSOL,
        balanceLamports,
        endpoint: endpointLabel,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.error("[WalletBalance] Helius RPC error:", {
        publicKey: publicKey.substring(0, 8),
        error: errorMsg,
        endpoint: endpointLabel,
      });

      return res.status(502).json({
        error: errorMsg || "Failed to fetch balance from Helius RPC",
        details: {
          message: "The Helius RPC endpoint failed to return balance data.",
          hint: "Ensure HELIUS_API_KEY environment variable is set and valid.",
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
