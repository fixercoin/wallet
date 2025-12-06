import { dexscreenerAPI } from "./dexscreener";
import { solPriceService } from "./sol-price";
import { saveServicePrice } from "./offline-cache";
import {
  retryWithExponentialBackoff,
  AGGRESSIVE_RETRY_OPTIONS,
} from "./retry-fetch";

export interface FXMPriceData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity?: number;
  lastUpdated: Date;
  derivationMethod?: string;
  isFallback?: boolean;
}

const FXM_MINT = "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump";
const SOL_MINT = "So11111111111111111111111111111111111111112";

class FXMPriceService {
  private cachedData: FXMPriceData | null = null;
  private lastFetchTime: Date | null = null;
  private readonly CACHE_DURATION = 250; // 250ms - ensures live price updates every 250ms for real-time display
  private readonly TOKEN_NAME = "FXM";

  async getFXMPrice(): Promise<FXMPriceData | null> {
    // Check if we have valid cached data (only from live prices, not fallbacks)
    if (
      this.cachedData &&
      this.lastFetchTime &&
      this.cachedData.derivationMethod !== "fallback" &&
      this.cachedData.derivationMethod !== "hardcoded fallback"
    ) {
      const timeSinceLastFetch = Date.now() - this.lastFetchTime.getTime();
      if (timeSinceLastFetch < this.CACHE_DURATION) {
        console.log("Returning cached FXM price data");
        return this.cachedData;
      }
    }

    // Use retry logic to fetch price using conversion logic
    const priceData = await retryWithExponentialBackoff(
      async () => {
        console.log(
          "Fetching fresh FXM price using DexScreener conversion logic...",
        );

        try {
          // Fetch SOL/FXM pair from DexScreener
          const pairs = await dexscreenerAPI.getTokensByMints([
            FXM_MINT,
            SOL_MINT,
          ]);

          if (!pairs || pairs.length === 0) {
            throw new Error("Could not fetch FXM/SOL pair from DexScreener");
          }

          // Find the pair where FXM and SOL interact
          const fxmPair = pairs.find(
            (p) =>
              (p.baseToken?.address === FXM_MINT ||
                p.quoteToken?.address === FXM_MINT) &&
              (p.baseToken?.address === SOL_MINT ||
                p.quoteToken?.address === SOL_MINT),
          );

          if (!fxmPair) {
            throw new Error(
              "SOL/FXM pair not found on DexScreener - cannot calculate conversion rate",
            );
          }

          // Get SOL price in USDT
          const solPriceData = await solPriceService.getSolPrice();
          if (!solPriceData || solPriceData.price <= 0) {
            throw new Error("Could not fetch SOL price in USDT");
          }

          // Calculate FXM price based on conversion logic
          let fxmPrice: number;
          let priceChange24h: number = fxmPair.priceChange?.h24 || 0;
          let volume24h: number = fxmPair.volume?.h24 || 0;

          const priceNative = fxmPair.priceNative
            ? parseFloat(fxmPair.priceNative)
            : null;

          if (!priceNative || priceNative <= 0) {
            throw new Error("Invalid price native value from DexScreener pair");
          }

          if (fxmPair.baseToken?.address === FXM_MINT) {
            // FXM/SOL pair: priceNative is SOL per FXM
            fxmPrice = priceNative * solPriceData.price;
            console.log(
              `[FXMPrice] FXM/SOL pair: priceNative=${priceNative} SOL/FXM, SOL price=${solPriceData.price} USDT, FXM price=${fxmPrice} USDT`,
            );
          } else {
            // SOL/FXM pair: priceNative is FXM per SOL
            fxmPrice = solPriceData.price / priceNative;
            console.log(
              `[FXMPrice] SOL/FXM pair: priceNative=${priceNative} FXM/SOL, SOL price=${solPriceData.price} USDT, FXM price=${fxmPrice} USDT`,
            );
          }

          if (!fxmPrice || fxmPrice <= 0) {
            throw new Error(
              `Invalid FXM price from conversion logic: ${fxmPrice}`,
            );
          }

          const priceData: FXMPriceData = {
            price: fxmPrice,
            priceChange24h,
            volume24h,
            liquidity: fxmPair.liquidity?.usd,
            lastUpdated: new Date(),
            derivationMethod: "DexScreener SOL/FXM conversion (live)",
          };

          this.cachedData = priceData;
          this.lastFetchTime = new Date();
          console.log(
            `✅ FXM price updated: $${priceData.price.toFixed(8)} (24h: ${priceChange24h.toFixed(2)}%) via ${priceData.derivationMethod}`,
          );

          // Save to localStorage for offline support
          saveServicePrice("FXM", {
            price: priceData.price,
            priceChange24h: priceData.priceChange24h,
          });

          return priceData;
        } catch (conversionError) {
          // If conversion logic fails, fall back to direct FXM price from DexScreener
          console.warn(
            `[FXMPrice] Conversion logic failed: ${conversionError instanceof Error ? conversionError.message : String(conversionError)}. Falling back to direct DexScreener price...`,
          );

          const tokens = await dexscreenerAPI.getTokensByMints([FXM_MINT]);

          if (!tokens || tokens.length === 0) {
            throw new Error("FXM not found on DexScreener for fallback");
          }

          const token = tokens[0];
          const price = token.priceUsd ? parseFloat(token.priceUsd) : null;
          const priceChange24h = token.priceChange?.h24 || 0;
          const volume24h = token.volume?.h24 || 0;
          const liquidity = token.liquidity?.usd;

          if (!price || price <= 0) {
            throw new Error(
              `Invalid FXM price from direct DexScreener fallback: ${price}`,
            );
          }

          const fallbackPriceData: FXMPriceData = {
            price,
            priceChange24h,
            volume24h,
            liquidity,
            lastUpdated: new Date(),
            derivationMethod: "DexScreener Direct (fallback)",
          };

          this.cachedData = fallbackPriceData;
          this.lastFetchTime = new Date();
          console.log(
            `✅ FXM price updated (FALLBACK): $${fallbackPriceData.price.toFixed(8)} (24h: ${priceChange24h.toFixed(2)}%) via ${fallbackPriceData.derivationMethod}`,
          );

          // Save to localStorage for offline support
          saveServicePrice("FXM", {
            price: fallbackPriceData.price,
            priceChange24h: fallbackPriceData.priceChange24h,
          });

          return fallbackPriceData;
        }
      },
      this.TOKEN_NAME,
      AGGRESSIVE_RETRY_OPTIONS,
    );

    // Return null only if all retries failed - never return fallback
    if (!priceData) {
      console.warn(
        `[${this.TOKEN_NAME}] All price fetch attempts failed. Will retry on next request.`,
      );
    }

    return priceData;
  }

  // Get just the price number for quick access
  async getPrice(): Promise<number> {
    const data = await this.getFXMPrice();
    return data?.price || 0;
  }

  // Get the price with derivation method info
  async getFXMPriceWithMethod(): Promise<{
    price: number;
    derivationMethod: string;
  }> {
    const data = await this.getFXMPrice();
    return {
      price: data?.price || 0,
      derivationMethod: data?.derivationMethod || "unavailable",
    };
  }

  // Clear cache to force fresh fetch
  clearCache(): void {
    this.cachedData = null;
    this.lastFetchTime = null;
    console.log("[FXMPriceService] Cache cleared - next fetch will be fresh");
  }
}

export const fxmPriceService = new FXMPriceService();
