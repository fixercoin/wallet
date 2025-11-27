import { tokenPairPricingService } from "./token-pair-pricing";
import { birdeyeAPI } from "./birdeye";
import { pumpFunPriceService } from "./pump-fun-price";
import { solPriceService } from "./sol-price";

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

class FXMPriceService {
  private cachedData: FXMPriceData | null = null;
  private lastFetchTime: Date | null = null;
  private readonly CACHE_DURATION = 250; // 250ms - ensures live price updates every 250ms for real-time display

  async getFXMPrice(): Promise<FXMPriceData | null> {
    try {
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

      console.log(
        "Fetching fresh FXM price using derived pricing (SOL pair)...",
      );

      // Try derived pricing based on SOL pair first
      const pairingData = await tokenPairPricingService.getDerivedPrice("FXM");

      if (
        pairingData &&
        pairingData.derivedPrice > 0 &&
        isFinite(pairingData.derivedPrice)
      ) {
        const priceData: FXMPriceData = {
          price: pairingData.derivedPrice,
          priceChange24h: pairingData.priceChange24h,
          volume24h: pairingData.volume24h,
          liquidity: pairingData.liquidity,
          lastUpdated: pairingData.lastUpdated,
          derivationMethod: `derived from SOL pair (1 SOL = ${pairingData.pairRatio.toFixed(0)} FXM)`,
        };

        this.cachedData = priceData;
        this.lastFetchTime = new Date();
        console.log(
          `✅ FXM price updated: $${priceData.price.toFixed(8)} (${priceData.derivationMethod})`,
        );
        return priceData;
      }

      // Fallback to Birdeye API if SOL pair derivation failed
      console.log("SOL pair derivation failed for FXM, trying Birdeye API...");
      const birdeyeToken = await birdeyeAPI.getTokenByMint(FXM_MINT);

      if (
        birdeyeToken &&
        birdeyeToken.priceUsd &&
        isFinite(birdeyeToken.priceUsd) &&
        birdeyeToken.priceUsd > 0
      ) {
        const priceData: FXMPriceData = {
          price: birdeyeToken.priceUsd,
          priceChange24h: birdeyeToken.priceChange?.h24 || 0,
          volume24h: birdeyeToken.volume?.h24 || 0,
          liquidity: birdeyeToken.liquidity?.usd,
          lastUpdated: new Date(),
          derivationMethod: `fetched from Birdeye API`,
        };

        this.cachedData = priceData;
        this.lastFetchTime = new Date();
        console.log(
          `✅ FXM price updated from Birdeye: $${priceData.price.toFixed(8)}`,
        );
        return priceData;
      }

      // Fallback to Pump.fun API (since FXM is a pump.fun token)
      console.log("Birdeye failed for FXM, trying Pump.fun API...");
      const pumpFunPriceInSol =
        await pumpFunPriceService.getTokenPrice(FXM_MINT);

      if (
        pumpFunPriceInSol &&
        pumpFunPriceInSol > 0 &&
        isFinite(pumpFunPriceInSol)
      ) {
        // Pump.fun returns price in SOL, convert to USD
        try {
          const solPriceData = await solPriceService.getSolPrice();
          const solPrice = solPriceData?.price || 100; // Fallback SOL price if service fails
          const pumpFunPriceUsd = pumpFunPriceInSol * solPrice;

          const priceData: FXMPriceData = {
            price: pumpFunPriceUsd,
            priceChange24h: 0,
            volume24h: 0,
            lastUpdated: new Date(),
            derivationMethod: `fetched from Pump.fun API (${pumpFunPriceInSol.toFixed(8)} SOL @ $${solPrice}/SOL)`,
          };

          this.cachedData = priceData;
          this.lastFetchTime = new Date();
          console.log(
            `✅ FXM price updated from Pump.fun: $${priceData.price.toFixed(8)}`,
          );
          return priceData;
        } catch (error) {
          console.warn("Failed to convert Pump.fun SOL price to USD:", error);
        }
      }

      console.warn(
        "Failed to fetch FXM price from all sources - service unavailable",
      );
      return null;
    } catch (error) {
      console.error("Error fetching FXM price:", error);
      return null;
    }
  }

  private getFallbackPrice(): FXMPriceData | null {
    console.log(
      "FXM price service unavailable - returning null to show loading state",
    );
    return null;
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
      price: data?.price || 0.000003567,
      derivationMethod: data?.derivationMethod || "hardcoded fallback",
    };
  }

  // Clear cache to force fresh fetch
  clearCache(): void {
    this.cachedData = null;
    this.lastFetchTime = null;
    tokenPairPricingService.clearTokenCache("FXM");
  }
}

export const fxmPriceService = new FXMPriceService();
