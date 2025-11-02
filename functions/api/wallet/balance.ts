export const onRequest: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const publicKey = url.searchParams.get("publicKey");
  if (!publicKey) return Response.json({ error: "publicKey required" }, { status: 400 });

  const payload = { jsonrpc: "2.0", id: 1, method: "getBalance", params: [publicKey] };
  try {
    const res = await fetch(env.SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    const lamports = json?.result?.value ?? 0;
    return Response.json({ lamports, sol: lamports / 1_000_000_000 });
  } catch (e: any) {
    return Response.json({ error: "rpc_error", details: String(e?.message || e) }, { status: 502 });
  }
};
