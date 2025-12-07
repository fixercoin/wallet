import { RequestHandler } from "express";

const RPC_ENDPOINTS = [
  // Environment-configured RPC as primary
  process.env.SOLANA_RPC_URL || "",
  // Provider-specific overrides
  process.env.HELIUS_RPC_URL || "",
  process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : "",
  process.env.ALCHEMY_RPC_URL || "",
  process.env.MORALIS_RPC_URL || "",
  // Shyft RPC as reliable fallback
  "https://rpc.shyft.to?api_key=3hAwrhOAmJG82eC7",
  // Fallback public endpoints
  "https://solana.publicnode.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
].filter(Boolean);

// Helius API for specialized token balance lookups (more efficient than RPC)
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_API_URL = HELIUS_API_KEY
  ? `https://api.helius.xyz/v0/addresses/${"{publicKey}"}/balances?api-key=${HELIUS_API_KEY}`
  : null;

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
      });
    }

    console.log(
      `[WalletBalance] Fetching balance for: ${publicKey.substring(0, 8)}...`,
    );

    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [publicKey],
    };

    let lastError: Error | null = null;

    for (const endpoint of RPC_ENDPOINTS) {
      try {
        console.log(
          `[WalletBalance] Trying endpoint: ${endpoint.substring(0, 40)}...`,
        );

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          timeout: 10000,
        });

        if (!response.ok) {
          console.warn(
            `[WalletBalance] RPC returned ${response.status} from ${endpoint.substring(0, 50)}...`,
          );
          lastError = new Error(`HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();

        console.log(
          `[WalletBalance] RPC response from ${endpoint.substring(0, 40)}...:`,
          JSON.stringify(data),
        );

        if (data.error) {
          console.warn(
            `[WalletBalance] RPC error from ${endpoint.substring(0, 50)}...:`,
            data.error,
          );
          lastError = new Error(data.error.message || "RPC error");
          continue;
        }

        // Handle different RPC response formats
        let balanceLamports = data.result;

        // Some RPC providers return { value: <balance> } instead of just the number
        if (
          typeof balanceLamports === "object" &&
          balanceLamports !== null &&
          typeof balanceLamports.value === "number"
        ) {
          balanceLamports = balanceLamports.value;
        }

        // Validate balance is a number
        if (typeof balanceLamports !== "number") {
          console.warn(
            `[WalletBalance] Invalid balance result type from ${endpoint.substring(0, 40)}...: ${typeof balanceLamports}`,
            balanceLamports,
          );
          lastError = new Error(
            `Invalid balance type: ${typeof balanceLamports}`,
          );
          continue;
        }

        const balanceSOL = balanceLamports / 1_000_000_000;

        console.log(
          `[WalletBalance] ✅ Got balance: ${balanceSOL} SOL (${balanceLamports} lamports) from ${endpoint.substring(0, 40)}...`,
        );

        return res.json({
          publicKey,
          balance: balanceSOL,
          balanceLamports,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `[WalletBalance] Endpoint ${endpoint.substring(0, 50)}... failed: ${lastError.message}`,
        );
        continue;
      }
    }

    console.error("[WalletBalance] All RPC endpoints failed:", {
      publicKey: publicKey.substring(0, 8),
      lastError: lastError?.message,
      configuredEndpoints: RPC_ENDPOINTS.length,
    });

    return res.status(502).json({
      error:
        lastError?.message ||
        "Failed to fetch balance - all RPC endpoints failed",
      hint: "Please check server RPC configuration. Set HELIUS_API_KEY or SOLANA_RPC_URL environment variable.",
    });
  } catch (error) {
    console.error("[WalletBalance] Handler error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
};
