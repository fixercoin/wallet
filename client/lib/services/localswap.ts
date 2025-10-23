import { resolveApiUrl } from "@/lib/api-client";

export interface LocalPool {
  poolId: string;
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  fee: number;
  walletAddress: string;
  createdAt: string;
  status: string;
  totalLiquidity: string;
}

export interface SwapQuoteResponse {
  inputAmount: string;
  outputAmount: string;
  priceImpact: string;
  fee: string;
  poolId: string;
  pool: LocalPool;
}

class LocalSwapService {
  async getPools(): Promise<LocalPool[]> {
    try {
      const apiUrl = resolveApiUrl();
      const response = await fetch(`${apiUrl}/api/pools`);
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return data.pools || [];
    } catch (error) {
      console.error("Error fetching pools:", error);
      return [];
    }
  }

  async getPoolsForTokenPair(
    tokenA: string,
    tokenB: string,
  ): Promise<LocalPool[]> {
    try {
      const apiUrl = resolveApiUrl();
      const response = await fetch(
        `${apiUrl}/api/pools?tokenA=${tokenA}&tokenB=${tokenB}`,
      );
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return data.pools || [];
    } catch (error) {
      console.error("Error fetching pools for token pair:", error);
      return [];
    }
  }

  async getQuote(
    inputMint: string,
    outputMint: string,
    inputAmount: string,
  ): Promise<SwapQuoteResponse | null> {
    try {
      const apiUrl = resolveApiUrl();
      const response = await fetch(`${apiUrl}/api/swap/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputMint,
          outputMint,
          inputAmount,
        }),
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error("Error getting swap quote:", error);
      return null;
    }
  }

  async executeSwap(
    poolId: string,
    inputMint: string,
    inputAmount: string,
    outputAmount: string,
  ): Promise<LocalPool | null> {
    try {
      const apiUrl = resolveApiUrl();
      const response = await fetch(`${apiUrl}/api/swap/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          poolId,
          inputMint,
          inputAmount,
          outputAmount,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.pool;
    } catch (error) {
      console.error("Error executing swap:", error);
      return null;
    }
  }

  calculatePriceImpact(
    reserveIn: number,
    reserveOut: number,
    amountIn: number,
  ): number {
    const numerator = amountIn * reserveOut;
    const denominator = reserveIn * (reserveIn + amountIn);
    const spotPrice = numerator / denominator;
    const executionPrice = amountIn / (numerator / reserveOut - amountIn);
    return ((spotPrice - executionPrice) / spotPrice) * 100;
  }

  hasLiquidity(pool: LocalPool, inputMint: string, inputAmount: string): boolean {
    const input = parseFloat(inputAmount);
    const isTokenA = inputMint === pool.tokenA;
    const reserveIn = parseFloat(isTokenA ? pool.amountA : pool.amountB);
    const reserveOut = parseFloat(isTokenA ? pool.amountB : pool.amountA);

    if (reserveIn <= 0 || reserveOut <= 0) {
      return false;
    }

    const feeMultiplier = 1 - pool.fee / 100;
    const amountInWithFee = input * feeMultiplier;
    const maxOutput = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);

    return maxOutput > 0;
  }
}

export const localSwapAPI = new LocalSwapService();
