import type { Handler, HandlerEvent, HandlerResponse } from "@netlify/functions";

// Import all handlers
import { handler as jupiterQuoteHandler } from "./jupiter/quote";
import { handler as jupiterSwapHandler } from "./jupiter/swap";
import { handler as jupiterPriceHandler } from "./jupiter/price";
import { handler as solPriceHandler } from "./sol/price";
import { handler as tokenPriceHandler } from "./token/price";
import { handler as walletBalanceHandler } from "./wallet/balance";
import { handler as solanRpcHandler } from "./solana-rpc";
import { handler as healthHandler } from "./health";
import { handler as pingHandler } from "./ping";
import { handler as dexscreenerPriceHandler } from "./dexscreener/price";
import { handler as dexscreenerTokensHandler } from "./dexscreener/tokens";
import { handler as birdeeyePriceHandler } from "./birdeye/price";
import { handler as pumpfunQuoteHandler } from "./pumpfun/quote";
import { handler as pumpfunBuyHandler } from "./pumpfun/buy";
import { handler as pumpfunSellHandler } from "./pumpfun/sell";
import { handler as pumpfunTradeHandler } from "./pumpfun/trade";
import { handler as pumpfunCurveHandler } from "./pumpfun/curve";
import { handler as forexRateHandler } from "./forex/rate";

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
  // Handle OPTIONS for CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  // Extract the path from the event
  // Netlify's [...path].ts passes the matched path in event.path
  const rawPath = event.path || "";
  
  // Remove /api/ prefix and clean up
  const pathWithoutPrefix = rawPath.replace(/^\/+api\/?/, "");
  const path = pathWithoutPrefix.replace(/\?.*/, "").replace(/\/$/, "");

  console.log(`[API Router] Processing path: ${path}, Method: ${event.httpMethod}`);

  // Find matching handler
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

  // Fallback for unmapped endpoints
  const availableEndpoints = Object.keys(handlers).map((p) => `/api/${p}`);
  console.warn(`[API Router] No handler found for path: ${path}`);

  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      error: "API endpoint not found",
      requestedPath: path || "/",
      availableEndpoints: availableEndpoints,
    }),
  };
};
