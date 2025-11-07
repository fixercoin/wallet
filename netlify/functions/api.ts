// API router for Netlify functions
// Routes requests to the appropriate nested handlers based on the path
import type { Handler, HandlerEvent, HandlerResponse } from "@netlify/functions";

// Import all handlers
import jupiterQuote from "./jupiter/quote.ts";
import jupiterSwap from "./jupiter/swap.ts";
import jupiterPrice from "./jupiter/price.ts";
import solPrice from "./sol/price.ts";
import tokenPrice from "./token/price.ts";
import walletBalance from "./wallet/balance.ts";
import solanRpc from "./solana-rpc.ts";
import health from "./health.ts";
import ping from "./ping.ts";
import dexscreenerPrice from "./dexscreener/price.ts";
import dexscreenerTokens from "./dexscreener/tokens.ts";
import birdeyePrice from "./birdeye/price.ts";
import pumpfunQuote from "./pumpfun/quote.ts";
import pumpfunBuy from "./pumpfun/buy.ts";
import pumpfunSell from "./pumpfun/sell.ts";
import pumpfunTrade from "./pumpfun/trade.ts";
import pumpfunCurve from "./pumpfun/curve.ts";
import forexRate from "./forex/rate.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Content-Type": "application/json",
};

// Map of paths to handlers
const handlers: Record<string, Handler> = {
  "jupiter/quote": jupiterQuote,
  "jupiter/swap": jupiterSwap,
  "jupiter/price": jupiterPrice,
  "sol/price": solPrice,
  "token/price": tokenPrice,
  "wallet/balance": walletBalance,
  "solana-rpc": solanRpc,
  "health": health,
  "ping": ping,
  "dexscreener/price": dexscreenerPrice,
  "dexscreener/tokens": dexscreenerTokens,
  "birdeye/price": birdeyePrice,
  "pumpfun/quote": pumpfunQuote,
  "pumpfun/buy": pumpfunBuy,
  "pumpfun/sell": pumpfunSell,
  "pumpfun/trade": pumpfunTrade,
  "pumpfun/curve": pumpfunCurve,
  "forex/rate": forexRate,
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
