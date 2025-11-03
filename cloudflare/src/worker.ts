import { json, parseJSON } from "./utils";

export interface Env {
  ALLOWED_PAYMENT: string;
  SOLANA_RPC?: string;
  HELIUS_RPC_URL?: string;
  ALCHEMY_RPC_URL?: string;
  MORALIS_RPC_URL?: string;
}

const DEFAULT_RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana-mainnet.rpc.extrnode.com",
  "https://solana.blockpi.network/v1/rpc/public",
  "https://solana.publicnode.com",
];

function getRpcEndpoints(env: Partial<Env> | undefined): string[] {
  const list = [
    env?.SOLANA_RPC || "",
    env?.HELIUS_RPC_URL || "",
    env?.ALCHEMY_RPC_URL || "",
    env?.MORALIS_RPC_URL || "",
    ...DEFAULT_RPCS,
  ];
  return list.filter(Boolean);
}


async function callRpc(
  env: Partial<Env> | undefined,
  method: string,
  params: any[] = [],
  id: number | string = Date.now(),
) {
  let lastError: Error | null = null;
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
      return { ok: true, body: data } as const;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw new Error(lastError?.message || "All RPC endpoints failed");
}


export default {
  async fetch(
    req: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(req.url);
    const { pathname, searchParams } = url;

    const corsHeaders = {
      "Access-Control-Allow-Origin": req.headers.get("Origin") ?? "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    } as const;

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

    // Disable P2P orders endpoints handled elsewhere
    if (pathname.startsWith("/api/p2p/orders")) {
      return json(
        { error: "P2P orders API is disabled on this server" },
        { status: 410, headers: corsHeaders },
      );
    }

    // Wallet balance: /api/wallet/balance?publicKey=...
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
          const balance = lamports / 1_000_000_000;
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

        let lastError: Error | null = null;

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
      } catch (e: any) {
        return json(
          { error: "Failed to execute RPC call", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }


    // Dedicated token price endpoint: /api/token/price
    if (pathname === "/api/token/price" && req.method === "GET") {
      try {
        const tokenParam = (
          url.searchParams.get("token") ||
          url.searchParams.get("symbol") ||
          "FIXERCOIN"
        ).toUpperCase();
        const mintParam = url.searchParams.get("mint") || "";

        const TOKEN_MINTS: Record<string, string> = {
          SOL: "So11111111111111111111111111111111111111112",
          USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
          FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
          LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
        };

        const MINT_TO_PAIR_ADDRESS_EX: Record<string, string> = {
          H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump:
            "5CgLEWq9VJUEQ8my8UaxEovuSWArGoXCvaftpbX4RQMy",
        };

        const MINT_TO_SEARCH_SYMBOL: Record<string, string> = {
          H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: "FIXERCOIN",
          EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: "LOCKER",
        };

        const FALLBACK_USD: Record<string, number> = {
          FIXERCOIN: 0.005,
          SOL: 180,
          USDC: 1.0,
          USDT: 1.0,
          LOCKER: 0.1,
        };

        const PKR_PER_USD = 280; // base FX
        const MARKUP = 1.0425; // 4.25%

        // Determine token symbol and mint to query
        let token = tokenParam;
        let mint = mintParam || TOKEN_MINTS[token] || "";

        // If tokenParam looks like a mint (long base58), use it as mint and try to resolve symbol
        if (!mint && tokenParam && tokenParam.length > 40) {
          mint = tokenParam;
          const inv = Object.entries(TOKEN_MINTS).find(([, m]) => m === mint);
          if (inv) token = inv[0];
        }

        let priceUsd: number | null = null;

        // Stablecoins -> 1
        if (token === "USDC" || token === "USDT") {
          priceUsd = 1.0;
        } else {
          // Use fallback prices for non-stablecoins
          priceUsd = FALLBACK_USD[token] ?? FALLBACK_USD.FIXERCOIN;
        }

        const rateInPKR = priceUsd * PKR_PER_USD * MARKUP;
        return json(
          {
            token,
            priceUsd,
            priceInPKR: rateInPKR,
            rate: rateInPKR,
            pkrPerUsd: PKR_PER_USD,
            markup: MARKUP,
          },
          { headers: corsHeaders },
        );
      } catch (e: any) {
        return json(
          { error: "Failed to get token price", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Pump.fun swap quote: /api/swap/quote: /api/swap/quote?mint=...
    if (pathname === "/api/swap/quote" && req.method === "GET") {
      const mint = url.searchParams.get("mint") || "";

      if (!mint) {
        return json(
          { error: "Missing 'mint' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(
          `https://pumpportal.fun/api/quote?mint=${encodeURIComponent(mint)}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (!resp.ok) {
          return json(
            { error: `Pump.fun API returned ${resp.status}` },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          { error: "Failed to fetch swap quote", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Pump.fun swap execution: /api/swap/execute (POST)
    if (pathname === "/api/swap/execute" && req.method === "POST") {
      try {
        const body = await parseJSON(req);

        if (!body || typeof body !== "object") {
          return json(
            { error: "Invalid request body" },
            { status: 400, headers: corsHeaders },
          );
        }

        const {
          mint,
          amount,
          decimals,
          slippage,
          txVersion,
          priorityFee,
          wallet,
        } = body as any;

        if (!mint || !amount) {
          return json(
            { error: "Missing required fields: mint, amount" },
            { status: 400, headers: corsHeaders },
          );
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const swapPayload = {
          mint,
          amount: String(amount),
          decimals: decimals || 6,
          slippage: slippage || 10,
          txVersion: txVersion || "V0",
          priorityFee: priorityFee || 0.0005,
          wallet: wallet,
        };

        const resp = await fetch("https://pumpportal.fun/api/trade", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(swapPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          const errorText = await resp.text();
          return json(
            {
              error: `Pump.fun API returned ${resp.status}`,
              details: errorText,
            },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          {
            error: "Failed to execute swap",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Jupiter swap quote: /api/swap/jupiter/quote?inputMint=...&outputMint=...&amount=...
    if (pathname === "/api/swap/jupiter/quote" && req.method === "GET") {
      const inputMint = url.searchParams.get("inputMint") || "";
      const outputMint = url.searchParams.get("outputMint") || "";
      const amount = url.searchParams.get("amount") || "";

      if (!inputMint || !outputMint || !amount) {
        return json(
          {
            error: "Missing required parameters: inputMint, outputMint, amount",
          },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const jupiterUrl = new URL("https://quote-api.jup.ag/v6/quote");
        jupiterUrl.searchParams.set("inputMint", inputMint);
        jupiterUrl.searchParams.set("outputMint", outputMint);
        jupiterUrl.searchParams.set("amount", amount);
        jupiterUrl.searchParams.set("slippageBps", "500");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(jupiterUrl.toString(), {
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          return json(
            { error: `Jupiter API returned ${resp.status}` },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          {
            error: "Failed to fetch Jupiter swap quote",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Jupiter price: /api/jupiter/price?ids=...
    if (pathname === "/api/jupiter/price" && req.method === "GET") {
      const ids = searchParams.get("ids") || "";
      if (!ids) {
        return json(
          { error: "Missing 'ids' query parameter" },
          { status: 400, headers: corsHeaders },
        );
      }
      try {
        const url_str = `https://price.jup.ag/v4/price?ids=${encodeURIComponent(ids)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(url_str, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) {
          return json(
            { error: "Jupiter API error" },
            { status: resp.status, headers: corsHeaders },
          );
        }
        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          {
            error: "Failed to fetch Jupiter prices",
            details: e?.message || String(e),
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Jupiter quote: /api/jupiter/quote?inputMint=...&outputMint=...&amount=...
    if (pathname === "/api/jupiter/quote" && req.method === "GET") {
      const inputMint = searchParams.get("inputMint") || "";
      const outputMint = searchParams.get("outputMint") || "";
      const amount = searchParams.get("amount") || "";
      const slippageBps = searchParams.get("slippageBps") || "50";

      if (!inputMint || !outputMint || !amount) {
        return json(
          {
            error: "Missing required parameters: inputMint, outputMint, amount",
          },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const url_str = `https://quote-api.jup.ag/v6/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}&slippageBps=${encodeURIComponent(slippageBps)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const resp = await fetch(url_str, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) {
          return json(
            { error: "Jupiter API error" },
            { status: resp.status, headers: corsHeaders },
          );
        }
        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          {
            error: "Failed to fetch Jupiter quote",
            details: e?.message || String(e),
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Jupiter swap: /api/jupiter/swap (POST)
    if (pathname === "/api/jupiter/swap" && req.method === "POST") {
      try {
        const body = await parseJSON(req);
        const resp = await fetch("https://quote-api.jup.ag/v6/swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          return json(
            { error: "Jupiter swap failed" },
            { status: resp.status, headers: corsHeaders },
          );
        }
        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          {
            error: "Failed to execute Jupiter swap",
            details: e?.message || String(e),
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Jupiter tokens: /api/jupiter/tokens?type=strict|all
    if (pathname === "/api/jupiter/tokens" && req.method === "GET") {
      const type = searchParams.get("type") || "strict";
      try {
        const url_str = `https://token.jup.ag/${type}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(url_str, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) {
          return json(
            { error: "Jupiter tokens API error" },
            { status: resp.status, headers: corsHeaders },
          );
        }
        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          {
            error: "Failed to fetch Jupiter tokens",
            details: e?.message || String(e),
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Pumpfun quote: /api/pumpfun/quote (POST or GET)
    if (pathname === "/api/pumpfun/quote") {
      if (req.method === "POST" || req.method === "GET") {
        let inputMint = "";
        let outputMint = "";
        let amount = "";

        if (req.method === "POST") {
          const body = await parseJSON(req);
          inputMint = body?.inputMint || "";
          outputMint = body?.outputMint || "";
          amount = body?.amount || "";
        } else {
          inputMint = searchParams.get("inputMint") || "";
          outputMint = searchParams.get("outputMint") || "";
          amount = searchParams.get("amount") || "";
        }

        if (!inputMint || !outputMint || !amount) {
          return json(
            {
              error:
                "Missing required parameters: inputMint, outputMint, amount",
            },
            { status: 400, headers: corsHeaders },
          );
        }

        try {
          const url_str = `https://api.pumpfun.com/api/v1/quote?input_mint=${encodeURIComponent(inputMint)}&output_mint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const resp = await fetch(url_str, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!resp.ok) {
            return json(
              { error: "Pumpfun API error" },
              { status: resp.status, headers: corsHeaders },
            );
          }
          const data = await resp.json();
          return json(data, { headers: corsHeaders });
        } catch (e: any) {
          return json(
            {
              error: "Failed to fetch Pumpfun quote",
              details: e?.message || String(e),
            },
            { status: 502, headers: corsHeaders },
          );
        }
      }
      return json(
        { error: "Method not allowed" },
        { status: 405, headers: corsHeaders },
      );
    }

    // Pumpfun swap: /api/pumpfun/swap (POST)
    if (pathname === "/api/pumpfun/swap" && req.method === "POST") {
      try {
        const body = await parseJSON(req);

        if (!body || typeof body !== "object") {
          return json(
            { error: "Invalid request body" },
            { status: 400, headers: corsHeaders },
          );
        }

        const resp = await fetch("https://api.pumpfun.com/api/v1/swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          return json(
            { error: "Pumpfun swap failed" },
            { status: resp.status, headers: corsHeaders },
          );
        }
        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          {
            error: "Failed to execute Pumpfun swap",
            details: e?.message || String(e),
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Forex rate proxy: /api/forex/rate?base=USD&symbols=PKR
    if (pathname === "/api/forex/rate" && req.method === "GET") {
      const base = (searchParams.get("base") || "USD").toUpperCase();
      const symbols = (searchParams.get("symbols") || "PKR").toUpperCase();
      const firstSymbol = symbols.split(",")[0];
      const providers: Array<{
        url: string;
        parse: (j: any) => number | null;
      }> = [
        {
          url: `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(firstSymbol)}`,
          parse: (j) =>
            j && j.rates && typeof j.rates[firstSymbol] === "number"
              ? j.rates[firstSymbol]
              : null,
        },
        {
          url: `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(firstSymbol)}`,
          parse: (j) =>
            j && j.rates && typeof j.rates[firstSymbol] === "number"
              ? j.rates[firstSymbol]
              : null,
        },
        {
          url: `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
          parse: (j) =>
            j && j.rates && typeof j.rates[firstSymbol] === "number"
              ? j.rates[firstSymbol]
              : null,
        },
        {
          url: `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/${base.toLowerCase()}/${firstSymbol.toLowerCase()}.json`,
          parse: (j) =>
            j && typeof j[firstSymbol.toLowerCase()] === "number"
              ? j[firstSymbol.toLowerCase()]
              : null,
        },
      ];
      let lastErr = "";
      for (const p of providers) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000);
          const resp = await fetch(p.url, { signal: controller.signal });
          clearTimeout(timeout);
          if (!resp.ok) {
            lastErr = `${resp.status} ${resp.statusText}`;
            continue;
          }
          const apiJson = await resp.json();
          const rate = p.parse(apiJson);
          if (typeof rate === "number" && isFinite(rate) && rate > 0) {
            return json(
              {
                base,
                symbols: [firstSymbol],
                rates: { [firstSymbol]: rate },
              },
              { headers: corsHeaders },
            );
          }
          lastErr = "invalid response";
        } catch (e: any) {
          lastErr = e?.message || String(e);
        }
      }
      return json(
        {
          error: "Failed to fetch forex rate",
          details: lastErr,
        },
        { status: 502, headers: corsHeaders },
      );
    }

    // Stablecoin 24h change: /api/stable-24h?symbols=USDC,USDT
    if (pathname === "/api/stable-24h" && req.method === "GET") {
      const symbolsParam = (
        searchParams.get("symbols") || "USDC,USDT"
      ).toUpperCase();
      const symbols = Array.from(
        new Set(
          String(symbolsParam)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      );

      const COINGECKO_IDS: Record<string, { id: string; mint: string }> = {
        USDC: {
          id: "usd-coin",
          mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        },
        USDT: {
          id: "tether",
          mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
        },
      };

      const ids = symbols
        .map((s) => COINGECKO_IDS[s]?.id)
        .filter(Boolean)
        .join(",");
      if (!ids) {
        return json(
          { error: "No supported symbols provided" },
          { status: 400, headers: corsHeaders },
        );
      }

      const url_str = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`;
      let result: Record<
        string,
        { priceUsd: number; change24h: number; mint: string }
      > = {};
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const resp = await fetch(url_str, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timeout);
        if (resp.ok) {
          const apiJson = await resp.json();
          symbols.forEach((sym) => {
            const meta = COINGECKO_IDS[sym];
            if (!meta) return;
            const d = apiJson?.[meta.id];
            const price = typeof d?.usd === "number" ? d.usd : 1;
            const change =
              typeof d?.usd_24h_change === "number" ? d.usd_24h_change : 0;
            result[sym] = {
              priceUsd: price,
              change24h: change,
              mint: meta.mint,
            };
          });
        } else {
          symbols.forEach((sym) => {
            const meta = COINGECKO_IDS[sym];
            if (!meta) return;
            result[sym] = { priceUsd: 1, change24h: 0, mint: meta.mint };
          });
        }
      } catch {
        symbols.forEach((sym) => {
          const meta = COINGECKO_IDS[sym];
          if (!meta) return;
          result[sym] = { priceUsd: 1, change24h: 0, mint: meta.mint };
        });
      }

      return json({ data: result }, { headers: corsHeaders });
    }

    // Get transaction details: /api/transaction?signature=...
    if (pathname === "/api/transaction" && req.method === "GET") {
      const signature = searchParams.get("signature") || "";

      if (!signature) {
        return json(
          { error: "Missing 'signature' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const rpcUrl = "https://api.mainnet-beta.solana.com";
        const payload = {
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: [
            signature,
            { encoding: "json", maxSupportedTransactionVersion: 0 },
          ],
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(rpcUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await resp.json();
        return json(data, { status: resp.status, headers: corsHeaders });
      } catch (e: any) {
        return json(
          { error: "Failed to fetch transaction", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Get account information: /api/account?publicKey=...
    if (pathname === "/api/account" && req.method === "GET") {
      const publicKey = searchParams.get("publicKey") || "";

      if (!publicKey) {
        return json(
          { error: "Missing 'publicKey' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const rpcUrl = "https://api.mainnet-beta.solana.com";
        const payload = {
          jsonrpc: "2.0",
          id: 1,
          method: "getAccountInfo",
          params: [publicKey, { encoding: "jsonParsed" }],
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(rpcUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await resp.json();
        return json(data, { status: resp.status, headers: corsHeaders });
      } catch (e: any) {
        return json(
          { error: "Failed to fetch account", details: e?.message },
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
