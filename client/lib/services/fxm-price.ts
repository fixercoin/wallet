import { dexscreenerAPI } from "./dexscreener";
import { solPriceService } from "./sol-price";
import { retryWithExponentialBackoff } from "./retry-fetch";

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
  private readonly CACHE_DURATION = 250; // live updates every 250ms
  private readonly TOKEN_NAME = "FXM";

  async getFXMPrice(): Promise<FXMPriceData | null> {
    // Return cached (only from live source)
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

    // Fetch with retry logic
    const priceData = await retryWithExponentialBackoff(
      async () => {
        console.log("Fetching fresh FXM price directly from DexScreener...");

        try {
          // First, try to fetch FXM directly by mint
          const tokens = await dexscreenerAPI.getTokensByMints([FXM_MINT]);

          if (!tokens || tokens.length === 0) {
            throw new Error("FXM not found on DexScreener by mint");
          }

          const fxmToken = tokens[0];
          const price = fxmToken.priceUsd
            ? parseFloat(fxmToken.priceUsd)
            : null;

          if (!price || !isFinite(price) || price <= 0) {
            throw new Error(`Invalid FXM price from DexScreener: ${price}`);
          }

          const result: FXMPriceData = {
            price,
            priceChange24h: fxmToken.priceChange?.h24 || 0,
            volume24h: fxmToken.volume?.h24 || 0,
            liquidity: fxmToken.liquidity?.usd,
            lastUpdated: new Date(),
            derivationMethod: "DexScreener Direct (live)",
          };

          this.cachedData = result;
          this.lastFetchTime = new Date();

          console.log(
            `✅ FXM price updated: $${result.price.toFixed(8)} via ${result.derivationMethod}`,
          );

          return result;
        } catch (err) {
          console.warn(
            `[FXMPrice] Direct fetch failed: ${
              err instanceof Error ? err.message : String(err)
            }. Trying pair-based lookup...`,
          );

          // Fallback: try to find FXM/SOL pair
          try {
            const pairs = await dexscreenerAPI.getTokensByMints([
              FXM_MINT,
              SOL_MINT,
            ]);

            if (!pairs || pairs.length === 0) {
              throw new Error("Could not fetch FXM/SOL pair from DexScreener");
            }

            const fxmPair = pairs.find(
              (p) =>
                (p.baseToken?.address === FXM_MINT ||
                  p.quoteToken?.address === FXM_MINT) &&
                (p.baseToken?.address === SOL_MINT ||
                  p.quoteToken?.address === SOL_MINT),
            );

            if (!fxmPair) {
              throw new Error("SOL/FXM pair not found on DexScreener");
            }

            const solPriceData = await solPriceService.getSolPrice();
            if (!solPriceData || solPriceData.price <= 0) {
              throw new Error("Could not fetch SOL price");
            }

            const priceNative = fxmPair.priceNative
              ? parseFloat(fxmPair.priceNative)
              : null;

            if (!priceNative || !isFinite(priceNative) || priceNative <= 0) {
              throw new Error("Invalid priceNative value");
            }

            let fxmPrice: number;
            if (fxmPair.baseToken?.address === FXM_MINT) {
              fxmPrice = priceNative * solPriceData.price;
            } else {
              fxmPrice = solPriceData.price / priceNative;
            }

            if (!fxmPrice || !isFinite(fxmPrice) || fxmPrice <= 0) {
              throw new Error(`Invalid calculated FXM price: ${fxmPrice}`);
            }

            const result: FXMPriceData = {
              price: fxmPrice,
              priceChange24h: fxmPair.priceChange?.h24 || 0,
              volume24h: fxmPair.volume?.h24 || 0,
              liquidity: fxmPair.liquidity?.usd,
              lastUpdated: new Date(),
              derivationMethod: "DexScreener SOL/FXM conversion (live)",
            };

            this.cachedData = result;
            this.lastFetchTime = new Date();

            console.log(
              `✅ FXM price updated (pair): $${result.price.toFixed(8)} via ${result.derivationMethod}`,
            );

            return result;
          } catch (fallbackErr) {
            console.warn(
              `[FXMPrice] Pair lookup also failed: ${
                fallbackErr instanceof Error
                  ? fallbackErr.message
                  : String(fallbackErr)
              }`,
            );
            throw fallbackErr;
          }
        }
      },
      this.TOKEN_NAME,
      {
        maxRetries: 2,
        initialDelayMs: 500,
        maxDelayMs: 2000,
        backoffMultiplier: 2,
        timeoutMs: 8000,
      },
    );

    if (!priceData) {
      console.warn(
        `[${this.TOKEN_NAME}] All price fetch attempts failed. Using static fallback.`,
      );

      const fallbackData: FXMPriceData = {
        price: 0.00000001,
        priceChange24h: 0,
        volume24h: 0,
        liquidity: 0,
        lastUpdated: new Date(),
        derivationMethod: "static fallback (DexScreener unavailable)",
        isFallback: true,
      };

      this.cachedData = fallbackData;
      this.lastFetchTime = new Date();

      return fallbackData;
    }

    return priceData;
  }

  async getPrice(): Promise<number> {
    const data = await this.getFXMPrice();
    return data?.price || 0;
  }

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

  clearCache(): void {
    this.cachedData = null;
    this.lastFetchTime = null;
    console.log("[FXMPriceService] Cache cleared");
  }
}

export const fxmPriceService = new FXMPriceService();
