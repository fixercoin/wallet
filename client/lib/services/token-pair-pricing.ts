import { dexscreenerAPI } from "./dexscreener";
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
};

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns";

// Fallback prices if derivation fails
const FALLBACK_PRICES: Record<string, number> = {
  FIXERCOIN: 0.000089,
  LOCKER: 0.000012,
};

class TokenPairPricingService {
  private cache = new Map<
    string,
    { data: PairPricingData; expiresAt: number }
  >();
  private readonly CACHE_DURATION = 60000; // 1 minute

  /**
   * Get SOL price in USD
   */
  private async getSolPrice(): Promise<number> {
    try {
      const solToken = await dexscreenerAPI.getTokenByMint(SOL_MINT);
      if (solToken && solToken.priceUsd) {
        return parseFloat(solToken.priceUsd);
      }
    } catch (error) {
      console.warn("Error fetching SOL price:", error);
    }
    return 176; // Fallback SOL price
  }

  /**
   * Get the SOL pair price (how many tokens per 1 SOL)
   */
  private async getSolPairPrice(tokenMint: string): Promise<number | null> {
    try {
      // Fetch token data with all trading pairs
      const tokenData = await dexscreenerAPI.getTokenByMint(tokenMint);

      if (!tokenData) {
        console.warn(`No trading data found for ${tokenMint}`);
        return null;
      }

      // Look for a pair that quotes in SOL
      // Get the price in USD, then calculate against SOL
      if (tokenData.priceUsd) {
        // priceUsd is the direct price
        // But we want to find the SOL pair specifically
        // DexScreener returns priceUsd which is already in USD
        // To get SOL/TOKEN ratio, we can derive it from liquidity or look at pairs
        const priceUsd = parseFloat(tokenData.priceUsd);

        // Get SOL price
        const solPrice = await this.getSolPrice();

        // Calculate how many tokens per 1 SOL
        // If token is $0.001 and SOL is $176, then 1 SOL = 176,000 tokens
        if (priceUsd > 0 && solPrice > 0) {
          const tokensPerSol = solPrice / priceUsd;
          console.log(
            `${tokenMint}: 1 SOL = ${tokensPerSol.toFixed(2)} tokens`,
          );
          return tokensPerSol;
        }
      }

      return null;
    } catch (error) {
      console.warn(`Error getting SOL pair price for ${tokenMint}:`, error);
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

      // Get the SOL/TOKEN pair ratio
      const tokensPerSol = await this.getSolPairPrice(config.mint);

      if (!tokensPerSol || tokensPerSol <= 0) {
        console.warn(
          `Could not determine SOL pair for ${symbol}, using fallback`,
        );
        return this.getFallbackPriceData(symbol, solPrice);
      }

      // Calculate token price in USD
      const derivedPrice = solPrice / tokensPerSol;

      // Fetch additional metadata from DexScreener
      const tokenData = await dexscreenerAPI.getTokenByMint(config.mint);

      const priceData: PairPricingData = {
        tokenAddress: config.mint,
        tokenSymbol: symbol,
        solPrice,
        pairRatio: tokensPerSol,
        derivedPrice: derivedPrice > 0 ? derivedPrice : FALLBACK_PRICES[symbol],
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
        `${symbol} derived price: $${priceData.derivedPrice.toFixed(8)} (1 SOL = ${tokensPerSol.toFixed(2)} ${symbol})`,
      );

      return priceData;
    } catch (error) {
      console.error(`Error calculating derived price for ${symbol}:`, error);
      const solPrice = await this.getSolPrice();
      return this.getFallbackPriceData(symbol, solPrice);
    }
  }

  /**
   * Get both FIXERCOIN and LOCKER prices
   */
  async getAllDerivedPrices(): Promise<Record<string, PairPricingData | null>> {
    const [fixercoinData, lockerData] = await Promise.all([
      this.getDerivedPrice("FIXERCOIN"),
      this.getDerivedPrice("LOCKER"),
    ]);

    return {
      FIXERCOIN: fixercoinData,
      LOCKER: lockerData,
    };
  }

  /**
   * Get fallback price data when API fails
   */
  private async getFallbackPriceData(
    symbol: string,
    solPrice: number,
  ): Promise<PairPricingData> {
    const config = TOKEN_CONFIGS[symbol];
    const fallbackPrice = FALLBACK_PRICES[symbol] || 0.000001;

    return {
      tokenAddress: config.mint,
      tokenSymbol: symbol,
      solPrice,
      pairRatio: solPrice / fallbackPrice,
      derivedPrice: fallbackPrice,
      priceChange24h: 0,
      volume24h: 0,
      liquidity: 0,
      lastUpdated: new Date(),
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
