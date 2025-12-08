// functions/api/wallet-balance.ts
// Accepts POST JSON: { "walletAddress": "<Pubkey>" }
// Accepts GET query: ?publicKey=<Pubkey>
// Returns the getBalance RPC result using free RPC providers with fallback

// Build list of RPC endpoints from environment and free public providers
function buildRpcEndpoints(env: any): string[] {
  const endpoints: string[] = [];

  if (env?.SOLANA_RPC_URL && typeof env.SOLANA_RPC_URL === "string") {
    const trimmed = env.SOLANA_RPC_URL.trim();
    if (trimmed.length > 0) endpoints.push(trimmed);
  }

  if (env?.ALCHEMY_RPC_URL && typeof env.ALCHEMY_RPC_URL === "string") {
    const trimmed = env.ALCHEMY_RPC_URL.trim();
    if (trimmed.length > 0) endpoints.push(trimmed);
  }

  if (env?.MORALIS_RPC_URL && typeof env.MORALIS_RPC_URL === "string") {
    const trimmed = env.MORALIS_RPC_URL.trim();
    if (trimmed.length > 0) endpoints.push(trimmed);
  }

  // Free public RPC endpoints
  const publicEndpoints = [
    "https://solana.publicnode.com",
    "https://api.solflare.com",
    "https://rpc.ankr.com/solana",
    "https://api.mainnet-beta.solana.com",
    "https://api.marinade.finance/rpc",
  ];

  publicEndpoints.forEach((endpoint) => {
    if (!endpoints.includes(endpoint)) endpoints.push(endpoint);
  });

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
