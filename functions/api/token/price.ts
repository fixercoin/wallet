export const config = {
  runtime: "nodejs_esmsh",
};

const TOKEN_MINTS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
  FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
  LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
  FXM: "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump",
};

const FALLBACK_PRICES: Record<string, number> = {
  FIXERCOIN: 0.000042,
  SOL: 149.38,
  USDC: 1.0,
  USDT: 1.0,
  LOCKER: 0.000008,
  FXM: 0.00000357,
};

// Tokens that should be fetched from DexScreener (live prices)
const DEXSCREENER_TOKENS = new Set(["FIXERCOIN", "LOCKER", "FXM"]);

async function fetchDexscreenerPrice(
  mint: string,
): Promise<{ price: number; priceChange24h: number } | null> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      {
        headers: { "User-Agent": "Fixercoin-Wallet/1.0" },
      },
    );

    if (!response.ok) {
      console.warn(`[DexScreener] HTTP ${response.status} for ${mint}`);
      return null;
    }

    const data: any = await response.json();
    if (!data.pairs || data.pairs.length === 0) {
      console.warn(`[DexScreener] No pairs found for ${mint}`);
      return null;
    }

    const pair = data.pairs[0];
    const price = pair.priceUsd ? parseFloat(pair.priceUsd) : null;
    const priceChange24h = pair.priceChange?.h24 || 0;

    if (!price || price <= 0) {
      console.warn(`[DexScreener] Invalid price for ${mint}: ${price}`);
      return null;
    }

    console.log(`[DexScreener] ✅ ${mint}: $${price.toFixed(8)}`);
    return { price, priceChange24h };
  } catch (error) {
    console.warn(
      `[DexScreener] Error fetching ${mint}:`,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

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

    // Try DexScreener for FIXERCOIN, LOCKER, FXM
    if (DEXSCREENER_TOKENS.has(token)) {
      const tokenMint = TOKEN_MINTS[token];
      if (tokenMint) {
        const dexData = await fetchDexscreenerPrice(tokenMint);
        if (dexData) {
          return new Response(
            JSON.stringify({
              token,
              mint: tokenMint,
              priceUsd: dexData.price,
              priceChange24h: dexData.priceChange24h,
              source: "dexscreener",
              timestamp: Date.now(),
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=10", // Short cache for live prices
              },
            },
          );
        }
      }
    }

    // Return error when DexScreener fails (no fallback prices)
    return new Response(
      JSON.stringify({
        token,
        error: "Price service temporarily unavailable",
        timestamp: Date.now(),
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
        },
      },
    );

    // If mint provided, try to resolve it
    if (mint && mint.length > 40) {
      // Try to find the token symbol for this mint
      const tokenSymbol = Object.entries(TOKEN_MINTS).find(
        ([, m]) => m === mint,
      )?.[0];

      if (tokenSymbol) {
        // Try DexScreener for special tokens
        if (DEXSCREENER_TOKENS.has(tokenSymbol)) {
          const dexData = await fetchDexscreenerPrice(mint);
          if (dexData) {
            return new Response(
              JSON.stringify({
                token: tokenSymbol,
                mint,
                priceUsd: dexData.price,
                priceChange24h: dexData.priceChange24h,
                source: "dexscreener",
                timestamp: Date.now(),
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*",
                  "Cache-Control": "public, max-age=10",
                },
              },
            );
          }
        }

        // Return error when price not available (no fallback prices)
        return new Response(
          JSON.stringify({
            token: tokenSymbol,
            mint,
            error: "Price service temporarily unavailable",
            timestamp: Date.now(),
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-cache",
            },
          },
        );
      }
    }

    // Return zero price for unknown token (still valid JSON)
    return new Response(
      JSON.stringify({
        token,
        mint,
        priceUsd: 0,
        source: "unknown",
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
  } catch (error: any) {
    // Always return valid JSON with fallback price on error
    console.error("[Token Price] Error:", error?.message || String(error));

    return new Response(
      JSON.stringify({
        token: "FIXERCOIN",
        priceUsd: FALLBACK_PRICES.FIXERCOIN,
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

export default handler;
