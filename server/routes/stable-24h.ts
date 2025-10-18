import { RequestHandler } from "express";

export const handleStable24h: RequestHandler = async (req, res) => {
  try {
    const symbolsParam = String(req.query.symbols || "USDC,USDT").toUpperCase();
    const symbols = Array.from(
      new Set(
        String(symbolsParam)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );

    const COINGECKO_IDS: Record<string, { id: string; mint: string }> = {
      USDC: {
        id: "usd-coin",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      },
      USDT: {
        id: "tether",
        mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
      },
    };

    const ids = symbols
      .map((s) => COINGECKO_IDS[s]?.id)
      .filter(Boolean)
      .join(",");

    if (!ids) {
      return res.status(400).json({ error: "No supported symbols provided" });
    }

    const apiUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const resp = await fetch(apiUrl, {
        signal: controller.signal as any,
        headers: { Accept: "application/json" },
      } as any);
      clearTimeout(timeoutId);

      const result: Record<
        string,
        { priceUsd: number; change24h: number; mint: string }
      > = {};

      if (resp.ok) {
        const json = await resp.json();
        symbols.forEach((sym) => {
          const meta = COINGECKO_IDS[sym];
          if (!meta) return;
          const d = (json as any)?.[meta.id];
          const price = typeof d?.usd === "number" ? d.usd : 1;
          const change =
            typeof d?.usd_24h_change === "number" ? d.usd_24h_change : 0;
          result[sym] = { priceUsd: price, change24h: change, mint: meta.mint };
        });
      } else {
        symbols.forEach((sym) => {
          const meta = COINGECKO_IDS[sym];
          if (!meta) return;
          result[sym] = { priceUsd: 1, change24h: 0, mint: meta.mint };
        });
      }

      res.json({ data: result });
    } catch (e) {
      clearTimeout(timeoutId);
      const result: Record<
        string,
        { priceUsd: number; change24h: number; mint: string }
      > = {};
      symbols.forEach((sym) => {
        const meta = COINGECKO_IDS[sym];
        if (!meta) return;
        result[sym] = { priceUsd: 1, change24h: 0, mint: meta.mint };
      });
      res.json({ data: result });
    }
  } catch (error) {
    res.status(500).json({ error: "Unexpected error" });
  }
};
