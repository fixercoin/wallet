import { RequestHandler } from "express";
import { PublicKey, Connection } from "@solana/web3.js";

// Get RPC endpoint with public fallback
function getRpcEndpoint(): string {
  const heliusApiKey = process.env.HELIUS_API_KEY?.trim();
  const heliusRpcUrl = process.env.HELIUS_RPC_URL?.trim();
  const solanaRpcUrl = process.env.SOLANA_RPC_URL?.trim();

  // Priority: Helius API key > HELIUS_RPC_URL > SOLANA_RPC_URL > Public endpoint
  if (heliusApiKey) {
    return `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
  }
  if (heliusRpcUrl) {
    return heliusRpcUrl;
  }
  if (solanaRpcUrl) {
    return solanaRpcUrl;
  }

  // Fallback to reliable public RPC endpoint for dev environments
  console.log(
    "[TokenAccounts] Using public Solana RPC endpoint. For production, set HELIUS_API_KEY or HELIUS_RPC_URL environment variable.",
  );
  return "https://solana.publicnode.com";
}

const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

// Known token metadata
const KNOWN_TOKENS: Record<
  string,
  { mint: string; symbol: string; name: string; decimals: number }
> = {
  So11111111111111111111111111111111111111112: {
    mint: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
  },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns: {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: {
    mint: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
    symbol: "FIXERCOIN",
    name: "FIXERCOIN",
    decimals: 6,
  },
  EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: {
    mint: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
    symbol: "LOCKER",
    name: "LOCKER",
    decimals: 6,
  },
};

export const handleGetTokenAccounts: RequestHandler = async (req, res) => {
  try {
    const publicKey =
      (req.query.publicKey as string) ||
      (req.query.wallet as string) ||
      (req.query.address as string);

    if (!publicKey || typeof publicKey !== "string") {
      return res.status(400).json({
        error: "Missing or invalid wallet address",
      });
    }

    // Validate it's a valid Solana address
    try {
      new PublicKey(publicKey);
    } catch {
      return res.status(400).json({
        error: "Invalid Solana address",
      });
    }

    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [
        publicKey,
        { programId: TOKEN_PROGRAM_ID },
        { encoding: "jsonParsed", commitment: "confirmed" },
      ],
    };

    // Get RPC endpoint on-demand instead of at module load time
    const endpoint = getRpcEndpoint();
    let lastError: Error | null = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort("RPC request timeout after 12 seconds"),
        12000,
      );

      try {
        console.log(
          `[TokenAccounts] Fetching token accounts from Helius for ${publicKey}`,
        );

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(
            `Helius RPC returned HTTP ${response.status} ${response.statusText}`,
          );
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error.message || "Helius RPC error");
        }

        const accounts = data.result?.value || [];
        const tokens = accounts.map((account: any) => {
          const parsedInfo = account.account.data.parsed.info;
          const mint = parsedInfo.mint;
          const decimals = parsedInfo.tokenAmount.decimals;

          // Extract balance
          let balance = 0;
          if (typeof parsedInfo.tokenAmount.uiAmount === "number") {
            balance = parsedInfo.tokenAmount.uiAmount;
          } else if (parsedInfo.tokenAmount.amount) {
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
        });

        // Fetch SOL balance using a separate request with its own timeout
        let solBalance: number | null = null;
        let solFetchSucceeded = false;

        try {
          const solBalanceBody = {
            jsonrpc: "2.0",
            id: 2,
            method: "getBalance",
            params: [publicKey],
          };

          // Create a NEW controller for SOL fetch to avoid timeout conflicts
          const solController = new AbortController();
          const solTimeoutId = setTimeout(() => {
            solController.abort();
          }, 12000); // 12 second timeout for SOL fetch

          try {
            const solResponse = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(solBalanceBody),
              signal: solController.signal,
            });

            clearTimeout(solTimeoutId);

            if (solResponse.ok) {
              const solData = await solResponse.json();
              if (solData.result !== undefined && !solData.error) {
                const lamports = solData.result;
                solBalance =
                  typeof lamports === "number"
                    ? lamports / 1_000_000_000
                    : typeof lamports?.value === "number"
                      ? lamports.value / 1_000_000_000
                      : 0;

                if (solBalance >= 0) {
                  solFetchSucceeded = true;
                  console.log(
                    `[TokenAccounts] ✅ Fetched SOL balance: ${solBalance} SOL`,
                  );
                }
              }
            }
          } catch (err) {
            clearTimeout(solTimeoutId);
            throw err;
          }
        } catch (solError) {
          console.warn(
            `[TokenAccounts] Warning: Could not fetch SOL balance separately, SOL balance will be fetched from dedicated endpoint`,
            solError instanceof Error ? solError.message : String(solError),
          );
          // Don't set solBalance here - let client fetch from /api/wallet/balance endpoint
          solFetchSucceeded = false;
        }

        // Always ensure SOL is in the tokens array with the fetched balance
        const hasSOL = tokens.some(
          (t) => t.mint === "So11111111111111111111111111111111111111112",
        );

        if (!hasSOL && solFetchSucceeded) {
          tokens.unshift({
            ...KNOWN_TOKENS["So11111111111111111111111111111111111111112"],
            balance: solBalance ?? 0,
          });
        } else if (hasSOL && solFetchSucceeded && solBalance !== null) {
          // Update existing SOL entry with fetched balance
          const solIndex = tokens.findIndex(
            (t) => t.mint === "So11111111111111111111111111111111111111112",
          );
          if (solIndex >= 0) {
            tokens[solIndex] = {
              ...tokens[solIndex],
              balance: solBalance,
            };
          }
        }

        console.log(
          `[TokenAccounts] ✅ Found ${tokens.length} tokens for ${publicKey.slice(0, 8)} via Helius${solFetchSucceeded ? ` (SOL: ${solBalance} SOL)` : " (SOL will be fetched separately)"}`,
        );
        return res.json({
          publicKey,
          tokens,
          count: tokens.length,
          ...(solFetchSucceeded && { solBalance }),
        });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMsg = lastError.message || "Unknown error";
      console.error(`[TokenAccounts] Helius RPC error: ${errorMsg}`);

      // Return default tokens as fallback
      // This ensures the UI still shows known tokens with 0 balance
      const defaultTokens = Object.values(KNOWN_TOKENS).map((token) => ({
        ...token,
        balance: 0,
      }));

      return res.status(200).json({
        publicKey,
        tokens: defaultTokens,
        count: defaultTokens.length,
        warning:
          "Token accounts unavailable - returning default tokens with zero balance",
      });
    }
  } catch (error) {
    console.error("[TokenAccounts] Unexpected error:", error);

    // Return default tokens even on unexpected errors
    const defaultTokens = Object.values(KNOWN_TOKENS).map((token) => ({
      ...token,
      balance: 0,
    }));

    return res.status(200).json({
      publicKey: (req.query.publicKey as string) || "unknown",
      tokens: defaultTokens,
      count: defaultTokens.length,
      warning: "Token accounts unavailable due to server error",
    });
  }
};
