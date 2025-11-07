// Netlify Functions entry to handle /api/* routes

import {
  addEasypaisaPayment,
  listEasypaisaPayments,
} from "../../utils/p2pStore";

const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana.blockpi.network/v1/rpc/public",
  "https://solana.publicnode.com",
  "https://solana-rpc.publicnode.com",
];

async function callRpc(
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

  for (const endpoint of RPC_ENDPOINTS) {
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

function jsonResponse(
  statusCode: number,
  body: any,
  headers: Record<string, string> = {},
) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Admin-Wallet",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  } as const;
}

// DexScreener failover endpoints
const DEXSCREENER_ENDPOINTS = [
  "https://api.dexscreener.com/latest/dex",
  "https://api.dexscreener.io/latest/dex",
];
let currentDexIdx = 0;

async function tryDexEndpoints(path: string) {
  let lastError: Error | null = null;
  for (let i = 0; i < DEXSCREENER_ENDPOINTS.length; i++) {
    const idx = (currentDexIdx + i) % DEXSCREENER_ENDPOINTS.length;
    const endpoint = DEXSCREENER_ENDPOINTS[idx];
    const url = `${endpoint}${path}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const resp = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        if (resp.status === 429) continue;
        const t = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}. ${t}`);
      }
      const data = await resp.json();
      currentDexIdx = idx;
      return data;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (i < DEXSCREENER_ENDPOINTS.length - 1)
        await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(lastError?.message || "All DexScreener endpoints failed");
}

// In-memory cache and inflight dedupe (best-effort per function instance)
const DEX_CACHE_TTL_MS = 30_000;
const DEX_CACHE = new Map<string, { data: any; expiresAt: number }>();
const DEX_INFLIGHT = new Map<string, Promise<any>>();

async function fetchDexData(path: string) {
  const now = Date.now();
  const cached = DEX_CACHE.get(path);
  if (cached && cached.expiresAt > now) {
    // Only return cache if it contains meaningful data with priceChange fields
    const hasPriceChangeData =
      Array.isArray(cached.data?.pairs) &&
      cached.data.pairs.some(
        (p: any) =>
          p?.priceChange &&
          (typeof p.priceChange.h24 === "number" ||
            typeof p.priceChange.h6 === "number" ||
            typeof p.priceChange.h1 === "number" ||
            typeof p.priceChange.m5 === "number"),
      );
    if (hasPriceChangeData) {
      return cached.data;
    }
  }
  const existing = DEX_INFLIGHT.get(path);
  if (existing) return existing;
  const request = (async () => {
    try {
      const data = await tryDexEndpoints(path);
      DEX_CACHE.set(path, { data, expiresAt: Date.now() + DEX_CACHE_TTL_MS });
      return data;
    } finally {
      DEX_INFLIGHT.delete(path);
    }
  })();
  DEX_INFLIGHT.set(path, request);
  return request;
}

/**
 * Helper to safely parse request body from Netlify event
 * Handles both JSON and base64-encoded bodies
 */
function parseRequestBody(event: any): any {
  try {
    let body = event.body;

    // Decode base64 if needed
    if (event.isBase64Encoded && body) {
      body = Buffer.from(body, "base64").toString("utf8");
    }

    // Parse JSON
    if (typeof body === "string" && body.trim()) {
      return JSON.parse(body);
    }

    return {};
  } catch (e) {
    console.error("[Netlify] Failed to parse request body:", e);
    return null; // Return null to indicate parse error
  }
}

export const handler = async (event: any) => {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(204, "");
  }

  const path = (event.path || "").replace(/^\/api/, "") || "/";
  const method = event.httpMethod;

  try {
    // Root and health/status endpoints
    if (path === "/" || path === "/health" || path === "/status") {
      return jsonResponse(200, {
        ok: true,
        service: "Fixorium Wallet API (Netlify)",
        endpoints: [
          "/easypaisa/webhook [POST]",
          "/easypaisa/payments [GET]",
          "/solana-rpc [POST]",
          "/forex/rate [GET]",
          "/exchange-rate [GET]",
          "/token/price [GET]",
          "/stable-24h [GET]",
          "/dexscreener/tokens [GET]",
          "/dexscreener/search [GET]",
          "/dexscreener/trending [GET]",
          "/jupiter/price [GET]",
          "/jupiter/tokens [GET]",
          "/jupiter/quote [GET]",
          "/jupiter/swap [POST]",
          "/wallet/balance [GET]",
          "/dextools/price [GET]",
          "/coinmarketcap/quotes [GET]",
          "/pumpfun/quote [GET, POST]",
          "/pumpfun/swap [POST]",
          "/pumpfun/buy [POST]",
          "/pumpfun/sell [POST]",
        ],
      });
    }

    // Easypaisa webhook ingestion (best-effort schema)
    if (path === "/easypaisa/webhook" && method === "POST") {
      const body = parseRequestBody(event) || {};

      const configuredSecret = process.env.EASYPAY_WEBHOOK_SECRET;
      const providedSecret =
        event.headers?.["x-webhook-secret"] ||
        event.headers?.["x-easypay-secret"] ||
        body?.secret ||
        "";
      if (configuredSecret && providedSecret !== configuredSecret) {
        return jsonResponse(401, { error: "unauthorized" });
      }

      const msisdn = String(
        body?.msisdn ||
          body?.receiverMsisdn ||
          body?.account ||
          process.env.EASYPAY_MSISDN ||
          "",
      );
      const amount = Number(
        body?.amount ?? body?.txnAmount ?? body?.transactionAmount ?? 0,
      );
      const currency = String(body?.currency || "PKR");
      const reference = String(
        body?.reference ||
          body?.trxId ||
          body?.transactionId ||
          body?.remarks ||
          body?.narration ||
          "",
      );
      const sender = String(
        body?.senderMsisdn || body?.payer || body?.from || "",
      );
      const tsRaw = body?.ts ?? body?.timestamp ?? body?.date ?? Date.now();
      const ts = typeof tsRaw === "number" ? tsRaw : Date.parse(tsRaw);

      if (!msisdn || !amount || !isFinite(amount)) {
        return jsonResponse(400, { error: "invalid payload" });
      }

      const result = addEasypaisaPayment({
        msisdn,
        amount,
        currency,
        reference,
        sender,
        ts: isFinite(ts) ? ts : Date.now(),
      });
      return jsonResponse(result.status, { payment: result.payment });
    }

    // Easypaisa payments query
    if (path === "/easypaisa/payments" && method === "GET") {
      const msisdn =
        event.queryStringParameters?.msisdn || process.env.EASYPAY_MSISDN || "";
      const since = Number(event.queryStringParameters?.since || 0);
      const data = listEasypaisaPayments({ msisdn, since });
      return jsonResponse(200, data);
    }

    // Solana RPC
    if (path === "/solana-rpc" && method === "POST") {
      const body = parseRequestBody(event);
      if (body === null) {
        return jsonResponse(400, {
          error: "Invalid JSON in request body",
        });
      }

      const methodName = body?.method;
      const params = body?.params ?? [];
      const id = body?.id ?? Date.now();

      if (!methodName || typeof methodName !== "string") {
        return jsonResponse(400, { error: "Missing RPC method" });
      }

      try {
        const result = await callRpc(methodName, params, id);
        return jsonResponse(200, result.body);
      } catch (e: any) {
        console.error("[Solana RPC] Handler error:", e);
        return jsonResponse(502, {
          error: "Failed to call Solana RPC",
          details: e?.message || String(e),
          method: methodName,
        });
      }
    }

    // Forex rate proxy: /api/forex/rate?base=USD&symbols=PKR
    if (path === "/forex/rate" && method === "GET") {
      const base = (event.queryStringParameters?.base || "USD").toUpperCase();
      const symbols = (
        event.queryStringParameters?.symbols || "PKR"
      ).toUpperCase();
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
          const json = await resp.json();
          const rate = p.parse(json);
          if (typeof rate === "number" && isFinite(rate) && rate > 0) {
            return jsonResponse(200, {
              base,
              symbols: [firstSymbol],
              rates: { [firstSymbol]: rate },
            });
          }
          lastErr = "invalid response";
        } catch (e: any) {
          lastErr = e?.message || String(e);
        }
      }
      return jsonResponse(502, {
        error: "Failed to fetch forex rate",
        details: lastErr,
      });
    }

    // Token exchange rate to PKR with markup: /api/exchange-rate?token=FIXERCOIN
    if (path === "/exchange-rate" && method === "GET") {
      const token = (
        event.queryStringParameters?.token || "FIXERCOIN"
      ).toUpperCase();

      // Known Solana token mints
      const TOKEN_MINTS: Record<string, string> = {
        SOL: "So11111111111111111111111111111111111111112",
        USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
        FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
        LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
      };

      const FALLBACK_USD: Record<string, number> = {
        FIXERCOIN: 0.00008139, // Real-time market price
        SOL: 149.38, // Real-time market price
        USDC: 1.0,
        USDT: 1.0,
        LOCKER: 0.00001112, // Real-time market price
      };

      const PKR_PER_USD = 280; // base FX
      const MARKUP = 1.0425; // 4.25%
      const MIN_REALISTIC_PRICE = 0.00001; // minimum realistic price threshold

      let priceUsd: number | null = null;
      try {
        if (token === "USDC" || token === "USDT") {
          priceUsd = 1.0;
        } else if (TOKEN_MINTS[token]) {
          const data = await fetchDexData(`/tokens/${TOKEN_MINTS[token]}`);
          const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
          const price =
            pairs.length > 0 && pairs[0]?.priceUsd
              ? Number(pairs[0].priceUsd)
              : null;
          // Only use price if it's a realistic value (above minimum threshold)
          if (
            typeof price === "number" &&
            isFinite(price) &&
            price >= MIN_REALISTIC_PRICE
          ) {
            priceUsd = price;
          }
        }
      } catch {}

      // Fall back to hardcoded prices if DexScreener data is invalid, zero, or too small
      if (
        priceUsd === null ||
        !isFinite(priceUsd) ||
        priceUsd < MIN_REALISTIC_PRICE
      ) {
        priceUsd = FALLBACK_USD[token] ?? FALLBACK_USD.FIXERCOIN;
      }

      const rateInPKR = priceUsd * PKR_PER_USD * MARKUP;
      return jsonResponse(200, {
        token,
        priceUsd,
        priceInPKR: rateInPKR,
        rate: rateInPKR,
        pkrPerUsd: PKR_PER_USD,
        markup: MARKUP,
      });
    }

    // Stablecoin 24h change: /api/stable-24h?symbols=USDC,USDT
    if (path === "/stable-24h" && method === "GET") {
      const symbolsParam = (
        event.queryStringParameters?.symbols || "USDC,USDT"
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
        return jsonResponse(400, { error: "No supported symbols provided" });
      }

      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`;
      let result: Record<
        string,
        { priceUsd: number; change24h: number; mint: string }
      > = {};
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const resp = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timeout);
        if (resp.ok) {
          const json = await resp.json();
          symbols.forEach((sym) => {
            const meta = COINGECKO_IDS[sym];
            if (!meta) return;
            const d = json?.[meta.id];
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

      return jsonResponse(200, { data: result });
    }

    // DexScreener: tokens
    if (path === "/dexscreener/tokens" && method === "GET") {
      const mints = event.queryStringParameters?.mints;
      if (!mints)
        return jsonResponse(400, { error: "Missing 'mints' query parameter" });
      const rawMints = String(mints)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const uniqSorted = Array.from(new Set(rawMints)).sort();
      if (uniqSorted.length === 0)
        return jsonResponse(400, { error: "No valid token mints provided" });
      const data = await fetchDexData(`/tokens/${uniqSorted.join(",")}`);
      const pairs = Array.isArray(data?.pairs)
        ? data.pairs.filter((p: any) => p?.chainId === "solana")
        : [];
      return jsonResponse(200, {
        schemaVersion: data?.schemaVersion || "1.0.0",
        pairs,
      });
    }

    // DexScreener: search
    if (path === "/dexscreener/search" && method === "GET") {
      const q = event.queryStringParameters?.q;
      if (!q)
        return jsonResponse(400, { error: "Missing 'q' query parameter" });
      const data = await fetchDexData(`/search/?q=${encodeURIComponent(q)}`);
      const pairs = Array.isArray(data?.pairs)
        ? data.pairs.filter((p: any) => p?.chainId === "solana").slice(0, 20)
        : [];
      return jsonResponse(200, {
        schemaVersion: data?.schemaVersion || "1.0.0",
        pairs,
      });
    }

    // DexScreener: trending
    if (path === "/dexscreener/trending" && method === "GET") {
      const data = await fetchDexData(`/pairs/solana`);
      const pairs = Array.isArray(data?.pairs)
        ? data.pairs
            .filter(
              (p: any) =>
                (p?.volume?.h24 || 0) > 1000 &&
                (p?.liquidity?.usd || 0) > 10000,
            )
            .sort(
              (a: any, b: any) => (b?.volume?.h24 || 0) - (a?.volume?.h24 || 0),
            )
            .slice(0, 50)
        : [];
      return jsonResponse(200, {
        schemaVersion: data?.schemaVersion || "1.0.0",
        pairs,
      });
    }

    // Debug: count tokens missing 24h change on dashboard logic
    if (path === "/debug/24h-missing" && method === "GET") {
      const publicKey = (event.queryStringParameters?.publicKey || "").trim();
      if (!publicKey) return jsonResponse(400, { error: "publicKey required" });

      // Fetch token accounts via RPC (same RPC fanout used by /api/solana-rpc)
      let mints: string[] = [];
      try {
        const rpc = await callRpc(
          "getTokenAccountsByOwner",
          [
            publicKey,
            { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
            { encoding: "jsonParsed" },
          ],
          Date.now(),
        );
        const parsed = JSON.parse(String(rpc?.body || "{}"));
        const value = parsed?.result?.value || [];
        const list: string[] = Array.isArray(value)
          ? value
              .map((v: any) => v?.account?.data?.parsed?.info?.mint)
              .filter((x: any) => typeof x === "string" && x.length > 0)
          : [];
        mints = Array.from(new Set(list));
      } catch {}

      // Always include SOL synthetic mint so dashboard token appears
      const SOL_MINT = "So11111111111111111111111111111111111111112";
      if (!mints.includes(SOL_MINT)) mints.unshift(SOL_MINT);

      if (mints.length === 0)
        return jsonResponse(200, { total: 0, missing: 0, missingMints: [] });

      // DexScreener fetch for these mints
      const data = await fetchDexData(`/tokens/${mints.join(",")}`);
      const pairs: any[] = Array.isArray(data?.pairs) ? data.pairs : [];

      const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns";

      const missing: string[] = [];
      mints.forEach((mint) => {
        // Stablecoins are shown as 0% if no data
        if (mint === USDC_MINT || mint === USDT_MINT) return;
        const t = pairs.find(
          (p) =>
            p?.baseToken?.address === mint || p?.quoteToken?.address === mint,
        );
        const pc = t?.priceChange || {};
        const candidates = [pc.h24, pc.h6, pc.h1, pc.m5];
        const has = candidates.some(
          (v) => typeof v === "number" && isFinite(v),
        );
        if (!has) missing.push(mint);
      });

      return jsonResponse(200, {
        total: mints.length,
        missing: missing.length,
        missingMints: missing,
      });
    }

    // Health check: /api/ping
    if (path === "/ping" && method === "GET") {
      return jsonResponse(200, {
        status: "ok",
        timestamp: new Date().toISOString(),
      });
    }

    // Wallet balance: /api/wallet/balance?publicKey=... (also supports wallet/address)
    if (path === "/wallet/balance" && method === "GET") {
      const pk = (
        event.queryStringParameters?.publicKey ||
        event.queryStringParameters?.wallet ||
        event.queryStringParameters?.address ||
        ""
      ).trim();
      if (!pk)
        return jsonResponse(400, { error: "Missing 'publicKey' parameter" });

      try {
        const rpc = await callRpc("getBalance", [pk], Date.now());
        const j = JSON.parse(String(rpc?.body || "{}"));
        const lamports =
          typeof j.result === "number" ? j.result : (j?.result?.value ?? null);
        if (typeof lamports === "number" && isFinite(lamports)) {
          const balance = lamports / 1_000_000_000;
          return jsonResponse(200, {
            publicKey: pk,
            balance,
            balanceLamports: lamports,
          });
        }
        return jsonResponse(502, { error: "Invalid RPC response" });
      } catch (e) {
        return jsonResponse(502, {
          error: "Failed to fetch balance",
          details: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Jupiter price: /api/jupiter/price?ids=...
    if (path === "/jupiter/price" && method === "GET") {
      const ids = event.queryStringParameters?.ids || "";
      if (!ids) {
        return jsonResponse(400, { error: "Missing 'ids' query parameter" });
      }
      try {
        const url = `https://price.jup.ag/v4/price?ids=${encodeURIComponent(ids)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) {
          return jsonResponse(resp.status, { error: "Jupiter API error" });
        }
        const data = await resp.json();
        return jsonResponse(200, data);
      } catch (e: any) {
        return jsonResponse(502, {
          error: "Failed to fetch Jupiter prices",
          details: e?.message || String(e),
        });
      }
    }

    // Jupiter quote: /api/jupiter/quote?inputMint=...&outputMint=...&amount=...
    if (path === "/jupiter/quote" && method === "GET") {
      const inputMint = event.queryStringParameters?.inputMint || "";
      const outputMint = event.queryStringParameters?.outputMint || "";
      const amount = event.queryStringParameters?.amount || "";
      const slippageBps = event.queryStringParameters?.slippageBps || "50";

      if (!inputMint || !outputMint || !amount) {
        return jsonResponse(400, {
          error: "Missing required parameters: inputMint, outputMint, amount",
        });
      }

      try {
        const url = `https://quote-api.jup.ag/v6/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}&slippageBps=${encodeURIComponent(slippageBps)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const resp = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) {
          return jsonResponse(resp.status, { error: "Jupiter API error" });
        }
        const data = await resp.json();
        return jsonResponse(200, data);
      } catch (e: any) {
        return jsonResponse(502, {
          error: "Failed to fetch Jupiter quote",
          details: e?.message || String(e),
        });
      }
    }

    // Jupiter swap: /api/jupiter/swap (POST)
    if (path === "/jupiter/swap" && method === "POST") {
      let body: any = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {}

      try {
        const resp = await fetch("https://quote-api.jup.ag/v6/swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          return jsonResponse(resp.status, { error: "Jupiter swap failed" });
        }
        const data = await resp.json();
        return jsonResponse(200, data);
      } catch (e: any) {
        return jsonResponse(502, {
          error: "Failed to execute Jupiter swap",
          details: e?.message || String(e),
        });
      }
    }

    // Jupiter tokens: /api/jupiter/tokens?type=strict|all
    if (path === "/jupiter/tokens" && method === "GET") {
      const type = event.queryStringParameters?.type || "strict";
      try {
        const url = `https://token.jup.ag/all?type=${encodeURIComponent(type)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) {
          return jsonResponse(resp.status, {
            error: "Jupiter tokens API error",
          });
        }
        const data = await resp.json();
        return jsonResponse(200, data);
      } catch (e: any) {
        return jsonResponse(502, {
          error: "Failed to fetch Jupiter tokens",
          details: e?.message || String(e),
        });
      }
    }

    // DexTools price: /api/dextools/price?tokenAddress=...&chainId=solana
    if (path === "/dextools/price" && method === "GET") {
      const tokenAddress = event.queryStringParameters?.tokenAddress || "";
      const chainId = event.queryStringParameters?.chainId || "solana";

      if (!tokenAddress) {
        return jsonResponse(400, { error: "Missing 'tokenAddress' parameter" });
      }

      try {
        const url = `https://api.dextools.io/v1/token/${encodeURIComponent(chainId)}/${encodeURIComponent(tokenAddress)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: controller.abort(),
        });
        clearTimeout(timeout);
        if (!resp.ok) {
          return jsonResponse(resp.status, { error: "DexTools API error" });
        }
        const data = await resp.json();
        return jsonResponse(200, data.data || data);
      } catch (e: any) {
        return jsonResponse(502, {
          error: "Failed to fetch DexTools price",
          details: e?.message || String(e),
        });
      }
    }

    // CoinMarketCap quotes: /api/coinmarketcap/quotes?symbols=...
    if (path === "/coinmarketcap/quotes" && method === "GET") {
      const symbols = event.queryStringParameters?.symbols || "";

      if (!symbols) {
        return jsonResponse(400, { error: "Missing 'symbols' parameter" });
      }

      try {
        const cmcApiKey = process.env.COINMARKETCAP_API_KEY || "";
        if (!cmcApiKey) {
          return jsonResponse(500, {
            error: "CoinMarketCap API key not configured",
          });
        }

        const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(symbols)}&convert=USD`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(url, {
          headers: {
            Accept: "application/json",
            "X-CMC_PRO_API_KEY": cmcApiKey,
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!resp.ok) {
          return jsonResponse(resp.status, {
            error: "CoinMarketCap API error",
          });
        }

        const data = await resp.json();
        return jsonResponse(200, data);
      } catch (e: any) {
        return jsonResponse(502, {
          error: "Failed to fetch CoinMarketCap prices",
          details: e?.message || String(e),
        });
      }
    }

    // Pumpfun quote: /api/pumpfun/quote (POST or GET)
    if (path === "/pumpfun/quote") {
      if (method === "POST" || method === "GET") {
        let inputMint = "";
        let outputMint = "";
        let amount = "";

        if (method === "POST") {
          let body: any = {};
          try {
            body = event.body ? JSON.parse(event.body) : {};
          } catch {}
          inputMint = body?.inputMint || "";
          outputMint = body?.outputMint || "";
          amount = body?.amount || "";
        } else {
          inputMint = event.queryStringParameters?.inputMint || "";
          outputMint = event.queryStringParameters?.outputMint || "";
          amount = event.queryStringParameters?.amount || "";
        }

        if (!inputMint || !outputMint || !amount) {
          return jsonResponse(400, {
            error: "Missing required parameters: inputMint, outputMint, amount",
          });
        }

        try {
          const url = `https://api.pumpfun.com/api/v1/quote?input_mint=${encodeURIComponent(inputMint)}&output_mint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const resp = await fetch(url, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!resp.ok) {
            return jsonResponse(resp.status, { error: "Pumpfun API error" });
          }
          const data = await resp.json();
          return jsonResponse(200, data);
        } catch (e: any) {
          return jsonResponse(502, {
            error: "Failed to fetch Pumpfun quote",
            details: e?.message || String(e),
          });
        }
      }
      return jsonResponse(405, { error: "Method not allowed" });
    }

    // Pumpfun swap: /api/pumpfun/swap (POST)
    if (path === "/pumpfun/swap" && method === "POST") {
      const body = parseRequestBody(event) || {};

      if (!body || typeof body !== "object") {
        return jsonResponse(400, { error: "Invalid request body" });
      }

      try {
        const resp = await fetch("https://api.pumpfun.com/api/v1/swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          return jsonResponse(resp.status, { error: "Pumpfun swap failed" });
        }
        const data = await resp.json();
        return jsonResponse(200, data);
      } catch (e: any) {
        return jsonResponse(502, {
          error: "Failed to execute Pumpfun swap",
          details: e?.message || String(e),
        });
      }
    }

    // Pumpfun buy: /api/pumpfun/buy (POST)
    if (path === "/pumpfun/buy" && method === "POST") {
      const body = parseRequestBody(event) || {};

      const { mint, amount, buyer } = body;

      if (!mint || typeof amount !== "number" || !buyer) {
        return jsonResponse(400, {
          error:
            "Missing required fields: mint, amount (number), buyer (string)",
        });
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch("https://pumpportal.fun/api/trade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mint,
            amount: String(amount),
            buyer,
            slippageBps: body?.slippageBps ?? 350,
            priorityFeeLamports: body?.priorityFeeLamports ?? 10000,
            txVersion: "V0",
            operation: "buy",
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!resp.ok) {
          const errorText = await resp.text().catch(() => "");
          return jsonResponse(resp.status, {
            error: "Pump.fun API error",
            details: errorText,
          });
        }

        const data = await resp.json();
        return jsonResponse(200, data);
      } catch (e: any) {
        return jsonResponse(502, {
          error: "Failed to request BUY transaction",
          details: e?.message || String(e),
        });
      }
    }

    // Pumpfun sell: /api/pumpfun/sell (POST)
    if (path === "/pumpfun/sell" && method === "POST") {
      let body: any = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {}

      const { mint, amount, seller } = body;

      if (!mint || typeof amount !== "number" || !seller) {
        return jsonResponse(400, {
          error:
            "Missing required fields: mint, amount (number), seller (string)",
        });
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch("https://pumpportal.fun/api/trade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mint,
            amount: String(amount),
            seller,
            slippageBps: body?.slippageBps ?? 350,
            priorityFeeLamports: body?.priorityFeeLamports ?? 10000,
            txVersion: "V0",
            operation: "sell",
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!resp.ok) {
          const errorText = await resp.text().catch(() => "");
          return jsonResponse(resp.status, {
            error: "Pump.fun API error",
            details: errorText,
          });
        }

        const data = await resp.json();
        return jsonResponse(200, data);
      } catch (e: any) {
        return jsonResponse(502, {
          error: "Failed to request SELL transaction",
          details: e?.message || String(e),
        });
      }
    }

    // Submit signed transaction aliases: /api/solana-send, /api/swap/submit (POST)
    if (
      (path === "/solana-send" || path === "/swap/submit") &&
      method === "POST"
    ) {
      let body: any = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {}

      const txBase64 =
        body?.signedBase64 ||
        body?.signedTx ||
        body?.signedTransaction ||
        body?.tx;
      if (!txBase64 || typeof txBase64 !== "string") {
        return jsonResponse(400, {
          error: "Missing signed transaction (base64)",
        });
      }

      try {
        const rpc = await callRpc("sendTransaction", [txBase64], Date.now());
        const parsed = JSON.parse(String(rpc?.body || "{}"));
        return jsonResponse(parsed?.error ? 502 : 200, parsed);
      } catch (e: any) {
        return jsonResponse(502, {
          error: "Failed to submit signed transaction",
          details: e?.message || String(e),
        });
      }
    }

    // Simulate signed transaction: /api/solana-simulate (POST)
    if (path === "/solana-simulate" && method === "POST") {
      let body: any = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {}

      const txBase64 =
        body?.signedBase64 ||
        body?.signedTx ||
        body?.signedTransaction ||
        body?.tx;
      if (!txBase64 || typeof txBase64 !== "string") {
        return jsonResponse(400, {
          error: "Missing signed transaction (base64)",
        });
      }

      try {
        const rpc = await callRpc(
          "simulateTransaction",
          [
            txBase64,
            {
              encoding: "base64",
              replaceRecentBlockhash: true,
              sigVerify: true,
            },
          ],
          Date.now(),
        );
        const parsed = JSON.parse(String(rpc?.body || "{}"));
        return jsonResponse(parsed?.error ? 502 : 200, parsed);
      } catch (e: any) {
        return jsonResponse(502, {
          error: "Failed to simulate transaction",
          details: e?.message || String(e),
        });
      }
    }

    return jsonResponse(404, { error: `No handler for ${path}` });
  } catch (error) {
    return jsonResponse(502, {
      error: error instanceof Error ? error.message : String(error),
      schemaVersion: "1.0.0",
      pairs: [],
    });
  }
};
