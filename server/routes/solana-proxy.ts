export async function handleSolanaRpc(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const response = await fetch(
      "https://solana-mainnet.g.alchemy.com/v2/3Z99FYWB1tFEBqYSyV60t-x7FsFCSEjX",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const data = await response.text();
    return new Response(data, {
      headers: { "Content-Type": "application/json" },
      status: response.status,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message || "RPC Proxy failed" }),
      { status: 500 }
    );
  }
}
