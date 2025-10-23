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

type D1 = any; // Cloudflare D1 Database type

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

// Cloudflare D1 Database Functions

export async function ensurePoolSchema(db: D1) {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS pools (
      pool_id TEXT PRIMARY KEY,
      token_a TEXT NOT NULL,
      token_b TEXT NOT NULL,
      amount_a TEXT NOT NULL,
      amount_b TEXT NOT NULL,
      fee REAL NOT NULL,
      wallet_address TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL,
      total_liquidity TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pools_wallet_address ON pools(wallet_address)`,
    `CREATE INDEX IF NOT EXISTS idx_pools_created_at ON pools(created_at DESC)`,
  ];
  for (const sql of stmts) {
    await db.prepare(sql).run();
  }
}

export async function createPoolCF(db: D1, pool: Pool) {
  await ensurePoolSchema(db);
  await db
    .prepare(
      `INSERT INTO pools (pool_id, token_a, token_b, amount_a, amount_b, fee, wallet_address, created_at, status, total_liquidity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      pool.poolId,
      pool.tokenA,
      pool.tokenB,
      pool.amountA,
      pool.amountB,
      pool.fee,
      pool.walletAddress,
      pool.createdAt,
      pool.status,
      pool.totalLiquidity,
    )
    .run();
  return pool;
}

export async function listPoolsCF(db: D1) {
  await ensurePoolSchema(db);
  const { results } = await db
    .prepare(
      `SELECT pool_id as poolId, token_a as tokenA, token_b as tokenB,
              amount_a as amountA, amount_b as amountB, fee, wallet_address as walletAddress,
              created_at as createdAt, status, total_liquidity as totalLiquidity
       FROM pools
       ORDER BY created_at DESC`,
    )
    .all();
  return {
    pools: (results || []).map((r: any) => ({
      poolId: r.poolId,
      tokenA: r.tokenA,
      tokenB: r.tokenB,
      amountA: r.amountA,
      amountB: r.amountB,
      fee: Number(r.fee),
      walletAddress: r.walletAddress,
      createdAt: r.createdAt,
      status: r.status,
      totalLiquidity: r.totalLiquidity,
    })) as Pool[],
  };
}

export async function getPoolCF(db: D1, poolId: string) {
  await ensurePoolSchema(db);
  const r = await db
    .prepare(
      `SELECT pool_id as poolId, token_a as tokenA, token_b as tokenB,
              amount_a as amountA, amount_b as amountB, fee, wallet_address as walletAddress,
              created_at as createdAt, status, total_liquidity as totalLiquidity
       FROM pools WHERE pool_id = ?`,
    )
    .bind(poolId)
    .first();
  if (!r) return null;
  return {
    poolId: r.poolId,
    tokenA: r.tokenA,
    tokenB: r.tokenB,
    amountA: r.amountA,
    amountB: r.amountB,
    fee: Number(r.fee),
    walletAddress: r.walletAddress,
    createdAt: r.createdAt,
    status: r.status,
    totalLiquidity: r.totalLiquidity,
  } as Pool;
}

export async function listPoolsForWalletCF(db: D1, walletAddress: string) {
  await ensurePoolSchema(db);
  const { results } = await db
    .prepare(
      `SELECT pool_id as poolId, token_a as tokenA, token_b as tokenB,
              amount_a as amountA, amount_b as amountB, fee, wallet_address as walletAddress,
              created_at as createdAt, status, total_liquidity as totalLiquidity
       FROM pools
       WHERE wallet_address = ?
       ORDER BY created_at DESC`,
    )
    .bind(walletAddress)
    .all();
  return {
    pools: (results || []).map((r: any) => ({
      poolId: r.poolId,
      tokenA: r.tokenA,
      tokenB: r.tokenB,
      amountA: r.amountA,
      amountB: r.amountB,
      fee: Number(r.fee),
      walletAddress: r.walletAddress,
      createdAt: r.createdAt,
      status: r.status,
      totalLiquidity: r.totalLiquidity,
    })) as Pool[],
  };
}
