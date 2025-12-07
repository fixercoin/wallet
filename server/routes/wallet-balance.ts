import { RequestHandler } from "express";

// Function to get RPC endpoints dynamically to handle Cloudflare env vars
function getRpcEndpoints(): string[] {
  const endpoints: string[] = [];

  // Log environment variable availability for debugging
  const solanaRpcUrl = process.env.SOLANA_RPC_URL;
  const heliusRpcUrl = process.env.HELIUS_RPC_URL;
  const heliusApiKey = process.env.HELIUS_API_KEY;
  const alchemyRpcUrl = process.env.ALCHEMY_RPC_URL;
  const moralisRpcUrl = process.env.MORALIS_RPC_URL;

  console.log("[WalletBalance] Environment variable check:", {
    hasSolanaRpcUrl: !!solanaRpcUrl,
    hasHeliusRpcUrl: !!heliusRpcUrl,
    hasHeliusApiKey: !!heliusApiKey,
    hasAlchemyRpcUrl: !!alchemyRpcUrl,
    hasMoralisRpcUrl: !!moralisRpcUrl,
  });

  // Environment-configured RPC as primary
  if (solanaRpcUrl) {
    endpoints.push(solanaRpcUrl);
    console.log("[WalletBalance] Added SOLANA_RPC_URL as primary");
  }

  // Helius RPC URL
  if (heliusRpcUrl) {
    endpoints.push(heliusRpcUrl);
    console.log("[WalletBalance] Added HELIUS_RPC_URL");
  }

  // Helius with API key
  if (heliusApiKey) {
    endpoints.push(
      `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`,
    );
    console.log("[WalletBalance] Added Helius with API key");
  }

  // Alchemy RPC
  if (alchemyRpcUrl) {
    endpoints.push(alchemyRpcUrl);
    console.log("[WalletBalance] Added ALCHEMY_RPC_URL");
  }

  // Moralis RPC
  if (moralisRpcUrl) {
    endpoints.push(moralisRpcUrl);
    console.log("[WalletBalance] Added MORALIS_RPC_URL");
  }

  // Always add public endpoints as fallback (even if env vars exist)
  // These are tier 1 quality public endpoints
  const publicEndpoints = [
    "https://solana.publicnode.com",
    "https://rpc.ankr.com/solana",
    "https://api.mainnet-beta.solana.com",
    "https://rpc.genesysgo.net",
  ];

  publicEndpoints.forEach((endpoint) => {
    if (!endpoints.includes(endpoint)) {
      endpoints.push(endpoint);
    }
  });

  console.log(
    `[WalletBalance] Total RPC endpoints available: ${endpoints.length}`,
  );
  return endpoints;
}

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

        // Use AbortController for timeout (increased for stability)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        let response: Response;
        try {
          response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

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

        // Debug: log the raw result structure
        console.log(
          `[WalletBalance] Raw result from ${endpoint.substring(0, 40)}... type=${typeof balanceLamports}, value=${JSON.stringify(balanceLamports)}`,
        );

        // Handle various response formats
        if (typeof balanceLamports === "object" && balanceLamports !== null) {
          // Format 1: { value: <balance> }
          if (typeof balanceLamports.value === "number") {
            balanceLamports = balanceLamports.value;
            console.log(
              `[WalletBalance] Extracted .value from result object: ${balanceLamports}`,
            );
          }
          // Format 2: Object might be malformed - try to extract any number field
          else {
            const numberField = Object.values(balanceLamports).find(
              (v) => typeof v === "number",
            );
            if (typeof numberField === "number") {
              balanceLamports = numberField;
              console.log(
                `[WalletBalance] Extracted numeric value from result object: ${balanceLamports}`,
              );
            }
          }
        }

        // Validate balance is a number
        if (typeof balanceLamports !== "number" || isNaN(balanceLamports)) {
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
