import { RequestHandler } from "express";

const WORKER_BASE = (
  process.env.PROXY_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  ""
).trim();

async function forwardRequest(path: string, req: any) {
  const url = `${WORKER_BASE.replace(/\/+$/, "")}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const headers: any = {};
    if (req.headers && req.headers["content-type"])
      headers["Content-Type"] = req.headers["content-type"];
    // Forward body for POST/PUT
    const options: any = {
      method: req.method,
      headers,
      signal: controller.signal,
    };
    if (req.method !== "GET" && req.body) {
      options.body = JSON.stringify(req.body);
    }
    const resp = await fetch(url, options as any);
    clearTimeout(timeout);
    const contentType = resp.headers.get("content-type") || "";
    const text = await resp.text();
    if (contentType.includes("application/json")) {
      try {
        return { status: resp.status, body: JSON.parse(text) };
      } catch (e) {
        return { status: resp.status, body: text };
      }
    }
    return { status: resp.status, body: text };
  } catch (e: any) {
    clearTimeout(timeout);
    throw e;
  }
}

export const handleSwapProxy: RequestHandler = async (req, res) => {
  if (!WORKER_BASE) {
    return res.status(501).json({ error: "Worker proxy disabled" });
  }
  try {
    const path = "/api/swap";
    const result = await forwardRequest(path, req);
    return res.status(result.status).send(result.body);
  } catch (e: any) {
    console.error("Swap proxy error:", e?.message || e);
    return res.status(502).json({
      error: "Failed to proxy swap request",
      details: e?.message || String(e),
    });
  }
};

export const handleQuoteProxy: RequestHandler = async (req, res) => {
  if (!WORKER_BASE) {
    return res.status(501).json({ error: "Worker proxy disabled" });
  }
  try {
    const qs = req.originalUrl.replace(/^[^?]+/, ""); // keep querystring
    const path = `/api/quote${qs}`;
    const result = await forwardRequest(path, req);
    return res.status(result.status).send(result.body);
  } catch (e: any) {
    console.error("Quote proxy error:", e?.message || e);
    return res.status(502).json({
      error: "Failed to proxy quote request",
      details: e?.message || String(e),
    });
  }
};

export const handleMeteoraQuoteProxy: RequestHandler = async (req, res) => {
  if (!WORKER_BASE) {
    return res.status(501).json({ error: "Worker proxy disabled" });
  }
  try {
    const qs = req.originalUrl.replace(/^[^?]+/, "");
    const path = `/api/swap/meteora/quote${qs}`;
    const result = await forwardRequest(path, req);
    return res.status(result.status).send(result.body);
  } catch (e: any) {
    console.error("Meteora quote proxy error:", e?.message || e);
    return res.status(502).json({
      error: "Failed to proxy meteora quote",
      details: e?.message || String(e),
    });
  }
};

export const handleMeteoraSwapProxy: RequestHandler = async (req, res) => {
  if (!WORKER_BASE) {
    return res.status(501).json({ error: "Worker proxy disabled" });
  }
  try {
    const path = "/api/swap/meteora/swap";
    const result = await forwardRequest(path, req);
    return res.status(result.status).send(result.body);
  } catch (e: any) {
    console.error("Meteora swap proxy error:", e?.message || e);
    return res.status(502).json({
      error: "Failed to proxy meteora swap",
      details: e?.message || String(e),
    });
  }
};

export const handleSolanaSendProxy: RequestHandler = async (req, res) => {
  if (!WORKER_BASE) {
    return res.status(501).json({ error: "Worker proxy disabled" });
  }
  try {
    const path = "/api/solana-send";
    const result = await forwardRequest(path, req);
    return res.status(result.status).send(result.body);
  } catch (e: any) {
    console.error("Solana send proxy error:", e?.message || e);
    return res.status(502).json({
      error: "Failed to proxy solana-send",
      details: e?.message || String(e),
    });
  }
};

export const handleSolanaSimulateProxy: RequestHandler = async (req, res) => {
  if (!WORKER_BASE) {
    return res.status(501).json({ error: "Worker proxy disabled" });
  }
  try {
    const path = "/api/solana-simulate";
    const result = await forwardRequest(path, req);
    return res.status(result.status).send(result.body);
  } catch (e: any) {
    console.error("Solana simulate proxy error:", e?.message || e);
    return res.status(502).json({
      error: "Failed to proxy solana-simulate",
      details: e?.message || String(e),
    });
  }
};
