import { Router } from "itty-router";
import type { RequestHandler } from "express";
import { Buffer } from "buffer";

import {
  createOptionsHandler,
  createWorkerHandler,
} from "./worker/express-adapter";
import { handleDemo } from "../server/routes/demo";
import { debugWallet } from "../server/routes/debug-wallet";
import { handleSolanaRpc } from "../server/routes/solana-proxy";
import {
  handleWalletBalance,
  handleWalletTokenAccounts,
} from "../server/routes/wallet";
import { handleWalletTransactions } from "../server/routes/wallet-transactions";
import {
  handleJupiterPrice,
  handleJupiterTokens,
  handleJupiterQuote,
  handleJupiterSwap,
} from "../server/routes/jupiter-proxy";
import {
  handleDexscreenerTokens,
  handleDexscreenerSearch,
  handleDexscreenerTrending,
} from "../server/routes/dexscreener-proxy";
import { handleMoralis } from "../server/routes/api-moralis";
import { handleHeliusRpc } from "../server/routes/helius-proxy";
import { handleDexscreener } from "../server/routes/api-dexscreener";
import { handleJupiter } from "../server/routes/api-jupiter";
import { handleSolanaSend } from "../server/routes/solana-send";
import { handleSolanaSimulate } from "../server/routes/solana-simulate";
import { buildPumpSwap } from "../server/routes/pumpswap";
import { getPumpQuote } from "../server/routes/pumpswap-quote";

interface EnvBindings {
  ASSETS?: { fetch(request: Request): Promise<Response> };
  [key: string]: unknown;
}

const startTime = Date.now();
const globalProcess = (globalThis as any).process ?? {};
(globalThis as any).process = {
  ...globalProcess,
  env: globalProcess.env ?? {},
  uptime: () => (Date.now() - startTime) / 1000,
};

if (typeof (globalThis as any).Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}

const corsOptions = {
  corsOrigin: "*",
  corsMethods: "GET,POST,PUT,DELETE,OPTIONS",
  corsHeaders: "Content-Type,Authorization,X-Requested-With",
};

const route = (handler: RequestHandler) =>
  createWorkerHandler(handler, corsOptions);
const handleOptions = createOptionsHandler(corsOptions);
const router = Router();

const handleHealth: RequestHandler = (_req, res) => {
  const uptime = (globalThis as any).process?.uptime?.() ?? 0;
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime,
  });
};

const handleDebugRpc: RequestHandler = async (_req, res) => {
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
};

const handleDebugTokenAccounts: RequestHandler = async (req, res) => {
  try {
    const publicKey =
      (req.query?.publicKey as string) ||
      "So11111111111111111111111111111111111111112";

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

    const response = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testRequest),
    });

    const rawResponse = await response.text();
    const data = JSON.parse(rawResponse);

    res.json({
      status: "success",
      request: testRequest,
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
};

const handlePing: RequestHandler = (_req, res) => {
  const message = (globalThis as any).process?.env?.PING_MESSAGE ?? "ping";
  res.json({ message });
};

router.options("*", handleOptions);

router.get("/health", route(handleHealth));
router.get("/debug/rpc", route(handleDebugRpc));
router.get("/debug/token-accounts", route(handleDebugTokenAccounts));
router.get("/ping", route(handlePing));

router.get("/demo", route(handleDemo));
router.get("/debug-wallet", route(debugWallet));
router.post("/solana-rpc", route(handleSolanaRpc));

router.all("/api/moralis", route(handleMoralis));
router.all("/api/helius", route(handleHeliusRpc));
router.all("/api/dexscreener", route(handleDexscreener));
router.all("/api/jupiter", route(handleJupiter));

router.post("/solana-send", route(handleSolanaSend));
router.post("/solana-simulate", route(handleSolanaSimulate));

router.get("/jupiter/price", route(handleJupiterPrice));
router.get("/jupiter/tokens", route(handleJupiterTokens));
router.get("/jupiter/quote", route(handleJupiterQuote));
router.post("/jupiter/swap", route(handleJupiterSwap));

router.post("/pumpswap/build", route(buildPumpSwap));
router.post("/pumpswap/quote", route(getPumpQuote));

router.get("/wallet/balance", route(handleWalletBalance));
router.get("/wallet/token-accounts", route(handleWalletTokenAccounts));
router.get("/wallet/transactions", route(handleWalletTransactions));

router.get("/dexscreener/tokens", route(handleDexscreenerTokens));
router.get("/dexscreener/search", route(handleDexscreenerSearch));
router.get("/dexscreener/trending", route(handleDexscreenerTrending));

async function serveStaticAsset(
  request: Request,
  env: EnvBindings,
): Promise<Response> {
  const assets = env.ASSETS;
  if (!assets || typeof assets.fetch !== "function") {
    return new Response("Not Found", { status: 404 });
  }

  const originalResponse = await assets.fetch(request);
  if (originalResponse.status !== 404) {
    return originalResponse;
  }

  if (request.method !== "GET") {
    return originalResponse;
  }

  const url = new URL(request.url);
  const accept = request.headers.get("accept") || "";
  const isHtmlRequest =
    !url.pathname.includes(".") && accept.includes("text/html");

  if (!isHtmlRequest) {
    return originalResponse;
  }

  const fallbackRequest = new Request(`${url.origin}/index.html`, request);
  const fallbackResponse = await assets.fetch(fallbackRequest);
  return fallbackResponse.status === 404 ? originalResponse : fallbackResponse;
}

router.all("*", async (request: Request, env: EnvBindings) =>
  serveStaticAsset(request, env),
);

export default {
  async fetch(request: Request, env: EnvBindings, ctx: ExecutionContext) {
    return router.handle(request, env, ctx);
  },
};
