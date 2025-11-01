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

export const handleSolanaRpc: RequestHandler = async (req, res) => {
  try {
    const body = req.body;

    if (!body) {
      return res.status(400).json({
        error: "Missing request body",
      });
    }

    let lastError: Error | null = null;

    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await response.text();
        res.set("Content-Type", "application/json");
        return res.status(response.status).send(data);
      } catch (e: any) {
        lastError = e instanceof Error ? e : new Error(String(e));
        console.warn(`RPC endpoint ${endpoint} failed:`, lastError.message);
        // Try next endpoint
        continue;
      }
    }

    console.error("All RPC endpoints failed");
    return res.status(500).json({
      error:
        lastError?.message ||
        "All RPC endpoints failed - no Solana RPC available",
    });
  } catch (error) {
    console.error("Solana RPC handler error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
};
