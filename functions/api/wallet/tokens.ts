export const onRequest: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const publicKey = url.searchParams.get("publicKey");
  if (!publicKey) return Response.json({ error: "publicKey required" }, { status: 400 });

  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "getTokenAccountsByOwner",
    params: [publicKey, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed" }],
  };

  try {
    const res = await fetch(env.SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    const tokens = (json?.result?.value || []).map((t: any) => {
      const info = t.account.data.parsed.info;
      return {
        mint: info.mint,
        amountRaw: info.tokenAmount.amount,
        decimals: info.tokenAmount.decimals,
        uiAmount: Number(info.tokenAmount.amount) / Math.pow(10, info.tokenAmount.decimals),
        owner: t.pubkey,
      };
    });
    return Response.json({ tokens });
  } catch (e: any) {
    return Response.json({ error: "rpc_error", details: String(e?.message || e) }, { status: 502 });
  }
};
