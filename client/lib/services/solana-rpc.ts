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

// Request queue to prevent duplicate requests
const requestQueue = new Map<string, Promise<any>>();

/**
 * Make a Solana JSON RPC call through our proxy
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
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        let response: Response;
        try {
          response = await fetch("/api/solana-rpc", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              method,
              params,
              id: Date.now(),
            }),
          });
        } catch (fetchErr) {
          // Network/connection error (e.g. Dev server not running, middleware not mounted)
          const fetchError =
            fetchErr instanceof Error ? fetchErr.message : String(fetchErr);

          // Health check to provide better guidance
          try {
            const health = await fetch("/api/health")
              .then((r) => r.text())
              .catch(() => "");
            throw new Error(
              `Network fetch failed: ${fetchError}. API health check: ${health || "no response"}`,
            );
          } catch (hcErr) {
            throw new Error(
              `Network fetch failed: ${fetchError}. API health check failed: ${hcErr instanceof Error ? hcErr.message : String(hcErr)}`,
            );
          }
        }

        if (!response.ok) {
          // Try to read body as text, then try to parse JSON for structured error info
          const responseText = await response.text().catch(() => "");
          let parsedErr: any = null;
          try {
            parsedErr = responseText ? JSON.parse(responseText) : null;
          } catch {}

          const details =
            parsedErr?.error?.message ||
            parsedErr?.message ||
            responseText ||
            response.statusText ||
            "(no response body)";

          // If server-provided diagnostics endpoint exists, attempt to fetch and append
          let serverDiag = "";
          if (response.status === 500) {
            try {
              serverDiag = await fetch("/api/debug/rpc")
                .then((d) => d.text())
                .catch(() => "");
            } catch {}
          }

          const diagSuffix = serverDiag
            ? ` Server diagnostics: ${serverDiag}`
            : "";
          throw new Error(
            `RPC call failed: ${response.status} ${response.statusText}. ${details}${diagSuffix}`,
          );
        }

        // Try to parse response as JSON, if not available return raw text
        const text = await response.text().catch(() => "");
        let data: any = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch (e) {
          data = text;
        }

        if (data && data.error) {
          throw new Error(
            `RPC error: ${data.error.message} (code: ${data.error.code || "unknown"})`,
          );
        }

        return data?.result ?? data ?? text;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retries) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (attempt + 1)),
          );
        }
      }
    }

    throw new Error(
      `RPC call failed after ${retries + 1} attempts: ${lastError?.message || "Unknown error"}`,
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
 * Get SOL balance for a wallet
 */
export const getWalletBalance = async (publicKey: string): Promise<number> => {
  // First try via our API proxy (with retries/failover)
  try {
    const res = await makeRpcCall("getBalance", [publicKey]);
    const lamports =
      typeof res === "number"
        ? res
        : typeof (res as any)?.value === "number"
          ? (res as any).value
          : 0;
    const sol = lamports / 1_000_000_000;
    if (Number.isFinite(sol)) return sol;
  } catch (error) {
    console.warn("Proxy RPC getBalance failed, attempting direct web3 fallback:", error);
  }

  // Fallback: call Solana directly via web3.js (avoids proxy issues/rate limits)
  try {
    const conn = new Connection(SOLANA_RPC_URL, { commitment: "confirmed" });
    const lamports = await conn.getBalance(new PublicKey(publicKey));
    const sol = lamports / 1_000_000_000;
    return Number.isFinite(sol) ? sol : 0;
  } catch (error) {
    console.error("Direct web3 getBalance failed:", error);
    return 0;
  }
};

/**
 * Get all token accounts for a wallet
 */
export const getTokenAccounts = async (publicKey: string) => {
  const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

  // Try via API proxy first
  try {
    const response = await makeRpcCall("getTokenAccountsByOwner", [
      publicKey,
      { programId: TOKEN_PROGRAM_ID },
      { encoding: "jsonParsed", commitment: "confirmed" },
    ]);

    const value = (response as any)?.value || [];
    if (Array.isArray(value) && value.length >= 0) {
      return value.map((account: any) => {
        const parsedInfo = account.account.data.parsed.info;
        const mint = parsedInfo.mint;
        const balance = parsedInfo.tokenAmount.uiAmount || 0;
        const decimals = parsedInfo.tokenAmount.decimals;

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
    }
  } catch (error) {
    console.warn("Proxy RPC getTokenAccountsByOwner failed, attempting direct web3 fallback:", error);
  }

  // Fallback: direct web3.js call to Solana
  try {
    const conn = new Connection(SOLANA_RPC_URL, { commitment: "confirmed" });
    const owner = new PublicKey(publicKey);
    const programId = new PublicKey(TOKEN_PROGRAM_ID);
    const resp = await conn.getParsedTokenAccountsByOwner(owner, { programId });

    return resp.value.map((account) => {
      const parsedInfo: any = (account.account.data as any).parsed.info;
      const mint: string = parsedInfo.mint;
      const balance: number = parsedInfo.tokenAmount.uiAmount || 0;
      const decimals: number = parsedInfo.tokenAmount.decimals;

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
    console.error("Direct web3 getParsedTokenAccountsByOwner failed:", error);
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
