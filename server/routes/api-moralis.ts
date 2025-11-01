import { RequestHandler } from "express";

const DEFAULT_MORALIS_BASE = "https://deep-index.moralis.io/api/v2";

const resolveMoralisConfig = () => {
  const base = String(process?.env?.MORALIS_API_BASE ?? "").trim();
  const key = String(process?.env?.MORALIS_API_KEY ?? "").trim();
  return {
    base: base || DEFAULT_MORALIS_BASE,
    key,
  };
};

export const handleMoralis: RequestHandler = async (req, res) => {
  try {
    const method = (req.method || "GET").toUpperCase();
    // Accept either a `path` query param or a JSON body { path, params }
    const path = (req.query.path as string) || req.body?.path;
    if (!path) return res.status(400).json({ error: "Missing path parameter" });

    const { base, key } = resolveMoralisConfig();
    const url = `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (key) headers["X-API-Key"] = key;

    const options: any = {
      method,
      headers,
    };

    if (method !== "GET") {
      options.body = JSON.stringify(req.body?.body ?? req.body ?? {});
    }

    const response = await fetch(
      url + (req.query.qs ? `?${String(req.query.qs)}` : ""),
      options,
    );
    const text = await response.text().catch(() => "");

    res.set("Cache-Control", "public, max-age=15, stale-while-revalidate=60");
    try {
      const json = text ? JSON.parse(text) : {};
      return res.status(response.status).json(json);
    } catch (e) {
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error("Moralis proxy error:", error);
    return res.status(500).json({ error: String(error) });
  }
};
