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

      const url = `/api/jupiter/quote?${params.toString()}`;
      console.log("Jupiter quote proxy request:", url);

      let response: Response;
      try {
        response = await this.fetchWithTimeout(url, 8000);
      } catch (timeoutErr) {
        console.warn("Jupiter quote request timed out:", timeoutErr);
        // Try direct Jupiter API as fallback
        const directUrl = `${this.baseUrl}/quote?${params.toString()}`;
        try {
          const directResp = await this.fetchWithTimeout(directUrl, 8000);
          if (directResp.ok) {
            return await directResp.json();
          }
        } catch (directErr) {
          console.warn("Direct Jupiter API also failed:", directErr);
        }
        return null;
      }

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
              `Invalid parameters for Jupiter quote: ${inputMint} -> ${outputMint}, details:`,
              errorData,
            );
            return null;
          }
        } catch (parseErr) {
          console.debug("Could not parse error response:", parseErr);
        }

        // Fallback: try direct Jupiter API (CORS-enabled) for retries
        const directUrl = `${this.baseUrl}/quote?${params.toString()}`;
        const directResp = await this.fetchWithTimeout(directUrl, 8000).catch(
          () => new Response("", { status: 0 } as any),
        );
        if (directResp.ok) {
          try {
            return await directResp.json();
          } catch {}
        }
        console.warn(
          "Jupiter quote unavailable (proxy & direct):",
          response.status,
          txt,
        );
        return null;
      }

      try {
        const data = JSON.parse(txt);
        if (!data || typeof data !== "object") {
          console.warn("Invalid quote response format:", typeof data);
          return null;
        }
        return data as JupiterQuoteResponse;
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
      const response = await fetch(`/api/jupiter/swap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(swapRequest),
      });

      if (!response.ok) {
        const txt = await response.text().catch(() => "");
        throw new Error(`Jupiter proxy swap error: ${response.status} ${txt}`);
      }

      return await response.json();
    } catch (error) {
      console.error(
        "Error getting swap transaction from Jupiter proxy:",
        error,
      );
      return null;
    }
  }

  async getTokenPrice(tokenMint: string): Promise<number | null> {
    try {
      const response = await fetch(`/api/jupiter/price?ids=${tokenMint}`);

      if (!response.ok) {
        throw new Error(`Jupiter Price API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data?.[tokenMint]?.price || null;
    } catch (error) {
      console.error("Error fetching token price from Jupiter:", error);
      return null;
    }
  }

  async getTokenPrices(tokenMints: string[]): Promise<Record<string, number>> {
    try {
      const ids = tokenMints.join(",");

      console.log(`Fetching prices for ${tokenMints.length} tokens via proxy`);

      const response = await fetch(`/api/jupiter/price?ids=${ids}`, {
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
        `Successfully fetched ${Object.keys(prices).length} prices via proxy`,
      );
      return prices;
    } catch (error) {
      console.error("Error fetching token prices from Jupiter proxy:", error);

      // Try fallback approach - fetch prices individually
      return this.getTokenPricesIndividually(tokenMints);
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

  private async getTokenPricesIndividually(
    tokenMints: string[],
  ): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};

    console.log(
      `Falling back to individual price fetching for ${tokenMints.length} tokens`,
    );

    // Limit concurrent requests to avoid rate limiting
    const maxConcurrent = Math.min(8, tokenMints.length); // Increased concurrency to speed up fetching
    for (let i = 0; i < tokenMints.length; i += maxConcurrent) {
      const batch = tokenMints.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(async (mint) => {
        try {
          const price = await this.getTokenPrice(mint);
          if (price !== null) {
            prices[mint] = price;
          }
        } catch (error) {
          console.warn(`Failed to fetch price for ${mint}:`, error);
        }
      });

      await Promise.allSettled(batchPromises);

      // Small delay between batches to avoid rate limiting
      if (i + maxConcurrent < tokenMints.length) {
        await new Promise((resolve) => setTimeout(resolve, 200)); // Reduced delay
      }
    }

    console.log(
      `Individual fetching completed: ${Object.keys(prices).length} prices obtained`,
    );
    return prices;
  }

  async getAllTokens(): Promise<JupiterToken[]> {
    try {
      const response = await fetch("/api/jupiter/tokens?type=all");

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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ms);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });
        clearTimeout(timeout);
        return response;
      } catch (error) {
        clearTimeout(timeout);
        throw error;
      }
    };

    const typesToTry = ["strict", "all"];

    for (const type of typesToTry) {
      try {
        const response = await fetchWithTimeout(
          `/api/jupiter/tokens?type=${type}`,
          10000,
        );

        if (!response.ok) {
          console.warn(
            `Token list fetch returned ${response.status} for type=${type}`,
          );
          continue;
        }

        // Validate response is actually JSON and contains data
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.warn(`Invalid content-type for token list: ${contentType}`);
          continue;
        }

        // Read and validate response body before parsing
        const responseText = await response.text();
        if (!responseText || responseText.trim().length === 0) {
          console.warn(
            `Empty response body from token list fetch (type=${type})`,
          );
          continue;
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.warn(
            `Failed to parse token list JSON (type=${type}):`,
            parseError,
          );
          continue;
        }

        // Validate it's an array and has tokens
        if (!Array.isArray(data)) {
          console.warn(
            `Token list response is not an array (type=${type}), got:`,
            typeof data,
          );
          continue;
        }

        if (data.length === 0) {
          console.warn(
            `Token list is empty (type=${type}), trying fallback...`,
          );
          continue;
        }

        // Validate first item has required fields
        const firstToken = data[0];
        if (!firstToken.address || !firstToken.symbol) {
          console.warn(
            `Token list has invalid format (type=${type}), missing address or symbol`,
          );
          continue;
        }

        console.log(`Successfully loaded ${data.length} tokens (type=${type})`);
        return data;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`Error fetching token list (type=${type}):`, errorMsg);
        // Continue to next type
      }
    }

    console.error(
      "Failed to fetch token list from all endpoints, using fallback",
    );
    return this.getFallbackTokenList();
  }

  private getFallbackTokenList(): JupiterToken[] {
    // Fallback list with essential tokens
    return [
      {
        address: "So11111111111111111111111111111111111111112",
        chainId: 101,
        decimals: 9,
        name: "Solana",
        symbol: "SOL",
        logoURI:
          "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
      },
      {
        address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        chainId: 101,
        decimals: 6,
        name: "USDC Coin",
        symbol: "USDC",
        logoURI:
          "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
      },
      {
        address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
        chainId: 101,
        decimals: 6,
        name: "Tether USD",
        symbol: "USDT",
        logoURI:
          "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns/logo.png",
      },
      {
        address: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
        chainId: 101,
        decimals: 6,
        name: "FixerCoin",
        symbol: "FIXERCOIN",
        logoURI: "",
      },
      {
        address: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
        chainId: 101,
        decimals: 6,
        name: "Locker",
        symbol: "LOCKER",
        logoURI: "",
      },
    ];
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
