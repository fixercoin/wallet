// Call Jupiter directly to avoid proxy latency that causes quote expiration

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

// Direct Jupiter API endpoints - public endpoints that don't require authentication
const JUPITER_QUOTE_ENDPOINTS = [
  "https://quote-api.jup.ag/v6/quote",
];

const JUPITER_SWAP_ENDPOINTS = [
  "https://quote-api.jup.ag/v6/swap",
];

const JUPITER_PRICE_ENDPOINTS = [
  "https://price.jup.ag/v4",
];

class JupiterV6API {
  /**
   * Get a quote for swapping tokens - calls Jupiter directly
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

      let lastError: Error | null = null;

      // Try multiple endpoints
      for (let i = 0; i < JUPITER_QUOTE_ENDPOINTS.length; i++) {
        try {
          const endpoint = JUPITER_QUOTE_ENDPOINTS[i];
          console.log(`[Jupiter Quote] Trying endpoint ${i + 1}...`);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000);

          const response = await fetch(
            `${endpoint}?${params.toString()}`,
            {
              method: "GET",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (compatible; FixoriumWallet/1.0)",
              },
              signal: controller.signal,
            },
          );

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            console.warn(
              `[Jupiter Quote] Endpoint ${i + 1} failed (${response.status}):`,
              errorText.slice(0, 100),
            );
            lastError = new Error(
              `HTTP ${response.status}: ${errorText.slice(0, 100)}`,
            );
            continue;
          }

          const rawData: any = await response.json();
          const data =
            rawData && typeof rawData === "object" && "quote" in rawData
              ? rawData.quote
              : rawData;

          if (!data || !data.outAmount || data.outAmount === "0") {
            console.warn(
              "[Jupiter Quote] No outAmount in response:",
              rawData,
            );
            return null;
          }

          console.log("[Jupiter Quote] Success");
          return data as JupiterQuoteResponse;
        } catch (error: any) {
          const msg =
            error instanceof Error ? error.message : String(error);
          console.warn(`[Jupiter Quote] Endpoint ${i + 1} error:`, msg);
          lastError = error instanceof Error ? error : new Error(msg);

          // Wait before trying next endpoint
          if (i < JUPITER_QUOTE_ENDPOINTS.length - 1) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      }

      console.error(
        "[Jupiter Quote] All endpoints failed:",
        lastError?.message,
      );
      throw (
        lastError ||
        new Error("All Jupiter quote endpoints failed")
      );
    } catch (error) {
      console.error("[Jupiter Quote] Error:", error);
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
      let lastError: Error | null = null;

      for (let i = 0; i < JUPITER_PRICE_ENDPOINTS.length; i++) {
        try {
          const endpoint = JUPITER_PRICE_ENDPOINTS[i];
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          const response = await fetch(
            `${endpoint}/price?ids=${encodeURIComponent(ids)}`,
            {
              method: "GET",
              headers: {
                Accept: "application/json",
                "User-Agent": "Mozilla/5.0 (compatible; FixoriumWallet/1.0)",
              },
              signal: controller.signal,
            },
          );

          clearTimeout(timeoutId);

          if (!response.ok) {
            lastError = new Error(`HTTP ${response.status}`);
            continue;
          }

          const data = await response.json();
          return data.data || {};
        } catch (error: any) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (i < JUPITER_PRICE_ENDPOINTS.length - 1) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }
      }

      console.warn("[Jupiter Price] All endpoints failed, returning empty");
      return {};
    } catch (error) {
      console.error("[Jupiter Price] Error:", error);
      return {};
    }
  }

  /**
   * Create a swap transaction - calls Jupiter directly
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

      let lastError: Error | null = null;
      let lastStatus = 0;

      // Try multiple swap endpoints
      for (let endpointIdx = 0; endpointIdx < JUPITER_SWAP_ENDPOINTS.length; endpointIdx++) {
        const endpoint = JUPITER_SWAP_ENDPOINTS[endpointIdx];

        // Retry each endpoint twice
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            console.log(
              `[Jupiter Swap] Endpoint ${endpointIdx + 1}/${JUPITER_SWAP_ENDPOINTS.length}, Attempt ${attempt}/2`,
            );

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000);

            const response = await fetch(endpoint, {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (compatible; FixoriumWallet/1.0)",
              },
              body: JSON.stringify(body),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            lastStatus = response.status;

            const text = await response.text().catch(() => "");

            if (response.ok) {
              try {
                const data = JSON.parse(text || "{}");
                console.log("[Jupiter Swap] Success");
                return data as JupiterSwapResponse;
              } catch {
                console.warn("[Jupiter Swap] Failed to parse response");
                return null;
              }
            }

            // Check if it's a stale quote error
            const lower = (text || "").toLowerCase();
            const isStaleQuote =
              lower.includes("1016") ||
              lower.includes("stale") ||
              lower.includes("quote expired") ||
              lower.includes("simulation failed");

            if (isStaleQuote) {
              console.warn(
                "[Jupiter Swap] Detected stale/expired quote (1016)",
              );
              throw new Error("Quote expired - please refresh and try again");
            }

            // Retryable errors
            if (response.status === 429 || response.status >= 500) {
              console.warn(
                `[Jupiter Swap] Retryable error (${response.status})`,
              );
              lastError = new Error(
                `HTTP ${response.status}: ${text.slice(0, 100)}`,
              );

              if (attempt < 2) {
                await new Promise((r) =>
                  setTimeout(r, 1000 * attempt),
                );
                continue;
              }
              break;
            }

            // Non-retryable error on this endpoint
            lastError = new Error(
              `HTTP ${response.status}: ${text.slice(0, 100)}`,
            );
            break;
          } catch (error: any) {
            const msg =
              error instanceof Error ? error.message : String(error);
            console.warn(
              `[Jupiter Swap] Endpoint ${endpointIdx + 1}, Attempt ${attempt} error:`,
              msg.slice(0, 100),
            );

            if (msg.includes("Quote expired")) {
              throw error;
            }

            lastError = error instanceof Error ? error : new Error(msg);

            if (attempt === 1) {
              await new Promise((r) => setTimeout(r, 1000));
            }
          }
        }

        // Wait before trying next endpoint
        if (endpointIdx < JUPITER_SWAP_ENDPOINTS.length - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      const errorMsg = lastError?.message || "Failed to create swap";
      console.error(
        "[Jupiter Swap] All endpoints failed:",
        errorMsg,
      );
      throw lastError || new Error(errorMsg);
    } catch (error) {
      console.error("[Jupiter Swap] Error:", error);
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
    return true;
  }
}

export const jupiterV6API = new JupiterV6API();
