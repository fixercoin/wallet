// Helius API Service for Solana blockchain data
export interface HeliusTokenAccount {
  account: {
    data: {
      parsed: {
        info: {
          mint: string;
          tokenAmount: {
            amount: string;
            decimals: number;
            uiAmount: number;
            uiAmountString: string;
          };
        };
      };
    };
  };
}

export interface HeliusBalanceResponse {
  jsonrpc: string;
  result: number;
  id: number;
}

export interface HeliusTokenAccountsResponse {
  jsonrpc: string;
  result: {
    value: HeliusTokenAccount[];
  };
  id: number;
}

// Token metadata interface for simplified token info
export interface TokenMetadata {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

// Basic known token list (minimal, can be expanded)
const KNOWN_TOKENS: Record<string, TokenMetadata> = {
  So11111111111111111111111111111111111111112: {
    mint: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns: {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logoURI:
      "https://cdn.builder.io/api/v1/image/assets%2F559a5e19be114c9d8427d6683b845144%2Fc2ea69828dbc4a90b2deed99c2291802?format=webp&width=800",
  },
  H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: {
    mint: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
    symbol: "FIXERCOIN",
    name: "FIXERCOIN",
    decimals: 6,
    logoURI: "https://i.postimg.cc/htfMF9dD/6x2D7UQ.png",
  },
  EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: {
    mint: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
    symbol: "LOCKER",
    name: "LOCKER",
    decimals: 6,
    logoURI: "https://via.placeholder.com/64x64/8b5cf6/ffffff?text=LO",
  },
};

class HeliusAPI {
  private apiKey: string;
  private baseUrl: string;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 200; // Minimum 200ms between requests
  private isRateLimited: boolean = false;
  private rateLimitResetTime: number = 0;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`;
  }

  /**
   * Wait for rate limit protection
   */
  private async waitForRateLimit(): Promise<void> {
    // Check if we're currently rate limited
    if (this.isRateLimited && Date.now() < this.rateLimitResetTime) {
      const waitTime = this.rateLimitResetTime - Date.now();
      console.log(`Rate limited, waiting ${waitTime}ms before next request...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.isRateLimited = false;
    }

    // Ensure minimum interval between requests
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Handle rate limit response
   */
  private handleRateLimit(): void {
    this.isRateLimited = true;
    // Wait 30 seconds before trying again
    this.rateLimitResetTime = Date.now() + 30000;
    console.warn("Helius API rate limited, will retry after 30 seconds");
  }

  /**
   * Make a JSON-RPC call to Helius with rate limiting protection
   */
  private async makeRpcCall(
    method: string,
    params: any[] = [],
    retries = 3,
  ): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Apply rate limiting protection
        await this.waitForRateLimit();

        console.log(
          `Helius API call: ${method} (attempt ${attempt + 1}/${retries + 1})`,
        );

        const response = await fetch(this.baseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "SolanaWallet/1.0",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method,
            params,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");

          // Handle rate limiting specifically
          if (response.status === 429) {
            console.warn(`Helius rate limited on attempt ${attempt + 1}`);
            this.handleRateLimit();

            if (attempt < retries) {
              // Exponential backoff for rate limits: 5s, 15s, 45s
              const backoffTime = Math.min(5000 * Math.pow(3, attempt), 45000);
              console.log(`Rate limit backoff: waiting ${backoffTime}ms`);
              await new Promise((resolve) => setTimeout(resolve, backoffTime));
              continue;
            }
          }

          throw new Error(
            `Helius API call failed: ${response.status} ${response.statusText}. ${errorText}`,
          );
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(
            `Helius RPC error: ${data.error.message} (code: ${data.error.code || "unknown"})`,
          );
        }

        console.log(`Helius API call successful: ${method}`);
        return data.result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retries) {
          // Standard exponential backoff for other errors: 1s, 2s, 4s
          const backoffTime = 1000 * Math.pow(2, attempt);
          console.warn(
            `Helius API call failed, retrying in ${backoffTime}ms:`,
            lastError.message,
          );
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
        }
      }
    }

    throw new Error(
      `Helius API call failed after ${retries + 1} attempts: ${lastError?.message || "Unknown error"}`,
    );
  }

  /**
   * Get SOL balance for a wallet
   */
  async getWalletBalance(publicKey: string): Promise<number> {
    try {
      console.log(`Fetching SOL balance for ${publicKey} via Helius...`);
      const res = await this.makeRpcCall("getBalance", [publicKey]);
      const lamports =
        typeof res === "number"
          ? res
          : typeof (res as any)?.value === "number"
            ? (res as any).value
            : 0;
      const balance = lamports / 1_000_000_000; // Convert lamports to SOL
      const safe = Number.isFinite(balance) ? balance : 0;
      console.log(`SOL balance: ${safe}`);
      return safe;
    } catch (error) {
      console.error("Error fetching wallet balance via Helius:", error);
      throw error;
    }
  }

  /**
   * Get all token accounts for a wallet
   */
  async getTokenAccounts(publicKey: string) {
    try {
      console.log(`Fetching token accounts for ${publicKey} via Helius...`);

      const response = await this.makeRpcCall("getTokenAccountsByOwner", [
        publicKey,
        {
          programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        },
        {
          encoding: "jsonParsed",
          commitment: "confirmed",
        },
      ]);

      console.log(
        `Found ${response.value?.length || 0} token accounts via Helius`,
      );

      return response.value.map((account: HeliusTokenAccount) => {
        const parsedInfo = account.account.data.parsed.info;
        const mint = parsedInfo.mint;
        const balance = parsedInfo.tokenAmount.uiAmount || 0;
        const decimals = parsedInfo.tokenAmount.decimals;

        // Get token metadata from known tokens or use defaults
        const metadata = KNOWN_TOKENS[mint] || {
          mint,
          symbol: "UNKNOWN",
          name: "Unknown Token",
          decimals,
        };

        return {
          ...metadata,
          balance,
          decimals: decimals || metadata.decimals,
        };
      });
    } catch (error) {
      console.error("Error fetching token accounts via Helius:", error);
      throw error;
    }
  }

  /**
   * Get token metadata from on-chain data
   */
  async getTokenMetadata(mint: string): Promise<TokenMetadata | null> {
    // First check if it's a known token
    if (KNOWN_TOKENS[mint]) {
      return KNOWN_TOKENS[mint];
    }

    try {
      // Try to get token supply info which includes decimals
      const supplyInfo = await this.makeRpcCall("getTokenSupply", [mint]);

      return {
        mint,
        symbol: "UNKNOWN",
        name: "Unknown Token",
        decimals: supplyInfo.decimals || 9,
      };
    } catch (error) {
      console.error(
        `Error fetching metadata for token ${mint} via Helius:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get multiple account info in batch
   */
  async getMultipleAccounts(publicKeys: string[]) {
    try {
      return await this.makeRpcCall("getMultipleAccounts", [
        publicKeys,
        {
          encoding: "jsonParsed",
          commitment: "confirmed",
        },
      ]);
    } catch (error) {
      console.error("Error fetching multiple accounts via Helius:", error);
      return { value: [] };
    }
  }

  /**
   * Get account info for a specific account
   */
  async getAccountInfo(publicKey: string) {
    try {
      return await this.makeRpcCall("getAccountInfo", [
        publicKey,
        {
          encoding: "jsonParsed",
          commitment: "confirmed",
        },
      ]);
    } catch (error) {
      console.error(
        `Error fetching account info for ${publicKey} via Helius:`,
        error,
      );
      return null;
    }
  }

  /**
   * Add custom token to known tokens list
   */
  addKnownToken(metadata: TokenMetadata) {
    KNOWN_TOKENS[metadata.mint] = metadata;
  }

  /**
   * Get all known tokens
   */
  getKnownTokens(): Record<string, TokenMetadata> {
    return { ...KNOWN_TOKENS };
  }
}

// Create and export singleton instance
const HELIUS_API_KEY = import.meta.env.HELIUS_API_KEY || "";
export const heliusAPI = new HeliusAPI(HELIUS_API_KEY);

// Export the class for potential future use
export { HeliusAPI };
