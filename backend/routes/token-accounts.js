const RPC_ENDPOINTS = [
  process.env.SOLANA_RPC_URL || "",
  process.env.ALCHEMY_RPC_URL || "",
  process.env.HELIUS_RPC_URL || "",
  process.env.MORALIS_RPC_URL || "",
  process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : "",
  "https://solana.publicnode.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
].filter(Boolean);

const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

const KNOWN_TOKENS = {
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

export async function handleGetTokenAccounts(req, res) {
  try {
    const publicKey =
      req.query.publicKey || req.query.wallet || req.query.address;

    if (!publicKey || typeof publicKey !== "string") {
      return res.status(400).json({
        error: "Missing or invalid wallet address parameter",
      });
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

    let lastError = null;

    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rpcBody),
        });

        const data = await response.json();

        if (data.error) {
          console.warn(`RPC ${endpoint} returned error:`, data.error);
          lastError = new Error(data.error.message || "RPC error");
          continue;
        }

        const tokenAccounts = [];
        const results = data.result || { value: [] };
        const accounts = results.value || [];

        for (const account of accounts) {
          const parsedData = account.account?.data?.parsed?.info;
          if (!parsedData) continue;

          const mint = parsedData.mint;
          const balance = parsedData.tokenAmount?.amount || "0";
          const decimals = parsedData.tokenAmount?.decimals || 0;

          const tokenInfo = KNOWN_TOKENS[mint] || {
            mint,
            symbol: `TOKEN_${mint.slice(0, 4)}`,
            name: `Token ${mint.slice(0, 8)}`,
            decimals,
          };

          tokenAccounts.push({
            mint,
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            balance: parseInt(balance) / Math.pow(10, decimals),
            decimals: tokenInfo.decimals,
            rawBalance: balance,
            address: account.pubkey,
          });
        }

        return res.json({
          publicKey,
          tokens: tokenAccounts,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`RPC endpoint ${endpoint} failed:`, lastError.message);
        continue;
      }
    }

    console.error("All RPC endpoints failed for token accounts");
    return res.status(500).json({
      error:
        lastError?.message ||
        "Failed to fetch token accounts - all RPC endpoints failed",
    });
  } catch (error) {
    console.error("Token accounts error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
