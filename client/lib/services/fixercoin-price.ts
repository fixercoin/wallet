import { dexscreenerAPI } from "./dexscreener";
import { solPriceService } from "./sol-price";
import { saveServicePrice } from "./offline-cache";
import {
  retryWithExponentialBackoff,
  AGGRESSIVE_RETRY_OPTIONS,
} from "./retry-fetch";

export interface FixercoinPriceData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap?: number;
  liquidity?: number;
  lastUpdated: Date;
  derivationMethod?: string;
  isFallback?: boolean;
}

const FIXERCOIN_MINT = "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump";
const SOL_MINT = "So11111111111111111111111111111111111111112";

class FixercoinPriceService {
  private cachedData: FixercoinPriceData | null = null;
  private lastFetchTime: Date | null = null;
  private readonly CACHE_DURATION = 250; // 250ms - ensures live price updates every 250ms for real-time display
  private readonly TOKEN_NAME = "FIXERCOIN";

  async getFixercoinPrice(): Promise<FixercoinPriceData | null> {
    // Check if we have valid cached data (only from live prices, not fallbacks)
    if (
      this.cachedData &&
      this.lastFetchTime &&
      this.cachedData.derivationMethod !== "fallback"
    ) {
      const timeSinceLastFetch = Date.now() - this.lastFetchTime.getTime();
      if (timeSinceLastFetch < this.CACHE_DURATION) {
        console.log("Returning cached FIXERCOIN price data");
        return this.cachedData;
      }
    }

    // Use retry logic to fetch price using conversion logic
    const priceData = await retryWithExponentialBackoff(
      async () => {
        console.log(
          "Fetching fresh FIXERCOIN price using DexScreener conversion logic...",
        );

        try {
          // Fetch SOL/FIXERCOIN pair from DexScreener
          const pairs = await dexscreenerAPI.getTokensByMints([
            FIXERCOIN_MINT,
            SOL_MINT,
          ]);

          if (!pairs || pairs.length === 0) {
            throw new Error(
              "Could not fetch FIXERCOIN/SOL pair from DexScreener",
            );
          }

          // Find the pair where FIXERCOIN and SOL interact
          // We need to get the exchange rate: how many FIXERCOIN per 1 SOL
          const fixercoinPair = pairs.find(
            (p) =>
              (p.baseToken?.address === FIXERCOIN_MINT ||
                p.quoteToken?.address === FIXERCOIN_MINT) &&
              (p.baseToken?.address === SOL_MINT ||
                p.quoteToken?.address === SOL_MINT),
          );

          if (!fixercoinPair) {
            throw new Error(
              "SOL/FIXERCOIN pair not found on DexScreener - cannot calculate conversion rate",
            );
          }

          // Get SOL price in USDT
          const solPriceData = await solPriceService.getSolPrice();
          if (!solPriceData || solPriceData.price <= 0) {
            throw new Error("Could not fetch SOL price in USDT");
          }

          // Calculate FIXERCOIN price based on conversion logic:
          // If 1 SOL = X FIXERCOIN, then 1 FIXERCOIN = SOL_PRICE / X
          let fixercoinPrice: number;
          let priceChange24h: number = fixercoinPair.priceChange?.h24 || 0;
          let volume24h: number = fixercoinPair.volume?.h24 || 0;

          const priceNative = fixercoinPair.priceNative
            ? parseFloat(fixercoinPair.priceNative)
            : null;

          if (!priceNative || priceNative <= 0) {
            throw new Error("Invalid price native value from DexScreener pair");
          }

          // priceNative is the price in the quote token
          // If FIXERCOIN is the base, then priceNative = SOL per FIXERCOIN
          // So FIXERCOIN in USDT = priceNative * SOL_PRICE
          // If SOL is the base, then priceNative = FIXERCOIN per SOL
          // So FIXERCOIN in USDT = SOL_PRICE / priceNative

          if (fixercoinPair.baseToken?.address === FIXERCOIN_MINT) {
            // FIXERCOIN/SOL pair: priceNative is SOL per FIXERCOIN
            fixercoinPrice = priceNative * solPriceData.price;
            console.log(
              `[FixercoinPrice] FIXERCOIN/SOL pair: priceNative=${priceNative} SOL/FIXERCOIN, SOL price=${solPriceData.price} USDT, FIXERCOIN price=${fixercoinPrice} USDT`,
            );
          } else {
            // SOL/FIXERCOIN pair: priceNative is FIXERCOIN per SOL
            fixercoinPrice = solPriceData.price / priceNative;
            console.log(
              `[FixercoinPrice] SOL/FIXERCOIN pair: priceNative=${priceNative} FIXERCOIN/SOL, SOL price=${solPriceData.price} USDT, FIXERCOIN price=${fixercoinPrice} USDT`,
            );
          }

          if (!fixercoinPrice || fixercoinPrice <= 0) {
            throw new Error(
              `Invalid FIXERCOIN price from conversion logic: ${fixercoinPrice}`,
            );
          }

          const priceData: FixercoinPriceData = {
            price: fixercoinPrice,
            priceChange24h,
            volume24h,
            liquidity: fixercoinPair.liquidity?.usd,
            marketCap: fixercoinPair.marketCap,
            lastUpdated: new Date(),
            derivationMethod: "DexScreener SOL/FIXERCOIN conversion (live)",
          };

          this.cachedData = priceData;
          this.lastFetchTime = new Date();
          console.log(
            `✅ FIXERCOIN price updated: $${priceData.price.toFixed(8)} (24h: ${priceChange24h.toFixed(2)}%) via ${priceData.derivationMethod}`,
          );

          // Save to localStorage for offline support
          saveServicePrice("FIXERCOIN", {
            price: priceData.price,
            priceChange24h: priceData.priceChange24h,
          });

          return priceData;
        } catch (conversionError) {
          // If conversion logic fails, fall back to direct FIXERCOIN price from DexScreener
          console.warn(
            `[FixercoinPrice] Conversion logic failed: ${conversionError instanceof Error ? conversionError.message : String(conversionError)}. Falling back to direct DexScreener price...`,
          );

          const tokens = await dexscreenerAPI.getTokensByMints([
            FIXERCOIN_MINT,
          ]);

          if (!tokens || tokens.length === 0) {
            throw new Error("FIXERCOIN not found on DexScreener for fallback");
          }

          const token = tokens[0];
          const price = token.priceUsd ? parseFloat(token.priceUsd) : null;
          const priceChange24h = token.priceChange?.h24 || 0;
          const volume24h = token.volume?.h24 || 0;
          const liquidity = token.liquidity?.usd;
          const marketCap = token.marketCap;

          if (!price || price <= 0) {
            throw new Error(
              `Invalid FIXERCOIN price from direct DexScreener fallback: ${price}`,
            );
          }

          const fallbackPriceData: FixercoinPriceData = {
            price,
            priceChange24h,
            volume24h,
            liquidity,
            marketCap,
            lastUpdated: new Date(),
            derivationMethod: "DexScreener Direct (fallback)",
          };

          this.cachedData = fallbackPriceData;
          this.lastFetchTime = new Date();
          console.log(
            `✅ FIXERCOIN price updated (FALLBACK): $${fallbackPriceData.price.toFixed(8)} (24h: ${priceChange24h.toFixed(2)}%) via ${fallbackPriceData.derivationMethod}`,
          );

          // Save to localStorage for offline support
          saveServicePrice("FIXERCOIN", {
            price: fallbackPriceData.price,
            priceChange24h: fallbackPriceData.priceChange24h,
          });

          return fallbackPriceData;
        }
      },
      this.TOKEN_NAME,
      {
        ...AGGRESSIVE_RETRY_OPTIONS,
        timeoutMs: 12000,
      },
    );

    // If all retries failed, return a static fallback price
    if (!priceData) {
      console.warn(
        `[${this.TOKEN_NAME}] All price fetch attempts failed. Using static fallback price.`,
      );
      const fallbackData: FixercoinPriceData = {
        price: 0.000000001,
        priceChange24h: 0,
        volume24h: 0,
        liquidity: 0,
        lastUpdated: new Date(),
        derivationMethod: "static fallback (DexScreener unavailable)",
        isFallback: true,
      };
      this.cachedData = fallbackData;
      this.lastFetchTime = new Date();
      console.log(
        `[${this.TOKEN_NAME}] Returning static fallback price: $${fallbackData.price.toFixed(8)}`,
      );
      return fallbackData;
    }

    return priceData;
  }

  // Get just the price number for quick access
  async getPrice(): Promise<number> {
    const data = await this.getFixercoinPrice();
    return data?.price || 0;
  }

  // Clear cache to force fresh fetch
  clearCache(): void {
    this.cachedData = null;
    this.lastFetchTime = null;
    console.log(
      "[FixercoinPriceService] Cache cleared - next fetch will be fresh",
    );
  }
}

export const fixercoinPriceService = new FixercoinPriceService();
