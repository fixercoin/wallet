import type { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
      body: "",
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ok: true,
      service: "Fixorium Wallet API (Netlify)",
      status: "operational",
      timestamp: new Date().toISOString(),
      endpoints: {
        health: "/api/health",
        status: "/api/status",
        ping: "/api/ping",
        wallet: {
          balance: "/api/wallet/balance?publicKey=<address>",
        },
        pricing: {
          "sol-price": "/api/sol/price",
          "birdeye-price": "/api/birdeye/price?address=<mint>",
          "dexscreener-price": "/api/dexscreener/price?token=<mint>",
          "token-price": "/api/token/price?token=<symbol>&mint=<mint>",
        },
        jupiter: {
          price: "/api/jupiter/price?ids=<mint>",
          quote: "/api/jupiter/quote",
          swap: "/api/jupiter/swap [POST]",
        },
        pumpfun: {
          quote: "/api/pumpfun/quote",
          buy: "/api/pumpfun/buy [POST]",
          sell: "/api/pumpfun/sell [POST]",
        },
        utilities: {
          "forex-rate": "/api/forex/rate",
          ping: "/api/ping",
        },
      },
    }),
  };
};
