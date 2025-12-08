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
    name: "USDT TETHER",
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
      return res
        .set("Cache-Control", "public, max-age=30, stale-while-revalidate=120")
        .json({
          tokens: [],
          count: 0,
        });
    }

    // Transform Moralis response to our token format, merging with known metadata
    const tokens: TokenBalance[] = moralisData.result
      .filter((t) => !t.possible_spam) // Filter out spam tokens
      .map((token) => {
        const knownMetadata = KNOWN_TOKEN_METADATA[token.token_address];
        const decimals = token.decimals || knownMetadata?.decimals || 0;
        const balance = token.balance || "0";

        return {
          mint: token.token_address,
          symbol: token.symbol || knownMetadata?.symbol || "UNKNOWN",
          name: token.name || knownMetadata?.name || "Unknown Token",
          decimals,
          balance,
          uiAmount: balance ? Number(balance) / Math.pow(10, decimals) : 0,
          logoURI: token.logo || knownMetadata?.logoURI || "",
          isSpam: token.possible_spam,
        };
      });

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
