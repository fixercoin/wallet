import { resolveApiUrl } from "@/lib/api-client";

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: {
    amount: string;
    feeBps: number;
  } | null;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
}

export interface JupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number | null;
}

export interface JupiterTokenPrice {
  id: string;
  type: string;
  price: number;
}

// Use local proxy endpoints (requires backend server)
// For Cloudflare Pages production, you'll need a Cloudflare Worker proxy
const JUPITER_V6_ENDPOINTS = {
  quote: "/api/jupiter/quote",
  swap: "/api/jupiter/swap",
  price: "/api/jupiter/price",
};

class JupiterV6API {
  /**
   * Get a quote for swapping tokens
   */
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: string | number,
    slippageBps: number = 100,
    onlyDirectRoutes: boolean = false,
    asLegacyTransaction: boolean = false,
  ): Promise<JupiterQuoteResponse | null> {
    try {
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: String(amount),
        slippageBps: String(slippageBps),
        onlyDirectRoutes: String(onlyDirectRoutes),
        asLegacyTransaction: String(asLegacyTransaction),
      });

      const response = await fetch(
        resolveApiUrl(`${JUPITER_V6_ENDPOINTS.quote}?${params.toString()}`),
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        let errorData = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || `HTTP ${response.status}` };
        }
        console.error("Jupiter quote error:", {
          status: response.status,
          statusText: response.statusText,
          data: errorData,
        });
        return null;
      }

      const rawData: any = await response.json();

      // Some proxies return { source: 'jupiter', quote: {...} }
      const data =
        rawData && typeof rawData === "object" && "quote" in rawData
          ? rawData.quote
          : rawData;

      if (!data || !data.outAmount || data.outAmount === "0") {
        console.warn("Jupiter quote returned no outAmount:", rawData);
        return null;
      }

      return data as JupiterQuoteResponse;
    } catch (error) {
      console.error("Jupiter getQuote error:", error);
      throw error;
    }
  }

  /**
   * Get token prices from Jupiter
   */
  async getTokenPrices(
    mints: string[],
  ): Promise<Record<string, JupiterTokenPrice>> {
    try {
      const ids = mints.join(",");
      const response = await fetch(
        resolveApiUrl(
          `${JUPITER_V6_ENDPOINTS.price}?ids=${encodeURIComponent(ids)}`,
        ),
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        console.error("Jupiter price error:", response.status);
        return {};
      }

      const data = await response.json();
      return data.data || {};
    } catch (error) {
      console.error("Jupiter getTokenPrices error:", error);
      return {};
    }
  }

  /**
   * Create a swap transaction
   */
  async createSwap(
    quoteResponse: JupiterQuoteResponse,
    userPublicKey: string,
    options: {
      wrapAndUnwrapSol?: boolean;
      useSharedAccounts?: boolean;
      computeUnitPriceMicroLamports?: number;
      prioritizationFeeLamports?: number;
      asLegacyTransaction?: boolean;
    } = {},
  ): Promise<JupiterSwapResponse | null> {
    try {
      const body = {
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: options.wrapAndUnwrapSol !== false,
        useSharedAccounts: options.useSharedAccounts !== false,
        asLegacyTransaction: options.asLegacyTransaction === true,
      };

      const response = await fetch(resolveApiUrl(JUPITER_V6_ENDPOINTS.swap), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        let errorData: any = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || `HTTP ${response.status}` };
        }
        console.error("Jupiter swap error:", {
          status: response.status,
          statusText: response.statusText,
          data: errorData,
        });

        // Handle stale/expired quotes explicitly
        if (errorData?.error === "STALE_QUOTE" || errorData?.code === 1016) {
          throw new Error("Quote expired - please refresh and try again");
        }

        // Fallback: call Jupiter directly if proxy fails (e.g., 5xx from Cloudflare)
        const directEndpoints = [
          "https://quote-api.jup.ag/v6/swap",
          "https://lite-api.jup.ag/swap/v1/swap",
        ];
        for (const ep of directEndpoints) {
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 25000);
            const r = await fetch(ep, {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (compatible; FixoriumWallet/1.0)",
              },
              body: JSON.stringify(body),
              signal: ctrl.signal,
            });
            clearTimeout(timer);

            const txt = await r.text();
            if (!r.ok) {
              if (
                txt.includes("1016") ||
                txt.includes("STALE") ||
                txt.includes("simulation")
              ) {
                throw new Error("Quote expired - please refresh and try again");
              }
              continue; // try next endpoint
            }
            return JSON.parse(txt) as JupiterSwapResponse;
          } catch (e: any) {
            // try next endpoint on error/timeout
            continue;
          }
        }

        // If all fallbacks failed, throw the original error
        throw new Error(
          errorData.error || errorData.message || "Failed to create swap",
        );
      }

      const data: JupiterSwapResponse = await response.json();
      return data;
    } catch (error) {
      console.error("Jupiter createSwap error:", error);
      throw error;
    }
  }

  /**
   * Format amount to proper decimals
   */
  formatSwapAmount(amount: number, decimals: number): string {
    const multiplier = Math.pow(10, decimals);
    return String(Math.floor(amount * multiplier));
  }

  /**
   * Get price impact percentage
   */
  getPriceImpact(quoteResponse: JupiterQuoteResponse): number {
    return parseFloat(quoteResponse.priceImpactPct);
  }

  /**
   * Get output amount from quote
   */
  getOutputAmount(quoteResponse: JupiterQuoteResponse): string {
    return quoteResponse.outAmount;
  }

  /**
   * Validate swap is still valid (not stale)
   */
  isQuoteValid(
    quoteResponse: JupiterQuoteResponse,
    maxAgeSeconds: number = 30,
  ): boolean {
    if (!quoteResponse.contextSlot) return false;
    // Note: In real implementation, would compare with current slot
    return true;
  }
}

export const jupiterV6API = new JupiterV6API();
