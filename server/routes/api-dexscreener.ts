import { RequestHandler } from "express";

const DEX_BASE = process.env.DEXSCREENER_BASE || "https://api.dexscreener.com";

export const handleDexscreener: RequestHandler = async (req, res) => {
  try {
    // path can be like /latest/dex/tokens/{pair} or /search/queries
    const path = (req.query.path as string) || req.body?.path;
    if (!path) return res.status(400).json({ error: "Missing path parameter" });

    const url = `${DEX_BASE}/${path.replace(/^\//, "")}`;

    const response = await fetch(url, { method: req.method });
    const text = await response.text().catch(() => "");

    // Short cache
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");

    try {
      const json = text ? JSON.parse(text) : {};
      return res.status(response.status).json(json);
    } catch (e) {
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error("Dexscreener proxy error:", error);
    return res.status(500).json({ error: String(error) });
  }
};
