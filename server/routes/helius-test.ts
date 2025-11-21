import { RequestHandler } from "express";

export const handleHeliusTest: RequestHandler = async (req, res) => {
  try {
    const { publicKey } = req.query;

    if (!publicKey || typeof publicKey !== "string") {
      return res.status(400).json({
        error: "Missing or invalid publicKey parameter",
      });
    }

    console.log(`Testing Helius API with wallet: ${publicKey}`);

    const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "";
    const heliusUrl = HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
      : "";

    if (!HELIUS_API_KEY) {
      return res.status(400).json({
        error:
          "HELIUS_API_KEY is not configured. Please set it in environment variables.",
        tested: false,
      });
    }

    // Test balance fetch
    const balanceResponse = await fetch(heliusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [publicKey],
      }),
    });

    const balanceData = await balanceResponse.json();

    // Test token accounts fetch
    const tokenAccountsResponse = await fetch(heliusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "getTokenAccountsByOwner",
        params: [
          publicKey,
          { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
          { encoding: "jsonParsed", commitment: "confirmed" },
        ],
      }),
    });

    const tokenAccountsData = await tokenAccountsResponse.json();

    res.json({
      status: "success",
      heliusApiKey: HELIUS_API_KEY ? "configured" : "missing",
      balance: {
        success: !balanceData.error,
        lamports: balanceData.result,
        sol: balanceData.result ? balanceData.result / 1000000000 : 0,
        error: balanceData.error,
      },
      tokenAccounts: {
        success: !tokenAccountsData.error,
        count: tokenAccountsData.result?.value?.length || 0,
        accounts: tokenAccountsData.result?.value || [],
        error: tokenAccountsData.error,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Helius test error:", error);
    res.status(500).json({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
};
