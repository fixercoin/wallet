// API router for Netlify functions
// Routes requests to the appropriate nested handlers based on the path
import type {
  Handler,
  HandlerEvent,
  HandlerResponse,
} from "@netlify/functions";

// Import all handlers (named exports)
import { handler as jupiterQuoteHandler } from "./api/jupiter/quote";
import { handler as jupiterSwapHandler } from "./api/jupiter/swap";
import { handler as jupiterPriceHandler } from "./api/jupiter/price";
import { handler as solPriceHandler } from "./api/sol/price";
import { handler as tokenPriceHandler } from "./api/token/price";
import { handler as walletBalanceHandler } from "./api/wallet/balance";
import { handler as solanRpcHandler } from "./api/solana-rpc";
import { handler as healthHandler } from "./api/health";
import { handler as pingHandler } from "./api/ping";
import { handler as dexscreenerPriceHandler } from "./api/dexscreener/price";
import { handler as dexscreenerTokensHandler } from "./api/dexscreener/tokens";
import { handler as birdeeyePriceHandler } from "./api/birdeye/price";
import { handler as pumpfunQuoteHandler } from "./api/pumpfun/quote";
import { handler as pumpfunBuyHandler } from "./api/pumpfun/buy";
import { handler as pumpfunSellHandler } from "./api/pumpfun/sell";
import { handler as pumpfunTradeHandler } from "./api/pumpfun/trade";
import { handler as pumpfunCurveHandler } from "./api/pumpfun/curve";
import { handler as forexRateHandler } from "./api/forex/rate";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
  "Content-Type": "application/json",
};

// Map of paths to handlers
const handlers: Record<string, Handler> = {
  "jupiter/quote": jupiterQuoteHandler,
  "jupiter/swap": jupiterSwapHandler,
  "jupiter/price": jupiterPriceHandler,
  "sol/price": solPriceHandler,
  "token/price": tokenPriceHandler,
  "wallet/balance": walletBalanceHandler,
  "solana-rpc": solanRpcHandler,
  health: healthHandler,
  ping: pingHandler,
  "dexscreener/price": dexscreenerPriceHandler,
  "dexscreener/tokens": dexscreenerTokensHandler,
  "birdeye/price": birdeeyePriceHandler,
  "pumpfun/quote": pumpfunQuoteHandler,
  "pumpfun/buy": pumpfunBuyHandler,
  "pumpfun/sell": pumpfunSellHandler,
  "pumpfun/trade": pumpfunTradeHandler,
  "pumpfun/curve": pumpfunCurveHandler,
  "forex/rate": forexRateHandler,
};

export const handler: Handler = async (
  event: HandlerEvent,
): Promise<HandlerResponse> => {
  // Handle OPTIONS requests for CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  // Extract the path from multiple possible sources
  // Netlify might pass it in different ways depending on configuration
  let rawPath = "";

  // Try event.path first (original request path)
  if (event.path) {
    rawPath = event.path;
  }
  // Try event.rawPath (alternative name)
  else if (event.rawPath) {
    rawPath = event.rawPath;
  }
  // Parse from rawUrl
  else if (event.rawUrl) {
    try {
      const url = new URL(event.rawUrl, "http://localhost");
      rawPath = url.pathname;
    } catch {
      rawPath = event.rawUrl.split("?")[0].split("#")[0];
    }
  }

  // Check if path was passed as query parameter (fallback for some Netlify configs)
  const queryPath = event.queryStringParameters?.path;
  if (!rawPath && queryPath) {
    rawPath = "/" + queryPath;
  }

  // Debug log the raw path and event details
  console.log(
    `[API Router] Event: path=${rawPath}, method=${event.httpMethod}, url=${event.rawUrl || "N/A"}`,
  );

  // Normalize path - handle multiple prefixes
  let normalizedPath = rawPath;

  // Remove /.netlify/functions/api prefix if present (from rewrite)
  if (normalizedPath.startsWith("/.netlify/functions/api")) {
    normalizedPath = normalizedPath.replace(/^\/.netlify\/functions\/api/, "/api");
  }

  // Remove /api prefix and query parameters
  const pathWithoutPrefix = normalizedPath.replace(/^\/+api\/?/, "");
  const path = pathWithoutPrefix.replace(/\?.*$/, "").split("#")[0].trim();

  console.log(
    `[API Router] Processing path: ${path}, Method: ${event.httpMethod}`,
  );

  // Find and execute matching handler
  if (path && handlers[path]) {
    try {
      console.log(`[API Router] Routing to handler: ${path}`);
      return await handlers[path](event);
    } catch (error: any) {
      console.error(`[API Router] Error in handler for ${path}:`, error);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Handler execution error",
          details: error?.message || String(error),
          path: path,
        }),
      };
    }
  }

  // Handle root API path
  if (!path || path === "") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: "API Server is running",
        availableEndpoints: Object.keys(handlers).map((p) => `/api/${p}`),
      }),
    };
  }

  // Fallback for unmapped endpoints
  const availableEndpoints = Object.keys(handlers).map((p) => `/api/${p}`);

  console.warn(
    `[API Router] No handler found for path: ${path} (rawPath was: ${rawPath})`,
  );

  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      error: "API endpoint not found",
      hint: "Use specific endpoints like /api/solana-rpc, /api/wallet/balance, /api/jupiter/quote, etc.",
      requestedPath: path || "/",
      rawPath: rawPath,
      availableEndpoints: availableEndpoints,
    }),
  };
};
