export interface Env {
  SOLANA_RPC?: string;
}

// RPC endpoints
// Prefer reliable public providers by default
const DEFAULT_SOLANA_RPC = "https://rpc.ironforge.network/mainnet";
const FALLBACK_RPC_ENDPOINTS = [
  "https://rpc.ironforge.network/mainnet",
  "https://solana.publicnode.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
];

// External API endpoints
const PUMPFUN_API_BASE = "https://pump.fun/api";
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
      message: "health check",
      upstream,
      timestamp: new Date().toISOString(),
      service: "Fixorium Wallet API",
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

  // Build RPC endpoints with environment variable support
  const rpcEndpoints: string[] = [];

  // Add Helius if API key is provided
  if (env.HELIUS_API_KEY) {
    rpcEndpoints.push(`https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`);
  }

  // Add custom SOLANA_RPC if provided
  if (env.SOLANA_RPC) {
    rpcEndpoints.push(env.SOLANA_RPC);
  }

  // Add fallback endpoints
  rpcEndpoints.push(...FALLBACK_RPC_ENDPOINTS);

  // Remove duplicates
  const uniqueEndpoints = [...new Set(rpcEndpoints)];

  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "getBalance",
    params: [publicKey],
  };

  let lastError = "";
  for (let i = 0; i < uniqueEndpoints.length; i++) {
    const endpoint = uniqueEndpoints[i];
    try {
      const rpcRes = await timeoutFetch(endpoint, {
        method: "POST",
        headers: browserHeaders(),
        body: JSON.stringify(payload),
      });
      const rpcJson = await rpcRes.json();

      if (rpcJson.error) {
        lastError = rpcJson.error.message || "RPC error";
        continue;
      }

      const lamports = rpcJson?.result?.value ?? 0;
      const sol = lamports / 1_000_000_000;
      return new Response(JSON.stringify({ lamports, sol, publicKey }), {
        headers: CORS_HEADERS,
      });
    } catch (e: any) {
      lastError = String(e?.message || e).slice(0, 100);
      continue;
    }
  }

  return new Response(
    JSON.stringify({
      error: "Failed to fetch wallet balance",
      details: lastError || "All RPC endpoints failed",
      endpointsAttempted: uniqueEndpoints.length,
    }),
    { status: 502, headers: CORS_HEADERS },
  );
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

  // Build RPC endpoints with environment variable support
  const rpcEndpoints: string[] = [];

  // Add Helius if API key is provided
  if (env.HELIUS_API_KEY) {
    rpcEndpoints.push(`https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`);
  }

  // Add custom SOLANA_RPC if provided
  if (env.SOLANA_RPC) {
    rpcEndpoints.push(env.SOLANA_RPC);
  }

  // Add fallback endpoints
  rpcEndpoints.push(...FALLBACK_RPC_ENDPOINTS);

  // Remove duplicates
  const uniqueEndpoints = [...new Set(rpcEndpoints)];

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

  let lastError = "";
  for (let i = 0; i < uniqueEndpoints.length; i++) {
    const endpoint = uniqueEndpoints[i];
    try {
      const rpcRes = await timeoutFetch(endpoint, {
        method: "POST",
        headers: browserHeaders(),
        body: JSON.stringify(payload),
      });
      const rpcJson = await rpcRes.json();

      if (rpcJson.error) {
        lastError = rpcJson.error.message || "RPC error";
        continue;
      }

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
      lastError = String(e?.message || e);
      continue;
    }
  }

  return new Response(
    JSON.stringify({
      error: "Failed to fetch wallet tokens",
      details: lastError || "All RPC endpoints failed",
      endpointsAttempted: uniqueEndpoints.length,
    }),
    { status: 502, headers: CORS_HEADERS },
  );
}

// Generic price endpoint using DexScreener
async function handlePrice(url: URL): Promise<Response> {
  const mint =
    url.searchParams.get("mint") ||
    url.searchParams.get("tokenAddress") ||
    url.searchParams.get("token");

  if (!mint) {
    return new Response(JSON.stringify({ error: "mint required" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  let price = null;
  let source = null;

  try {
    // Try Birdeye first (primary source - most accurate)
    try {
      const birdeyeUrl = `https://public-api.birdeye.so/public/price?address=${encodeURIComponent(
        mint,
      )}`;
      const birdeyeRes = await timeoutFetch(
        birdeyeUrl,
        {
          method: "GET",
          headers: browserHeaders({
            "x-chain": "solana",
          }),
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
              JSON.stringify({ token: mint, priceUsd: price, source }),
              { headers: CORS_HEADERS },
            );
          }
        }
      }
    } catch (e) {
      // Continue to fallback
    }

    // Fall back to DexScreener
    try {
      const dexRes = await timeoutFetch(
        `${DEXSCREENER_BASE}/tokens/${encodeURIComponent(mint)}`,
        {
          method: "GET",
          headers: browserHeaders(),
        },
        8000,
      );
      if (dexRes.ok) {
        const dexData = await dexRes.json();
        const dexPrice = dexData?.pairs?.[0]?.priceUsd ?? null;
        if (dexPrice) {
          price = Number(dexPrice);
          source = "dexscreener";
          if (isFinite(price) && price > 0) {
            return new Response(
              JSON.stringify({ token: mint, priceUsd: price, source }),
              { headers: CORS_HEADERS },
            );
          }
        }
      }
    } catch (e) {
      // Continue to Jupiter fallback
    }

    // Fall back to Jupiter
    try {
      const jupRes = await timeoutFetch(
        `https://api.jup.ag/price?ids=${encodeURIComponent(mint)}`,
        { method: "GET", headers: browserHeaders() },
        8000,
      );
      if (jupRes.ok) {
        const jupData = await jupRes.json();
        const jupPrice = jupData?.data?.[mint]?.price ?? null;
        if (jupPrice) {
          price = Number(jupPrice);
          source = "jupiter";
          if (isFinite(price) && price > 0) {
            return new Response(
              JSON.stringify({ token: mint, priceUsd: price, source }),
              { headers: CORS_HEADERS },
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
        token: mint,
        priceUsd: null,
        message: "Price not available from any source",
      }),
      {
        status: 404,
        headers: CORS_HEADERS,
      },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 502,
      headers: CORS_HEADERS,
    });
  }
}

// Solana Send Transaction handler
async function handleSolanaSend(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));

    if (!body || !body.signedBase64 || typeof body.signedBase64 !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing required field: signedBase64" }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const rpcBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: [
        body.signedBase64,
        { skipPreflight: false, preflightCommitment: "processed" },
      ],
    };

    const endpoints = [...FALLBACK_RPC_ENDPOINTS];

    for (const endpoint of endpoints) {
      try {
        const response = await timeoutFetch(endpoint, {
          method: "POST",
          headers: browserHeaders(),
          body: JSON.stringify(rpcBody),
        });

        const text = await response.text().catch(() => "");
        if (!response.ok) {
          continue;
        }

        const data = text ? JSON.parse(text) : {};

        if (data.result) {
          return new Response(
            JSON.stringify({
              success: true,
              result: data.result,
              signature: data.result,
            }),
            { status: 200, headers: CORS_HEADERS },
          );
        } else if (data.error) {
          continue;
        }
      } catch (e) {
        continue;
      }
    }

    return new Response(
      JSON.stringify({
        error: "Failed to send transaction",
        details: "All RPC endpoints failed",
      }),
      { status: 502, headers: CORS_HEADERS },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}

// Jupiter Quote handler
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
    `${JUPITER_SWAP_BASE}/quote?${params.toString()}`,
    `https://quote-api.jup.ag/v6/quote?${params.toString()}`,
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

// Jupiter Swap handler
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

    // Build swap request with proper defaults
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

    // Try both endpoints with fallback
    const endpoints = [
      `${JUPITER_SWAP_BASE}/swap`,
      "https://quote-api.jup.ag/v6/swap",
    ];

    let lastError = "";
    let lastStatus = 500;

    for (let idx = 0; idx < endpoints.length; idx++) {
      const endpoint = endpoints[idx];
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await timeoutFetch(endpoint, {
            method: "POST",
            headers: browserHeaders(),
            body: JSON.stringify(swapRequest),
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

          // Check for stale quote errors
          let errorData: any = {};
          try {
            errorData = JSON.parse(text);
          } catch {}

          const lower = (text || "").toLowerCase();
          const isStaleQuote =
            lower.includes("1016") ||
            lower.includes("stale") ||
            lower.includes("simulation") ||
            lower.includes("quote expired") ||
            errorData?.code === 1016;

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

          // Don't retry client errors
          if (
            response.status === 400 ||
            response.status === 401 ||
            response.status === 403
          ) {
            return new Response(
              JSON.stringify({
                error: `Swap request failed: ${response.statusText}`,
                details: text,
              }),
              { status: response.status, headers: CORS_HEADERS },
            );
          }

          lastError = text;

          // Retry on rate limit or server errors
          if (response.status === 429 || response.status >= 500) {
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 1000 * attempt));
              continue;
            }
          }

          break; // Try next endpoint
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

// Jupiter Price handler
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

// Jupiter Tokens handler
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

// Pump.fun curve status handler
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

// Pump.fun BUY handler
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

// Pump.fun SELL handler
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
  env: Env,
): Promise<Response> {
  try {
    const pumpQuoteUrl = (env && (env as any).PUMPFUN_QUOTE) || PUMPFUN_QUOTE;
    if (!pumpQuoteUrl) {
      return new Response(
        JSON.stringify({
          error: "PumpFun quote endpoint not configured",
          code: "UNCONFIGURED",
        }),
        { status: 503, headers: CORS_HEADERS },
      );
    }

    // Support both GET query params and POST JSON body
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

    const response = await timeoutFetch(pumpQuoteUrl, {
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

// Main fetch handler for worker
export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    try {
      let url: URL;
      try {
        url = new URL(request.url);
      } catch (e) {
        return new Response(
          JSON.stringify({
            error: "Invalid request URL",
            details: String(e?.message || e),
          }),
          {
            status: 400,
            headers: {
              ...CORS_HEADERS,
            },
          },
        );
      }
      const pathname = url.pathname || "/";

      // API Routes - handle these first
      // Health check
      if (pathname === "/health" || pathname === "/api/health") {
        return await handleHealth();
      }

      if (pathname === "/api/ping") {
        return new Response(
          JSON.stringify({
            status: "ok",
            message: "ping",
            timestamp: new Date().toISOString(),
            service: "Fixorium Wallet API",
          }),
          { headers: CORS_HEADERS },
        );
      }

      if (
        pathname.startsWith("/api/wallet/balance") ||
        pathname === "/wallet/balance"
      ) {
        return await handleWalletBalance(url, env);
      }

      if (
        pathname.startsWith("/api/wallet/tokens") ||
        pathname === "/wallet/tokens"
      ) {
        return await handleWalletTokens(url, env);
      }

      if (pathname.startsWith("/api/price") || pathname === "/price") {
        return await handlePrice(url);
      }

      if (
        pathname.startsWith("/api/dexscreener/price") ||
        pathname === "/dexscreener/price"
      ) {
        return await handlePrice(url);
      }

      // Jupiter routes
      if (pathname.startsWith("/api/jupiter/quote")) {
        return await handleJupiterQuote(url);
      }

      if (pathname.startsWith("/api/jupiter/swap")) {
        return await handleJupiterSwap(request);
      }

      if (pathname.startsWith("/api/solana-send")) {
        return await handleSolanaSend(request);
      }

      if (pathname.startsWith("/api/jupiter/price")) {
        return await handleJupiterPrice(url);
      }

      if (pathname.startsWith("/api/jupiter/tokens")) {
        return await handleJupiterTokens(url);
      }

      // Pump.fun routes
      if (pathname === "/api/pumpfun/quote") {
        return await handlePumpFunQuote(request, url, env);
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

      // Handle CORS preflight for all /api/ requests
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers":
              "Content-Type, Authorization, X-Admin-Wallet",
            "Access-Control-Max-Age": "86400",
          },
        });
      }

      // Static asset serving for React SPA
      // Try to serve static assets from the dist folder
      if (env && typeof env === "object" && "ASSETS" in env) {
        try {
          const response = await (env as any).ASSETS.fetch(request);
          if (response.status === 200) {
            return response;
          }
        } catch (e) {
          // Continue to fallback logic
        }
      }

      // For SPA routing: serve index.html for non-API, non-static routes
      if (
        !pathname.startsWith("/api/") &&
        !pathname.includes(".") &&
        request.method === "GET"
      ) {
        try {
          if (env && typeof env === "object" && "ASSETS" in env) {
            const indexResponse = await (env as any).ASSETS.fetch(
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
          // Fallback to 404
        }
      }

      // Default 404
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: CORS_HEADERS,
      });
    } catch (err: any) {
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
  },
};
