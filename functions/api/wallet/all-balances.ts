export const config = {
  runtime: "nodejs_esmsh",
};

const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SOL_MINT = "So11111111111111111111111111111111111111112";

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

interface Env {
  HELIUS_API_KEY?: string;
  HELIUS_RPC_URL?: string;
  SOLANA_RPC_URL?: string;
}

/**
 * Get Helius RPC endpoint from environment variables with fallback
 */
function getRpcEndpoint(env?: Env): string {
  const heliusApiKey = env?.HELIUS_API_KEY || process.env.HELIUS_API_KEY || "";
  const heliusRpcUrl = env?.HELIUS_RPC_URL || process.env.HELIUS_RPC_URL || "";
  const solanaRpcUrl = env?.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || "";

  if (heliusApiKey?.trim()) {
    return `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey.trim()}`;
  }
  if (heliusRpcUrl?.trim()) {
    return heliusRpcUrl.trim();
  }
  if (solanaRpcUrl?.trim()) {
    return solanaRpcUrl.trim();
  }

  // Fallback to public endpoints
  return "https://solana.publicnode.com";
}

/**
 * Fetch all token balances including SOL using Helius RPC
 */
async function handler(request: Request, env?: Env): Promise<Response> {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const url = new URL(request.url);
    const publicKey =
      url.searchParams.get("publicKey") ||
      url.searchParams.get("wallet") ||
      url.searchParams.get("address");

    if (!publicKey) {
      return new Response(
        JSON.stringify({
          error: "Missing wallet address parameter",
          details: {
            expected:
              "?publicKey=<address> or ?wallet=<address> or ?address=<address>",
          },
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    const endpoint = getRpcEndpoint(env);
    const endpointLabel = endpoint.split("?")[0];

    console.log(
      `[AllBalances] Fetching all balances for ${publicKey.slice(0, 8)}... from ${endpointLabel}`,
    );

    let solBalance = 0;
    let tokens: TokenBalance[] = [];

    try {
      // Fetch SPL token accounts and SOL balance in parallel with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const [tokenResponse, solResponse] = await Promise.allSettled([
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
          signal: controller.signal,
        }),

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
          signal: controller.signal,
        }),
      ]);

      clearTimeout(timeoutId);

      // Process SPL token accounts
      if (tokenResponse.status === "fulfilled" && tokenResponse.value?.ok) {
        try {
          const tokenData = await tokenResponse.value.json();
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

                // Skip zero-balance accounts
                if (balance === 0) return null;

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
            .filter(Boolean);
        } catch (err) {
          console.warn(
            "[AllBalances] Error parsing token response:",
            err instanceof Error ? err.message : String(err),
          );
        }
      }

      // Process SOL balance
      if (solResponse.status === "fulfilled" && solResponse.value?.ok) {
        try {
          const solData = await solResponse.value.json();
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
            `[AllBalances] Token: ${token.symbol} Balance: ${token.balance}`,
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

      return new Response(JSON.stringify(response), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (fetchError) {
      console.error("[AllBalances] Fetch error:", fetchError);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch balances from RPC endpoint",
          details: {
            message:
              fetchError instanceof Error
                ? fetchError.message
                : "Unknown error",
            endpoint: endpointLabel,
            hint: "Check that HELIUS_API_KEY is set in environment",
          },
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }
  } catch (error) {
    console.error("[AllBalances] Handler error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
        details: {
          hint: "Check that HELIUS_API_KEY environment variable is configured",
        },
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

export default handler;
