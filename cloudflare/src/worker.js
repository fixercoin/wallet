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

// Price helpers
async function getSolPriceFromDex() {
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
          if (isFinite(price) && price > 0) return price;
        }
      }
    }
  } catch (e) {
    console.warn(`[SOL Price] Dex error: ${e?.message || e}`);
  }
  return 180;
}

async function getDerivedPrice(mint) {
  try {
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
    console.warn(`[Derived Price] Dex error: ${e?.message || e}`);
  }
  return null;
}

async function getPriceFromDexScreener(mint) {
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
    console.warn(`[Birdeye Fallback] DexScreener error: ${e?.message || e}`);
  }
  return null;
}

async function getPriceFromJupiter(mint) {
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
          return { price, priceChange24h: 0, volume24h: 0 };
        }
      }
    }
  } catch (e) {
    console.warn(`[Birdeye Fallback] Jupiter error: ${e?.message || e}`);
  }
  return null;
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

    // Disable P2P orders endpoints handled elsewhere
    if (pathname.startsWith("/api/p2p/orders")) {
      return json(
        { error: "P2P orders API is disabled on this server" },
        { status: 410, headers: corsHeaders },
      );
    }

    // Solana generic RPC proxy: /api/solana-rpc (POST)
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
        const payload = { jsonrpc: "2.0", id, method: methodName, params };
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
              headers: { "Content-Type": "application/json", ...corsHeaders },
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
            { publicKey: pk, balance, balanceLamports: lamports },
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

    // DexScreener tokens proxy: /api/dexscreener/tokens?mints=<M1>,<M2>
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
              if (data.pairs && Array.isArray(data.pairs))
                pairs.push(...data.pairs);
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
          { error: "Failed to fetch DexScreener tokens", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // DexScreener search: /api/dexscreener/search?q=...
    if (pathname === "/api/dexscreener/search" && req.method === "GET") {
      const q = searchParams.get("q") || "";
      if (!q)
        return json(
          { error: "Missing 'q' parameter" },
          { status: 400, headers: corsHeaders },
        );
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
          { error: "Failed to search DexScreener", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // DexScreener trending: /api/dexscreener/trending
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
          { error: "Failed to fetch trending tokens", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // SOL price endpoint: /api/sol/price
    if (pathname === "/api/sol/price" && req.method === "GET") {
      try {
        const price = await getSolPriceFromDex();
        return json(
          {
            token: "SOL",
            price,
            priceUsd: price,
            priceChange24h: 0,
            volume24h: 0,
            marketCap: 0,
          },
          { headers: corsHeaders },
        );
      } catch (e) {
        return json(
          {
            token: "SOL",
            price: 180,
            priceUsd: 180,
            priceChange24h: 0,
            volume24h: 0,
            marketCap: 0,
          },
          { headers: corsHeaders },
        );
      }
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
        FIXERCOIN: 0.000089,
        SOL: 180,
        USDC: 1.0,
        USDT: 1.0,
        LOCKER: 0.000012,
      };

      const getTokenSymbol = (addr) => {
        for (const [symbol, mint] of Object.entries(TOKEN_MINTS)) {
          if (mint === addr) return symbol;
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
          headers: { Accept: "application/json", "X-API-KEY": birdeyeApiKey },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (resp.ok) {
          const data = await resp.json();
          if (data.success && data.data) {
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
          `[Birdeye] Fetch error: ${e?.message || e}, trying fallback...`,
        );
      }

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
        { success: false, error: "No price data available for this token" },
        { status: 404, headers: corsHeaders },
      );
    }

    // Dedicated token price: /api/token/price
    if (pathname === "/api/token/price" && req.method === "GET") {
      try {
        const tokenParam = (
          url.searchParams.get("token") ||
          url.searchParams.get("symbol") ||
          "FIXERCOIN"
        ).toUpperCase();
        const mintParam = url.searchParams.get("mint") || "";

        const TOKEN_MINTS = {
          SOL: "So11111111111111111111111111111111111111112",
          USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
          FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
          LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
        };

        const FALLBACK_USD = {
          FIXERCOIN: 0.000089,
          SOL: 180,
          USDC: 1.0,
          USDT: 1.0,
          LOCKER: 0.000012,
        };

        const PKR_PER_USD = 280;
        const MARKUP = 1.0425;

        let token = tokenParam;
        let mint = mintParam || TOKEN_MINTS[token] || "";

        if (!mint && tokenParam && tokenParam.length > 40) {
          mint = tokenParam;
          const inv = Object.entries(TOKEN_MINTS).find(([, m]) => m === mint);
          if (inv) token = inv[0];
        }

        let priceUsd = null;
        let priceChange24h = 0;
        let volume24h = 0;

        if (token === "USDC" || token === "USDT") {
          priceUsd = 1.0;
          priceChange24h = 0;
          volume24h = 0;
        } else if (token === "FIXERCOIN" || token === "LOCKER") {
          const derivedPrice = await getDerivedPrice(mint);
          if (derivedPrice !== null && derivedPrice.price > 0) {
            priceUsd = derivedPrice.price;
            priceChange24h = derivedPrice.priceChange24h;
            volume24h = derivedPrice.volume24h;
          } else {
            priceUsd = FALLBACK_USD[token] ?? FALLBACK_USD.FIXERCOIN;
            priceChange24h = 0;
            volume24h = 0;
          }
        } else {
          priceUsd = FALLBACK_USD[token] ?? FALLBACK_USD.FIXERCOIN;
          priceChange24h = 0;
          volume24h = 0;
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
            priceChange24h,
            volume24h,
            source:
              token === "FIXERCOIN" || token === "LOCKER"
                ? "derived"
                : "fallback",
          },
          { headers: corsHeaders },
        );
      } catch (e) {
        return json(
          { error: "Failed to get token price", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Unified swap quote: /api/swap/quote
    if (pathname === "/api/swap/quote" && req.method === "GET") {
      const mint = url.searchParams.get("mint") || "";
      const inputMint = url.searchParams.get("inputMint") || "";
      const outputMint = url.searchParams.get("outputMint") || "";
      const amount = url.searchParams.get("amount") || "";

      const tryFetch = async (
        target,
        method = "GET",
        body,
        timeoutMs = 10000,
      ) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          const resp = await fetch(target, {
            method,
            headers: body
              ? {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                }
              : { Accept: "application/json" },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return await resp.json();
        } catch (e) {
          return null;
        }
      };

      try {
        if (mint) {
          const pump = await tryFetch(
            `https://pumpportal.fun/api/quote?mint=${encodeURIComponent(mint)}`,
          );
          if (pump) return json(pump, { headers: corsHeaders });
        }

        if (inputMint && outputMint && amount) {
          const meteoraUrl = `https://api.meteora.ag/swap/v3/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}`;
          const met = await tryFetch(meteoraUrl, "GET", undefined, 12000);
          if (met)
            return json(
              { source: "meteora", quote: met },
              { headers: corsHeaders },
            );

          const jupiterUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}`;
          const jup = await tryFetch(jupiterUrl, "GET", undefined, 10000);
          if (jup)
            return json(
              { source: "jupiter", quote: jup },
              { headers: corsHeaders },
            );
        }

        if (inputMint && outputMint && amount) {
          const rayUrl = `https://api.raydium.io/swap/quote`;
          const ray = await tryFetch(
            rayUrl,
            "POST",
            { inputMint, outputMint, amount },
            8000,
          );
          if (ray)
            return json(
              { source: "raydium", quote: ray },
              { headers: corsHeaders },
            );

          const orcaUrl = `https://api.orca.so/pools/price`;
          const orca = await tryFetch(
            orcaUrl,
            "POST",
            { inputMint, outputMint, amount },
            8000,
          );
          if (orca)
            return json(
              { source: "orca", quote: orca },
              { headers: corsHeaders },
            );
        }

        return json(
          { error: "no_quote_available" },
          { status: 502, headers: corsHeaders },
        );
      } catch (e) {
        return json(
          { error: "Failed to fetch swap quote", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Pump.fun swap execution via pumpportal.fun: /api/swap/execute (POST)
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
        } = body || {};
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
          wallet,
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
      } catch (e) {
        return json(
          { error: "Failed to execute swap", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Meteora quote and swap
    if (pathname === "/api/swap/meteora/quote" && req.method === "GET") {
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
        const meteoraUrl = new URL("https://api.meteora.ag/swap/v3/quote");
        meteoraUrl.searchParams.set("inputMint", inputMint);
        meteoraUrl.searchParams.set("outputMint", outputMint);
        meteoraUrl.searchParams.set("amount", amount);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(meteoraUrl.toString(), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!resp.ok) {
          return json(
            { error: `Meteora API returned ${resp.status}` },
            { status: resp.status, headers: corsHeaders },
          );
        }
        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e) {
        return json(
          { error: "Failed to fetch Meteora swap quote", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    if (pathname === "/api/swap/meteora/swap" && req.method === "POST") {
      try {
        const body = await parseJSON(req);
        if (!body || typeof body !== "object") {
          return json(
            { error: "Invalid request body" },
            { status: 400, headers: corsHeaders },
          );
        }
        const signerKeypair = body.signerKeypair;
        const shouldSign = body.sign === true && signerKeypair;
        const meteoraPayload = { ...body };
        delete meteoraPayload.signerKeypair;
        delete meteoraPayload.sign;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const resp = await fetch("https://api.meteora.ag/swap/v3/swap", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(meteoraPayload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!resp.ok) {
          const t = await resp.text().catch(() => "");
          return json(
            { error: `Meteora swap build returned ${resp.status}`, details: t },
            { status: resp.status, headers: corsHeaders },
          );
        }
        const data = await resp.json();
        if (shouldSign && data.swapTransaction) {
          console.warn(
            "[Meteora Swap] ⚠️  Server-side signing requested. This is not recommended for security reasons.",
          );
          return json(
            {
              swapTransaction: data.swapTransaction,
              signed: false,
              warning:
                "Server-side signing is disabled for security. Please sign this transaction on the client-side using the wallet's signing capability.",
              signingWarning:
                "Never share private keys with servers. Always use client-side wallet signing.",
              _source: "meteora",
            },
            { headers: corsHeaders },
          );
        }
        return json(
          {
            swapTransaction: data.swapTransaction,
            signed: false,
            _source: "meteora",
          },
          { headers: corsHeaders },
        );
      } catch (e) {
        return json(
          { error: "Failed to build Meteora swap", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Transaction signing endpoint
    if (pathname === "/api/sign/transaction" && req.method === "POST") {
      try {
        const body = await parseJSON(req);
        if (!body || typeof body !== "object") {
          return json(
            { error: "Invalid request body" },
            { status: 400, headers: corsHeaders },
          );
        }
        const { transaction, signerKeypair } = body || {};
        if (!transaction || !signerKeypair) {
          return json(
            { error: "Missing required fields: transaction and signerKeypair" },
            { status: 400, headers: corsHeaders },
          );
        }
        console.warn(
          "[Transaction Signing] ⚠️  Private key received for server-side signing. This is not recommended!",
        );
        return json(
          {
            error:
              "Server-side transaction signing is disabled for security reasons",
            message:
              "Please sign transactions on the client-side using your wallet. Never share private keys with servers.",
            documentation:
              "Use @solana/web3.js with your wallet adapter for secure client-side signing",
          },
          { status: 403, headers: corsHeaders },
        );
      } catch (e) {
        return json(
          { error: "Failed to process signing request", details: e?.message },
          { status: 500, headers: corsHeaders },
        );
      }
    }

    // Jupiter swap quote (path variant): /api/swap/jupiter/quote
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
          headers: { Accept: "application/json" },
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
      } catch (e) {
        return json(
          { error: "Failed to fetch Jupiter swap quote", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Jupiter price: /api/jupiter/price?ids=...
    if (pathname === "/api/jupiter/price" && req.method === "GET") {
      const ids = searchParams.get("ids") || "";
      if (!ids)
        return json(
          { error: "Missing 'ids' query parameter" },
          { status: 400, headers: corsHeaders },
        );
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
      } catch (e) {
        return json(
          {
            error: "Failed to fetch Jupiter prices",
            details: e?.message || String(e),
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Jupiter quote (query variant): /api/jupiter/quote
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
      const endpoints = [
        `https://quote-api.jup.ag/v6/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}&slippageBps=${encodeURIComponent(slippageBps)}`,
        `https://lite-api.jup.ag/swap/v1/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}&slippageBps=${encodeURIComponent(slippageBps)}`,
      ];
      let lastError = null;
      for (const url_str of endpoints) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 25000);
          const resp = await fetch(url_str, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!resp.ok) {
            lastError = `${resp.status} ${resp.statusText}`;
            continue;
          }
          const data = await resp.json();
          return json(data, { headers: corsHeaders });
        } catch (e) {
          lastError = e?.message || String(e);
        }
      }
      return json(
        { error: "Failed to fetch Jupiter quote", details: lastError },
        { status: 502, headers: corsHeaders },
      );
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
        } catch (e) {
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
      } catch (e) {
        return json(
          {
            error: "Failed to execute Pumpfun swap",
            details: e?.message || String(e),
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Unified quote endpoint trying providers: /api/quote
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
          name: "meteora",
          url: `https://api.meteora.ag/swap/v3/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}`,
        },
        {
          name: "jupiter",
          url: `https://quote-api.jup.ag/v6/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}&slippageBps=500`,
        },
        {
          name: "dexscreener",
          url: `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(inputMint)}`,
        },
      ];
      const lastErrors = [];
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
            if (p.name === "dexscreener" && data.pairs) {
              const pair = data.pairs.find(
                (pp) => pp.baseToken?.address === inputMint && pp.priceUsd,
              );
              if (pair) {
                return json(
                  {
                    source: "dexscreener",
                    quote: {
                      inAmount: amount,
                      outAmount: pair.priceUsd,
                      priceImpact: 0,
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
      return json(
        {
          error: "Failed to fetch quote from any provider",
          details: lastErrors.join(" | ") || "All providers failed",
          providers_attempted: ["meteora", "jupiter", "dexscreener"],
          note: "Meteora is the preferred provider. If it fails, try Jupiter or use DexScreener for price data only.",
        },
        { status: 502, headers: corsHeaders },
      );
    }

    // Unified swap execution endpoint: /api/swap (POST)
    if (pathname === "/api/swap" && req.method === "POST") {
      try {
        const body = await parseJSON(req);
        if (!body || typeof body !== "object") {
          return json(
            {
              error: "Invalid request body",
              message: "POST body must be valid JSON",
            },
            { status: 400, headers: corsHeaders },
          );
        }
        const provider = (body.provider || "auto").toLowerCase();
        const { inputMint, outputMint, amount, mint, wallet, routePlan } = body;
        if (
          (provider === "meteora" || provider === "auto") &&
          inputMint &&
          outputMint &&
          amount
        ) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);
            const meteoraPayload = {
              userPublicKey: wallet,
              inputMint,
              outputMint,
              inputAmount: String(amount),
              slippageBps: body.slippageBps || 500,
              sign: false,
            };
            const resp = await fetch("https://api.meteora.ag/swap/v3/swap", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(meteoraPayload),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (resp.ok) {
              const data = await resp.json();
              return json(
                {
                  source: "meteora",
                  swap: data,
                  signingRequired: true,
                  hint: "The transaction must be signed by the wallet on the client-side",
                },
                { headers: corsHeaders },
              );
            } else if (provider === "meteora") {
              const errorText = await resp.text().catch(() => "");
              return json(
                {
                  error: `Meteora swap failed with status ${resp.status}`,
                  details: errorText,
                },
                { status: resp.status, headers: corsHeaders },
              );
            }
          } catch (e) {
            if (provider === "meteora") {
              return json(
                { error: "Meteora swap failed", details: e?.message },
                { status: 502, headers: corsHeaders },
              );
            }
          }
        }
        if (
          (provider === "jupiter" || provider === "auto") &&
          inputMint &&
          routePlan
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
                {
                  error: "Jupiter swap failed",
                  details: e?.message,
                  hint: "Ensure routePlan is provided from /api/quote",
                },
                { status: 502, headers: corsHeaders },
              );
            }
          }
        }
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
        const hasInputMint = !!inputMint;
        const hasMint = !!mint;
        const hasAmount = !!amount;
        const hasOutputMint = !!outputMint;
        let helpText = "Missing required fields for swap. ";
        if (hasInputMint && hasOutputMint) {
          helpText +=
            "For Meteora swaps, you need: inputMint, outputMint, amount, and wallet. ";
        } else if (hasInputMint) {
          helpText +=
            "For Jupiter swaps, you need: inputMint, outputMint, amount, and routePlan (from /api/quote). ";
        }
        if (hasMint) {
          helpText +=
            "For Pumpfun swaps, you need: mint, amount, wallet, and optionally decimals, slippage. ";
        }
        if (!hasInputMint && !hasMint) {
          helpText +=
            "Provide either mint (for Pumpfun), or inputMint + outputMint + amount (for Meteora/Jupiter). ";
        }
        return json(
          {
            error: "Unable to execute swap - missing required fields",
            message: helpText,
            supported_providers: {
              meteora: {
                required: ["inputMint", "outputMint", "amount", "wallet"],
                optional: ["slippageBps"],
                note: "Preferred DEX for general token swaps",
              },
              jupiter: {
                required: ["inputMint", "outputMint", "amount", "routePlan"],
                optional: ["wallet", "slippageBps"],
                note: "Requires routePlan from /api/quote endpoint",
              },
              pumpfun: {
                required: ["mint", "amount"],
                optional: [
                  "wallet",
                  "decimals",
                  "slippage",
                  "txVersion",
                  "priorityFee",
                ],
                note: "For pump.fun token launches",
              },
            },
            received: {
              provider,
              has_inputMint: hasInputMint,
              has_outputMint: hasOutputMint,
              has_mint: hasMint,
              has_amount: hasAmount,
              has_routePlan: !!routePlan,
              has_wallet: !!wallet,
            },
          },
          { status: 400, headers: corsHeaders },
        );
      } catch (e) {
        return json(
          { error: "Failed to execute swap", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Alias for frontend: /api/solana-send (POST) - accepts signedBase64/signedTx/tx
    if (pathname === "/api/solana-send" && req.method === "POST") {
      try {
        const body = await parseJSON(req);
        const signedTx =
          body?.signedBase64 || body?.signedTx || body?.tx || body?.signedTransaction;
        if (!signedTx) {
          return json({ error: "Missing signed transaction (base64)" }, { status: 400, headers: corsHeaders });
        }
        try {
          const rpcResult = await callRpc(env, "sendTransaction", [signedTx]);
          const parsed = JSON.parse(String(rpcResult?.body || "{}"));
          return json(parsed, { status: parsed?.error ? 502 : 200, headers: corsHeaders });
        } catch (rpcErr) {
          return json({ error: "Failed to submit signed transaction to RPC", details: rpcErr?.message || String(rpcErr) }, { status: 502, headers: corsHeaders });
        }
      } catch (e) {
        return json({ error: "Invalid request body", details: e?.message || String(e) }, { status: 400, headers: corsHeaders });
      }
    }

    // Simulate signed transaction helper: /api/solana-simulate (POST)
    if (pathname === "/api/solana-simulate" && req.method === "POST") {
      try {
        const body = await parseJSON(req);
        const signedTx =
          body?.signedBase64 || body?.signedTx || body?.tx || body?.signedTransaction;
        if (!signedTx) {
          return json({ error: "Missing signed transaction (base64)" }, { status: 400, headers: corsHeaders });
        }
        try {
          const rpcResult = await callRpc(env, "simulateTransaction", [signedTx, { encoding: "base64", replaceRecentBlockhash: true, sigVerify: true }]);
          const parsed = JSON.parse(String(rpcResult?.body || "{}"));
          return json(parsed, { status: parsed?.error ? 502 : 200, headers: corsHeaders });
        } catch (rpcErr) {
          return json({ error: "Failed to simulate transaction via RPC", details: rpcErr?.message || String(rpcErr) }, { status: 502, headers: corsHeaders });
        }
      } catch (e) {
        return json({ error: "Invalid request body", details: e?.message || String(e) }, { status: 400, headers: corsHeaders });
      }
    }

    // 404 for unknown routes
    return json(
      { error: "API endpoint not found", path: pathname },
      { status: 404, headers: corsHeaders },
    );
  },
};
