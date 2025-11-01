// Netlify Functions entry to handle /api/* routes

import {
  listPosts,
  getPost,
  createOrUpdatePost,
  listTradeMessages,
  listRecentTradeMessages,
  addTradeMessage,
  uploadProof,
  addEasypaisaPayment,
  listEasypaisaPayments,
  listTradeRooms,
  getTradeRoom,
  createTradeRoom,
  updateTradeRoom,
} from "../../utils/p2pStore";

const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana-mainnet.rpc.extrnode.com",
  "https://solana.blockpi.network/v1/rpc/public",
  "https://solana.publicnode.com",
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

type BinanceCacheEntry = {
  expiresAt: number;
  data: any;
};

const BINANCE_P2P_CACHE = new Map<string, BinanceCacheEntry>();
const BINANCE_P2P_CACHE_TTL = 30000;

function uniqueId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function encodeToBase64(value: string): string {
  const globalObj = globalThis as any;
  if (typeof globalObj?.btoa === "function") {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return globalObj.btoa(binary);
  }
  if (globalObj?.Buffer) {
    return globalObj.Buffer.from(value, "utf-8").toString("base64");
  }
  throw new Error("Base64 encoding not supported in this environment");
}

function buildDeviceInfoPayload(userAgent: string): string {
  const payload = {
    deviceName: "Chrome",
    deviceVersion: "124.0.0.0",
    osName: "windows",
    osVersion: "10",
    platform: "web",
    screenHeight: 1080,
    screenWidth: 1920,
    systemLang: "en-US",
    timeZone: "UTC",
    userAgent,
  };
  return encodeToBase64(JSON.stringify(payload));
}

export const handler = async (event: any) => {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(204, "");
  }

  const path =
    (event.path || "").replace(/^\/\.netlify\/functions\/api/, "") || "/";
  const method = event.httpMethod;

  try {
    // P2P endpoints
    if (path === "/p2p" || path === "/p2p/" || path === "/p2p/list") {
      if (method === "GET") {
        return jsonResponse(200, listPosts());
      }
      return jsonResponse(405, { error: "Method Not Allowed" });
    }

    if (path.startsWith("/p2p/post/") && method === "GET") {
      const id = path.replace("/p2p/post/", "");
      const post = getPost(id);
      if (!post) return jsonResponse(404, { error: "not found" });
      return jsonResponse(200, { post });
    }

    if (path === "/p2p/post" && (method === "POST" || method === "PUT")) {
      let body: any = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {}
      const adminHeader =
        (event.headers?.["x-admin-wallet"] as string) ||
        body?.adminWallet ||
        "";
      const result = createOrUpdatePost(body || {}, adminHeader || "");
      if ("error" in result)
        return jsonResponse(result.status, { error: result.error });
      return jsonResponse(result.status, { post: result.post });
    }

    // P2P Trade Rooms endpoints
    if (path === "/p2p/rooms" && method === "GET") {
      const wallet = event.queryStringParameters?.wallet;
      const result = listTradeRooms(wallet);
      return jsonResponse(200, result);
    }

    if (path === "/p2p/rooms" && method === "POST") {
      let body: any = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {}
      const result = createTradeRoom({
        buyer_wallet: body?.buyer_wallet || "",
        seller_wallet: body?.seller_wallet || "",
        order_id: body?.order_id || "",
      });
      if ("error" in result) {
        return jsonResponse(result.status, { error: result.error });
      }
      return jsonResponse(result.status, { room: result.room });
    }

    if (path.startsWith("/p2p/rooms/") && method === "GET") {
      const roomId = path.replace("/p2p/rooms/", "");
      if (!roomId) {
        return jsonResponse(400, { error: "Room ID required" });
      }
      const room = getTradeRoom(roomId);
      if (!room) {
        return jsonResponse(404, { error: "Room not found" });
      }
      return jsonResponse(200, { room });
    }

    if (path.startsWith("/p2p/rooms/") && method === "PUT") {
      const roomId = path.replace("/p2p/rooms/", "");
      let body: any = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {}
      if (!roomId) {
        return jsonResponse(400, { error: "Room ID required" });
      }
      const result = updateTradeRoom(roomId, body || {});
      if ("error" in result) {
        return jsonResponse(result.status, { error: result.error });
      }
      return jsonResponse(result.status, { room: result.room });
    }

    if (
      path.startsWith("/p2p/trade/") &&
      path.endsWith("/messages") &&
      method === "GET"
    ) {
      const tradeId = path
        .replace(/^\/p2p\/trade\//, "")
        .replace(/\/messages$/, "");
      return jsonResponse(200, listTradeMessages(tradeId));
    }

    if (
      path.startsWith("/p2p/rooms/") &&
      path.endsWith("/messages") &&
      method === "GET"
    ) {
      const roomId = path
        .replace(/^\/p2p\/rooms\//, "")
        .replace(/\/messages$/, "");
      return jsonResponse(200, { messages: listTradeMessages(roomId) });
    }

    if (
      path.startsWith("/p2p/rooms/") &&
      path.endsWith("/messages") &&
      method === "POST"
    ) {
      let body: any = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {}
      const roomId = path
        .replace(/^\/p2p\/rooms\//, "")
        .replace(/\/messages$/, "");
      const { sender_wallet, message, attachment_url } = body;
      if (!sender_wallet || !message) {
        return jsonResponse(400, {
          error: "Missing required fields: sender_wallet, message",
        });
      }
      const msg = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        room_id: roomId,
        sender_wallet,
        message,
        attachment_url,
        created_at: Date.now(),
      };
      return jsonResponse(201, { message: msg });
    }

    if (path === "/p2p/trades/recent" && method === "GET") {
      const since = Number(event.queryStringParameters?.since || 0);
      const limit = Number(event.queryStringParameters?.limit || 100);
      const data = (listRecentTradeMessages({ since, limit }) as any) || {
        messages: [],
      };
      return jsonResponse(200, { messages: data.messages || [] });
    }

    if (
      path.startsWith("/p2p/trade/") &&
      path.endsWith("/message") &&
      method === "POST"
    ) {
      let body: any = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {}
      const tradeId = path
        .replace(/^\/p2p\/trade\//, "")
        .replace(/\/message$/, "");
      const result = addTradeMessage(
        tradeId,
        body?.message || "",
        body?.from || "unknown",
      );
      if ("error" in result)
        return jsonResponse(result.status, { error: result.error });
      return jsonResponse(result.status, { message: result.message });
    }

    if (
      path.startsWith("/p2p/trade/") &&
      path.endsWith("/proof") &&
      method === "POST"
    ) {
      let body: any = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {}
      const tradeId = path
        .replace(/^\/p2p\/trade\//, "")
        .replace(/\/proof$/, "");
      const result = uploadProof(tradeId, body?.proof);
      if ("error" in result)
        return jsonResponse(result.status, { error: result.error });

      // Optional Supabase storage upload if configured
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_KEY =
        process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
      let supabaseUrl: string | undefined = undefined;
      if (
        SUPABASE_URL &&
        SUPABASE_KEY &&
        body?.proof?.data &&
        body?.proof?.filename
      ) {
        try {
          const base64 = body.proof.data.includes(",")
            ? body.proof.data.split(",").pop()!
            : body.proof.data;
          const binary = Buffer.from(base64, "base64");
          const objectPath = `p2p-proofs/${encodeURIComponent(tradeId)}/${Date.now()}-${body.proof.filename}`;
          const endpoint = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${objectPath}`;
          const resp = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/octet-stream",
              "x-upsert": "true",
            },
            body: binary,
          });
          if (resp.ok) {
            supabaseUrl = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${objectPath}`;
          }
        } catch {}
      }

      return jsonResponse(result.status, { ok: true, url: supabaseUrl });
    }

    // Easypaisa webhook ingestion (best-effort schema)
    if (path === "/easypaisa/webhook" && method === "POST") {
      let body: any = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {}

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
      let body: any = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {}

      const methodName = body?.method;
      const params = body?.params ?? [];
      const id = body?.id ?? Date.now();

      if (!methodName || typeof methodName !== "string") {
        return jsonResponse(400, { error: "Missing RPC method" });
      }

      const result = await callRpc(methodName, params, id);
      return jsonResponse(200, result.body);
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
        FIXERCOIN: 0.005,
        SOL: 180,
        USDC: 1.0,
        USDT: 1.0,
        LOCKER: 0.1,
      };

      const PKR_PER_USD = 280; // base FX
      const MARKUP = 1.0425; // 4.25%

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
          if (typeof price === "number" && isFinite(price) && price > 0) {
            priceUsd = price;
          }
        }
      } catch {}

      if (priceUsd === null || !isFinite(priceUsd) || priceUsd <= 0) {
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

    // Binance P2P passthrough: /api/binance-p2p/<path>
    if (path.startsWith("/binance-p2p/")) {
      const BINANCE_P2P_ENDPOINTS = [
        "https://p2p.binance.com",
        "https://c2c.binance.com",
        "https://www.binance.com",
      ];
      const subPath = path.replace(/^\/binance-p2p\//, "/");
      const search = event.rawQuery ? `?${event.rawQuery}` : "";
      const requestBody =
        event.httpMethod !== "GET" && event.httpMethod !== "HEAD"
          ? (event.body ?? undefined)
          : undefined;
      const cacheKey = `${event.httpMethod}:${subPath}${search}:${requestBody ?? ""}`;
      const cached = BINANCE_P2P_CACHE.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return jsonResponse(200, cached.data);
      }

      const headersLower = event.headers || {};
      const uaHeader =
        headersLower["user-agent"] ||
        headersLower["User-Agent"] ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
      const traceId = uniqueId().replace(/-/g, "");
      const sessionId = uniqueId().replace(/-/g, "");
      const deviceInfo = buildDeviceInfoPayload(uaHeader);

      const baseHeaders: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": uaHeader,
        clienttype: "web",
        "cache-control": "no-cache",
        Origin: "https://p2p.binance.com",
        Referer: "https://p2p.binance.com/en",
        lang: "en",
        platform: "web",
        "Accept-Language": "en-US,en;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
        "X-Trace-Id": traceId,
        "device-info": deviceInfo,
        "bnc-uuid": sessionId,
        "bnc-visit-id": `${Math.floor(Date.now() / 1000)}`,
        csrftoken: traceId,
        "X-CSRF-TOKEN": traceId,
        timezone: "UTC",
      };

      if (requestBody === undefined) {
        delete baseHeaders["Content-Type"];
      }

      let lastErr = "";
      for (let i = 0; i < BINANCE_P2P_ENDPOINTS.length; i++) {
        const base = BINANCE_P2P_ENDPOINTS[i];
        const target = `${base}${subPath}${search}`;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const init: RequestInit = {
            method: event.httpMethod,
            headers: baseHeaders,
            signal: controller.signal,
          };
          if (requestBody !== undefined) {
            init.body = requestBody;
          }
          const resp = await fetch(target, init);
          clearTimeout(timeout);
          if (!resp.ok) {
            if ([403, 429, 502, 503].includes(resp.status)) {
              lastErr = `${resp.status} ${resp.statusText}`;
              await new Promise((resolve) => setTimeout(resolve, 150));
              continue;
            }
            const t = await resp.text().catch(() => "");
            return jsonResponse(resp.status, { error: t || resp.statusText });
          }
          const contentType = resp.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const json = await resp.json();
            BINANCE_P2P_CACHE.set(cacheKey, {
              expiresAt: Date.now() + BINANCE_P2P_CACHE_TTL,
              data: json,
            });
            return jsonResponse(200, json);
          }
          const text = await resp.text();
          return jsonResponse(200, text, {
            "Content-Type": contentType || "text/plain",
          });
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
        }
      }
      BINANCE_P2P_CACHE.delete(cacheKey);
      // Graceful fallback: return empty data set so client can fallback without network error noise
      return jsonResponse(200, {
        data: [],
        error: "All Binance P2P endpoints failed",
        details: lastErr,
      });
    }

    // Binance passthrough: /api/binance/<path>
    if (path.startsWith("/binance/")) {
      const BINANCE_ENDPOINTS = [
        "https://api.binance.com",
        "https://api1.binance.com",
        "https://api2.binance.com",
        "https://api3.binance.com",
      ];
      const subPath = path.replace(/^\/binance\//, "/");
      const search = event.rawQuery ? `?${event.rawQuery}` : "";
      let lastErr = "";
      for (let i = 0; i < BINANCE_ENDPOINTS.length; i++) {
        const base = BINANCE_ENDPOINTS[i];
        const target = `${base}${subPath}${search}`;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const resp = await fetch(target, { signal: controller.signal });
          clearTimeout(timeout);
          if (!resp.ok) {
            if ([429, 502, 503].includes(resp.status)) continue;
            const t = await resp.text().catch(() => "");
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}. ${t}`);
          }
          const text = await resp.text();
          // Try to return JSON if possible, else text
          try {
            const json = JSON.parse(text);
            return jsonResponse(200, json);
          } catch {
            return jsonResponse(200, text, { "Content-Type": "text/plain" });
          }
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
        }
      }
      return jsonResponse(502, {
        error: "All Binance endpoints failed",
        details: lastErr,
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

    // Wallet balance: /api/wallet/balance?publicKey=... (also supports wallet/address)
    if (path === "/wallet/balance" && method === "GET") {
      const pk = (
        event.queryStringParameters?.publicKey ||
        event.queryStringParameters?.wallet ||
        event.queryStringParameters?.address ||
        ""
      ).trim();
      if (!pk) return jsonResponse(400, { error: "Missing 'publicKey' parameter" });

      try {
        const rpc = await callRpc("getBalance", [pk], Date.now());
        const j = JSON.parse(String(rpc?.body || "{}"));
        const lamports =
          typeof j.result === "number" ? j.result : j?.result?.value ?? null;
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

    return jsonResponse(404, { error: `No handler for ${path}` });
  } catch (error) {
    return jsonResponse(502, {
      error: error instanceof Error ? error.message : String(error),
      schemaVersion: "1.0.0",
      pairs: [],
    });
  }
};
