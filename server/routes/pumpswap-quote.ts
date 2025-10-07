import { RequestHandler } from "express";
import { Connection } from "@solana/web3.js";

// Server-side quote helper for Pump.fun pools.
// Tries to use @pump/swap-sdk when installed; otherwise falls back to Shyft pool lookup + AMM math.

export const getPumpQuote: RequestHandler = async (req, res) => {
  try {
    const { fromMint, toMint, amount } = req.body || {};
    if (!fromMint || !toMint || !amount) return res.status(400).json({ error: "Missing required fields: fromMint, toMint, amount" });

    const rpcUrl = process.env.HELIUS_RPC || "https://api.mainnet-beta.solana.com";
    const conn = new Connection(rpcUrl, { commitment: "confirmed" });

    // Try to load Pump SDK optionally
    let pump: any = null;
    try {
      const { createRequire } = await import("module");
      const require = createRequire(import.meta.url);
      try {
        pump = require("@pump/swap-sdk");
      } catch (reqErr) {
        try {
          pump = require("@pump/swap-sdk").default;
        } catch (e) {
          pump = null;
        }
      }
    } catch (e) {
      pump = null;
    }

    if (pump) {
      try {
        let sdkInstance: any = null;
        if (typeof pump === "function") sdkInstance = new pump({ connection: conn });
        const getPool = typeof pump.getPoolByMints === "function" ? pump.getPoolByMints : sdkInstance?.getPoolByMints;
        const getQuoteFn = typeof pump.getQuote === "function" ? pump.getQuote : sdkInstance?.getQuote;

        let pool: any = null;
        if (typeof getPool === "function") {
          try {
            pool = await getPool(fromMint, toMint);
          } catch (_) {
            // try bound
            pool = await getPool.call(sdkInstance, fromMint, toMint).catch(() => null);
          }
        }

        if (!pool && typeof pump.getPoolByMint === "function") {
          try {
            pool = await pump.getPoolByMint(conn, fromMint);
          } catch {}
        }

        if (!pool) return res.status(404).json({ error: "Pool not found (SDK)" });

        if (typeof getQuoteFn === "function") {
          const lamports = BigInt(Math.floor(Number(amount) * Math.pow(10, 9)));
          const side = pool.baseMint === fromMint ? "sell" : "buy";
          const q = await getQuoteFn.call(sdkInstance || pump, { pool, amountIn: lamports, side });
          return res.json({ amountOut: q?.amountOut?.toString?.() || q?.amountOut || null, priceImpact: q?.priceImpact || null, raw: q });
        }
      } catch (sdkErr) {
        console.warn("Pump SDK quote attempt failed:", sdkErr);
      }
    }

    // Fallback to Shyft pool lookup + AMM math
    const SHYFT_BASE = process.env.SHYFT_API_BASE || "https://api.shyft.to";
    const path = `/v1/defi/pair?dex=pumpFunAmm&base=${encodeURIComponent(fromMint)}&quote=${encodeURIComponent(toMint)}`;
    const headers: Record<string,string> = { Accept: "application/json", "Content-Type": "application/json" };
    if (process.env.SHYFT_API_KEY) headers["x-api-key"] = process.env.SHYFT_API_KEY;

    const resp = await fetch(`${SHYFT_BASE}${path}`, { method: "GET", headers });
    if (!resp.ok) {
      if (resp.status === 404) return res.status(404).json({ error: "Pool not found (Shyft)" });
      const txt = await resp.text().catch(() => "");
      return res.status(500).json({ error: `Shyft error: ${resp.status} ${txt}` });
    }

    const body = await resp.json().catch(() => null);
    const pair = body?.data || body?.pair || body;
    const poolObj = Array.isArray(pair) ? pair[0] : pair;
    if (!poolObj) return res.status(404).json({ error: "Pool not found (Shyft body)" });

    const baseDecimals = poolObj.baseDecimals ?? poolObj.baseMintDecimals ?? 9;
    const quoteDecimals = poolObj.quoteDecimals ?? poolObj.quoteMintDecimals ?? 9;
    const baseReserveRaw = parseFloat(poolObj.baseReserve || poolObj.baseAmount || poolObj.reserveA || poolObj.reserve0 || 0);
    const quoteReserveRaw = parseFloat(poolObj.quoteReserve || poolObj.quoteAmount || poolObj.reserveB || poolObj.reserve1 || 0);
    const baseReserve = baseReserveRaw > 1e6 ? baseReserveRaw / Math.pow(10, baseDecimals) : baseReserveRaw;
    const quoteReserve = quoteReserveRaw > 1e6 ? quoteReserveRaw / Math.pow(10, quoteDecimals) : quoteReserveRaw;

    const inputIsBase = (poolObj.baseMint || poolObj.base || fromMint) === fromMint;
    const x = inputIsBase ? baseReserve : quoteReserve;
    const y = inputIsBase ? quoteReserve : baseReserve;
    if (!x || !y) return res.status(500).json({ error: "Invalid pool reserves" });
    const feeBps = 30;
    const feeFactor = 1 - feeBps / 10000;
    const inputAfterFee = Number(amount) * feeFactor;
    const newX = x + inputAfterFee;
    const newY = (x * y) / newX;
    const outputAmount = y - newY;
    const midPrice = y / x;
    const effectivePrice = outputAmount > 0 ? Number(amount) / outputAmount : midPrice;
    const priceImpactPct = ((midPrice - effectivePrice) / midPrice) * 100;

    return res.json({ amountOut: outputAmount, priceImpact: Math.abs(priceImpactPct), pool: { baseReserve, quoteReserve, baseDecimals, quoteDecimals } });
  } catch (error) {
    console.error("getPumpQuote error:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
};
