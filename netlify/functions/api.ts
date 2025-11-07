// API router for Netlify functions
// Routes requests to the appropriate nested handlers based on the path
import type { Handler, HandlerEvent, HandlerResponse } from "@netlify/functions";

// Import all handlers (named exports)
import { handler as jupiterQuoteHandler } from "./jupiter/quote.ts";
import { handler as jupiterSwapHandler } from "./jupiter/swap.ts";
import { handler as jupiterPriceHandler } from "./jupiter/price.ts";
import { handler as solPriceHandler } from "./sol/price.ts";
import { handler as tokenPriceHandler } from "./token/price.ts";
import { handler as walletBalanceHandler } from "./wallet/balance.ts";
import { handler as solanRpcHandler } from "./solana-rpc.ts";
import { handler as healthHandler } from "./health.ts";
import { handler as pingHandler } from "./ping.ts";
import { handler as dexscreenerPriceHandler } from "./dexscreener/price.ts";
import { handler as dexscreenerTokensHandler } from "./dexscreener/tokens.ts";
import { handler as birdeeyePriceHandler } from "./birdeye/price.ts";
import { handler as pumpfunQuoteHandler } from "./pumpfun/quote.ts";
import { handler as pumpfunBuyHandler } from "./pumpfun/buy.ts";
import { handler as pumpfunSellHandler } from "./pumpfun/sell.ts";
import { handler as pumpfunTradeHandler } from "./pumpfun/trade.ts";
import { handler as pumpfunCurveHandler } from "./pumpfun/curve.ts";
import { handler as forexRateHandler } from "./forex/rate.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
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
  "health": healthHandler,
  "ping": pingHandler,
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
  event: HandlerEvent
): Promise<HandlerResponse> => {
  // Handle OPTIONS requests for CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  // Extract the path from the event
  // The path should be the original request path like /api/jupiter/quote
  const rawPath = event.path || event.rawPath || "";

  // Remove /api prefix and query parameters
  const pathWithoutPrefix = rawPath.replace(/^\/+api\/?/, "");
  const path = pathWithoutPrefix.replace(/\?.*/, "");

  console.log(
    `[API Router] Processing path: ${path}, Method: ${event.httpMethod}`
  );

  // Find and execute matching handler
  if (path && handlers[path]) {
    try {
      console.log(`[API Router] Routing to: ${path}`);
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

  // Fallback for unmapped endpoints
  const availableEndpoints = Object.keys(handlers).map((p) => `/api/${p}`);

  console.warn(`[API Router] No handler found for path: ${path}`);

  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      error: "API endpoint not found",
      hint: "Use specific endpoints like /api/solana-rpc, /api/wallet/balance, /api/jupiter/quote, etc.",
      requestedPath: path || "/",
      availableEndpoints: availableEndpoints,
    }),
  };
};
