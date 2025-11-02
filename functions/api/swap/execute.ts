export const onRequest: PagesFunction = async ({ request, env }) => {
  const payload = await request.json();
  if (!payload?.tx) return Response.json({ error: "tx required" }, { status: 400 });

  try {
    const res = await fetch(env.SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sendTransaction", params: [payload.tx] }),
    });
    const json = await res.json();
    return Response.json({ rpc: json });
  } catch (e: any) {
    return Response.json({ error: "rpc_send_failed", details: String(e?.message || e) }, { status: 502 });
  }
};
