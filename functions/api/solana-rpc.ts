export const config = {
  runtime: "nodejs_esmsh",
};

interface RpcRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: any[];
}

const RPC_ENDPOINTS = [
  "https://rpc.shyft.to?api_key=3hAwrhOAmJG82eC7",
  "https://api.mainnet-beta.solana.com",
  "https://solana.publicnode.com",
  "https://rpc.ankr.com/solana",
];

async function handler(request: Request): Promise<Response> {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    let rpcRequest: RpcRequest;
    try {
      rpcRequest = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (!rpcRequest || !rpcRequest.method) {
      return new Response(JSON.stringify({ error: "Missing RPC method" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    let lastError = "";
    let lastStatus = 502;

    // Try each RPC endpoint
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rpcRequest),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        lastStatus = response.status;

        if (response.status === 200) {
          const text = await response.text();
          return new Response(text, {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }

        // Try to parse as JSON-RPC response even if status isn't 200
        try {
          const text = await response.text();
          const json = JSON.parse(text);
          if (json.result !== undefined || json.error !== undefined) {
            return new Response(JSON.stringify(json), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            });
          }
        } catch {
          // Not valid JSON-RPC response
        }

        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429
        ) {
          lastError = `HTTP ${response.status}`;
          break;
        }

        lastError = `HTTP ${response.status}`;
      } catch (error: any) {
        lastError =
          error?.name === "AbortError"
            ? "timeout"
            : error?.message || String(error);
      }
    }

    return new Response(
      JSON.stringify({
        error: "All RPC endpoints failed",
        details: lastError,
      }),
      {
        status: lastStatus,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: "RPC proxy error",
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

export default handler;
