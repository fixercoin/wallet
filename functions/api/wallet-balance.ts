// functions/api/wallet-balance.ts
// Accepts POST JSON: { "walletAddress": "<Pubkey>" }
// Returns the getBalance RPC result using free RPC providers with fallback

// Build list of RPC endpoints from environment and free public providers
function buildRpcEndpoints(env: any): string[] {
  const endpoints: string[] = [];

  // Add environment-configured endpoints first (highest priority)
  if (env?.SOLANA_RPC_URL && typeof env.SOLANA_RPC_URL === "string") {
    const trimmed = env.SOLANA_RPC_URL.trim();
    if (trimmed.length > 0) {
      endpoints.push(trimmed);
    }
  }

  if (env?.ALCHEMY_RPC_URL && typeof env.ALCHEMY_RPC_URL === "string") {
    const trimmed = env.ALCHEMY_RPC_URL.trim();
    if (trimmed.length > 0) {
      endpoints.push(trimmed);
    }
  }

  if (env?.MORALIS_RPC_URL && typeof env.MORALIS_RPC_URL === "string") {
    const trimmed = env.MORALIS_RPC_URL.trim();
    if (trimmed.length > 0) {
      endpoints.push(trimmed);
    }
  }

  // Add free public RPC endpoints (tested, reliable)
  const publicEndpoints = [
    "https://solana.publicnode.com",
    "https://api.solflare.com",
    "https://rpc.ankr.com/solana",
    "https://rpc.ironforge.network/mainnet",
    "https://api.mainnet-beta.solana.com",
  ];

  // Add public endpoints that aren't already in the list
  publicEndpoints.forEach((endpoint) => {
    if (!endpoints.includes(endpoint)) {
      endpoints.push(endpoint);
    }
  });

  return endpoints;
}

export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const walletAddress = body?.walletAddress ?? body?.address ?? null;

    if (!walletAddress) {
      return new Response(
        JSON.stringify({ error: "Missing walletAddress in POST body" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const rpcBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [walletAddress],
    };

    const rpcEndpoints = buildRpcEndpoints(env);
    console.log(
      `[BalanceAPI] Using ${rpcEndpoints.length} RPC endpoints. Primary: ${rpcEndpoints[0]?.substring(0, 50)}...`,
    );

    let lastError = "";
    let lastStatus = 502;

    // Try each RPC endpoint
    for (let i = 0; i < rpcEndpoints.length; i++) {
      const endpoint = rpcEndpoints[i];
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        console.log(
          `[BalanceAPI] Attempt ${i + 1}/${rpcEndpoints.length}: ${endpoint.substring(0, 60)}...`,
        );

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rpcBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        lastStatus = resp.status;

        if (!resp.ok) {
          const errorText = await resp.text();
          lastError = `HTTP ${resp.status}: ${errorText}`;
          console.warn(
            `[BalanceAPI] Endpoint ${i + 1} non-OK response: ${lastError}`,
          );
          continue;
        }

        const data = await resp.json();

        // Check if RPC returned an error
        if (data.error) {
          lastError = data.error.message || "RPC error";
          console.warn(
            `[BalanceAPI] Endpoint ${i + 1} RPC error: ${lastError}`,
          );
          continue;
        }

        const lamports = data.result ?? data.result?.value;
        if (typeof lamports === "number" && isFinite(lamports) && lamports >= 0) {
          console.log(
            `[BalanceAPI] ✅ Success from endpoint ${i + 1}: ${lamports} lamports`,
          );
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        lastError = "Invalid balance response from RPC";
      } catch (error: any) {
        if (error?.name === "AbortError") {
          lastError = "Request timeout";
          console.warn(`[BalanceAPI] Endpoint ${i + 1} timeout`);
        } else {
          lastError = error?.message || String(error);
          console.warn(`[BalanceAPI] Endpoint ${i + 1} error: ${lastError}`);
        }
      }
    }

    // All endpoints failed
    console.error(
      `[BalanceAPI] All ${rpcEndpoints.length} endpoints failed. Last error: ${lastError}`,
    );
    return new Response(
      JSON.stringify({
        error: "Failed to fetch balance",
        details: lastError || "All RPC endpoints failed",
      }),
      {
        status: lastStatus,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error(`[BalanceAPI] Handler error:`, err);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch balance",
        details: err?.message || String(err),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
