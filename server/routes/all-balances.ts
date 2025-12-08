import { RequestHandler } from "express";
import { PublicKey } from "@solana/web3.js";

const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SOL_MINT = "So11111111111111111111111111111111111111112";

// Get RPC endpoint with priority for free endpoints and Alchemy fallback
function getRpcEndpoint(): string {
  const solanaRpcUrl = process.env.SOLANA_RPC_URL?.trim();

  if (solanaRpcUrl) {
    console.log("[AllBalances] Using SOLANA_RPC_URL endpoint");
    return solanaRpcUrl;
  }

  const alchemyEndpoint =
    "https://solana-mainnet.g.alchemy.com/v2/T79j33bZKpxgKTLx-KDW5";

  console.log("[AllBalances] Using Alchemy RPC endpoint as primary fallback");
  return alchemyEndpoint;
}

// Known token metadata
const KNOWN_TOKENS: Record<
  string,
  { mint: string; symbol: string; name: string; decimals: number }
> = {
  [SOL_MINT]: {
    mint: SOL_MINT,
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
    name: "USDT TETHER",
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
  "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump": {
    mint: "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump",
    symbol: "FXM",
    name: "Fixorium",
    decimals: 6,
  },
};

interface TokenBalance {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  address?: string;
  uiAmount?: number;
  rawAmount?: string;
}

interface AllBalancesResponse {
  publicKey: string;
  tokens: TokenBalance[];
  totalTokens: number;
  solBalance: number;
  source: string;
  timestamp: number;
}

/**
 * Fetch all token balances including SOL for a wallet using free RPC endpoints
 * Accepts: ?publicKey=<address> or ?wallet=<address> or ?address=<address>
 * Returns: All tokens with balances and SOL
 */
export const handleGetAllBalances: RequestHandler = async (req, res) => {
  try {
    const publicKey =
      (req.query.publicKey as string) ||
      (req.query.wallet as string) ||
      (req.query.address as string);

    if (!publicKey || typeof publicKey !== "string") {
      return res.status(400).json({
        error: "Missing or invalid wallet address parameter",
        details: {
          received: req.query,
          expected: {
            publicKey:
              "Solana wallet address (e.g., 8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV)",
          },
        },
      });
    }

    // Validate Solana address format
    try {
      new PublicKey(publicKey);
    } catch {
      return res.status(400).json({ error: "Invalid Solana address format" });
    }

    const endpoint = getRpcEndpoint();
    const endpointLabel = endpoint.split("?")[0];

    console.log(
      `[AllBalances] Fetching all balances for ${publicKey.slice(0, 8)}... from ${endpointLabel}`,
    );

    let solBalance = 0;
    let tokens: TokenBalance[] = [];

    try {
      // Fetch SPL token accounts and SOL balance in parallel
      const [tokenResponse, solResponse] = await Promise.all([
        // Fetch all SPL token accounts
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTokenAccountsByOwner",
            params: [
              publicKey,
              { programId: TOKEN_PROGRAM_ID },
              { encoding: "jsonParsed", commitment: "confirmed" },
            ],
          }),
          signal: AbortSignal.timeout(15000),
        }).catch(() => null),

        // Fetch native SOL balance
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "getBalance",
            params: [publicKey],
          }),
          signal: AbortSignal.timeout(15000),
        }).catch(() => null),
      ]);

      // Process SPL token accounts
      if (tokenResponse) {
        try {
          const tokenData = await tokenResponse.json();
          const accounts = tokenData?.result?.value ?? [];

          tokens = accounts
            .map((account: any) => {
              try {
                const info = account.account.data.parsed.info;
                const mint = info.mint;
                const decimals = info.tokenAmount.decimals;
                const rawAmount = info.tokenAmount.amount;

                const raw = BigInt(rawAmount);
                const balance = Number(raw) / Math.pow(10, decimals);

                const metadata = KNOWN_TOKENS[mint] || {
                  mint,
                  symbol: "UNKNOWN",
                  name: "Unknown Token",
                  decimals,
                };

                return {
                  ...metadata,
                  balance,
                  address: account.pubkey,
                  rawAmount,
                  uiAmount: balance,
                };
              } catch (err) {
                console.warn(
                  "[AllBalances] Error processing token account:",
                  err,
                );
                return null;
              }
            })
            .filter((t) => t !== null);
        } catch (err) {
          console.warn(
            "[AllBalances] Error parsing token response:",
            err instanceof Error ? err.message : String(err),
          );
        }
      }

      // Process SOL balance
      if (solResponse) {
        try {
          const solData = await solResponse.json();
          const lamports = solData.result?.value ?? solData.result ?? 0;
          solBalance =
            typeof lamports === "number" ? lamports / 1_000_000_000 : 0;

          if (solBalance < 0) solBalance = 0;

          console.log(
            `[AllBalances] ✅ Fetched SOL balance: ${solBalance} SOL`,
          );
        } catch (err) {
          console.warn(
            "[AllBalances] Error parsing SOL response:",
            err instanceof Error ? err.message : String(err),
          );
          solBalance = 0;
        }
      }

      // Check if SOL already exists in token list
      const solIndex = tokens.findIndex((t) => t.mint === SOL_MINT);

      if (solIndex >= 0) {
        // Update existing SOL entry
        tokens[solIndex] = {
          ...tokens[solIndex],
          balance: solBalance,
          uiAmount: solBalance,
        };
      } else {
        // Insert SOL at the beginning
        tokens.unshift({
          ...KNOWN_TOKENS[SOL_MINT],
          balance: solBalance,
          uiAmount: solBalance,
        });
      }

      // Always include known tokens even if wallet doesn't have them (for consistent dashboard display)
      const specialTokens = [
        "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump", // FXM
        "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump", // FIXERCOIN
        "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump", // LOCKER
      ];

      specialTokens.forEach((specialMint) => {
        const exists = tokens.some((t) => t.mint === specialMint);
        if (!exists && KNOWN_TOKENS[specialMint]) {
          tokens.push({
            ...KNOWN_TOKENS[specialMint],
            balance: 0,
            uiAmount: 0,
          });
        }
      });

      // Log summary
      console.log(
        `[AllBalances] ✅ Found ${tokens.length} tokens for ${publicKey.slice(0, 8)}... (SOL: ${solBalance} SOL)`,
      );

      // Log significant tokens
      tokens.forEach((token) => {
        if (
          ["FXM", "FIXERCOIN", "LOCKER", "USDC", "USDT"].includes(
            token.symbol,
          ) ||
          token.balance > 0
        ) {
          console.log(
            `[AllBalances] Token: ${token.symbol} (${token.mint.slice(0, 8)}...) Balance: ${token.balance}`,
          );
        }
      });

      const response: AllBalancesResponse = {
        publicKey,
        tokens,
        totalTokens: tokens.length,
        solBalance,
        source: endpointLabel,
        timestamp: Date.now(),
      };

      return res.json(response);
    } catch (fetchError) {
      console.error("[AllBalances] Fetch error:", fetchError);
      return res.status(502).json({
        error: "Failed to fetch balances from RPC endpoint",
        details: {
          message:
            fetchError instanceof Error ? fetchError.message : "Unknown error",
          endpoint: endpointLabel,
          hint: "Check RPC endpoint configuration",
        },
      });
    }
  } catch (error) {
    console.error("[AllBalances] Handler error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
      details: {
        hint: "Check RPC endpoint configuration",
      },
    });
  }
};
