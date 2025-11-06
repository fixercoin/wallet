import { RequestHandler } from "express";

const TIMEOUT = 15000;

async function tryFetchJson(url: string, opts: any = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const resp = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timeout);
    const text = await resp.text().catch(() => "");
    try {
      return {
        ok: resp.ok,
        status: resp.status,
        json: text ? JSON.parse(text) : null,
        text,
      };
    } catch (e) {
      return { ok: resp.ok, status: resp.status, json: null, text };
    }
  } catch (e: any) {
    clearTimeout(timeout);
    throw e;
  }
}

export const handleLocalQuote: RequestHandler = async (req, res) => {
  try {
    const inputMint = String(req.query.inputMint || req.query.input_mint || "");
    const outputMint = String(
      req.query.outputMint || req.query.output_mint || "",
    );
    const amount = String(req.query.amount || "");
    const mint = String(req.query.mint || "");

    // 1) Meteora quote (preferred)
    if (inputMint && outputMint && amount) {
      try {
        const url = new URL("https://api.meteora.ag/swap/v3/quote");
        url.searchParams.set("inputMint", inputMint);
        url.searchParams.set("outputMint", outputMint);
        url.searchParams.set("amount", String(amount));
        const r = await tryFetchJson(url.toString(), {
          headers: { Accept: "application/json" },
        });
        if (r.ok && r.json)
          return res.json({ source: "meteora", quote: r.json });
      } catch (e) {
        // continue to other providers
      }
    }

    // 2) Jupiter quote
    if (inputMint && outputMint && amount) {
      try {
        const params = new URLSearchParams();
        params.set("inputMint", inputMint);
        params.set("outputMint", outputMint);
        params.set("amount", String(amount));
        const url = `https://lite-api.jup.ag/swap/v1/quote?${params.toString()}`;
        const r = await tryFetchJson(url, {
          headers: { Accept: "application/json" },
        });
        if (r.ok && r.json)
          return res.json({ source: "jupiter", quote: r.json });
      } catch (e) {}
    }

    // 3) DexScreener price fallback (supports single mint -> returns price)
    if (inputMint || mint) {
      const token = inputMint || mint;
      try {
        const url = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(token)}`;
        const r = await tryFetchJson(url, {
          headers: { Accept: "application/json" },
        });
        if (r.ok && r.json) {
          // try to map to simple quote
          const data = r.json as any;
          const firstPair = data.pairs && data.pairs[0];
          if (firstPair) {
            return res.json({
              source: "dexscreener",
              quote: {
                inAmount: amount || "1",
                outAmount: firstPair.priceUsd ?? 0,
                priceImpact: 0,
              },
            });
          }
        }
      } catch (e) {}
    }

    return res
      .status(502)
      .json({ error: "Failed to fetch quote from providers" });
  } catch (e: any) {
    return res
      .status(502)
      .json({
        error: "Quote handler failed",
        details: e?.message || String(e),
      });
  }
};
