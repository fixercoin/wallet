import { RequestHandler } from "express";
import { TOKEN_MINTS } from "@shared/api";

const FALLBACK_RATES = {
  FIXERCOIN: 0.005, // $0.005 per FIXERCOIN -> ~1.4 PKR
  SOL: 180, // $180 per SOL -> ~50,400 PKR
  USDC: 280, // $1 USDC -> ~280 PKR
  USDT: 280, // $1 USDT -> ~280 PKR
  LOCKER: 0.1, // $0.1 per LOCKER -> ~28 PKR
};

const PKR_PER_USD = 280; // Approximate conversion rate

export const handleExchangeRate: RequestHandler = async (req, res) => {
  try {
    const token = (req.query.token as string) || "FIXERCOIN";

    // Get base price in USD
    let priceUsd: number | null = null;

    if (token === "FIXERCOIN") {
      // Fetch FIXERCOIN price from DexScreener
      try {
        const response = await fetch(
          `/api/dexscreener/tokens?mints=${TOKEN_MINTS.FIXERCOIN}`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.pairs && data.pairs.length > 0) {
            const tokenData = data.pairs[0];
            if (tokenData.priceUsd) {
              priceUsd = parseFloat(tokenData.priceUsd);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to fetch FIXERCOIN from DexScreener:", err);
      }
    } else if (token === "SOL") {
      // Fetch SOL price from DexScreener
      try {
        const response = await fetch(
          `/api/dexscreener/tokens?mints=${TOKEN_MINTS.SOL}`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.pairs && data.pairs.length > 0) {
            const tokenData = data.pairs[0];
            if (tokenData.priceUsd) {
              priceUsd = parseFloat(tokenData.priceUsd);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to fetch SOL from DexScreener:", err);
      }
    } else if (token === "USDC" || token === "USDT") {
      // Stablecoins are always ~1 USD
      priceUsd = 1.0;
    } else if (token === "LOCKER") {
      // Fetch LOCKER price from DexScreener
      try {
        const response = await fetch(
          `/api/dexscreener/tokens?mints=${TOKEN_MINTS.LOCKER}`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.pairs && data.pairs.length > 0) {
            const tokenData = data.pairs[0];
            if (tokenData.priceUsd) {
              priceUsd = parseFloat(tokenData.priceUsd);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to fetch LOCKER from DexScreener:", err);
      }
    }

    // Fall back to hardcoded rates if DexScreener fetch fails
    if (priceUsd === null || priceUsd <= 0) {
      const fallbackUsd = FALLBACK_RATES[token as keyof typeof FALLBACK_RATES];
      priceUsd = fallbackUsd || FALLBACK_RATES.FIXERCOIN;
    }

    // Convert to PKR with slight markup (4.25%)
    const MARKUP = 1.0425; // 4.25% markup
    const rateInPKR = priceUsd * PKR_PER_USD * MARKUP;

    console.log(
      `[ExchangeRate] ${token}: $${priceUsd} USD -> ${rateInPKR.toFixed(2)} PKR`,
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
