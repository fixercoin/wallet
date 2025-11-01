import { RequestHandler } from "express";

// Token mint addresses for Solana mainnet (imported from shared constants)
const TOKEN_MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
  FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
  LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
} as const;

const FALLBACK_RATES: Record<string, number> = {
  FIXERCOIN: 0.005, // $0.005 per FIXERCOIN
  SOL: 180, // $180 per SOL
  USDC: 1.0, // $1 USDC
  USDT: 1.0, // $1 USDT
  LOCKER: 0.1, // $0.1 per LOCKER
};

const PKR_PER_USD = 280; // Approximate conversion rate
const MARKUP = 1.0425; // 4.25% markup

interface DexscreenerResponse {
  pairs: Array<{
    baseToken: { address: string };
    priceUsd?: string;
  }>;
}

const MINT_TO_PAIR_ADDRESS: Record<string, string> = {
  "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump": "5CgLEWq9VJUEQ8my8UaxEovuSWArGoXCvaftpbX4RQMy", // FIXERCOIN
};

const MINT_TO_SEARCH_SYMBOL: Record<string, string> = {
  "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump": "FIXERCOIN",
  "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump": "LOCKER",
};

async function fetchTokenPriceFromDexScreener(
  mint: string,
): Promise<number | null> {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
    console.log(`[DexScreener] Fetching price for ${mint} from: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        `[DexScreener] ❌ API returned ${response.status} for mint ${mint}`,
      );
      return null;
    }

    const data = (await response.json()) as DexscreenerResponse;
    console.log(
      `[DexScreener] Response received for ${mint}:`,
      JSON.stringify(data).substring(0, 200),
    );

    if (data.pairs && data.pairs.length > 0) {
      const priceUsd = data.pairs[0].priceUsd;
      if (priceUsd) {
        const price = parseFloat(priceUsd);
        console.log(`[DexScreener] ✅ Got price for ${mint}: $${price}`);
        return price;
      }
    }

    // Fallback: try search-based lookup for specific tokens
    const searchSymbol = MINT_TO_SEARCH_SYMBOL[mint];
    if (searchSymbol) {
      console.log(
        `[DexScreener] No pairs found, trying search fallback for ${searchSymbol}`,
      );
      try {
        const searchUrl = `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(searchSymbol)}`;
        const searchController = new AbortController();
        const searchTimeoutId = setTimeout(() => searchController.abort(), 8000);

        const searchResponse = await fetch(searchUrl, {
          signal: searchController.signal,
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
          },
        });
        clearTimeout(searchTimeoutId);

        if (searchResponse.ok) {
          const searchData = (await searchResponse.json()) as DexscreenerResponse;
          if (searchData.pairs && searchData.pairs.length > 0) {
            // Look for pairs where this token is the base on Solana
            let matchingPair = searchData.pairs.find(
              (p) =>
                p.baseToken?.address === mint &&
                (p as any).chainId === "solana",
            );

            // If not found as base on Solana, try as quote token on Solana
            if (!matchingPair) {
              matchingPair = searchData.pairs.find(
                (p) =>
                  (p as any).quoteToken?.address === mint &&
                  (p as any).chainId === "solana",
              );
            }

            // If still not found on Solana, try any chain as base
            if (!matchingPair) {
              matchingPair = searchData.pairs.find(
                (p) => p.baseToken?.address === mint,
              );
            }

            // If still not found, try as quote on any chain
            if (!matchingPair) {
              matchingPair = searchData.pairs.find(
                (p) => (p as any).quoteToken?.address === mint,
              );
            }

            // Last resort: just take the first result
            if (!matchingPair) {
              matchingPair = searchData.pairs[0];
            }

            if (matchingPair && matchingPair.priceUsd) {
              const price = parseFloat(matchingPair.priceUsd);
              console.log(
                `[DexScreener] ✅ Got price for ${mint} via search: $${price}`,
              );
              return price;
            }
          }
        }
      } catch (searchErr) {
        console.warn(
          `[DexScreener] Search fallback failed:`,
          searchErr instanceof Error ? searchErr.message : String(searchErr),
        );
      }
    }

    console.warn(`[DexScreener] No pairs found in response for ${mint}`);
    return null;
  } catch (error) {
    console.error(
      `[DexScreener] ❌ Failed to fetch ${mint}:`,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

export const handleExchangeRate: RequestHandler = async (req, res) => {
  try {
    const token = (req.query.token as string) || "FIXERCOIN";

    let priceUsd: number | null = null;

    // Fetch price from DexScreener based on token
    if (token === "FIXERCOIN") {
      priceUsd = await fetchTokenPriceFromDexScreener(TOKEN_MINTS.FIXERCOIN);
    } else if (token === "SOL") {
      priceUsd = await fetchTokenPriceFromDexScreener(TOKEN_MINTS.SOL);
    } else if (token === "USDC" || token === "USDT") {
      // Stablecoins are always ~1 USD
      priceUsd = 1.0;
    } else if (token === "LOCKER") {
      priceUsd = await fetchTokenPriceFromDexScreener(TOKEN_MINTS.LOCKER);
    }

    // Fall back to hardcoded rates if DexScreener fetch fails or price is invalid
    if (priceUsd === null || priceUsd <= 0) {
      priceUsd = FALLBACK_RATES[token] || FALLBACK_RATES.FIXERCOIN;
      console.log(
        `[ExchangeRate] Using fallback rate for ${token}: $${priceUsd}`,
      );
    } else {
      console.log(
        `[ExchangeRate] Fetched ${token} price from DexScreener: $${priceUsd}`,
      );
    }

    // Convert to PKR with markup
    const rateInPKR = priceUsd * PKR_PER_USD * MARKUP;

    console.log(
      `[ExchangeRate] ${token}: $${priceUsd.toFixed(6)} USD -> ${rateInPKR.toFixed(2)} PKR (with ${(MARKUP - 1) * 100}% markup)`,
    );

    res.json({
      token,
      priceUsd,
      priceInPKR: rateInPKR,
      rate: rateInPKR,
      pkkPerUsd: PKR_PER_USD,
      markup: MARKUP,
    });
  } catch (error) {
    console.error("[ExchangeRate] Error:", error);
    res.status(500).json({
      error: "Failed to fetch exchange rate",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
