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

// Tokens that should be fetched from Birdeye (live prices)
const BIRDEYE_TOKENS = new Set(["FIXERCOIN", "LOCKER", "FXM"]);

const BIRDEYE_API_KEY =
  process.env.BIRDEYE_API_KEY || "cecae2ad38d7461eaf382f533726d9bb";
const BIRDEYE_API_URL = "https://public-api.birdeye.so";

async function fetchBirdeyePrice(
  mint: string,
): Promise<{ price: number; priceChange24h: number } | null> {
  try {
    const url = `${BIRDEYE_API_URL}/public/price?address=${encodeURIComponent(mint)}`;
    console.log(`[Birdeye] Fetching price for ${mint}`);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-API-KEY": BIRDEYE_API_KEY,
      },
    });

    if (!response.ok) {
      console.warn(`[Birdeye] HTTP ${response.status} for ${mint}`);
      return null;
    }

    const data: any = await response.json();
    if (!data.success || !data.data) {
      console.warn(`[Birdeye] No price data found for ${mint}`);
      return null;
    }

    const price = data.data.value;
    const priceChange24h = data.data.priceChange24h || 0;

    if (!price || price <= 0) {
      console.warn(`[Birdeye] Invalid price for ${mint}: ${price}`);
      return null;
    }

    console.log(`[Birdeye] ✅ ${mint}: $${price.toFixed(8)}`);
    return { price, priceChange24h };
  } catch (error) {
    console.warn(
      `[Birdeye] Error fetching ${mint}:`,
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

    // Return fallback price when DexScreener fails
    const fallbackPrice = FALLBACK_PRICES[token] || 0;
    return new Response(
      JSON.stringify({
        token,
        priceUsd: fallbackPrice,
        priceChange24h: 0,
        source: "fallback",
        isFallback: true,
        timestamp: Date.now(),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=5",
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

        // Return fallback price when not available
        const fallbackMintPrice = FALLBACK_PRICES[tokenSymbol] || 0;
        return new Response(
          JSON.stringify({
            token: tokenSymbol,
            mint,
            priceUsd: fallbackMintPrice,
            priceChange24h: 0,
            source: "fallback",
            isFallback: true,
            timestamp: Date.now(),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=5",
            },
          },
        );
      }
    }

    // Return fallback price for unknown token
    return new Response(
      JSON.stringify({
        token,
        mint,
        priceUsd: FALLBACK_PRICES[token] || 0,
        priceChange24h: 0,
        source: "fallback",
        isFallback: true,
        timestamp: Date.now(),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=5",
        },
      },
    );
  } catch (error: any) {
    console.error("[Token Price] Error:", error?.message || String(error));

    return new Response(
      JSON.stringify({
        error: "Price service temporarily unavailable",
        details: error?.message || String(error),
        timestamp: Date.now(),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
        },
      },
    );
  }
}

export default handler;
