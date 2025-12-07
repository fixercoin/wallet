import { fetchWithRetry } from "../../utils/fetch-with-retry";

export const onRequest: PagesFunction = async ({ request, env }) => {
  try {
    const quoteUrl = (env as any)?.PUMPFUN_QUOTE;
    if (!quoteUrl) {
      return new Response(
        JSON.stringify({
          error: "PumpFun quote endpoint not configured",
          code: "UNCONFIGURED",
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        },
      );
    }

    const body = await request.json();
    const res = await fetchWithRetry(quoteUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeoutMs: 55000,
      maxRetries: 2,
      retryDelayMs: 1000,
    });

    const text = await res.text();

    return new Response(text, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error: any) {
    const message = error?.message || "Unknown error";
    const isTimeout = message.includes("timeout") || message.includes("abort");
    console.error("PumpFun quote error:", error);

    return new Response(
      JSON.stringify({
        error: isTimeout ? "Request timeout" : "Failed to fetch PumpFun quote",
        details: message,
      }),
      {
        status: isTimeout ? 504 : 503,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      },
    );
  }
};
