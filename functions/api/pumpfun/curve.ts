import { fetchWithRetry } from "../../utils/fetch-with-retry";

export const onRequest: PagesFunction = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const mint = url.searchParams.get("mint");

    if (!mint) {
      return new Response(
        JSON.stringify({
          error: "Missing 'mint' query parameter",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        },
      );
    }

    const pumpFunUrl = `https://pump.fun/api/curve/${encodeURIComponent(mint)}`;
    const res = await fetchWithRetry(pumpFunUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
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
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error: any) {
    const message = error?.message || "Unknown error";
    const isTimeout = message.includes("timeout") || message.includes("abort");
    console.error("Pump.fun curve endpoint error:", error);

    return new Response(
      JSON.stringify({
        error: isTimeout ? "Request timeout" : "Failed to check curve state",
        details: message,
      }),
      {
        status: isTimeout ? 504 : 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      },
    );
  }
};
