export const config = {
  runtime: "nodejs_esmsh",
};

const RPC_ENDPOINTS = [
  "https://rpc.shyft.to?api_key=3hAwrhOAmJG82eC7",
  "https://api.mainnet-beta.solana.com",
];

async function handler(request: Request): Promise<Response> {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const { transaction } = body;

    if (!transaction) {
      return new Response(
        JSON.stringify({ error: "Missing 'transaction' field" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const rpcBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "sendRawTransaction",
      params: [transaction, { skipPreflight: false, preflightCommitment: "confirmed" }],
    };

    let lastError = "";

    // Try each RPC endpoint
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rpcBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (data.result) {
          return new Response(
            JSON.stringify({
              success: true,
              signature: data.result,
              timestamp: Date.now(),
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        }

        if (data.error) {
          lastError = data.error.message || "RPC error";
          continue;
        }
      } catch (error: any) {
        lastError = error?.name === "AbortError" ? "timeout" : error?.message || String(error);
      }
    }

    return new Response(
      JSON.stringify({
        error: "Failed to send transaction",
        details: lastError || "All RPC endpoints failed",
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: "Solana send error",
        details: error?.message || String(error),
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}

export default handler;
