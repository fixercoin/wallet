import type { Handler } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const handler: Handler = async (event) => {
  // Extract the path after /api/
  const path = event.path?.replace(/^\/\.netlify\/functions\/api\/?/, "") || "";
  
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  // Route to specific handler based on path
  // This is a fallback router - in most cases Netlify should directly route to nested functions
  
  if (!path) {
    // Base /api request - return error or redirect
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Invalid API request. Please use a specific endpoint like /api/solana-rpc",
      }),
    };
  }

  // For debugging - log the request
  console.log(`[API Router] Received request for path: ${path}, method: ${event.httpMethod}`);

  // Return method not allowed - this shouldn't be reached as Netlify should route to specific handlers
  return {
    statusCode:405,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      error: "Method not allowed or endpoint not found",
      path: path,
    }),
  };
};
