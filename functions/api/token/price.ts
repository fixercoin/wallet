export const config = {
  runtime: "nodejs_esmsh",
};

const TOKEN_MINTS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
  FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
  LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
};

const FALLBACK_PRICES: Record<string, number> = {
  FIXERCOIN: 0.00008139,
  SOL: 149.38,
  USDC: 1.0,
  USDT: 1.0,
  LOCKER: 0.00001112,
};

async function handler(request: Request): Promise<Response> {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const url = new URL(request.url);
    const token = (
      url.searchParams.get("token") ||
      url.searchParams.get("symbol") ||
      "FIXERCOIN"
    ).toUpperCase();
    const mint = url.searchParams.get("mint") || "";

    // Handle stablecoins
    if (token === "USDC" || token === "USDT") {
      return new Response(
        JSON.stringify({ token, priceUsd: 1.0, source: "constant" }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600",
          },
        },
      );
    }

    // Handle known tokens with fallback prices
    if (FALLBACK_PRICES[token]) {
      return new Response(
        JSON.stringify({
          token,
          priceUsd: FALLBACK_PRICES[token],
          source: "fallback",
          timestamp: Date.now(),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=60",
          },
        },
      );
    }

    // If mint provided, try to resolve it
    if (mint && mint.length > 40) {
      // Try to find the token symbol for this mint
      const tokenSymbol = Object.entries(TOKEN_MINTS).find(
        ([, m]) => m === mint,
      )?.[0];

      if (tokenSymbol && FALLBACK_PRICES[tokenSymbol]) {
        return new Response(
          JSON.stringify({
            token: tokenSymbol,
            mint,
            priceUsd: FALLBACK_PRICES[tokenSymbol],
            source: "fallback",
            timestamp: Date.now(),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=60",
            },
          },
        );
      }
    }

    return new Response(
      JSON.stringify({
        error: "Token price not available",
        token,
        mint,
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: "Token price error",
        details: error?.message || String(error),
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

export default handler;
