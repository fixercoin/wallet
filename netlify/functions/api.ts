import type {
  Handler,
  HandlerEvent,
  HandlerResponse,
} from "@netlify/functions";

// Import all individual handlers
import { handler as solPriceHandler } from "./api/sol/price";
import { handler as jupiterQuoteHandler } from "./api/jupiter/quote";
import { handler as jupiterSwapHandler } from "./api/jupiter/swap";
import { handler as jupiterTokensHandler } from "./api/jupiter/tokens";
import { handler as jupiterPriceHandler } from "./api/jupiter/price";
import { handler as dexscreenerTokensHandler } from "./api/dexscreener/tokens";
import { handler as dexscreenerPriceHandler } from "./api/dexscreener/price";
import { handler as dexscreenerTrendingHandler } from "./api/dexscreener/trending";
import { handler as dexscreenerSearchHandler } from "./api/dexscreener/search";
import { handler as birdeyePriceHandler } from "./api/birdeye/price";
import { handler as walletBalanceHandler } from "./api/wallet/balance";
import { handler as solanaRpcHandler } from "./api/solana-rpc";
import { handler as tokenPriceHandler } from "./api/token/price";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
  "Content-Type": "application/json",
};

const HANDLERS: Record<string, Handler> = {
  "sol/price": solPriceHandler,
  "jupiter/quote": jupiterQuoteHandler,
  "jupiter/swap": jupiterSwapHandler,
  "jupiter/tokens": jupiterTokensHandler,
  "jupiter/price": jupiterPriceHandler,
  "dexscreener/tokens": dexscreenerTokensHandler,
  "dexscreener/price": dexscreenerPriceHandler,
  "dexscreener/trending": dexscreenerTrendingHandler,
  "dexscreener/search": dexscreenerSearchHandler,
  "birdeye/price": birdeyePriceHandler,
  "wallet/balance": walletBalanceHandler,
  "solana-rpc": solanaRpcHandler,
  "token/price": tokenPriceHandler,
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

  // Extract path from the query parameter (set by netlify.toml rewrite rule)
  const queryPath = event.queryStringParameters?.path;

  let apiPath = "";

  if (queryPath) {
    apiPath = queryPath.trim();
  } else {
    // Fallback: try to extract from other sources
    let rawPath = event.path || event.rawPath || "";

    if (!rawPath && event.rawUrl) {
      try {
        const url = new URL(event.rawUrl, "http://localhost");
        rawPath = url.pathname;
      } catch {
        rawPath = event.rawUrl.split("?")[0].split("#")[0];
      }
    }

    if (rawPath) {
      apiPath = rawPath.replace(/^\/+api\/?/, "").trim();
    }
  }

  console.log(
    `[API Router] Path: ${apiPath}, Method: ${event.httpMethod}`,
  );

  // Handle local health checks
  if (apiPath === "health") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        status: "healthy",
        service: "Fixorium Wallet API",
        timestamp: new Date().toISOString(),
      }),
    };
  }

  if (apiPath === "ping") {
    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/plain",
      },
      body: "pong",
    };
  }

  if (apiPath === "status") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        status: "operational",
        service: "Fixorium Wallet API",
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // Handle root API path
  if (!apiPath || apiPath === "") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: "Fixorium Wallet API (Netlify)",
        status: "operational",
        availableEndpoints: Object.keys(HANDLERS).map((p) => `/api/${p}`),
      }),
    };
  }

  // Route to specific handlers
  if (HANDLERS[apiPath]) {
    try {
      console.log(`[API Router] Routing to handler: ${apiPath}`);
      return await HANDLERS[apiPath](event);
    } catch (error: any) {
      console.error(`[API Router] Error in handler for ${apiPath}:`, error);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Handler execution error",
          details: error?.message || String(error),
          path: apiPath,
        }),
      };
    }
  }

  // Fallback for unmapped endpoints
  console.warn(
    `[API Router] No handler found for path: ${apiPath}`,
  );

  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      error: "API endpoint not found",
      requestedPath: apiPath || "/",
      hint: "Check available endpoints in the API response",
      availableEndpoints: Object.keys(HANDLERS).map((p) => `/api/${p}`),
    }),
  };
};
