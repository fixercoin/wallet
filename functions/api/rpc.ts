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
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
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

  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "getBalance",
    params: [publicKey],
  };

  const endpoints = Array.from(
    new Set([DEFAULT_SOLANA_RPC, ...(FALLBACK_RPC_ENDPOINTS || [])]),
  );

  let lastError = "";
  let lastStatus = 502;

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const resp = await timeoutFetch(endpoint, {
          method: "POST",
          headers: browserHeaders(),
          body: JSON.stringify(payload),
        });

        lastStatus = resp.status;

        if (resp.ok) {
          const rpcJson = await resp.json().catch(() => ({}));
          const lamports = rpcJson?.result?.value ?? 0;
          const sol = lamports / 1_000_000_000;
          return new Response(JSON.stringify({ lamports, sol, publicKey }), {
            headers: CORS_HEADERS,
          });
        }

        const text = await resp.text().catch(() => "");
        lastError = `HTTP ${resp.status}: ${text}`;

        if (resp.status >= 500) {
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
            continue;
          }
        }

        break;
      } catch (e: any) {
        lastError = String(e?.message || e);
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 300 * attempt));
          continue;
        }
      }
    }
  }

  return new Response(
    JSON.stringify({
      error: "rpc_error",
      details: lastError,
      status: lastStatus,
    }),
    { status: 502, headers: CORS_HEADERS },
  );
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

    const endpoints = [
      `${JUPITER_V6_SWAP_BASE}/swap`,
      `${JUPITER_SWAP_BASE}/swap`,
    ];

    let lastError = "";
    let lastStatus = 500;

    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await timeoutFetch(endpoint, {
            method: "POST",
            headers: browserHeaders({ Accept: "application/json" }),
            body: JSON.stringify({
              ...body,
              wrapAndUnwrapSol: body.wrapAndUnwrapSol !== false,
              useSharedAccounts: body.useSharedAccounts !== false,
              asLegacyTransaction: body.asLegacyTransaction === true,
            }),
          });

          lastStatus = response.status;
          const text = await response.text().catch(() => "");

          if (response.ok) {
            try {
              const data = JSON.parse(text || "{}");
              return new Response(JSON.stringify(data), {
                headers: CORS_HEADERS,
              });
            } catch {
              return new Response(text, { headers: CORS_HEADERS });
            }
          }

          const lower = text.toLowerCase();
          const isStaleQuote =
            lower.includes("1016") ||
            lower.includes("stale") ||
            lower.includes("simulation") ||
            lower.includes("swap simulation failed") ||
            lower.includes("quote expired");

          if (isStaleQuote) {
            return new Response(
              JSON.stringify({
                error: "STALE_QUOTE",
                message: "Quote expired - market conditions changed",
                details: text.slice(0, 300),
                code: 1016,
              }),
              { status: 530, headers: CORS_HEADERS },
            );
          }

          lastError = text;

          if (response.status === 429 || response.status >= 500) {
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 750 * attempt));
              continue;
            }
          }

          break; // Non-retryable, try next endpoint
        } catch (e: any) {
          lastError = String(e?.message || e);
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
            continue;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        error: "Swap failed",
        details: lastError || "Unknown error",
        statusCode: lastStatus,
      }),
      { status: lastStatus >= 400 ? lastStatus : 502, headers: CORS_HEADERS },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: "Failed to create swap",
        details: String(e?.message || e),
      }),
      { status: 502, headers: CORS_HEADERS },
    );
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

async function handlePumpFunQuote(
  request: Request,
  url: URL,
): Promise<Response> {
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

async function handlePumpFunTrade(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));

    if (
      !body.mint ||
      typeof body.amount !== "number" ||
      !body.trader ||
      !body.action
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Missing required fields: mint, amount (number), trader, action (buy/sell)",
        }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const action = String(body.action).toLowerCase();
    if (!["buy", "sell"].includes(action)) {
      return new Response(
        JSON.stringify({
          error: 'Action must be "buy" or "sell"',
        }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const tradeBody = {
      mint: body.mint,
      amount: body.amount,
      [action === "buy" ? "buyer" : "seller"]: body.trader,
      slippageBps: body.slippageBps || 350,
      priorityFeeLamports: body.priorityFeeLamports || 10000,
    };

    const response = await timeoutFetch(`${PUMPFUN_API_BASE}/trade`, {
      method: "POST",
      headers: browserHeaders(),
      body: JSON.stringify(tradeBody),
    });

    const data = await safeJson(response);
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: CORS_HEADERS,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: "Failed to execute trade",
        details: String(e?.message || e),
      }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

async function handlePumpFunSwap(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));

    if (!body.mint || !body.amount) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: mint, amount",
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
        error: "Failed to execute swap",
        details: String(e?.message || e),
      }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

async function handleDexscreenerPrice(url: URL): Promise<Response> {
  const tokenAddress =
    url.searchParams.get("tokenAddress") ||
    url.searchParams.get("mint") ||
    url.searchParams.get("token");

  if (!tokenAddress) {
    return new Response(
      JSON.stringify({
        error: "tokenAddress (or mint/token) parameter required",
        example: "/api/dexscreener/price?tokenAddress=<mint>",
      }),
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

    const price = Number(solPrice);
    const priceChange24h =
      data?.data?.[SOL_MINT]?.priceChange24h ??
      data?.data?.[SOL_MINT]?.price_change_24h ??
      null;
    const marketCap =
      data?.data?.[SOL_MINT]?.marketCap ??
      data?.data?.[SOL_MINT]?.market_cap ??
      null;
    const volume24h =
      data?.data?.[SOL_MINT]?.volume24h ??
      data?.data?.[SOL_MINT]?.volume_24h ??
      null;

    return new Response(
      JSON.stringify({
        price,
        price_change_24h: priceChange24h,
        market_cap: marketCap,
        volume_24h: volume24h,
        token: "SOL",
        mint: SOL_MINT,
        priceUsd: price,
        solana: {
          usd: price,
          usd_24h_change: priceChange24h,
          usd_market_cap: marketCap,
          usd_24h_vol: volume24h,
        },
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
  const TOKEN_MINTS: Record<string, string> = {
    SOL: "So11111111111111111111111111111111111111112",
    USDC: "EPjFWdd5Au7BXRSpJfDw3gEPrwwAau4vTNihtQ5go5Q",
    USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
    FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
    LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
    FXM: "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump",
  };

  const FALLBACK_PRICES: Record<string, number> = {
    USDC: 1.0,
    USDT: 1.0,
    FIXERCOIN: 0.00008139,
    SOL: 149.38,
    LOCKER: 0.00001112,
    FXM: 0.000003567,
  };

  const PKR_CONVERSION = 291.9; // 1 USD = ~291.90 PKR

  let mint = url.searchParams.get("mint");
  let token = url.searchParams.get("token")?.toUpperCase();
  let tokenSymbol = url.searchParams.get("symbol")?.toUpperCase() || token;

  // Resolve token to mint
  if (!mint && token && TOKEN_MINTS[token]) {
    mint = TOKEN_MINTS[token];
    tokenSymbol = token;
  } else if (!mint && tokenSymbol && TOKEN_MINTS[tokenSymbol]) {
    mint = TOKEN_MINTS[tokenSymbol];
  }

  if (!mint && !tokenSymbol) {
    return new Response(
      JSON.stringify({
        error: "mint, token, or symbol parameter required",
      }),
      { status: 400, headers: CORS_HEADERS },
    );
  }

  tokenSymbol = tokenSymbol || "UNKNOWN";

  try {
    // For stablecoins, return hardcoded price immediately
    if (tokenSymbol === "USDC" || tokenSymbol === "USDT") {
      const priceUsd = 1.0;
      const priceInPKR = priceUsd * PKR_CONVERSION;
      return new Response(
        JSON.stringify({
          token: tokenSymbol,
          mint,
          rate: priceInPKR,
          priceInPKR,
          priceUsd,
          source: "stablecoin",
          timestamp: new Date().toISOString(),
        }),
        { headers: CORS_HEADERS },
      );
    }

    const fetchMint = mint || TOKEN_MINTS.SOL;
    const response = await timeoutFetch(
      `${JUPITER_PRICE_BASE}/price?ids=${fetchMint}`,
      {
        method: "GET",
        headers: browserHeaders(),
      },
      10000,
    );

    if (!response.ok) {
      // Return fallback price if API fails
      const fallbackPrice = FALLBACK_PRICES[tokenSymbol];
      if (fallbackPrice !== undefined) {
        const priceInPKR = fallbackPrice * PKR_CONVERSION;
        return new Response(
          JSON.stringify({
            token: tokenSymbol,
            mint: fetchMint,
            rate: priceInPKR,
            priceInPKR,
            priceUsd: fallbackPrice,
            source: "fallback",
            timestamp: new Date().toISOString(),
          }),
          { headers: CORS_HEADERS },
        );
      }

      return new Response(
        JSON.stringify({
          error: "Failed to fetch token price",
          token: tokenSymbol,
        }),
        { status: 502, headers: CORS_HEADERS },
      );
    }

    const data = await response.json();
    const price = data?.data?.[fetchMint]?.price ?? null;

    if (price === null || price === undefined) {
      // Return fallback price
      const fallbackPrice = FALLBACK_PRICES[tokenSymbol];
      if (fallbackPrice !== undefined) {
        const priceInPKR = fallbackPrice * PKR_CONVERSION;
        return new Response(
          JSON.stringify({
            token: tokenSymbol,
            mint: fetchMint,
            rate: priceInPKR,
            priceInPKR,
            priceUsd: fallbackPrice,
            source: "fallback",
            timestamp: new Date().toISOString(),
          }),
          { headers: CORS_HEADERS },
        );
      }

      return new Response(
        JSON.stringify({
          error: "Token price not available",
          token: tokenSymbol,
        }),
        { status: 502, headers: CORS_HEADERS },
      );
    }

    const priceInPKR = price * PKR_CONVERSION;
    return new Response(
      JSON.stringify({
        token: tokenSymbol,
        mint: fetchMint,
        rate: priceInPKR,
        priceInPKR,
        priceUsd: price,
        source: "jupiter",
        timestamp: new Date().toISOString(),
      }),
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    // Return fallback on error
    const fallbackPrice = FALLBACK_PRICES[tokenSymbol];
    if (fallbackPrice !== undefined) {
      const priceInPKR = fallbackPrice * PKR_CONVERSION;
      return new Response(
        JSON.stringify({
          token: tokenSymbol,
          mint: mint || TOKEN_MINTS[tokenSymbol],
          rate: priceInPKR,
          priceInPKR,
          priceUsd: fallbackPrice,
          source: "fallback",
          error: "API failed, using fallback",
          timestamp: new Date().toISOString(),
        }),
        { headers: CORS_HEADERS },
      );
    }

    return new Response(
      JSON.stringify({
        error: "Failed to fetch token price",
        details: String(e?.message || e),
        token: tokenSymbol,
      }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

async function handleSolanaRpc(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));

    if (!body || typeof body !== "object" || !body.method || !body.params) {
      return new Response(
        JSON.stringify({
          error: "Invalid JSON-RPC request",
          message: "Provide method and params in JSON body",
          example: {
            jsonrpc: "2.0",
            id: 1,
            method: "getBalance",
            params: ["11111111111111111111111111111111"],
          },
        }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const rpcUrl = DEFAULT_SOLANA_RPC;
    const response = await timeoutFetch(rpcUrl, {
      method: "POST",
      headers: browserHeaders(),
      body: JSON.stringify(body),
    });

    const responseBody = await response.text().catch(() => "");
    return new Response(responseBody, {
      status: response.status,
      headers: CORS_HEADERS,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: "RPC error",
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

    // Root API endpoint
    if (pathname === "/" || pathname === "/api" || pathname === "/api/") {
      return new Response(
        JSON.stringify({
          ok: true,
          service: "Fixorium Wallet API (Cloudflare)",
          status: "operational",
          timestamp: new Date().toISOString(),
          endpoints: [
            "/api/health - Health check endpoint",
            "/api/ping - Simple ping endpoint",
            "/api/wallet/balance?publicKey=<address> - Get SOL balance",
            "/api/wallet/tokens?publicKey=<address> - Get token accounts",
            "/api/dexscreener/price?tokenAddress=<mint> - Get token price",
            "/api/jupiter/price?ids=<mint> - Get Jupiter price",
            "/api/jupiter/quote - Get swap quote",
            "/api/pumpfun/quote - Get PumpFun quote",
            "/api/solana-rpc - Proxy RPC calls",
          ],
        }),
        { headers: CORS_HEADERS },
      );
    }

    if (
      pathname === "/health" ||
      pathname === "/api/health" ||
      pathname === "/status" ||
      pathname === "/api/status"
    ) {
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

    if (pathname === "/api/dexscreener" || pathname === "/api/dexscreener/") {
      return new Response(
        JSON.stringify({
          status: "ok",
          message: "DexScreener API Proxy",
          endpoints: ["/api/dexscreener/price?tokenAddress=<mint>"],
        }),
        { headers: CORS_HEADERS },
      );
    }

    if (pathname.startsWith("/api/dexscreener/price")) {
      return await handleDexscreenerPrice(url);
    }

    if (pathname === "/api/solana-rpc" || pathname === "/api/solana-rpc/") {
      return await handleSolanaRpc(request);
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

    if (
      pathname === "/api/jupiter/token" ||
      pathname === "/api/jupiter/token/"
    ) {
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

    if (pathname === "/api/pumpfun/trade") {
      return await handlePumpFunTrade(request);
    }

    if (pathname === "/api/pumpfun/swap") {
      return await handlePumpFunSwap(request);
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

export const onRequest = handler;
