export interface Pool {
  poolId: string;
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  fee: number;
  walletAddress: string;
  createdAt: string;
  status: "active" | "inactive";
  totalLiquidity: string;
}

export interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  fee: string;
  poolId: string;
}

class PoolStore {
  private pools: Map<string, Pool> = new Map();

  constructor() {
    this.loadPools();
  }

  private loadPools() {
    try {
      if (typeof window === "undefined") {
        return;
      }
      const stored = localStorage.getItem("fixorium_pools");
      if (stored) {
        const poolsArray = JSON.parse(stored);
        poolsArray.forEach((pool: Pool) => {
          this.pools.set(pool.poolId, pool);
        });
      }
    } catch (err) {
      console.error("Error loading pools from storage:", err);
    }
  }

  private savePools() {
    try {
      if (typeof window === "undefined") {
        return;
      }
      const poolsArray = Array.from(this.pools.values());
      localStorage.setItem("fixorium_pools", JSON.stringify(poolsArray));
    } catch (err) {
      console.error("Error saving pools to storage:", err);
    }
  }

  createPool(pool: Pool): Pool {
    this.pools.set(pool.poolId, pool);
    this.savePools();
    return pool;
  }

  getPool(poolId: string): Pool | null {
    return this.pools.get(poolId) || null;
  }

  listPools(): Pool[] {
    return Array.from(this.pools.values());
  }

  listPoolsForTokenPair(tokenA: string, tokenB: string): Pool[] {
    return Array.from(this.pools.values()).filter(
      (pool) =>
        (pool.tokenA === tokenA && pool.tokenB === tokenB) ||
        (pool.tokenA === tokenB && pool.tokenB === tokenA),
    );
  }

  updatePoolLiquidity(
    poolId: string,
    amountA: string,
    amountB: string,
  ): Pool | null {
    const pool = this.pools.get(poolId);
    if (!pool) return null;

    pool.amountA = amountA;
    pool.amountB = amountB;
    pool.totalLiquidity = `${amountA}-${amountB}`;
    this.savePools();
    return pool;
  }

  calculateSwapAmount(
    pool: Pool,
    inputMint: string,
    inputAmount: string,
  ): SwapQuote | null {
    const input = parseFloat(inputAmount);
    if (isNaN(input) || input <= 0) return null;

    const isTokenA = inputMint === pool.tokenA;
    const reserveIn = parseFloat(isTokenA ? pool.amountA : pool.amountB);
    const reserveOut = parseFloat(isTokenA ? pool.amountB : pool.amountA);

    if (reserveIn <= 0 || reserveOut <= 0) return null;

    const feeMultiplier = 1 - pool.fee / 100;
    const amountInWithFee = input * feeMultiplier;
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn + amountInWithFee;
    const outputAmount = numerator / denominator;

    const priceImpact =
      ((input * reserveOut) / (reserveIn * (reserveIn + input)) -
        outputAmount) /
      ((input * reserveOut) / (reserveIn * (reserveIn + input)));

    const feeAmount = input - amountInWithFee;

    return {
      inputAmount: inputAmount,
      outputAmount: outputAmount.toString(),
      priceImpact: Math.abs(priceImpact) * 100,
      fee: feeAmount.toString(),
      poolId: pool.poolId,
    };
  }

  executeSwap(
    poolId: string,
    inputMint: string,
    inputAmount: string,
    outputAmount: string,
  ): Pool | null {
    const pool = this.pools.get(poolId);
    if (!pool) return null;

    const isTokenA = inputMint === pool.tokenA;
    const newAmountA = isTokenA
      ? (parseFloat(pool.amountA) + parseFloat(inputAmount)).toString()
      : (parseFloat(pool.amountA) - parseFloat(outputAmount)).toString();

    const newAmountB = isTokenA
      ? (parseFloat(pool.amountB) - parseFloat(outputAmount)).toString()
      : (parseFloat(pool.amountB) + parseFloat(inputAmount)).toString();

    return this.updatePoolLiquidity(poolId, newAmountA, newAmountB);
  }
}

export const poolStore = new PoolStore();
