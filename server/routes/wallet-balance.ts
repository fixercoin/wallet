import { RequestHandler } from "express";

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

    const response = await fetch(
      "https://solana-mainnet.g.alchemy.com/v2/3Z99FYWB1tFEBqYSyV60t-x7FsFCSEjX",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    const data = await response.json();

    if (data.error) {
      console.error("Solana RPC error:", data.error);
      return res.status(500).json({
        error: data.error.message || "Failed to fetch balance",
      });
    }

    const balanceLamports = data.result;
    const balanceSOL = balanceLamports / 1_000_000_000;

    res.json({
      publicKey,
      balance: balanceSOL,
      balanceLamports,
    });
  } catch (error) {
    console.error("Wallet balance error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
};
