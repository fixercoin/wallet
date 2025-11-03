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
  FIXERCOIN: 0.005,
  SOL: 180,
  USDC: 1.0,
  USDT: 1.0,
  LOCKER: 0.1,
};

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

    try {
      if (token === "USDC" || token === "USDT") {
        priceUsd = 1.0;
      } else if (mint) {
        const pairAddress = MINT_TO_PAIR_ADDRESS[mint];
        if (pairAddress) {
          try {
            const pairData = await fetchDexscreenerData(
              `/pairs/solana/${pairAddress}`,
            );
            const pair = pairData?.pair || (pairData?.pairs || [])[0] || null;
            if (pair && pair.priceUsd) {
              priceUsd = parseFloat(pair.priceUsd);
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

            let matchingPair = null;

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
    }

    const rateInPKR = priceUsd * PKR_PER_USD * MARKUP;

    return res.json({
      token,
      priceUsd,
      priceInPKR: rateInPKR,
      rate: rateInPKR,
      pkrPerUsd: PKR_PER_USD,
      markup: MARKUP,
    });
  } catch (error) {
    console.error(`[Token Price] Handler error:`, error);
    return res.status(500).json({
      error: "Failed to get token price",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};
