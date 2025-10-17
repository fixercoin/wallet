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
import { handleWalletBalance, handleWalletTokenAccounts } from "./routes/wallet";

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
