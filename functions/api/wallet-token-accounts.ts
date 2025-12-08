// Cloudflare Pages Functions handler for fetching token accounts
// Supports GET requests with query params: ?publicKey=<address>
// Also supports POST with JSON body: { walletAddress: <address> }
// Uses free RPC providers with automatic fallback

// Build list of RPC endpoints from environment and free public providers
function buildRpcEndpoints(env: any): string[] {
  const endpoints: string[] = [];

  // Add environment-configured endpoints first (highest priority)
  if (env?.SOLANA_RPC_URL && typeof env.SOLANA_RPC_URL === "string") {
    const trimmed = env.SOLANA_RPC_URL.trim();
    if (trimmed.length > 0) {
      endpoints.push(trimmed);
    }
  }

  if (env?.ALCHEMY_RPC_URL && typeof env.ALCHEMY_RPC_URL === "string") {
    const trimmed = env.ALCHEMY_RPC_URL.trim();
    if (trimmed.length > 0) {
      endpoints.push(trimmed);
    }
  }

  if (env?.MORALIS_RPC_URL && typeof env.MORALIS_RPC_URL === "string") {
    const trimmed = env.MORALIS_RPC_URL.trim();
    if (trimmed.length > 0) {
      endpoints.push(trimmed);
    }
  }

  // Add free public RPC endpoints (tested, reliable)
  const publicEndpoints = [
    "https://solana.publicnode.com",
    "https://api.solflare.com",
    "https://rpc.ankr.com/solana",
    "https://api.mainnet-beta.solana.com",
    "https://api.marinade.finance/rpc",
  ];

  // Add public endpoints that aren't already in the list
  publicEndpoints.forEach((endpoint) => {
    if (!endpoints.includes(endpoint)) {
      endpoints.push(endpoint);
    }
  });

  return endpoints;
}

// Known token metadata for common tokens
const KNOWN_TOKENS: Record<string, any> = {
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
};

const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

async function handler(request: Request, context: any): Promise<Response> {
  const { env } = context;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    let publicKey: string | null = null;

    // Extract publicKey from either GET query params or POST body
    if (request.method === "GET") {
      const url = new URL(request.url);
      publicKey =
        url.searchParams.get("publicKey") ||
        url.searchParams.get("address") ||
        url.searchParams.get("wallet") ||
        url.searchParams.get("walletAddress");
    } else if (request.method === "POST") {
      try {
        const body = await request.json();
        publicKey =
          body?.publicKey ||
          body?.walletAddress ||
          body?.address ||
          body?.wallet;
      } catch (e) {
        // If JSON parsing fails, try query params as fallback
        const url = new URL(request.url);
        publicKey =
          url.searchParams.get("publicKey") ||
          url.searchParams.get("address") ||
          url.searchParams.get("wallet") ||
          url.searchParams.get("walletAddress");
      }
    }

    if (!publicKey || typeof publicKey !== "string") {
      return new Response(
        JSON.stringify({
          error: "Missing or invalid publicKey parameter",
          tokens: [],
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

    const rpcBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [
        publicKey,
        { programId: TOKEN_PROGRAM_ID },
        { encoding: "jsonParsed" },
      ],
    };

    let lastError: string | null = null;
    const rpcEndpoints = buildRpcEndpoints(env);

    console.log(
      `[TokenAccounts] Using ${rpcEndpoints.length} RPC endpoints. Primary: ${rpcEndpoints[0]?.substring(0, 50)}...`,
    );

    // Try each RPC endpoint
    for (let i = 0; i < rpcEndpoints.length; i++) {
      const endpoint = rpcEndpoints[i];
      if (!endpoint) continue;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        console.log(
          `[TokenAccounts] Attempt ${i + 1}/${rpcEndpoints.length}: ${endpoint.substring(0, 60)}...`,
        );

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rpcBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          const errorText = await resp.text();
          lastError = `HTTP ${resp.status}: ${errorText}`;
          console.warn(
            `[TokenAccounts] Endpoint ${i + 1} non-OK response: ${lastError}`,
          );
          continue;
        }

        const data = await resp.json();

        // Check if RPC returned an error
        if (data.error) {
          lastError = data.error.message || "RPC error";
          console.warn(
            `[TokenAccounts] Endpoint ${i + 1} RPC error: ${lastError}`,
          );
          continue;
        }

        // Parse token accounts from RPC response
        const accounts = data.result?.value || [];
        const tokens = accounts.map((account: any) => {
          try {
            const parsedInfo = account.account?.data?.parsed?.info;
            if (!parsedInfo) return null;

            const mint = parsedInfo.mint;
            const decimals = parsedInfo.tokenAmount?.decimals || 0;
            const tokenAmount = parsedInfo.tokenAmount;

            // Extract balance
            let balance = 0;
            if (typeof tokenAmount?.uiAmount === "number") {
              balance = tokenAmount.uiAmount;
            } else if (tokenAmount?.amount) {
              const rawAmount = BigInt(tokenAmount.amount);
              balance = Number(rawAmount) / Math.pow(10, decimals);
            }

            // Get metadata for this token
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
          } catch (e) {
            console.warn(`[TokenAccounts] Failed to parse account:`, e);
            return null;
          }
        });

        // Filter out null entries
        const validTokens = tokens.filter(Boolean);

        // Fetch and include native SOL balance
        let solBalance = 0;
        try {
          const solRpcBody = {
            jsonrpc: "2.0",
            id: 1,
            method: "getBalance",
            params: [publicKey],
          };

          const solController = new AbortController();
          const solTimeoutId = setTimeout(() => solController.abort(), 10000);

          const solResp = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(solRpcBody),
            signal: solController.signal,
          });

          clearTimeout(solTimeoutId);

          const solData = await solResp.json();
          const lamports = solData.result ?? solData.result?.value;
          if (
            !solData.error &&
            typeof lamports === "number" &&
            isFinite(lamports) &&
            lamports >= 0
          ) {
            solBalance = lamports / 1_000_000_000;
            console.log(
              `[TokenAccounts] ✅ Fetched SOL balance: ${solBalance} SOL`,
            );
          }
        } catch (err) {
          console.warn(`[TokenAccounts] Failed to fetch SOL balance:`, err);
        }

        // Add SOL to the beginning of tokens list
        const allTokens = [
          {
            mint: "So11111111111111111111111111111111111111112",
            symbol: "SOL",
            name: "Solana",
            decimals: 9,
            balance: solBalance,
          },
          ...validTokens,
        ];

        console.log(
          `[TokenAccounts] ✅ Found ${validTokens.length} token accounts (plus SOL) for ${publicKey.slice(
            0,
            8,
          )}`,
        );

        return new Response(
          JSON.stringify({
            publicKey,
            tokens: allTokens,
            count: allTokens.length,
            source: endpoint.substring(0, 50),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      } catch (error: any) {
        if (error?.name === "AbortError") {
          lastError = "Request timeout";
          console.warn(`[TokenAccounts] Endpoint ${i + 1} timeout`);
        } else {
          lastError = error?.message || String(error);
          console.warn(`[TokenAccounts] Endpoint ${i + 1} error: ${lastError}`);
        }
      }
    }

    // All endpoints failed
    console.error(
      `[TokenAccounts] All ${rpcEndpoints.length} RPC endpoints failed. Last error: ${lastError}`,
    );
    return new Response(
      JSON.stringify({
        error: "Failed to fetch token accounts - all RPC endpoints failed",
        details: lastError || "No available Solana RPC providers",
        endpointsAttempted: rpcEndpoints.length,
        primaryEndpoint: rpcEndpoints[0]?.substring(0, 60) || "none",
        tokens: [],
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (err: any) {
    console.error(`[TokenAccounts] Handler error:`, err);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch token accounts",
        details: err?.message || String(err),
        tokens: [],
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

export async function onRequest(context: any): Promise<Response> {
  return handler(context.request, context);
}

export async function onRequestGet(context: any): Promise<Response> {
  return handler(context.request, context);
}

export async function onRequestPost(context: any): Promise<Response> {
  return handler(context.request, context);
}
