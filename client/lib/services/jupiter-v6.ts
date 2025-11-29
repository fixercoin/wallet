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

// Use server-side proxies to avoid CORS issues
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
        console.error("[SwapInterface] Quote error:", {
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
        console.warn("[SwapInterface] Quote returned no outAmount:", rawData);
        return null;
      }

      return data as JupiterQuoteResponse;
    } catch (error) {
      console.error("[SwapInterface] Quote error:", error);
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
        console.error("[SwapInterface] Price error:", response.status);
        return {};
      }

      const data = await response.json();
      return data.data || {};
    } catch (error) {
      console.error("[SwapInterface] Price error:", error);
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
        console.error("[SwapInterface] Swap error:", {
          status: response.status,
          statusText: response.statusText,
          data: errorData,
        });

        // Handle stale/expired quotes explicitly (409, 530, or error code 1016)
        if (
          errorData?.error === "STALE_QUOTE" ||
          errorData?.code === 1016 ||
          response.status === 409 ||
          response.status === 530
        ) {
          throw new Error("Quote expired - please refresh and try again");
        }

        throw new Error(
          errorData.error || errorData.message || "Failed to create swap",
        );
      }

      const data: JupiterSwapResponse = await response.json();
      return data;
    } catch (error) {
      console.error("[SwapInterface] Swap error:", error);
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
   * Checks if the quote has a valid contextSlot
   */
  isQuoteValid(quoteResponse: JupiterQuoteResponse): boolean {
    if (!quoteResponse) return false;
    if (!quoteResponse.contextSlot) return false;
    // Quote is valid as long as it has a contextSlot
    // Age validation should be done separately with timestamp
    return true;
  }

  /**
   * Check if a quote age is still acceptable for execution
   * Jupiter quotes expire after ~30 seconds of inactivity
   */
  isQuoteAgeAcceptable(quoteAgeMs: number): boolean {
    // Be conservative: treat quotes > 20 seconds old as stale
    // This gives cushion for network delays and processing
    return quoteAgeMs < 20000;
  }
}

export const jupiterV6API = new JupiterV6API();
