// Minimal PumpSwap integration using Shyft APIs for pool discovery and client-side quote estimation.
// NOTE: This file only implements pool lookup and quote computation using constant-product x*y=k.
// Building and executing a real PumpSwap transaction requires the PumpSwap program's instruction
// layout and may need server-side signing or custom program interactions. The buildSwapTransaction
// function below is a placeholder that returns null and instructs the caller to perform server-side
// transaction construction with PumpSwap program details.

import { resolveApiUrl } from "@/lib/api-client";

export interface PumpPoolInfo {
  address: string;
  baseMint: string; // token A mint (e.g. SOL or token)
  quoteMint: string; // token B mint (e.g. USDC)
  baseReserve: number; // human-readable (not lamports), adjusted by decimals
  quoteReserve: number; // human-readable
  baseDecimals: number;
  quoteDecimals: number;
  lpMint?: string;
  raw?: any;
}

// Use proxy endpoint instead of direct Shyft API
const PUMP_SWAP_PROXY_BASE = "/api/pumpfun";

async function pumpFunProxyFetch(path: string, method = "GET", body?: any) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const url = resolveApiUrl(`${PUMP_SWAP_PROXY_BASE}${path}`);
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // If not found, return null so callers can gracefully fallback
  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Pump.fun proxy error: ${res.status} ${txt}`);
  }

  return await res.json().catch(() => null);
}

// Discover a PumpSwap pool by token pair via proxy endpoint
export async function getPoolForPair(
  inputMint: string,
  outputMint: string,
): Promise<PumpPoolInfo | null> {
  try {
    // Call proxy endpoint to get pool info
    const path = `/pool?base=${encodeURIComponent(inputMint)}&quote=${encodeURIComponent(outputMint)}`;
    const j = await pumpFunProxyFetch(path, "GET");
    if (!j) return null;

    // Shyft response shapes vary: try common fields
    const pair = j?.data || j?.pair || j;
    if (!pair) return null;

    // For safety, find pool info within response
    const pool = Array.isArray(pair) ? pair[0] : pair;
    if (!pool) return null;

    // Extract reserves and decimals (best-effort)
    const baseMint = pool.baseMint || pool.base || inputMint;
    const quoteMint = pool.quoteMint || pool.quote || outputMint;
    const baseDecimals = pool.baseDecimals ?? pool.baseMintDecimals ?? 9;
    const quoteDecimals = pool.quoteDecimals ?? pool.quoteMintDecimals ?? 9;

    // Reserves might be provided as raw amounts; attempt to parse
    const baseReserveRaw = parseFloat(
      pool.baseReserve ||
        pool.baseAmount ||
        pool.reserveA ||
        pool.reserve0 ||
        0,
    );
    const quoteReserveRaw = parseFloat(
      pool.quoteReserve ||
        pool.quoteAmount ||
        pool.reserveB ||
        pool.reserve1 ||
        0,
    );

    // Convert to human-readable by dividing by 10^decimals if reserves appear large
    const baseReserve =
      baseReserveRaw > 1e6
        ? baseReserveRaw / Math.pow(10, baseDecimals)
        : baseReserveRaw;
    const quoteReserve =
      quoteReserveRaw > 1e6
        ? quoteReserveRaw / Math.pow(10, quoteDecimals)
        : quoteReserveRaw;

    const info: PumpPoolInfo = {
      address: pool.poolAddress || pool.address || pool.id || "",
      baseMint,
      quoteMint,
      baseReserve: isNaN(baseReserve) ? 0 : baseReserve,
      quoteReserve: isNaN(quoteReserve) ? 0 : quoteReserve,
      baseDecimals,
      quoteDecimals,
      lpMint: pool.lpMint || pool.lp || undefined,
      raw: pool,
    };

    return info;
  } catch (error) {
    console.error("getPoolForPair error:", error);
    return null;
  }
}

// Compute a constant-product AMM quote with a fee (feeBps default 30 => 0.3%)
export function computeSwapOutput(
  pool: PumpPoolInfo,
  inputAmountHuman: number, // amount in human units (e.g. SOL)
  inputIsBase: boolean,
  feeBps = 30,
): { outputAmount: number; priceImpactPct: number } {
  // Use x * y = k model. If input is base, x is baseReserve, y is quoteReserve.
  const x = inputIsBase ? pool.baseReserve : pool.quoteReserve;
  const y = inputIsBase ? pool.quoteReserve : pool.baseReserve;
  if (!x || !y) return { outputAmount: 0, priceImpactPct: 0 };

  const feeFactor = 1 - feeBps / 10000;
  const inputAfterFee = inputAmountHuman * feeFactor;

  const newX = x + inputAfterFee;
  const newY = (x * y) / newX;
  const outputAmount = y - newY; // amount of output token human

  // price impact approximated vs marginal price
  const midPrice = y / x; // output per input
  const effectivePrice =
    outputAmount > 0 ? inputAmountHuman / outputAmount : midPrice;
  const priceImpactPct = ((midPrice - effectivePrice) / midPrice) * 100;

  return {
    outputAmount: Math.max(0, outputAmount),
    priceImpactPct: Math.abs(priceImpactPct),
  };
}

// Placeholder: building a PumpSwap program transaction typically requires program-specific
// instruction data and accounts. This must be implemented server-side or with the PumpSwap
// program ABI. For now, we return null and an informative error message.
export async function buildSwapTransactionPlaceholder(
  pool: PumpPoolInfo,
  inputAmountHuman: number,
  inputIsBase: boolean,
  userPublicKey: string,
): Promise<null> {
  console.warn(
    "buildSwapTransactionPlaceholder called - PumpSwap program transaction building is not implemented client-side.",
  );
  // Return null to indicate not available
  return null;
}
