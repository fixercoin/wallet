export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname || "/";

    // Handle Pump.fun quote locally on Cloudflare worker
    if (
      pathname === "/api/pumpfun/quote" ||
      pathname.startsWith("/api/pumpfun/quote?")
    ) {
      try {
        const pumpQuoteUrl =
          (env && env.PUMPFUN_QUOTE) || "https://pumpportal.fun/api/quote";
        if (!pumpQuoteUrl) {
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
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
              },
            },
          );
        }

        const method = request.method.toUpperCase();
        let body = {};

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
      } catch (e) {
        return new Response(
          JSON.stringify({
            error: String(e),
            details: String(e),
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

    // Pump.fun and DexScreener support locally on the Cloudflare worker
    const PUMPFUN_API_BASE =
      (env && env.PUMPFUN_API_BASE) || "https://pump.fun/api";
    const DEXSCREENER_BASE =
      (env && env.DEXSCREENER_BASE) || "https://api.dexscreener.com/latest/dex";

    // Pump.fun curve
    if (
      pathname === "/api/pumpfun/curve" ||
      pathname.startsWith("/api/pumpfun/curve?")
    ) {
      const mint = url.searchParams.get("mint");
      if (!mint) {
        return new Response(
          JSON.stringify({ error: "mint parameter required" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }
      try {
        const resp = await fetch(
          `${PUMPFUN_API_BASE}/curve/${encodeURIComponent(mint)}`,
          { method: "GET", headers: { "Content-Type": "application/json" } },
        );
        const text = await resp.text().catch(() => "");
        return new Response(text, {
          status: resp.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (e) {
        return new Response(
          JSON.stringify({
            error: "Failed to check curve state",
            details: String(e),
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

    // Pump.fun BUY
    if (pathname === "/api/pumpfun/buy") {
      try {
        const body = await request.json().catch(() => ({}));
        if (!body.mint || typeof body.amount !== "number" || !body.buyer) {
          return new Response(
            JSON.stringify({
              error: "Missing required fields: mint, amount (number), buyer",
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

        const resp = await fetch(`${PUMPFUN_API_BASE}/trade`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const text = await resp.text().catch(() => "");
        return new Response(text, {
          status: resp.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (e) {
        const isTimeout = e?.name === "AbortError";
        return new Response(
          JSON.stringify({
            error: "Failed to request BUY transaction",
            details: isTimeout
              ? "Request timeout - Pump.fun API took too long to respond"
              : String(e),
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

    // Pump.fun SELL
    if (pathname === "/api/pumpfun/sell") {
      try {
        const body = await request.json().catch(() => ({}));
        if (!body.mint || typeof body.amount !== "number" || !body.seller) {
          return new Response(
            JSON.stringify({
              error: "Missing required fields: mint, amount (number), seller",
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
        const resp = await fetch(`${PUMPFUN_API_BASE}/sell`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const text = await resp.text().catch(() => "");
        return new Response(text, {
          status: resp.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (e) {
        return new Response(
          JSON.stringify({
            error: "Failed to request SELL transaction",
            details: String(e),
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

    // DexScreener price
    if (
      pathname === "/api/price" ||
      pathname === "/price" ||
      pathname.startsWith("/api/price?")
    ) {
      const mint = url.searchParams.get("mint");
      if (!mint) {
        return new Response(JSON.stringify({ error: "mint required" }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
      try {
        const resp = await fetch(
          `${DEXSCREENER_BASE}/tokens/${encodeURIComponent(mint)}`,
          { method: "GET", headers: { "Content-Type": "application/json" } },
        );
        const text = await resp.text().catch(() => "");
        return new Response(text, {
          status: resp.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
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
