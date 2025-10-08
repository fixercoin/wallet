// functions/api/solana-rpc.ts
// Proxy JSON-RPC requests to the Solana RPC provider (Alchemy).
// POST expected: JSON-RPC body forwarded to Alchemy.

export async function onRequestPost(context: any) {
  const { request, env } = context;
  const ALCHEMY = env?.ALCHEMY_RPC_URL ?? "https://solana-mainnet.g.alchemy.com/v2/3Z99FYWB1tFEBqYSyV60t-x7FsFCSEjX";

  try {
    const body = await request.json();

    const resp = await fetch(ALCHEMY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Proxy error", details: err?.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
