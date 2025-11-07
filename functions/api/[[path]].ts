export const config = {
  runtime: "nodejs_esmsh",
};

const DEFAULT_SOLANA_RPC = "https://solana.publicnode.com";
const FALLBACK_RPC_ENDPOINTS = [
  "https://solana.publicnode.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
];

const PUMPFUN_API_BASE = "https://pump.fun/api";
const PUMPFUN_QUOTE = "https://pumpportal.fun/api/quote";
const PUMPFUN_TRADE = "https://pumpportal.fun/api/trade";
const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex";
const DEXSCREENER_IO = "https://api.dexscreener.io/latest/dex";
const JUPITER_PRICE_BASE = "https://price.jup.ag/v4";
const JUPITER_SWAP_BASE = "https://lite-api.jup.ag/swap/v1";
const JUPITER_V6_SWAP_BASE = "https://quote-api.jup.ag/v6";
const JUPITER_TOKENS_BASE = "https://token.jup.ag";
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

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

async function handleWalletBalance(url: URL): Promise<Response> {
  const publicKey = url.searchParams.get("publicKey");
  if (!publicKey) {
    return new Response(JSON.stringify({ error: "publicKey required" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const SOLANA_RPC = DEFAULT_SOLANA_RPC;
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

async function handleWalletTokens(url: URL): Promise<Response> {
  const publicKey = url.searchParams.get("publicKey");
  if (!publicKey) {
    return new Response(JSON.stringify({ error: "publicKey required" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const SOLANA_RPC = DEFAULT_SOLANA_RPC;
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
    const j = await safeJson(r);
    return new Response(JSON.stringify({ data: j }), { headers: CORS_HEADERS });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 502,
      headers: CORS_HEADERS,
    });
  }
}

async function handleJupiterQuote(url: URL): Promise<Response> {
  const { inputMint, outputMint, amount, slippageBps, asLegacyTransaction } =
    Object.fromEntries(url.searchParams);

  if (!inputMint || !outputMint || !amount) {
    return new Response(
      JSON.stringify({
        error: "Missing required query params: inputMint, outputMint, amount",
      }),
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps: slippageBps || "50",
    onlyDirectRoutes: "false",
    asLegacyTransaction: asLegacyTransaction || "false",
  });

  const urls = [
    `${JUPITER_V6_SWAP_BASE}/quote?${params.toString()}`,
    `${JUPITER_SWAP_BASE}/quote?${params.toString()}`,
  ];

  for (const fetchUrl of urls) {
    try {
      const response = await timeoutFetch(fetchUrl, {
        method: "GET",
        headers: browserHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: CORS_HEADERS });
      }

      if (response.status === 404 || response.status === 400) {
        return new Response(
          JSON.stringify({
            error: "No swap route found for this pair",
            code: response.status === 404 ? "NO_ROUTE_FOUND" : "INVALID_PARAMS",
          }),
          { status: response.status, headers: CORS_HEADERS },
        );
      }

      if (response.status === 429 || response.status >= 500) {
        continue;
      }

      const text = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${text}`);
    } catch (e: any) {
      continue;
    }
  }

  return new Response(
    JSON.stringify({ error: "Quote API error", code: "API_ERROR" }),
    { status: 500, headers: CORS_HEADERS },
  );
}

async function handleJupiterSwap(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));

    if (!body || !body.quoteResponse || !body.userPublicKey) {
      return new Response(
        JSON.stringify({
          error:
            "Missing required body: { quoteResponse, userPublicKey, ...options }",
        }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const response = await timeoutFetch(`${JUPITER_V6_SWAP_BASE}/swap`, {
      method: "POST",
      headers: browserHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return new Response(
        JSON.stringify({
          error: `Swap failed: ${response.statusText}`,
          details: text,
        }),
        { status: response.status, headers: CORS_HEADERS },
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), { headers: CORS_HEADERS });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}

async function handleJupiterPrice(url: URL): Promise<Response> {
  const ids = url.searchParams.get("ids");

  if (!ids) {
    return new Response(
      JSON.stringify({
        error: "Missing 'ids' parameter. Expected comma-separated token mints.",
      }),
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const endpoints = [
    `${JUPITER_PRICE_BASE}/price?ids=${ids}`,
    `https://api.jup.ag/price/v2?ids=${ids}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await timeoutFetch(endpoint, {
        method: "GET",
        headers: browserHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: CORS_HEADERS });
      }

      if (response.status === 429) continue;
    } catch (e) {
      continue;
    }
  }

  return new Response(JSON.stringify({ error: "Price API error", data: {} }), {
    status: 500,
    headers: CORS_HEADERS,
  });
}

async function handleJupiterTokens(url: URL): Promise<Response> {
  const type = url.searchParams.get("type") || "strict";

  const endpoints = [
    `https://token.jup.ag/${type}`,
    "https://cache.jup.ag/tokens",
    "https://token.jup.ag/all",
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await timeoutFetch(endpoint, {
        method: "GET",
        headers: browserHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: CORS_HEADERS });
      }

      if (response.status === 429 || response.status >= 500) {
        continue;
      }
    } catch (e) {
      continue;
    }
  }

  return new Response(JSON.stringify({ error: "Tokens API error", data: [] }), {
    status: 502,
    headers: CORS_HEADERS,
  });
}

async function handlePumpFunCurve(url: URL): Promise<Response> {
  const mint = url.searchParams.get("mint");
  if (!mint) {
    return new Response(JSON.stringify({ error: "mint parameter required" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  try {
    const response = await timeoutFetch(
      `${PUMPFUN_API_BASE}/curve/${encodeURIComponent(mint)}`,
      {
        method: "GET",
        headers: browserHeaders(),
      },
    );

    const data = await safeJson(response);
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: CORS_HEADERS,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: "Failed to check curve state",
        details: String(e?.message || e),
      }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

async function handlePumpFunBuy(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));

    if (!body.mint || typeof body.amount !== "number" || !body.buyer) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: mint, amount (number), buyer",
        }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const response = await timeoutFetch(`${PUMPFUN_API_BASE}/trade`, {
      method: "POST",
      headers: browserHeaders(),
      body: JSON.stringify(body),
    });

    const data = await safeJson(response);
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: CORS_HEADERS,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: "Failed to request BUY transaction",
        details: String(e?.message || e),
      }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

async function handlePumpFunSell(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));

    if (!body.mint || typeof body.amount !== "number" || !body.seller) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: mint, amount (number), seller",
        }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const response = await timeoutFetch(`${PUMPFUN_API_BASE}/sell`, {
      method: "POST",
      headers: browserHeaders(),
      body: JSON.stringify(body),
    });

    const data = await safeJson(response);
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: CORS_HEADERS,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: "Failed to request SELL transaction",
        details: String(e?.message || e),
      }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

async function handlePumpFunQuote(request: Request, url: URL): Promise<Response> {
  try {
    let body: any = {};
    const method = request.method?.toUpperCase?.() || "GET";

    if (method === "GET" || method === "HEAD") {
      const inputMint = url.searchParams.get("inputMint");
      const outputMint = url.searchParams.get("outputMint");
      const amount = url.searchParams.get("amount");
      const mint = url.searchParams.get("mint");

      if (inputMint) body.inputMint = inputMint;
      if (outputMint) body.outputMint = outputMint;
      if (amount) body.amount = amount;
      if (mint) body.mint = mint;
    } else {
      body = await request.json().catch(() => ({}));
    }

    const response = await timeoutFetch(PUMPFUN_QUOTE, {
      method: "POST",
      headers: browserHeaders(),
      body: JSON.stringify(body),
    });

    const text = await response.text().catch(() => "");
    return new Response(text, {
      status: response.status,
      headers: CORS_HEADERS,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: e?.message?.includes?.("abort")
          ? "Request timeout"
          : "Failed to fetch PumpFun quote",
        details: String(e?.message || e),
      }),
      { status: 503, headers: CORS_HEADERS },
    );
  }
}

async function handleDexscreenerPrice(url: URL): Promise<Response> {
  const tokenAddress = url.searchParams.get("tokenAddress");
  
  if (!tokenAddress) {
    return new Response(
      JSON.stringify({ error: "tokenAddress parameter required" }),
      { status: 400, headers: CORS_HEADERS },
    );
  }

  try {
    const response = await timeoutFetch(
      `${DEXSCREENER_BASE}/tokens/${tokenAddress}`,
      {
        method: "GET",
        headers: browserHeaders(),
      },
    );

    const data = await safeJson(response);
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: CORS_HEADERS,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch price from DexScreener",
        details: String(e?.message || e),
      }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

async function handleSolPrice(): Promise<Response> {
  const SOL_MINT = "So11111111111111111111111111111111111111112";
  
  try {
    const response = await timeoutFetch(
      `${JUPITER_PRICE_BASE}/price?ids=${SOL_MINT}`,
      {
        method: "GET",
        headers: browserHeaders(),
      },
    );

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch SOL price" }),
        { status: response.status, headers: CORS_HEADERS },
      );
    }

    const data = await response.json();
    const solPrice = data?.data?.[SOL_MINT]?.price ?? null;

    if (!solPrice) {
      return new Response(
        JSON.stringify({ error: "SOL price not available" }),
        { status: 502, headers: CORS_HEADERS },
      );
    }

    return new Response(
      JSON.stringify({
        token: "SOL",
        mint: SOL_MINT,
        priceUsd: solPrice,
        timestamp: new Date().toISOString(),
      }),
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch SOL price",
        details: String(e?.message || e),
      }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

async function handleTokenPrice(url: URL): Promise<Response> {
  const mint = url.searchParams.get("mint");
  const tokenSymbol = url.searchParams.get("symbol") || "FIXERCOIN";

  if (!mint && !tokenSymbol) {
    return new Response(
      JSON.stringify({
        error: "mint or symbol parameter required",
      }),
      { status: 400, headers: CORS_HEADERS },
    );
  }

  try {
    const fetchMint = mint || "So11111111111111111111111111111111111111112";
    const response = await timeoutFetch(
      `${JUPITER_PRICE_BASE}/price?ids=${fetchMint}`,
      {
        method: "GET",
        headers: browserHeaders(),
      },
    );

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch token price" }),
        { status: response.status, headers: CORS_HEADERS },
      );
    }

    const data = await response.json();
    const price = data?.data?.[fetchMint]?.price ?? null;

    if (price === null) {
      return new Response(
        JSON.stringify({ error: "Token price not available" }),
        { status: 502, headers: CORS_HEADERS },
      );
    }

    return new Response(
      JSON.stringify({
        token: tokenSymbol,
        mint: fetchMint,
        priceUsd: price,
        timestamp: new Date().toISOString(),
      }),
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch token price",
        details: String(e?.message || e),
      }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

async function handler(request: Request): Promise<Response> {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname || "/";

    console.log(`[API Handler] ${request.method} ${pathname}`);

    if (pathname === "/health" || pathname === "/api/health") {
      return await handleHealth();
    }

    if (
      pathname.startsWith("/api/wallet/balance") ||
      pathname === "/wallet/balance"
    ) {
      return await handleWalletBalance(url);
    }

    if (
      pathname.startsWith("/api/wallet/tokens") ||
      pathname === "/wallet/tokens"
    ) {
      return await handleWalletTokens(url);
    }

    if (pathname.startsWith("/api/price") || pathname === "/price") {
      return await handlePrice(url);
    }

    if (pathname === "/api/sol/price") {
      return await handleSolPrice();
    }

    if (pathname === "/api/token/price") {
      return await handleTokenPrice(url);
    }

    if (pathname.startsWith("/api/dexscreener/price")) {
      return await handleDexscreenerPrice(url);
    }

    if (pathname.startsWith("/api/jupiter/quote")) {
      return await handleJupiterQuote(url);
    }

    if (pathname.startsWith("/api/jupiter/swap")) {
      return await handleJupiterSwap(request);
    }

    if (pathname.startsWith("/api/jupiter/price")) {
      return await handleJupiterPrice(url);
    }

    if (pathname.startsWith("/api/jupiter/tokens")) {
      return await handleJupiterTokens(url);
    }

    if (pathname === "/api/pumpfun/quote") {
      return await handlePumpFunQuote(request, url);
    }

    if (
      pathname === "/api/pumpfun/curve" ||
      pathname.startsWith("/api/pumpfun/curve?")
    ) {
      return await handlePumpFunCurve(url);
    }

    if (pathname === "/api/pumpfun/buy") {
      return await handlePumpFunBuy(request);
    }

    if (pathname === "/api/pumpfun/sell") {
      return await handlePumpFunSell(request);
    }

    return new Response(
      JSON.stringify({
        error: "API endpoint not found",
        path: pathname,
        message:
          "This endpoint has not been implemented. Please check the API documentation.",
      }),
      {
        status: 404,
        headers: CORS_HEADERS,
      },
    );
  } catch (err: any) {
    console.error("API handler error:", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: String(err?.message || err),
      }),
      {
        status: 500,
        headers: CORS_HEADERS,
      },
    );
  }
}

export default handler;
