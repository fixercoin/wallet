// functions/api/wallet-balance.ts
// Accepts:
// - POST JSON: { "walletAddress": "<Pubkey>" }
// - GET query: ?publicKey=<Pubkey>
// Returns the SOL balance and lamports using multiple RPC endpoints with fallback

export const config = {
  runtime: "nodejs_esmsh",
};

interface Env {
  SOLANA_RPC_URL?: string;
  ALCHEMY_RPC_URL?: string;
  MORALIS_RPC_URL?: string;
}

// Helper to check if a string has value
function hasValue(val: string | undefined): val is string {
  return typeof val === "string" && val.trim().length > 0;
}

// Build RPC endpoints list with priority and public fallbacks
function buildRpcEndpoints(env?: Env): string[] {
  const endpoints: string[] = [];

  const solanaRpcUrl = hasValue(env?.SOLANA_RPC_URL) ? env.SOLANA_RPC_URL : process.env.SOLANA_RPC_URL;
  const alchemyRpcUrl = hasValue(env?.ALCHEMY_RPC_URL) ? env.ALCHEMY_RPC_URL : process.env.ALCHEMY_RPC_URL;
  const moralisRpcUrl = hasValue(env?.MORALIS_RPC_URL) ? env.MORALIS_RPC_URL : process.env.MORALIS_RPC_URL;

  if (hasValue(solanaRpcUrl)) endpoints.push(solanaRpcUrl);
  if (hasValue(alchemyRpcUrl)) endpoints.push(alchemyRpcUrl);
  if (hasValue(moralisRpcUrl)) endpoints.push(moralisRpcUrl);

  const publicEndpoints = [
    "https://api.mainnet-beta.solflare.network",
    "https://solana.publicnode.com",
    "https://api.solflare.com",
    "https://rpc.ankr.com/solana",
    "https://api.mainnet-beta.solana.com",
    "https://api.marinade.finance/rpc",
  ];
  publicEndpoints.forEach((e) => { if (!endpoints.includes(e)) endpoints.push(e); });

  return endpoints;
}

// Core handler for GET/POST requests
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
    let walletAddress: string | null = null;

    if (request.method === "POST") {
      const body = await request.json().catch(() => null);
      walletAddress = body?.walletAddress ?? body?.address ?? null;
    } else if (request.method === "GET") {
      const url = new URL(request.url);
      walletAddress = url.searchParams.get("publicKey") ?? url.searchParams.get("wallet") ?? url.searchParams.get("address") ?? url.searchParams.get("walletAddress") ?? null;
    }

    if (!walletAddress) {
      return new Response(JSON.stringify({ error: "Missing walletAddress parameter" }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    const rpcBody = { jsonrpc: "2.0", id: 1, method: "getBalance", params: [walletAddress] };
    const rpcEndpoints = buildRpcEndpoints(env);

    let lastError = "";
    let lastStatus = 502;

    for (let i = 0; i < rpcEndpoints.length; i++) {
      const endpoint = rpcEndpoints[i];
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rpcBody), signal: controller.signal });
        clearTimeout(timeoutId);
        lastStatus = resp.status;

        if (!resp.ok) { lastError = await resp.text(); continue; }

        const data = await resp.json();
        if (data.error) { lastError = data.error.message || "RPC error"; continue; }

        const lamports = data.result?.value ?? data.result;
        if (typeof lamports === "number" && isFinite(lamports) && lamports >= 0) {
          return new Response(JSON.stringify({
            publicKey: walletAddress,
            balance: lamports / 1_000_000_000, // SOL
            balanceLamports: lamports,
            source: endpoint.substring(0, 40),
          }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
        }

        lastError = "Invalid balance response from RPC";
      } catch (err: any) {
        lastError = err?.name === "AbortError" ? "Request timeout" : err?.message || String(err);
      }
    }

    return new Response(JSON.stringify({ error: "Failed to fetch wallet balance", details: lastError, endpointsAttempted: rpcEndpoints.length, primaryEndpoint: rpcEndpoints[0] }), { status: lastStatus, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Wallet balance error", details: err?.message || String(err) }), { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
}

// Cloudflare Pages function entry point
export const onRequest = async ({ request, env }: { request: Request; env?: Env | Record<string, any> }) => {
  const envToPass = {
    ...env,
    SOLANA_RPC_URL: env?.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL,
    HELIUS_RPC_URL: env?.HELIUS_RPC_URL || process.env.HELIUS_RPC_URL,
    HELIUS_API_KEY: env?.HELIUS_API_KEY || process.env.HELIUS_API_KEY,
    ALCHEMY_RPC_URL: env?.ALCHEMY_RPC_URL || process.env.ALCHEMY_RPC_URL,
    MORALIS_RPC_URL: env?.MORALIS_RPC_URL || process.env.MORALIS_RPC_URL,
  } as Env;

  return handler(request, envToPass);
};
