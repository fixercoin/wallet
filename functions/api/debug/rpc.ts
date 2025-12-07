export const config = {
  runtime: "nodejs_esmsh",
};

const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana.publicnode.com",
  "https://rpc.ankr.com/solana",
];

interface RpcHealth {
  endpoint: string;
  healthy: boolean;
  responseTime: number;
  error?: string;
}

async function checkRpcHealth(endpoint: string): Promise<RpcHealth> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getHealth",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      return {
        endpoint,
        healthy: !data.error,
        responseTime,
      };
    }

    return {
      endpoint,
      healthy: false,
      responseTime,
      error: `HTTP ${response.status}`,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const isTimeout =
      error?.name === "AbortError" || error?.message?.includes("timeout");

    return {
      endpoint,
      healthy: false,
      responseTime,
      error: isTimeout ? "timeout" : error?.message || String(error),
    };
  }
}

async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    // Check all RPC endpoints in parallel
    const healthChecks = await Promise.all(
      RPC_ENDPOINTS.map((endpoint) => checkRpcHealth(endpoint)),
    );

    const healthyEndpoints = healthChecks.filter((h) => h.healthy);

    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        healthy: healthyEndpoints.length > 0,
        healthyCount: healthyEndpoints.length,
        totalEndpoints: RPC_ENDPOINTS.length,
        endpoints: healthChecks,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=5",
        },
      },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: "RPC health check failed",
        details: error?.message || String(error),
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

export const onRequest = async (request: Request): Promise<Response> =>
  handler(request);
