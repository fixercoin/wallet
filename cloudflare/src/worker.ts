export interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname || "/";

    // Handle Pump.fun quote locally on Cloudflare worker
    if (
      pathname === "/api/pumpfun/quote" ||
      pathname.startsWith("/api/pumpfun/quote?")
    ) {
      try {
        const pumpQuoteUrl =
          (env as any)?.PUMPFUN_QUOTE || "https://pumpportal.fun/api/quote";
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
            error: e?.message?.includes?.("abort")
              ? "Request timeout"
              : "Failed to fetch PumpFun quote",
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

    // Pump.fun and DexScreener support locally on the Cloudflare worker
    const PUMPFUN_API_BASE =
      (env as any)?.PUMPFUN_API_BASE || "https://pump.fun/api";
    const DEXSCREENER_BASE =
      (env as any)?.DEXSCREENER_BASE ||
      "https://api.dexscreener.com/latest/dex";

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
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          },
        );
        const text = await resp.text().catch(() => "");
        return new Response(text, {
          status: resp.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (e: any) {
        return new Response(
          JSON.stringify({
            error: "Failed to check curve state",
            details: String(e?.message || e),
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
      } catch (e: any) {
        const isTimeout = e?.name === "AbortError";
        return new Response(
          JSON.stringify({
            error: "Failed to request BUY transaction",
            details: isTimeout
              ? "Request timeout - Pump.fun API took too long to respond"
              : String(e?.message || e),
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
      } catch (e: any) {
        const isTimeout = e?.name === "AbortError";
        return new Response(
          JSON.stringify({
            error: "Failed to request SELL transaction",
            details: isTimeout
              ? "Request timeout - Pump.fun API took too long to respond"
              : String(e?.message || e),
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
      } catch (e: any) {
        return new Response(
          JSON.stringify({ error: String(e?.message || e) }),
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

    // Wallet balance: /api/wallet/balance?publicKey=... (also supports wallet/address)
    if (pathname === "/api/wallet/balance" && request.method === "GET") {
      const publicKey =
        url.searchParams.get("publicKey") ||
        url.searchParams.get("wallet") ||
        url.searchParams.get("address");

      if (!publicKey) {
        return new Response(
          JSON.stringify({ error: "Missing wallet address parameter" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }

      const RPC_ENDPOINTS = [
        "https://api.mainnet-beta.solana.com",
        "https://solana.publicnode.com",
        "https://rpc.ankr.com/solana",
      ];

      const rpcBody = {
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [publicKey],
      };

      let lastError = "";
      for (const endpoint of RPC_ENDPOINTS) {
        try {
          const resp = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rpcBody),
          });

          const data = await resp.json();

          if (data.error) {
            lastError = data.error.message || "RPC error";
            continue;
          }

          const lamports = data.result;
          if (typeof lamports === "number" && isFinite(lamports)) {
            return new Response(
              JSON.stringify({
                publicKey,
                balance: lamports / 1_000_000_000,
                balanceLamports: lamports,
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*",
                },
              },
            );
          }
        } catch (e: any) {
          lastError = e?.message || String(e);
          continue;
        }
      }

      return new Response(
        JSON.stringify({
          error: "Failed to fetch balance",
          details: lastError || "All RPC endpoints failed",
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

    // Solana RPC proxy: /api/solana-rpc (POST JSON-RPC)
    if (pathname === "/api/solana-rpc" && request.method === "POST") {
      let rpcRequest: any = null;
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

      if (!rpcRequest || typeof rpcRequest !== "object" || !rpcRequest.method) {
        return new Response(JSON.stringify({ error: "Missing RPC method" }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      const RPC_ENDPOINTS = [
        "https://api.mainnet-beta.solana.com",
        "https://solana.publicnode.com",
        "https://rpc.ankr.com/solana",
      ];

      let lastError = "";
      for (const rpcUrl of RPC_ENDPOINTS) {
        try {
          const resp = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rpcRequest),
          });

          const text = await resp.text();
          return new Response(text, {
            status: resp.status,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch (e: any) {
          lastError = e?.message || String(e);
          continue;
        }
      }

      return new Response(
        JSON.stringify({
          error: "All RPC endpoints failed",
          details: lastError || "Unknown error",
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

    // Forward OTHER /api/ requests to fallback (if needed)
    if (url.pathname.startsWith("/api/")) {
      // Return 404 for unhandled API routes instead of forwarding to broken endpoint
      return new Response(
        JSON.stringify({
          error: "API endpoint not found",
          path: url.pathname,
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Serve front-end UI
    return env.ASSETS.fetch(request);
  },
};
