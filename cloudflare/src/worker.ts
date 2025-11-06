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

    // Birdeye price endpoint: /api/birdeye/price?address=...
    if (pathname === "/api/birdeye/price" && request.method === "GET") {
      const address = url.searchParams.get("address");
      if (!address) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Missing 'address' parameter",
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

      const BIRDEYE_API_KEY =
        (env as any)?.BIRDEYE_API_KEY || "cecae2ad38d7461eaf382f533726d9bb";
      const BIRDEYE_API_URL = "https://public-api.birdeye.so";

      // Known token mints and fallback prices
      const TOKEN_MINTS: Record<string, string> = {
        SOL: "So11111111111111111111111111111111111111112",
        USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
        FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
        LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
      };

      const FALLBACK_USD: Record<string, number> = {
        FIXERCOIN: 0.00008139,
        SOL: 149.38,
        USDC: 1.0,
        USDT: 1.0,
        LOCKER: 0.00001112,
      };

      // Try Birdeye first
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const birdeyeResp = await fetch(
          `${BIRDEYE_API_URL}/public/price?address=${encodeURIComponent(address)}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              "X-API-KEY": BIRDEYE_API_KEY,
            },
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (birdeyeResp.ok) {
          const data = await birdeyeResp.json();
          if (data.success && data.data) {
            return new Response(
              JSON.stringify({
                success: true,
                data: {
                  address: data.data.address,
                  value: data.data.value,
                  updateUnixTime: data.data.updateUnixTime,
                  priceChange24h: data.data.priceChange24h || 0,
                },
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
        }
      } catch (e: any) {
        // Continue to fallback
      }

      // Fallback 1: Try DexScreener
      try {
        const dexResp = await fetch(
          `${DEXSCREENER_BASE}/tokens/${encodeURIComponent(address)}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          },
        );
        if (dexResp.ok) {
          const dexData = await dexResp.json();
          const pairs = Array.isArray(dexData?.pairs) ? dexData.pairs : [];

          if (pairs.length > 0) {
            const pair = pairs.find(
              (p: any) =>
                (p?.baseToken?.address === address ||
                  p?.quoteToken?.address === address) &&
                p?.priceUsd,
            );

            if (pair && pair.priceUsd) {
              const price = parseFloat(pair.priceUsd);
              if (isFinite(price) && price > 0) {
                return new Response(
                  JSON.stringify({
                    success: true,
                    data: {
                      address,
                      value: price,
                      updateUnixTime: Math.floor(Date.now() / 1000),
                      priceChange24h: pair.priceChange?.h24 || 0,
                    },
                    _source: "dexscreener",
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
            }
          }
        }
      } catch (e: any) {
        // Continue to fallback
      }

      // Fallback 2: Try Jupiter
      try {
        const jupiterResp = await fetch(
          `https://api.jup.ag/price?ids=${encodeURIComponent(address)}`,
          { headers: { Accept: "application/json" } },
        );
        if (jupiterResp.ok) {
          const jupData = await jupiterResp.json();
          const priceData = jupData?.data?.[address];

          if (priceData?.price) {
            const price = parseFloat(priceData.price);
            if (isFinite(price) && price > 0) {
              return new Response(
                JSON.stringify({
                  success: true,
                  data: {
                    address,
                    value: price,
                    updateUnixTime: Math.floor(Date.now() / 1000),
                    priceChange24h: 0,
                  },
                  _source: "jupiter",
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
          }
        }
      } catch (e: any) {
        // Continue to fallback
      }

      // Fallback 3: Hardcoded fallback prices
      for (const [symbol, mint] of Object.entries(TOKEN_MINTS)) {
        if (mint === address && FALLBACK_USD[symbol]) {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                address,
                value: FALLBACK_USD[symbol],
                updateUnixTime: Math.floor(Date.now() / 1000),
                priceChange24h: 0,
              },
              _source: "fallback",
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
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "No price data available for this token",
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

      // Use configured RPC endpoint if available, with public fallbacks
      const configuredRPC = (env as any)?.SOLANA_RPC;
      const RPC_ENDPOINTS = [
        configuredRPC || "https://api.mainnet-beta.solana.com",
        "https://solana.publicnode.com",
        "https://rpc.ankr.com/solana",
        "https://solana-rpc.publicnode.com",
      ].filter((url, index, self) => self.indexOf(url) === index);

      const rpcBody = {
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [publicKey],
      };

      let lastError = "";
      for (const endpoint of RPC_ENDPOINTS) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          const resp = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rpcBody),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
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
          lastError = e?.name === "AbortError"
            ? "Request timeout"
            : e?.message || String(e);
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

      // Use configured RPC endpoint if available, with public fallbacks
      const configuredRPC = (env as any)?.SOLANA_RPC;
      const RPC_ENDPOINTS = [
        configuredRPC || "https://api.mainnet-beta.solana.com",
        "https://solana.publicnode.com",
        "https://rpc.ankr.com/solana",
        "https://solana-rpc.publicnode.com",
        "https://api.mainnet-beta.solana.com",
      ].filter((url, index, self) => self.indexOf(url) === index);

      let lastError = "";
      let lastStatus = 0;

      for (let attempt = 0; attempt < RPC_ENDPOINTS.length; attempt++) {
        const rpcUrl = RPC_ENDPOINTS[attempt];

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

          const resp = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rpcRequest),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          lastStatus = resp.status;

          const text = await resp.text();

          // If we got a successful response, return it
          if (resp.status === 200) {
            return new Response(text, {
              status: resp.status,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            });
          }

          // For error responses, try to parse and check for JSON-RPC error
          try {
            const json = JSON.parse(text);
            // If response is valid JSON-RPC (even if status is not 200), return it
            if (json.result !== undefined || json.error !== undefined) {
              return new Response(text, {
                status: 200, // Return 200 for valid JSON-RPC responses
                headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*",
                },
              });
            }
          } catch {
            // Not JSON, continue
          }

          lastError = text || resp.statusText;

          // Don't retry on 4xx errors (except maybe 429 rate limit)
          if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) {
            break;
          }

          // Continue to next endpoint for server errors
          continue;
        } catch (e: any) {
          lastError = e?.name === "AbortError"
            ? "Request timeout"
            : e?.message || String(e);

          // Continue to next endpoint on timeout/network errors
          continue;
        }
      }

      // All endpoints failed
      return new Response(
        JSON.stringify({
          error: "All RPC endpoints failed",
          details: lastError || "Unknown error",
          attempted: RPC_ENDPOINTS.length,
          lastStatus: lastStatus || 502,
        }),
        {
          status: lastStatus || 502,
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
