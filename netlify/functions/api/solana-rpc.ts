import type { Handler, HandlerEvent } from "@netlify/functions";

const RPC_ENDPOINTS = [
  "https://solana.publicnode.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

let lastEndpointIndex = 0;
const rateLimitedEndpoints = new Map<string, number>();

function getEndpointKey(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    return url.hostname;
  } catch {
    return endpoint;
  }
}

function isEndpointRateLimited(endpoint: string): boolean {
  const key = getEndpointKey(endpoint);
  const until = rateLimitedEndpoints.get(key);
  if (!until) return false;
  if (Date.now() > until) {
    rateLimitedEndpoints.delete(key);
    return false;
  }
  return true;
}

function markEndpointRateLimited(endpoint: string, durationMs: number = 30000): void {
  const key = getEndpointKey(endpoint);
  rateLimitedEndpoints.set(key, Date.now() + durationMs);
}

async function makeRpcCall(body: any, endpoint: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        markEndpointRateLimited(endpoint);
      }
      throw new Error(`RPC error ${response.status}`);
    }

    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : null;

    if (!body || !body.jsonrpc) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Invalid JSON-RPC request" }),
      };
    }

    const availableEndpoints = RPC_ENDPOINTS.filter(
      (ep) => !isEndpointRateLimited(ep),
    );

    if (availableEndpoints.length === 0) {
      return {
        statusCode: 429,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "All RPC endpoints are rate limited",
          message: "Please retry after a moment",
        }),
      };
    }

    let lastError: any;

    for (let i = 0; i < availableEndpoints.length; i++) {
      const endpointIndex = (lastEndpointIndex + i) % availableEndpoints.length;
      const endpoint = availableEndpoints[endpointIndex];

      try {
        const result = await makeRpcCall(body, endpoint);
        lastEndpointIndex = endpointIndex;

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify(result),
        };
      } catch (error: any) {
        lastError = error;
        console.warn(`[RPC] ${getEndpointKey(endpoint)} failed:`, error.message);

        if (error.message.includes("429")) {
          markEndpointRateLimited(endpoint);
        }
      }
    }

    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "RPC request failed",
        details: lastError?.message || "All endpoints failed",
      }),
    };
  } catch (error: any) {
    console.error("[RPC] Error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Internal server error",
        details: error?.message || String(error),
      }),
    };
  }
};
