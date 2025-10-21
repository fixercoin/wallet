import type { RequestHandler } from "express";

export const handleSubmitSplMeta: RequestHandler = async (req, res) => {
  try {
    const {
      name,
      symbol,
      description,
      logoURI,
      website,
      twitter,
      telegram,
      dexpair,
      lastUpdated,
    } = req.body || {};

    // Basic validation
    if (!name || !symbol) {
      return res.status(400).json({ error: "Missing required fields: name, symbol" });
    }

    const payload = {
      name: String(name),
      symbol: String(symbol),
      description: String(description || ""),
      logoURI: String(logoURI || ""),
      website: String(website || ""),
      twitter: String(twitter || ""),
      telegram: String(telegram || ""),
      dexpair: String(dexpair || ""),
      lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      source: "spl-meta-form",
    };

    // For now, just acknowledge receipt. External directories (Solscan/Dexscreener)
    // typically require manual verification or partner APIs.
    // You can wire this to a webhook or service with credentials.
    console.log("[SPL-META] Submission received:", payload);

    return res.status(202).json({ status: "queued", payload });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SPL-META] Submit error:", msg);
    return res.status(500).json({ error: msg });
  }
};
