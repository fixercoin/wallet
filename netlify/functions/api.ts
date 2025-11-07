// API router for Netlify functions
// This handler routes requests to the appropriate nested handlers based on the path
import type { Handler, HandlerEvent, HandlerResponse } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Content-Type": "application/json",
};

export const handler: Handler = async (
  event: HandlerEvent
): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  // Extract the path from the event
  // The rawPath should contain the full path like /api/jupiter/quote
  const rawPath = event.rawPath || event.path || "";
  const path = rawPath.replace(/^\/api\/?/, "").replace(/\?.*/, "");

  console.log(`API Router: Processing path: ${path}`);

  // Route specific endpoints
  const pathSegments = path.split("/");
  const firstSegment = pathSegments[0];

  // Dynamically import and call the appropriate handler
  try {
    let handler: any;

    // Map paths to handler functions
    switch (firstSegment) {
      case "jupiter":
        const jupiterEndpoint = pathSegments[1];
        if (jupiterEndpoint === "quote") {
          handler = (await import("./jupiter/quote")).handler;
        } else if (jupiterEndpoint === "swap") {
          handler = (await import("./jupiter/swap")).handler;
        } else if (jupiterEndpoint === "price") {
          handler = (await import("./jupiter/price")).handler;
        }
        break;

      case "sol":
        if (pathSegments[1] === "price") {
          handler = (await import("./sol/price")).handler;
        }
        break;

      case "token":
        if (pathSegments[1] === "price") {
          handler = (await import("./token/price")).handler;
        }
        break;

      case "wallet":
        if (pathSegments[1] === "balance") {
          handler = (await import("./wallet/balance")).handler;
        }
        break;

      case "solana-rpc":
        handler = (await import("./solana-rpc")).handler;
        break;

      case "health":
        handler = (await import("./health")).handler;
        break;

      case "ping":
        handler = (await import("./ping")).handler;
        break;

      case "dexscreener":
        const dexscreenerEndpoint = pathSegments[1];
        if (dexscreenerEndpoint === "price") {
          handler = (await import("./dexscreener/price")).handler;
        } else if (dexscreenerEndpoint === "tokens") {
          handler = (await import("./dexscreener/tokens")).handler;
        }
        break;

      case "birdeye":
        if (pathSegments[1] === "price") {
          handler = (await import("./birdeye/price")).handler;
        }
        break;

      case "pumpfun":
        const pumpfunEndpoint = pathSegments[1];
        if (pumpfunEndpoint === "quote") {
          handler = (await import("./pumpfun/quote")).handler;
        } else if (pumpfunEndpoint === "buy") {
          handler = (await import("./pumpfun/buy")).handler;
        } else if (pumpfunEndpoint === "sell") {
          handler = (await import("./pumpfun/sell")).handler;
        } else if (pumpfunEndpoint === "trade") {
          handler = (await import("./pumpfun/trade")).handler;
        } else if (pumpfunEndpoint === "curve") {
          handler = (await import("./pumpfun/curve")).handler;
        }
        break;

      case "forex":
        if (pathSegments[1] === "rate") {
          handler = (await import("./forex/rate")).handler;
        }
        break;
    }

    if (handler && typeof handler === "function") {
      return await handler(event);
    }

    // No matching handler found
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "API endpoint not found",
        hint: "Use specific endpoints like /api/solana-rpc, /api/wallet/balance, /api/jupiter/quote, etc.",
        requestedPath: path,
      }),
    };
  } catch (error: any) {
    console.error(`Error routing to handler for ${path}:`, error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Internal server error",
        details: error?.message || String(error),
        path: path,
      }),
    };
  }
};
