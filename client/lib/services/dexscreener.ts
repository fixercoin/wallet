import { TokenInfo } from "../wallet";

export interface DexscreenerToken {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd?: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  marketCap?: number;
  info?: {
    imageUrl?: string;
    websites?: Array<{ label: string; url: string }>;
    socials?: Array<{ type: string; url: string }>;
  };
}

export interface DexscreenerResponse {
  schemaVersion: string;
  pairs: DexscreenerToken[];
}

class DexscreenerAPI {
  // Using server proxy routes to avoid CORS issues
  private readonly baseUrl = "/api/dexscreener";

  // Helper method to extract prices from DexScreener data
  getTokenPrices(tokens: DexscreenerToken[]): Record<string, number> {
    const prices: Record<string, number> = {};

    tokens.forEach((token) => {
      const mint = token.baseToken.address;
      const price = token.priceUsd ? parseFloat(token.priceUsd) : null;

      if (mint && price && price > 0) {
        prices[mint] = price;
      }
    });

    console.log(`DexScreener: Extracted ${Object.keys(prices).length} prices`);
    return prices;
  }

  async getTokensByMints(mints: string[]): Promise<DexscreenerToken[]> {
    const mintString = mints.join(",");
    console.log(
      `DexScreener: Fetching tokens via proxy for ${mints.length} mints`,
    );

    const fetchWithTimeout = async (url: string, ms = 10000) => {
      const timeout = new Promise<Response>((resolve) =>
        setTimeout(() => resolve(new Response("", { status: 504 })), ms),
      );
      return (await Promise.race([fetch(url), timeout])) as Response;
    };

    // Try up to 3 attempts, short backoff
    let response: Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await fetchWithTimeout(
          `/api/dexscreener/tokens?mints=${mintString}`,
          10000,
        );
        if (response.ok) break;
      } catch (err) {
        // ignore
      }
      await new Promise((r) => setTimeout(r, attempt * 300));
    }

    if (!response || !response.ok) {
      console.debug(
        `DexScreener proxy unavailable or non-OK (status=${response?.status || 0}), continuing without price data`,
      );
      return [];
    }

    try {
      const data: DexscreenerResponse = await response.json();
      console.log(
        `DexScreener: Retrieved ${data.pairs?.length || 0} pairs via proxy`,
      );
      return data.pairs || [];
    } catch {
      return [];
    }
  }

  async getTokenByMint(mint: string): Promise<DexscreenerToken | null> {
    const tokens = await this.getTokensByMints([mint]);
    return tokens.length > 0 ? tokens[0] : null;
  }

  async searchTokens(query: string): Promise<DexscreenerToken[]> {
    try {
      const response = await fetch(
        `/api/dexscreener/search?q=${encodeURIComponent(query)}`,
      ).catch(() => new Response("", { status: 0 } as any));

      if (!response.ok) {
        return [];
      }

      const data: DexscreenerResponse = await response.json();
      return data.pairs || [];
    } catch (error) {
      console.debug("Error searching tokens via DexScreener proxy:", error);
      return [];
    }
  }

  enhanceTokenWithDexscreenerData(
    token: TokenInfo,
    dexData: DexscreenerToken,
  ): TokenInfo {
    return {
      ...token,
      logoURI: dexData.info?.imageUrl || token.logoURI,
      price: dexData.priceUsd ? parseFloat(dexData.priceUsd) : undefined,
      priceChange24h: dexData.priceChange?.h24,
      volume24h: dexData.volume?.h24,
      marketCap: dexData.marketCap,
      liquidity: dexData.liquidity?.usd,
    };
  }

  async getPopularTokens(): Promise<DexscreenerToken[]> {
    try {
      // Get trending tokens on Solana via proxy
      const response = await fetch("/api/dexscreener/trending").catch(
        () => new Response("", { status: 0 } as any),
      );

      if (!response.ok) {
        return [];
      }

      const data: DexscreenerResponse = await response.json();
      return data.pairs?.slice(0, 20) || []; // Get top 20 trending tokens
    } catch (error) {
      console.debug(
        "Error fetching popular tokens via DexScreener proxy:",
        error,
      );
      return [];
    }
  }
}

export const dexscreenerAPI = new DexscreenerAPI();
