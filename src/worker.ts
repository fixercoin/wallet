export interface Env {}

const SOLANA_RPC = "https://rpc.shyft.to?api_key=3hAwrhOAmJG82eC7";
const PUMPFUN_QUOTE = "https://pumpportal.fun/api/quote";
const PUMPFUN_TRADE = "https://pumpportal.fun/api/trade";
const DEXSCREENER = "https://api.dexscreener.com/latest/dex/tokens";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const headers = { "Content-Type": "application/json" };

    // ========== HEALTH CHECK ==========
    if (path === "/api/health") {
      return new Response(JSON.stringify({
        status: "ok",
        upstream: {
          pumpfun: "ok",
          solana_rpc: "set",
          dexscreener: "mirror"
        },
        timestamp: new Date().toISOString()
      }), { headers });
    }

    // ========== WALLET BALANCE ==========
    if (path === "/api/wallet/balance") {
      const publicKey = url.searchParams.get("publicKey");
      if (!publicKey) {
        return new Response(JSON.stringify({ error: "publicKey required" }), {
          status: 400,
          headers
        });
      }

      const payload = {
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [publicKey]
      };

      const rpcReq = await fetch(SOLANA_RPC, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      const json = await rpcReq.json();
      const lamports = json?.result?.value ?? 0;
      const sol = lamports / 1_000_000_000;

      return new Response(JSON.stringify({ lamports, sol }), { headers });
    }

    // ========== PUMPFUN QUOTE ==========
    if (path === "/api/pumpfun/quote") {
      const body = await request.json();
      const res = await fetch(PUMPFUN_QUOTE, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      return new Response(await res.text(), { headers });
    }

    // ========== PUMPFUN TRADE ==========
    if (path === "/api/pumpfun/trade") {
      const body = await request.json();
      const res = await fetch(PUMPFUN_TRADE, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      return new Response(await res.text(), { headers });
    }

    // ========== TOKEN PRICE (DEXSCREENER) ==========
    if (path === "/api/dex") {
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response(JSON.stringify({ error: "token required" }), {
          status: 400, headers
        });
      }

      const res = await fetch(`${DEXSCREENER}/${token}`);
      return new Response(await res.text(), { headers });
    }

    // ========== UNKNOWN ROUTE ==========
    return new Response(JSON.stringify({ error: "Unknown route", path }), {
      status: 404,
      headers
    });
  }
};
