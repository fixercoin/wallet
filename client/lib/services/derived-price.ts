import { TOKEN_MINTS } from "@/lib/constants/token-mints";
import { jupiterAPI } from "@/lib/services/jupiter";
import { dexscreenerAPI } from "@/lib/services/dexscreener";

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
  SOL: 149.38, // Real-time market price
  FIXERCOIN: 0.00008139, // Real-time market price
  LOCKER: 0.00001112, // Real-time market price
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

async function getTokensPerSol(token: SupportedToken): Promise<number | null> {
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
