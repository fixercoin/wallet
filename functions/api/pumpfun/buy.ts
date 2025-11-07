export const config = {
  runtime: "nodejs_esmsh",
};

interface PumpBuyRequest {
  mint: string;
  amount: string | number;
  buyer: string;
  slippageBps?: number;
  priorityFeeLamports?: number;
}

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
    let body: PumpBuyRequest;
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

    const { mint, amount, buyer, slippageBps = 350, priorityFeeLamports = 10000 } = body;

    if (!mint || amount === undefined || !buyer) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: mint, amount, buyer",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch("https://pumpportal.fun/api/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mint,
        amount: String(amount),
        buyer,
        slippageBps,
        priorityFeeLamports,
        txVersion: "V0",
        operation: "buy",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.text();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: "Pump.fun API error",
          status: response.status,
          details: data.slice(0, 200),
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    const isTimeout = error?.name === "AbortError" || error?.message?.includes("timeout");

    return new Response(
      JSON.stringify({
        error: isTimeout ? "Request timeout" : "Failed to request BUY transaction",
        details: isTimeout
          ? "Pump.fun API took too long to respond"
          : error?.message || String(error),
      }),
      {
        status: isTimeout ? 504 : 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}

export default handler;
