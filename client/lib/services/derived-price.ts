import { TOKEN_MINTS } from "@/lib/constants/token-mints";
import { jupiterAPI } from "@/lib/services/jupiter";
import { dexscreenerAPI } from "@/lib/services/dexscreener";
import { getPoolForPair, computeSwapOutput } from "@/lib/services/pumpswap";

export type SupportedToken = "FIXERCOIN" | "LOCKER";

export interface DerivedPrice {
  token: SupportedToken;
  tokensPerSol: number; // how many token units per 1 SOL
  tokenUsd: number; // USD price per 1 token
  solUsd: number; // SOL USD price used
  updatedAt: number;
}

const DECIMALS: Record<SupportedToken | "SOL", number> = {
  SOL: 9,
  FIXERCOIN: 6,
  LOCKER: 6,
};

const FALLBACK_USD: Record<SupportedToken | "SOL", number> = {
  SOL: 180,
  FIXERCOIN: 0.000023,
  LOCKER: 0.1,
};

const cache = new Map<SupportedToken, DerivedPrice>();
const CACHE_TTL_MS = 30_000;

async function getSolUsd(): Promise<number> {
  try {
    const res = await fetch("/api/token/price?token=SOL");
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    const v = Number(json?.priceUsd);
    return Number.isFinite(v) && v > 0 ? v : FALLBACK_USD.SOL;
  } catch {
    return FALLBACK_USD.SOL;
  }
}

async function getTokensPerSolFromPump(
  token: SupportedToken,
): Promise<number | null> {
  try {
    const solMint = TOKEN_MINTS.SOL;
    const tokenMint = TOKEN_MINTS[token];

    // Try to get pool data for SOL/TOKEN pair
    const pool = await getPoolForPair(solMint, tokenMint);
    if (!pool || !pool.baseReserve || !pool.quoteReserve) {
      return null;
    }

    // Calculate tokens per SOL using pool reserves
    // If pool is SOL/TOKEN, then tokensPerSol = quoteReserve / baseReserve
    // But we need to account for the pool orientation
    const baseIsSol = pool.baseMint === solMint;
    const tokensPerSol = baseIsSol
      ? pool.quoteReserve / pool.baseReserve
      : pool.baseReserve / pool.quoteReserve;

    return Number.isFinite(tokensPerSol) && tokensPerSol > 0 ? tokensPerSol : null;
  } catch (error) {
    console.warn(`Error getting tokens per SOL from Pump for ${token}:`, error);
    return null;
  }
}

async function getTokensPerSol(token: SupportedToken): Promise<number | null> {
  // For Pump.fun tokens, try Pump.fun pool first
  const pumpResult = await getTokensPerSolFromPump(token);
  if (pumpResult) return pumpResult;

  // Fallback to Jupiter API
  const solMint = TOKEN_MINTS.SOL;
  const tokenMint = TOKEN_MINTS[token];
  const rawAmt = jupiterAPI.formatSwapAmount(1, DECIMALS.SOL);
  const q = await jupiterAPI.getQuote(solMint, tokenMint, rawAmt as any);
  if (!q) return null;
  const out = jupiterAPI.parseSwapAmount(q.outAmount, DECIMALS[token]);
  return Number.isFinite(out) && out > 0 ? out : null;
}

async function getUsdFromDexscreener(
  token: SupportedToken,
): Promise<number | null> {
  try {
    const data = await dexscreenerAPI.getTokenByMint(TOKEN_MINTS[token]);
    const p = data?.priceUsd ? parseFloat(data.priceUsd) : NaN;
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}

export async function getDerivedPrice(
  token: SupportedToken,
): Promise<DerivedPrice> {
  const now = Date.now();
  const cached = cache.get(token);
  if (cached && now - cached.updatedAt < CACHE_TTL_MS) return cached;

  const [solUsd, tps] = await Promise.all([
    getSolUsd(),
    getTokensPerSol(token),
  ]);

  let tokensPerSol = tps ?? 0;
  let tokenUsd = 0;

  if (tokensPerSol > 0) {
    tokenUsd = solUsd / tokensPerSol;
  } else {
    // Fallback: get token USD directly, then infer tokensPerSol
    const usd = await getUsdFromDexscreener(token);
    tokenUsd = usd ?? FALLBACK_USD[token];
    tokensPerSol = tokenUsd > 0 ? solUsd / tokenUsd : 0;
  }

  const result: DerivedPrice = {
    token,
    tokensPerSol,
    tokenUsd,
    solUsd,
    updatedAt: now,
  };
  cache.set(token, result);
  return result;
}
