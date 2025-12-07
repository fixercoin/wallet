// Cloudflare Pages Functions handler for fetching token accounts
// Supports GET requests with query params: ?publicKey=<address>
// Also supports POST with JSON body: { walletAddress: <address> }

// Helius-only RPC configuration
function getHeliusRpcEndpoint(env: any): string {
  if (env?.HELIUS_API_KEY) {
    return `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`;
  }
  if (env?.HELIUS_RPC_URL) {
    return env.HELIUS_RPC_URL;
  }
  throw new Error(
    "Helius RPC endpoint required. Set HELIUS_API_KEY or HELIUS_RPC_URL.",
  );
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

    // Get Helius RPC endpoint only
    let rpcEndpoint: string;
    try {
      rpcEndpoint = getHeliusRpcEndpoint(env);
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: (e as Error).message,
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

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const resp = await fetch(rpcEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rpcBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await resp.json();

      // Check if RPC returned an error
      if (data.error) {
        return new Response(
          JSON.stringify({
            error: data.error.message || "Helius RPC error",
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

      console.log(
        `[TokenAccounts] Found ${validTokens.length} token accounts for ${publicKey.slice(
          0,
          8,
        )} from Helius`,
      );

      return new Response(
        JSON.stringify({
          publicKey,
          tokens: validTokens,
          count: validTokens.length,
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
      const errorMsg =
        error?.name === "AbortError"
          ? "timeout"
          : error?.message || String(error);
      console.error(`[TokenAccounts] Helius RPC error: ${errorMsg}`);

      return new Response(
        JSON.stringify({
          error: "Failed to fetch token accounts from Helius RPC",
          details: errorMsg,
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
    }
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
