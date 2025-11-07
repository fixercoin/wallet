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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const pumpFunUrl = `https://pump.fun/api/curve/${encodeURIComponent(mint)}`;
    const res = await fetch(pumpFunUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
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
    console.error("Pump.fun curve endpoint error:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to check curve state",
        details: message,
      }),
      {
        status: 502,
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
