import type { Handler, HandlerEvent } from "@netlify/functions";

const startTime = Date.now();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  const uptime = Math.floor((Date.now() - startTime) / 1000);

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: "netlify",
      uptime: uptime,
    }),
  };
};
