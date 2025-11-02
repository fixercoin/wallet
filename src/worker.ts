// Production Cloudflare Worker with complete API routing
export interface Env {
  SOLANA_RPC?: string;
}

// RPC endpoints
const DEFAULT_SOLANA_RPC = "https://rpc.shyft.to?api_key=3hAwrhOAmJG82eC7";
const FALLBACK_RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
];

// External API endpoints
const PUMPFUN_QUOTE = "https://pumpportal.fun/api/quote";
const PUMPFUN_TRADE = "https://pumpportal.fun/api/trade";
const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex";
const DEXSCREENER_IO = "https://api.dexscreener.io/latest/dex"; // Alternative
const JUPITER_PRICE_BASE = "https://price.jup.ag/v4";
const JUPITER_SWAP_BASE = "https://lite-api.jup.ag/swap/v1";
const JUPITER_TOKENS_BASE = "https://token.jup.ag";
const DEXTOOLS_BASE = "https://api.dextools.io/free/v2/token/matic";
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const SOLANA_TOKENLIST_URL =
  "https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json";

// CORS headers
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

// Utility: Fetch with timeout
function timeoutFetch(
  resource: string,
  options: RequestInit = {},
  ms = 20000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const init = { ...options, signal: controller.signal };
  return fetch(resource, init)
    .finally(() => clearTimeout(timer))
    .catch((e) => {
      clearTimeout(timer);
      throw e;
    });
}

// Utility: Browser-like headers
function browserHeaders(overrides: Record<string, string> = {}) {
  return Object.assign(
    {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
    },
    overrides,
  );
}

// Utility: Safe JSON parsing
async function safeJson(resp: Response): Promise<any> {
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

// ============ ROUTE HANDLERS ============

// Health check
async function handleHealth(): Promise<Response> {
  const upstream: Record<string, string> = {};
  const tests = [
    ["dexscreener", `${DEXSCREENER_BASE}/pairs/solana`],
    [
      "jupiter",
      `${JUPITER_PRICE_BASE}/price?ids=So11111111111111111111111111111111111111112`,
    ],
    ["pumpfun", PUMPFUN_QUOTE],
  ];

  await Promise.allSettled(
    tests.map(async ([name, endpoint]) => {
      try {
        const r = await timeoutFetch(
          endpoint,
          { method: "GET", headers: browserHeaders() },
          5000,
        );
        upstream[name] = r.ok ? "ok" : `fail:${r.status}`;
      } catch (e: any) {
        upstream[name] = `fail:${String(e?.message || e).slice(0, 50)}`;
      }
    }),
  );

  return new Response(
    JSON.stringify({
      status: "ok",
      upstream,
      timestamp: new Date().toISOString(),
    }),
    { headers: CORS_HEADERS },
  );
}

// Wallet balance - SOL
async function handleWalletBalance(url: URL, env: Env): Promise<Response> {
  const publicKey = url.searchParams.get("publicKey");
  if (!publicKey) {
    return new Response(JSON.stringify({ error: "publicKey required" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const SOLANA_RPC = env.SOLANA_RPC ?? DEFAULT_SOLANA_RPC;
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "getBalance",
    params: [publicKey],
  };

  try {
    const rpcRes = await timeoutFetch(SOLANA_RPC, {
      method: "POST",
      headers: browserHeaders(),
      body: JSON.stringify(payload),
    });
    const rpcJson = await rpcRes.json();
    const lamports = rpcJson?.result?.value ?? 0;
    const sol = lamports / 1_000_000_000;
    return new Response(JSON.stringify({ lamports, sol, publicKey }), {
      headers: CORS_HEADERS,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: "rpc_error",
        details: String(e?.message || e).slice(0, 200),
      }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

// Wallet tokens - SPL accounts
async function handleWalletTokens(url: URL, env: Env): Promise<Response> {
  const publicKey = url.searchParams.get("publicKey");
  if (!publicKey) {
    return new Response(JSON.stringify({ error: "publicKey required" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const SOLANA_RPC = env.SOLANA_RPC ?? DEFAULT_SOLANA_RPC;
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "getTokenAccountsByOwner",
    params: [
      publicKey,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed" },
    ],
  };

  try {
    const rpcRes = await timeoutFetch(SOLANA_RPC, {
      method: "POST",
      headers: browserHeaders(),
      body: JSON.stringify(payload),
    });
    const rpcJson = await rpcRes.json();
    const arr = rpcJson?.result?.value ?? [];
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
    return new Response(
      JSON.stringify({ error: "rpc_error", details: String(e?.message || e) }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

// Generic price endpoint using DexScreener
async function handlePrice(url: URL): Promise<Response> {
  const mint = url.searchParams.get("mint");
  if (!mint) {
    return new Response(JSON.stringify({ error: "mint required" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  try {
    const r = await timeoutFetch(`${DEXSCREENER_BASE}/tokens/${mint}`, {
      method: "GET",
      headers: browserHeaders(),
    });
    if (!r.ok) {
      return new Response(
        JSON.stringify({ error: "dexscreener_error", status: r.status }),
        { status: 502, headers: CORS_HEADERS },
      );
    }
    const j = await r.json();
    return new Response(JSON.stringify(j), { headers: CORS_HEADERS });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: "dexscreener_error",
        details: String(e?.message || e).slice(0, 200),
      }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

// Token metadata
async function handleToken(url: URL): Promise<Response> {
  const mint = url.searchParams.get("mint");
  if (!mint) {
    return new Response(JSON.stringify({ error: "mint required" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  try {
    // Try token list first
    const tokenListResp = await timeoutFetch(SOLANA_TOKENLIST_URL, {
      method: "GET",
      headers: browserHeaders(),
    });
    if (tokenListResp.ok) {
      const tokenListJson = await tokenListResp.json();
      const found = (tokenListJson.tokens || []).find(
        (t: any) => t.address === mint,
      );
      if (found) {
        return new Response(JSON.stringify({ token: found }), {
          headers: CORS_HEADERS,
        });
      }
    }

    // Fallback to DexScreener
    const ds = await timeoutFetch(`${DEXSCREENER_BASE}/tokens/${mint}`, {
      method: "GET",
      headers: browserHeaders(),
    });
    if (ds.ok) {
      const j = await safeJson(ds);
      return new Response(JSON.stringify({ token: j }), {
        headers: CORS_HEADERS,
      });
    }

    return new Response(
      JSON.stringify({ warning: "token metadata not found" }),
      { status: 404, headers: CORS_HEADERS },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: String(e?.message || e).slice(0, 200) }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

// DexScreener tokens
async function handleDexscreenerTokens(url: URL): Promise<Response> {
  const mints = url.searchParams.get("mints");
  if (!mints) {
    return new Response(
      JSON.stringify({ error: "mints required (comma-separated)" }),
      { status: 400, headers: CORS_HEADERS },
    );
  }

  try {
    const mintList = mints
      .split(",")
      .map((m) => m.trim())
      .slice(0, 20)
      .join(",");
    const r = await timeoutFetch(
      `${DEXSCREENER_BASE}/tokens/${mintList}`,
      { method: "GET", headers: browserHeaders() },
      15000,
    );
    if (!r.ok) {
      return new Response(JSON.stringify({ error: `HTTP ${r.status}` }), {
        status: 502,
        headers: CORS_HEADERS,
      });
    }
    const j = await r.json();
    return new Response(JSON.stringify(j), { headers: CORS_HEADERS });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: String(e?.message || e).slice(0, 200) }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

// DexScreener search
async function handleDexscreenerSearch(url: URL): Promise<Response> {
  const q = url.searchParams.get("q");
  if (!q) {
    return new Response(JSON.stringify({ error: "q (query) required" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  try {
    const r = await timeoutFetch(
      `${DEXSCREENER_BASE}/search?q=${encodeURIComponent(q)}`,
      { method: "GET", headers: browserHeaders() },
      10000,
    );
    if (!r.ok) {
      return new Response(JSON.stringify({ pairs: [] }), {
        headers: CORS_HEADERS,
      });
    }
    const j = await r.json();
    return new Response(JSON.stringify(j), { headers: CORS_HEADERS });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: String(e?.message || e).slice(0, 200),
        pairs: [],
      }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

// DexScreener trending
async function handleDexscreenerTrending(): Promise<Response> {
  try {
    const r = await timeoutFetch(
      `${DEXSCREENER_BASE}/pairs/solana`,
      { method: "GET", headers: browserHeaders() },
      15000,
    );
    if (!r.ok) {
      return new Response(JSON.stringify({ pairs: [] }), {
        status: 502,
        headers: CORS_HEADERS,
      });
    }
    const j = await r.json();
    // Sort by volume and take top 50
    const trending = (j.pairs || [])
      .sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
      .slice(0, 50);
    return new Response(JSON.stringify({ pairs: trending }), {
      headers: CORS_HEADERS,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: String(e?.message || e).slice(0, 200),
        pairs: [],
      }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

// Jupiter price
async function handleJupiterPrice(url: URL): Promise<Response> {
  const ids = url.searchParams.get("ids");
  if (!ids) {
    return new Response(
      JSON.stringify({ error: "ids required (comma-separated)" }),
      { status: 400, headers: CORS_HEADERS },
    );
  }

  try {
    const r = await timeoutFetch(
      `${JUPITER_PRICE_BASE}/price?ids=${encodeURIComponent(ids)}`,
      { method: "GET", headers: browserHeaders() },
      10000,
    );
    if (!r.ok) {
      return new Response(JSON.stringify({ data: {} }), {
        status: 502,
        headers: CORS_HEADERS,
      });
    }
    const j = await r.json();
    return new Response(JSON.stringify(j), { headers: CORS_HEADERS });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: String(e?.message || e).slice(0, 200),
        data: {},
      }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

// Jupiter tokens
async function handleJupiterTokens(url: URL): Promise<Response> {
  const type = url.searchParams.get("type") || "strict";

  try {
    const endpoints = [
      `${JUPITER_TOKENS_BASE}/${type}`,
      `https://cache.jup.ag/tokens`,
      `${JUPITER_TOKENS_BASE}/all`,
    ];

    for (const endpoint of endpoints) {
      try {
        const r = await timeoutFetch(endpoint, {
          method: "GET",
          headers: browserHeaders(),
        });
        if (r.ok) {
          const j = await r.json();
          return new Response(JSON.stringify(j), { headers: CORS_HEADERS });
        }
      } catch {}
    }

    return new Response(JSON.stringify([]), {
      status: 502,
      headers: CORS_HEADERS,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: String(e?.message || e).slice(0, 200) }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

// Jupiter quote
async function handleJupiterQuote(url: URL): Promise<Response> {
  const inputMint = url.searchParams.get("inputMint");
  const outputMint = url.searchParams.get("outputMint");
  const amount = url.searchParams.get("amount");
  const slippageBps = url.searchParams.get("slippageBps") || "50";

  if (!inputMint || !outputMint || !amount) {
    return new Response(
      JSON.stringify({
        error: "Missing: inputMint, outputMint, amount",
      }),
      { status: 400, headers: CORS_HEADERS },
    );
  }

  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps,
    });
    const r = await timeoutFetch(
      `${JUPITER_SWAP_BASE}/quote?${params.toString()}`,
      { method: "GET", headers: browserHeaders() },
      15000,
    );
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return new Response(
        JSON.stringify({
          error: `HTTP ${r.status}`,
          code: r.status === 404 ? "NO_ROUTE_FOUND" : "API_ERROR",
        }),
        { status: r.status, headers: CORS_HEADERS },
      );
    }
    const j = await r.json();
    return new Response(JSON.stringify(j), { headers: CORS_HEADERS });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: String(e?.message || e).slice(0, 200) }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

// Jupiter swap
async function handleJupiterSwap(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    if (!body || !body.quoteResponse || !body.userPublicKey) {
      return new Response(
        JSON.stringify({
          error: "Missing: quoteResponse, userPublicKey",
        }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const r = await timeoutFetch(`${JUPITER_SWAP_BASE}/swap`, {
      method: "POST",
      headers: browserHeaders(),
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `HTTP ${r.status}`, details: text }),
        { status: r.status, headers: CORS_HEADERS },
      );
    }
    const j = await r.json();
    return new Response(JSON.stringify(j), { headers: CORS_HEADERS });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: String(e?.message || e).slice(0, 200) }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

// Pump.fun quote
async function handlePumpfunQuote(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const r = await timeoutFetch(PUMPFUN_QUOTE, {
      method: "POST",
      headers: browserHeaders(),
      body: JSON.stringify(body),
    });

    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: CORS_HEADERS,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: String(e?.message || e).slice(0, 200) }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

// Pump.fun trade
async function handlePumpfunTrade(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const r = await timeoutFetch(PUMPFUN_TRADE, {
      method: "POST",
      headers: browserHeaders(),
      body: JSON.stringify(body),
    });

    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: CORS_HEADERS,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: String(e?.message || e).slice(0, 200) }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

// Swap quote aggregator
async function handleSwapQuote(url: URL): Promise<Response> {
  const inputMint = url.searchParams.get("inputMint");
  const outputMint = url.searchParams.get("outputMint");
  const amount = url.searchParams.get("amount");

  if (!inputMint || !outputMint || !amount) {
    return new Response(
      JSON.stringify({
        error: "Missing: inputMint, outputMint, amount",
      }),
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Try Jupiter first
  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps: "50",
    });
    const r = await timeoutFetch(
      `${JUPITER_SWAP_BASE}/quote?${params.toString()}`,
      { method: "GET", headers: browserHeaders() },
      10000,
    );
    if (r.ok) {
      const j = await r.json();
      return new Response(JSON.stringify({ source: "jupiter", result: j }), {
        headers: CORS_HEADERS,
      });
    }
  } catch {}

  // Fallback to Pump.fun
  try {
    const r = await timeoutFetch(PUMPFUN_QUOTE, {
      method: "POST",
      headers: browserHeaders(),
      body: JSON.stringify({ inputMint, outputMint, amount }),
    });
    if (r.ok) {
      const j = await r.json();
      return new Response(JSON.stringify({ source: "pumpfun", result: j }), {
        headers: CORS_HEADERS,
      });
    }
  } catch {}

  return new Response(JSON.stringify({ error: "no_quote_available" }), {
    status: 502,
    headers: CORS_HEADERS,
  });
}

// Swap execute (send tx)
async function handleSwapExecute(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const payload = await request.json();
    if (!payload?.tx) {
      return new Response(
        JSON.stringify({ error: "tx required (base64 signed)" }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const SOLANA_RPC = env.SOLANA_RPC ?? DEFAULT_SOLANA_RPC;
    const rpcBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: [payload.tx],
    };

    const r = await timeoutFetch(SOLANA_RPC, {
      method: "POST",
      headers: browserHeaders(),
      body: JSON.stringify(rpcBody),
    });

    const j = await safeJson(r);
    return new Response(JSON.stringify({ rpc: j }), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: "rpc_send_failed",
        details: String(e?.message || e).slice(0, 200),
      }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

// Solana RPC proxy
async function handleSolanaRpc(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const SOLANA_RPC = env.SOLANA_RPC ?? DEFAULT_SOLANA_RPC;

    const r = await timeoutFetch(SOLANA_RPC, {
      method: "POST",
      headers: browserHeaders(),
      body: JSON.stringify(body),
    });

    const j = await safeJson(r);
    return new Response(JSON.stringify(j), { headers: CORS_HEADERS });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: String(e?.message || e).slice(0, 200) }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

// ============ MAIN HANDLER ============

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Route matching
    if (path === "/api/health") {
      return handleHealth();
    }

    if (path === "/api/wallet/balance" && method === "GET") {
      return handleWalletBalance(url, env);
    }

    if (path === "/api/wallet/tokens" && method === "GET") {
      return handleWalletTokens(url, env);
    }

    if (path === "/api/price" && method === "GET") {
      return handlePrice(url);
    }

    if (path === "/api/token" && method === "GET") {
      return handleToken(url);
    }

    if (path === "/api/dexscreener/tokens" && method === "GET") {
      return handleDexscreenerTokens(url);
    }

    if (path === "/api/dexscreener/search" && method === "GET") {
      return handleDexscreenerSearch(url);
    }

    if (path === "/api/dexscreener/trending" && method === "GET") {
      return handleDexscreenerTrending();
    }

    if (path === "/api/jupiter/price" && method === "GET") {
      return handleJupiterPrice(url);
    }

    if (path === "/api/jupiter/tokens" && method === "GET") {
      return handleJupiterTokens(url);
    }

    if (path === "/api/jupiter/quote" && method === "GET") {
      return handleJupiterQuote(url);
    }

    if (path === "/api/jupiter/swap" && method === "POST") {
      return handleJupiterSwap(request);
    }

    if (path === "/api/pumpfun/quote" && method === "POST") {
      return handlePumpfunQuote(request);
    }

    if (path === "/api/pumpfun/trade" && method === "POST") {
      return handlePumpfunTrade(request);
    }

    if (path === "/api/swap/quote" && method === "GET") {
      return handleSwapQuote(url);
    }

    if (path === "/api/swap/execute" && method === "POST") {
      return handleSwapExecute(request, env);
    }

    if (path === "/api/solana-rpc" && method === "POST") {
      return handleSolanaRpc(request, env);
    }

    if (path === "/api/rpc" && method === "POST") {
      return handleSolanaRpc(request, env);
    }

    // 404
    return new Response(
      JSON.stringify({
        error: "Unknown route",
        path,
        method,
      }),
      { status: 404, headers: CORS_HEADERS },
    );
  },
};
