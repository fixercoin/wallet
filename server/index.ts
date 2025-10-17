import express from "express";
import cors from "cors";
import { handleSolanaRpc } from "./routes/solana-proxy";
import {
  handleDexscreenerTokens,
  handleDexscreenerSearch,
  handleDexscreenerTrending,
} from "./routes/dexscreener-proxy";
import {
  handleJupiterPrice,
  handleJupiterQuote,
  handleJupiterSwap,
} from "./routes/jupiter-proxy";
import {
  handleWalletBalance,
  handleWalletTokenAccounts,
} from "./routes/wallet";

export async function createServer(): Promise<express.Application> {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // DexScreener routes
  app.get("/dexscreener/tokens", handleDexscreenerTokens);
  app.get("/dexscreener/search", handleDexscreenerSearch);
  app.get("/dexscreener/trending", handleDexscreenerTrending);

  // Jupiter routes
  app.get("/jupiter/price", handleJupiterPrice);
  app.get("/jupiter/quote", handleJupiterQuote);
  app.post("/jupiter/swap", handleJupiterSwap);

  // Solana RPC proxy
  app.post("/solana-rpc", handleSolanaRpc);
  // Also expose API-prefixed route so client calling /api/* works (used by embedded pages)
  app.post("/api/solana-rpc", handleSolanaRpc);

  // Wallet endpoints (API prefix)
  app.get("/api/wallet/balance", async (req, res) => {
    const publicKey = String(req.query.publicKey || "");
    if (!publicKey) {
      return res.status(400).json({ error: "publicKey query param required" });
    }
    try {
      const data = await handleWalletBalance(publicKey);
      return res.json(data);
    } catch (err) {
      console.error("Error in /api/wallet/balance:", err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/wallet/token-accounts", async (req, res) => {
    const publicKey = String(req.query.publicKey || "");
    if (!publicKey) {
      return res.status(400).json({ error: "publicKey query param required" });
    }
    try {
      const data = await handleWalletTokenAccounts(publicKey);
      return res.json(data);
    } catch (err) {
      console.error("Error in /api/wallet/token-accounts:", err);
      return res.status(500).json({ error: String(err) });
    }
  });

  // Health check
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Binance P2P proxy: handle /api/binance/p2p and /api/binance-p2p/*
  const BINANCE_P2P_ENDPOINTS = [
    "https://p2p.binance.com",
    "https://c2c.binance.com",
    "https://www.binance.com",
  ];

  app.all(
    ["/api/binance/p2p", "/api/binance/p2p/*", "/api/binance-p2p/*"],
    async (req, res) => {
      const incomingPath = req.path.replace(/^\/api/, "");
      // normalize to leading slash path to append to base
      const subPath = incomingPath.replace(/^(?:\/binance|\/api)?/, "");
      const search = req.url.includes("?")
        ? req.url.slice(req.url.indexOf("?"))
        : "";

      const requestBody =
        req.method !== "GET" && req.method !== "HEAD"
          ? JSON.stringify(req.body || {})
          : undefined;

      const ua =
        req.headers["user-agent"] ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
      const traceId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const deviceInfo = Buffer.from(
        JSON.stringify({ userAgent: ua }),
      ).toString("base64");

      const baseHeaders: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": Array.isArray(ua) ? ua[0] : String(ua),
        clienttype: "web",
        "cache-control": "no-cache",
        Origin: "https://p2p.binance.com",
        Referer: "https://p2p.binance.com/en",
        lang: "en",
        platform: "web",
        "Accept-Language": "en-US,en;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
        "X-Trace-Id": traceId,
        "device-info": deviceInfo,
        "bnc-uuid": traceId,
        "bnc-visit-id": `${Math.floor(Date.now() / 1000)}`,
        csrftoken: traceId,
        "X-CSRF-TOKEN": traceId,
        timezone: "UTC",
      };

      let lastErr = null;
      for (const base of BINANCE_P2P_ENDPOINTS) {
        const target = `${base}${subPath}${search}`;
        try {
          const init: any = {
            method: req.method,
            headers: baseHeaders,
            redirect: "follow",
          };
          if (requestBody !== undefined) init.body = requestBody;
          const resp = await fetch(target, init);
          const text = await resp.text();
          if (!resp.ok) {
            // retry for 403/429/5xx
            if (
              resp.status === 403 ||
              resp.status === 429 ||
              resp.status >= 500
            ) {
              lastErr = `HTTP ${resp.status} ${resp.statusText}`;
              continue;
            }
            return res
              .status(resp.status)
              .json({ error: text || resp.statusText });
          }
          const contentType = resp.headers.get("content-type") || "text/plain";
          if (contentType.includes("application/json")) {
            try {
              const json = JSON.parse(text || "{}");
              return res.status(200).json(json);
            } catch (e) {
              return res.status(200).send(text);
            }
          }
          res.setHeader("Content-Type", contentType);
          return res.status(200).send(text);
        } catch (e: any) {
          lastErr = e?.message || String(e);
          continue;
        }
      }

      // All endpoints failed
      return res
        .status(502)
        .json({ error: "All Binance P2P endpoints failed", details: lastErr });
    },
  );

  // Binance API proxy: /api/binance/* -> https://api.binance.com
  const BINANCE_API_ENDPOINTS = [
    "https://api.binance.com",
    "https://api1.binance.com",
    "https://api2.binance.com",
    "https://api3.binance.com",
  ];

  app.all(["/api/binance/*", "/api/binance"], async (req, res) => {
    const incomingPath = req.path.replace(/^\/api\/binance/, "") || "/";
    const search = req.url.includes("?")
      ? req.url.slice(req.url.indexOf("?"))
      : "";

    const bodyText =
      req.method !== "GET" && req.method !== "HEAD"
        ? JSON.stringify(req.body || {})
        : undefined;

    let lastErr = null;
    for (const base of BINANCE_API_ENDPOINTS) {
      const target = `${base}${incomingPath}${search}`;
      try {
        const resp = await fetch(target, {
          method: req.method,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
          },
          body: bodyText,
        });
        const text = await resp.text();
        if (!resp.ok) {
          if (resp.status === 429 || resp.status >= 500) {
            lastErr = `HTTP ${resp.status} ${resp.statusText}`;
            continue;
          }
          return res
            .status(resp.status)
            .json({ error: text || resp.statusText });
        }
        const contentType = resp.headers.get("content-type") || "text/plain";
        if (contentType.includes("application/json")) {
          return res.status(200).json(JSON.parse(text || "{}"));
        }
        res.setHeader("Content-Type", contentType);
        return res.status(200).send(text);
      } catch (e: any) {
        lastErr = e?.message || String(e);
        continue;
      }
    }

    return res
      .status(502)
      .json({ error: "All Binance endpoints failed", details: lastErr });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: "API endpoint not found", path: req.path });
  });

  return app;
}

// Cloudflare Workers compatibility export
export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/api/solana-rpc")) {
      return await handleSolanaRpc(req as any);
    }

    return new Response("Wallet backend active", { status: 200 });
  },
};
