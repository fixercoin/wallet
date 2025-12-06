import { RequestHandler } from "express";

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
  // Shyft RPC with embedded API key (reliable fallback)
  "https://rpc.shyft.to?api_key=3hAwrhOAmJG82eC7",
  // Fallback public endpoints
  "https://solana.publicnode.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
].filter(Boolean);

export const handleGetTokenBalance: RequestHandler = async (req, res) => {
  try {
    const wallet =
      (req.query.wallet as string) ||
      (req.query.publicKey as string) ||
      (req.query.address as string);
    const mint = (req.query.mint as string) || (req.query.tokenMint as string);

    if (!wallet || !mint) {
      return res.status(400).json({
        error: "Missing wallet address or mint",
      });
    }

    const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [
        wallet,
        { mint },
        { encoding: "jsonParsed", commitment: "confirmed" },
      ],
    };

    let lastError: Error | null = null;

    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (data.error) {
          console.warn(
            `[TokenBalance] RPC ${endpoint} returned error:`,
            data.error,
          );
          lastError = new Error(data.error.message || "RPC error");
          continue;
        }

        const accounts = data.result?.value || [];
        let balance = 0;

        if (accounts.length > 0) {
          const account = accounts[0];
          const parsedInfo = account.account.data.parsed.info;
          const decimals = parsedInfo.tokenAmount.decimals;

          // Extract balance - prefer uiAmount, fall back to calculating from raw amount
          if (typeof parsedInfo.tokenAmount.uiAmount === "number") {
            balance = parsedInfo.tokenAmount.uiAmount;
          } else if (parsedInfo.tokenAmount.amount) {
            const rawAmount = BigInt(parsedInfo.tokenAmount.amount);
            balance = Number(rawAmount) / Math.pow(10, decimals || 0);
          }
        }

        console.log(
          `[TokenBalance] Found balance for ${mint.slice(0, 8)}: ${balance}`,
        );
        return res.json({
          wallet,
          mint,
          balance,
          accounts: accounts.length,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `[TokenBalance] RPC endpoint ${endpoint.slice(0, 40)} failed:`,
          lastError.message,
        );
        continue;
      }
    }

    console.error(
      "[TokenBalance] All RPC endpoints failed for token balance",
      lastError?.message,
    );
    return res.status(500).json({
      error:
        lastError?.message ||
        "Failed to fetch token balance - all RPC endpoints failed",
      wallet,
      mint,
      balance: 0,
    });
  } catch (error) {
    console.error("[TokenBalance] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
      balance: 0,
    });
  }
};
