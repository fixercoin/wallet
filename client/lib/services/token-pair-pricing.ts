import { birdeyeAPI } from "./birdeye";
import { solPriceService } from "./sol-price";

export interface PairPricingData {
  tokenAddress: string;
  tokenSymbol: string;
  solPrice: number; // SOL price in USD
  pairRatio: number; // How many tokens per 1 SOL
  derivedPrice: number; // Token price in USD = solPrice / pairRatio
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  lastUpdated: Date;
}

// Tokens that should use Birdeye for live pricing
const BIRDEYE_TOKENS = new Set(["FIXERCOIN", "LOCKER", "FXM"]);

const TOKEN_CONFIGS: Record<
  string,
  {
    mint: string;
    symbol: string;
    name: string;
    pairAddress?: string;
  }
> = {
  FIXERCOIN: {
    mint: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
    symbol: "FIXERCOIN",
    name: "FIXERCOIN",
    pairAddress: undefined, // Will try to find automatically
  },
  LOCKER: {
    mint: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
    symbol: "LOCKER",
    name: "LOCKER",
    pairAddress: undefined,
  },
  FXM: {
    mint: "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump",
    symbol: "FXM",
    name: "FXM",
    pairAddress: undefined,
  },
};

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns";

// Fallback prices if derivation fails - Updated to real-time market prices
const FALLBACK_PRICES: Record<string, number> = {
  FIXERCOIN: 0.00008139, // Real-time market price
  LOCKER: 0.00001112, // Real-time market price
  FXM: 0.000003567, // Real-time market price
};

class TokenPairPricingService {
  private cache = new Map<
    string,
    { data: PairPricingData; expiresAt: number }
  >();
  private readonly CACHE_DURATION = 250; // 250ms - ensures live price updates every 250ms for real-time display

  /**
   * Get SOL price in USD from reliable dedicated service
   */
  private async getSolPrice(): Promise<number> {
    try {
      // Use dedicated SOL price service which has better error handling and fallbacks (with timeout)
      const solPriceData = await Promise.race([
        solPriceService.getSolPrice(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("SOL price fetch timeout")), 10000),
        ),
      ] as const);

      if (
        solPriceData &&
        solPriceData.price > 0 &&
        isFinite(solPriceData.price)
      ) {
        console.log(
          `[TokenPairPricing] SOL price from solPriceService: $${solPriceData.price}`,
        );
        return solPriceData.price;
      }
    } catch (error) {
      console.warn(
        "[TokenPairPricing] Error/timeout fetching SOL price from service:",
        error instanceof Error ? error.message : error,
      );
    }

    // Fallback 1: Try DexScreener as backup (with timeout)
    try {
      const solToken = await Promise.race([
        dexscreenerAPI.getTokenByMint(SOL_MINT),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("DexScreener SOL fetch timeout")),
            8000,
          ),
        ),
      ] as const);

      if (solToken && solToken.priceUsd) {
        const price = parseFloat(solToken.priceUsd);
        if (isFinite(price) && price > 0) {
          console.log(
            `[TokenPairPricing] SOL price from DexScreener (fallback 1): $${price}`,
          );
          return price;
        }
      }
    } catch (error) {
      console.warn(
        "[TokenPairPricing] Error/timeout fetching SOL price from DexScreener:",
        error instanceof Error ? error.message : error,
      );
    }

    // Final fallback - use a more reasonable default
    console.warn("[TokenPairPricing] Using hardcoded SOL price fallback: $150");
    return 150;
  }

  /**
   * Get the SOL pair price (how many SOL needed to buy 1 token) with timeout
   */
  private async getSolPairPrice(tokenMint: string): Promise<number | null> {
    try {
      // Fetch token data with timeout
      const tokenData = await Promise.race([
        dexscreenerAPI.getTokenByMint(tokenMint),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("DexScreener getTokenByMint timeout")),
            12000,
          ),
        ),
      ] as const);

      if (!tokenData) {
        console.warn(`No trading data found for ${tokenMint}`);
        return null;
      }

      // Use priceNative which is the price in SOL (the native pair token on Solana)
      // priceNative = how many SOL you need to buy 1 token
      if (tokenData.priceNative) {
        const priceInSol = parseFloat(tokenData.priceNative);

        if (priceInSol > 0 && isFinite(priceInSol)) {
          console.log(
            `${tokenMint}: priceNative=${priceInSol.toFixed(8)} SOL (1 token = ${priceInSol.toFixed(8)} SOL)`,
          );
          return priceInSol; // Return the SOL price directly
        } else {
          console.warn(`Invalid priceNative for ${tokenMint}: ${priceInSol}`);
        }
      }

      return null;
    } catch (error) {
      console.warn(
        `Error/timeout getting SOL pair price for ${tokenMint}:`,
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  /**
   * Get direct USD price from DexScreener for tokens without reliable SOL pair (with timeout)
   */
  private async getDirectUsdPrice(tokenMint: string): Promise<number | null> {
    try {
      // Fetch token data with timeout
      const tokenData = await Promise.race([
        dexscreenerAPI.getTokenByMint(tokenMint),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("DexScreener getDirectUsdPrice timeout")),
            12000,
          ),
        ),
      ] as const);

      if (!tokenData) {
        return null;
      }

      if (tokenData.priceUsd) {
        const priceUsd = parseFloat(tokenData.priceUsd);
        if (priceUsd > 0 && isFinite(priceUsd)) {
          console.log(
            `${tokenMint}: Got direct USD price from DexScreener: $${priceUsd.toFixed(8)}`,
          );
          return priceUsd;
        }
      }

      return null;
    } catch (error) {
      console.warn(
        `Error/timeout getting direct USD price for ${tokenMint}:`,
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  /**
   * Calculate derived price for a token based on its SOL pair
   */
  async getDerivedPrice(symbol: string): Promise<PairPricingData | null> {
    const config = TOKEN_CONFIGS[symbol];
    if (!config) {
      console.warn(`Unknown token: ${symbol}`);
      return null;
    }

    // Check cache first
    const cached = this.cache.get(config.mint);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`Returning cached ${symbol} price data`);
      return cached.data;
    }

    try {
      console.log(`Fetching derived price for ${symbol}...`);

      // Get SOL price in USD
      const solPrice = await this.getSolPrice();

      // Get the SOL pair price (how many SOL to buy 1 token)
      let priceInSol = await this.getSolPairPrice(config.mint);

      // If no SOL pair found, try direct USD price from DexScreener
      if (!priceInSol || priceInSol <= 0) {
        console.warn(
          `Could not determine SOL pair for ${symbol}, trying direct USD price...`,
        );
        const directUsdPrice = await this.getDirectUsdPrice(config.mint);

        if (directUsdPrice && directUsdPrice > 0 && isFinite(directUsdPrice)) {
          // Use direct USD price, fetching additional metadata from DexScreener
          const tokenData = await dexscreenerAPI.getTokenByMint(config.mint);

          const priceData: PairPricingData = {
            tokenAddress: config.mint,
            tokenSymbol: symbol,
            solPrice,
            pairRatio: solPrice / directUsdPrice, // How many tokens per 1 SOL
            derivedPrice: directUsdPrice,
            priceChange24h: tokenData?.priceChange?.h24 || 0,
            volume24h: tokenData?.volume?.h24 || 0,
            liquidity: tokenData?.liquidity?.usd || 0,
            lastUpdated: new Date(),
          };

          // Cache the result
          this.cache.set(config.mint, {
            data: priceData,
            expiresAt: Date.now() + this.CACHE_DURATION,
          });

          console.log(
            `${symbol} direct USD price: $${priceData.derivedPrice.toFixed(8)}`,
          );

          return priceData;
        }

        console.warn(
          `Could not determine price (SOL pair or USD price) for ${symbol} - API unavailable`,
        );
        return null;
      }

      // Calculate token price in USD by multiplying SOL price by the SOL ratio
      // derivedPrice = (how many SOL per token) * (SOL price in USD)
      const derivedPrice = priceInSol * solPrice;

      if (derivedPrice <= 0) {
        console.warn(`Invalid derived price for ${symbol}: ${derivedPrice}`);
        return null;
      }

      // Fetch additional metadata from DexScreener (with timeout)
      let tokenData = null;
      try {
        tokenData = await Promise.race([
          dexscreenerAPI.getTokenByMint(config.mint),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("DexScreener metadata fetch timeout")),
              10000,
            ),
          ),
        ] as const);
      } catch (error) {
        console.warn(
          `[TokenPairPricing] Timeout fetching metadata for ${config.mint}`,
        );
        // Continue without metadata - we already have the price
      }

      const priceData: PairPricingData = {
        tokenAddress: config.mint,
        tokenSymbol: symbol,
        solPrice,
        pairRatio: 1 / priceInSol, // How many tokens per 1 SOL
        derivedPrice: derivedPrice,
        priceChange24h: tokenData?.priceChange?.h24 || 0,
        volume24h: tokenData?.volume?.h24 || 0,
        liquidity: tokenData?.liquidity?.usd || 0,
        lastUpdated: new Date(),
      };

      // Cache the result
      this.cache.set(config.mint, {
        data: priceData,
        expiresAt: Date.now() + this.CACHE_DURATION,
      });

      console.log(
        `${symbol} derived price: $${priceData.derivedPrice.toFixed(8)} (1 ${symbol} = ${priceInSol.toFixed(8)} SOL, SOL = $${solPrice.toFixed(2)})`,
      );

      return priceData;
    } catch (error) {
      console.error(`Error calculating derived price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get FIXERCOIN, LOCKER, and FXM prices
   */
  async getAllDerivedPrices(): Promise<Record<string, PairPricingData | null>> {
    const [fixercoinData, lockerData, fxmData] = await Promise.all([
      this.getDerivedPrice("FIXERCOIN"),
      this.getDerivedPrice("LOCKER"),
      this.getDerivedPrice("FXM"),
    ]);

    return {
      FIXERCOIN: fixercoinData,
      LOCKER: lockerData,
      FXM: fxmData,
    };
  }

  /**
   * Clear cache to force fresh fetch
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for a specific token
   */
  clearTokenCache(symbol: string): void {
    const config = TOKEN_CONFIGS[symbol];
    if (config) {
      this.cache.delete(config.mint);
    }
  }
}

export const tokenPairPricingService = new TokenPairPricingService();
