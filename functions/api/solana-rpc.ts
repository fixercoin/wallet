export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();

    // Get RPC endpoints from environment with fallbacks
    const rpcEndpoints = [
      // Priority 1: Helius RPC (if env var is set)
      env.HELIUS_RPC_URL,
      env.VITE_HELIUS_RPC_URL,
      env.HELIUS_API_KEY
        ? `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`
        : null,
      // Priority 2: Custom Solana RPC
      env.SOLANA_RPC_URL,
      env.VITE_SOLANA_RPC_URL,
      // Priority 3: Public fallbacks (in order of reliability)
      "https://solana.publicnode.com",
      "https://api.solflare.com",
      "https://rpc.ankr.com/solana",
      "https://rpc.ironforge.network/mainnet",
      "https://api.mainnet-beta.solana.com",
    ].filter((url) => url && typeof url === "string");

    if (!rpcEndpoints.length) {
      return new Response(
        JSON.stringify({
          error: "No RPC endpoints configured",
          details:
            "Please set SOLANA_RPC_URL, HELIUS_RPC_URL, or HELIUS_API_KEY in environment variables",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    let lastError = "";
    let lastResponse: Response | null = null;

    // Try each RPC endpoint
    for (const rpc of rpcEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        lastResponse = response;

        // Check if response is successful
        if (response.ok) {
          const responseText = await response.text();
          const responseData = JSON.parse(responseText);

          // For RPC calls, we want to return the response as-is
          // even if it contains an error (the client will handle it)
          return new Response(responseText, {
            status: response.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        const responseText = await response.text();
        lastError = `HTTP ${response.status}: ${responseText.slice(0, 200)}`;

        // Don't retry on 4xx errors (invalid request)
        if (response.status >= 400 && response.status < 500) {
          // Still try other endpoints in case of rate limiting or similar
          continue;
        }

        // Retry on 5xx errors
        if (response.status >= 500) {
          continue;
        }
      } catch (error: any) {
        lastError =
          error?.name === "AbortError"
            ? `Timeout calling ${rpc}`
            : `Error calling ${rpc}: ${error?.message || String(error)}`;
        continue;
      }
    }

    // If we got here, all endpoints failed
    return new Response(
      JSON.stringify({
        error: "Failed to reach Solana RPC",
        details: lastError || "All RPC endpoints failed",
        rpcCount: rpcEndpoints.length,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "RPC Proxy Error",
        details: err?.message || String(err),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
