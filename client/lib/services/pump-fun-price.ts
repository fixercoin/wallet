/**
 * Pump.fun Price Service
 * Fetches prices for pump.fun tokens using the Pump.fun API
 */

export interface PumpFunToken {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image_uri: string;
  metadata_uri: string;
  twitter: string | null;
  website: string | null;
  show_name: boolean;
  created_timestamp: number;
  raydium_pool: string | null;
  complete: boolean;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  real_sol_reserves: number;
  real_token_reserves: number;
  market_cap: number;
  reply_count: number;
  price?: number;
}

class PumpFunPriceService {
  private baseUrl = "https://frontend-api.pump.fun";
  private cache = new Map<string, { data: PumpFunToken; expiresAt: number }>();
  private readonly CACHE_DURATION = 250; // 250ms for live updates

  async getTokenPrice(mint: string): Promise<number | null> {
    try {
      const token = await this.getToken(mint);
      if (!token) return null;

      // Calculate price from virtual reserves
      // price = virtualSolReserves / virtualTokenReserves
      if (token.virtual_sol_reserves > 0 && token.virtual_token_reserves > 0) {
        const price = token.virtual_sol_reserves / token.virtual_token_reserves;
        console.log(
          `[PumpFun] ${mint}: price=$${price.toFixed(8)} (from virtual reserves)`,
        );
        return price;
      }

      return null;
    } catch (error) {
      console.warn(
        `[PumpFun] Error getting price for ${mint}:`,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  async getToken(mint: string): Promise<PumpFunToken | null> {
    try {
      // Check cache first
      const cached = this.cache.get(mint);
      if (cached && cached.expiresAt > Date.now()) {
        console.log(`[PumpFun] Returning cached token: ${mint}`);
        return cached.data;
      }

      console.log(
        `[PumpFun] Fetching token data for ${mint} from Pump.fun API...`,
      );

      const response = await fetch(
        `${this.baseUrl}/api/token/${encodeURIComponent(mint)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        console.warn(`[PumpFun] API returned ${response.status} for ${mint}`);
        return null;
      }

      const data: PumpFunToken = await response.json();

      // Cache the result
      this.cache.set(mint, {
        data,
        expiresAt: Date.now() + this.CACHE_DURATION,
      });

      console.log(
        `[PumpFun] ✅ Got token data for ${mint}: ${data.symbol} (${data.name})`,
      );

      return data;
    } catch (error) {
      console.error(
        `[PumpFun] Error fetching token ${mint}:`,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  clearCache(): void {
    this.cache.clear();
    console.log("[PumpFun] Cache cleared");
  }
}

export const pumpFunPriceService = new PumpFunPriceService();
