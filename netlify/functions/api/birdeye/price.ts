import type { Handler } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const PRICE_CACHE_TTL_MS = 60_000;
const PRICE_CACHE = new Map<string, { data: any; expiresAt: number }>();
const INFLIGHT = new Map<string, Promise<any>>();

async function fetchBirdeyePrice(address: string) {
  let lastError: Error | null = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const url = `https://public-api.birdeye.so/defi/price?address=${encodeURIComponent(address)}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (compatible; SolanaWallet/1.0; +http://example.com)",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const preview = await resp.text().catch(() => "");
      const contentType = resp.headers.get("content-type") || "";
      console.error(
        `[Birdeye] HTTP ${resp.status}: ${contentType} | ${preview.substring(0, 100)}`,
      );
      throw new Error(
        `HTTP ${resp.status}: ${resp.statusText}. Content-Type: ${contentType}`,
      );
    }

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const preview = await resp.text().catch(() => "");
      console.error(
        `[Birdeye] Invalid content-type: ${contentType}. Response: ${preview.substring(0, 100)}`,
      );
      throw new Error(
        `Invalid content-type: ${contentType}. Expected application/json`,
      );
    }

    const data = await resp.json();
    console.log(`[Birdeye] Successfully fetched price for ${address}`);
    return data;
  } catch (e) {
    lastError = e instanceof Error ? e : new Error(String(e));
    const errorMsg =
      lastError?.name === "AbortError" ? "timeout" : lastError?.message;
    console.warn(`[Birdeye] Fetch failed: ${errorMsg}`);
    throw lastError;
  }
}

async function fetchPriceData(address: string) {
  const now = Date.now();
  const cached = PRICE_CACHE.get(address);

  if (cached && cached.expiresAt > now) {
    console.log(`[Birdeye] Cache hit for ${address}`);
    return cached.data;
  }

  const existing = INFLIGHT.get(address);
  if (existing) {
    console.log(`[Birdeye] Reusing in-flight request for ${address}`);
    return existing;
  }

  const request = (async () => {
    try {
      const data = await fetchBirdeyePrice(address);
      PRICE_CACHE.set(address, {
        data,
        expiresAt: Date.now() + PRICE_CACHE_TTL_MS,
      });
      return data;
    } finally {
      INFLIGHT.delete(address);
    }
  })();

  INFLIGHT.set(address, request);
  return request;
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

  const address = event.queryStringParameters?.address || "";

  if (!address) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Missing 'address' parameter",
      }),
    };
  }

  try {
    const data = await fetchPriceData(address);

    if (data?.data?.value) {
      const value = parseFloat(data.data.value);
      if (isFinite(value) && value > 0) {
        return {
          statusCode: 200,
          headers: {
            ...CORS_HEADERS,
            "Cache-Control": "public, max-age=30",
          },
          body: JSON.stringify({
            success: true,
            data: {
              address,
              value,
              updateUnixTime: Math.floor(Date.now() / 1000),
            },
            source: "birdeye",
          }),
        };
      }
    }

    // Fallback: return zero price
    console.warn(`[Birdeye] No valid price found for ${address}`);
    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=60",
      },
      body: JSON.stringify({
        success: true,
        data: {
          address,
          value: 0,
          updateUnixTime: Math.floor(Date.now() / 1000),
        },
        source: "fallback",
      }),
    };
  } catch (error: any) {
    console.error(
      `[Birdeye] Endpoint error for address ${address}:`,
      error?.message || String(error),
    );

    // Always return 200 with valid JSON, not error status
    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=60",
      },
      body: JSON.stringify({
        success: true,
        data: {
          address,
          value: 0,
          updateUnixTime: Math.floor(Date.now() / 1000),
        },
        source: "fallback",
        error: "Failed to fetch from Birdeye - using fallback",
      }),
    };
  }
};
