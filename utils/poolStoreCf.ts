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

const POOLS_FILE = "data/pools.json";

let poolCache: Pool[] = [];
let lastLoadTime = 0;
const CACHE_TTL = 60000; // 1 minute

function loadPoolsFromCache(): Pool[] {
  return poolCache;
}

function savePoolsToCache(pools: Pool[]) {
  poolCache = pools;
  lastLoadTime = Date.now();
}

export function listPools(): Pool[] {
  return loadPoolsFromCache();
}

export function getPool(poolId: string): Pool | null {
  const pools = loadPoolsFromCache();
  return pools.find((p) => p.poolId === poolId) || null;
}

export function createOrUpdatePool(pool: Pool): { pool: Pool; status: number } {
  const pools = loadPoolsFromCache();
  const existingIndex = pools.findIndex((p) => p.poolId === pool.poolId);

  if (existingIndex >= 0) {
    pools[existingIndex] = pool;
  } else {
    pools.push(pool);
  }

  savePoolsToCache(pools);
  return { pool, status: existingIndex >= 0 ? 200 : 201 };
}

export function deletePool(poolId: string): { status: number } {
  const pools = loadPoolsFromCache();
  const index = pools.findIndex((p) => p.poolId === poolId);

  if (index === -1) {
    return { status: 404 };
  }

  pools.splice(index, 1);
  savePoolsToCache(pools);
  return { status: 204 };
}

export function listPoolsForTokenPair(tokenA: string, tokenB: string): Pool[] {
  const pools = loadPoolsFromCache();
  return pools.filter(
    (pool) =>
      (pool.tokenA === tokenA && pool.tokenB === tokenB) ||
      (pool.tokenA === tokenB && pool.tokenB === tokenA),
  );
}

export function updatePoolLiquidity(
  poolId: string,
  amountA: string,
  amountB: string,
): Pool | null {
  const pool = getPool(poolId);
  if (!pool) return null;

  pool.amountA = amountA;
  pool.amountB = amountB;
  pool.totalLiquidity = `${amountA}-${amountB}`;

  createOrUpdatePool(pool);
  return pool;
}

export function swapInPool(
  poolId: string,
  inputMint: string,
  inputAmount: string,
  outputAmount: string,
): Pool | null {
  const pool = getPool(poolId);
  if (!pool) return null;

  const isTokenA = inputMint === pool.tokenA;

  const newAmountA = isTokenA
    ? (parseFloat(pool.amountA) + parseFloat(inputAmount)).toString()
    : (parseFloat(pool.amountA) - parseFloat(outputAmount)).toString();

  const newAmountB = isTokenA
    ? (parseFloat(pool.amountB) - parseFloat(outputAmount)).toString()
    : (parseFloat(pool.amountB) + parseFloat(inputAmount)).toString();

  return updatePoolLiquidity(poolId, newAmountA, newAmountB);
}

export function calculateSwapQuote(
  pool: Pool,
  inputMint: string,
  inputAmount: string,
): {
  outputAmount: string;
  priceImpact: string;
  fee: string;
} | null {
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
    ((input * reserveOut) / (reserveIn * (reserveIn + input)) - outputAmount) /
    ((input * reserveOut) / (reserveIn * (reserveIn + input)));

  const feeAmount = input - amountInWithFee;

  return {
    outputAmount: outputAmount.toFixed(8),
    priceImpact: (Math.abs(priceImpact) * 100).toFixed(2),
    fee: feeAmount.toFixed(8),
  };
}
