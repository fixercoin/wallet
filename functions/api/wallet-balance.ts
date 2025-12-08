// functions/api/wallet-balance.ts
// Accepts POST JSON: { "walletAddress": "<Pubkey>" }
// Accepts GET query: ?publicKey=<Pubkey>
// Returns the getBalance RPC result using free RPC providers with fallback

// Helper to check if environment variable has a valid value
function hasValue(val: string | undefined): val is string {
  return typeof val === "string" && val.trim().length > 0;
}

// Build list of RPC endpoints from environment and free public providers
function buildRpcEndpoints(env: any): string[] {
  const endpoints: string[] = [];

  // Priority 1: Helius (fastest and most reliable)
  if (hasValue(env?.HELIUS_API_KEY)) {
    const url = `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY.trim()}`;
    endpoints.push(url);
    console.log("[wallet-balance] Using Helius API key endpoint");
  }

  if (hasValue(env?.HELIUS_RPC_URL)) {
    endpoints.push(env.HELIUS_RPC_URL.trim());
    console.log("[wallet-balance] Using Helius RPC URL");
  }

  // Priority 2: Custom RPC endpoints from environment
  if (hasValue(env?.SOLANA_RPC_URL)) {
    endpoints.push(env.SOLANA_RPC_URL.trim());
    console.log("[wallet-balance] Using custom Solana RPC URL");
  }

  if (hasValue(env?.ALCHEMY_RPC_URL)) {
    endpoints.push(env.ALCHEMY_RPC_URL.trim());
    console.log("[wallet-balance] Using Alchemy RPC URL");
  }

  if (hasValue(env?.MORALIS_RPC_URL)) {
    endpoints.push(env.MORALIS_RPC_URL.trim());
    console.log("[wallet-balance] Using Moralis RPC URL");
  }

  // Priority 3: Free public RPC endpoints (always included as fallback)
  const publicEndpoints = [
    "https://solana.publicnode.com",      // Most reliable free endpoint
    "https://api.solflare.com",           // Good uptime
    "https://rpc.ankr.com/solana",        // Good fallback
    "https://api.mainnet-beta.solana.com", // Official but slower
    "https://api.marinade.finance/rpc",   // Marinade fallback
  ];

  publicEndpoints.forEach((endpoint) => {
    if (!endpoints.includes(endpoint)) {
      endpoints.push(endpoint);
    }
  });

  console.log(`[wallet-balance] Built ${endpoints.length} RPC endpoints for failover`);
  return endpoints;
}

export async function onRequest(context: any) {
  const { request, env } = context;

  try {
    let walletAddress: string | null = null;

    if (request.method === "POST") {
      const body = await request.json().catch(() => null);
      walletAddress = body?.walletAddress ?? body?.address ?? null;
    } else if (request.method === "GET") {
      const url = new URL(request.url);
      walletAddress =
        url.searchParams.get("publicKey") ??
        url.searchParams.get("wallet") ??
        url.searchParams.get("address") ??
        url.searchParams.get("walletAddress") ??
        null;
    }

    if (!walletAddress) {
      return new Response(
        JSON.stringify({ error: "Missing walletAddress parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const rpcBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [walletAddress],
    };

    const rpcEndpoints = buildRpcEndpoints(env);

    let lastError = "";
    let lastStatus = 502;

    for (let i = 0; i < rpcEndpoints.length; i++) {
      const endpoint = rpcEndpoints[i];
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rpcBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        lastStatus = resp.status;

        if (!resp.ok) {
          const text = await resp.text();
          lastError = `HTTP ${resp.status}: ${text}`;
          continue;
        }

        const data = await resp.json();

        if (data.error) {
          lastError = data.error.message || "RPC error";
          continue;
        }

        const lamports = data.result?.value ?? data.result;
        if (typeof lamports === "number" && isFinite(lamports) && lamports >= 0) {
          return new Response(
            JSON.stringify({
              publicKey: walletAddress,
              balance: lamports / 1e9, // return SOL
              lamports,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        lastError = "Invalid balance response from RPC";
      } catch (error: any) {
        lastError =
          error?.name === "AbortError"
            ? "Request timeout"
            : error?.message || String(error);
      }
    }

    // All endpoints failed
    return new Response(
      JSON.stringify({
        error: "Failed to fetch balance",
        details: lastError || "All RPC endpoints failed",
      }),
      { status: lastStatus, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch balance",
        details: err?.message || String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
