import { RequestHandler } from "express";

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

  console.log("[TokenBalance] Using free Solana RPC endpoints with Alchemy fallback");
  return freeEndpoints[Math.floor(Math.random() * freeEndpoints.length)];
}

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

    try {
      console.log(`[TokenBalance] Fetching balance for ${mint} from Helius`);

      // Get RPC endpoint on-demand instead of at module load time
      const RPC_ENDPOINT = getRpcEndpoint();
      const response = await fetch(RPC_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || "Helius RPC error");
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
        `[TokenBalance] ✅ Found balance for ${mint.slice(0, 8)}: ${balance}`,
      );
      return res.json({
        wallet,
        mint,
        balance,
        accounts: accounts.length,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[TokenBalance] Helius RPC error:", errorMsg);

      return res.status(502).json({
        error: errorMsg || "Failed to fetch token balance from Helius RPC",
        wallet,
        mint,
        balance: 0,
      });
    }
  } catch (error) {
    console.error("[TokenBalance] Handler error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
      details: "Check that HELIUS_API_KEY or HELIUS_RPC_URL is configured",
      balance: 0,
    });
  }
};
