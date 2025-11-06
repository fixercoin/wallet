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

// Helper function to sign transactions with a keypair
function signTransactionWithKeypair(transactionBuffer, secretKeyBase58) {
  console.warn(
    "[Wallet Signing] Warning: Server-side signing is not implemented for security reasons. Use client-side signing instead.",
  );
  return transactionBuffer;
}

// Helper function to decode base64 transaction to buffer
function base64ToBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper function to encode buffer to base64
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Constants
const DEFAULT_RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana.blockpi.network/v1/rpc/public",
  "https://solana.publicnode.com",
  "https://solana-rpc.publicnode.com",
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

    // Try to serve static assets first (for built frontend)
    if (req.method === "GET" && !pathname.startsWith("/api")) {
      try {
        const assetResponse = await env.ASSETS.fetch(req);
        if (assetResponse.status !== 404) {
          return assetResponse;
        }
      } catch (e) {
        // ASSETS might not be available, continue to API handling
      }
    }

    // === Simple Jupiter Swap Endpoints ===

    // Minimal Pump.fun tokens registry (kept in worker for preview/server usage)
    const PUMP_TOKENS = [
      {
        symbol: "FIXERCOIN",
        mint: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
        decimals: 6,
      },
      { symbol: "LOCKER", mint: "GpumpLockerTokenMintAddress", decimals: 6 },
    ];

    // GET /api/pump-tokens - return Pump.fun token registry
    if (pathname === "/api/pump-tokens" && req.method === "GET") {
      return json({ tokens: PUMP_TOKENS }, { headers: corsHeaders });
    }

    // GET /api/quote - Get swap quote from Jupiter API
    if (pathname === "/api/quote" && req.method === "GET") {
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

      let lastError = null;
      // Retry logic for transient errors
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000);

          const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}&slippageBps=${encodeURIComponent(slippageBps)}`;

          const resp = await fetch(quoteUrl, {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!resp.ok) {
            const errorText = await resp.text().catch(() => "");
            lastError = { status: resp.status, text: errorText };

            // Retry on 502/503/504 errors
            if (
              attempt < 1 &&
              (resp.status === 502 ||
                resp.status === 503 ||
                resp.status === 504)
            ) {
              await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
              continue;
            }

            return json(
              {
                error: `Jupiter API returned ${resp.status}`,
                details: errorText,
              },
              { status: resp.status, headers: corsHeaders },
            );
          }

          const quoteData = await resp.json();
          return json(quoteData, { headers: corsHeaders });
        } catch (e) {
          lastError = e;
          if (
            attempt < 1 &&
            (e?.message?.includes("timeout") || e?.message?.includes("network"))
          ) {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
        }
      }

      return json(
        {
          error: "Failed to fetch quote from Jupiter",
          details: lastError?.message || lastError?.text || String(lastError),
        },
        { status: 502, headers: corsHeaders },
      );
    }

    // POST /api/swap - Execute swap and return transaction
    if (pathname === "/api/swap" && req.method === "POST") {
      try {
        const body = await parseJSON(req);

        if (!body || typeof body !== "object") {
          return json(
            { error: "Invalid request body" },
            { status: 400, headers: corsHeaders },
          );
        }

        const { quoteResponse, userPublicKey } = body;

        if (!quoteResponse || !userPublicKey) {
          return json(
            {
              error: "Missing required fields: quoteResponse, userPublicKey",
            },
            { status: 400, headers: corsHeaders },
          );
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const swapPayload = {
          quoteResponse,
          userPublicKey,
          wrapAndUnwrapSol: true,
        };

        const resp = await fetch("https://quote-api.jup.ag/v6/swap", {
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
          const errorText = await resp.text().catch(() => "");
          return json(
            {
              error: `Jupiter API returned ${resp.status}`,
              details: errorText,
            },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const swapData = await resp.json();

        if (swapData.error) {
          return json(
            { error: swapData.error },
            { status: 400, headers: corsHeaders },
          );
        }

        return json(
          { swapTransaction: swapData.swapTransaction },
          { headers: corsHeaders },
        );
      } catch (e) {
        return json(
          { error: "Failed to execute swap", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
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
          {
            error: "Failed to execute RPC call",
            details: e?.message || String(e),
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // DexScreener tokens proxy: /api/dexscreener/tokens?mints=<MINT1>,<MINT2>...
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

        // Fallback: try individual token lookups
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

    // DexScreener search proxy: /api/dexscreener/search?q=<QUERY>
    if (pathname === "/api/dexscreener/search" && req.method === "GET") {
      const q = searchParams.get("q") || "";
      if (!q) {
        return json(
          { error: "Missing 'q' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const dexUrl = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`;
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

        return json(
          { schemaVersion: "1.0.0", pairs: [] },
          { status: resp.status, headers: corsHeaders },
        );
      } catch (e) {
        return json(
          {
            error: "Failed to search DexScreener",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // DexScreener trending proxy: /api/dexscreener/trending
    if (pathname === "/api/dexscreener/trending" && req.method === "GET") {
      try {
        const dexUrl = `https://api.dexscreener.com/latest/dex/pairs/solana`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(dexUrl, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const data = await resp.json();
          const sorted = (data.pairs || [])
            .filter(
              (p) =>
                p.volume?.h24 > 1000 &&
                p.liquidity?.usd &&
                p.liquidity.usd > 10000,
            )
            .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
            .slice(0, 50);
          return json(
            { schemaVersion: "1.0.0", pairs: sorted },
            { headers: corsHeaders },
          );
        }

        return json(
          { schemaVersion: "1.0.0", pairs: [] },
          { status: resp.status, headers: corsHeaders },
        );
      } catch (e) {
        return json(
          {
            error: "Failed to fetch trending tokens",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // SOL price proxy: /api/sol/price
    if (pathname === "/api/sol/price" && req.method === "GET") {
      const endpoints = [
        "https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112",
      ];
      let lastError = null;

      for (const dexUrl of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000);

          const resp = await fetch(dexUrl, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (resp.ok) {
            const data = await resp.json();
            const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
            if (pairs.length > 0) {
              const pair = pairs[0];
              const price = pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;
              const priceChange24h = pair?.priceChange?.h24 ?? 0;
              console.log(
                `[SOL Price] Price: $${price}, 24h Change: ${priceChange24h}%`,
              );
              return json(
                {
                  success: true,
                  data: {
                    address: "So11111111111111111111111111111111111111112",
                    value: price,
                    priceChange24h,
                    updateUnixTime: Math.floor(Date.now() / 1000),
                  },
                },
                { headers: corsHeaders },
              );
            }
          }
          lastError = resp.status;
        } catch (e) {
          lastError = e?.message || String(e);
        }
      }

      // Fallback SOL price
      console.warn(`[SOL Price] Using fallback price. Error: ${lastError}`);
      const fallbackPrice = 150;
      return json(
        {
          success: true,
          data: {
            address: "So11111111111111111111111111111111111111112",
            value: fallbackPrice,
            priceChange24h: 0,
            updateUnixTime: Math.floor(Date.now() / 1000),
          },
        },
        { headers: corsHeaders },
      );
    }

    // Birdeye price endpoint: /api/birdeye/price?address=<TOKEN_MINT>
    if (pathname === "/api/birdeye/price" && req.method === "GET") {
      const address = searchParams.get("address") || "";

      if (!address) {
        return json(
          { success: false, error: "Missing 'address' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      const TOKEN_MINTS = {
        SOL: "So11111111111111111111111111111111111111112",
        USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
        FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
        LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
      };

      const FALLBACK_USD = {
        FIXERCOIN: 0.00008139,
        SOL: 149.38,
        USDC: 1.0,
        USDT: 1.0,
        LOCKER: 0.00001112,
      };

      const getTokenSymbol = (addr) => {
        for (const [symbol, mint] of Object.entries(TOKEN_MINTS)) {
          if (mint === addr) return symbol;
        }
        return null;
      };

      const getSolPrice = async () => {
        try {
          const dexUrl = `https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112`;
          const dexResp = await fetch(dexUrl, {
            headers: { Accept: "application/json" },
          });

          if (dexResp.ok) {
            const dexData = await dexResp.json();
            const pairs = Array.isArray(dexData?.pairs) ? dexData.pairs : [];

            if (pairs.length > 0) {
              const pair = pairs[0];
              if (pair?.priceUsd) {
                const price = parseFloat(pair.priceUsd);
                if (isFinite(price) && price > 0) {
                  return price;
                }
              }
            }
          }
        } catch (e) {
          console.warn(`[Birdeye] Error fetching SOL price: ${e?.message}`);
        }
        return 150;
      };

      const getDerivedPrice = async (mint) => {
        try {
          console.log(
            `[Birdeye] Fetching derived price for ${mint} via DexScreener`,
          );

          const pairAddresses = {
            H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump:
              "5CgLEWq9VJUEQ8my8UaxEovuSWArGoXCvaftpbX4RQMy",
            EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump:
              "7X7KkV94Y9jFhkXEMhgVcMHMRzALiGj5xKmM6TT3cUvK",
          };

          const pairAddress = pairAddresses[mint];
          if (pairAddress) {
            try {
              console.log(
                `[Birdeye] Trying pair address ${pairAddress} for ${mint}`,
              );
              const pairUrl = `https://api.dexscreener.com/latest/dex/pairs/solana/${encodeURIComponent(pairAddress)}`;
              const pairResp = await fetch(pairUrl, {
                headers: { Accept: "application/json" },
              });

              if (pairResp.ok) {
                const pairData = await pairResp.json();
                const pair = pairData?.pair || (pairData?.pairs?.[0] ?? null);

                if (pair && pair.priceUsd) {
                  const price = parseFloat(pair.priceUsd);
                  if (isFinite(price) && price > 0) {
                    console.log(
                      `[Birdeye] ✅ Got price via pair address: $${price.toFixed(8)}`,
                    );
                    return {
                      price,
                      priceChange24h: pair.priceChange?.h24 || 0,
                      volume24h: pair.volume?.h24 || 0,
                    };
                  }
                }
              }
            } catch (e) {
              console.warn(
                `[Birdeye] Pair address lookup failed: ${e?.message}`,
              );
            }
          }

          const dexUrl = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`;
          const dexResp = await fetch(dexUrl, {
            headers: { Accept: "application/json" },
          });

          if (dexResp.ok) {
            const dexData = await dexResp.json();
            const pairs = Array.isArray(dexData?.pairs) ? dexData.pairs : [];

            if (pairs.length > 0) {
              const pair = pairs.find(
                (p) =>
                  (p?.baseToken?.address === mint ||
                    p?.quoteToken?.address === mint) &&
                  p?.priceUsd,
              );

              if (pair && pair.priceUsd) {
                const price = parseFloat(pair.priceUsd);
                if (isFinite(price) && price > 0) {
                  console.log(
                    `[Birdeye] Derived price for ${mint}: $${price.toFixed(8)}`,
                  );
                  return {
                    price,
                    priceChange24h: pair.priceChange?.h24 || 0,
                    volume24h: pair.volume?.h24 || 0,
                  };
                }
              }
            }
          }
        } catch (e) {
          console.warn(
            `[Birdeye] Error fetching derived price for ${mint}: ${e?.message}`,
          );
        }
        return null;
      };

      const getPriceFromDexScreener = async (mint) => {
        try {
          console.log(`[Birdeye Fallback] Trying DexScreener for ${mint}`);
          const dexUrl = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`;
          const dexResp = await fetch(dexUrl, {
            headers: { Accept: "application/json" },
          });

          if (dexResp.ok) {
            const dexData = await dexResp.json();
            const pairs = Array.isArray(dexData?.pairs) ? dexData.pairs : [];

            if (pairs.length > 0) {
              const pair = pairs.find(
                (p) =>
                  (p?.baseToken?.address === mint ||
                    p?.quoteToken?.address === mint) &&
                  p?.priceUsd,
              );

              if (pair && pair.priceUsd) {
                const price = parseFloat(pair.priceUsd);
                if (isFinite(price) && price > 0) {
                  const priceChange24h = pair?.priceChange?.h24 ?? 0;
                  console.log(
                    `[Birdeye Fallback] ✅ Got price from DexScreener: $${price} (24h: ${priceChange24h}%)`,
                  );
                  return {
                    price,
                    priceChange24h: pair?.priceChange?.h24 ?? 0,
                    volume24h: pair?.volume?.h24 ?? 0,
                  };
                }
              }
            }
          }
        } catch (e) {
          console.warn(`[Birdeye Fallback] DexScreener error: ${e?.message}`);
        }
        return null;
      };

      const getPriceFromJupiter = async (mint) => {
        try {
          console.log(`[Birdeye Fallback] Trying Jupiter for ${mint}`);
          const jupUrl = `https://api.jup.ag/price?ids=${encodeURIComponent(mint)}`;
          const jupResp = await fetch(jupUrl, {
            headers: { Accept: "application/json" },
          });

          if (jupResp.ok) {
            const jupData = await jupResp.json();
            const priceData = jupData?.data?.[mint];

            if (priceData?.price) {
              const price = parseFloat(priceData.price);
              if (isFinite(price) && price > 0) {
                console.log(
                  `[Birdeye Fallback] ✅ Got price from Jupiter: $${price}`,
                );
                return {
                  price,
                  priceChange24h: 0,
                  volume24h: 0,
                };
              }
            }
          }
        } catch (e) {
          console.warn(`[Birdeye Fallback] Jupiter error: ${e?.message}`);
        }
        return null;
      };

      try {
        const birdeyeUrl = `https://public-api.birdeye.so/public/price?address=${encodeURIComponent(address)}`;
        const birdeyeApiKey =
          env.BIRDEYE_API_KEY || "cecae2ad38d7461eaf382f533726d9bb";

        console.log(
          `[Birdeye] Fetching price for ${address} from ${birdeyeUrl}`,
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(birdeyeUrl, {
          headers: {
            Accept: "application/json",
            "X-API-KEY": birdeyeApiKey,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (resp.ok) {
          const data = await resp.json();

          if (data.success && data.data) {
            console.log(
              `[Birdeye] ✅ Got price for ${address}: $${data.data.value || "N/A"}`,
            );
            const responseData = {
              success: true,
              data: {
                address: data.data.address,
                value: data.data.value,
                updateUnixTime: data.data.updateUnixTime,
                priceChange24h: data.data.priceChange24h ?? 0,
              },
            };
            return json(responseData, { headers: corsHeaders });
          }
        }

        console.warn(
          `[Birdeye] Request failed with status ${resp.status}, trying fallback...`,
        );
      } catch (e) {
        console.warn(
          `[Birdeye] Fetch error: ${e?.message}, trying fallback...`,
        );
      }

      // Fallback 1: Try derived pricing for FIXERCOIN and LOCKER
      const tokenSymbol = getTokenSymbol(address);
      if (tokenSymbol === "FIXERCOIN" || tokenSymbol === "LOCKER") {
        const derivedPrice = await getDerivedPrice(address);
        if (derivedPrice !== null && derivedPrice.price > 0) {
          return json(
            {
              success: true,
              data: {
                address,
                value: derivedPrice.price,
                updateUnixTime: Math.floor(Date.now() / 1000),
                priceChange24h: derivedPrice?.priceChange24h ?? 0,
                volume24h: derivedPrice?.volume24h ?? 0,
              },
              _source: "derived",
            },
            { headers: corsHeaders },
          );
        }
      }

      // Fallback 2: Try DexScreener
      const dexscreenerPrice = await getPriceFromDexScreener(address);
      if (dexscreenerPrice !== null) {
        return json(
          {
            success: true,
            data: {
              address,
              value: dexscreenerPrice.price,
              updateUnixTime: Math.floor(Date.now() / 1000),
              priceChange24h: dexscreenerPrice.priceChange24h,
              volume24h: dexscreenerPrice?.volume24h ?? 0,
            },
            _source: "dexscreener",
          },
          { headers: corsHeaders },
        );
      }

      // Fallback 3: Try Jupiter
      const jupiterPrice = await getPriceFromJupiter(address);
      if (jupiterPrice !== null) {
        return json(
          {
            success: true,
            data: {
              address,
              value: jupiterPrice.price,
              updateUnixTime: Math.floor(Date.now() / 1000),
              priceChange24h: jupiterPrice?.priceChange24h ?? 0,
              volume24h: jupiterPrice?.volume24h ?? 0,
            },
            _source: "jupiter",
          },
          { headers: corsHeaders },
        );
      }

      // Fallback 4: Check hardcoded fallback prices
      if (tokenSymbol && FALLBACK_USD[tokenSymbol]) {
        console.log(
          `[Birdeye] Using hardcoded fallback price for ${tokenSymbol}: $${FALLBACK_USD[tokenSymbol]}`,
        );
        return json(
          {
            success: true,
            data: {
              address,
              value: FALLBACK_USD[tokenSymbol],
              updateUnixTime: Math.floor(Date.now() / 1000),
              priceChange24h: 0,
            },
            _source: "fallback",
          },
          { headers: corsHeaders },
        );
      }

      console.warn(`[Birdeye] No price available for ${address}`);
      return json(
        {
          success: false,
          error: "No price data available for this token",
        },
        { status: 404, headers: corsHeaders },
      );
    }

    // Pump.fun BUY handler: /api/pumpfun/buy (POST)
    if (pathname === "/api/pumpfun/buy" && req.method === "POST") {
      try {
        const body = await parseJSON(req);

        if (!body || typeof body !== "object") {
          return json(
            { error: "Invalid request body" },
            { status: 400, headers: corsHeaders },
          );
        }

        const { mint, amount, buyer } = body;

        if (!mint || typeof amount !== "number" || !buyer) {
          return json(
            {
              error:
                "Missing required fields: mint, amount (number), buyer",
            },
            { status: 400, headers: corsHeaders },
          );
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch("https://pump.fun/api/trade", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            mint,
            amount,
            buyer,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          const errorText = await resp.text().catch(() => "");
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
      } catch (e) {
        return json(
          {
            error: "Failed to request BUY transaction",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Pump.fun SELL handler: /api/pumpfun/sell (POST)
    if (pathname === "/api/pumpfun/sell" && req.method === "POST") {
      try {
        const body = await parseJSON(req);

        if (!body || typeof body !== "object") {
          return json(
            { error: "Invalid request body" },
            { status: 400, headers: corsHeaders },
          );
        }

        const { mint, amount, seller } = body;

        if (!mint || typeof amount !== "number" || !seller) {
          return json(
            {
              error:
                "Missing required fields: mint, amount (number), seller",
            },
            { status: 400, headers: corsHeaders },
          );
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch("https://pump.fun/api/trade", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            mint,
            amount,
            seller,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          const errorText = await resp.text().catch(() => "");
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
      } catch (e) {
        return json(
          {
            error: "Failed to request SELL transaction",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Default 404
    return json(
      { error: "Not found", pathname },
      { status: 404, headers: corsHeaders },
    );
  },
};
