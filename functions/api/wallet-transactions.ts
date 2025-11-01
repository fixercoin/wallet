// functions/api/wallet-transactions.ts
// POST JSON: { "walletAddress": "<Pubkey>", "limit": 10 }
// Returns getSignaturesForAddress proxied via Alchemy or fallback RPC providers.

const RPC_ENDPOINTS = [
  "",
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana.publicnode.com",
];

export async function onRequestPost(context: any) {
  const { request, env } = context;

  // Build RPC endpoint list with env var first, then fallbacks
  const rpcEndpoints = [
    env?.ALCHEMY_RPC_URL || env?.HELIUS_RPC_URL,
    ...RPC_ENDPOINTS,
  ].filter(Boolean);

  try {
    const body = await request.json();
    const walletAddress = body?.walletAddress ?? body?.address ?? null;
    const limit = Number(body?.limit ?? 10);

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
      method: "getSignaturesForAddress",
      params: [walletAddress, { limit }],
    };

    // Try each RPC endpoint
    for (const endpoint of rpcEndpoints) {
      if (!endpoint) continue;

      try {
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rpcBody),
        });

        const data = await resp.json();

        // Check if RPC returned an error
        if (data.error) {
          console.warn(`RPC ${endpoint} returned error: ${data.error.message}`);
          continue; // Try next endpoint
        }

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err: any) {
        console.warn(`RPC endpoint ${endpoint} failed: ${err?.message}`);
        continue; // Try next endpoint
      }
    }

    // All endpoints failed
    return new Response(
      JSON.stringify({
        error: "Failed to fetch transactions - all RPC endpoints failed",
        details: "No available Solana RPC providers",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch transactions",
        details: err?.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
