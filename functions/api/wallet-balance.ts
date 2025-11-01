// functions/api/wallet-balance.ts
// Accepts POST JSON: { "walletAddress": "<Pubkey>" }
// Returns the getBalance RPC result proxied via Alchemy.

export async function onRequestPost(context: any) {
  const { request, env } = context;
  const ALCHEMY = env?.ALCHEMY_RPC_URL ?? "https://solana-mainnet.g.alchemy.com/v2/3Z99FYWB1tFEBqYSyV60t-x7FsFCSEjX";

  try {
    const body = await request.json();
    const walletAddress = body?.walletAddress ?? body?.address ?? null;

    if (!walletAddress) {
      return new Response(JSON.stringify({ error: "Missing walletAddress in POST body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rpcBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [walletAddress],
    };

    const resp = await fetch(ALCHEMY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rpcBody),
    });

    const data = await resp.json();
    return new Response(JSON.stringify(data), {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Failed to fetch balance", details: err?.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
