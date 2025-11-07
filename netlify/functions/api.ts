// API router for Netlify functions
// Routes requests to the appropriate handler based on the path
import type { Handler } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Content-Type": "application/json",
};

// Import handlers
import jupiterQuote from "./jupiter/quote";
import jupiterSwap from "./jupiter/swap";
import jupiterPrice from "./jupiter/price";
import solPrice from "./sol/price";
import tokenPrice from "./token/price";
import solanRpc from "./solana-rpc";
import health from "./health";
import ping from "./ping";
import dexscreenerPrice from "./dexscreener/price";
import dexscreenerTokens from "./dexscreener/tokens";
import birdeyePrice from "./birdeye/price";
import walletBalance from "./wallet/balance";
import pumpfunQuote from "./pumpfun/quote";
import pumpfunBuy from "./pumpfun/buy";
import pumpfunSell from "./pumpfun/sell";
import pumpfunTrade from "./pumpfun/trade";
import pumpfunCurve from "./pumpfun/curve";
import forexRate from "./forex/rate";

// Map of paths to handlers
const handlers: Record<string, any> = {
  "jupiter/quote": jupiterQuote,
  "jupiter/swap": jupiterSwap,
  "jupiter/price": jupiterPrice,
  "sol/price": solPrice,
  "token/price": tokenPrice,
  "solana-rpc": solanRpc,
  "health": health,
  "ping": ping,
  "dexscreener/price": dexscreenerPrice,
  "dexscreener/tokens": dexscreenerTokens,
  "birdeye/price": birdeyePrice,
  "wallet/balance": walletBalance,
  "pumpfun/quote": pumpfunQuote,
  "pumpfun/buy": pumpfunBuy,
  "pumpfun/sell": pumpfunSell,
  "pumpfun/trade": pumpfunTrade,
  "pumpfun/curve": pumpfunCurve,
  "forex/rate": forexRate,
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  // Extract the path from the event
  // The path is everything after /api/
  const path = event.path?.replace(/^\/api\/?/, "") || "";
  
  // Find a matching handler
  if (handlers[path] && handlers[path].handler) {
    try {
      return await handlers[path].handler(event);
    } catch (error: any) {
      console.error(`Error in handler for ${path}:`, error);
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
  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      error: "API endpoint not found",
      hint: "Use specific endpoints like /api/solana-rpc, /api/wallet/balance, /api/jupiter/quote, etc.",
      path: path,
      availableEndpoints: Object.keys(handlers),
    }),
  };
};
