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
