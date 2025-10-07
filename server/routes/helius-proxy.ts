import { RequestHandler } from "express";

// Helius API proxy with failover support
const HELIUS_ENDPOINTS = [
  `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY || "4e94fa63-8229-4242-8398-b97c512b660a"}`,
  "https://api.mainnet-beta.solana.com", // Fallback to public RPC
];

let currentHeliusEndpointIndex = 0;

const tryHeliusEndpoints = async (
  method: string,
  params: any[] = [],
): Promise<any> => {
  let lastError: Error | null = null;

  for (let i = 0; i < HELIUS_ENDPOINTS.length; i++) {
    const endpointIndex =
      (currentHeliusEndpointIndex + i) % HELIUS_ENDPOINTS.length;
    const endpoint = HELIUS_ENDPOINTS[endpointIndex];

    try {
      console.log(`Trying Helius endpoint: ${endpoint.split('?')[0]} for method: ${method}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "SolanaWallet/1.0",
        },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method,
          params,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn(`Rate limited on ${endpoint}, trying next...`);
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        console.warn(`RPC error from ${endpoint}:`, data.error);
        // Try next endpoint for RPC errors
        lastError = new Error(`RPC error: ${data.error.message}`);
        continue;
      }

      // Success - update current endpoint
      currentHeliusEndpointIndex = endpointIndex;
      console.log(`Helius API call successful via ${endpoint.split('?')[0]}`);
      return data;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`Helius endpoint ${endpoint.split('?')[0]} failed:`, errorMsg);
      lastError = error instanceof Error ? error : new Error(String(error));

      // Small delay before trying next endpoint
      if (i < HELIUS_ENDPOINTS.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  throw new Error(
    `All Helius endpoints failed. Last error: ${lastError?.message || "Unknown error"}`,
  );
};

export const handleHeliusRpc: RequestHandler = async (req, res) => {
  try {
    const { method, params } = req.body;

    if (!method) {
      return res.status(400).json({
        error: "Missing 'method' parameter in request body",
      });
    }

    console.log(`Helius RPC proxy request: ${method}`);

    const data = await tryHeliusEndpoints(method, params || []);

    res.json(data);
  } catch (error) {
    console.error("Helius RPC proxy error:", {
      method: req.body?.method,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : "Internal error",
        data: String(error),
      },
      id: req.body?.id || null,
    });
  }
};

export const handleHeliusBalance: RequestHandler = async (req, res) => {
  try {
    const { publicKey } = req.query;

    if (!publicKey || typeof publicKey !== "string") {
      return res.status(400).json({
        error: "Missing or invalid 'publicKey' parameter",
      });
    }

    console.log(`Helius balance request for: ${publicKey}`);

    const data = await tryHeliusEndpoints("getBalance", [publicKey]);

    // Handle both direct value and nested context structure
    const lamports = typeof data.result === 'number' ? data.result : (data.result?.value || 0);
    const balance = lamports / 1000000000; // Convert lamports to SOL

    res.json({
      success: true,
      balance,
      lamports,
      publicKey,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Helius balance proxy error:", {
      publicKey: req.query.publicKey,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Internal error",
        details: String(error),
      },
      balance: 0,
      publicKey: req.query.publicKey,
      timestamp: new Date().toISOString(),
    });
  }
};

export const handleHeliusTokenAccounts: RequestHandler = async (req, res) => {
  try {
    const { publicKey } = req.query;

    if (!publicKey || typeof publicKey !== "string") {
      return res.status(400).json({
        error: "Missing or invalid 'publicKey' parameter",
      });
    }

    console.log(`Helius token accounts request for: ${publicKey}`);

    const data = await tryHeliusEndpoints("getTokenAccountsByOwner", [
      publicKey,
      {
        programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      },
      {
        encoding: "jsonParsed",
        commitment: "confirmed",
      },
    ]);

    const tokenAccounts = (data.result?.value || []).map((account: any) => {
      const parsedInfo = account.account.data.parsed.info;
      return {
        mint: parsedInfo.mint,
        balance: parsedInfo.tokenAmount.uiAmount || 0,
        decimals: parsedInfo.tokenAmount.decimals,
        amount: parsedInfo.tokenAmount.amount,
      };
    });

    res.json({
      success: true,
      tokenAccounts,
      count: tokenAccounts.length,
      publicKey,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Helius token accounts proxy error:", {
      publicKey: req.query.publicKey,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Internal error",
        details: String(error),
      },
      tokenAccounts: [],
      count: 0,
      publicKey: req.query.publicKey,
      timestamp: new Date().toISOString(),
    });
  }
};
