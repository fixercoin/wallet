export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
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

export interface JupiterSwapRequest {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  useSharedAccounts?: boolean;
  feeAccount?: string;
  trackingAccount?: string;
  computeUnitPriceMicroLamports?: number;
  prioritizationFeeLamports?: number;
  asLegacyTransaction?: boolean;
  useTokenLedger?: boolean;
  destinationTokenAccount?: string;
}

export interface JupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
}

export interface JupiterToken {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  logoURI?: string;
  tags?: string[];
}

import { resolveApiUrl } from "@/lib/api-client";

class JupiterAPI {
  private readonly baseUrl = "https://lite-api.jup.ag/swap/v1";
  private readonly priceApiUrl = "https://price.jup.ag/v4";

  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50,
  ): Promise<JupiterQuoteResponse | null> {
    try {
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
      });

      const path = `/api/jupiter/quote?${params.toString()}`;
      const url = resolveApiUrl(path);
      console.log("Jupiter quote proxy request:", url);

      const response = await this.fetchWithTimeout(url, 15000).catch(
        () => new Response("", { status: 0 } as any),
      );
      const txt = await response.text().catch(() => "");

      if (!response.ok) {
        try {
          const errorData = txt ? JSON.parse(txt) : {};
          const errorCode = errorData?.code;

          // If no route found, return null to trigger indicative pricing fallback
          if (errorCode === "NO_ROUTE_FOUND" || response.status === 404) {
            console.warn(
              `No swap route available from Jupiter for ${inputMint} -> ${outputMint}`,
            );
            return null;
          }

          // For other client errors (400, etc), also return null
          if (response.status === 400) {
            console.warn(
              `Invalid parameters for Jupiter quote: ${inputMint} -> ${outputMint}`,
            );
            return null;
          }
        } catch (parseErr) {
          console.debug("Could not parse error response:", parseErr);
        }

        console.warn(
          "Jupiter quote unavailable (proxy):",
          response.status,
          txt,
        );
        return null;
      }

      try {
        return JSON.parse(txt);
      } catch (e) {
        console.warn("Failed to parse Jupiter proxy quote response:", e);
        return null;
      }
    } catch (error) {
      console.error("Error fetching quote from Jupiter proxy:", error);
      return null;
    }
  }

  async getSwapTransaction(
    swapRequest: JupiterSwapRequest,
  ): Promise<JupiterSwapResponse | null> {
    try {
      const url = resolveApiUrl("/api/jupiter/swap");
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(swapRequest),
      });

      if (!response.ok) {
        const txt = await response.text().catch(() => "");
        try {
          const errorJson = JSON.parse(txt);
          const errorMsg = errorJson?.error || errorJson?.message || txt;
          // Check for Jupiter error 1016 (swap simulation failed)
          if (
            errorJson?.code === 1016 ||
            errorMsg?.includes("1016") ||
            errorMsg?.includes("Swap simulation failed") ||
            errorMsg?.includes("simulation")
          ) {
            throw new Error(
              `Jupiter error 1016: Swap simulation failed (stale quote). ${errorMsg}`,
            );
          }
          throw new Error(
            `Jupiter proxy swap error: ${response.status} ${errorMsg}`,
          );
        } catch (parseErr: any) {
          const detailedMsg =
            parseErr?.message ||
            `Jupiter proxy swap error: ${response.status} ${txt}`;
          throw new Error(detailedMsg);
        }
      }

      return await response.json();
    } catch (error) {
      console.error(
        "Error getting swap transaction from Jupiter proxy:",
        error,
      );
      throw error; // Re-throw to let caller handle retry logic
    }
  }

  async getTokenPrice(tokenMint: string): Promise<number | null> {
    try {
      const url = resolveApiUrl(`/api/jupiter/price?ids=${tokenMint}`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Jupiter Price API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data?.[tokenMint]?.price || null;
    } catch (error) {
      // Return null to let higher-level code handle fallbacks to other price providers
      // Do NOT retry Jupiter API as that would create cascading failures
      console.error("Error fetching token price from Jupiter:", error);
      return null;
    }
  }

  async getTokenPrices(tokenMints: string[]): Promise<Record<string, number>> {
    try {
      const ids = tokenMints.join(",");

      console.log(
        `Fetching prices for ${tokenMints.length} tokens via Jupiter`,
      );

      const url = resolveApiUrl(`/api/jupiter/price?ids=${ids}`);
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }).catch(() => new Response("", { status: 0 } as any));

      if (!response.ok) {
        throw new Error(`Jupiter Price API error: ${response.status}`);
      }

      const data = await response.json();
      const prices: Record<string, number> = {};

      if (data.data) {
        for (const [mint, priceData] of Object.entries(data.data || {})) {
          if (
            priceData &&
            typeof priceData === "object" &&
            "price" in priceData
          ) {
            prices[mint] = (priceData as any).price;
          }
        }
      }

      console.log(
        `Successfully fetched ${Object.keys(prices).length} prices from Jupiter`,
      );
      return prices;
    } catch (error) {
      console.error("Error fetching token prices from Jupiter:", error);
      // Return empty object - let callers handle fallback to other providers
      return {};
    }
  }

  private async fetchWithTimeout(
    url: string,
    timeout: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async getAllTokens(): Promise<JupiterToken[]> {
    try {
      const url = resolveApiUrl("/api/jupiter/tokens?type=all");
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Jupiter Token API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching all tokens from Jupiter:", error);
      return [];
    }
  }

  async getStrictTokenList(): Promise<JupiterToken[]> {
    // Try strict, then fallback to all; use small timeout wrapper to avoid hanging
    const fetchWithTimeout = async (url: string, ms = 10000) => {
      const timeout = new Promise<Response>((resolve) =>
        setTimeout(() => resolve(new Response("", { status: 504 })), ms),
      );
      return (await Promise.race([fetch(url), timeout])) as Response;
    };
    try {
      let response = await fetchWithTimeout(
        resolveApiUrl("/api/jupiter/tokens?type=strict"),
      );
      if (!response.ok) {
        response = await fetchWithTimeout(
          resolveApiUrl("/api/jupiter/tokens?type=all"),
        );
      }
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.debug("Error fetching strict token list from Jupiter:", error);
      return [];
    }
  }

  formatSwapAmount(amount: number, decimals: number): string {
    return Math.floor(amount * Math.pow(10, decimals)).toString();
  }

  parseSwapAmount(amount: string, decimals: number): number {
    return parseInt(amount) / Math.pow(10, decimals);
  }

  calculatePriceImpact(
    inputAmount: number,
    outputAmount: number,
    marketPrice: number,
  ): number {
    const expectedOutput = inputAmount * marketPrice;
    return ((expectedOutput - outputAmount) / expectedOutput) * 100;
  }
}

export const jupiterAPI = new JupiterAPI();
