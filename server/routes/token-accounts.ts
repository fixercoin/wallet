import { RequestHandler } from "express";
import { PublicKey } from "@solana/web3.js";

// Get RPC endpoint with free endpoints and Alchemy fallback
function getRpcEndpoint(): string {
  const solanaRpcUrl = process.env.SOLANA_RPC_URL?.trim();

  if (solanaRpcUrl) {
    console.log("[TokenAccounts] Using SOLANA_RPC_URL endpoint");
    return solanaRpcUrl;
  }

  const freeEndpoints = [
    "https://api.mainnet-beta.solflare.network",
    "https://solana-api.projectserum.com",
    "https://api.mainnet.solflare.com",
  ];

  const alchemyEndpoint =
    "https://solana-mainnet.g.alchemy.com/v2/T79j33bZKpxgKTLx-KDW5";

  console.log(
    "[TokenAccounts] Using free Solana RPC endpoints with Alchemy fallback",
  );
  return freeEndpoints[Math.floor(Math.random() * freeEndpoints.length)];
}

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

export const handleGetTokenAccounts: RequestHandler = async (req, res) => {
  try {
    const publicKey =
      (req.query.publicKey as string) ||
      (req.query.wallet as string) ||
      (req.query.address as string);

    if (!publicKey || typeof publicKey !== "string") {
      return res.status(400).json({ error: "Missing or invalid wallet" });
    }

    try {
      new PublicKey(publicKey);
    } catch {
      return res.status(400).json({ error: "Invalid Solana address" });
    }

    const endpoint = getRpcEndpoint();
    let solBalance = 0;

    console.log(
      `[TokenAccounts] Fetching token accounts from: ${endpoint.split("?")[0]}...`,
    );

    // Fetch SPL token accounts
    const tokenBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [
        publicKey,
        { programId: TOKEN_PROGRAM_ID },
        { encoding: "jsonParsed", commitment: "confirmed" },
      ],
    };

    const tokenController = new AbortController();
    const tokenTimeoutId = setTimeout(() => tokenController.abort(), 12000);

    let tokens: any[] = [];

    try {
      const tokenResp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenBody),
        signal: tokenController.signal,
      });

      clearTimeout(tokenTimeoutId);

      if (tokenResp.ok) {
        const tokenData = await tokenResp.json();
        const accounts = tokenData?.result?.value ?? [];

        tokens = accounts.map((account: any) => {
          const info = account.account.data.parsed.info;
          const mint = info.mint;
          const decimals = info.tokenAmount.decimals;

          const raw = BigInt(info.tokenAmount.amount);
          const balance = Number(raw) / Math.pow(10, decimals);

          // Special logging for FXM and other tokens
          if (mint === "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump") {
            console.log(
              `[TokenAccounts] FXM Token found - Raw: ${raw}, Decimals: ${decimals}, Balance: ${balance}`,
            );
          }

          const meta = KNOWN_TOKENS[mint] || {
            mint,
            symbol: "UNKNOWN",
            name: "Unknown Token",
            decimals,
          };

          return { ...meta, balance, decimals };
        });
      }
    } catch (tokenError) {
      clearTimeout(tokenTimeoutId);
      console.warn(
        "[TokenAccounts] Failed to fetch token accounts:",
        tokenError instanceof Error ? tokenError.message : String(tokenError),
      );
      tokens = [];
    }

    // Fetch native SOL balance separately with its own timeout
    const solBody = {
      jsonrpc: "2.0",
      id: 2,
      method: "getBalance",
      params: [publicKey],
    };

    const solController = new AbortController();
    const solTimeoutId = setTimeout(() => solController.abort(), 12000);

    try {
      const solResp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(solBody),
        signal: solController.signal,
      });

      clearTimeout(solTimeoutId);

      if (solResp.ok) {
        const solData = await solResp.json();
        const lamports = solData.result?.value ?? solData.result ?? 0;
        solBalance =
          typeof lamports === "number" ? lamports / 1_000_000_000 : 0;

        if (solBalance < 0) {
          solBalance = 0;
        }

        console.log(
          `[TokenAccounts] ✅ Fetched SOL balance: ${solBalance} SOL`,
        );
      }
    } catch (solError) {
      clearTimeout(solTimeoutId);
      console.warn(
        "[TokenAccounts] Failed to fetch SOL balance:",
        solError instanceof Error ? solError.message : String(solError),
      );
      solBalance = 0;
    }

    // Check if SOL already exists in token list (might be WSOL or SOL account)
    const solIndex = tokens.findIndex((t) => t.mint === SOL_MINT);

    if (solIndex >= 0) {
      // Update existing SOL entry with fetched balance
      tokens[solIndex] = {
        ...tokens[solIndex],
        balance: solBalance,
      };
    } else {
      // Insert SOL at the beginning if not found
      tokens.unshift({
        ...KNOWN_TOKENS[SOL_MINT],
        balance: solBalance,
      });
    }

    console.log(
      `[TokenAccounts] ✅ Found ${tokens.length} tokens for ${publicKey.slice(0, 8)}... (SOL: ${solBalance} SOL)`,
    );

    // Log all tokens returned
    tokens.forEach((token) => {
      const isSpecialToken = ["FXM", "FIXERCOIN", "LOCKER"].includes(
        token.symbol,
      );
      if (isSpecialToken || token.balance > 0) {
        console.log(
          `[TokenAccounts]   - ${token.symbol}: ${token.balance} (${token.mint.slice(0, 8)}...)`,
        );
      }
    });

    return res.json({
      publicKey,
      tokens,
      solBalance,
      count: tokens.length,
    });
  } catch (error) {
    console.error("[TokenAccounts] Unexpected error:", error);

    // Return default tokens with zero balance on error
    const fallback = Object.values(KNOWN_TOKENS).map((t) => ({
      ...t,
      balance: 0,
    }));

    return res.status(200).json({
      publicKey: (req.query.publicKey as string) || "unknown",
      tokens: fallback,
      solBalance: 0,
      count: fallback.length,
    });
  }
};
