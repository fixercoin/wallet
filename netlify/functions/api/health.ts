import type { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
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
    }),
  };
};
