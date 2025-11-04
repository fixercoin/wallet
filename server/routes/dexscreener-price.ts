import { RequestHandler } from "express";

// Import the shared fetch function from dexscreener-proxy
import {
  fetchDexscreenerData,
  MINT_TO_PAIR_ADDRESS,
} from "./dexscreener-proxy";

interface DexscreenerToken {
  chainId: string;
  baseToken: {
    address: string;
    symbol?: string;
  };
  quoteToken: {
    address: string;
  };
  priceUsd?: string;
  priceChange?: {
    h24?: number;
  };
  volume?: {
    h24?: number;
  };
  marketCap?: number;
}

const TOKEN_MINTS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
  FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
  LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
};

const FALLBACK_USD: Record<string, number> = {
  FIXERCOIN: 0.00007297, // Updated to real market price
  SOL: 150, // Updated fallback (previously was 180)
  USDC: 1.0,
  USDT: 1.0,
  LOCKER: 0.00001, // Updated fallback
};

/**
 * Derive token price from its SOL trading pair
 * If 1 SOL = X tokens, then 1 token = SOL price / X
 */
async function getDerivedTokenPrice(
  tokenMint: string,
  tokenSymbol: string,
): Promise<{ price: number; pairRatio: number } | null> {
  try {
    // Get SOL price
    const solData = await fetchDexscreenerData(`/tokens/${TOKEN_MINTS.SOL}`);
    const solPair = solData?.pairs?.[0];
    const solPrice = solPair?.priceUsd
      ? parseFloat(solPair.priceUsd)
      : FALLBACK_USD.SOL;

    // Get token price (this gives us the direct USDT price from any pair)
    const tokenData = await fetchDexscreenerData(`/tokens/${tokenMint}`);
    const tokenPair = tokenData?.pairs?.[0];

    if (!tokenPair || !tokenPair.priceUsd) {
      return null;
    }

    const tokenPrice = parseFloat(tokenPair.priceUsd);

    // Calculate how many tokens per 1 SOL
    // pairRatio = SOL price / token price = how many tokens you get for 1 SOL
    const pairRatio = solPrice / tokenPrice;

    console.log(
      `[Derived Price] ${tokenSymbol}: 1 SOL = ${pairRatio.toFixed(2)} tokens, 1 token = $${tokenPrice.toFixed(8)}`,
    );

    return {
      price: tokenPrice,
      pairRatio,
    };
  } catch (error) {
    console.warn(
      `[Derived Price] Error calculating derived price for ${tokenSymbol}:`,
      error,
    );
    return null;
  }
}

export const handleDexscreenerPrice: RequestHandler = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Missing 'token' parameter" });
    }

    console.log(`[DexScreener Price] Fetching price for token: ${token}`);

    try {
      const data = await fetchDexscreenerData(`/tokens/${token}`);
      const pair = data?.pairs?.[0];

      if (!pair) {
        return res
          .status(404)
          .json({ error: "Token not found on DexScreener" });
      }

      return res.json({
        token,
        price: parseFloat(pair.priceUsd || "0"),
        priceUsd: pair.priceUsd,
        data: pair,
      });
    } catch (error) {
      console.error(`[DexScreener Price] Fetch error:`, error);
      return res.status(502).json({
        error: "Failed to fetch token price from DexScreener",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    console.error(`[DexScreener Price] Handler error:`, error);
    return res.status(500).json({
      error: "Failed to process price request",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export const handleSolPrice: RequestHandler = async (req, res) => {
  try {
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    console.log(`[SOL Price] Fetching price for SOL`);

    try {
      const data = await fetchDexscreenerData(`/tokens/${SOL_MINT}`);
      const pair = data?.pairs?.[0];

      if (!pair) {
        return res.status(404).json({ error: "SOL price data not found" });
      }

      const priceUsd = parseFloat(pair.priceUsd || "0");

      return res.json({
        token: "SOL",
        price: priceUsd,
        priceUsd,
        priceChange24h: pair.priceChange?.h24 || 0,
        volume24h: pair.volume?.h24 || 0,
        marketCap: pair.marketCap || 0,
      });
    } catch (error) {
      console.error(`[SOL Price] DexScreener fetch error:`, error);
      return res.status(502).json({
        error: "Failed to fetch SOL price",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    console.error(`[SOL Price] Handler error:`, error);
    return res.status(500).json({
      error: "Failed to fetch SOL price",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export const handleTokenPrice: RequestHandler = async (req, res) => {
  try {
    const tokenParam = (
      (req.query.token as string) ||
      (req.query.symbol as string) ||
      "FIXERCOIN"
    ).toUpperCase();
    const mintParam = (req.query.mint as string) || "";

    console.log(
      `[Token Price] Request for token: ${tokenParam}, mint: ${mintParam}`,
    );

    const PKR_PER_USD = 280;
    const MARKUP = 1.0425;

    let token = tokenParam;
    let mint = mintParam || TOKEN_MINTS[token] || "";

    if (!mint && tokenParam && tokenParam.length > 40) {
      mint = tokenParam;
      const inv = Object.entries(TOKEN_MINTS).find(([, m]) => m === mint);
      if (inv) token = inv[0];
    }

    let priceUsd: number | null = null;
    let priceChange24h: number = 0;
    let volume24h: number = 0;
    let matchingPair: DexscreenerToken | null = null;
    let derivedViaSOLPair = false;

    try {
      if (token === "USDC" || token === "USDT") {
        priceUsd = 1.0;
        priceChange24h = 0;
        volume24h = 0;
      } else if (token === "FIXERCOIN" || token === "LOCKER") {
        // Use derived pricing from SOL pair for FIXERCOIN and LOCKER
        const derived = await getDerivedTokenPrice(mint, token);
        if (derived && derived.price > 0) {
          priceUsd = derived.price;
          derivedViaSOLPair = true;
          // Try to get 24h data from DexScreener
          try {
            const tokenData = await fetchDexscreenerData(`/tokens/${mint}`);
            if (tokenData?.pairs?.[0]) {
              matchingPair = tokenData.pairs[0];
              priceChange24h = matchingPair.priceChange?.h24 || 0;
              volume24h = matchingPair.volume?.h24 || 0;
            }
          } catch (e) {
            console.warn(
              `[Token Price] Could not fetch 24h data for ${token}:`,
              e,
            );
          }
        } else if (mint) {
          // Fallback to standard lookup if derived pricing fails
          const pairAddress = MINT_TO_PAIR_ADDRESS[mint];
          if (pairAddress) {
            try {
              const pairData = await fetchDexscreenerData(
                `/pairs/solana/${pairAddress}`,
              );
              const pair = pairData?.pair || (pairData?.pairs || [])[0] || null;
              if (pair && pair.priceUsd) {
                matchingPair = pair;
                priceUsd = parseFloat(pair.priceUsd);
                priceChange24h = pair.priceChange?.h24 || 0;
                volume24h = pair.volume?.h24 || 0;
              }
            } catch (e) {
              console.warn(`[Token Price] Pair address lookup failed:`, e);
            }
          }

          if (priceUsd === null) {
            try {
              const tokenData = await fetchDexscreenerData(`/tokens/${mint}`);
              const pairs = Array.isArray(tokenData?.pairs)
                ? tokenData.pairs
                : [];

              if (pairs.length > 0) {
                matchingPair = pairs.find(
                  (p: DexscreenerToken) =>
                    p?.baseToken?.address === mint && p?.chainId === "solana",
                );

                if (!matchingPair) {
                  matchingPair = pairs.find(
                    (p: DexscreenerToken) =>
                      p?.quoteToken?.address === mint &&
                      p?.chainId === "solana",
                  );
                }

                if (!matchingPair) {
                  matchingPair = pairs.find(
                    (p: DexscreenerToken) =>
                      p?.baseToken?.address === mint ||
                      p?.quoteToken?.address === mint,
                  );
                }

                if (matchingPair && matchingPair.priceUsd) {
                  priceUsd = parseFloat(matchingPair.priceUsd);
                  priceChange24h = matchingPair.priceChange?.h24 || 0;
                  volume24h = matchingPair.volume?.h24 || 0;
                }
              }
            } catch (e) {
              console.warn(`[Token Price] Token lookup failed:`, e);
            }
          }
        }
      } else if (mint) {
        const pairAddress = MINT_TO_PAIR_ADDRESS[mint];
        if (pairAddress) {
          try {
            const pairData = await fetchDexscreenerData(
              `/pairs/solana/${pairAddress}`,
            );
            const pair = pairData?.pair || (pairData?.pairs || [])[0] || null;
            if (pair && pair.priceUsd) {
              matchingPair = pair;
              priceUsd = parseFloat(pair.priceUsd);
              priceChange24h = pair.priceChange?.h24 || 0;
              volume24h = pair.volume?.h24 || 0;
            }
          } catch (e) {
            console.warn(`[Token Price] Pair address lookup failed:`, e);
          }
        }

        if (priceUsd === null) {
          try {
            const tokenData = await fetchDexscreenerData(`/tokens/${mint}`);
            const pairs = Array.isArray(tokenData?.pairs)
              ? tokenData.pairs
              : [];

            if (pairs.length > 0) {
              matchingPair = pairs.find(
                (p: DexscreenerToken) =>
                  p?.baseToken?.address === mint && p?.chainId === "solana",
              );

              if (!matchingPair) {
                matchingPair = pairs.find(
                  (p: DexscreenerToken) =>
                    p?.quoteToken?.address === mint && p?.chainId === "solana",
                );
              }

              if (!matchingPair) {
                matchingPair = pairs.find(
                  (p: DexscreenerToken) =>
                    p?.baseToken?.address === mint ||
                    p?.quoteToken?.address === mint,
                );
              }

              if (matchingPair && matchingPair.priceUsd) {
                priceUsd = parseFloat(matchingPair.priceUsd);
                priceChange24h = matchingPair.priceChange?.h24 || 0;
                volume24h = matchingPair.volume?.h24 || 0;
              }
            }
          } catch (e) {
            console.warn(`[Token Price] Token lookup failed:`, e);
          }
        }
      }
    } catch (e) {
      console.warn(`[Token Price] Price lookup error:`, e);
    }

    if (priceUsd === null || !isFinite(priceUsd) || priceUsd <= 0) {
      priceUsd = FALLBACK_USD[token] ?? FALLBACK_USD.FIXERCOIN;
      priceChange24h = 0;
      volume24h = 0;
    }

    const rateInPKR = priceUsd * PKR_PER_USD * MARKUP;

    return res.json({
      token,
      priceUsd,
      priceInPKR: rateInPKR,
      rate: rateInPKR,
      pkrPerUsd: PKR_PER_USD,
      markup: MARKUP,
      priceChange24h,
      volume24h,
      pair: matchingPair || undefined,
      pricingMethod: derivedViaSOLPair ? "derived-from-sol-pair" : "direct",
    });
  } catch (error) {
    console.error(`[Token Price] Handler error:`, error);
    return res.status(500).json({
      error: "Failed to get token price",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};
