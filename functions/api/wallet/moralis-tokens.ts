/**
 * Moralis REST API endpoint for token balances
 * Much faster than RPC-based token fetching
 * Uses Moralis API key from Cloudflare Pages environment
 */

interface Env {
  MORALIS_API_KEY?: string;
}

interface MoralisToken {
  token_address: string;
  name: string;
  symbol: string;
  decimals: number;
  logo: string;
  balance: string;
  possible_spam: boolean;
  verified_collection: boolean;
  percentage_relative_to_total_supply: number;
}

interface MoralisResponse {
  result?: MoralisToken[];
  message?: string;
}

interface TokenBalance {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  uiAmount: number;
  logoURI: string;
  isSpam: boolean;
}

// Known token metadata for tokens that may not be in Moralis response
const KNOWN_TOKEN_METADATA: Record<string, any> = {
  // SOL
  So11111111111111111111111111111111111111112: {
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  // USDC
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  // USDT
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns: {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns/logo.png",
  },
  // FIXERCOIN
  H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: {
    symbol: "FIXERCOIN",
    name: "FIXERCOIN",
    decimals: 6,
    logoURI: "https://i.postimg.cc/htfMF9dD/6x2D7UQ.png",
  },
  // FXM (FIXORIUM)
  "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump": {
    symbol: "FXM",
    name: "Fixorium",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/fixorium/assets/main/fxm-logo.png",
  },
  // LOCKER
  EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: {
    symbol: "LOCKER",
    name: "LOCKER",
    decimals: 6,
    logoURI:
      "https://i.postimg.cc/J7p1FPbm/IMG-20250425-004450-removebg-preview-modified-2-6.png",
  },
};

export const onRequest: PagesFunction<Env> = async ({
  request,
  env,
}): Promise<Response> => {
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
    // Extract wallet address from query or body
    const url = new URL(request.url);
    let walletAddress =
      url.searchParams.get("address") ||
      url.searchParams.get("wallet") ||
      url.searchParams.get("publicKey");

    if (!walletAddress && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as any;
      walletAddress = body.address || body.wallet || body.publicKey;
    }

    if (!walletAddress) {
      return new Response(
        JSON.stringify({ error: "Missing wallet address parameter" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    const apiKey = env.MORALIS_API_KEY;
    if (!apiKey) {
      console.warn(
        "[moralis-tokens] MORALIS_API_KEY not set in Cloudflare Pages environment",
      );
      return new Response(
        JSON.stringify({ error: "Moralis API key not configured" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Call Moralis REST API for token balances
    const moralisUrl = `https://deep-index.moralis.io/api/v2.2/wallets/${walletAddress}/tokens?chain=solana`;

    const response = await fetch(moralisUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        "X-API-Key": apiKey,
      },
    });

    if (!response.ok) {
      console.error(
        `[moralis-tokens] Moralis API error: ${response.status} ${response.statusText}`,
      );
      return new Response(
        JSON.stringify({
          error: `Moralis API error: ${response.statusText}`,
          status: response.status,
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    const moralisData = (await response.json()) as MoralisResponse;

    if (!moralisData.result || !Array.isArray(moralisData.result)) {
      return new Response(JSON.stringify({ tokens: [] }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
        },
      });
    }

    // Transform Moralis response to our token format
    const tokens: TokenBalance[] = moralisData.result
      .filter((t) => !t.possible_spam) // Filter out spam tokens
      .map((token) => ({
        mint: token.token_address,
        symbol: token.symbol || "UNKNOWN",
        name: token.name || "Unknown Token",
        decimals: token.decimals || 0,
        balance: token.balance || "0",
        uiAmount: token.balance
          ? Number(token.balance) / Math.pow(10, token.decimals || 0)
          : 0,
        logoURI: token.logo || "",
        isSpam: token.possible_spam,
      }));

    return new Response(JSON.stringify({ tokens, count: tokens.length }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("[moralis-tokens] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
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
};
