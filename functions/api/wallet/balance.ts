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

function buildRpcEndpoints(env?: Env): string[] {
  const endpoints: string[] = [];

  // Try env parameter first
  const solanaRpcUrl = env?.SOLANA_RPC_URL;
  const heliusRpcUrl = env?.HELIUS_RPC_URL;
  const heliusApiKey = env?.HELIUS_API_KEY;
  const alchemyRpcUrl = env?.ALCHEMY_RPC_URL;
  const moralisRpcUrl = env?.MORALIS_RPC_URL;

  // Add environment-configured endpoints first (highest priority)
  if (solanaRpcUrl && typeof solanaRpcUrl === "string" && solanaRpcUrl.length > 0) {
    console.log("[RPC Config] Using SOLANA_RPC_URL from env");
    endpoints.push(solanaRpcUrl);
  }
  if (heliusRpcUrl && typeof heliusRpcUrl === "string" && heliusRpcUrl.length > 0) {
    console.log("[RPC Config] Using HELIUS_RPC_URL from env");
    endpoints.push(heliusRpcUrl);
  }
  if (heliusApiKey && typeof heliusApiKey === "string" && heliusApiKey.length > 0) {
    console.log("[RPC Config] Using HELIUS_API_KEY from env");
    const heliusEndpoint = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
    endpoints.push(heliusEndpoint);
  }
  if (alchemyRpcUrl && typeof alchemyRpcUrl === "string" && alchemyRpcUrl.length > 0) {
    console.log("[RPC Config] Using ALCHEMY_RPC_URL from env");
    endpoints.push(alchemyRpcUrl);
  }
  if (moralisRpcUrl && typeof moralisRpcUrl === "string" && moralisRpcUrl.length > 0) {
    console.log("[RPC Config] Using MORALIS_RPC_URL from env");
    endpoints.push(moralisRpcUrl);
  }

  if (endpoints.length === 0) {
    console.log(
      "[RPC Config] No configured endpoints found, using public fallbacks",
    );
  }

  // Add public fallback endpoints (tier 1 - higher quality)
  endpoints.push("https://solana.publicnode.com");
  endpoints.push("https://rpc.ankr.com/solana");
  endpoints.push("https://api.mainnet-beta.solana.com");
  endpoints.push("https://rpc.ironforge.network/mainnet");

  // Add backup endpoints (tier 2 - fallback if above fail)
  endpoints.push("https://rpc.genesysgo.net");
  endpoints.push("https://ssc-dao.genesysgo.net:8899");

  return [...new Set(endpoints)]; // Remove duplicates
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
          console.warn(`[Balance API] Endpoint ${i + 1} non-OK response: ${lastError}`);
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
    console.error(`[Balance API] Exception: ${error?.message || String(error)}`);
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
