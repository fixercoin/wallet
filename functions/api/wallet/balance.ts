// functions/api/wallet/balance.ts
// Improved SOL balance fetching with multiple RPC endpoints and methods

interface Env {
  SOLANA_RPC_URL?: string;
  HELIUS_API_KEY?: string;
  ALCHEMY_RPC_URL?: string;
  MORALIS_RPC_URL?: string;
}

interface RpcResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: { code: number; message: string };
}

const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-api.projectserum.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solflare.network",
  "https://api.mainnet.solflare.com",
  "https://solana.publicnode.com",
];

const ALCHEMY_RPC =
  "https://solana-mainnet.g.alchemy.com/v2/T79j33bZKpxgKTLx-KDW5";

function buildRpcEndpoints(env?: Env): string[] {
  const endpoints: string[] = [];

  // Add custom endpoints first (highest priority)
  if (env?.SOLANA_RPC_URL?.trim()) {
    endpoints.push(env.SOLANA_RPC_URL.trim());
    console.log("[wallet-balance] Added SOLANA_RPC_URL");
  }

  // Add Helius if configured
  if (env?.HELIUS_API_KEY?.trim()) {
    endpoints.push(
      `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY.trim()}`,
    );
    console.log("[wallet-balance] Added Helius endpoint");
  }

  // Add other configured endpoints
  if (env?.ALCHEMY_RPC_URL?.trim()) {
    endpoints.push(env.ALCHEMY_RPC_URL.trim());
    console.log("[wallet-balance] Added Alchemy endpoint");
  }

  if (env?.MORALIS_RPC_URL?.trim()) {
    endpoints.push(env.MORALIS_RPC_URL.trim());
    console.log("[wallet-balance] Added Moralis endpoint");
  }

  // Add public endpoints as fallback
  endpoints.push(...RPC_ENDPOINTS);
  endpoints.push(ALCHEMY_RPC);

  // Remove duplicates while preserving order
  return [...new Set(endpoints)];
}

/**
 * Fetch balance using getBalance RPC method
 */
async function fetchWithGetBalance(
  rpcUrl: string,
  walletAddress: string,
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
        params: [walletAddress],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data: RpcResponse = await response.json();

    if (data.error) {
      return null;
    }

    const lamports = data.result;
    if (typeof lamports !== "number" || lamports < 0) {
      return null;
    }

    return lamports / 1_000_000_000;
  } catch {
    return null;
  }
}

/**
 * Fetch balance using getAccountInfo RPC method
 */
async function fetchWithGetAccountInfo(
  rpcUrl: string,
  walletAddress: string,
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
        params: [walletAddress, { encoding: "base64" }],
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
  } catch {
    return null;
  }
}

/**
 * Fetch balance with multiple endpoints and methods
 */
async function fetchBalanceWithFallbacks(
  walletAddress: string,
  endpoints: string[],
): Promise<{ balance: number; endpoint: string } | null> {
  console.log(
    `[wallet-balance] Fetching balance for ${walletAddress.substring(0, 8)}... from ${endpoints.length} endpoints`,
  );

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    const shortEndpoint = endpoint.substring(0, 50);

    console.log(
      `[wallet-balance] Attempt ${i + 1}/${endpoints.length}: ${shortEndpoint}...`,
    );

    // Try getBalance first (faster)
    let balance = await fetchWithGetBalance(endpoint, walletAddress);
    if (balance !== null) {
      console.log(
        `[wallet-balance] ✅ Success: ${balance} SOL from ${shortEndpoint}`,
      );
      return { balance, endpoint };
    }

    // Try getAccountInfo as fallback
    balance = await fetchWithGetAccountInfo(endpoint, walletAddress);
    if (balance !== null) {
      console.log(
        `[wallet-balance] ✅ Success (via getAccountInfo): ${balance} SOL from ${shortEndpoint}`,
      );
      return { balance, endpoint };
    }

    console.log(`[wallet-balance] Endpoint failed, trying next...`);
  }

  console.error(`[wallet-balance] ❌ All ${endpoints.length} endpoints failed`);
  return null;
}

async function handler(request: Request, env?: Env): Promise<Response> {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const url = new URL(request.url);
    const walletAddress =
      url.searchParams.get("publicKey") ||
      url.searchParams.get("wallet") ||
      url.searchParams.get("address");

    if (!walletAddress) {
      return new Response(
        JSON.stringify({
          error: "Missing wallet address parameter",
          details: {
            expected: "?publicKey=<address> or ?wallet=<address>",
          },
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    const rpcEndpoints = buildRpcEndpoints(env);
    const result = await fetchBalanceWithFallbacks(walletAddress, rpcEndpoints);

    if (!result) {
      return new Response(
        JSON.stringify({
          error: "Failed to fetch balance from all RPC endpoints",
          details: {
            message:
              "Could not retrieve SOL balance after trying all endpoints",
            walletAddress: walletAddress.substring(0, 8),
            endpointsAttempted: rpcEndpoints.length,
          },
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    const { balance, endpoint } = result;
    const balanceLamports = Math.round(balance * 1_000_000_000);

    return new Response(
      JSON.stringify({
        publicKey: walletAddress,
        balance,
        balanceLamports,
        source: endpoint.substring(0, 60),
        timestamp: Date.now(),
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("[wallet-balance] Handler error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal error",
        details: {
          hint: "An unexpected error occurred",
        },
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

export const onRequest: PagesFunction<Env> = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  return handler(request, env);
};
