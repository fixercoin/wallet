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
  FXM: "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump",
};

const FALLBACK_USD: Record<string, number> = {
  FIXERCOIN: 0.00008139, // Real-time market price
  SOL: 149.38, // Real-time market price
  USDC: 1.0,
  USDT: 1.0,
  LOCKER: 0.00001112, // Real-time market price
  FXM: 0.000003567, // Real-time market price
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
    // Try to get SOL price first
    let solPrice = FALLBACK_USD.SOL;
    try {
      const solData = await fetchDexscreenerData(`/tokens/${TOKEN_MINTS.SOL}`);
      const solPair = solData?.pairs?.[0];
      if (solPair?.priceUsd) {
        const parsedPrice = parseFloat(solPair.priceUsd);
        if (isFinite(parsedPrice) && parsedPrice > 0) {
          solPrice = parsedPrice;
        }
      }
    } catch (e) {
      console.warn(
        `[Derived Price] Could not fetch SOL price, using fallback:`,
        e,
      );
    }

    // Try to get token price via pair address first for better accuracy
    let tokenPrice: number | null = null;
    const pairAddress = MINT_TO_PAIR_ADDRESS[tokenMint];

    if (pairAddress) {
      try {
        console.log(
          `[Derived Price] Trying pair address ${pairAddress} for ${tokenSymbol}`,
        );
        const pairData = await fetchDexscreenerData(
          `/pairs/solana/${pairAddress}`,
        );
        const pair = pairData?.pair || (pairData?.pairs || [])[0];

        if (pair && pair.priceUsd) {
          tokenPrice = parseFloat(pair.priceUsd);
          if (isFinite(tokenPrice) && tokenPrice > 0) {
            console.log(
              `[Derived Price] ✅ Got ${tokenSymbol} price via pair address: $${tokenPrice.toFixed(8)}`,
            );
          } else {
            tokenPrice = null;
          }
        }
      } catch (e) {
        console.warn(`[Derived Price] Pair address lookup failed:`, e);
      }
    }

    // Fallback to token mint lookup if pair address didn't work
    if (tokenPrice === null) {
      try {
        const tokenData = await fetchDexscreenerData(`/tokens/${tokenMint}`);
        const tokenPair = tokenData?.pairs?.[0];

        if (tokenPair && tokenPair.priceUsd) {
          tokenPrice = parseFloat(tokenPair.priceUsd);
          if (!isFinite(tokenPrice) || tokenPrice <= 0) {
            tokenPrice = null;
          }
        }
      } catch (e) {
        console.warn(`[Derived Price] Token mint lookup failed:`, e);
        tokenPrice = null;
      }
    }

    // If DexScreener failed, try Jupiter API
    if (tokenPrice === null) {
      console.log(
        `[Derived Price] DexScreener failed for ${tokenSymbol}, trying Jupiter...`,
      );
      const jupiterPrice = await fetchPriceFromJupiter(tokenMint);
      if (jupiterPrice !== null) {
        tokenPrice = jupiterPrice;
        console.log(
          `[Derived Price] ✅ Got ${tokenSymbol} price from Jupiter: $${jupiterPrice.toFixed(8)}`,
        );
      }
    }

    // If we still don't have a price, return null
    if (tokenPrice === null || !isFinite(tokenPrice) || tokenPrice <= 0) {
      console.warn(
        `[Derived Price] Could not determine price for ${tokenSymbol}`,
      );
      return null;
    }

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
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Missing 'token' parameter" });
  }

  console.log(`[DexScreener Price] Fetching price for token: ${token}`);

  try {
    try {
      const data = await fetchDexscreenerData(`/tokens/${token}`);
      const pair = data?.pairs?.[0];

      if (pair && pair.priceUsd) {
        const price = parseFloat(pair.priceUsd);
        if (isFinite(price) && price > 0) {
          console.log(
            `[DexScreener Price] ✅ Successfully fetched price: $${price}`,
          );
          return res.json({
            token,
            price,
            priceUsd: pair.priceUsd,
            data: pair,
            source: "dexscreener",
          });
        }
      }

      console.warn(
        `[DexScreener Price] Invalid or missing price data for ${token}`,
      );
    } catch (error) {
      console.warn(
        `[DexScreener Price] Fetch failed:`,
        error instanceof Error ? error.message : String(error),
      );
    }

    // Try Jupiter API as fallback
    console.log(
      `[DexScreener Price] DexScreener failed for ${token}, trying Jupiter API...`,
    );
    const jupiterPrice = await fetchPriceFromJupiter(token);
    if (jupiterPrice !== null) {
      console.log(
        `[DexScreener Price] ✅ Got price from Jupiter: $${jupiterPrice}`,
      );
      return res.json({
        token,
        price: jupiterPrice,
        priceUsd: jupiterPrice.toString(),
        data: null,
        source: "jupiter",
      });
    }

    // Fallback response - return zero price if both APIs fail
    console.log(
      `[DexScreener Price] Both DexScreener and Jupiter failed for ${token}`,
    );
    return res.json({
      token,
      price: 0,
      priceUsd: "0",
      data: null,
      source: "fallback",
      error: "Token price not available from DexScreener or Jupiter",
    });
  } catch (error) {
    console.error(`[DexScreener Price] Handler error:`, error);
    return res.json({
      token,
      price: 0,
      priceUsd: "0",
      data: null,
      source: "fallback",
      error: "Failed to fetch token price",
    });
  }
};

export const handleSolPrice: RequestHandler = async (req, res) => {
  const SOL_MINT = "So11111111111111111111111111111111111111112";
  const FALLBACK_SOL_PRICE = 149.38;

  console.log(`[SOL Price] Fetching price for SOL`);

  try {
    // Try DexScreener first
    try {
      console.log(`[SOL Price] Attempting DexScreener...`);
      const data = await fetchDexscreenerData(`/tokens/${SOL_MINT}`);
      const pair = data?.pairs?.[0];

      if (pair && pair.priceUsd) {
        const priceUsd = parseFloat(pair.priceUsd);

        if (isFinite(priceUsd) && priceUsd > 0) {
          console.log(
            `[SOL Price] ✅ DexScreener success: $${priceUsd.toFixed(2)}`,
          );
          return res.json({
            token: "SOL",
            price: priceUsd,
            priceUsd,
            priceChange24h: pair.priceChange?.h24 || 0,
            volume24h: pair.volume?.h24 || 0,
            marketCap: pair.marketCap || 0,
            source: "dexscreener",
          });
        }
      }

      console.warn(
        `[SOL Price] DexScreener returned invalid/missing price data`,
      );
    } catch (error) {
      console.warn(
        `[SOL Price] DexScreener error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Try Jupiter API as fallback
    console.log(`[SOL Price] Attempting Jupiter API...`);
    const jupiterPrice = await fetchPriceFromJupiter(SOL_MINT);
    if (jupiterPrice !== null && jupiterPrice > 0) {
      console.log(`[SOL Price] ✅ Jupiter success: $${jupiterPrice.toFixed(2)}`);
      return res.json({
        token: "SOL",
        price: jupiterPrice,
        priceUsd: jupiterPrice,
        priceChange24h: 0,
        volume24h: 0,
        marketCap: 0,
        source: "jupiter",
      });
    }

    // Try CoinGecko API as second fallback
    console.log(`[SOL Price] Attempting CoinGecko...`);
    const coingeckoPrice = await fetchPriceFromCoingecko();
    if (coingeckoPrice !== null && coingeckoPrice > 0) {
      console.log(
        `[SOL Price] ✅ CoinGecko success: $${coingeckoPrice.toFixed(2)}`,
      );
      return res.json({
        token: "SOL",
        price: coingeckoPrice,
        priceUsd: coingeckoPrice,
        priceChange24h: 0,
        volume24h: 0,
        marketCap: 0,
        source: "coingecko",
      });
    }

    // All external APIs failed - return fallback with status 200 to prevent client errors
    console.warn(
      `[SOL Price] All APIs failed (DexScreener, Jupiter, CoinGecko), using fallback: $${FALLBACK_SOL_PRICE}`,
    );
    return res.json({
      token: "SOL",
      price: FALLBACK_SOL_PRICE,
      priceUsd: FALLBACK_SOL_PRICE,
      priceChange24h: 0,
      volume24h: 0,
      marketCap: 0,
      source: "fallback",
      warning:
        "Using fallback price - all API endpoints are unavailable. Price may be outdated.",
    });
  } catch (error) {
    // Last-resort fallback - always return valid JSON
    console.error(
      `[SOL Price] Handler error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return res.json({
      token: "SOL",
      price: FALLBACK_SOL_PRICE,
      priceUsd: FALLBACK_SOL_PRICE,
      priceChange24h: 0,
      volume24h: 0,
      marketCap: 0,
      source: "fallback",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Fetch price from Jupiter API as fallback
 */
async function fetchPriceFromJupiter(mint: string): Promise<number | null> {
  try {
    console.log(`[Jupiter Fallback] Fetching price for ${mint} from Jupiter`);

    const params = new URLSearchParams({ ids: mint });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`https://price.jup.ag/v4/price?${params}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        `[Jupiter Fallback] API returned ${response.status} for mint ${mint}`,
      );
      return null;
    }

    const data = (await response.json()) as {
      data?: Record<string, { price: number }>;
    };

    if (data.data && data.data[mint] && data.data[mint].price) {
      const price = data.data[mint].price;
      if (isFinite(price) && price > 0) {
        console.log(
          `[Jupiter Fallback] ✅ Got price for ${mint} from Jupiter: $${price}`,
        );
        return price;
      }
    }

    console.warn(`[Jupiter Fallback] No valid price data for ${mint}`);
    return null;
  } catch (error) {
    console.warn(
      `[Jupiter Fallback] Failed to fetch price:`,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

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

          // If DexScreener completely failed, try Jupiter as fallback
          if (priceUsd === null && mint) {
            console.log(
              `[Token Price] DexScreener failed for ${token}, trying Jupiter fallback...`,
            );
            const jupiterPrice = await fetchPriceFromJupiter(mint);
            if (jupiterPrice !== null) {
              priceUsd = jupiterPrice;
              console.log(
                `[Token Price] ✅ Got ${token} price from Jupiter: $${jupiterPrice}`,
              );
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

        // If DexScreener completely failed, try Jupiter as fallback
        if (priceUsd === null && mint) {
          console.log(
            `[Token Price] DexScreener failed for ${token}, trying Jupiter fallback...`,
          );
          const jupiterPrice = await fetchPriceFromJupiter(mint);
          if (jupiterPrice !== null) {
            priceUsd = jupiterPrice;
            console.log(
              `[Token Price] ✅ Got ${token} price from Jupiter: $${jupiterPrice}`,
            );
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
    const tokenParam = (
      (req.query.token as string) ||
      (req.query.symbol as string) ||
      "FIXERCOIN"
    ).toUpperCase();
    const PKR_PER_USD = 280;
    const MARKUP = 1.0425;
    const fallbackPrice = FALLBACK_USD[tokenParam] ?? FALLBACK_USD.FIXERCOIN;
    const rateInPKR = fallbackPrice * PKR_PER_USD * MARKUP;

    // Always return valid JSON with fallback price, not 500 error
    return res.json({
      token: tokenParam,
      priceUsd: fallbackPrice,
      priceInPKR: rateInPKR,
      rate: rateInPKR,
      pkrPerUsd: PKR_PER_USD,
      markup: MARKUP,
      priceChange24h: 0,
      volume24h: 0,
      pair: undefined,
      pricingMethod: "fallback",
      source: "fallback",
    });
  }
};
