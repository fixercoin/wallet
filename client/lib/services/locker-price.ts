import { birdeyeAPI } from "./birdeye";
import { saveServicePrice } from "./offline-cache";
import {
  retryWithExponentialBackoff,
  AGGRESSIVE_RETRY_OPTIONS,
} from "./retry-fetch";

export interface LockerPriceData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity?: number;
  lastUpdated: Date;
  derivationMethod?: string;
  isFallback?: boolean;
}

const LOCKER_MINT = "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump";

class LockerPriceService {
  private cachedData: LockerPriceData | null = null;
  private lastFetchTime: Date | null = null;
  private readonly CACHE_DURATION = 250; // 250ms - ensures live price updates every 250ms for real-time display
  private readonly TOKEN_NAME = "LOCKER";

  async getLockerPrice(): Promise<LockerPriceData | null> {
    // Check if we have valid cached data (only from live prices, not fallbacks)
    if (
      this.cachedData &&
      this.lastFetchTime &&
      this.cachedData.derivationMethod !== "fallback"
    ) {
      const timeSinceLastFetch = Date.now() - this.lastFetchTime.getTime();
      if (timeSinceLastFetch < this.CACHE_DURATION) {
        console.log("Returning cached LOCKER price data");
        return this.cachedData;
      }
    }

    // Use retry logic to fetch price using conversion logic
    const priceData = await retryWithExponentialBackoff(
      async () => {
        console.log(
          "Fetching fresh LOCKER price using DexScreener conversion logic...",
        );

        try {
          // Fetch SOL/LOCKER pair from DexScreener
          const pairs = await dexscreenerAPI.getTokensByMints([
            LOCKER_MINT,
            SOL_MINT,
          ]);

          if (!pairs || pairs.length === 0) {
            throw new Error("Could not fetch LOCKER/SOL pair from DexScreener");
          }

          // Find the pair where LOCKER and SOL interact
          const lockerPair = pairs.find(
            (p) =>
              (p.baseToken?.address === LOCKER_MINT ||
                p.quoteToken?.address === LOCKER_MINT) &&
              (p.baseToken?.address === SOL_MINT ||
                p.quoteToken?.address === SOL_MINT),
          );

          if (!lockerPair) {
            throw new Error(
              "SOL/LOCKER pair not found on DexScreener - cannot calculate conversion rate",
            );
          }

          // Get SOL price in USDT
          const solPriceData = await solPriceService.getSolPrice();
          if (!solPriceData || solPriceData.price <= 0) {
            throw new Error("Could not fetch SOL price in USDT");
          }

          // Calculate LOCKER price based on conversion logic
          let lockerPrice: number;
          let priceChange24h: number = lockerPair.priceChange?.h24 || 0;
          let volume24h: number = lockerPair.volume?.h24 || 0;

          const priceNative = lockerPair.priceNative
            ? parseFloat(lockerPair.priceNative)
            : null;

          if (!priceNative || priceNative <= 0) {
            throw new Error("Invalid price native value from DexScreener pair");
          }

          if (lockerPair.baseToken?.address === LOCKER_MINT) {
            // LOCKER/SOL pair: priceNative is SOL per LOCKER
            lockerPrice = priceNative * solPriceData.price;
            console.log(
              `[LockerPrice] LOCKER/SOL pair: priceNative=${priceNative} SOL/LOCKER, SOL price=${solPriceData.price} USDT, LOCKER price=${lockerPrice} USDT`,
            );
          } else {
            // SOL/LOCKER pair: priceNative is LOCKER per SOL
            lockerPrice = solPriceData.price / priceNative;
            console.log(
              `[LockerPrice] SOL/LOCKER pair: priceNative=${priceNative} LOCKER/SOL, SOL price=${solPriceData.price} USDT, LOCKER price=${lockerPrice} USDT`,
            );
          }

          if (!lockerPrice || lockerPrice <= 0) {
            throw new Error(
              `Invalid LOCKER price from conversion logic: ${lockerPrice}`,
            );
          }

          const priceData: LockerPriceData = {
            price: lockerPrice,
            priceChange24h,
            volume24h,
            liquidity: lockerPair.liquidity?.usd,
            lastUpdated: new Date(),
            derivationMethod: "DexScreener SOL/LOCKER conversion (live)",
          };

          this.cachedData = priceData;
          this.lastFetchTime = new Date();
          console.log(
            `✅ LOCKER price updated: $${priceData.price.toFixed(8)} (24h: ${priceChange24h.toFixed(2)}%) via ${priceData.derivationMethod}`,
          );

          // Save to localStorage for offline support
          saveServicePrice("LOCKER", {
            price: priceData.price,
            priceChange24h: priceData.priceChange24h,
          });

          return priceData;
        } catch (conversionError) {
          // If conversion logic fails, fall back to direct LOCKER price from DexScreener
          console.warn(
            `[LockerPrice] Conversion logic failed: ${conversionError instanceof Error ? conversionError.message : String(conversionError)}. Falling back to direct DexScreener price...`,
          );

          const tokens = await dexscreenerAPI.getTokensByMints([LOCKER_MINT]);

          if (!tokens || tokens.length === 0) {
            throw new Error("LOCKER not found on DexScreener for fallback");
          }

          const token = tokens[0];
          const price = token.priceUsd ? parseFloat(token.priceUsd) : null;
          const priceChange24h = token.priceChange?.h24 || 0;
          const volume24h = token.volume?.h24 || 0;
          const liquidity = token.liquidity?.usd;

          if (!price || price <= 0) {
            throw new Error(
              `Invalid LOCKER price from direct DexScreener fallback: ${price}`,
            );
          }

          const fallbackPriceData: LockerPriceData = {
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
            `✅ LOCKER price updated (FALLBACK): $${fallbackPriceData.price.toFixed(8)} (24h: ${priceChange24h.toFixed(2)}%) via ${fallbackPriceData.derivationMethod}`,
          );

          // Save to localStorage for offline support
          saveServicePrice("LOCKER", {
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
        `[${this.TOKEN_NAME}] All price fetch attempts failed. Using static fallback price after ${AGGRESSIVE_RETRY_OPTIONS.maxRetries + 1} attempts.`,
      );
      const fallbackData: LockerPriceData = {
        price: 0.00001112,
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
    const data = await this.getLockerPrice();
    return data?.price || 0;
  }

  // Clear cache to force fresh fetch
  clearCache(): void {
    this.cachedData = null;
    this.lastFetchTime = null;
    console.log(
      "[LockerPriceService] Cache cleared - next fetch will be fresh",
    );
  }
}

export const lockerPriceService = new LockerPriceService();
