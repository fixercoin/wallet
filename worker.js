// Cloudflare Worker - API proxy + lightweight endpoints for Fixorium Wallet
// Place at the root and deploy as your Worker script.

const DEXSCREENER_BASES = [
  "https://api.dexscreener.com/latest/dex",
  "https://api.dexscreener.io/latest/dex",
];

const DEFAULT_RPC_FALLBACKS = [
  "https://solana.publicnode.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
];

const MAX_DEX_BATCH = 20;

function normalizeBase(v) {
  if (!v) return "";
  return v.replace(/\/+$|^\/+/, "");
}

async function timeoutFetch(url, opts = {}, ms = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal, ...opts });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function tryDexscreener(path) {
  for (const base of DEXSCREENER_BASES) {
    try {
      const url = `${base}${path}`;
      const res = await timeoutFetch(
        url,
        { headers: { Accept: "application/json" } },
        8000,
      );
      if (!res.ok) continue;
      const data = await res.json();
      return data;
    } catch (e) {
      // continue
    }
  }
  throw new Error("All DexScreener endpoints failed");
}

async function tryJupiter(urlCandidates, options = {}, ms = 8000) {
  for (const candidate of urlCandidates) {
    try {
      const res = await timeoutFetch(candidate, options, ms);
      if (!res) continue;
      // return raw response for full transparency
      const text = await res.text();
      return { status: res.status, headers: res.headers, body: text };
    } catch (e) {
      // try next
    }
  }
  throw new Error("All Jupiter endpoints failed");
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}

async function handleApiRoot() {
  return new Response(
    JSON.stringify({
      status: "ok",
      message: "Fixorium Worker API",
      version: "1.0.0",
      endpoints: [
        "/api/health",
        "/api/ping",
        "/api/wallet/balance?publicKey=...",
        "/api/forex/rate?base=USD&symbols=PKR",
        "/api/dexscreener/tokens?mints=<comma-separated>",
        "/api/dexscreener/price?tokenAddress=<mint>",
        "/api/jupiter/price?ids=...",
        "/api/jupiter/quote?inputMint=...&outputMint=...&amount=...",
        "/api/jupiter/swap (POST - proxy to Jupiter swap)",
      ],
    }),
    { headers: { "content-type": "application/json" } },
  );
}

async function handleHealth() {
  return new Response(
    JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
    {
      headers: { "content-type": "application/json", ...corsHeaders() },
    },
  );
}

async function handlePing() {
  return new Response(
    JSON.stringify({ status: "pong", timestamp: new Date().toISOString() }),
    {
      headers: { "content-type": "application/json", ...corsHeaders() },
    },
  );
}

async function handleForexRate(reqUrl) {
  const base = (reqUrl.searchParams.get("base") || "USD").toUpperCase();
  const symbols = (reqUrl.searchParams.get("symbols") || "PKR").toUpperCase();
  const first = symbols.split(",")[0];

  const providers = [
    {
      name: "exchangerate.host",
      url: `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(first)}`,
      parse: (j) => j?.rates?.[first] ?? null,
    },
    {
      name: "frankfurter",
      url: `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(first)}`,
      parse: (j) => j?.rates?.[first] ?? null,
    },
    {
      name: "er-api",
      url: `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
      parse: (j) => j?.rates?.[first] ?? null,
    },
  ];

  const attempts = providers.map(async (p) => {
    try {
      const r = await timeoutFetch(
        p.url,
        { headers: { Accept: "application/json" } },
        4000,
      );
      if (!r.ok) throw new Error(`${p.name} ${r.status}`);
      const j = await r.json();
      const rate = p.parse(j);
      if (typeof rate === "number" && isFinite(rate) && rate > 0)
        return { rate, provider: p.name };
      throw new Error("invalid payload");
    } catch (e) {
      throw new Error(`${p.name}: ${e.message}`);
    }
  });

  try {
    let res;
    if (typeof Promise.any === "function") {
      res = await Promise.any(attempts);
    } else {
      res = await (async () => {
        const errs = [];
        for (const a of attempts) {
          try {
            const r = await a;
            return r;
          } catch (e) {
            errs.push(e.message);
          }
        }
        throw new Error(errs.join("; "));
      })();
    }

    return new Response(
      JSON.stringify({
        base,
        symbols: [first],
        rates: { [first]: res.rate },
        provider: res.provider,
      }),
      {
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch forex rate",
        details: e.message || String(e),
      }),
      {
        status: 502,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  }
}

async function handleWalletBalance(reqUrl, env) {
  const publicKey =
    reqUrl.searchParams.get("publicKey") ||
    reqUrl.searchParams.get("wallet") ||
    reqUrl.searchParams.get("address");
  if (!publicKey) {
    return new Response(
      JSON.stringify({ error: "Missing publicKey parameter" }),
      {
        status: 400,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  }

  const rpcCandidates = [];
  if (env && env.SOLANA_RPC_URL) rpcCandidates.push(env.SOLANA_RPC_URL);
  if (env && env.ALCHEMY_RPC_URL) rpcCandidates.push(env.ALCHEMY_RPC_URL);
  if (env && env.HELIUS_RPC_URL) rpcCandidates.push(env.HELIUS_RPC_URL);
  if (env && env.MORALIS_RPC_URL) rpcCandidates.push(env.MORALIS_RPC_URL);
  if (env && env.HELIUS_API_KEY)
    rpcCandidates.push(
      `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`,
    );
  rpcCandidates.push(...DEFAULT_RPC_FALLBACKS);

  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getBalance",
    params: [publicKey],
  };

  let lastErr = null;
  for (const endpoint of rpcCandidates) {
    try {
      const res = await timeoutFetch(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        6000,
      );
      if (!res.ok) {
        lastErr = new Error(`RPC ${endpoint} ${res.status}`);
        continue;
      }
      const j = await res.json();
      if (j.error) {
        lastErr = new Error(j.error.message || JSON.stringify(j.error));
        continue;
      }
      const balLamports = j.result?.value ?? j.result ?? j; // some RPCs differ
      const lam =
        typeof balLamports === "object" && "value" in balLamports
          ? balLamports.value
          : balLamports;
      const balanceLamports = Number(lam) ?? 0;
      const balance = balanceLamports / 1_000_000_000;
      return new Response(
        JSON.stringify({ publicKey, balance, balanceLamports }),
        { headers: { "content-type": "application/json", ...corsHeaders() } },
      );
    } catch (e) {
      lastErr = e;
      continue;
    }
  }

  return new Response(
    JSON.stringify({ error: lastErr ? lastErr.message : "All RPCs failed" }),
    {
      status: 502,
      headers: { "content-type": "application/json", ...corsHeaders() },
    },
  );
}

async function handleDexTokens(reqUrl) {
  const mints = reqUrl.searchParams.get("mints");
  if (!mints)
    return new Response(
      JSON.stringify({ error: "Missing 'mints' parameter" }),
      {
        status: 400,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  const raw = mints
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(raw));
  if (unique.length === 0)
    return new Response(JSON.stringify({ error: "No valid mints provided" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders() },
    });

  const batches = [];
  for (let i = 0; i < unique.length; i += MAX_DEX_BATCH)
    batches.push(unique.slice(i, i + MAX_DEX_BATCH));

  const results = [];
  let schemaVersion = "1.0.0";

  for (const batch of batches) {
    try {
      const path = `/tokens/${batch.join(",")}`;
      const data = await tryDexscreener(path);
      if (!data) continue;
      if (data.schemaVersion) schemaVersion = data.schemaVersion;
      if (Array.isArray(data.pairs)) results.push(...data.pairs);
    } catch (e) {
      // continue to next batch
    }
  }

  // Basic normalization: return unique pairs for Solana chain
  const dedup = new Map();
  for (const p of results) {
    const key = `${p.baseToken?.address || ""}:${p.quoteToken?.address || ""}`;
    if (!dedup.has(key)) dedup.set(key, p);
  }
  const pairs = Array.from(dedup.values()).filter(
    (p) => p.chainId === "solana",
  );

  return new Response(JSON.stringify({ schemaVersion, pairs }), {
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
}

async function handleDexSearch(reqUrl) {
  const q = reqUrl.searchParams.get("q");
  if (!q)
    return new Response(JSON.stringify({ error: "Missing 'q' parameter" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders() },
    });
  try {
    const data = await tryDexscreener(`/search/?q=${encodeURIComponent(q)}`);
    const pairs = (data?.pairs || [])
      .filter((p) => p.chainId === "solana")
      .slice(0, 20);
    return new Response(
      JSON.stringify({ schemaVersion: data?.schemaVersion || "1.0.0", pairs }),
      { headers: { "content-type": "application/json", ...corsHeaders() } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Search failed",
        details: e.message || String(e),
      }),
      {
        status: 502,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  }
}

async function handleDexPrice(reqUrl) {
  const token =
    reqUrl.searchParams.get("tokenAddress") ||
    reqUrl.searchParams.get("token") ||
    reqUrl.searchParams.get("mint");
  if (!token)
    return new Response(
      JSON.stringify({ error: "Missing tokenAddress parameter" }),
      {
        status: 400,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  try {
    const data = await tryDexscreener(`/tokens/${encodeURIComponent(token)}`);
    const price = data?.pairs?.[0]?.priceUsd ?? null;
    if (price)
      return new Response(JSON.stringify({ token, priceUsd: Number(price) }), {
        headers: { "content-type": "application/json", ...corsHeaders() },
      });
    return new Response(
      JSON.stringify({ token, priceUsd: null, message: "Price not available" }),
      {
        status: 404,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "DexScreener fetch failed",
        details: e.message || String(e),
      }),
      {
        status: 502,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  }
}

async function handleSolanaRpc(req, env) {
  // Accept JSON body and proxy to first available RPC endpoint
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders() },
    });
  }

  const candidates = [];
  if (env && env.SOLANA_RPC_URL) candidates.push(env.SOLANA_RPC_URL);
  if (env && env.ALCHEMY_RPC_URL) candidates.push(env.ALCHEMY_RPC_URL);
  if (env && env.HELIUS_RPC_URL) candidates.push(env.HELIUS_RPC_URL);
  if (env && env.MORALIS_RPC_URL) candidates.push(env.MORALIS_RPC_URL);
  if (env && env.HELIUS_API_KEY)
    candidates.push(
      `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`,
    );
  candidates.push(...DEFAULT_RPC_FALLBACKS);

  for (const endpoint of candidates) {
    try {
      const r = await timeoutFetch(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        7000,
      );
      const text = await r.text();
      return new Response(text, {
        status: r.status,
        headers: {
          "content-type": r.headers.get("content-type") || "application/json",
          ...corsHeaders(),
        },
      });
    } catch (e) {
      // try next
    }
  }
  return new Response(JSON.stringify({ error: "All RPC endpoints failed" }), {
    status: 502,
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
}

// Jupiter v6 proxy handlers
async function handleJupiterQuote(reqUrl, env) {
  const params = reqUrl.search;
  // Candidates - allow env override
  const candidates = [];
  if (env && env.JUPITER_QUOTE_BASE)
    candidates.push(normalizeBase(env.JUPITER_QUOTE_BASE) + params);
  // Common known endpoints
  candidates.push(`https://quote-api.jup.ag/v6/quote${params}`);
  candidates.push(`https://api.jup.ag/quote/v1${params}`);

  const headers = { Accept: "application/json" };
  if (env && env.JUPITER_API_KEY) headers["x-api-key"] = env.JUPITER_API_KEY;

  try {
    const result = await tryJupiter(
      candidates,
      { method: "GET", headers },
      8000,
    );
    // return result body and forward content-type
    const ct = result.headers.get("content-type") || "application/json";
    return new Response(result.body, {
      status: result.status,
      headers: { "content-type": ct, ...corsHeaders() },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch Jupiter quote",
        details: e.message || String(e),
      }),
      {
        status: 502,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  }
}

async function handleJupiterPrice(reqUrl, env) {
  const ids = reqUrl.searchParams.get("ids");
  if (!ids)
    return new Response(JSON.stringify({ error: "Missing 'ids' parameter" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders() },
    });

  const params = `?ids=${encodeURIComponent(ids)}`;
  const candidates = [];
  if (env && env.JUPITER_PRICE_BASE)
    candidates.push(normalizeBase(env.JUPITER_PRICE_BASE) + `/price${params}`);
  candidates.push(`https://price.jup.ag/v4/price${params}`);
  candidates.push(`https://api.jup.ag/price/v2${params}`);

  try {
    const result = await tryJupiter(
      candidates,
      { method: "GET", headers: { Accept: "application/json" } },
      7000,
    );
    const ct = result.headers.get("content-type") || "application/json";
    return new Response(result.body, {
      status: result.status,
      headers: { "content-type": ct, ...corsHeaders() },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch Jupiter price",
        details: e.message || String(e),
      }),
      {
        status: 502,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  }
}

async function handleJupiterSwap(req, env) {
  // Proxy POST body to Jupiter swap endpoints
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders() },
    });
  }

  const candidates = [];
  if (env && env.JUPITER_SWAP_BASE)
    candidates.push(normalizeBase(env.JUPITER_SWAP_BASE) + "/swap");
  candidates.push("https://quote-api.jup.ag/v6/swap");
  candidates.push("https://lite-api.jup.ag/swap/v1");

  const headers = { "Content-Type": "application/json" };
  if (env && env.JUPITER_API_KEY) headers["x-api-key"] = env.JUPITER_API_KEY;

  try {
    const result = await tryJupiter(
      candidates,
      { method: "POST", headers, body: JSON.stringify(body) },
      10000,
    );
    const ct = result.headers.get("content-type") || "application/json";
    return new Response(result.body, {
      status: result.status,
      headers: { "content-type": ct, ...corsHeaders() },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Failed to execute Jupiter swap",
        details: e.message || String(e),
      }),
      {
        status: 502,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  }
}

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$|^\/+/, ""); // trim leading/trailing slashes

    try {
      // Basic routing
      if (pathname === "" || pathname === "api") return handleApiRoot();
      if (pathname === "api/health") return handleHealth();
      if (pathname === "api/ping") return handlePing();

      if (pathname === "api/forex/rate") return handleForexRate(url);

      if (pathname === "api/wallet/balance" || pathname === "api/balance")
        return handleWalletBalance(url, env);

      if (pathname === "api/dexscreener/tokens") return handleDexTokens(url);
      if (pathname === "api/dexscreener/search") return handleDexSearch(url);
      if (pathname === "api/dexscreener/price") return handleDexPrice(url);

      // Jupiter v6 proxies
      if (pathname === "api/jupiter/quote" && request.method === "GET")
        return handleJupiterQuote(url, env);
      if (pathname === "api/jupiter/price" && request.method === "GET")
        return handleJupiterPrice(url, env);
      if (pathname === "api/jupiter/swap" && request.method === "POST")
        return handleJupiterSwap(request, env);

      if (pathname === "api/solana-rpc" && request.method === "POST")
        return handleSolanaRpc(request, env);

      // If unknown API route, return 404 for /api prefixed paths
      if (pathname.startsWith("api")) {
        return new Response(
          JSON.stringify({
            error: "API endpoint not found",
            path: `/${pathname}`,
          }),
          {
            status: 404,
            headers: { "content-type": "application/json", ...corsHeaders() },
          },
        );
      }

      // Fallback: serve placeholder HTML (keeps previous behavior)
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>FIXORIUM WALLET</title><style>html,body{height:100%;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,"Helvetica Neue",Arial;} .wrap{height:100%;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#f8fafc;} .card{padding:28px 36px;border-radius:16px;background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));box-shadow:0 6px 24px rgba(2,6,23,0.6);text-align:center;} h1{margin:0;font-size:34px;letter-spacing:1px;} p{margin:8px 0 0;color:rgba(248,250,252,0.8);}</style></head><body><div class="wrap"><div class="card"><h1>FIXORIUM WALLET</h1><p>Your Solana wallet dashboard (placeholder)</p></div></div></body></html>`;
      return new Response(html, {
        headers: { "content-type": "text/html; charset=UTF-8" },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "Unhandled error",
          details: (err && err.message) || String(err),
        }),
        {
          status: 500,
          headers: { "content-type": "application/json", ...corsHeaders() },
        },
      );
    }
  },
};
