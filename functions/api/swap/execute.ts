export const onRequest: PagesFunction = async ({ request, env }) => {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: corsHeaders(),
    });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const tx = payload?.tx;
  if (!tx) {
    return new Response(JSON.stringify({ error: "tx required" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  // Prioritized Solana RPC endpoints: env first, then public (in order of reliability)
  const endpoints = [
    env.HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`
      : "",
    env.SOLANA_RPC_URL || "",
    env.HELIUS_RPC_URL || "",
    env.MORALIS_RPC_URL || "",
    env.ALCHEMY_RPC_URL || "",
    "https://solana.publicnode.com",
    "https://api.solflare.com",
    "https://rpc.ankr.com/solana",
    "https://rpc.ironforge.network/mainnet",
    "https://api.mainnet-beta.solana.com",
  ].filter(Boolean) as string[];

  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "sendTransaction",
    params: [tx],
  };

  let lastErr = "";
  for (const rpcUrl of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const resp = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const text = await resp.text();
      // Forward upstream response
      return new Response(text, {
        status: resp.status,
        headers: corsHeaders(
          new Headers({ "Content-Type": "application/json" }),
        ),
      });
    } catch (e: any) {
      lastErr = e?.message || String(e);
      // Try next endpoint
      continue;
    }
  }

  return new Response(
    JSON.stringify({
      error: "rpc_send_failed",
      details: lastErr || "All RPC endpoints failed",
    }),
    { status: 502, headers: corsHeaders() },
  );

  function corsHeaders(h = new Headers()) {
    h.set("Access-Control-Allow-Origin", "*");
    h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    h.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With",
    );
    h.set("Vary", "Origin");
    return h;
  }
};
