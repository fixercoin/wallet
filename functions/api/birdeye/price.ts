export const config = {
  runtime: "nodejs_esmsh",
};

const BIRDEYE_API_URL = "https://public-api.birdeye.so";
const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex";
const JUPITER_PRICE_API = "https://api.jup.ag/price/v2";

const TOKEN_MINTS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
  FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
  LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
};

const FALLBACK_PRICES: Record<string, number> = {
  SOL: 149.38,
  USDC: 1.0,
  USDT: 1.0,
  FIXERCOIN: 0.00005600,
  LOCKER: 0.00001112,
};

async function tryBirdeye(address: string, apiKey: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000);

  try {
    const response = await fetch(
      `${BIRDEYE_API_URL}/public/price?address=${encodeURIComponent(address)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-API-KEY": apiKey,
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data?.value) {
        return {
          address,
          value: data.data.value,
          updateUnixTime: data.data.updateUnixTime,
          priceChange24h: data.data.priceChange24h || 0,
          source: "birdeye",
        };
      }
    }
  } catch {
    clearTimeout(timeoutId);
  }

  return null;
}

async function tryDexScreener(address: string): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000);

    const response = await fetch(
      `${DEXSCREENER_BASE}/tokens/${encodeURIComponent(address)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const pairs = Array.isArray(data?.pairs) ? data.pairs : [];

      if (pairs.length > 0) {
        const pair = pairs.find(
          (p: any) =>
            (p?.baseToken?.address === address ||
              p?.quoteToken?.address === address) &&
            p?.priceUsd,
        );

        if (pair && pair.priceUsd) {
          const price = parseFloat(pair.priceUsd);
          if (isFinite(price) && price > 0) {
            return {
              address,
              value: price,
              updateUnixTime: Math.floor(Date.now() / 1000),
              priceChange24h: pair.priceChange?.h24 || 0,
              source: "dexscreener",
            };
          }
        }
      }
    }
  } catch {
    // Continue to next fallback
  }

  return null;
}

async function tryJupiter(address: string): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000);

    const response = await fetch(
      `${JUPITER_PRICE_API}?ids=${encodeURIComponent(address)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const priceData = data?.data?.[address];

      if (priceData?.price) {
        const price = parseFloat(priceData.price);
        if (isFinite(price) && price > 0) {
          return {
            address,
            value: price,
            updateUnixTime: Math.floor(Date.now() / 1000),
            priceChange24h: 0,
            source: "jupiter",
          };
        }
      }
    }
  } catch {
    // Continue to fallback
  }

  return null;
}

async function handler(request: Request): Promise<Response> {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const url = new URL(request.url);
    const address = url.searchParams.get("address");

    if (!address) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing 'address' parameter",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Try Birdeye first
    const birdeyeResult = await tryBirdeye(
      address,
      "cecae2ad38d7461eaf382f533726d9bb",
    );
    if (birdeyeResult) {
      return new Response(
        JSON.stringify({ success: true, data: birdeyeResult }),
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

    // Try DexScreener
    const dexResult = await tryDexScreener(address);
    if (dexResult) {
      return new Response(JSON.stringify({ success: true, data: dexResult }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=10",
        },
      });
    }

    // Try Jupiter
    const jupiterResult = await tryJupiter(address);
    if (jupiterResult) {
      return new Response(
        JSON.stringify({ success: true, data: jupiterResult }),
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

    // Try hardcoded fallback
    for (const [symbol, mint] of Object.entries(TOKEN_MINTS)) {
      if (mint === address && FALLBACK_PRICES[symbol]) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              address,
              value: FALLBACK_PRICES[symbol],
              updateUnixTime: Math.floor(Date.now() / 1000),
              priceChange24h: 0,
              source: "fallback",
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }
    }

    // No price data available
    return new Response(
      JSON.stringify({
        success: false,
        error: "No price data available for this token",
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
        success: false,
        error: "Price API error",
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

export const onRequest = async ({ request }: { request: Request }) =>
  handler(request);
