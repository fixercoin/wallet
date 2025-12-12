export const config = {
  runtime: "nodejs_esmsh",
};

const TOKEN_MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
  FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
  LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
  FXM: "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump",
} as const;

const FALLBACK_RATES: Record<string, number> = {
  FIXERCOIN: 0.00005600,
  SOL: 149.38,
  USDC: 1.0,
  USDT: 1.0,
  LOCKER: 0.00001112,
  FXM: 0.000003567,
};

const PKR_PER_USD = 280;
const MARKUP = 1.0425;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

interface DexscreenerResponse {
  pairs: Array<{
    baseToken: { address: string };
    priceUsd?: string;
  }>;
}

const MINT_TO_PAIR_ADDRESS: Record<string, string> = {
  H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump:
    "5CgLEWq9VJUEQ8my8UaxEovuSWArGoXCvaftpbX4RQMy",
  EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump:
    "7X7KkV94Y9jFhkXEMhgVcMHMRzALiGj5xKmM6TT3cUvK",
  "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump":
    "BczJ8jo8Xghx2E6G3QKZiHQ6P5xYa5xP4oWc1F5HPXLX",
};

const MINT_TO_SEARCH_SYMBOL: Record<string, string> = {
  H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: "FIXERCOIN",
  EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: "LOCKER",
  "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump": "FXM",
};

function timeoutFetch(
  resource: string,
  options: RequestInit = {},
  ms = 8000,
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
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
    },
    overrides,
  );
}

async function fetchTokenPriceFromDexScreener(
  mint: string,
): Promise<number | null> {
  const pairAddress = MINT_TO_PAIR_ADDRESS[mint];
  if (pairAddress) {
    try {
      const pairUrl = `https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`;
      const response = await timeoutFetch(pairUrl, {
        signal: new AbortController().signal,
        headers: browserHeaders(),
      });

      if (response.ok) {
        const data = (await response.json()) as DexscreenerResponse;
        if (data.pairs && data.pairs.length > 0) {
          const priceUsd = data.pairs[0].priceUsd;
          if (priceUsd) {
            const price = parseFloat(priceUsd);
            return price;
          }
        }
      }
    } catch {
      // Continue to next method
    }
  }

  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
    const response = await timeoutFetch(url, {
      signal: new AbortController().signal,
      headers: browserHeaders(),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as DexscreenerResponse;

    if (data.pairs && data.pairs.length > 0) {
      const priceUsd = data.pairs[0].priceUsd;
      if (priceUsd) {
        const price = parseFloat(priceUsd);
        return price;
      }
    }

    const searchSymbol = MINT_TO_SEARCH_SYMBOL[mint];
    if (searchSymbol) {
      try {
        const searchUrl = `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(searchSymbol)}`;
        const searchResponse = await timeoutFetch(searchUrl, {
          signal: new AbortController().signal,
          headers: browserHeaders(),
        });

        if (searchResponse.ok) {
          const searchData =
            (await searchResponse.json()) as DexscreenerResponse;
          if (searchData.pairs && searchData.pairs.length > 0) {
            let matchingPair = searchData.pairs.find(
              (p) =>
                p.baseToken?.address === mint &&
                (p as any).chainId === "solana",
            );

            if (!matchingPair) {
              matchingPair = searchData.pairs.find(
                (p) =>
                  (p as any).quoteToken?.address === mint &&
                  (p as any).chainId === "solana",
              );
            }

            if (!matchingPair) {
              matchingPair = searchData.pairs.find(
                (p) => p.baseToken?.address === mint,
              );
            }

            if (!matchingPair) {
              matchingPair = searchData.pairs.find(
                (p) => (p as any).quoteToken?.address === mint,
              );
            }

            if (!matchingPair) {
              matchingPair = searchData.pairs[0];
            }

            if (matchingPair && matchingPair.priceUsd) {
              const price = parseFloat(matchingPair.priceUsd);
              return price;
            }
          }
        }
      } catch {
        // Continue to fallback
      }
    }

    return null;
  } catch {
    return null;
  }
}

export const onRequest = async ({ request }: { request: Request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  try {
    const url = new URL(request.url);
    let token = (url.searchParams.get("token") as string) || "FIXERCOIN";
    token = token.split(":")[0].toUpperCase();

    let priceUsd: number | null = null;

    if (token === "FIXERCOIN") {
      priceUsd = await fetchTokenPriceFromDexScreener(TOKEN_MINTS.FIXERCOIN);
    } else if (token === "SOL") {
      priceUsd = await fetchTokenPriceFromDexScreener(TOKEN_MINTS.SOL);
    } else if (token === "USDC" || token === "USDT") {
      priceUsd = 1.0;
    } else if (token === "LOCKER") {
      priceUsd = await fetchTokenPriceFromDexScreener(TOKEN_MINTS.LOCKER);
    } else if (token === "FXM") {
      priceUsd = await fetchTokenPriceFromDexScreener(TOKEN_MINTS.FXM);
    }

    if (priceUsd === null || priceUsd <= 0) {
      priceUsd = FALLBACK_RATES[token] || FALLBACK_RATES.FIXERCOIN;
    }

    const rateInPKR = priceUsd * PKR_PER_USD * MARKUP;

    return new Response(
      JSON.stringify({
        token,
        priceUsd,
        priceInPKR: rateInPKR,
        rate: rateInPKR,
        pkkPerUsd: PKR_PER_USD,
        markup: MARKUP,
      }),
      {
        status: 200,
        headers: CORS_HEADERS,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch exchange rate",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: CORS_HEADERS,
      },
    );
  }
};
