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

import { resolveApiUrl, fetchWithFallback } from "@/lib/api-client";

class JupiterAPI {
  private readonly baseUrl = "https://lite-api.jup.ag/swap/v1";
  private readonly priceApiUrl = "https://price.jup.ag/v4";

  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 120,
    opts?: {
      includeDexes?: string;
      excludeDexes?: string;
      onlyDirectRoutes?: boolean;
    },
  ): Promise<JupiterQuoteResponse | null> {
    // Retry logic for transient failures
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const params = new URLSearchParams({
          inputMint,
          outputMint,
          amount: amount.toString(),
          slippageBps: slippageBps.toString(),
        });
        if (opts?.includeDexes) params.set("includeDexes", opts.includeDexes);
        if (opts?.excludeDexes) params.set("excludeDexes", opts.excludeDexes);
        if (typeof opts?.onlyDirectRoutes === "boolean")
          params.set("onlyDirectRoutes", String(opts.onlyDirectRoutes));

        const path = `/api/jupiter/quote?${params.toString()}`;
        console.log(
          `Jupiter quote request (attempt ${attempt}/3): ${inputMint} -> ${outputMint}`,
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        try {
          const response = await fetch(path, {
            method: "GET",
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          const txt = await response.text().catch(() => "");

          if (!response.ok) {
            try {
              const errorData = txt ? JSON.parse(txt) : {};
              const errorCode = errorData?.code;

              // If no route found, return null (don't retry for this)
              if (
                errorCode === "NO_ROUTE_FOUND" ||
                response.status === 404 ||
                response.status === 400
              ) {
                console.warn(
                  `No route available from Jupiter for ${inputMint} -> ${outputMint} (${response.status})`,
                );
                return null;
              }
            } catch (parseErr) {
              console.debug("Could not parse error response:", parseErr);
            }

            // For server errors or rate limits, retry
            if (response.status === 429 || response.status >= 500) {
              console.warn(
                `Jupiter API error ${response.status} (attempt ${attempt}/3), retrying...`,
              );
              if (attempt < 3) {
                await new Promise((r) => setTimeout(r, attempt * 1500));
                continue;
              }
            }

            console.warn(
              "Jupiter quote unavailable (proxy):",
              response.status,
              txt.substring(0, 100),
            );
            return null;
          }

          try {
            const raw = JSON.parse(txt);
            const quote =
              raw && typeof raw === "object" && "quote" in raw
                ? raw.quote
                : raw;
            console.log(
              `✅ Jupiter quote success (attempt ${attempt}): ${quote?.outAmount}`,
            );
            if (!quote || !quote.outAmount || quote.outAmount === "0") {
              console.warn("Parsed Jupiter quote has no outAmount:", raw);
              return null;
            }
            return quote;
          } catch (e) {
            console.warn("Failed to parse Jupiter proxy quote response:", e);
            return null;
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const isNetworkError =
          msg.includes("Failed to fetch") ||
          msg.includes("timeout") ||
          msg.includes("ECONNREFUSED") ||
          msg.includes("NetworkError") ||
          msg.includes("abort");

        if (attempt < 3 && isNetworkError) {
          console.warn(
            `Jupiter transient error (attempt ${attempt}/3), retrying: ${msg}`,
          );
          await new Promise((r) => setTimeout(r, attempt * 1500));
          continue;
        }
        console.error(
          `Error fetching quote from Jupiter (attempt ${attempt}):`,
          error,
        );
        if (attempt === 3) return null;
      }
    }

    return null;
  }

  async getSwapTransaction(
    swapRequest: JupiterSwapRequest,
    retryCount: number = 0,
    maxRetries: number = 2,
  ): Promise<JupiterSwapResponse | null> {
    try {
      const url = resolveApiUrl("/api/jupiter/swap");
      console.log(
        `Sending Jupiter swap request (attempt ${retryCount + 1}/${maxRetries + 1}) for:`,
        swapRequest.quoteResponse?.inputMint,
        "->",
        swapRequest.quoteResponse?.outputMint,
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(swapRequest),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const txt = await response.text().catch(() => "");
          let errorObj: any = {};
          try {
            errorObj = JSON.parse(txt);
          } catch {
            errorObj = { error: txt };
          }

          console.error(
            `Jupiter swap error response (attempt ${retryCount + 1}):`,
            response.status,
            errorObj,
          );

          const errorMsg =
            errorObj?.error ||
            errorObj?.message ||
            errorObj?.details ||
            txt ||
            "Unknown error";

          // Detect Jupiter error 1016 (swap simulation failed / stale quote)
          const isError1016 =
            errorObj?.code === 1016 ||
            errorMsg.includes("1016") ||
            errorMsg.includes("Swap simulation failed") ||
            errorMsg.includes("simulation") ||
            errorMsg.includes("stale") ||
            response.status === 530;

          if (isError1016) {
            // Attempt to refresh the quote and retry automatically
            const qr = swapRequest.quoteResponse;
            if (
              retryCount < maxRetries &&
              qr?.inputMint &&
              qr?.outputMint &&
              qr?.inAmount
            ) {
              console.warn(
                "STALE_QUOTE detected. Refreshing quote and retrying swap...",
              );
              try {
                const refreshedQuote = await this.getQuote(
                  qr.inputMint,
                  qr.outputMint,
                  parseInt(qr.inAmount),
                  typeof qr.slippageBps === "number" ? qr.slippageBps : 120,
                );
                if (refreshedQuote) {
                  const refreshedReq: JupiterSwapRequest = {
                    ...swapRequest,
                    quoteResponse: refreshedQuote,
                  };
                  return this.getSwapTransaction(
                    refreshedReq,
                    retryCount + 1,
                    maxRetries,
                  );
                }
              } catch (e) {
                console.warn("Quote refresh failed after STALE_QUOTE:", e);
              }
            }
            throw new Error(
              "STALE_QUOTE: The quote expired or changed. Try again after requesting a new quote.",
            );
          }

          // For 502/503 errors (gateway/service unavailable), retry with same quote
          if (
            (response.status === 502 || response.status === 503) &&
            retryCount < maxRetries
          ) {
            console.log(`Retrying swap after ${response.status} error...`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
            return this.getSwapTransaction(
              swapRequest,
              retryCount + 1,
              maxRetries,
            );
          }

          throw new Error(
            `Jupiter swap failed (${response.status}): ${errorMsg}${
              errorObj?.details ? ` - ${errorObj.details}` : ""
            }`,
          );
        }

        const data = await response.json();
        if (!data.swapTransaction) {
          console.warn(
            "Jupiter swap response missing swapTransaction field:",
            Object.keys(data),
          );
        }
        return data;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isNetworkError =
        msg.includes("Failed to fetch") ||
        msg.includes("timeout") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("NetworkError") ||
        msg.includes("abort");

      if (retryCount < maxRetries && isNetworkError) {
        console.warn(
          `Jupiter swap transient error (attempt ${retryCount + 1}/${maxRetries + 1}), retrying: ${msg}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return this.getSwapTransaction(swapRequest, retryCount + 1, maxRetries);
      }

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
    if (tokenMints.length === 0) return {};

    try {
      const ids = tokenMints.join(",");

      console.log(
        `Fetching prices for ${tokenMints.length} tokens via Jupiter`,
      );

      const url = resolveApiUrl(`/api/jupiter/price?ids=${ids}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

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
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
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
    // Try proxy first, then fall back to public Jupiter token endpoints
    try {
      const resp = await fetchWithFallback("/api/jupiter/tokens?type=all", {
        method: "GET",
      }).catch(() => new Response("", { status: 0 } as any));
      if (resp.ok) {
        return (await resp.json()) as JupiterToken[];
      }
    } catch (e) {
      // ignore and try fallbacks below
    }

    // No direct external fallbacks; rely on proxy only to avoid DNS/CORS issues
    return [];
  }

  async getStrictTokenList(): Promise<JupiterToken[]> {
    // Try multiple endpoints and strategies
    const endpoints = [
      { url: "/api/jupiter/tokens?type=strict", name: "strict", direct: false },
      { url: "/api/jupiter/tokens?type=all", name: "all", direct: false },
      {
        url: "https://token.jup.ag/strict",
        name: "direct-strict",
        direct: true,
      },
      { url: "https://token.jup.ag/all", name: "direct-all", direct: true },
      { url: "https://cache.jup.ag/tokens", name: "cache", direct: true },
    ];

    for (const endpoint of endpoints) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(
            `Fetching Jupiter tokens from: ${endpoint.name} (attempt ${attempt}/2)`,
          );

          let resp: Response;
          if (endpoint.direct) {
            resp = await this.fetchWithTimeout(endpoint.url, 15000);
          } else {
            resp = await fetchWithFallback(endpoint.url, { method: "GET" });
          }

          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data) && data.length > 0) {
              console.log(
                `✅ Successfully loaded ${data.length} tokens from ${endpoint.name}`,
              );
              return data as JupiterToken[];
            }
          } else {
            console.warn(`[${endpoint.name}] HTTP ${resp.status}, retrying...`);
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 1500));
              continue;
            }
          }
          break;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn(
            `[${endpoint.name}] Failed (attempt ${attempt}/2): ${msg}`,
          );
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
        }
      }
    }

    console.warn("All Jupiter token endpoints failed, returning empty list");
    return [];
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

  /**
   * Fetch token prices from Jupiter's free price API
   * @param mints Array of token mint addresses
   * @returns Object mapping mint to price in USD
   */
  async getPricesByMints(mints: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};

    if (!mints || mints.length === 0) {
      return prices;
    }

    const uniqueMints = Array.from(new Set(mints.filter((m) => m)));

    if (uniqueMints.length === 0) {
      return prices;
    }

    try {
      const ids = uniqueMints.map((m) => encodeURIComponent(m)).join(",");
      const url = `https://api.jup.ag/price?ids=${ids}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(
            `[Jupiter Price] Request failed with status ${response.status}`,
          );
          return prices;
        }

        const data = await response.json();

        if (data?.data && typeof data.data === "object") {
          Object.entries(data.data).forEach(
            ([mint, priceData]: [string, any]) => {
              if (priceData?.price && typeof priceData.price === "string") {
                const price = parseFloat(priceData.price);
                if (isFinite(price) && price > 0) {
                  prices[mint] = price;
                }
              }
            },
          );

          console.log(
            `[Jupiter Price] ✅ Got ${Object.keys(prices).length} prices from Jupiter`,
          );
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        const errorMsg =
          fetchError instanceof Error ? fetchError.message : String(fetchError);
        console.warn(`[Jupiter Price] Network error: ${errorMsg}`);
      }
    } catch (error) {
      console.warn(
        `[Jupiter Price] Error:`,
        error instanceof Error ? error.message : String(error),
      );
    }

    return prices;
  }
}

export const jupiterAPI = new JupiterAPI();
