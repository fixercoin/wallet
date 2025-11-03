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
    let lastErrorStatus: number | null = null;

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

          // Try calling known public RPC endpoints directly as a fallback
          const directEndpoints = [
            SOLANA_RPC_URL,
            "https://rpc.ankr.com/solana",
            "https://api.mainnet-beta.solana.com",
            "https://solana.publicnode.com",
          ].filter(Boolean);

          for (const endpoint of directEndpoints) {
            try {
              const controller2 = new AbortController();
              const timeout2 = setTimeout(() => controller2.abort(), 10000);
              const resp2 = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
                signal: controller2.signal,
              });
              clearTimeout(timeout2);

              if (!resp2.ok) {
                const t = await resp2.text().catch(() => "");
                console.warn(`Direct RPC ${endpoint} returned ${resp2.status}: ${t}`);
                continue;
              }

              const txt2 = await resp2.text().catch(() => "");
              try {
                const parsed = txt2 ? JSON.parse(txt2) : null;
                if (parsed && parsed.error) {
                  throw new Error(parsed.error.message || "RPC error");
                }
                return parsed?.result ?? parsed ?? txt2;
              } catch (e) {
                return txt2;
              }
            } catch (e) {
              console.warn(`Direct RPC endpoint ${endpoint} failed:`, e instanceof Error ? e.message : String(e));
              continue;
            }
          }

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

          // Special handling for rate limiting - use longer backoff
          if (response.status === 429) {
            lastErrorStatus = 429;
            throw new Error(
              `RPC call failed: ${response.status} ${response.statusText}. ${details}${diagSuffix}`,
            );
          }

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
          // Use exponential backoff, with extra delay for rate limiting
          const isRateLimited = lastErrorStatus === 429;
          const baseDelay = isRateLimited ? 3000 : 1000; // 3s base for 429, 1s for others
          const delayMs = baseDelay * Math.pow(2, attempt); // Exponential: 3s, 6s, 12s for 429

          console.warn(
            `[RPC Call] ${method} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delayMs}ms:`,
            lastError.message,
          );

          await new Promise((resolve) => setTimeout(resolve, delayMs));
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
    console.warn(
      "Proxy RPC getBalance failed, attempting direct web3 fallback:",
      error,
    );
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
 * Includes multiple fallback RPC endpoints for reliability
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
      console.log(
        `[Token Accounts] Got ${value.length} token accounts from proxy RPC`,
      );
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
    console.warn(
      "[Token Accounts] Proxy RPC getTokenAccountsByOwner failed, attempting direct web3.js fallback:",
      error,
    );
  }

  // Fallback: Try direct web3.js Connection via SOLANA_RPC_URL
  try {
    console.log("[Token Accounts] Attempting direct web3.js fallback...");
    const conn = new Connection(SOLANA_RPC_URL, { commitment: "confirmed" });
    const accounts = await conn.getParsedTokenAccountsByOwner(
      new PublicKey(publicKey),
      { programId: new PublicKey(TOKEN_PROGRAM_ID) },
    );

    console.log(
      `[Token Accounts] Got ${accounts.value.length} token accounts from web3.js fallback`,
    );

    return accounts.value.map((account: any) => {
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
  } catch (webError) {
    console.error(
      "[Token Accounts] Direct web3.js fallback also failed:",
      webError,
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
