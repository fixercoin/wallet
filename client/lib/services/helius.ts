// Helius API Service for Solana blockchain data
// Note: This service now uses public RPC endpoints directly instead of proxying through a backend
import { SOLANA_RPC_URL } from "../../../utils/solanaConfig";

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
  private endpoints: string[];
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 100; // Minimum 100ms between requests
  private isRateLimited: boolean = false;
  private rateLimitResetTime: number = 0;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    // Use ONLY Helius RPC endpoint - no fallbacks to other providers
    this.endpoints = [SOLANA_RPC_URL].filter(Boolean);
    if (this.endpoints.length === 0) {
      throw new Error(
        "SOLANA_RPC_URL (Helius) is required. Please set HELIUS_API_KEY environment variable."
      );
    }
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
   * Make a JSON-RPC call to public RPC endpoints with rate limiting protection
   * No backend proxy needed - calls public endpoints directly
   */
  private async makeRpcCall(
    method: string,
    params: any[] = [],
    retries = 2,
  ): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      for (const endpoint of this.endpoints) {
        try {
          // Apply rate limiting protection
          await this.waitForRateLimit();

          console.log(
            `RPC call: ${method} on ${endpoint.substring(0, 30)}... (attempt ${attempt + 1}/${retries + 1})`,
          );

          const controller = new AbortController();
          const timeoutMs = 12000; // 12s timeout
          const timeout = setTimeout(() => controller.abort(), timeoutMs);

          const response = await fetch(endpoint, {
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
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (!response.ok) {
            const errorText = await response
              .text()
              .catch(() => "Unknown error");

            // Handle rate limiting specifically
            if (response.status === 429) {
              console.warn(`RPC rate limited (429) on ${endpoint}`);
              this.handleRateLimit();

              if (attempt < retries) {
                // Exponential backoff for rate limits
                const backoffTime = Math.min(
                  3000 * Math.pow(2, attempt),
                  30000,
                );
                console.log(`Rate limit backoff: waiting ${backoffTime}ms`);
                await new Promise((resolve) =>
                  setTimeout(resolve, backoffTime),
                );
              }
            }

            lastError = new Error(
              `${response.status} ${response.statusText}: ${errorText}`,
            );
            console.warn(
              `RPC call failed on ${endpoint}: ${lastError.message}`,
            );
            continue;
          }

          const data = await response.json();

          if (data.error) {
            const errorMsg = data.error.message || JSON.stringify(data.error);
            console.warn(`RPC error on ${endpoint}: ${errorMsg}`);
            lastError = new Error(errorMsg);
            continue;
          }

          console.log(`RPC call successful: ${method}`);
          return data.result;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          const isTimeout =
            errorMsg.includes("abort") || errorMsg.includes("timeout");

          if (isTimeout) {
            console.warn(`RPC call timed out on ${endpoint}`);
          } else {
            console.warn(`RPC call failed on ${endpoint}: ${errorMsg}`);
          }

          lastError = error instanceof Error ? error : new Error(errorMsg);
          continue;
        }
      }

      // All endpoints failed for this attempt
      if (attempt < retries) {
        const backoffTime = 1000 * Math.pow(2, attempt);
        console.warn(
          `All RPC endpoints failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${backoffTime}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
      }
    }

    throw new Error(
      `RPC call failed after ${retries + 1} attempts across all endpoints: ${lastError?.message || "Unknown error"}`,
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

  /**
   * Get transaction signatures for a wallet
   */
  async getSignaturesForAddress(
    publicKey: string,
    limit: number = 20,
  ): Promise<
    Array<{
      signature: string;
      blockTime: number | null;
      err: any | null;
    }>
  > {
    try {
      console.log(
        `Fetching ${limit} transaction signatures for ${publicKey}...`,
      );
      return await this.makeRpcCall("getSignaturesForAddress", [
        publicKey,
        { limit },
      ]);
    } catch (error) {
      console.error("Error fetching signatures for address:", error);
      throw error;
    }
  }

  /**
   * Get parsed transaction details
   */
  async getParsedTransaction(signature: string): Promise<any> {
    try {
      console.log(`Fetching parsed transaction: ${signature}`);
      return await this.makeRpcCall("getTransaction", [
        signature,
        {
          encoding: "jsonParsed",
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        },
      ]);
    } catch (error) {
      console.error("Error fetching parsed transaction:", error);
      return null;
    }
  }

  /**
   * Parse transaction to extract token transfers
   */
  parseTransactionForTokenTransfers(
    tx: any,
    walletAddress: string,
  ): Array<{
    type: "send" | "receive";
    token: string;
    amount: number;
    decimals: number;
    signature: string;
    blockTime: number | null;
    mint?: string;
  }> {
    const transfers: Array<{
      type: "send" | "receive";
      token: string;
      amount: number;
      decimals: number;
      signature: string;
      blockTime: number | null;
      mint?: string;
    }> = [];

    if (!tx || !tx.transaction || !tx.transaction.message) return transfers;

    const message = tx.transaction.message;
    const blockTime = tx.blockTime;
    const signature = tx.transaction.signatures?.[0];

    // Look for token transfer instructions
    if (message.instructions && Array.isArray(message.instructions)) {
      message.instructions.forEach((instr: any) => {
        // Handle SPL token transfers
        if (
          instr.parsed?.type === "transfer" ||
          instr.parsed?.type === "transferChecked"
        ) {
          const info = instr.parsed.info;
          // Extract amount - uiAmount is already in human-readable format
          let amount = 0;
          if (info.tokenAmount) {
            if (typeof info.tokenAmount.uiAmount === "number") {
              amount = info.tokenAmount.uiAmount;
            } else if (typeof info.tokenAmount.uiAmount === "string") {
              amount = parseFloat(info.tokenAmount.uiAmount);
            } else if (info.tokenAmount.amount) {
              // If no uiAmount, use raw amount divided by decimals
              const decimals = info.tokenAmount.decimals || 6;
              amount =
                parseFloat(info.tokenAmount.amount) / Math.pow(10, decimals);
            }
          }
          const decimals = info.tokenAmount?.decimals || 6;
          let destination = info.destination;
          let source = info.source;

          // Handle both string and object formats for addresses
          if (typeof destination === "object" && destination?.pubkey) {
            destination = destination.pubkey;
          }
          if (typeof source === "object" && source?.pubkey) {
            source = source.pubkey;
          }

          const mint = info.mint || info.token || "UNKNOWN";

          // Determine if wallet sent or received
          if (destination === walletAddress) {
            transfers.push({
              type: "receive",
              token: mint,
              amount: Number.isFinite(amount) ? amount : 0,
              decimals,
              signature: signature || "",
              blockTime,
              mint,
            });
          }

          if (source === walletAddress) {
            transfers.push({
              type: "send",
              token: mint,
              amount: Number.isFinite(amount) ? amount : 0,
              decimals,
              signature: signature || "",
              blockTime,
              mint,
            });
          }
        }

        // Handle native SOL transfers from System program
        if (instr.program === "system" && instr.parsed?.type === "transfer") {
          const info = instr.parsed.info;
          const lamports = info.lamports || 0;
          let destination = info.destination;
          let source = info.source;

          // Handle both string and object formats for addresses
          if (typeof destination === "object" && destination?.pubkey) {
            destination = destination.pubkey;
          }
          if (typeof source === "object" && source?.pubkey) {
            source = source.pubkey;
          }

          // SOL has 9 decimals
          const amount = lamports / Math.pow(10, 9);
          const decimals = 9;
          const mint = "So11111111111111111111111111111111111111112"; // SOL mint

          // Determine if wallet sent or received
          if (destination === walletAddress) {
            transfers.push({
              type: "receive",
              token: mint,
              amount: Number.isFinite(amount) ? amount : 0,
              decimals,
              signature: signature || "",
              blockTime,
              mint,
            });
          }

          if (source === walletAddress) {
            transfers.push({
              type: "send",
              token: mint,
              amount: Number.isFinite(amount) ? amount : 0,
              decimals,
              signature: signature || "",
              blockTime,
              mint,
            });
          }
        }
      });
    }

    // Fallback using meta pre/post balances to compute net deltas
    try {
      const meta = tx.meta;
      if (meta) {
        const pre = Array.isArray(meta.preTokenBalances)
          ? meta.preTokenBalances
          : [];
        const post = Array.isArray(meta.postTokenBalances)
          ? meta.postTokenBalances
          : [];
        const seenMints = new Set(transfers.map((tr) => tr.mint || tr.token));
        const key = (b: any) =>
          `${b?.owner || ""}|${b?.mint || b?.mintId || ""}`;
        const preMap = new Map<string, any>();
        pre.forEach((b: any) => preMap.set(key(b), b));

        for (const pb of post) {
          if (!pb?.owner || pb.owner !== walletAddress) continue;
          const k = key(pb);
          const b0 = preMap.get(k);
          const decimals = pb?.uiTokenAmount?.decimals ?? pb?.decimals ?? 6;
          const amtPost =
            typeof pb?.uiTokenAmount?.uiAmount === "number"
              ? pb.uiTokenAmount.uiAmount
              : pb?.uiTokenAmount?.amount
                ? parseFloat(pb.uiTokenAmount.amount) / Math.pow(10, decimals)
                : 0;
          const amtPre = b0
            ? typeof b0?.uiTokenAmount?.uiAmount === "number"
              ? b0.uiTokenAmount.uiAmount
              : b0?.uiTokenAmount?.amount
                ? parseFloat(b0.uiTokenAmount.amount) / Math.pow(10, decimals)
                : 0
            : 0;
          const delta = amtPost - amtPre;
          const mint = pb?.mint || pb?.mintId || "";
          if (Math.abs(delta) > 0 && mint && !seenMints.has(mint)) {
            transfers.push({
              type: delta >= 0 ? "receive" : "send",
              token: mint,
              amount: Number.isFinite(Math.abs(delta)) ? Math.abs(delta) : 0,
              decimals,
              signature: signature || "",
              blockTime,
              mint,
            });
          }
        }

        // SOL via preBalances/postBalances
        if (
          Array.isArray(meta.preBalances) &&
          Array.isArray(meta.postBalances)
        ) {
          const keys = message?.accountKeys || [];
          const idx = keys.findIndex(
            (k: any) =>
              (typeof k === "string" ? k : k?.pubkey) === walletAddress,
          );
          if (idx >= 0) {
            const lamportsPre = meta.preBalances[idx] || 0;
            const lamportsPost = meta.postBalances[idx] || 0;
            const dLamports = lamportsPost - lamportsPre;
            if (dLamports !== 0) {
              const amount = Math.abs(dLamports) / 1_000_000_000;
              const mint = "So11111111111111111111111111111111111111112";
              const hasSol = transfers.some((tr) => tr.mint === mint);
              if (!hasSol && Number.isFinite(amount)) {
                transfers.push({
                  type: dLamports >= 0 ? "receive" : "send",
                  token: mint,
                  amount,
                  decimals: 9,
                  signature: signature || "",
                  blockTime,
                  mint,
                });
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Meta-based transfer parsing failed:", e);
    }

    return transfers;
  }
}

// Create and export singleton instance
const HELIUS_API_KEY = import.meta.env.HELIUS_API_KEY || "";
export const heliusAPI = new HeliusAPI(HELIUS_API_KEY);

// Export the class for potential future use
export { HeliusAPI };
