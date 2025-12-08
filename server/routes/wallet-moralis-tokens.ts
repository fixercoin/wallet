import { RequestHandler } from "express";

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

const resolveMoralisConfig = () => {
  const apiKey = String(process?.env?.MORALIS_API_KEY ?? "").trim();
  return {
    apiKey,
  };
};

export const handleWalletMoralisTokens: RequestHandler = async (req, res) => {
  try {
    // Extract wallet address from query or body
    const walletAddress =
      (req.query.address as string) ||
      (req.query.wallet as string) ||
      (req.query.publicKey as string) ||
      req.body?.address ||
      req.body?.wallet ||
      req.body?.publicKey;

    if (!walletAddress) {
      return res.status(400).json({
        error: "Missing wallet address parameter",
      });
    }

    const { apiKey } = resolveMoralisConfig();

    if (!apiKey) {
      console.warn(
        "[wallet-moralis-tokens] MORALIS_API_KEY not set in environment",
      );
      return res.status(500).json({
        error: "Moralis API key not configured in server environment",
      });
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
        `[wallet-moralis-tokens] Moralis API error: ${response.status} ${response.statusText}`,
      );
      return res.status(response.status).json({
        error: `Moralis API error: ${response.statusText}`,
        status: response.status,
      });
    }

    const moralisData = (await response.json()) as MoralisResponse;

    if (!moralisData.result || !Array.isArray(moralisData.result)) {
      return res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120").json({
        tokens: [],
        count: 0,
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

    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    return res.json({
      tokens,
      count: tokens.length,
    });
  } catch (error) {
    console.error("[wallet-moralis-tokens] Error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
