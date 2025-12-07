// Token metadata interface for simplified token info
import { Connection, PublicKey } from "@solana/web3.js";
import { SOLANA_RPC_URL } from "../../../utils/solanaConfig";

export interface TokenMetadata {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

// Basic known token list (minimal, can be expanded)
export const KNOWN_TOKENS: Record<string, TokenMetadata> = {
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
  "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump": {
    mint: "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump",
    symbol: "FXM",
    name: "Fixorium",
    decimals: 6,
    logoURI:
      "https://cdn.builder.io/api/v1/image/assets%2Feff28b05195a4f5f8e8aaeec5f72bbfe%2Fc78ec8b33eec40be819bca514ed06f2a?format=webp&width=800",
  },
};

// Request queue to prevent duplicate requests
const requestQueue = new Map<string, Promise<any>>();

// Use Helius RPC exclusively for all SOL and token operations
// All RPC calls are routed through Helius with no fallbacks
const HELIUS_RPC_ENDPOINT = SOLANA_RPC_URL;

/**
 * Make a Solana JSON RPC call directly to public endpoints
 * No backend proxy needed - calls public RPC endpoints directly
 */
export const makeRpcCall = async (
  method: string,
  params: any[] = [],
  retries = 2,
): Promise<any> => {
  const requestKey = `${method}-${JSON.stringify(params)}`;

  // Return existing promise if request is already in progress
  if (requestQueue.has(requestKey)) {
    return requestQueue.get(requestKey);
  }

  const requestPromise = (async () => {
    console.log(
      `[RPC] Using endpoint: ${HELIUS_RPC_ENDPOINT.substring(0, 50)}...`,
    );
    let lastError: Error | null = null;
    let lastErrorStatus: number | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutMs = 12000; // 12s timeout
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        console.log(
          `[RPC] Calling ${method} on Helius (attempt ${attempt + 1}/${retries + 1})`,
        );

        const response = await fetch(HELIUS_RPC_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
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
          const responseText = await response.text().catch(() => "");
          const errorMsg = `HTTP ${response.status} ${response.statusText}: ${responseText}`;
          console.warn(`[RPC] ${method} on Helius returned ${response.status}`);

          if (response.status === 429 || response.status === 503) {
            lastErrorStatus = response.status;
          }

          lastError = new Error(errorMsg);
        } else {
          const text = await response.text().catch(() => "");
          let data: any = null;

          try {
            data = text ? JSON.parse(text) : null;
          } catch (e) {
            console.warn(`[RPC] Failed to parse response from Helius`);
            lastError = new Error(`Failed to parse response: ${String(e)}`);
            throw lastError;
          }

          if (data && data.error) {
            const errorMsg = data.error.message || JSON.stringify(data.error);
            console.warn(
              `[RPC] ${method} on Helius returned error:`,
              data.error,
            );
            lastError = new Error(errorMsg);
            throw lastError;
          }

          // Success!
          return data?.result ?? data ?? text;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isTimeout =
          errorMsg.includes("abort") || errorMsg.includes("timeout");
        const isCors =
          errorMsg.includes("Failed to fetch") ||
          errorMsg.includes("CORS") ||
          errorMsg.includes("cors");

        if (isTimeout) {
          console.warn(`[RPC] ${method} on Helius timed out after 12s`);
        } else if (isCors) {
          console.warn(`[RPC] ${method} on Helius blocked by CORS policy`);
        } else {
          console.warn(`[RPC] ${method} on Helius failed:`, errorMsg);
        }

        lastError = error instanceof Error ? error : new Error(errorMsg);
      }

      // Retry if we have attempts left
      if (attempt < retries) {
        const isRateLimited =
          lastErrorStatus === 429 || lastErrorStatus === 503;
        const baseDelay = isRateLimited ? 3000 : 800;
        const delayMs = baseDelay * Math.pow(2, attempt);
        const cappedDelayMs = Math.min(delayMs, 30000); // Cap at 30 seconds

        console.warn(
          `[RPC] ${method} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${cappedDelayMs}ms`,
        );

        await new Promise((resolve) => setTimeout(resolve, cappedDelayMs));
      }
    }

    throw new Error(
      `RPC call failed after ${retries + 1} attempts on Helius: ${lastError?.message || "Unknown error"}`,
    );
  })();

  requestQueue.set(requestKey, requestPromise);

  try {
    const result = await requestPromise;
    return result;
  } finally {
    requestQueue.delete(requestKey);
  }
};

/**
 * Get SOL balance for a wallet using Helius
 */
export const getWalletBalance = async (publicKey: string): Promise<number> => {
  try {
    const res = await makeRpcCall("getBalance", [publicKey], 3);
    const lamports =
      typeof res === "number"
        ? res
        : typeof (res as any)?.value === "number"
          ? (res as any).value
          : 0;
    const sol = lamports / 1_000_000_000;
    return Number.isFinite(sol) ? sol : 0;
  } catch (error) {
    console.error("[Balance] Failed to fetch balance from Helius:", error);
    return 0;
  }
};

/**
 * Get all token accounts for a wallet using Helius
 */
export const getTokenAccounts = async (publicKey: string) => {
  const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

  console.log(
    `[Token Accounts] Fetching token accounts for ${publicKey} using Helius...`,
  );

  try {
    const response = await makeRpcCall(
      "getTokenAccountsByOwner",
      [
        publicKey,
        { programId: TOKEN_PROGRAM_ID },
        { encoding: "jsonParsed", commitment: "confirmed" },
      ],
      3, // Retry up to 3 times via Helius
    );

    console.log(`[Token Accounts] Helius response received:`, response);

    const value = (response as any)?.value || [];
    if (Array.isArray(value)) {
      console.log(
        `[Token Accounts] Got ${value.length} token accounts from Helius`,
      );
      return value
        .map((account: any) => {
          try {
            const parsedInfo = account.account.data.parsed.info;
            const mint = parsedInfo.mint;
            const decimals = parsedInfo.tokenAmount.decimals;

            // Extract balance - prefer uiAmount, fall back to calculating from raw amount
            let balance = 0;
            if (typeof parsedInfo.tokenAmount.uiAmount === "number") {
              balance = parsedInfo.tokenAmount.uiAmount;
            } else if (parsedInfo.tokenAmount.amount) {
              // Convert raw amount to UI amount using decimals
              const rawAmount = BigInt(parsedInfo.tokenAmount.amount);
              balance = Number(rawAmount) / Math.pow(10, decimals || 0);
            }

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
          } catch (parseError) {
            console.error(
              "[Token Accounts] Error parsing account:",
              account,
              parseError,
            );
            return null;
          }
        })
        .filter((token) => token !== null);
    }
    return [];
  } catch (error) {
    console.error(
      "[Token Accounts] Failed to fetch token accounts from Helius:",
      error,
    );
    return [];
  }
};

/**
 * Get token metadata from on-chain data
 */
export const getTokenMetadata = async (
  mint: string,
): Promise<TokenMetadata | null> => {
  // First check if it's a known token
  if (KNOWN_TOKENS[mint]) {
    return KNOWN_TOKENS[mint];
  }

  try {
    // Try to get token supply info which includes decimals
    const supplyInfo = await makeRpcCall("getTokenSupply", [mint]);

    return {
      mint,
      symbol: "UNKNOWN",
      name: "Unknown Token",
      decimals: supplyInfo.decimals || 9,
    };
  } catch (error) {
    console.error(`Error fetching metadata for token ${mint}:`, error);
    return null;
  }
};

/**
 * Get multiple account info in batch
 */
export const getMultipleAccounts = async (publicKeys: string[]) => {
  try {
    return await makeRpcCall("getMultipleAccounts", [
      publicKeys,
      {
        encoding: "jsonParsed",
        commitment: "confirmed",
      },
    ]);
  } catch (error) {
    console.error("Error fetching multiple accounts:", error);
    return { value: [] };
  }
};

/**
 * Get account info for a specific account
 */
export const getAccountInfo = async (publicKey: string) => {
  try {
    return await makeRpcCall("getAccountInfo", [
      publicKey,
      {
        encoding: "jsonParsed",
        commitment: "confirmed",
      },
    ]);
  } catch (error) {
    console.error(`Error fetching account info for ${publicKey}:`, error);
    return null;
  }
};

/**
 * Add custom token to known tokens list
 */
export const addKnownToken = (metadata: TokenMetadata) => {
  KNOWN_TOKENS[metadata.mint] = metadata;
};

/**
 * Get all known tokens
 */
export const getKnownTokens = (): Record<string, TokenMetadata> => {
  return { ...KNOWN_TOKENS };
};

/**
 * Fetch balance for a specific token mint using Helius
 * This is useful for custom tokens that might not be in the general token list
 */
export const getTokenBalanceForMint = async (
  walletAddress: string,
  tokenMint: string,
): Promise<number | null> => {
  try {
    const response = await makeRpcCall(
      "getTokenAccountsByOwner",
      [
        walletAddress,
        { mint: tokenMint },
        { encoding: "jsonParsed", commitment: "confirmed" },
      ],
      2,
    );

    const value = (response as any)?.value || [];
    if (Array.isArray(value) && value.length > 0) {
      const account = value[0];
      const parsedInfo = account.account.data.parsed.info;
      const decimals = parsedInfo.tokenAmount.decimals;

      let balance = 0;
      if (typeof parsedInfo.tokenAmount.uiAmount === "number") {
        balance = parsedInfo.tokenAmount.uiAmount;
      } else if (parsedInfo.tokenAmount.amount) {
        const rawAmount = BigInt(parsedInfo.tokenAmount.amount);
        balance = Number(rawAmount) / Math.pow(10, decimals || 0);
      }

      console.log(
        `[Token Balance] Fetched ${tokenMint}: ${balance} via Helius`,
      );
      return balance;
    }
    return null;
  } catch (error) {
    console.error(
      `[Token Balance] Failed to fetch balance for ${tokenMint} from Helius:`,
      error,
    );
    return null;
  }
};
