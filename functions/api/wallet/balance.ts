export const config = {
  runtime: "nodejs_esmsh",
};

interface Env {
  SOLANA_RPC_URL?: string;
  HELIUS_RPC_URL?: string;
  HELIUS_API_KEY?: string;
  ALCHEMY_RPC_URL?: string;
  MORALIS_RPC_URL?: string;
}

// Helper to safely check if a string has value
function hasValue(val: string | undefined): val is string {
  return typeof val === "string" && val.trim().length > 0;
}

function buildRpcEndpoints(env?: Env): string[] {
  const endpoints: string[] = [];

  // Try env parameter first, then fall back to process.env for Node.js compat
  const solanaRpcUrl = hasValue(env?.SOLANA_RPC_URL)
    ? env.SOLANA_RPC_URL
    : (process.env.SOLANA_RPC_URL as string | undefined);

  const heliusRpcUrl = hasValue(env?.HELIUS_RPC_URL)
    ? env.HELIUS_RPC_URL
    : (process.env.HELIUS_RPC_URL as string | undefined);

  const heliusApiKey = hasValue(env?.HELIUS_API_KEY)
    ? env.HELIUS_API_KEY
    : (process.env.HELIUS_API_KEY as string | undefined);

  const alchemyRpcUrl = hasValue(env?.ALCHEMY_RPC_URL)
    ? env.ALCHEMY_RPC_URL
    : (process.env.ALCHEMY_RPC_URL as string | undefined);

  const moralisRpcUrl = hasValue(env?.MORALIS_RPC_URL)
    ? env.MORALIS_RPC_URL
    : (process.env.MORALIS_RPC_URL as string | undefined);

  // Log environment configuration for debugging
  console.log("[RPC Config] Environment check:", {
    hasSolanaRpcUrl: !!solanaRpcUrl,
    hasHeliusRpcUrl: !!heliusRpcUrl,
    hasHeliusApiKey: !!heliusApiKey,
    hasAlchemyRpcUrl: !!alchemyRpcUrl,
    hasMoralisRpcUrl: !!moralisRpcUrl,
    configSource: env
      ? "Cloudflare Pages (env parameter)"
      : "Node.js (process.env)",
  });

  // Add HELIUS endpoints first (if configured) - highest priority
  if (hasValue(heliusRpcUrl)) {
    console.log("[RPC Config] Adding HELIUS_RPC_URL (full URL) from env");
    endpoints.push(heliusRpcUrl);
  }

  if (hasValue(heliusApiKey)) {
    console.log("[RPC Config] Adding Helius constructed endpoint from API key");
    const heliusEndpoint = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
    endpoints.push(heliusEndpoint);
  }

  // Add other environment-configured endpoints
  if (hasValue(solanaRpcUrl)) {
    console.log("[RPC Config] Using SOLANA_RPC_URL from env");
    endpoints.push(solanaRpcUrl);
  }

  if (hasValue(alchemyRpcUrl)) {
    console.log("[RPC Config] Using ALCHEMY_RPC_URL from env");
    endpoints.push(alchemyRpcUrl);
  }

  if (hasValue(moralisRpcUrl)) {
    console.log("[RPC Config] Using MORALIS_RPC_URL from env");
    endpoints.push(moralisRpcUrl);
  }

  if (endpoints.length === 0) {
    console.log(
      "[RPC Config] No configured endpoints found, using public endpoints as fallback",
    );
  }

  // Add quality public endpoints in priority order (tested & reliable free options)
  const publicEndpoints = [
    "https://solana.publicnode.com",      // Most reliable free public RPC
    "https://api.solflare.com",            // Solflare's stable endpoint
    "https://rpc.ankr.com/solana",         // Ankr's free tier (good uptime)
    "https://rpc.ironforge.network/mainnet", // IronForge (reliable)
    "https://api.mainnet-beta.solana.com", // Official (rate-limited but functional)
  ];

  // Add public endpoints that aren't already in the list
  publicEndpoints.forEach((endpoint) => {
    if (!endpoints.includes(endpoint)) {
      endpoints.push(endpoint);
    }
  });

  return endpoints; // No duplicates since we check before adding
}

async function handler(request: Request, env?: Env): Promise<Response> {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const url = new URL(request.url);
    const publicKey =
      url.searchParams.get("publicKey") ||
      url.searchParams.get("address") ||
      url.searchParams.get("wallet") ||
      url.searchParams.get("walletAddress");

    if (!publicKey) {
      return new Response(
        JSON.stringify({ error: "Missing 'publicKey' or 'address' parameter" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    const rpcBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [publicKey],
    };

    const rpcEndpoints = buildRpcEndpoints(env);
    console.log(
      `[Balance API] Using ${rpcEndpoints.length} RPC endpoints. Primary: ${rpcEndpoints[0]?.substring(0, 50)}...`,
    );
    let lastError = "";
    let lastStatus = 502;

    // Try each RPC endpoint with individual timeout
    for (let i = 0; i < rpcEndpoints.length; i++) {
      const endpoint = rpcEndpoints[i];
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout per endpoint

        console.log(
          `[Balance API] Attempt ${i + 1}/${rpcEndpoints.length}: ${endpoint.substring(0, 60)}...`,
        );

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rpcBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        lastStatus = response.status;

        console.log(
          `[Balance API] Endpoint ${i + 1} returned status: ${response.status}`,
        );

        if (!response.ok) {
          const errorText = await response.text();
          lastError = `HTTP ${response.status}: ${errorText}`;
          console.warn(
            `[Balance API] Endpoint ${i + 1} non-OK response: ${lastError}`,
          );
          continue;
        }

        const data = await response.json();

        if (data.error) {
          lastError = data.error.message || "RPC error";
          console.warn(
            `[Balance API] Endpoint ${i + 1} RPC error: ${lastError}`,
          );
          continue;
        }

        const lamports = data.result;
        if (typeof lamports === "number" && isFinite(lamports)) {
          console.log(
            `[Balance API] ✅ Success from endpoint ${i + 1}: ${lamports} lamports`,
          );
          return new Response(
            JSON.stringify({
              publicKey,
              balance: lamports / 1_000_000_000,
              balanceLamports: lamports,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        }

        lastError = "Invalid balance response from RPC";
      } catch (error: any) {
        if (error?.name === "AbortError") {
          lastError = "Request timeout";
          console.warn(`[Balance API] Endpoint ${i + 1} timeout`);
        } else {
          lastError = error?.message || String(error);
          console.warn(`[Balance API] Endpoint ${i + 1} error: ${lastError}`);
        }
      }
    }

    console.log(
      `[Balance API] ❌ All ${rpcEndpoints.length} endpoints failed. Last error: ${lastError}`,
    );
    return new Response(
      JSON.stringify({
        error: "Failed to fetch wallet balance",
        details: lastError || "All RPC endpoints failed",
        endpointsAttempted: rpcEndpoints.length,
      }),
      {
        status: lastStatus,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error: any) {
    console.error(
      `[Balance API] Exception: ${error?.message || String(error)}`,
    );
    return new Response(
      JSON.stringify({
        error: "Wallet balance error",
        details: error?.message || String(error),
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
}

export const onRequest = async ({
  request,
  env,
}: {
  request: Request;
  env?: Env;
}) => handler(request, env);
