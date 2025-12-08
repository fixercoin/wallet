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
