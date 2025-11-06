export const onRequest: PagesFunction = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed. Use POST.",
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: "Invalid JSON body",
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
          error:
            "Missing required fields: mint, amount, seller",
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const pumpPortalUrl = "https://pumpportal.fun/api/trade";
    const res = await fetch(pumpPortalUrl, {
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
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const text = await res.text();

    if (!res.ok) {
      console.error(`[Pump.fun SELL] API error ${res.status}:`, text);
    }

    return new Response(text, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error: any) {
    const isTimeout = error?.name === "AbortError";
    const message = isTimeout
      ? "Request timeout - Pump.fun API took too long to respond"
      : error?.message || "Unknown error";
    console.error("Pump.fun SELL endpoint error:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to request SELL transaction",
        details: message,
      }),
      {
        status: isTimeout ? 504 : 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      },
    );
  }
};
