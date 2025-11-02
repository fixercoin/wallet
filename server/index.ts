import express from "express";
import cors from "cors";
import { handleSolanaRpc } from "./routes/solana-proxy";
import { handleWalletBalance } from "./routes/wallet-balance";
import { handleExchangeRate } from "./routes/exchange-rate";
import {
  handleDexscreenerTokens,
  handleDexscreenerSearch,
  handleDexscreenerTrending,
} from "./routes/dexscreener-proxy";
import {
  handleCoinMarketCapQuotes,
  handleCoinMarketCapSearch,
} from "./routes/coinmarketcap-proxy";
import {
  handleJupiterPrice,
  handleJupiterQuote,
  handleJupiterSwap,
  handleJupiterTokens,
} from "./routes/jupiter-proxy";
import { handleForexRate } from "./routes/forex-rate";
import { handleStable24h } from "./routes/stable-24h";
import { handleDexToolsPrice } from "./routes/dextools-proxy";
import {
  handleListTradeRooms,
  handleCreateTradeRoom,
  handleGetTradeRoom,
  handleUpdateTradeRoom,
  handleListTradeMessages,
  handleAddTradeMessage,
} from "./routes/p2p-orders";
import {
  handleListOrders,
  handleCreateOrder,
  handleGetOrder,
  handleUpdateOrder,
  handleDeleteOrder,
} from "./routes/orders";

export async function createServer(): Promise<express.Application> {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // DexScreener routes
  app.get("/api/dexscreener/tokens", handleDexscreenerTokens);
  app.get("/api/dexscreener/search", handleDexscreenerSearch);
  app.get("/api/dexscreener/trending", handleDexscreenerTrending);

  // CoinMarketCap routes
  app.get("/api/coinmarketcap/quotes", handleCoinMarketCapQuotes);
  app.get("/api/coinmarketcap/search", handleCoinMarketCapSearch);

  // DexTools routes
  app.get("/api/dextools/price", handleDexToolsPrice);

  // Jupiter routes
  app.get("/api/jupiter/price", handleJupiterPrice);
  app.get("/api/jupiter/quote", handleJupiterQuote);
  app.post("/api/jupiter/swap", handleJupiterSwap);
  app.get("/api/jupiter/tokens", handleJupiterTokens);

  // Solana RPC proxy
  app.post("/api/solana-rpc", handleSolanaRpc);

  // Wallet routes
  app.get("/api/wallet/balance", handleWalletBalance);

  // Pumpfun proxy (quote & swap)
  app.all(["/api/pumpfun/quote", "/api/pumpfun/swap"], async (req, res) => {
    try {
      const path = req.path.replace("/api/pumpfun", "");
      // /quote or /swap
      if (path === "//quote" || path === "/quote") {
        // Accept POST with JSON body or GET with query params
        const method = req.method.toUpperCase();
        let inputMint = "";
        let outputMint = "";
        let amount = "";

        if (method === "POST") {
          const body = req.body || {};
          inputMint = body.inputMint || body.input_mint || "";
          outputMint = body.outputMint || body.output_mint || "";
          amount = body.amount || "";
        } else {
          inputMint = String(req.query.inputMint || req.query.input_mint || "");
          outputMint = String(
            req.query.outputMint || req.query.output_mint || "",
          );
          amount = String(req.query.amount || "");
        }

        if (!inputMint || !outputMint || !amount) {
          return res
            .status(400)
            .json({
              error:
                "Missing required parameters: inputMint, outputMint, amount",
            });
        }

        const url = `https://api.pumpfun.com/api/v1/quote?input_mint=${encodeURIComponent(
          inputMint,
        )}&output_mint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok)
          return res.status(resp.status).json({ error: "Pumpfun API error" });
        const data = await resp.json();
        return res.json(data);
      }

      if (path === "//swap" || path === "/swap") {
        if (req.method !== "POST")
          return res.status(405).json({ error: "Method not allowed" });
        const body = req.body || {};
        const resp = await fetch("https://api.pumpfun.com/api/v1/swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resp.ok)
          return res.status(resp.status).json({ error: "Pumpfun swap failed" });
        const data = await resp.json();
        return res.json(data);
      }

      return res.status(404).json({ error: "Pumpfun proxy path not found" });
    } catch (e: any) {
      return res
        .status(502)
        .json({
          error: "Failed to proxy Pumpfun request",
          details: e?.message || String(e),
        });
    }
  });

  // Token price endpoint (simple, robust fallback + stablecoins)
  app.get("/api/token/price", async (req, res) => {
    try {
      const tokenParam = String(
        req.query.token || req.query.symbol || "FIXERCOIN",
      ).toUpperCase();
      const mintParam = String(req.query.mint || "");

      const FALLBACK_USD: Record<string, number> = {
        FIXERCOIN: 0.005,
        SOL: 180,
        USDC: 1.0,
        USDT: 1.0,
        LOCKER: 0.1,
      };

      // If stablecoins or known symbols, return deterministic prices
      if (tokenParam === "USDC" || tokenParam === "USDT") {
        return res.json({ token: tokenParam, priceUsd: 1.0 });
      }

      if (tokenParam === "SOL")
        return res.json({ token: "SOL", priceUsd: FALLBACK_USD.SOL });
      if (tokenParam === "FIXERCOIN")
        return res.json({
          token: "FIXERCOIN",
          priceUsd: FALLBACK_USD.FIXERCOIN,
        });
      if (tokenParam === "LOCKER")
        return res.json({ token: "LOCKER", priceUsd: FALLBACK_USD.LOCKER });

      // If mint provided that matches known mints, map to fallback
      const TOKEN_MINTS: Record<string, string> = {
        SOL: "So11111111111111111111111111111111111111112",
        USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
        FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
        LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
      };

      let token = tokenParam;
      let mint = mintParam || TOKEN_MINTS[token] || "";

      if (!mint && tokenParam && tokenParam.length > 40) {
        mint = tokenParam;
        const inv = Object.entries(TOKEN_MINTS).find(([, m]) => m === mint);
        if (inv) token = inv[0];
      }

      // As a robust fallback, if we couldn't resolve, return fallback USD when available
      const fallback = FALLBACK_USD[token] ?? null;
      if (fallback !== null) return res.json({ token, priceUsd: fallback });

      // Last resort
      return res.status(404).json({ error: "Token price not available" });
    } catch (e: any) {
      return res
        .status(502)
        .json({
          error: "Failed to fetch token price",
          details: e?.message || String(e),
        });
    }
  });

  // Exchange rate routes
  app.get("/api/exchange-rate", handleExchangeRate);
  app.get("/api/forex/rate", handleForexRate);
  app.get("/api/stable-24h", handleStable24h);

  // Orders routes (new API)
  app.get("/api/orders", handleListOrders);
  app.post("/api/orders", handleCreateOrder);
  app.get("/api/orders/:orderId", handleGetOrder);
  app.put("/api/orders/:orderId", handleUpdateOrder);
  app.delete("/api/orders/:orderId", handleDeleteOrder);

  // P2P Orders routes (legacy API) - DISABLED
  // These legacy endpoints are intentionally disabled to stop P2P order handling from this setup.
  // Keeping explicit disabled handlers so callers receive a clear 410 Gone response.
  app.get("/api/p2p/orders", (req, res) =>
    res
      .status(410)
      .json({ error: "P2P orders API is disabled on this server" }),
  );
  app.post("/api/p2p/orders", (req, res) =>
    res
      .status(410)
      .json({ error: "P2P orders API is disabled on this server" }),
  );
  app.get("/api/p2p/orders/:orderId", (req, res) =>
    res
      .status(410)
      .json({ error: "P2P orders API is disabled on this server" }),
  );
  app.put("/api/p2p/orders/:orderId", (req, res) =>
    res
      .status(410)
      .json({ error: "P2P orders API is disabled on this server" }),
  );
  app.delete("/api/p2p/orders/:orderId", (req, res) =>
    res
      .status(410)
      .json({ error: "P2P orders API is disabled on this server" }),
  );

  // Trade Rooms routes
  app.get("/api/p2p/rooms", handleListTradeRooms);
  app.post("/api/p2p/rooms", handleCreateTradeRoom);
  app.get("/api/p2p/rooms/:roomId", handleGetTradeRoom);
  app.put("/api/p2p/rooms/:roomId", handleUpdateTradeRoom);

  // Trade Messages routes
  app.get("/api/p2p/rooms/:roomId/messages", handleListTradeMessages);
  app.post("/api/p2p/rooms/:roomId/messages", handleAddTradeMessage);

  // Health check
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
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
