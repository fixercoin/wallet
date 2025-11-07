import type { Handler } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const PRICE_CACHE_TTL_MS = 60_000;
const PRICE_CACHE: { data: any; expiresAt: number } | null = null;

interface SolPriceResponse {
  price: number;
  price_change_24h: number;
  market_cap: number;
  volume_24h: number;
}

// Try CoinGecko first as primary source
async function fetchFromCoinGecko(): Promise<SolPriceResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (compatible; SolanaWallet/1.0; +http://example.com)",
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!resp.ok) {
      console.warn(
        `[SOL Price] CoinGecko error: HTTP ${resp.status} ${resp.statusText}`,
      );
      return null;
    }

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      console.warn(
        `[SOL Price] CoinGecko invalid content-type: ${contentType}`,
      );
      return null;
    }

    const data = await resp.json();
    if (!data.solana?.usd) {
      console.warn("[SOL Price] CoinGecko missing price data");
      return null;
    }

    const result: SolPriceResponse = {
      price: data.solana.usd || 100,
      price_change_24h: data.solana.usd_24h_change || 0,
      market_cap: data.solana.usd_market_cap || 0,
      volume_24h: data.solana.usd_24h_vol || 0,
    };

    console.log(
      "[SOL Price] Successfully fetched from CoinGecko:",
      result.price,
    );
    return result;
  } catch (error: any) {
    const errorMsg =
      error?.name === "AbortError"
        ? "timeout"
        : error?.message || String(error);
    console.warn(`[SOL Price] CoinGecko fetch failed: ${errorMsg}`);
    return null;
  }
}

// Fallback to Birdeye API
async function fetchFromBirdeye(): Promise<SolPriceResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(
      "https://public-api.birdeye.so/defi/price?address=So11111111111111111111111111111111111111112",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (compatible; SolanaWallet/1.0; +http://example.com)",
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!resp.ok) {
      console.warn(
        `[SOL Price] Birdeye error: HTTP ${resp.status} ${resp.statusText}`,
      );
      return null;
    }

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      console.warn(`[SOL Price] Birdeye invalid content-type: ${contentType}`);
      return null;
    }

    const data = await resp.json();
    if (!data.data?.value) {
      console.warn("[SOL Price] Birdeye missing price data");
      return null;
    }

    const result: SolPriceResponse = {
      price: data.data.value || 100,
      price_change_24h: 0,
      market_cap: 0,
      volume_24h: 0,
    };

    console.log("[SOL Price] Successfully fetched from Birdeye:", result.price);
    return result;
  } catch (error: any) {
    const errorMsg =
      error?.name === "AbortError"
        ? "timeout"
        : error?.message || String(error);
    console.warn(`[SOL Price] Birdeye fetch failed: ${errorMsg}`);
    return null;
  }
}

// Fallback to static price
function getFallbackPrice(): SolPriceResponse {
  console.log("[SOL Price] Using fallback price");
  return {
    price: 100,
    price_change_24h: 0,
    market_cap: 0,
    volume_24h: 0,
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Method not allowed. Use GET.",
      }),
    };
  }

  try {
    // Try CoinGecko first
    let priceData = await fetchFromCoinGecko();

    // Fallback to Birdeye if CoinGecko fails
    if (!priceData) {
      console.log("[SOL Price] CoinGecko failed, trying Birdeye...");
      priceData = await fetchFromBirdeye();
    }

    // Final fallback
    if (!priceData) {
      console.log("[SOL Price] All APIs failed, using fallback price");
      priceData = getFallbackPrice();
    }

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=30",
      },
      body: JSON.stringify(priceData),
    };
  } catch (error: any) {
    console.error("[SOL Price] Unexpected error:", error);

    const fallback = getFallbackPrice();
    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=60",
      },
      body: JSON.stringify(fallback),
    };
  }
};
