import { RequestHandler } from "express";
import { PublicKey } from "@solana/web3.js";

const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SOL_MINT = "So11111111111111111111111111111111111111112";

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

// Known token metadata for tokens that may not be in RPC response
const KNOWN_TOKEN_METADATA: Record<string, any> = {
  So11111111111111111111111111111111111111112: {
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns: {
    symbol: "USDT",
    name: "USDT TETHER",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns/logo.png",
  },
  H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: {
    symbol: "FIXERCOIN",
    name: "FIXERCOIN",
    decimals: 6,
    logoURI: "https://i.postimg.cc/htfMF9dD/6x2D7UQ.png",
  },
  "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump": {
    symbol: "FXM",
    name: "Fixorium",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/fixorium/assets/main/fxm-logo.png",
  },
  EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: {
    symbol: "LOCKER",
    name: "LOCKER",
    decimals: 6,
    logoURI:
      "https://i.postimg.cc/J7p1FPbm/IMG-20250425-004450-removebg-preview-modified-2-6.png",
  },
};

// Get RPC endpoint with free endpoints and Alchemy fallback
function getRpcEndpoint(): string {
  const solanaRpcUrl = process.env.SOLANA_RPC_URL?.trim();

  if (solanaRpcUrl) {
    return solanaRpcUrl;
  }

  const freeEndpoints = [
    "https://api.mainnet-beta.solflare.network",
    "https://solana-api.projectserum.com",
    "https://api.mainnet.solflare.com",
  ];

  const alchemyEndpoint =
    "https://solana-mainnet.g.alchemy.com/v2/T79j33bZKpxgKTLx-KDW5";

  return freeEndpoints[Math.floor(Math.random() * freeEndpoints.length)];
}

/**
 * Fetch token balances using RPC-based token account enumeration
 * This replaces the Moralis API with a free RPC-based approach
 */
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
        error: "Missing wallet address",
        tokens: [],
      });
    }

    // Validate Solana address format
    try {
      new PublicKey(walletAddress);
    } catch {
      return res.status(400).json({
        error: "Invalid Solana address format",
        tokens: [],
      });
    }

    const endpoint = getRpcEndpoint();
    console.log(
      `[TokenBalances] Fetching tokens for ${walletAddress.slice(0, 8)}... using RPC`,
    );

    // Fetch SPL token accounts
    const tokenResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { programId: TOKEN_PROGRAM_ID },
          { encoding: "jsonParsed", commitment: "confirmed" },
        ],
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("[TokenBalances] RPC error:", tokenData.error);
      return res.status(502).json({
        error: "Failed to fetch token balances",
        tokens: [],
      });
    }

    const tokenAccounts = tokenData.result?.value || [];

    // Fetch SOL balance
    const solResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [walletAddress],
      }),
    });

    const solData = await solResponse.json();
    const solBalance = (solData.result?.value || 0) / 1e9;

    // Build token list
    const tokens: TokenBalance[] = [];

    // Add SOL first
    const solMetadata = KNOWN_TOKEN_METADATA[SOL_MINT];
    tokens.push({
      mint: SOL_MINT,
      symbol: solMetadata.symbol,
      name: solMetadata.name,
      decimals: solMetadata.decimals,
      balance: solBalance.toString(),
      uiAmount: solBalance,
      logoURI: solMetadata.logoURI,
      isSpam: false,
    });

    // Process SPL tokens
    tokenAccounts.forEach((account: any) => {
      try {
        const parsedData = account.account.data;
        if (
          typeof parsedData === "object" &&
          "parsed" in parsedData &&
          "info" in parsedData.parsed
        ) {
          const info = (parsedData.parsed as any).info;
          const mint = info.mint;
          const decimals = info.tokenAmount?.decimals || 6;
          const rawAmount = info.tokenAmount?.amount || "0";
          const uiAmount =
            typeof info.tokenAmount?.uiAmount === "number"
              ? info.tokenAmount.uiAmount
              : Number(rawAmount) / Math.pow(10, decimals);

          // Skip zero-balance tokens
          if (uiAmount === 0) {
            return;
          }

          const metadata = KNOWN_TOKEN_METADATA[mint] || {
            symbol: "UNKNOWN",
            name: "Unknown Token",
            decimals,
            logoURI: "",
          };

          tokens.push({
            mint,
            symbol: metadata.symbol,
            name: metadata.name,
            decimals: decimals || metadata.decimals,
            balance: uiAmount.toString(),
            uiAmount,
            logoURI: metadata.logoURI || "",
            isSpam: false,
          });
        }
      } catch (err) {
        console.warn("[TokenBalances] Error parsing token account:", err);
      }
    });

    console.log(
      `[TokenBalances] ✅ Found ${tokens.length} tokens for ${walletAddress.slice(0, 8)}...`,
    );

    return res.json({
      tokens,
      total: tokens.length,
      source: "rpc",
    });
  } catch (error) {
    console.error("[TokenBalances] Handler error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
      tokens: [],
    });
  }
};
