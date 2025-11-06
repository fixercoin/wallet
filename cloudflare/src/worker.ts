export interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname || "/";

    // Handle Pump.fun quote locally on Cloudflare worker
    if (pathname === "/api/pumpfun/quote" || pathname.startsWith("/api/pumpfun/quote?")) {
      try {
        const pumpQuoteUrl = (env as any)?.PUMPFUN_QUOTE || "https://pumpportal.fun/api/quote";
        if (!pumpQuoteUrl) {
          return new Response(
            JSON.stringify({ error: "PumpFun quote endpoint not configured", code: "UNCONFIGURED" }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
              },
            },
          );
        }

        const method = request.method.toUpperCase();
        let body: any = {};

        if (method === "GET" || method === "HEAD") {
          const inputMint = url.searchParams.get("inputMint");
          const outputMint = url.searchParams.get("outputMint");
          const amount = url.searchParams.get("amount");
          const mint = url.searchParams.get("mint");

          if (inputMint) body.inputMint = inputMint;
          if (outputMint) body.outputMint = outputMint;
          if (amount) body.amount = amount;
          if (mint) body.mint = mint;
        } else {
          body = await request.json().catch(() => ({}));
        }

        const resp = await fetch(pumpQuoteUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const text = await resp.text().catch(() => "");
        const headers = new Headers({
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        });

        return new Response(text, { status: resp.status, headers });
      } catch (e: any) {
        return new Response(
          JSON.stringify({
            error: e?.message?.includes?.("abort") ? "Request timeout" : "Failed to fetch PumpFun quote",
            details: String(e?.message || e),
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }
    }

    // Forward ANY /api/ request to the Pages Functions runtime
    if (url.pathname.startsWith("/api/")) {
      const forwardUrl =
        "https://wallet-c36.pages.dev" + url.pathname + url.search;
      return fetch(new Request(forwardUrl, request));
    }

    // Serve front-end UI
    return env.ASSETS.fetch(request);
  },
};
