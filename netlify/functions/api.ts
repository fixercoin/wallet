// API router for Netlify functions
// This handler routes requests to the appropriate nested handlers based on the path
import type { Handler, HandlerEvent, HandlerResponse } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Content-Type": "application/json",
};

// Available handlers mapping
const AVAILABLE_HANDLERS: Record<string, string> = {
  "jupiter/quote": "jupiter/quote",
  "jupiter/swap": "jupiter/swap",
  "jupiter/price": "jupiter/price",
  "sol/price": "sol/price",
  "token/price": "token/price",
  "wallet/balance": "wallet/balance",
  "solana-rpc": "solana-rpc",
  "health": "health",
  "ping": "ping",
  "dexscreener/price": "dexscreener/price",
  "dexscreener/tokens": "dexscreener/tokens",
  "birdeye/price": "birdeye/price",
  "pumpfun/quote": "pumpfun/quote",
  "pumpfun/buy": "pumpfun/buy",
  "pumpfun/sell": "pumpfun/sell",
  "pumpfun/trade": "pumpfun/trade",
  "pumpfun/curve": "pumpfun/curve",
  "forex/rate": "forex/rate",
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
    `[API Router] Raw path: ${rawPath}, Extracted path: ${path}, Method: ${event.httpMethod}`
  );

  // Find a matching handler
  if (path && AVAILABLE_HANDLERS[path]) {
    const handlerPath = AVAILABLE_HANDLERS[path];
    try {
      // Dynamically import the handler module
      const module = await import(`./${handlerPath}.ts`);
      if (module && typeof module.handler === "function") {
        console.log(`[API Router] Routing to handler: ${handlerPath}`);
        return await module.handler(event);
      } else {
        console.error(`[API Router] Handler not found for path: ${handlerPath}`);
      }
    } catch (error: any) {
      console.error(
        `[API Router] Error loading handler for ${handlerPath}:`,
        error
      );
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

  // Also try with .js extension (for compiled code)
  if (path && AVAILABLE_HANDLERS[path]) {
    const handlerPath = AVAILABLE_HANDLERS[path];
    try {
      const module = await import(`./${handlerPath}.js`);
      if (module && typeof module.handler === "function") {
        console.log(`[API Router] Routing to compiled handler: ${handlerPath}`);
        return await module.handler(event);
      }
    } catch (error: any) {
      // Silently continue to fallback
    }
  }

  // Log available endpoints for debugging
  const availableEndpoints = Object.keys(AVAILABLE_HANDLERS).map(
    (p) => `/api/${p}`
  );

  console.warn(
    `[API Router] No handler found for path: ${path}. Available: ${availableEndpoints.join(", ")}`
  );

  // Fallback for unmapped endpoints
  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      error: "API endpoint not found",
      hint: "Use specific endpoints like /api/solana-rpc, /api/wallet/balance, /api/jupiter/quote, etc.",
      requestedPath: path,
      availableEndpoints: availableEndpoints,
    }),
  };
};
