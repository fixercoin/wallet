// Utility functions
function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

async function parseJSON(req) {
  try {
    const text = await req.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Constants
const DEFAULT_RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana-mainnet.rpc.extrnode.com",
  "https://solana.blockpi.network/v1/rpc/public",
  "https://solana.publicnode.com",
];

function getRpcEndpoints(env) {
  const list = [
    env?.SOLANA_RPC || "",
    env?.HELIUS_RPC_URL || "",
    env?.ALCHEMY_RPC_URL || "",
    env?.MORALIS_RPC_URL || "",
    ...DEFAULT_RPCS,
  ];
  return list.filter(Boolean);
}

// Helper functions
async function callRpc(env, method, params = [], id = Date.now()) {
  let lastError = null;
  const payload = {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };

  const endpoints = getRpcEndpoints(env);
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        if ([429, 502, 503].includes(resp.status)) continue;
        const t = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}. ${t}`);
      }

      const data = await resp.text();
      return { ok: true, body: data };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw new Error(lastError?.message || "All RPC endpoints failed");
}

// Main worker export
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const { pathname, searchParams } = url;

    const corsHeaders = {
      "Access-Control-Allow-Origin": req.headers.get("Origin") ?? "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (
      pathname === "/" ||
      pathname === "/api/health" ||
      pathname === "/api/ping"
    ) {
      return json(
        { status: "ok", timestamp: new Date().toISOString() },
        { headers: corsHeaders },
      );
    }

    // Wallet balance
    if (pathname === "/api/wallet/balance" && req.method === "GET") {
      const pk =
        searchParams.get("publicKey") ||
        searchParams.get("wallet") ||
        searchParams.get("address") ||
        "";
      if (!pk) {
        return json(
          { error: "Missing 'publicKey' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const rpc = await callRpc(env, "getBalance", [pk], Date.now());
        const j = JSON.parse(String(rpc?.body || "{}"));
        const lamports =
          typeof j.result === "number" ? j.result : (j?.result?.value ?? null);
        if (typeof lamports === "number" && isFinite(lamports)) {
          const balance = lamports / 1000000000;
          return json(
            {
              publicKey: pk,
              balance,
              balanceLamports: lamports,
            },
            { headers: corsHeaders },
          );
        }
        return json(
          { error: "Invalid RPC response" },
          { status: 502, headers: corsHeaders },
        );
      } catch (e) {
        return json(
          {
            error: "Failed to fetch balance",
            details: e instanceof Error ? e.message : String(e),
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Solana RPC
    if (pathname === "/api/solana-rpc" && req.method === "POST") {
      try {
        const body = await parseJSON(req);

        if (!body || typeof body !== "object") {
          return json(
            { error: "Invalid request body" },
            { status: 400, headers: corsHeaders },
          );
        }

        const methodName = body?.method;
        const params = body?.params ?? [];
        const id = body?.id ?? Date.now();

        if (!methodName || typeof methodName !== "string") {
          return json(
            { error: "Missing RPC method" },
            { status: 400, headers: corsHeaders },
          );
        }

        const payload = {
          jsonrpc: "2.0",
          id,
          method: methodName,
          params,
        };

        let lastError = null;

        const endpoints = getRpcEndpoints(env);
        for (const endpoint of endpoints) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const resp = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!resp.ok) {
              if ([429, 502, 503].includes(resp.status)) continue;
              const t = await resp.text().catch(() => "");
              throw new Error(`HTTP ${resp.status}: ${resp.statusText}. ${t}`);
            }

            const data = await resp.text();
            return new Response(data, {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            });
          } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
          }
        }

        return json(
          { error: "All RPC endpoints failed", details: lastError?.message },
          { status: 502, headers: corsHeaders },
        );
      } catch (e) {
        return json(
          { error: "Failed to execute RPC call", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // DexScreener tokens proxy
    if (pathname === "/api/dexscreener/tokens" && req.method === "GET") {
      const mints = searchParams.get("mints") || "";
      if (!mints) {
        return json(
          { error: "Missing 'mints' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      const mintList = mints
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      if (mintList.length === 0) {
        return json(
          { error: "No valid mints provided" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const batch = mintList.join(",");
        const dexUrl = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(batch)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(dexUrl, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const data = await resp.json();
          return json(data, { headers: corsHeaders });
        }

        const pairs = [];
        for (const mint of mintList) {
          try {
            const individualUrl = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`;
            const individualResp = await fetch(individualUrl, {
              headers: { Accept: "application/json" },
            });
            if (individualResp.ok) {
              const data = await individualResp.json();
              if (data.pairs && Array.isArray(data.pairs)) {
                pairs.push(...data.pairs);
              }
            }
          } catch (e) {
            console.warn(`Failed to fetch individual token ${mint}:`, e);
          }
        }

        return json(
          { schemaVersion: "1.0.0", pairs },
          { headers: corsHeaders },
        );
      } catch (e) {
        return json(
          {
            error: "Failed to fetch DexScreener tokens",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // SOL price proxy - with improved fallback logic
    if (pathname === "/api/sol/price" && req.method === "GET") {
      const SOL_MINT = "So11111111111111111111111111111111111111112";
      const endpoints = [
        `https://api.dexscreener.com/latest/dex/tokens/${SOL_MINT}`,
        `https://api.dexscreener.io/latest/dex/tokens/${SOL_MINT}`,
      ];
      let lastError = null;

      for (const dexUrl of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const resp = await fetch(dexUrl, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (resp.ok) {
            const data = await resp.json();
            const pairs = Array.isArray(data?.pairs) ? data.pairs : [];

            // Find the best pair (typically the first one with good liquidity)
            const pair = pairs.find(
              (p) => p && p.priceUsd && parseFloat(p.priceUsd) > 0,
            );

            if (pair) {
              const price = parseFloat(pair.priceUsd);
              // Get 24h price change from either priceChange.h24 or priceChange24h
              const priceChange24h =
                pair?.priceChange?.h24 ??
                pair?.priceChange24h ??
                pair?.price24hChange ??
                0;

              console.log(
                `[SOL Price] Success: $${price}, 24h change: ${priceChange24h}%`,
              );

              return json(
                {
                  token: "SOL",
                  price,
                  priceUsd: price,
                  price_change_24h: priceChange24h,
                  volume_24h: pair?.volume?.h24 ?? 0,
                  market_cap: pair?.marketCap ?? 0,
                },
                { headers: corsHeaders },
              );
            }
          }
          lastError = `DexScreener returned ${resp.status}`;
        } catch (e) {
          lastError = e?.message || String(e);
        }
      }

      console.warn(`[SOL Price] All endpoints failed:`, lastError);

      // Fallback to static price
      return json(
        {
          token: "SOL",
          price: 180,
          priceUsd: 180,
          price_change_24h: 0,
          volume_24h: 0,
          market_cap: 0,
        },
        { headers: corsHeaders },
      );
    }

    // Unified quote endpoint - with improved fallback logic
    if (pathname === "/api/quote" && req.method === "GET") {
      const inputMint = searchParams.get("inputMint") || "";
      const outputMint = searchParams.get("outputMint") || "";
      const amount = searchParams.get("amount") || "";
      const provider = (searchParams.get("provider") || "auto").toLowerCase();

      if (!inputMint || !outputMint || !amount) {
        return json(
          {
            error: "Missing required parameters: inputMint, outputMint, amount",
          },
          { status: 400, headers: corsHeaders },
        );
      }

      const providers = [
        {
          name: "jupiter",
          url: `https://quote-api.jup.ag/v6/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}&slippageBps=500`,
        },
        {
          name: "meteora",
          url: `https://api.meteora.ag/swap/v3/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}`,
        },
        {
          name: "dexscreener",
          url: `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(inputMint)}`,
        },
      ];

      let lastErrors = [];

      for (const p of providers) {
        if (provider !== "auto" && provider !== p.name) continue;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const resp = await fetch(p.url, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (resp.ok) {
            const data = await resp.json();

            // For DexScreener, transform response to match quote format
            if (
              p.name === "dexscreener" &&
              data.pairs &&
              Array.isArray(data.pairs)
            ) {
              const pair = data.pairs[0];
              if (pair && pair.priceUsd) {
                return json(
                  {
                    source: "dexscreener",
                    quote: {
                      inAmount: amount,
                      outAmount: pair.priceUsd,
                      priceImpact: 0,
                      priceChange24h: pair.priceChange?.h24 ?? 0,
                    },
                  },
                  { headers: corsHeaders },
                );
              }
            } else if (p.name !== "dexscreener") {
              return json(
                { source: p.name, quote: data },
                { headers: corsHeaders },
              );
            }
          }

          lastErrors.push(`${p.name}: ${resp.status}`);
        } catch (e) {
          lastErrors.push(`${p.name}: ${e?.message || String(e)}`);
        }
      }

      console.warn(`[/api/quote] All providers failed:`, lastErrors);

      return json(
        {
          error: "Failed to fetch quote from any provider",
          details: lastErrors.join(" | ") || "All providers failed",
          providers_attempted: ["jupiter", "meteora", "dexscreener"],
        },
        { status: 502, headers: corsHeaders },
      );
    }

    // Unified swap execution endpoint
    if (pathname === "/api/swap" && req.method === "POST") {
      try {
        const body = await parseJSON(req);

        if (!body || typeof body !== "object") {
          return json(
            { error: "Invalid request body" },
            { status: 400, headers: corsHeaders },
          );
        }

        const provider = (body.provider || "auto").toLowerCase();
        const { inputMint, outputMint, amount, mint, wallet } = body;

        // Try Pumpfun swap if mint is provided
        if ((provider === "pumpfun" || provider === "auto") && mint && amount) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const swapPayload = {
              mint,
              amount: String(amount),
              decimals: body.decimals || 6,
              slippage: body.slippage || 10,
              txVersion: body.txVersion || "V0",
              priorityFee: body.priorityFee || 0.0005,
              wallet,
            };

            const resp = await fetch("https://api.pumpfun.com/api/v1/swap", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(swapPayload),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (resp.ok) {
              const data = await resp.json();
              return json(
                { source: "pumpfun", swap: data },
                { headers: corsHeaders },
              );
            }
          } catch (e) {
            if (provider === "pumpfun") {
              return json(
                { error: "Pumpfun swap failed", details: e?.message },
                { status: 502, headers: corsHeaders },
              );
            }
          }
        }

        // Try Jupiter swap if inputMint is provided
        if (
          (provider === "jupiter" || provider === "auto") &&
          inputMint &&
          body.routePlan
        ) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const resp = await fetch("https://quote-api.jup.ag/v6/swap", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (resp.ok) {
              const data = await resp.json();
              return json(
                { source: "jupiter", swap: data },
                { headers: corsHeaders },
              );
            }
          } catch (e) {
            if (provider === "jupiter") {
              return json(
                { error: "Jupiter swap failed", details: e?.message },
                { status: 502, headers: corsHeaders },
              );
            }
          }
        }

        return json(
          {
            error:
              "Unable to execute swap - missing required fields or unsupported provider",
            required: ["mint or inputMint", "amount", "provider (optional)"],
          },
          { status: 400, headers: corsHeaders },
        );
      } catch (e) {
        return json(
          {
            error: "Failed to execute swap",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // 404 for unknown routes
    return json(
      { error: "API endpoint not found", path: pathname },
      { status: 404, headers: corsHeaders },
    );
  },
};
