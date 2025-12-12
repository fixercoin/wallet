import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Import all route handlers
import { handleSolanaRpc } from "./routes/solana-proxy.js";
import { handleWalletBalance } from "./routes/wallet-balance.js";
import { handleExchangeRate } from "./routes/exchange-rate.js";
import {
  handleDexscreenerTokens,
  handleDexscreenerSearch,
  handleDexscreenerTrending,
} from "./routes/dexscreener-proxy.js";
import {
  handleDexscreenerPrice,
  handleSolPrice,
  handleTokenPrice,
} from "./routes/dexscreener-price.js";
import {
  handleCoinMarketCapQuotes,
  handleCoinMarketCapSearch,
} from "./routes/coinmarketcap-proxy.js";
import {
  handleJupiterPrice,
  handleJupiterQuote,
  handleJupiterSwap,
  handleJupiterTokens,
} from "./routes/jupiter-proxy.js";
import { handleForexRate } from "./routes/forex-rate.js";
import { handleStable24h } from "./routes/stable-24h.js";
import { handleDexToolsPrice } from "./routes/dextools-proxy.js";
import {
  handleListTradeRooms,
  handleCreateTradeRoom,
  handleGetTradeRoom,
  handleUpdateTradeRoom,
  handleListTradeMessages,
  handleAddTradeMessage,
} from "./routes/p2p-orders.js";
import {
  handleListOrders,
  handleCreateOrder,
  handleGetOrder,
  handleUpdateOrder,
  handleDeleteOrder,
} from "./routes/orders.js";
import { handleBirdeyePrice } from "./routes/api-birdeye.js";
import {
  handleSwapProxy,
  handleQuoteProxy,
  handleMeteoraQuoteProxy,
  handleMeteoraSwapProxy,
  handleSolanaSendProxy,
  handleSolanaSimulateProxy,
} from "./routes/swap-proxy.js";
import {
  handleSolanaSend,
  handleSolanaSimulate,
} from "./routes/solana-transaction.js";
import { handleUnifiedSwapLocal } from "./routes/swap-handler.js";
import { handleLocalQuote } from "./routes/quote-handler.js";
import { handleSwapQuoteV2, handleSwapExecuteV2 } from "./routes/swap-v2.js";
import { requireApiKey } from "./middleware/auth.js";
import {
  validateSwapRequest,
  validateSolanaSend,
  validateSwapSubmit,
} from "./middleware/validate.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// DexScreener routes
app.get("/api/dexscreener/tokens", async (req, res) => {
  try {
    return await handleDexscreenerTokens(req, res);
  } catch (e) {
    return res.status(502).json({
      error: "DexScreener API error",
      details: e?.message || String(e),
    });
  }
});

app.get("/api/dexscreener/search", async (req, res) => {
  try {
    return await handleDexscreenerSearch(req, res);
  } catch (e) {
    return res.status(502).json({
      error: "DexScreener search failed",
      details: e?.message || String(e),
    });
  }
});

app.get("/api/dexscreener/trending", async (req, res) => {
  try {
    return await handleDexscreenerTrending(req, res);
  } catch (e) {
    return res.status(502).json({
      error: "DexScreener trending failed",
      details: e?.message || String(e),
      message: "Try using /api/quote endpoint instead with specific mints",
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
    const publicKey =
      req.query.publicKey ||
      req.query.wallet ||
      req.query.address ||
      req.query.walletAddress;

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

    const modifiedReq = { ...req, query: { publicKey } };
    handleWalletBalance(modifiedReq, res);
  } catch (e) {
    return res.status(500).json({
      error: "Failed to fetch wallet balance",
      details: e?.message || String(e),
    });
  }
});

// Unified swap & quote endpoints
app.post("/api/swap", validateSwapRequest, handleUnifiedSwapLocal);
app.get("/api/quote", handleLocalQuote);

// New v2 unified swap endpoints with comprehensive fallback chain
app.get("/api/swap/quote", handleSwapQuoteV2);
app.post("/api/swap/execute", handleSwapExecuteV2);

// Keep proxy handlers as fallbacks
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

app.post("/api/swap/submit", requireApiKey, validateSwapSubmit, (req, res) => {
  return handleSolanaSendProxy(req, res);
});

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
    if (path === "//quote" || path === "/quote") {
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
      } catch (err) {
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
      } catch (err) {
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
  } catch (e) {
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
  } catch (e) {
    const isTimeout = e?.name === "AbortError";
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
  } catch (e) {
    const isTimeout = e?.name === "AbortError";
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
  } catch (e) {
    return res.status(502).json({
      error: "Failed to execute trade transaction",
      details: e?.message || String(e),
    });
  }
});

// Token price endpoint
app.get("/api/token/price", async (req, res) => {
  try {
    const tokenParam = String(
      req.query.token || req.query.symbol || "FIXERCOIN",
    ).toUpperCase();
    const mintParam = String(req.query.mint || "");

    const FALLBACK_USD = {
      FIXERCOIN: 0.000056,
      SOL: 149.38,
      USDC: 1.0,
      USDT: 1.0,
      LOCKER: 0.00001112,
    };

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

    const TOKEN_MINTS = {
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

    const fallback = FALLBACK_USD[token] ?? null;
    if (fallback !== null) return res.json({ token, priceUsd: fallback });

    return res.status(404).json({ error: "Token price not available" });
  } catch (e) {
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

// Orders routes
app.get("/api/orders", handleListOrders);
app.post("/api/orders", handleCreateOrder);
app.get("/api/orders/:orderId", handleGetOrder);
app.put("/api/orders/:orderId", handleUpdateOrder);
app.delete("/api/orders/:orderId", handleDeleteOrder);

// P2P Orders routes - DISABLED
app.get("/api/p2p/orders", (req, res) =>
  res.status(410).json({ error: "P2P orders API is disabled on this server" }),
);
app.post("/api/p2p/orders", (req, res) =>
  res.status(410).json({ error: "P2P orders API is disabled on this server" }),
);
app.get("/api/p2p/orders/:orderId", (req, res) =>
  res.status(410).json({ error: "P2P orders API is disabled on this server" }),
);
app.put("/api/p2p/orders/:orderId", (req, res) =>
  res.status(410).json({ error: "P2P orders API is disabled on this server" }),
);
app.delete("/api/p2p/orders/:orderId", (req, res) =>
  res.status(410).json({ error: "P2P orders API is disabled on this server" }),
);

// Trade Rooms routes
app.get("/api/p2p/rooms", handleListTradeRooms);
app.post("/api/p2p/rooms", handleCreateTradeRoom);
app.get("/api/p2p/rooms/:roomId", handleGetTradeRoom);
app.put("/api/p2p/rooms/:roomId", handleUpdateTradeRoom);
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

// Ping endpoint
app.get("/api/ping", (req, res) => {
  res.json({
    status: "pong",
    timestamp: new Date().toISOString(),
  });
});

// Root API endpoint
app.get("/api", (req, res) => {
  res.json({
    status: "ok",
    message: "Fixorium Wallet API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/api/health",
      ping: "/api/ping",
      wallet: "/api/wallet/balance",
      balance: "/api/balance",
      quote: "/api/quote",
      swap: "/api/swap/execute",
      orders: "/api/orders",
    },
  });
});

// Balance endpoint (alias for /api/wallet/balance)
app.get("/api/balance", async (req, res) => {
  try {
    const publicKey =
      req.query.publicKey ||
      req.query.wallet ||
      req.query.address ||
      req.query.walletAddress;

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

    const modifiedReq = { ...req, query: { publicKey } };
    handleWalletBalance(modifiedReq, res);
  } catch (e) {
    return res.status(500).json({
      error: "Failed to fetch wallet balance",
      details: e?.message || String(e),
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "API endpoint not found", path: req.path });
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
