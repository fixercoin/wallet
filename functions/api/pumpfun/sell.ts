import { fetchWithRetry } from "../../utils/fetch-with-retry";

export const config = {
  runtime: "nodejs_esmsh",
};

interface PumpSellRequest {
  mint: string;
  amount: string | number;
  seller: string;
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
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    let body: PumpSellRequest;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const {
      mint,
      amount,
      seller,
      slippageBps = 350,
      priorityFeeLamports = 10000,
    } = body;

    if (!mint || amount === undefined || !seller) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: mint, amount, seller",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    const response = await fetchWithRetry("https://pumpportal.fun/api/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mint,
        amount: String(amount),
        seller,
        slippageBps,
        priorityFeeLamports,
        txVersion: "V0",
        operation: "sell",
      }),
      timeoutMs: 55000,
      maxRetries: 2,
      retryDelayMs: 1000,
    });

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
        },
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
    const message = error?.message || "Unknown error";
    const isTimeout = message.includes("timeout") || message.includes("abort");

    return new Response(
      JSON.stringify({
        error: isTimeout
          ? "Request timeout"
          : "Failed to request SELL transaction",
        details: isTimeout ? "Pump.fun API took too long to respond" : message,
      }),
      {
        status: isTimeout ? 504 : 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

export default handler;
