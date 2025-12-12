import { TOKEN_MINTS } from "@/lib/constants/token-mints";
import { jupiterAPI } from "@/lib/services/jupiter";
import { birdeyeAPI } from "@/lib/services/birdeye";

export type SupportedToken = "FIXERCOIN" | "LOCKER";

export interface DerivedPrice {
  token: SupportedToken;
  tokensPerSol: number; // how many token units per 1 SOL
  tokenUsd: number; // USD price per 1 token
  solUsd: number; // SOL USD price used
  updatedAt: number;
}

export interface GenericTokenPrice {
  mint: string;
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
  FIXERCOIN: 0.000042, // Fallback price for pump.fun token
  LOCKER: 0.000008, // Fallback price for pump.fun token
};

const genericTokenCache = new Map<string, GenericTokenPrice>();

const cache = new Map<SupportedToken, DerivedPrice>();
const CACHE_TTL_MS = 30_000;

async function getSolUsd(): Promise<number> {
  try {
    const res = await fetch("/api/token/price?token=SOL");
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    const v = Number(json?.priceUsd);
    return Number.isFinite(v) && v > 0 ? v : FALLBACK_USD.SOL;
  } catch (err) {
    console.warn("Failed to get SOL price:", err);
    return FALLBACK_USD.SOL;
  }
}

async function getTokensPerSol(token: SupportedToken): Promise<number | null> {
  try {
    const solMint = TOKEN_MINTS.SOL;
    const tokenMintOrig = TOKEN_MINTS[token];

    // Build candidate mint variants to handle accidental suffixes like "pump" or "ixpump"
    const candidates = [tokenMintOrig];
    if (tokenMintOrig.endsWith("ixpump")) {
      candidates.push(tokenMintOrig.slice(0, -6));
    }
    if (tokenMintOrig.endsWith("pump")) {
      candidates.push(tokenMintOrig.slice(0, -4));
    }

    // Ensure unique
    const uniqCandidates = Array.from(new Set(candidates.filter(Boolean)));

    // Try Jupiter for each candidate mint
    const rawAmt = jupiterAPI.formatSwapAmount(1, DECIMALS.SOL);
    for (const candidateMint of uniqCandidates) {
      try {
        const q = await jupiterAPI.getQuote(
          solMint,
          candidateMint,
          rawAmt as any,
        );
        if (!q || !q.outAmount || q.outAmount === "0") {
          console.warn(`No Jupiter quote for candidate ${candidateMint}`);
          continue;
        }

        const out = jupiterAPI.parseSwapAmount(q.outAmount, DECIMALS[token]);
        if (!Number.isFinite(out) || out <= 0) {
          console.warn(
            `Invalid quote output for candidate ${candidateMint}: ${out}`,
          );
          continue;
        }

        console.log(
          `${token}: 1 SOL = ${out.toFixed(2)} tokens (from Jupiter, mint=${candidateMint})`,
        );
        return out;
      } catch (err) {
        console.warn(`Jupiter error for candidate ${candidateMint}:`, err);
      }
    }

    // If Jupiter failed, try DexScreener price-based estimation using any candidate mint
    for (const candidateMint of uniqCandidates) {
      try {
        const dexData = await getUsdFromDexscreener(token, candidateMint);
        if (dexData && dexData > 0) {
          // derive tokensPerSol from SOL USD price and token USD price
          const solUsd = await getSolUsd();
          const tokensPerSol = solUsd / dexData;
          console.log(
            `${token}: estimated 1 SOL = ${tokensPerSol.toFixed(2)} tokens (from DexScreener, mint=${candidateMint})`,
          );
          return tokensPerSol;
        }
      } catch (err) {
        console.warn(`DexScreener fallback failed for ${candidateMint}:`, err);
      }
    }

    console.warn(
      `No quote found for ${token} (candidates: ${uniqCandidates.join(",")})`,
    );
    return null;
  } catch (error) {
    console.warn(`Error getting ${token} from Jupiter:`, error);
    return null;
  }
}

async function getUsdFromServer(token: SupportedToken): Promise<number | null> {
  try {
    const res = await fetch(`/api/token/price?token=${token}`);
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    const v = Number(json?.priceUsd);
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

async function getUsdFromBirdeye(
  token: SupportedToken,
  mint?: string,
): Promise<number | null> {
  try {
    const lookupMint = mint || TOKEN_MINTS[token];
    const data = await birdeyeAPI.getTokenByMint(lookupMint);
    const p = data?.priceUsd ? parseFloat(String(data.priceUsd)) : NaN;
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}

async function getUsdFromDexscreener(
  token: SupportedToken,
  mint?: string,
): Promise<number | null> {
  try {
    const lookupMint = mint || TOKEN_MINTS[token];
    // For FIXERCOIN and LOCKER, try Birdeye first
    if (token === "FIXERCOIN" || token === "LOCKER") {
      const birdeyePrice = await getUsdFromBirdeye(token, mint);
      if (birdeyePrice) {
        return birdeyePrice;
      }
    }

    // Fallback to Birdeye for any token (as secondary option)
    const birdeyePrice = await getUsdFromBirdeye(token, mint);
    return birdeyePrice;
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
    // Fallback 1: Try server endpoint for accurate pricing
    let usd = await getUsdFromServer(token);

    // Fallback 2: get token USD from DexScreener if server call fails
    if (!usd) {
      usd = await getUsdFromDexscreener(token);
    }

    // Fallback 3: Use hardcoded fallback price
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

async function getGenericTokensPerSol(
  tokenMint: string,
  tokenDecimals: number,
): Promise<number | null> {
  try {
    // Try Birdeye first for better pricing data
    const birdeyeData = await birdeyeAPI.getTokenByMint(tokenMint);
    if (birdeyeData?.priceUsd) {
      const tokenUsd = parseFloat(String(birdeyeData.priceUsd));
      if (Number.isFinite(tokenUsd) && tokenUsd > 0) {
        const solUsd = await getSolUsd();
        const tokensPerSol = solUsd / tokenUsd;
        console.log(
          `1 SOL = ${tokensPerSol.toFixed(2)} tokens (mint=${tokenMint}, from Birdeye)`,
        );
        return tokensPerSol;
      }
    }

    console.warn(`No price data found for token ${tokenMint} on Birdeye`);
    return null;
  } catch (error) {
    console.warn(`Error getting tokens per SOL for ${tokenMint}:`, error);
    return null;
  }
}

export async function getTokenPriceBySol(
  mint: string,
  decimals: number,
): Promise<GenericTokenPrice | null> {
  const now = Date.now();
  const cached = genericTokenCache.get(mint);
  if (cached && now - cached.updatedAt < CACHE_TTL_MS) return cached;

  const [solUsd, tps] = await Promise.all([
    getSolUsd(),
    getGenericTokensPerSol(mint, decimals),
  ]);

  let tokensPerSol = tps ?? 0;
  let tokenUsd = 0;

  if (tokensPerSol > 0) {
    tokenUsd = solUsd / tokensPerSol;
  } else {
    // If DexScreener failed, return null
    // The caller should handle fallback to existing price data
    console.warn(`Unable to calculate price for token ${mint}`);
    return null;
  }

  const result: GenericTokenPrice = {
    mint,
    tokensPerSol,
    tokenUsd,
    solUsd,
    updatedAt: now,
  };
  genericTokenCache.set(mint, result);
  return result;
}
