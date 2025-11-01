import { RequestHandler } from "express";

const RPC_ENDPOINTS = [
  process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : "",
  process.env.HELIUS_RPC_URL || "",
  process.env.MORALIS_RPC_URL || "",
  process.env.ALCHEMY_RPC_URL || "",
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana.publicnode.com",
].filter(Boolean);

export const handleWalletBalance: RequestHandler = async (req, res) => {
  try {
    const { publicKey } = req.query;

    if (!publicKey || typeof publicKey !== "string") {
      return res.status(400).json({
        error: "Missing or invalid 'publicKey' parameter",
      });
    }

    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [publicKey],
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
          console.warn(`RPC ${endpoint} returned error:`, data.error);
          lastError = new Error(data.error.message || "RPC error");
          continue;
        }

        const balanceLamports = data.result;
        const balanceSOL = balanceLamports / 1_000_000_000;

        return res.json({
          publicKey,
          balance: balanceSOL,
          balanceLamports,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`RPC endpoint ${endpoint} failed:`, lastError.message);
        continue;
      }
    }

    console.error("All RPC endpoints failed for wallet balance");
    return res.status(500).json({
      error:
        lastError?.message ||
        "Failed to fetch balance - all RPC endpoints failed",
    });
  } catch (error) {
    console.error("Wallet balance error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
};
