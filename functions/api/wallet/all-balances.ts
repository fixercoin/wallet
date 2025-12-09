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
  SOLANA_RPC_URL?: string;
  HELIUS_API_KEY?: string;
}

const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-api.projectserum.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solflare.network",
  "https://api.mainnet.solflare.com",
  "https://solana.publicnode.com",
];

const ALCHEMY_RPC =
  "https://solana-mainnet.g.alchemy.com/v2/T79j33bZKpxgKTLx-KDW5";

function getRpcEndpoint(env?: Env): string {
  const solanaRpcUrl = env?.SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || "";

  if (solanaRpcUrl?.trim()) {
    console.log("[AllBalances] Using SOLANA_RPC_URL endpoint");
    return solanaRpcUrl.trim();
  }

  // Try Helius
  const heliusApiKey = env?.HELIUS_API_KEY || process.env.HELIUS_API_KEY || "";
  if (heliusApiKey?.trim()) {
    const url = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey.trim()}`;
    console.log("[AllBalances] Using Helius endpoint");
    return url;
  }

  console.log("[AllBalances] Using public RPC endpoints");
  return RPC_ENDPOINTS[0];
}

/**
 * Fetch balance using getBalance RPC method
 */
async function fetchBalanceWithGetBalance(
  rpcUrl: string,
  publicKey: string,
  timeoutMs: number = 8000,
): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [publicKey],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.error || typeof data.result !== "number") {
      return null;
    }

    const lamports = data.result;
    if (lamports < 0) return null;

    return lamports / 1_000_000_000;
  } catch {
    return null;
  }
}

/**
 * Fetch balance using getAccountInfo RPC method
 */
async function fetchBalanceWithGetAccountInfo(
  rpcUrl: string,
  publicKey: string,
  timeoutMs: number = 8000,
): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [publicKey, { encoding: "base64" }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.error || !data.result?.value?.lamports) {
      return null;
    }

    const lamports = data.result.value.lamports;
    if (typeof lamports !== "number" || lamports < 0) {
      return null;
    }

    return lamports / 1_000_000_000;
  } catch {
    return null;
  }
}

/**
 * Try to fetch balance with multiple endpoints and methods
 */
async function fetchSolBalanceWithFallbacks(
  publicKey: string,
  primaryEndpoint: string,
): Promise<{ balance: number; endpoint: string } | null> {
  // Try primary with both methods
  let balance = await fetchBalanceWithGetBalance(primaryEndpoint, publicKey);
  if (balance !== null) {
    return { balance, endpoint: primaryEndpoint };
  }

  balance = await fetchBalanceWithGetAccountInfo(primaryEndpoint, publicKey);
  if (balance !== null) {
    return { balance, endpoint: primaryEndpoint };
  }

  // Try fallback endpoints
  console.log("[AllBalances] Trying fallback RPC endpoints...");

  for (const endpoint of RPC_ENDPOINTS) {
    balance = await fetchBalanceWithGetBalance(endpoint, publicKey);
    if (balance !== null) {
      return { balance, endpoint };
    }

    balance = await fetchBalanceWithGetAccountInfo(endpoint, publicKey);
    if (balance !== null) {
      return { balance, endpoint };
    }
  }

  // Try Alchemy
  balance = await fetchBalanceWithGetBalance(ALCHEMY_RPC, publicKey);
  if (balance !== null) {
    return { balance, endpoint: ALCHEMY_RPC };
  }

  console.error("[AllBalances] All balance fetch attempts failed");
  return null;
}

async function handler(request: Request, env?: Env): Promise<Response> {
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
            expected: "?publicKey=<address>",
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
      `[AllBalances] Fetching all balances for ${publicKey.slice(0, 8)}...`,
    );

    let solBalance = 0;
    let tokens: TokenBalance[] = [];

    try {
      // Fetch in parallel with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const [tokenResponse, solResult] = await Promise.allSettled([
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
        fetchSolBalanceWithFallbacks(publicKey, endpoint),
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
                return null;
              }
            })
            .filter(Boolean);
        } catch (err) {
          console.warn("[AllBalances] Error parsing token response:", err);
        }
      }

      // Process SOL balance
      if (solResult.status === "fulfilled" && solResult.value) {
        solBalance = solResult.value.balance;
        console.log(`[AllBalances] ✅ Fetched SOL balance: ${solBalance} SOL`);
      } else {
        console.warn("[AllBalances] Failed to fetch SOL balance");
        solBalance = 0;
      }

      // Insert or update SOL in token list
      const solIndex = tokens.findIndex((t) => t.mint === SOL_MINT);

      if (solIndex >= 0) {
        tokens[solIndex] = {
          ...tokens[solIndex],
          balance: solBalance,
          uiAmount: solBalance,
        };
      } else {
        tokens.unshift({
          ...KNOWN_TOKENS[SOL_MINT],
          balance: solBalance,
          uiAmount: solBalance,
        });
      }

      // Add known special tokens
      const specialTokens = [
        "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump",
        "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
        "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
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

      console.log(
        `[AllBalances] ✅ Found ${tokens.length} tokens (SOL: ${solBalance})`,
      );

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
          error: "Failed to fetch balances",
          details: {
            message:
              fetchError instanceof Error
                ? fetchError.message
                : "Unknown error",
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

export const onRequest: PagesFunction<Env> = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  return handler(request, env);
};
