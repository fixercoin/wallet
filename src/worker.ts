// src/worker.ts
export interface Env {
  SOLANA_RPC?: string;
}

const DEFAULT_SOLANA_RPC = "https://rpc.shyft.to?api_key=3hAwrhOAmJG82eC7";

// Primary services
const PUMPFUN_QUOTE = "https://pumpportal.fun/api/quote";
const PUMPFUN_TRADE = "https://pumpportal.fun/api/trade";
const METEORA_QUOTE = "https://cdn.meteora.ag/defi/swap/v1/quote"; // CDN mirror
const RAYDIUM_QUOTE = "https://api.raydium.io/v2/sdk/quote"; // best-effort fallback (may require tuning)
const DEXSCREENER_TREND = "https://api.dexscreener.com/latest/dex/trending";
const SOLANA_TOKENLIST_URL = "https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

function timeoutFetch(resource: string, options: RequestInit = {}, ms = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const init = { ...options, signal: controller.signal };
  return fetch(resource, init).finally(() => clearTimeout(timer));
}

function browserHeaders(overrides: Record<string, string> = {}) {
  return Object.assign(
    {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Accept: "application/json, text/plain, */*",
      Origin: "https://wallet.fixorium.com.pk",
      Referer: "https://wallet.fixorium.com.pk/",
    },
    overrides
  );
}

async function safeJson(resp: Response) {
  try {
    return await resp.json();
  } catch {
    try {
      const t = await resp.text();
      return { text: t };
    } catch {
      return null;
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const SOLANA_RPC = env.SOLANA_RPC ?? DEFAULT_SOLANA_RPC;

    // ---------- HEALTH ----------
    if (path === "/api/health") {
      const upstream: Record<string, string> = {};
      // quick checks (best-effort)
      const tests = [
        ["pumpfun", PUMPFUN_QUOTE],
        ["meteora", METEORA_QUOTE],
        ["dexscreener", DEXSCREENER_TREND],
      ];
      await Promise.all(
        tests.map(async ([name, endpoint]) => {
          try {
            const r = await timeoutFetch(endpoint, { method: "GET", headers: browserHeaders() }, 6000);
            upstream[name] = r.ok ? "ok" : `fail:${r.status}`;
          } catch (e: any) {
            upstream[name] = `fail:${String(e?.message || e)}`;
          }
        })
      );
      upstream["solana_rpc"] = SOLANA_RPC ? "set" : "missing";

      return new Response(JSON.stringify({ status: "ok", upstream, timestamp: new Date().toISOString() }), {
        headers: CORS_HEADERS,
      });
    }

    // ---------- WALLET BALANCE (SOL) ----------
    if (path === "/api/wallet/balance" && method === "GET") {
      const publicKey = url.searchParams.get("publicKey");
      if (!publicKey) {
        return new Response(JSON.stringify({ error: "publicKey required" }), { status: 400, headers: CORS_HEADERS });
      }

      const payload = { jsonrpc: "2.0", id: 1, method: "getBalance", params: [publicKey] };

      try {
        const rpcRes = await timeoutFetch(SOLANA_RPC, {
          method: "POST",
          headers: browserHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload),
        });
        const rpcJson = await rpcRes.json();
        const lamports = rpcJson?.result?.value ?? 0;
        const sol = lamports / 1_000_000_000;
        return new Response(JSON.stringify({ lamports, sol }), { headers: CORS_HEADERS });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: "rpc_error", details: String(e?.message || e) }), {
          status: 502,
          headers: CORS_HEADERS,
        });
      }
    }

    // ---------- WALLET TOKENS (SPL Accounts) ----------
    // returns token accounts from getTokenAccountsByOwner jsonParsed
    if (path === "/api/wallet/tokens" && method === "GET") {
      const publicKey = url.searchParams.get("publicKey");
      if (!publicKey) return new Response(JSON.stringify({ error: "publicKey required" }), { status: 400, headers: CORS_HEADERS });

      const payload = {
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [publicKey, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed" }],
      };

      try {
        const rpcRes = await timeoutFetch(SOLANA_RPC, {
          method: "POST",
          headers: browserHeaders(),
          body: JSON.stringify(payload),
        });
        const rpcJson = await rpcRes.json();
        const arr = rpcJson?.result?.value ?? [];
        // map to simple token structure
        const tokens = arr.map((t: any) => {
          const acc = t.account?.data?.parsed?.info;
          const mint = acc?.mint;
          const amountRaw = acc?.tokenAmount?.amount ?? "0";
          const decimals = acc?.tokenAmount?.decimals ?? 0;
          const uiAmount = Number(amountRaw) / Math.pow(10, decimals);
          return { mint, amountRaw, uiAmount, decimals, owner: t.pubkey };
        });
        return new Response(JSON.stringify({ tokens }), { headers: CORS_HEADERS });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: "rpc_error", details: String(e?.message || e) }), {
          status: 502,
          headers: CORS_HEADERS,
        });
      }
    }

    // ---------- TOKEN METADATA / SEARCH ----------
    // GET /api/token?mint=<mint>
    if (path === "/api/token" && method === "GET") {
      const mint = url.searchParams.get("mint");
      if (!mint) return new Response(JSON.stringify({ error: "mint required" }), { status: 400, headers: CORS_HEADERS });

      // Try token list first
      try {
        const tokenListResp = await timeoutFetch(SOLANA_TOKENLIST_URL, { method: "GET", headers: browserHeaders() }, 10000);
        const tokenListJson = await tokenListResp.json();
        const found = (tokenListJson.tokens || []).find((t: any) => t.address === mint);
        if (found) return new Response(JSON.stringify({ token: found }), { headers: CORS_HEADERS });
      } catch {
        // ignore token list fetch errors
      }

      // As fallback try dexscreener token info (best-effort)
      try {
        const ds = await timeoutFetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { method: "GET", headers: browserHeaders() }, 8000);
        if (ds.ok) {
          const j = await safeJson(ds);
          return new Response(JSON.stringify({ token: j }), { headers: CORS_HEADERS });
        }
      } catch {
        // ignore
      }

      return new Response(JSON.stringify({ warning: "token metadata not found" }), { status: 404, headers: CORS_HEADERS });
    }

    // ---------- PRICE / DEXSCREENER ----------
    // GET /api/price?mint=<mint>
    if (path === "/api/price" && method === "GET") {
      const mint = url.searchParams.get("mint");
      if (!mint) return new Response(JSON.stringify({ error: "mint required" }), { status: 400, headers: CORS_HEADERS });
      // Query Dexscreener tokens endpoint
      try {
        const r = await timeoutFetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { method: "GET", headers: browserHeaders() }, 10000);
        if (!r.ok) return new Response(JSON.stringify({ error: "dexscreener_error", status: r.status }), { status: 502, headers: CORS_HEADERS });
        const j = await r.json();
        return new Response(JSON.stringify(j), { headers: CORS_HEADERS });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: "dexscreener_error", details: String(e?.message || e) }), { status: 502, headers: CORS_HEADERS });
      }
    }

    // ---------- PUMPFUN QUOTE (proxy) ----------
    if (path === "/api/pumpfun/quote" && method === "POST") {
      const body = await (async () => {
        try { return await request.json(); } catch { return null; }
      })();
      if (!body) return new Response(JSON.stringify({ error: "body required" }), { status: 400, headers: CORS_HEADERS });

      try {
        const res = await timeoutFetch(PUMPFUN_QUOTE, {
          method: "POST",
          headers: browserHeaders(),
          body: JSON.stringify(body),
        }, 20000);
        const text = await res.text();
        return new Response(text, { status: res.status, headers: CORS_HEADERS });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: "pumpfun_failed", details: String(e?.message || e) }), { status: 502, headers: CORS_HEADERS });
      }
    }

    // ---------- PUMPFUN TRADE (proxy) ----------
    if (path === "/api/pumpfun/trade" && method === "POST") {
      const body = await (async () => { try { return await request.json(); } catch { return null; } })();
      if (!body) return new Response(JSON.stringify({ error: "body required" }), { status: 400, headers: CORS_HEADERS });

      try {
        const res = await timeoutFetch(PUMPFUN_TRADE, {
          method: "POST",
          headers: browserHeaders(),
          body: JSON.stringify(body),
        }, 20000);
        const text = await res.text();
        return new Response(text, { status: res.status, headers: CORS_HEADERS });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: "pumpfun_trade_failed", details: String(e?.message || e) }), { status: 502, headers: CORS_HEADERS });
      }
    }

    // ---------- SWAP QUOTE (Aggregator: Pump.fun -> Meteora -> Raydium) ----------
    // GET /api/swap/quote?inputMint=...&outputMint=...&amount=...
    if (path === "/api/swap/quote" && method === "GET") {
      const inputMint = url.searchParams.get("inputMint");
      const outputMint = url.searchParams.get("outputMint");
      const amount = url.searchParams.get("amount"); // decimal or lamports depending caller
      if (!inputMint || !outputMint || !amount) {
        return new Response(JSON.stringify({ error: "inputMint, outputMint, amount required" }), { status: 400, headers: CORS_HEADERS });
      }

      // 1) Try Pump.fun (POST)
      try {
        const pfBody = { inputMint, outputMint, amount };
        const pfRes = await timeoutFetch(PUMPFUN_QUOTE, {
          method: "POST",
          headers: browserHeaders(),
          body: JSON.stringify(pfBody),
        }, 15000);
        if (pfRes.ok) {
          const j = await safeJson(pfRes);
          return new Response(JSON.stringify({ source: "pumpfun", result: j }), { headers: CORS_HEADERS });
        }
      } catch {
        // continue to meteora
      }

      // 2) Try Meteora (GET)
      try {
        // Meteora expects query params; amount rule depends on meteora (pass through)
        const meteoraUrl = `${METEORA_QUOTE}?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}`;
        const mRes = await timeoutFetch(meteoraUrl, { method: "GET", headers: browserHeaders() }, 15000);
        if (mRes.ok) {
          const j = await safeJson(mRes);
          return new Response(JSON.stringify({ source: "meteora", result: j }), { headers: CORS_HEADERS });
        }
      } catch {
        // continue to raydium
      }

      // 3) Try Raydium (best-effort)
      try {
        const rayUrl = `${RAYDIUM_QUOTE}?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}`;
        const rRes = await timeoutFetch(rayUrl, { method: "GET", headers: browserHeaders() }, 10000);
        if (rRes.ok) {
          const j = await safeJson(rRes);
          return new Response(JSON.stringify({ source: "raydium", result: j }), { headers: CORS_HEADERS });
        }
      } catch (e) {
        // all failed
      }

      return new Response(JSON.stringify({ error: "no_quote_available" }), { status: 502, headers: CORS_HEADERS });
    }

    // ---------- SWAP EXECUTE (send signed tx via RPC) ----------
    // POST /api/swap/execute  body: { tx: "<base64_signed_tx>" }
    if (path === "/api/swap/execute" && method === "POST") {
      const payload = await (async () => { try { return await request.json(); } catch { return null; } })();
      if (!payload?.tx) return new Response(JSON.stringify({ error: "tx required (base64 signed)" }), { status: 400, headers: CORS_HEADERS });

      // sendTransaction via RPC
      try {
        const rpcBody = { jsonrpc: "2.0", id: 1, method: "sendTransaction", params: [payload.tx] };
        const rpcRes = await timeoutFetch(SOLANA_RPC, {
          method: "POST",
          headers: browserHeaders(),
          body: JSON.stringify(rpcBody),
        }, 20000);
        const rpcJson = await safeJson(rpcRes as any);
        return new Response(JSON.stringify({ rpc: rpcJson }), { status: 200, headers: CORS_HEADERS });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: "rpc_send_failed", details: String(e?.message || e) }), { status: 502, headers: CORS_HEADERS });
      }
    }

    // ---------- TOKEN LIST (trending + auto-add) ----------
    // GET /api/tokens/trending
    if (path === "/api/tokens/trending" && method === "GET") {
      try {
        // fetch Dexscreener trending pairs
        const ds = await timeoutFetch(DEXSCREENER_TREND, { method: "GET", headers: browserHeaders() }, 10000);
        if (!ds.ok) return new Response(JSON.stringify({ error: "dexscreener_failed", status: ds.status }), { status: 502, headers: CORS_HEADERS });
        const j = await ds.json();
        // j.pairs or j.tokens structure depends on dexscreener; pass-through the result
        return new Response(JSON.stringify(j), { headers: CORS_HEADERS });
      } catch (e: any) {
        // fallback to token list
        try {
          const tl = await timeoutFetch(SOLANA_TOKENLIST_URL, { method: "GET", headers: browserHeaders() }, 10000);
          const tlJson = await tl.json();
          return new Response(JSON.stringify({ fallback: true, tokens: tlJson.tokens || [] }), { headers: CORS_HEADERS });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: "tokenlist_failed", details: String(err?.message || err) }), { status: 502, headers: CORS_HEADERS });
        }
      }
    }

    // ---------- Default unknown route ----------
    return new Response(JSON.stringify({ error: "Unknown route", path }), { status: 404, headers: CORS_HEADERS });
  },
};
