import { RequestHandler } from "express";
import { PublicKey, Connection } from "@solana/web3.js";

// Using multiple RPC providers to handle rate limiting
const RPC_ENDPOINTS = [
  // Prefer environment-configured RPC first
  process.env.SOLANA_RPC_URL || "",
  // Provider-specific overrides
  process.env.ALCHEMY_RPC_URL || "",
  process.env.HELIUS_RPC_URL || "",
  process.env.MORALIS_RPC_URL || "",
  process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : "",
  // Reliable backup endpoints
  "https://api.mainnet-beta.solana.com",
  "https://solana-mainnet.g.alchemy.com/v2/demo",
  // Additional fallbacks
  "https://rpc.helius.xyz",
  "https://solana.publicnode.com",
].filter(Boolean);

const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

// Known token metadata
const KNOWN_TOKENS: Record<
  string,
  { mint: string; symbol: string; name: string; decimals: number }
> = {
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

export const handleGetTokenAccounts: RequestHandler = async (req, res) => {
  try {
    const publicKey =
      (req.query.publicKey as string) ||
      (req.query.wallet as string) ||
      (req.query.address as string);

    if (!publicKey || typeof publicKey !== "string") {
      return res.status(400).json({
        error: "Missing or invalid wallet address",
      });
    }

    // Validate it's a valid Solana address
    try {
      new PublicKey(publicKey);
    } catch {
      return res.status(400).json({
        error: "Invalid Solana address",
      });
    }

    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [
        publicKey,
        { programId: TOKEN_PROGRAM_ID },
        { encoding: "jsonParsed", commitment: "confirmed" },
      ],
    };

    let lastError: Error | null = null;

    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            console.warn(
              `[TokenAccounts] RPC ${endpoint.slice(0, 40)} returned status ${response.status}`,
            );
            lastError = new Error(`HTTP ${response.status}`);
            continue;
          }

          const data = await response.json();

          if (data.error) {
            console.warn(
              `[TokenAccounts] RPC ${endpoint.slice(0, 40)} returned error:`,
              data.error,
            );
            lastError = new Error(data.error.message || "RPC error");
            continue;
          }

          const accounts = data.result?.value || [];
          const tokens = accounts.map((account: any) => {
            const parsedInfo = account.account.data.parsed.info;
            const mint = parsedInfo.mint;
            const decimals = parsedInfo.tokenAmount.decimals;

            // Extract balance
            let balance = 0;
            if (typeof parsedInfo.tokenAmount.uiAmount === "number") {
              balance = parsedInfo.tokenAmount.uiAmount;
            } else if (parsedInfo.tokenAmount.amount) {
              const rawAmount = BigInt(parsedInfo.tokenAmount.amount);
              balance = Number(rawAmount) / Math.pow(10, decimals || 0);
            }

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
          });

          console.log(
            `[TokenAccounts] ✅ Found ${tokens.length} token accounts for ${publicKey.slice(0, 8)} via ${endpoint.slice(0, 40)}`,
          );
          return res.json({
            publicKey,
            tokens,
            count: tokens.length,
          });
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMsg = lastError.message || "Unknown error";
        console.warn(
          `[TokenAccounts] RPC endpoint ${endpoint.slice(0, 40)} failed: ${errorMsg}`,
        );
        continue;
      }
    }

    console.error(
      "[TokenAccounts] All RPC endpoints failed",
      lastError?.message,
    );
    return res.status(500).json({
      error:
        lastError?.message ||
        "Failed to fetch token accounts - all RPC endpoints failed",
      publicKey,
      tokens: [],
    });
  } catch (error) {
    console.error("[TokenAccounts] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
      tokens: [],
    });
  }
};
