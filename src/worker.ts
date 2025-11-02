export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const headers = { "Content-Type": "application/json" };

    // ------------------ WALLET BALANCE ------------------
    if (path === "/api/wallet/balance") {
      const publicKey = url.searchParams.get("publicKey");
      if (!publicKey) return new Response(JSON.stringify({ error: "publicKey required" }), { status: 400 });

      const rpcPayload = {
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [publicKey]
      };

      const rpc = await fetch(env.SOLANA_RPC, {
        method: "POST",
        headers,
        body: JSON.stringify(rpcPayload)
      });

      const result = await rpc.json();
      const lamports = result?.result?.value ?? 0;
      const sol = lamports / 1_000_000_000;

      return new Response(JSON.stringify({ lamports, sol }), { headers });
    }

    // ------------------ PUMPFUN QUOTE ------------------
    if (path === "/api/pumpfun/quote") {
      const body = await request.json();
      const res = await fetch(env.PUMPFUN_QUOTE, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      return new Response(await res.text(), { headers });
    }

    // ------------------ PUMPFUN TRADE ------------------
    if (path === "/api/pumpfun/trade") {
      const body = await request.json();
      const res = await fetch(env.PUMPFUN_TRADE, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      return new Response(await res.text(), { headers });
    }

    // ------------------ DEXSCREENER PRICE ------------------
    if (path === "/api/dex") {
      const token = url.searchParams.get("token");
      if (!token) return new Response(JSON.stringify({ error: "token required" }), { status: 400 });

      const res = await fetch(`${env.DEXSCREENER}/${token}`);
      return new Response(await res.text(), { headers });
    }

    // ------------------ UNKNOWN ROUTE ------------------
    return new Response(JSON.stringify({ error: "Unknown route", path }), {
      status: 404,
      headers
    });
  }
};
