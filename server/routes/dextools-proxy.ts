import { RequestHandler } from "express";

const DEXTOOLS_API_BASE = "https://api.dextools.io/v1";

interface DexToolsTokenResponse {
  data?: {
    address: string;
    name: string;
    symbol: string;
    priceUsd?: number;
    priceUsdChange24h?: number;
    marketCap?: number;
    liquidity?: number;
    volume24h?: number;
  };
  errorCode?: string;
  errorMsg?: string;
}

export const handleDexToolsPrice: RequestHandler = async (req, res) => {
  try {
    const { tokenAddress, chainId } = req.query;

    if (!tokenAddress || typeof tokenAddress !== "string") {
      return res.status(400).json({
        error: "Missing or invalid 'tokenAddress' parameter",
      });
    }

    const chain = chainId || "solana";

    console.log(
      `[DexTools Proxy] Fetching price for ${tokenAddress} on chain ${chain}`,
    );

    const url = `${DEXTOOLS_API_BASE}/token/${chain}/${tokenAddress}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(
        `[DexTools Proxy] API returned ${response.status} for ${tokenAddress}`,
      );
      return res.status(response.status).json({
        error: `DexTools API error: ${response.status}`,
      });
    }

    const data: DexToolsTokenResponse = await response.json();

    if (data.data?.priceUsd) {
      console.log(
        `[DexTools Proxy] Price retrieved: ${tokenAddress} = $${data.data.priceUsd}`,
      );
      return res.json({
        tokenAddress,
        priceUsd: data.data.priceUsd,
        priceUsdChange24h: data.data.priceUsdChange24h,
        marketCap: data.data.marketCap,
        liquidity: data.data.liquidity,
        volume24h: data.data.volume24h,
      });
    }

    console.warn(`[DexTools Proxy] No price data for ${tokenAddress}`);
    return res.status(404).json({
      error: "Token not found in DexTools",
      tokenAddress,
    });
  } catch (error) {
    console.error("[DexTools Proxy] Error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
};
