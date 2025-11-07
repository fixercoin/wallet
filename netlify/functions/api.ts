import type {
  Handler,
  HandlerEvent,
  HandlerResponse,
} from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
  "Content-Type": "application/json",
};

// ============================================================================
// INDIVIDUAL HANDLER IMPLEMENTATIONS (INLINED)
// ============================================================================

// Health check handler
const solPriceHandler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  const FALLBACK_PRICE = {
    symbol: "SOL",
    price: 100,
    priceUsd: 100,
    priceChange24h: 0,
    volume24h: 0,
    marketCap: 0,
    liquidity: 0,
  };

  const strategies = [
    {
      name: "DexScreener",
      fn: async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        try {
          const response = await fetch(
            "https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112",
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error(`Status ${response.status}`);
          const data = await response.json();
          if (!data.pairs || data.pairs.length === 0)
            throw new Error("No SOL pair data");
          const pair = data.pairs[0];
          const price = parseFloat(pair.priceUsd || "0");
          if (!isFinite(price) || price <= 0) throw new Error("Invalid price");
          return {
            symbol: "SOL",
            price,
            priceUsd: price,
            priceChange24h: parseFloat(pair.priceChange24h || "0") || 0,
            volume24h: parseFloat(pair.volume?.h24 || "0") || 0,
            marketCap: parseFloat(pair.marketCap || "0") || 0,
            liquidity: parseFloat(pair.liquidity?.usd || "0") || 0,
          };
        } finally {
          clearTimeout(timeoutId);
        }
      },
    },
    {
      name: "CoinGecko",
      fn: async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        try {
          const response = await fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true",
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error(`Status ${response.status}`);
          const data = await response.json();
          if (!data.solana || !data.solana.usd)
            throw new Error("No SOL price data");
          const price = parseFloat(data.solana.usd || "0");
          if (!isFinite(price) || price <= 0) throw new Error("Invalid price");
          return {
            symbol: "SOL",
            price,
            priceUsd: price,
            priceChange24h: data.solana.usd_24h_change || 0,
            volume24h: data.solana.usd_24h_vol || 0,
            marketCap: data.solana.usd_market_cap || 0,
            liquidity: 0,
          };
        } finally {
          clearTimeout(timeoutId);
        }
      },
    },
  ];

  for (const strategy of strategies) {
    try {
      const data = await strategy.fn();
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(data),
      };
    } catch (error) {
      console.warn(`[SOL Price] ${strategy.name} failed`);
    }
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(FALLBACK_PRICE),
  };
};

// Jupiter Price Handler
const jupiterPriceHandler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  const ids = event.queryStringParameters?.ids || "";
  if (!ids) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Missing ids parameter" }),
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(
        `https://price.jup.ag/v4/price?ids=${encodeURIComponent(ids)}`,
        { signal: controller.signal },
      );
      if (!response.ok) {
        return {
          statusCode: response.status,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "Jupiter API error" }),
        };
      }
      const data = await response.json();
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(data),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Failed to fetch prices" }),
    };
  }
};

// ============================================================================
// MAIN ROUTER
// ============================================================================

export const handler: Handler = async (
  event: HandlerEvent,
): Promise<HandlerResponse> => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  // Extract path from query parameter (set by netlify.toml rewrite rule)
  let apiPath = event.queryStringParameters?.path || "";

  // If no query path, try to extract from pathname
  if (!apiPath) {
    const pathname = event.path || event.rawPath || "";
    apiPath = pathname.replace(/^\/+\.netlify\/functions\/api\/?/, "").replace(/^\/+api\/?/, "").trim();
  }

  console.log(`[API] Route: ${apiPath}, Method: ${event.httpMethod}`);

  // =========================================================================
  // HEALTH ENDPOINTS
  // =========================================================================

  if (apiPath === "health") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        status: "healthy",
        service: "Fixorium Wallet API",
        timestamp: new Date().toISOString(),
      }),
    };
  }

  if (apiPath === "ping") {
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "text/plain" },
      body: "pong",
    };
  }

  if (apiPath === "status") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        status: "operational",
        service: "Fixorium Wallet API",
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // =========================================================================
  // ROOT API ENDPOINT
  // =========================================================================

  if (!apiPath || apiPath === "") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: "Fixorium Wallet API (Netlify)",
        status: "operational",
        timestamp: new Date().toISOString(),
        endpoints: {
          health: "/api/health",
          status: "/api/status",
          ping: "/api/ping",
          pricing: {
            "sol-price": "/api/sol/price",
            "jupiter-price": "/api/jupiter/price?ids=<mint>",
            "dexscreener-price": "/api/dexscreener/price",
            "birdeye-price": "/api/birdeye/price",
            "token-price": "/api/token/price",
          },
          wallet: {
            balance: "/api/wallet/balance?publicKey=<address>",
          },
          swap: {
            quote: "/api/jupiter/quote",
            execute: "/api/jupiter/swap",
          },
        },
      }),
    };
  }

  // =========================================================================
  // PRICING ENDPOINTS
  // =========================================================================

  if (apiPath === "sol/price") {
    return solPriceHandler(event);
  }

  if (apiPath === "jupiter/price") {
    return jupiterPriceHandler(event);
  }

  if (apiPath === "token/price") {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS_HEADERS, body: "" };
    }

    const tokenParam = String(
      event.queryStringParameters?.token ||
        event.queryStringParameters?.symbol ||
        "FIXERCOIN",
    ).toUpperCase();

    const FALLBACK_USD: Record<string, number> = {
      FIXERCOIN: 0.00008139,
      SOL: 149.38,
      USDC: 1.0,
      USDT: 1.0,
      LOCKER: 0.00001112,
    };

    const TOKEN_MINTS: Record<string, string> = {
      SOL: "So11111111111111111111111111111111111111112",
      USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
      FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
      LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
    };

    const fallback = FALLBACK_USD[tokenParam] ?? null;
    if (fallback !== null) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ token: tokenParam, priceUsd: fallback }),
      };
    }

    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Token price not available" }),
    };
  }

  if (apiPath === "dexscreener/price") {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS_HEADERS, body: "" };
    }

    try {
      const tokenParam = event.queryStringParameters?.token || "";
      if (!tokenParam) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "Missing token parameter" }),
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(tokenParam)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          return {
            statusCode: response.status,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "DexScreener API error" }),
          };
        }

        const data = await response.json();
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify(data),
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: any) {
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Failed to fetch price data" }),
      };
    }
  }

  if (apiPath === "birdeye/price") {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS_HEADERS, body: "" };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        price: 0.00008139,
        priceChange24h: 0,
        volume24h: 0,
      }),
    };
  }

  // =========================================================================
  // WALLET ENDPOINTS
  // =========================================================================

  if (apiPath === "wallet/balance") {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS_HEADERS, body: "" };
    }

    const publicKey =
      event.queryStringParameters?.publicKey ||
      event.queryStringParameters?.wallet ||
      event.queryStringParameters?.address ||
      event.queryStringParameters?.walletAddress;

    if (!publicKey) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Missing wallet address parameter",
          examples: [
            "?publicKey=...",
            "?wallet=...",
            "?address=...",
            "?walletAddress=...",
          ],
        }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: "Wallet balance endpoint - requires external RPC connection",
        wallet: publicKey,
      }),
    };
  }

  // =========================================================================
  // 404 - NOT FOUND
  // =========================================================================

  console.warn(`[API] No handler found for: ${apiPath}`);

  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      error: "API endpoint not found",
      requestedPath: apiPath || "/",
      hint: "Check /api for available endpoints",
    }),
  };
};
