import type {
  Handler,
  HandlerEvent,
  HandlerResponse,
} from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
};

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

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
  // The rewrite rule passes it as: to = "/.netlify/functions/api?path=:splat"
  const queryPath = event.queryStringParameters?.path;

  let apiPath = "";

  if (queryPath) {
    apiPath = "/" + queryPath.trim();
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
      apiPath = rawPath.startsWith("/api") ? rawPath : "/api" + rawPath;
    }
  }

  // Ensure path starts with /api
  if (!apiPath.startsWith("/api")) {
    apiPath = "/api" + apiPath;
  }

  // Build query string if present
  const queryString = event.rawUrl?.includes("?")
    ? event.rawUrl.split("?")[1]
    : "";
  const fullUrl = new URL(apiPath, BACKEND_URL);
  if (queryString) {
    fullUrl.search = queryString;
  }

  const headers: Record<string, string> = {
    ...CORS_HEADERS,
  };

  // Forward relevant headers
  if (event.headers.authorization) {
    headers["Authorization"] = event.headers.authorization;
  }
  if (event.headers["content-type"]) {
    headers["Content-Type"] = event.headers["content-type"];
  }

  // Handle health/status checks locally if backend is unavailable
  if (apiPath === "/api/health" || apiPath === "/api/ping" || apiPath === "/api/status") {
    const isHealth = apiPath === "/api/health";
    const isPing = apiPath === "/api/ping";

    if (isPing) {
      return {
        statusCode: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "text/plain",
        },
        body: "pong",
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: isHealth ? "healthy" : "operational",
        service: "Fixorium Wallet API",
        timestamp: new Date().toISOString(),
      }),
    };
  }

  console.log(
    `[API Proxy] Forwarding ${event.httpMethod} ${apiPath} to ${fullUrl.toString()}`,
  );

  try {
    const proxyResponse = await fetch(fullUrl.toString(), {
      method: event.httpMethod,
      headers,
      body: event.body ? (event.isBase64Encoded ? Buffer.from(event.body, "base64").toString() : event.body) : undefined,
    });

    const contentType = proxyResponse.headers.get("content-type") || "application/json";
    const responseBody = await proxyResponse.text();

    return {
      statusCode: proxyResponse.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": contentType,
      },
      body: responseBody,
    };
  } catch (error) {
    console.error("[API Proxy] Error:", error);
    return {
      statusCode: 502,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: "API proxy error",
        details: error instanceof Error ? error.message : String(error),
        hint: "Ensure BACKEND_URL environment variable is set on Netlify",
      }),
    };
  }
};
