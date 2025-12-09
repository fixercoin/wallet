import { RequestHandler } from "express";

interface RpcResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: { code: number; message: string };
}

// List of reliable RPC endpoints to try in order
const RPC_ENDPOINTS = [
  {
    url: "https://api.mainnet-beta.solana.com",
    name: "Solana Public RPC",
    priority: 1,
  },
  {
    url: "https://solana-api.projectserum.com",
    name: "Project Serum",
    priority: 2,
  },
  {
    url: "https://rpc.ankr.com/solana",
    name: "Ankr",
    priority: 3,
  },
  {
    url: "https://api.mainnet-beta.solflare.network",
    name: "Solflare",
    priority: 4,
  },
  {
    url: "https://api.mainnet.solflare.com",
    name: "Solflare (mainnet)",
    priority: 5,
  },
  {
    url: "https://solana.publicnode.com",
    name: "PublicNode",
    priority: 6,
  },
];

function getRpcEndpoint(): string {
  const solanaRpcUrl = process.env.SOLANA_RPC_URL?.trim();

  console.log("[WalletBalance] Environment check:", {
    hasSolanaRpcUrl: !!solanaRpcUrl,
    hasHeliusApiKey: !!process.env.HELIUS_API_KEY?.trim(),
  });

  if (solanaRpcUrl) {
    console.log("[WalletBalance] Using SOLANA_RPC_URL");
    return solanaRpcUrl;
  }

  // Try to use Helius if configured
  const heliusApiKey = process.env.HELIUS_API_KEY?.trim();
  if (heliusApiKey) {
    const heliusEndpoint = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
    console.log("[WalletBalance] Using Helius RPC endpoint");
    return heliusEndpoint;
  }

  console.log(
    "[WalletBalance] Using fallback RPC endpoints (SOLANA_RPC_URL or HELIUS_API_KEY not configured)",
  );
  return RPC_ENDPOINTS[0].url;
}

/**
 * Fetch SOL balance using getBalance RPC method
 */
async function fetchBalanceWithGetBalance(
  rpcUrl: string,
  publicKey: string,
  timeoutMs: number = 8000,
): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [publicKey],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        `[WalletBalance] getBalance HTTP ${response.status} from ${rpcUrl}`,
      );
      return null;
    }

    const data: RpcResponse = await response.json();

    if (data.error) {
      console.warn(
        `[WalletBalance] getBalance RPC error: ${data.error.message}`,
      );
      return null;
    }

    const lamports = data.result;
    if (typeof lamports !== "number" || lamports < 0) {
      console.warn(`[WalletBalance] Invalid balance result: ${lamports}`);
      return null;
    }

    return lamports / 1_000_000_000;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[WalletBalance] getBalance fetch error: ${errorMsg}`);
    return null;
  }
}

/**
 * Fetch SOL balance using getAccount RPC method (alternative)
 */
async function fetchBalanceWithGetAccount(
  rpcUrl: string,
  publicKey: string,
  timeoutMs: number = 8000,
): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [publicKey, { encoding: "base64" }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data: RpcResponse = await response.json();

    if (data.error || !data.result?.value?.lamports) {
      return null;
    }

    const lamports = data.result.value.lamports;
    if (typeof lamports !== "number" || lamports < 0) {
      return null;
    }

    return lamports / 1_000_000_000;
  } catch (error) {
    return null;
  }
}

/**
 * Try to fetch balance with multiple endpoints and methods
 */
async function fetchBalanceWithFallbacks(
  publicKey: string,
): Promise<{ balance: number; endpoint: string } | null> {
  // Primary endpoint
  const primaryEndpoint = getRpcEndpoint();

  console.log(
    `[WalletBalance] Fetching balance for ${publicKey.substring(0, 8)}...`,
  );
  console.log(
    `[WalletBalance] Primary endpoint: ${primaryEndpoint.substring(0, 60)}...`,
  );

  // Try primary endpoint with both methods
  let balance = await fetchBalanceWithGetBalance(primaryEndpoint, publicKey);
  if (balance !== null) {
    return { balance, endpoint: primaryEndpoint };
  }

  balance = await fetchBalanceWithGetAccount(primaryEndpoint, publicKey);
  if (balance !== null) {
    return { balance, endpoint: primaryEndpoint };
  }

  // Try fallback endpoints
  console.log("[WalletBalance] Primary endpoint failed, trying fallbacks...");

  for (const endpoint of RPC_ENDPOINTS) {
    console.log(`[WalletBalance] Trying ${endpoint.name}...`);

    // Try getBalance first
    balance = await fetchBalanceWithGetBalance(endpoint.url, publicKey);
    if (balance !== null) {
      console.log(
        `[WalletBalance] ✅ Success with getBalance from ${endpoint.name}`,
      );
      return { balance, endpoint: endpoint.url };
    }

    // Try getAccountInfo as fallback
    balance = await fetchBalanceWithGetAccount(endpoint.url, publicKey);
    if (balance !== null) {
      console.log(
        `[WalletBalance] ✅ Success with getAccountInfo from ${endpoint.name}`,
      );
      return { balance, endpoint: endpoint.url };
    }
  }

  console.error("[WalletBalance] ❌ All RPC endpoints failed");
  return null;
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

    const result = await fetchBalanceWithFallbacks(publicKey);

    if (!result) {
      console.error(
        "[WalletBalance] ❌ Failed to fetch balance after all attempts",
      );
      return res.status(502).json({
        error: "Failed to fetch balance from all available RPC endpoints",
        details: {
          message:
            "Could not retrieve SOL balance. All RPC providers are unreachable or returning errors.",
          hint: "Check that SOLANA_RPC_URL environment variable is properly configured. You can also try again in a few moments.",
          publicKey: publicKey.substring(0, 8),
        },
      });
    }

    const { balance, endpoint } = result;
    const endpointLabel = endpoint.substring(0, 60);

    console.log(
      `[WalletBalance] ✅ Success: ${balance} SOL for ${publicKey.substring(0, 8)}... from ${endpointLabel}`,
    );

    return res.json({
      publicKey,
      balance,
      balanceLamports: Math.round(balance * 1_000_000_000),
      source: endpointLabel,
    });
  } catch (error) {
    console.error("[WalletBalance] Handler error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
      details: {
        hint: "An unexpected error occurred while fetching balance",
      },
    });
  }
};
