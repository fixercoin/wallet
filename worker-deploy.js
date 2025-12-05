// Cloudflare Worker - serves React SPA + proxies API requests

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

// Simple in-memory cache with TTL
const responseCache = new Map();

function getCacheKey(path) {
  return `dex:${path}`;
}

function cacheGet(key) {
  const cached = responseCache.get(key);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > cached.ttl) {
    responseCache.delete(key);
    return null;
  }

  return cached.data;
}

function cacheSet(key, data, ttlMs = 30000) {
  responseCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs,
  });
}

function normalizeBase(v) {
  if (!v) return "";
  return v.replace(/\/+$|^\/+/, "");
}

function getBrowserHeaders(overrides = {}) {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
    ...overrides,
  };
}

async function timeoutFetch(url, opts = {}, ms = 12000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const defaultHeaders = getBrowserHeaders(opts.headers || {});
    const response = await fetch(url, {
      signal: controller.signal,
      ...opts,
      headers: defaultHeaders,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryDexscreener(path, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    for (const base of DEXSCREENER_BASES) {
      try {
        const url = `${base}${path}`;
        const res = await timeoutFetch(
          url,
          { headers: { Accept: "application/json" } },
          20000,
        );

        // Handle rate limiting with exponential backoff
        if (res.status === 429) {
          const retryAfter =
            res.headers.get("Retry-After") || (attempt + 1) * 2000;
          await sleep(parseInt(retryAfter) || (attempt + 1) * 2000);
          continue;
        }

        if (!res.ok) continue;
        const data = await res.json();
        return data;
      } catch (e) {
        console.error(`DexScreener error (attempt ${attempt + 1}):`, e.message);
      }
    }

    if (attempt < retries - 1) {
      await sleep((attempt + 1) * 1000);
    }
  }
  throw new Error("All DexScreener endpoints failed");
}

async function tryJupiter(
  urlCandidates,
  options = {},
  ms = 12000,
  retries = 3,
) {
  for (let attempt = 0; attempt < retries; attempt++) {
    for (const candidate of urlCandidates) {
      try {
        const res = await timeoutFetch(candidate, options, ms);
        if (!res) continue;

        // Handle rate limiting with exponential backoff
        if (res.status === 429) {
          const retryAfter =
            res.headers.get("Retry-After") || (attempt + 1) * 2000;
          await sleep(parseInt(retryAfter) || (attempt + 1) * 2000);
          continue;
        }

        const text = await res.text();
        return { status: res.status, headers: res.headers, body: text };
      } catch (e) {
        console.error(`Jupiter error (attempt ${attempt + 1}):`, e.message);
      }
    }

    if (attempt < retries - 1) {
      await sleep((attempt + 1) * 1000);
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
      const balLamports = j.result?.value ?? j.result ?? j;
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
      const cacheKey = getCacheKey(path);

      // Try cache first
      let data = cacheGet(cacheKey);

      if (!data) {
        data = await tryDexscreener(path, 2);
        if (data) {
          cacheSet(cacheKey, data, 45000); // Cache for 45 seconds
        }
      }

      if (!data) continue;
      if (data.schemaVersion) schemaVersion = data.schemaVersion;
      if (Array.isArray(data.pairs)) results.push(...data.pairs);
    } catch (e) {
      console.error(`DexTokens batch error:`, e.message);
      // continue to next batch
    }
  }

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

  let price = null;
  let source = null;

  try {
    // Try Birdeye first (primary source - most accurate)
    try {
      const birdeyeUrl = `https://public-api.birdeye.so/public/price?address=${encodeURIComponent(token)}`;
      const birdeyeRes = await timeoutFetch(
        birdeyeUrl,
        {
          headers: {
            Accept: "application/json",
            "x-chain": "solana",
          },
        },
        8000,
      );

      if (birdeyeRes.ok) {
        const birdeyeData = await birdeyeRes.json();
        if (birdeyeData?.data?.value) {
          price = Number(birdeyeData.data.value);
          source = "birdeye";
          if (isFinite(price) && price > 0) {
            return new Response(
              JSON.stringify({ token, priceUsd: price, source }),
              {
                headers: {
                  "content-type": "application/json",
                  ...corsHeaders(),
                },
              },
            );
          }
        }
      }
    } catch (e) {
      // Continue to fallback
    }

    // Fall back to DexScreener
    try {
      const dexPath = `/tokens/${encodeURIComponent(token)}`;
      const dexCacheKey = getCacheKey(dexPath);

      let dexData = cacheGet(dexCacheKey);
      if (!dexData) {
        dexData = await tryDexscreener(dexPath, 2);
        if (dexData) {
          cacheSet(dexCacheKey, dexData, 60000); // Cache for 60 seconds
        }
      }

      const dexPrice = dexData?.pairs?.[0]?.priceUsd ?? null;
      if (dexPrice) {
        price = Number(dexPrice);
        source = "dexscreener";
        if (isFinite(price) && price > 0) {
          return new Response(
            JSON.stringify({ token, priceUsd: price, source }),
            {
              headers: { "content-type": "application/json", ...corsHeaders() },
            },
          );
        }
      }
    } catch (e) {
      console.error("DexScreener fallback error:", e.message);
      // Continue to Jupiter fallback
    }

    // Fall back to Jupiter
    try {
      const jupRes = await timeoutFetch(
        `https://api.jup.ag/price?ids=${encodeURIComponent(token)}`,
        { headers: { Accept: "application/json" } },
        8000,
      );
      if (jupRes.ok) {
        const jupData = await jupRes.json();
        const jupPrice = jupData?.data?.[token]?.price ?? null;
        if (jupPrice) {
          price = Number(jupPrice);
          source = "jupiter";
          if (isFinite(price) && price > 0) {
            return new Response(
              JSON.stringify({ token, priceUsd: price, source }),
              {
                headers: {
                  "content-type": "application/json",
                  ...corsHeaders(),
                },
              },
            );
          }
        }
      }
    } catch (e) {
      // All sources failed
    }

    // If we reach here, no price was found
    return new Response(
      JSON.stringify({
        token,
        priceUsd: null,
        message: "Price not available from any source",
      }),
      {
        status: 404,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Price fetch failed",
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

async function handleSolanaSend(req, env) {
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders() },
    });
  }

  const { signedBase64 } = body || {};
  if (!signedBase64 || typeof signedBase64 !== "string") {
    return new Response(
      JSON.stringify({ error: "Missing required field: signedBase64" }),
      {
        status: 400,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  }

  const rpcBody = {
    jsonrpc: "2.0",
    id: 1,
    method: "sendTransaction",
    params: [
      signedBase64,
      { skipPreflight: false, preflightCommitment: "processed" },
    ],
  };

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

  let lastError = null;
  for (const endpoint of candidates) {
    try {
      const r = await timeoutFetch(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rpcBody),
        },
        10000,
      );
      const text = await r.text();
      const data = text ? JSON.parse(text) : {};

      if (data.result) {
        return new Response(
          JSON.stringify({
            success: true,
            result: data.result,
            signature: data.result,
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              ...corsHeaders(),
            },
          },
        );
      } else if (data.error) {
        lastError = new Error(data.error.message || JSON.stringify(data.error));
        continue;
      }
    } catch (e) {
      lastError = e;
      continue;
    }
  }

  return new Response(
    JSON.stringify({
      error: "Failed to send transaction",
      details: lastError ? lastError.message : "All RPC endpoints failed",
    }),
    {
      status: 502,
      headers: { "content-type": "application/json", ...corsHeaders() },
    },
  );
}

async function handleJupiterQuote(reqUrl, env) {
  const params = reqUrl.search;
  const candidates = [];
  if (env && env.JUPITER_QUOTE_BASE)
    candidates.push(normalizeBase(env.JUPITER_QUOTE_BASE) + params);
  candidates.push(`https://quote-api.jup.ag/v6/quote${params}`);
  candidates.push(`https://api.jup.ag/quote/v1${params}`);

  const headers = { Accept: "application/json" };
  if (env && env.JUPITER_API_KEY) headers["x-api-key"] = env.JUPITER_API_KEY;

  try {
    const result = await tryJupiter(
      candidates,
      { method: "GET", headers },
      15000,
      2,
    );
    const ct = result.headers.get("content-type") || "application/json";
    return new Response(result.body, {
      status: result.status,
      headers: { "content-type": ct, ...corsHeaders() },
    });
  } catch (e) {
    console.error("Jupiter quote error:", e.message);
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
      12000,
      2,
    );
    const ct = result.headers.get("content-type") || "application/json";
    return new Response(result.body, {
      status: result.status,
      headers: { "content-type": ct, ...corsHeaders() },
    });
  } catch (e) {
    console.error("Jupiter price error:", e.message);
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
      20000,
      2,
    );
    const ct = result.headers.get("content-type") || "application/json";
    return new Response(result.body, {
      status: result.status,
      headers: { "content-type": ct, ...corsHeaders() },
    });
  } catch (e) {
    console.error("Jupiter swap error:", e.message);
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
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$|^\/+/, "");

    try {
      if (pathname === "" || pathname === "api") return handleApiRoot();
      if (pathname === "api/health") return handleHealth();
      if (pathname === "api/ping") return handlePing();
      if (pathname === "api/forex/rate") return handleForexRate(url);
      if (pathname === "api/wallet/balance" || pathname === "api/balance")
        return handleWalletBalance(url, env);
      if (pathname === "api/dexscreener/tokens") return handleDexTokens(url);
      if (pathname === "api/dexscreener/search") return handleDexSearch(url);
      if (pathname === "api/dexscreener/price") return handleDexPrice(url);
      if (pathname === "api/jupiter/quote" && request.method === "GET")
        return handleJupiterQuote(url, env);
      if (pathname === "api/jupiter/price" && request.method === "GET")
        return handleJupiterPrice(url, env);
      if (pathname === "api/jupiter/swap" && request.method === "POST")
        return handleJupiterSwap(request, env);
      if (pathname === "api/solana-send" && request.method === "POST")
        return handleSolanaSend(request, env);
      if (pathname === "api/solana-rpc" && request.method === "POST")
        return handleSolanaRpc(request, env);

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

      // Try to serve static asset from ASSETS binding
      if (env && env.ASSETS) {
        try {
          const assetResponse = await env.ASSETS.fetch(request);
          if (assetResponse.status === 200) {
            return assetResponse;
          }
        } catch (e) {
          // continue to SPA fallback
        }
      }

      // SPA fallback: serve index.html for non-API, non-file routes
      if (!pathname.includes(".") && request.method === "GET") {
        try {
          if (env && env.ASSETS) {
            const indexResponse = await env.ASSETS.fetch(
              new URL("/index.html", request.url),
            );
            if (indexResponse.status === 200) {
              return new Response(indexResponse.body, {
                status: 200,
                headers: {
                  ...Object.fromEntries(indexResponse.headers),
                  "Content-Type": "text/html; charset=utf-8",
                  "Cache-Control": "no-cache",
                },
              });
            }
          }
        } catch (e) {
          // Fallback 404
        }
      }

      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "content-type": "application/json", ...corsHeaders() },
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
