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
  handleListP2POrders,
  handleCreateP2POrder,
  handleGetP2POrder,
  handleUpdateP2POrder,
  handleDeleteP2POrder,
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
