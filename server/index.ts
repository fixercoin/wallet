import cors from "cors";
import express from "express";
import { handleSolanaRpc } from "./routes/solana-proxy";
import { handleWalletBalance } from "./routes/wallet-balance";
import { handleExchangeRate } from "./routes/exchange-rate";
import {
  handleDexscreenerTokens,
  handleDexscreenerSearch,
  handleDexscreenerTrending,
} from "./routes/dexscreener-proxy";
import {
  handleDexscreenerPrice,
  handleSolPrice,
  handleTokenPrice,
} from "./routes/dexscreener-price";
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
import { handleBirdeyePrice } from "./routes/api-birdeye";
import {
  handleSwapProxy,
  handleQuoteProxy,
  handleMeteoraQuoteProxy,
  handleMeteoraSwapProxy,
  handleSolanaSendProxy,
  handleSolanaSimulateProxy,
} from "./routes/swap-proxy";
import {
  handleSolanaSend,
  handleSolanaSimulate,
} from "./routes/solana-transaction";
import { handleUnifiedSwapLocal } from "./routes/swap-handler";
import { handleLocalQuote } from "./routes/quote-handler";
import { handleSwapQuoteV2, handleSwapExecuteV2 } from "./routes/swap-v2";
import { requireApiKey } from "./middleware/auth";
import {
  validateSwapRequest,
  validateSolanaSend,
  validateSwapSubmit,
} from "./middleware/validate";

export async function createServer(): Promise<express.Application> {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // DexScreener routes
  app.get("/api/dexscreener/tokens", async (req, res) => {
    try {
      return await handleDexscreenerTokens(req, res);
    } catch (e: any) {
      return res.status(502).json({
        error: "DexScreener API error",
        details: e?.message || String(e),
      });
    }
  });

  app.get("/api/dexscreener/search", async (req, res) => {
    try {
      return await handleDexscreenerSearch(req, res);
    } catch (e: any) {
      return res.status(502).json({
        error: "DexScreener search failed",
        details: e?.message || String(e),
      });
    }
  });

  app.get("/api/dexscreener/trending", async (req, res) => {
    try {
      return await handleDexscreenerTrending(req, res);
    } catch (e: any) {
      return res.status(502).json({
        error: "DexScreener trending failed",
        details: e?.message || String(e),
        message:
          "Try using /api/quote endpoint instead with specific mints",
      });
    }
  });

  app.get("/api/dexscreener/price", handleDexscreenerPrice);

  // Price routes
  app.get("/api/sol/price", handleSolPrice);
  app.get("/api/token/price", handleTokenPrice);

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

  // Birdeye routes
  app.get("/api/birdeye/price", handleBirdeyePrice);

  // Solana RPC proxy - with proper error handling
  app.post("/api/solana-rpc", (req, res) => {
    // Ensure body is parsed JSON
    if (
      !req.body ||
      typeof req.body !== "object" ||
      !req.body.method ||
      !req.body.params
    ) {
      return res.status(400).json({
        error: "Invalid JSON-RPC request",
        message: "Provide method and params in JSON body",
        example: {
          jsonrpc: "2.0",
          id: 1,
          method: "getBalance",
          params: ["11111111111111111111111111111111"],
        },
      });
    }

    handleSolanaRpc(req, res);
  });

  // Wallet routes - also supports walletAddress alias
  app.get("/api/wallet/balance", async (req, res) => {
    try {
      // Support walletAddress as an alias for publicKey
      const publicKey =
        (req.query.publicKey as string) ||
        (req.query.wallet as string) ||
        (req.query.address as string) ||
        (req.query.walletAddress as string);

      if (!publicKey || typeof publicKey !== "string") {
        return res.status(400).json({
          error: "Missing or invalid wallet address parameter",
          examples: [
            "?publicKey=...",
            "?wallet=...",
            "?address=...",
            "?walletAddress=...",
          ],
        });
      }

      // Create a modified request object
      const modifiedReq = { ...req, query: { publicKey } };
      handleWalletBalance(modifiedReq as any, res);
    } catch (e: any) {
      return res.status(500).json({
        error: "Failed to fetch wallet balance",
        details: e?.message || String(e),
      });
    }
  });

  // Unified swap & quote proxies (forward to Fixorium worker or configured API)
  // Local handler: attempt Meteora swap locally first to avoid dependency on remote worker

  // Local unified swap endpoint (build unsigned swap). Validate payload.
  app.post("/api/swap", validateSwapRequest, handleUnifiedSwapLocal);

  // Local quote handler (preferred over external worker)
  app.get("/api/quote", handleLocalQuote);

  // New v2 unified swap endpoints with comprehensive fallback chain
  app.get("/api/swap/quote", handleSwapQuoteV2);
  app.post("/api/swap/execute", handleSwapExecuteV2);

  // Keep proxy handlers as fallbacks (registered after local handler if needed)
  app.get("/api/swap/meteora/quote", handleMeteoraQuoteProxy);
  app.post("/api/swap/meteora/swap", handleMeteoraSwapProxy);

  // Protect endpoints that accept signed txns or submit to RPC with API key + validation
  app.post(
    "/api/solana-send",
    requireApiKey,
    validateSolanaSend,
    handleSolanaSend,
  );
  app.post(
    "/api/solana-simulate",
    requireApiKey,
    validateSolanaSend,
    handleSolanaSimulate,
  );

  // POST /api/swap/submit - require API key and validate
  app.post(
    "/api/swap/submit",
    requireApiKey,
    validateSwapSubmit,
    (req, res) => {
      // forward to proxy handler which calls RPC; reuse handleSolanaSendProxy logic by adapting body
      return handleSolanaSendProxy(req, res as any);
    },
  );

  // Proxy for /api/swap to worker (fallback) - registered last (protected by API key when forwarding sensitive actions)
  app.post(
    "/api/swap/proxy",
    requireApiKey,
    validateSwapRequest,
    handleSwapProxy,
  );

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
          return res.status(400).json({
            error: "Missing required parameters: inputMint, outputMint, amount",
          });
        }

        const url = `https://api.pumpfun.com/api/v1/quote?input_mint=${encodeURIComponent(
          inputMint,
        )}&output_mint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const resp = await fetch(url, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!resp.ok)
            return res.status(resp.status).json({
              error: "Pumpfun API error",
              status: resp.status,
            });
          const data = await resp.json();
          return res.json(data);
        } catch (err: any) {
          clearTimeout(timeout);
          if (err?.name === "AbortError") {
            return res.status(504).json({
              error: "Pumpfun API timeout",
              message: "Request took too long to complete",
            });
          }
          throw err;
        }
      }

      if (path === "//swap" || path === "/swap") {
        if (req.method !== "POST")
          return res.status(405).json({ error: "Method not allowed" });
        const body = req.body || {};

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
          const resp = await fetch("https://api.pumpfun.com/api/v1/swap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!resp.ok)
            return res.status(resp.status).json({ error: "Pumpfun swap failed" });
          const data = await resp.json();
          return res.json(data);
        } catch (err: any) {
          clearTimeout(timeout);
          if (err?.name === "AbortError") {
            return res.status(504).json({
              error: "Pumpfun API timeout",
              message: "Request took too long to complete",
            });
          }
          throw err;
        }
      }

      return res.status(404).json({ error: "Pumpfun proxy path not found" });
    } catch (e: any) {
      return res.status(502).json({
        error: "Failed to proxy Pumpfun request",
        details: e?.message || String(e),
      });
    }
  });

  // Pumpfun buy: /api/pumpfun/buy (POST)
  app.post("/api/pumpfun/buy", async (req, res) => {
    try {
      const body = req.body || {};
      const {
        mint,
        amount,
        buyer,
        slippageBps = 350,
        priorityFeeLamports = 10000,
      } = body;

      if (!mint || amount === undefined || !buyer) {
        return res.status(400).json({
          error: "Missing required fields: mint, amount, buyer",
        });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const resp = await fetch("https://pumpportal.fun/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint,
          amount: String(amount),
          buyer,
          slippageBps,
          priorityFeeLamports,
          txVersion: "V0",
          operation: "buy",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => "");
        return res.status(resp.status).json({
          error: "Pump.fun API error",
          details: errorText,
        });
      }

      const data = await resp.json();
      return res.json(data);
    } catch (e: any) {
      const isTimeout = (e as any)?.name === "AbortError";
      return res.status(isTimeout ? 504 : 502).json({
        error: "Failed to request BUY transaction",
        details: isTimeout
          ? "Request timeout - Pump.fun API took too long to respond"
          : e?.message || String(e),
      });
    }
  });

  // Pumpfun sell: /api/pumpfun/sell (POST)
  app.post("/api/pumpfun/sell", async (req, res) => {
    try {
      const body = req.body || {};
      const {
        mint,
        amount,
        seller,
        slippageBps = 350,
        priorityFeeLamports = 10000,
      } = body;

      if (!mint || amount === undefined || !seller) {
        return res.status(400).json({
          error: "Missing required fields: mint, amount, seller",
        });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const resp = await fetch("https://pumpportal.fun/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint,
          amount: String(amount),
          seller,
          slippageBps,
          priorityFeeLamports,
          txVersion: "V0",
          operation: "sell",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => "");
        return res.status(resp.status).json({
          error: "Pump.fun API error",
          details: errorText,
        });
      }

      const data = await resp.json();
      return res.json(data);
    } catch (e: any) {
      const isTimeout = (e as any)?.name === "AbortError";
      return res.status(isTimeout ? 504 : 502).json({
        error: "Failed to request SELL transaction",
        details: isTimeout
          ? "Request timeout - Pump.fun API took too long to respond"
          : e?.message || String(e),
      });
    }
  });

  // Pumpfun trade: /api/pumpfun/trade (POST) - unified trade endpoint
  app.post("/api/pumpfun/trade", async (req, res) => {
    try {
      const body = req.body || {};
      const { mint, amount, trader, action } = body;

      if (!mint || typeof amount !== "number" || !trader) {
        return res.status(400).json({
          error: "Missing required fields: mint, amount (number), trader",
        });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const tradeAction = String(action || "buy").toLowerCase();
      const endpoint =
        tradeAction === "sell"
          ? "https://pump.fun/api/sell"
          : "https://pump.fun/api/trade";
      const payloadKey = tradeAction === "sell" ? "seller" : "buyer";

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint,
          amount,
          [payloadKey]: trader,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => "");
        return res.status(resp.status).json({
          error: "Pump.fun API error",
          details: errorText,
        });
      }

      const data = await resp.json();
      return res.json(data);
    } catch (e: any) {
      return res.status(502).json({
        error: "Failed to execute trade transaction",
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
        FIXERCOIN: 0.00008139, // Real-time market price
        SOL: 149.38, // Real-time market price
        USDC: 1.0,
        USDT: 1.0,
        LOCKER: 0.00001112, // Real-time market price
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
      return res.status(502).json({
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
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: "server",
      uptime: process.uptime(),
    });
  });

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: "server",
      uptime: process.uptime(),
    });
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
