import { RequestHandler } from "express";

const JUPITER_BASE = process.env.JUPITER_BASE || "https://quote-api.jup.ag";
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || "";

export const handleJupiter: RequestHandler = async (req, res) => {
  try {
    const path = (req.query.path as string) || req.body?.path;
    if (!path) return res.status(400).json({ error: "Missing path parameter" });

    const url = `${JUPITER_BASE}/${path.replace(/^\//, "")}`;

    const headers: any = { "Content-Type": "application/json" };
    if (JUPITER_API_KEY) headers["x-api-key"] = JUPITER_API_KEY;

    const options: any = { method: req.method, headers };
    if (req.method !== "GET") {
      options.body = JSON.stringify(req.body?.body ?? req.body ?? {});
    }

    const response = await fetch(url, options);
    const text = await response.text().catch(() => "");
    res.set("Cache-Control", "public, max-age=10, stale-while-revalidate=60");

    try {
      const json = text ? JSON.parse(text) : {};
      return res.status(response.status).json(json);
    } catch (e) {
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error("Jupiter proxy error:", error);
    return res.status(500).json({ error: String(error) });
  }
};
