// functions/api/wallet-balance.ts
// Accepts POST JSON: { "walletAddress": "<Pubkey>" }
// Returns the getBalance RPC result proxied via RPC providers

// NOTE: Helius, Moralis, and Alchemy are RPC providers for Solana blockchain calls
// They fetch wallet balance and transaction data - NOT for token price fetching
// Token prices should come from dedicated price APIs like Jupiter, DexScreener, or DexTools

// Helius-only RPC configuration - no fallbacks
function getHeliusRpcEndpoint(env: any): string {
  if (env?.HELIUS_API_KEY) {
    return `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`;
  }
  if (env?.HELIUS_RPC_URL) {
    return env.HELIUS_RPC_URL;
  }
  throw new Error(
    "Helius RPC endpoint required. Set HELIUS_API_KEY or HELIUS_RPC_URL.",
  );
}

export async function onRequestPost(context: any) {
  const { request, env } = context;

  // Use Helius RPC ONLY
  let rpcEndpoint: string;
  try {
    rpcEndpoint = getHeliusRpcEndpoint(env);
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: (e as Error).message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

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

    // Use Helius RPC only
    try {
      const resp = await fetch(rpcEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rpcBody),
      });

      const data = await resp.json();

      // Check if RPC returned an error
      if (data.error) {
        return new Response(
          JSON.stringify({
            error: data.error.message || "Helius RPC error",
            code: data.error.code,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          error: "Failed to fetch balance from Helius RPC",
          details: err?.message,
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch balance",
        details: err?.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
