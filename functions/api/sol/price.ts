export const config = {
  runtime: "nodejs_esmsh",
};

interface SolPriceResponse {
  price: number;
  price_change_24h: number;
  market_cap: number;
  volume_24h: number;
}

async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  let controller: AbortController | null = null;
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    controller = new AbortController();
    timeoutId = setTimeout(() => controller?.abort(), 18000);

    // Try CoinGecko API first
    try {
      console.log("[SOL Price] Attempting CoinGecko API...");
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true",
        {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
      );

      if (timeoutId) clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.solana && typeof data.solana.usd === "number") {
          const price = data.solana.usd;
          if (price > 0) {
            const priceData: SolPriceResponse = {
              price: price,
              price_change_24h: data.solana.usd_24h_change || 0,
              market_cap: data.solana.usd_market_cap || 0,
              volume_24h: data.solana.usd_24h_vol || 0,
            };

            console.log(`[SOL Price] ✅ CoinGecko success: $${price}`);
            const responseBody = {
              ...priceData,
              token: "SOL",
              mint: "So11111111111111111111111111111111111111112",
              source: "coingecko",
            };
            return new Response(JSON.stringify(responseBody), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=30",
              },
            });
          }
        }
      }
      console.log("[SOL Price] CoinGecko returned invalid data, trying Birdeye...");
    } catch (e: any) {
      console.warn("[SOL Price] CoinGecko failed:", e?.message || String(e));
    }

    // Reset timeout for second attempt
    if (timeoutId) clearTimeout(timeoutId);
    controller = new AbortController();
    timeoutId = setTimeout(() => controller?.abort(), 18000);

    // Fallback: Try Birdeye API for SOL
    try {
      console.log("[SOL Price] Attempting Birdeye API...");
      const birdeyeResponse = await fetch(
        "https://public-api.birdeye.so/defi/price?address=So11111111111111111111111111111111111111112",
        {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
      );

      if (timeoutId) clearTimeout(timeoutId);

      if (birdeyeResponse.ok) {
        const data = await birdeyeResponse.json();
        if (data.data && typeof data.data.value === "number" && data.data.value > 0) {
          const priceData: SolPriceResponse = {
            price: data.data.value,
            price_change_24h: 0,
            market_cap: 0,
            volume_24h: 0,
          };

          console.log(`[SOL Price] ✅ Birdeye success: $${data.data.value}`);
          const responseBody = {
            ...priceData,
            token: "SOL",
            mint: "So11111111111111111111111111111111111111112",
            source: "birdeye",
          };
          return new Response(JSON.stringify(responseBody), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=30",
            },
          });
        }
      }
      console.log("[SOL Price] Birdeye returned invalid data");
    } catch (e: any) {
      console.warn("[SOL Price] Birdeye failed:", e?.message || String(e));
    }

    // If all else fails, return 503 Service Unavailable so client will retry
    console.error("[SOL Price] Both CoinGecko and Birdeye APIs failed or returned invalid data");
    if (timeoutId) clearTimeout(timeoutId);

    return new Response(
      JSON.stringify({
        error: "All price APIs failed - CoinGecko and Birdeye unavailable",
        details: "Service temporarily unavailable",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=5",
        },
      },
    );
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);

    // Return 503 on error so client retries
    const isTimeout =
      error?.name === "AbortError" || error?.message?.includes("timeout");

    console.error(
      `[SOL Price] Handler error: ${isTimeout ? "timeout" : "fetch failed"}`,
      error?.message || String(error),
    );

    return new Response(
      JSON.stringify({
        error: isTimeout ? "Request timeout" : "Fetch failed",
        details: error?.message || String(error),
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=5",
        },
      },
    );
  }
}

export const onRequest = async ({ request }: { request: Request }) =>
  handler(request);
