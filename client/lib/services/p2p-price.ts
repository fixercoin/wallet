import { dexscreenerAPI } from "./dexscreener";
import { TOKEN_MINTS as SOLANA_TOKEN_MINTS } from "@/lib/constants/token-mints";

// Token mint addresses on Solana
const TOKEN_MINTS = {
  USDC: SOLANA_TOKEN_MINTS.USDC,
  SOL: SOLANA_TOKEN_MINTS.SOL,
  FIXERCOIN: SOLANA_TOKEN_MINTS.FIXERCOIN,
};

const MARKUP_PERCENTAGE = 0;

interface PriceData {
  USDC: number;
  SOL: number;
  FIXERCOIN: number;
}

interface CachedPrice {
  price: number;
  fetchedAt: number;
}

class P2PPriceService {
  private cache = new Map<string, CachedPrice>();
  private readonly CACHE_TTL_MS = 60_000; // 60 seconds cache

  /**
   * Apply markup percentage to base price
   * Example: price=280.70, markup=4.25% -> 280.70 * 1.0425 = 292.59
   */
  private applyMarkup(
    basePrice: number,
    markupPercent: number = MARKUP_PERCENTAGE,
  ): number {
    return basePrice * (1 + markupPercent / 100);
  }

  /**
   * Fetch prices from DexScreener for USDC, SOL, FIXERCOIN with 0.25% markup
   */
  async fetchPricesInPKR(): Promise<PriceData> {
    try {
      const now = Date.now();

      // Check cache first
      const cachedUSDC = this.cache.get("USDC");
      const cachedSOL = this.cache.get("SOL");
      const cachedFIXERCOIN = this.cache.get("FIXERCOIN");

      const isCacheFresh = (cached?: CachedPrice) =>
        cached && cached.fetchedAt + this.CACHE_TTL_MS > now;

      if (
        isCacheFresh(cachedUSDC) &&
        isCacheFresh(cachedSOL) &&
        isCacheFresh(cachedFIXERCOIN)
      ) {
        console.log("[P2PPrice] Serving prices from cache");
        return {
          USDC: cachedUSDC!.price,
          SOL: cachedSOL!.price,
          FIXERCOIN: cachedFIXERCOIN!.price,
        };
      }

      console.log("[P2PPrice] Fetching prices from DexScreener...");

      // Fetch token data from DexScreener
      const tokens = await dexscreenerAPI.getTokensByMints([
        TOKEN_MINTS.USDC,
        TOKEN_MINTS.SOL,
        TOKEN_MINTS.FIXERCOIN,
      ]);

      const prices: PriceData = {
        USDC: 280, // Fallback price
        SOL: 180, // Fallback price
        FIXERCOIN: 0.005, // Fallback price
      };

      // Process fetched tokens
      tokens.forEach((token) => {
        const mint = token.baseToken?.address;
        const priceUsd = token.priceUsd ? parseFloat(token.priceUsd) : null;

        if (!priceUsd || priceUsd <= 0) {
          console.warn(
            `[P2PPrice] Invalid price for token ${mint}: ${priceUsd}`,
          );
          return;
        }

        // Get PKR conversion rate (assuming we need to multiply USD price by PKR/USD rate)
        // For now, using base prices as reference
        if (mint === TOKEN_MINTS.USDC) {
          // USDC price is typically 280-300 PKR
          prices.USDC = Math.max(280, priceUsd * 280);
          this.cache.set("USDC", {
            price: prices.USDC,
            fetchedAt: now,
          });
          console.log(
            `[P2PPrice] USDC base price: ${prices.USDC}, with markup: ${this.applyMarkup(prices.USDC)}`,
          );
        } else if (mint === TOKEN_MINTS.SOL) {
          // SOL price varies, fetch from DexScreener
          const solPriceInPKR = priceUsd * 280; // Assuming 1 USD ≈ 280 PKR
          prices.SOL = solPriceInPKR;
          this.cache.set("SOL", {
            price: prices.SOL,
            fetchedAt: now,
          });
          console.log(
            `[P2PPrice] SOL base price: ${prices.SOL}, with markup: ${this.applyMarkup(prices.SOL)}`,
          );
        } else if (mint === TOKEN_MINTS.FIXERCOIN) {
          // Fixercoin price from DexScreener
          const fixercoinPriceInPKR = priceUsd * 280; // Assuming 1 USD ≈ 280 PKR
          prices.FIXERCOIN = fixercoinPriceInPKR;
          this.cache.set("FIXERCOIN", {
            price: prices.FIXERCOIN,
            fetchedAt: now,
          });
          console.log(
            `[P2PPrice] FIXERCOIN base price: ${prices.FIXERCOIN}, with markup: ${this.applyMarkup(prices.FIXERCOIN)}`,
          );
        }
      });

      // Cache any tokens that were not updated
      if (!this.cache.has("USDC")) {
        this.cache.set("USDC", { price: prices.USDC, fetchedAt: now });
      }
      if (!this.cache.has("SOL")) {
        this.cache.set("SOL", { price: prices.SOL, fetchedAt: now });
      }
      if (!this.cache.has("FIXERCOIN")) {
        this.cache.set("FIXERCOIN", {
          price: prices.FIXERCOIN,
          fetchedAt: now,
        });
      }

      return {
        USDC: this.cache.get("USDC")!.price,
        SOL: this.cache.get("SOL")!.price,
        FIXERCOIN: this.cache.get("FIXERCOIN")!.price,
      };
    } catch (error) {
      console.error("[P2PPrice] Error fetching prices:", error);

      // Return fallback prices without markup
      const fallbackPrices = {
        USDC: 280,
        SOL: 180,
        FIXERCOIN: 0.005,
      };

      return fallbackPrices;
    }
  }

  /**
   * Get a single token price with markup
   */
  async getTokenPrice(symbol: "USDC" | "SOL" | "FIXERCOIN"): Promise<number> {
    const prices = await this.fetchPricesInPKR();
    return prices[symbol];
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
    console.log("[P2PPrice] Cache cleared");
  }

  /**
   * Get markup percentage
   */
  getMarkupPercentage(): number {
    return MARKUP_PERCENTAGE;
  }
}

export const p2pPriceService = new P2PPriceService();
