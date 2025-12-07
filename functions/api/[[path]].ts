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
  ms = 30000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const init = { ...options, signal: controller.signal };
  return fetch(resource, init)
    .then((response) => {
      clearTimeout(timer);
      return response;
    })
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

  // Build ordered list of endpoints to try (unique)
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
          const balance = lamports / 1_000_000_000;
          return new Response(
            JSON.stringify({ balance, lamports, publicKey }),
            {
              headers: CORS_HEADERS,
            },
          );
        }

        // Non-OK response
        const text = await resp.text().catch(() => "");
        lastError = `HTTP ${resp.status}: ${text}`;

        // Retry on server errors
        if (resp.status >= 500) {
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
            continue;
          }
        }

        // Not retryable, break to next endpoint
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

  // All endpoints failed
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
    `https://api.jup.ag/quote/v1?${params.toString()}`,
  ];

  let lastError: string = "";
  let lastStatus: number = 500;

  for (let urlIdx = 0; urlIdx < urls.length; urlIdx++) {
    const fetchUrl = urls[urlIdx];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(
          `[Jupiter Quote] Attempt ${attempt}/2 for URL ${urlIdx + 1}/${urls.length}: ${fetchUrl.split("?")[0]}`,
        );

        const response = await timeoutFetch(fetchUrl, {
          method: "GET",
          headers: browserHeaders(),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`[Jupiter Quote] Success on attempt ${attempt}`);
          return new Response(JSON.stringify(data), { headers: CORS_HEADERS });
        }

        lastStatus = response.status;

        if (response.status === 404 || response.status === 400) {
          const text = await response.text().catch(() => "");
          lastError = `HTTP ${response.status}: ${text}`;
          console.warn(
            `[Jupiter Quote] No route or invalid params (${response.status}): ${text}`,
          );
          return new Response(
            JSON.stringify({
              error: "No swap route found for this pair",
              code:
                response.status === 404 ? "NO_ROUTE_FOUND" : "INVALID_PARAMS",
            }),
            { status: response.status, headers: CORS_HEADERS },
          );
        }

        if (response.status === 429) {
          lastError = "Rate limited";
          console.warn(`[Jupiter Quote] Rate limited (429)`);
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
            continue;
          }
          break;
        }

        if (response.status >= 500) {
          lastError = `Server error ${response.status}`;
          console.warn(`[Jupiter Quote] Server error (${response.status})`);
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
            continue;
          }
          break;
        }

        const text = await response.text().catch(() => "");
        lastError = `HTTP ${response.status}: ${text}`;
        console.warn(`[Jupiter Quote] Unexpected status ${response.status}`);
        break;
      } catch (e: any) {
        lastError = String(e?.message || e);
        console.error(
          `[Jupiter Quote] Fetch error on attempt ${attempt}/${2}: ${lastError}`,
        );
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
      }
    }
  }

  console.error(
    `[Jupiter Quote] All attempts failed. Last error: ${lastError}`,
  );
  return new Response(
    JSON.stringify({
      error: "Quote API error",
      code: "API_ERROR",
      details: lastError,
      statusCode: lastStatus,
    }),
    { status: 502, headers: CORS_HEADERS },
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

    // Build swap request with proper defaults (matching server implementation)
    const swapRequest = {
      quoteResponse: body.quoteResponse,
      userPublicKey: body.userPublicKey,
      wrapAndUnwrapSol:
        body.wrapAndUnwrapSol !== undefined ? body.wrapAndUnwrapSol : true,
      useSharedAccounts:
        body.useSharedAccounts !== undefined ? body.useSharedAccounts : true,
      computeUnitPriceMicroLamports: body.computeUnitPriceMicroLamports,
      prioritizationFeeLamports: body.prioritizationFeeLamports,
      asLegacyTransaction: body.asLegacyTransaction || false,
      ...body,
    };

    const endpoints = [
      `${JUPITER_SWAP_BASE}/swap`,
      `${JUPITER_V6_SWAP_BASE}/swap`,
    ];

    let lastError = "";
    let lastStatus = 500;

    for (let idx = 0; idx < endpoints.length; idx++) {
      const endpoint = endpoints[idx];
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(
            `[Jupiter Swap] Attempt ${attempt}/2, Endpoint ${idx + 1}/${endpoints.length}: ${endpoint}`,
          );

          const response = await timeoutFetch(endpoint, {
            method: "POST",
            headers: browserHeaders({ Accept: "application/json" }),
            body: JSON.stringify(swapRequest),
          });

          lastStatus = response.status;
          const text = await response.text().catch(() => "");

          if (response.ok) {
            try {
              const data = JSON.parse(text || "{}");
              console.log(`[Jupiter Swap] Success on attempt ${attempt}`);
              return new Response(JSON.stringify(data), {
                headers: CORS_HEADERS,
              });
            } catch {
              console.warn("[Jupiter Swap] Non-JSON success payload");
              return new Response(text, { headers: CORS_HEADERS });
            }
          }

          // Parse error response
          let errorData: any = {};
          try {
            errorData = JSON.parse(text);
          } catch {}

          const lower = (text || "").toLowerCase();
          const isStaleQuote =
            lower.includes("1016") ||
            lower.includes("stale") ||
            lower.includes("simulation") ||
            lower.includes("swap simulation failed") ||
            lower.includes("quote expired") ||
            errorData?.code === 1016;

          if (isStaleQuote) {
            console.warn(
              `[Jupiter Swap] Detected stale quote (1016) from ${endpoint}`,
            );
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

          // Check for other client errors that shouldn't be retried
          if (
            response.status === 400 ||
            response.status === 401 ||
            response.status === 403
          ) {
            console.warn(
              `[Jupiter Swap] Client error (${response.status}), not retrying`,
            );
            return new Response(
              JSON.stringify({
                error: `Swap request failed: ${response.statusText}`,
                details: text,
                code: "SWAP_REQUEST_ERROR",
              }),
              { status: response.status, headers: CORS_HEADERS },
            );
          }

          lastError = text;

          if (response.status === 429 || response.status >= 500) {
            console.warn(
              `[Jupiter Swap] Retryable error (${response.status}), retrying...`,
            );
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 1000 * attempt));
              continue;
            }
          }

          console.warn(
            `[Jupiter Swap] Non-retryable error (${response.status}), trying next endpoint`,
          );
          break;
        } catch (e: any) {
          lastError = String(e?.message || e);
          console.error(
            `[Jupiter Swap] Fetch error on attempt ${attempt}/${2}: ${lastError}`,
          );
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
            continue;
          }
        }
      }
    }

    console.error(
      `[Jupiter Swap] All endpoints failed. Last error: ${lastError}`,
    );
    return new Response(
      JSON.stringify({
        error: "Swap failed",
        details: lastError || "Unknown error",
        statusCode: lastStatus,
      }),
      { status: lastStatus >= 400 ? lastStatus : 502, headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error(`[Jupiter Swap] Exception: ${e?.message || e}`);
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
    `https://public-api.birdeye.so/public/token/price?list_address=${ids}`,
  ];

  let lastError = "";

  for (let idx = 0; idx < endpoints.length; idx++) {
    const endpoint = endpoints[idx];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(
          `[Jupiter Price] Attempt ${attempt}/2, Endpoint ${idx + 1}/${endpoints.length}`,
        );

        const response = await timeoutFetch(endpoint, {
          method: "GET",
          headers: browserHeaders(),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`[Jupiter Price] Success on attempt ${attempt}`);
          return new Response(JSON.stringify(data), { headers: CORS_HEADERS });
        }

        lastError = `HTTP ${response.status}`;

        if (response.status === 429) {
          console.warn(`[Jupiter Price] Rate limited (429)`);
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
            continue;
          }
        }

        if (response.status >= 500) {
          console.warn(`[Jupiter Price] Server error (${response.status})`);
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
            continue;
          }
        }

        console.warn(
          `[Jupiter Price] Non-OK response (${response.status}), trying next endpoint`,
        );
        break;
      } catch (e: any) {
        lastError = String(e?.message || e);
        console.error(
          `[Jupiter Price] Fetch error on attempt ${attempt}/${2}: ${lastError}`,
        );
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
      }
    }
  }

  console.error(
    `[Jupiter Price] All endpoints failed. Last error: ${lastError}`,
  );
  return new Response(
    JSON.stringify({
      error: "Price API error",
      data: {},
      details: lastError,
    }),
    { status: 502, headers: CORS_HEADERS },
  );
}

async function handleJupiterTokens(url: URL): Promise<Response> {
  const type = url.searchParams.get("type") || "strict";

  const endpoints = [
    `https://token.jup.ag/${type}`,
    "https://cache.jup.ag/tokens",
    "https://token.jup.ag/all",
  ];

  let lastError = "";

  for (let idx = 0; idx < endpoints.length; idx++) {
    const endpoint = endpoints[idx];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(
          `[Jupiter Tokens] Attempt ${attempt}/2, Endpoint ${idx + 1}/${endpoints.length}`,
        );

        const response = await timeoutFetch(endpoint, {
          method: "GET",
          headers: browserHeaders(),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`[Jupiter Tokens] Success on attempt ${attempt}`);
          return new Response(JSON.stringify(data), { headers: CORS_HEADERS });
        }

        lastError = `HTTP ${response.status}`;

        if (response.status === 429 || response.status >= 500) {
          console.warn(
            `[Jupiter Tokens] Retryable error (${response.status}), trying next endpoint`,
          );
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
            continue;
          }
        }

        console.warn(
          `[Jupiter Tokens] Non-OK response (${response.status}), trying next endpoint`,
        );
        break;
      } catch (e: any) {
        lastError = String(e?.message || e);
        console.error(
          `[Jupiter Tokens] Fetch error on attempt ${attempt}/${2}: ${lastError}`,
        );
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
      }
    }
  }

  console.error(
    `[Jupiter Tokens] All endpoints failed. Last error: ${lastError}`,
  );
  return new Response(
    JSON.stringify({
      error: "Tokens API error",
      data: [],
      details: lastError,
    }),
    { status: 502, headers: CORS_HEADERS },
  );
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

async function handleDexscreenerTokens(url: URL): Promise<Response> {
  try {
    const mintsParam = url.searchParams.get("mints");
    if (!mintsParam || typeof mintsParam !== "string") {
      return new Response(
        JSON.stringify({
          error:
            "Missing or invalid 'mints' parameter. Expected comma-separated token mints.",
        }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const rawMints = mintsParam
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    const uniqueMints = Array.from(new Set(rawMints));

    if (uniqueMints.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid mints provided" }),
        {
          status: 400,
          headers: CORS_HEADERS,
        },
      );
    }

    console.log(
      `[DexScreener Tokens] Requesting data for mints: ${uniqueMints.join(", ")}`,
    );

    const MAX_TOKENS_PER_BATCH = 20;
    const batches: string[][] = [];
    for (let i = 0; i < uniqueMints.length; i += MAX_TOKENS_PER_BATCH) {
      batches.push(uniqueMints.slice(i, i + MAX_TOKENS_PER_BATCH));
    }

    const endpoints = [DEXSCREENER_BASE, DEXSCREENER_IO];
    const results: any[] = [];
    let schemaVersion = "1.0.0";

    for (const batch of batches) {
      let success = false;
      const path = `/tokens/${encodeURIComponent(batch.join(","))}`;

      for (const base of endpoints) {
        try {
          const resp = await timeoutFetch(`${base}${path}`, {
            method: "GET",
            headers: browserHeaders(),
          });
          if (!resp.ok) {
            console.warn(
              `[DexScreener] Endpoint ${base} returned status ${resp.status}`,
            );
            continue;
          }
          const data = await safeJson(resp);
          if (data?.schemaVersion) schemaVersion = data.schemaVersion;
          if (Array.isArray(data?.pairs)) {
            console.log(
              `[DexScreener] Got ${data.pairs.length} pairs from ${base}`,
            );
            results.push(...data.pairs);
          }
          success = true;
          break;
        } catch (e) {
          console.warn(
            `[DexScreener] Error fetching from ${base}:`,
            e instanceof Error ? e.message : String(e),
          );
          continue;
        }
      }
      if (!success) {
        console.warn(`[DexScreener] Failed to fetch batch: ${batch.join(",")}`);
      }
    }

    // Deduplicate and filter to Solana
    const seen = new Set<string>();
    const pairs = results
      .filter((p: any) => {
        // More flexible chain matching - handle various chainId formats
        const chainId = (p?.chainId || "").toLowerCase().trim();
        const isValidChain =
          chainId === "solana" || chainId === "sol" || chainId === "";
        if (!isValidChain) {
          console.debug(
            `[DexScreener] Filtering out pair with chainId: ${p?.chainId}`,
          );
        }
        return isValidChain;
      })
      .filter((p: any) => {
        const key = `${p?.baseToken?.address || ""}:${p?.quoteToken?.address || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    console.log(
      `[DexScreener Tokens] Processed ${results.length} results, returning ${pairs.length} Solana pairs. Requested: ${uniqueMints.join(", ")}`,
    );

    // Log what we got
    if (pairs.length > 0) {
      const gotMints = Array.from(
        new Set(
          pairs
            .flatMap((p: any) => [
              p?.baseToken?.address,
              p?.quoteToken?.address,
            ])
            .filter(Boolean),
        ),
      );
      const missingMints = uniqueMints.filter((m) => !gotMints.includes(m));
      if (missingMints.length > 0) {
        console.warn(
          `[DexScreener] Missing mints (${missingMints.length}): ${missingMints.join(", ")}`,
        );
      }
    }

    return new Response(JSON.stringify({ schemaVersion, pairs }), {
      headers: CORS_HEADERS,
    });
  } catch (err: any) {
    console.error("[DexScreener] Tokens handler error:", err);
    return new Response(
      JSON.stringify({
        error: { message: err?.message || String(err) },
        schemaVersion: "1.0.0",
        pairs: [],
      }),
      { status: 200, headers: CORS_HEADERS },
    );
  }
}

async function handleDexscreenerSearch(url: URL): Promise<Response> {
  try {
    const q = url.searchParams.get("q");
    if (!q || typeof q !== "string") {
      return new Response(
        JSON.stringify({
          error: "Missing or invalid 'q' parameter for search query.",
        }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const endpoints = [DEXSCREENER_BASE, DEXSCREENER_IO];
    let lastError: string | null = null;

    for (const base of endpoints) {
      try {
        const resp = await timeoutFetch(
          `${base}/search/?q=${encodeURIComponent(q)}`,
          { method: "GET", headers: browserHeaders() },
          25000,
        );

        if (!resp.ok) {
          const data = await safeJson(resp);
          lastError = `HTTP ${resp.status}: ${JSON.stringify(data)}`;
          console.warn(`[DexScreener] ${base} search returned ${resp.status}`);
          continue;
        }

        const data = await safeJson(resp);
        const solanaPairs = (data?.pairs || [])
          .filter(
            (pair: any) => (pair.chainId || "").toLowerCase() === "solana",
          )
          .slice(0, 20);

        return new Response(
          JSON.stringify({
            schemaVersion: data?.schemaVersion || "1.0.0",
            pairs: solanaPairs,
          }),
          { headers: CORS_HEADERS },
        );
      } catch (e: any) {
        lastError = String(e?.message || e);
        console.warn(`[DexScreener] ${base} search error:`, lastError);
        continue;
      }
    }

    // All endpoints failed
    return new Response(
      JSON.stringify({
        error: "DexScreener search failed",
        details: lastError || "All endpoints failed",
        schemaVersion: "1.0.0",
        pairs: [],
      }),
      { status: 502, headers: CORS_HEADERS },
    );
  } catch (err: any) {
    console.error("[DexScreener] Search proxy error:", err);
    return new Response(
      JSON.stringify({
        error: { message: err?.message || String(err), details: String(err) },
        schemaVersion: "1.0.0",
        pairs: [],
      }),
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

async function handleDexscreenerTrending(url: URL): Promise<Response> {
  try {
    const resp = await timeoutFetch(`${DEXSCREENER_BASE}/pairs/solana`, {
      method: "GET",
      headers: browserHeaders(),
    });
    const data = await safeJson(resp);

    const trendingPairs = (data?.pairs || [])
      .filter(
        (pair: any) =>
          pair.volume?.h24 > 1000 &&
          pair.liquidity?.usd &&
          pair.liquidity.usd > 10000,
      )
      .sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
      .slice(0, 50);

    return new Response(
      JSON.stringify({
        schemaVersion: data?.schemaVersion || "1.0.0",
        pairs: trendingPairs,
      }),
      {
        headers: CORS_HEADERS,
      },
    );
  } catch (err: any) {
    console.error("[DexScreener] Trending proxy error:", err);
    return new Response(
      JSON.stringify({
        error: { message: err?.message || String(err) },
        schemaVersion: "1.0.0",
        pairs: [],
      }),
      {
        status: 500,
        headers: CORS_HEADERS,
      },
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

async function handleForexRate(url: URL): Promise<Response> {
  try {
    const base = (url.searchParams.get("base") || "USD").toUpperCase();
    const symbols = (url.searchParams.get("symbols") || "PKR").toUpperCase();
    const firstSymbol = symbols.split(",")[0];
    const PROVIDER_TIMEOUT_MS = 5000;

    const providers: Array<{
      name: string;
      url: string;
      parse: (j: any) => number | null;
    }> = [
      {
        name: "exchangerate.host",
        url: `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(firstSymbol)}`,
        parse: (j) =>
          j && j.rates && typeof j.rates[firstSymbol] === "number"
            ? j.rates[firstSymbol]
            : null,
      },
      {
        name: "frankfurter",
        url: `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(firstSymbol)}`,
        parse: (j) =>
          j && j.rates && typeof j.rates[firstSymbol] === "number"
            ? j.rates[firstSymbol]
            : null,
      },
      {
        name: "er-api",
        url: `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
        parse: (j) =>
          j && j.rates && typeof j.rates[firstSymbol] === "number"
            ? j.rates[firstSymbol]
            : null,
      },
      {
        name: "fawazahmed-cdn",
        url: `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/${base.toLowerCase()}/${firstSymbol.toLowerCase()}.json`,
        parse: (j) =>
          j && typeof j[firstSymbol.toLowerCase()] === "number"
            ? j[firstSymbol.toLowerCase()]
            : null,
      },
    ];

    const fetchProvider = async (
      provider: (typeof providers)[number],
    ): Promise<{ rate: number; provider: string }> => {
      try {
        const resp = await timeoutFetch(
          provider.url,
          { method: "GET", headers: browserHeaders() },
          PROVIDER_TIMEOUT_MS,
        );
        if (!resp.ok) {
          const reason = `${resp.status} ${resp.statusText}`.trim();
          throw new Error(reason || "non-ok response");
        }
        const json = await resp.json();
        const rate = provider.parse(json);
        if (typeof rate === "number" && isFinite(rate) && rate > 0) {
          return { rate, provider: provider.name };
        }
        throw new Error("invalid response payload");
      } catch (error: any) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`[${provider.name}] ${message}`);
      }
    };

    const runProviders = async (): Promise<{
      rate: number;
      provider: string;
    }> => {
      const attempts = providers.map((p) => fetchProvider(p));
      if (typeof (Promise as any).any === "function") {
        return (Promise as any).any(attempts);
      }
      return new Promise((resolve, reject) => {
        const errors: string[] = [];
        let remaining = attempts.length;
        attempts.forEach((attempt) => {
          (attempt as Promise<any>).then(resolve).catch((err) => {
            errors.push(err instanceof Error ? err.message : String(err));
            remaining -= 1;
            if (remaining === 0) reject(new Error(errors.join("; ")));
          });
        });
      });
    };

    try {
      const { rate, provider } = await runProviders();
      return new Response(
        JSON.stringify({
          base,
          symbols: [firstSymbol],
          rates: { [firstSymbol]: rate },
          provider,
        }),
        { headers: CORS_HEADERS },
      );
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch forex rate", details: msg }),
        { status: 502, headers: CORS_HEADERS },
      );
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: CORS_HEADERS,
    });
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
            "/api/forex/rate?base=USD&symbols=PKR - Forex rate",
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
          endpoints: [
            "/api/dexscreener/price?tokenAddress=<mint>",
            "/api/dexscreener/search?q=<query>",
            "/api/dexscreener/trending",
          ],
        }),
        { headers: CORS_HEADERS },
      );
    }

    if (pathname.startsWith("/api/dexscreener/tokens")) {
      return await handleDexscreenerTokens(url);
    }

    if (pathname.startsWith("/api/dexscreener/search")) {
      return await handleDexscreenerSearch(url);
    }

    if (pathname.startsWith("/api/dexscreener/trending")) {
      return await handleDexscreenerTrending(url);
    }

    if (pathname.startsWith("/api/dexscreener/price")) {
      return await handleDexscreenerPrice(url);
    }

    if (pathname.startsWith("/api/forex/rate") || pathname === "/forex/rate") {
      return await handleForexRate(url);
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

export async function onRequest(context: any): Promise<Response> {
  // Cloudflare Pages Functions pass a context object; extract the Request
  return handler(context.request as Request);
}
