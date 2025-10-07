import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { debugWallet } from "./routes/debug-wallet";
import { handleSolanaRpc } from "./routes/solana-proxy";
import {
  handleWalletBalance,
  handleWalletTokenAccounts,
} from "./routes/wallet";
import { handleWalletTransactions } from "./routes/wallet-transactions";
import {
  handleJupiterPrice,
  handleJupiterTokens,
  handleJupiterQuote,
  handleJupiterSwap,
} from "./routes/jupiter-proxy";
import {
  handleDexscreenerTokens,
  handleDexscreenerSearch,
  handleDexscreenerTrending,
} from "./routes/dexscreener-proxy";

export async function createServer() {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: true, // Allow all origins in development
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check and example API routes
  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Debug endpoint to test RPC connectivity
  app.get("/debug/rpc", async (_req, res) => {
    try {
      const testRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "getHealth",
        params: [],
      };

      const response = await fetch("https://api.mainnet-beta.solana.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testRequest),
      });

      const data = await response.json();

      res.json({
        status: "success",
        response: data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Debug endpoint to test getTokenAccountsByOwner specifically
  app.get("/debug/token-accounts", async (req, res) => {
    try {
      const publicKey =
        (req.query.publicKey as string) ||
        "So11111111111111111111111111111111111111112"; // Default to SOL mint for testing

      const testRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          publicKey,
          {
            programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          },
          {
            encoding: "jsonParsed",
            commitment: "confirmed",
          },
        ],
      };

      console.log(
        "Testing getTokenAccountsByOwner with request:",
        JSON.stringify(testRequest, null, 2),
      );

      const response = await fetch("https://api.mainnet-beta.solana.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testRequest),
      });

      const responseText = await response.text();
      console.log("Raw response:", responseText);

      const data = JSON.parse(responseText);

      res.json({
        status: "success",
        request: testRequest,
        response: data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Debug token accounts error:", error);
      res.status(500).json({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get("/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/demo", handleDemo);
  app.get("/debug-wallet", debugWallet);

  // Solana RPC proxy
  app.post("/solana-rpc", handleSolanaRpc);

  // Server-side API proxies (Moralis, Helius, Dexscreener, Jupiter)
  try {
    const { handleMoralis } = await import("./routes/api-moralis");
    app.all("/api/moralis", handleMoralis);
  } catch (err) {
    console.error("Failed to register /api/moralis route:", err);
  }

  try {
    const { handleHeliusRpc } = await import("./routes/helius-proxy");
    app.all("/api/helius", handleHeliusRpc);
  } catch (err) {
    console.error("Failed to register /api/helius route:", err);
  }

  try {
    const { handleDexscreener } = await import("./routes/api-dexscreener");
    app.all("/api/dexscreener", handleDexscreener);
  } catch (err) {
    console.error("Failed to register /api/dexscreener route:", err);
  }

  try {
    const { handleJupiter } = await import("./routes/api-jupiter");
    app.all("/api/jupiter", handleJupiter);
  } catch (err) {
    console.error("Failed to register /api/jupiter route:", err);
  }

  // Direct transaction submission (server-side) to avoid provider method mismatches
  try {
    const { handleSolanaSend } = await import("./routes/solana-send");
    app.post("/solana-send", handleSolanaSend);
  } catch (err) {
    console.error("Failed to register /api/solana-send route:", err);
  }

  try {
    const { handleSolanaSimulate } = await import("./routes/solana-simulate");
    app.post("/solana-simulate", handleSolanaSimulate);
  } catch (err) {
    console.error("Failed to register /api/solana-simulate route:", err);
  }

  // Jupiter API proxy routes
  app.get("/jupiter/price", handleJupiterPrice);
  app.get("/jupiter/tokens", handleJupiterTokens);
  app.get("/jupiter/quote", handleJupiterQuote);
  app.post("/jupiter/swap", handleJupiterSwap);

  // PumpSwap server-side builder - lazy load the handler per-request to avoid build-time resolution of optional SDK
  app.post("/pumpswap/build", async (req, res, next) => {
    try {
      const { buildPumpSwap } = await import("./routes/pumpswap");
      return buildPumpSwap(req, res, next);
    } catch (err) {
      console.error("Failed to load PumpSwap builder module:", err);
      return res
        .status(500)
        .json({ error: "PumpSwap builder unavailable on server" });
    }
  });

  // PumpSwap quote endpoint
  app.post("/pumpswap/quote", async (req, res, next) => {
    try {
      const { getPumpQuote } = await import("./routes/pumpswap-quote");
      return getPumpQuote(req, res, next);
    } catch (err) {
      console.error("Failed to load PumpSwap quote module:", err);
      return res
        .status(500)
        .json({ error: "PumpSwap quote unavailable on server" });
    }
  });

  // Wallet convenience routes (RPC-based)
  app.get("/wallet/balance", handleWalletBalance);
  app.get("/wallet/token-accounts", handleWalletTokenAccounts);
  app.get("/wallet/transactions", handleWalletTransactions);

  // DexScreener API proxy routes
  app.get("/dexscreener/tokens", handleDexscreenerTokens);
  app.get("/dexscreener/search", handleDexscreenerSearch);
  app.get("/dexscreener/trending", handleDexscreenerTrending);

  return app;
}
