const CORS_METHODS = "GET, POST, PUT, DELETE, OPTIONS";
const CORS_HEADERS = "Content-Type, Authorization, X-Requested-With";

function applyCors(headers: Headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", CORS_METHODS);
  headers.set("Access-Control-Allow-Headers", CORS_HEADERS);
  headers.set("Vary", "Origin");
  return headers;
}

function createForwardRequest(request: Request, targetUrl: string) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  return new Request(targetUrl, init);
}

// Choose which provider to use based on env vars
import { SOLANA_RPC_URL as DEFAULT_RPC_URL } from "../../utils/solanaConfig";

async function proxyToSolanaRPC(
  request: Request,
  env: Record<string, string | undefined>,
) {
  // Build prioritized list of RPC endpoints: env-provided first, then public fallbacks
  const endpoints = [
    env.HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`
      : "",
    env.SOLANA_RPC_URL || "",
    env.HELIUS_RPC_URL || "",
    env.MORALIS_RPC_URL || "",
    env.ALCHEMY_RPC_URL || "",
    DEFAULT_RPC_URL || "",
    "https://api.mainnet-beta.solana.com",
    "https://rpc.ankr.com/solana",
    "https://solana.publicnode.com",
  ].filter(Boolean);

  if (endpoints.length === 0) {
    const headers = applyCors(
      new Headers({ "Content-Type": "application/json" }),
    );
    return new Response(
      JSON.stringify({ error: "No Solana RPC endpoints available" }),
      { status: 500, headers },
    );
  }

  let lastError: string = "";
  for (const rpcUrl of endpoints) {
    try {
      const response = await fetch(createForwardRequest(request, rpcUrl));
      // Forward successful response immediately
      if (response.ok) {
        const headers = applyCors(new Headers(response.headers));
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
      // If non-OK, read text for diagnostics and try next endpoint
      const txt = await response.text().catch(() => "");
      lastError = `${response.status} ${response.statusText} ${txt}`.trim();
    } catch (e: any) {
      lastError = e?.message || String(e);
    }
  }

  const headers = applyCors(
    new Headers({ "Content-Type": "application/json" }),
  );
  return new Response(
    JSON.stringify({
      error: "All Solana RPC endpoints failed",
      details: lastError || "Unknown error",
    }),
    { status: 502, headers },
  );
}

// DexScreener endpoints for failover
const DEXSCREENER_ENDPOINTS = [
  "https://api.dexscreener.com/latest/dex",
  "https://api.dexscreener.io/latest/dex",
];
let currentDexEndpointIndex = 0;

async function tryDexscreenerEndpoints(path: string) {
  let lastError: Error | null = null;

  for (let i = 0; i < DEXSCREENER_ENDPOINTS.length; i++) {
    const endpointIndex =
      (currentDexEndpointIndex + i) % DEXSCREENER_ENDPOINTS.length;
    const endpoint = DEXSCREENER_ENDPOINTS[endpointIndex];
    const url = `${endpoint}${path}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const resp = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        if (resp.status === 429) continue; // rate limited -> try next
        const t = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}. ${t}`);
      }

      const data = await resp.json();
      currentDexEndpointIndex = endpointIndex;
      return data;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (i < DEXSCREENER_ENDPOINTS.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw new Error(lastError?.message || "All DexScreener endpoints failed");
}

// In-memory cache and inflight dedupe for DexScreener requests (per-isolate, best-effort)
const DEX_CACHE_TTL_MS = 30_000;
const DEX_CACHE = new Map<string, { data: any; expiresAt: number }>();
const DEX_INFLIGHT = new Map<string, Promise<any>>();

async function fetchDexscreenerData(path: string) {
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
      const data = await tryDexscreenerEndpoints(path);
      DEX_CACHE.set(path, { data, expiresAt: Date.now() + DEX_CACHE_TTL_MS });
      return data;
    } finally {
      DEX_INFLIGHT.delete(path);
    }
  })();

  DEX_INFLIGHT.set(path, request);
  return request;
}

function jsonCors(status: number, body: any) {
  const headers = applyCors(
    new Headers({ "Content-Type": "application/json" }),
  );
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers,
  });
}

import {
  addEasypaisaPayment,
  listEasypaisaPayments,
} from "../../utils/p2pStore";
import {
  addEasypaisaPaymentCF,
  listEasypaisaPaymentsCF,
} from "../../utils/p2pStoreCf";

export const onRequest = async ({ request, env }) => {
  const url = new URL(request.url);
  const rawPath = url.pathname.replace(/^\/api/, "") || "/";
  const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const db: any = (env as any)?.FIXORIUM_WALLET_DB;
  const hasDb = !!db && typeof db.prepare === "function";

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: applyCors(new Headers()),
    });
  }

  try {
    // Root and health/status endpoints
    if (
      normalizedPath === "/" ||
      normalizedPath === "/health" ||
      normalizedPath === "/status"
    ) {
      return jsonCors(200, {
        ok: true,
        service: "Fixorium Wallet API (Cloudflare)",
        endpoints: [
          "/easypaisa/webhook [POST]",
          "/easypaisa/payments [GET]",
          "/solana-rpc [POST]",
          "/forex/rate [GET]",
          "/exchange-rate [GET]",
          "/token/price [GET]",
          "/sol/price [GET]",
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
        ],
      });
    }

    // Easypaisa webhook ingestion (best-effort schema)
    if (normalizedPath === "/easypaisa/webhook" && request.method === "POST") {
      let body: any = {};
      try {
        body = await request.json();
      } catch {}

      const configuredSecret = (env as any)?.EASYPAY_WEBHOOK_SECRET;
      const providedSecret =
        request.headers.get("x-webhook-secret") ||
        request.headers.get("x-easypay-secret") ||
        body?.secret ||
        "";
      if (configuredSecret && providedSecret !== configuredSecret) {
        return jsonCors(401, { error: "unauthorized" });
      }

      const msisdn = String(
        body?.msisdn ||
          body?.receiverMsisdn ||
          body?.account ||
          (env as any)?.EASYPAY_MSISDN ||
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
        return jsonCors(400, { error: "invalid payload" });
      }

      const result = hasDb
        ? await addEasypaisaPaymentCF(db, {
            msisdn,
            amount,
            currency,
            reference,
            sender,
            ts: isFinite(ts) ? ts : Date.now(),
          })
        : addEasypaisaPayment({
            msisdn,
            amount,
            currency,
            reference,
            sender,
            ts: isFinite(ts) ? ts : Date.now(),
          });
      return jsonCors((result as any).status, {
        payment: (result as any).payment,
      });
    }

    if (normalizedPath === "/easypaisa/payments" && request.method === "GET") {
      const msisdn =
        url.searchParams.get("msisdn") || (env as any)?.EASYPAY_MSISDN || "";
      const since = Number(url.searchParams.get("since") || 0);
      const data = hasDb
        ? await listEasypaisaPaymentsCF(db, { msisdn, since })
        : listEasypaisaPayments({ msisdn, since });
      return jsonCors(200, data);
    }

    // Solana RPC proxy
    if (normalizedPath === "/solana-rpc") {
      return await proxyToSolanaRPC(request, env);
    }

    // Forex rate proxy: /api/forex/rate?base=USD&symbols=PKR
    if (normalizedPath === "/forex/rate") {
      const base = (url.searchParams.get("base") || "USD").toUpperCase();
      const symbols = (url.searchParams.get("symbols") || "PKR").toUpperCase();
      const firstSymbol = symbols.split(",")[0];
      const targets = [firstSymbol];
      const PROVIDER_TIMEOUT_MS = 5000;
      const providers: Array<{
        name: string;
        url: string;
        parse: (j: any) => number | null;
      }> = [
        {
          name: "exchangerate.host",
          url: `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(firstSymbol)}`,
          parse: (j) =>
            j && j.rates && typeof j.rates[firstSymbol] === "number"
              ? j.rates[firstSymbol]
              : null,
        },
        {
          name: "frankfurter",
          url: `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(firstSymbol)}`,
          parse: (j) =>
            j && j.rates && typeof j.rates[firstSymbol] === "number"
              ? j.rates[firstSymbol]
              : null,
        },
        {
          name: "er-api",
          url: `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
          parse: (j) =>
            j && j.rates && typeof j.rates[firstSymbol] === "number"
              ? j.rates[firstSymbol]
              : null,
        },
        {
          name: "fawazahmed-cdn",
          url: `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/${base.toLowerCase()}/${firstSymbol.toLowerCase()}.json`,
          parse: (j) =>
            j && typeof j[firstSymbol.toLowerCase()] === "number"
              ? j[firstSymbol.toLowerCase()]
              : null,
        },
      ];

      const fetchProvider = async (
        provider: (typeof providers)[number],
      ): Promise<{ rate: number; provider: string }> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          PROVIDER_TIMEOUT_MS,
        );
        try {
          const resp = await fetch(provider.url, {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
            },
            signal: controller.signal,
          });
          if (!resp.ok) {
            const reason = `${resp.status} ${resp.statusText}`;
            throw new Error(reason.trim() || "non-ok response");
          }
          const json = await resp.json();
          const rate = provider.parse(json);
          if (typeof rate === "number" && isFinite(rate) && rate > 0) {
            return { rate, provider: provider.name };
          }
          throw new Error("invalid response payload");
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          throw new Error(`[${provider.name}] ${message}`);
        } finally {
          clearTimeout(timeoutId);
        }
      };

      const runProviders = () => {
        const attempts = providers.map((provider) => fetchProvider(provider));
        if (typeof Promise.any === "function") {
          return Promise.any(attempts);
        }
        return new Promise<{ rate: number; provider: string }>(
          (resolve, reject) => {
            const errors: string[] = [];
            let remaining = attempts.length;
            attempts.forEach((attempt) => {
              attempt.then(resolve).catch((err) => {
                errors.push(err instanceof Error ? err.message : String(err));
                remaining -= 1;
                if (remaining === 0) {
                  reject(new Error(errors.join("; ")));
                }
              });
            });
          },
        );
      };

      try {
        const { rate, provider } = await runProviders();
        return jsonCors(200, {
          base,
          symbols: targets,
          rates: { [firstSymbol]: rate },
          provider,
        });
      } catch (error) {
        const details =
          error instanceof AggregateError
            ? error.errors
                .map((err) =>
                  err instanceof Error ? err.message : String(err),
                )
                .join("; ")
            : error instanceof Error
              ? error.message
              : String(error);
        return jsonCors(502, {
          error: "Failed to fetch forex rate",
          details,
        });
      }
    }

    // Token exchange rate to PKR with markup: /api/exchange-rate?token=FIXERCOIN
    if (normalizedPath === "/exchange-rate") {
      const token = (
        url.searchParams.get("token") || "FIXERCOIN"
      ).toUpperCase();

      const TOKEN_MINTS: Record<string, string> = {
        SOL: "So11111111111111111111111111111111111111112",
        USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
        FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
        LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
      };

      const MINT_TO_PAIR_ADDRESS_EX: Record<string, string> = {
        H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump:
          "5CgLEWq9VJUEQ8my8UaxEovuSWArGoXCvaftpbX4RQMy", // FIXERCOIN
      };

      const MINT_TO_SEARCH_SYMBOL: Record<string, string> = {
        H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: "FIXERCOIN",
        EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: "LOCKER",
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

      let priceUsd: number | null = null;
      try {
        if (token === "USDC" || token === "USDT") {
          priceUsd = 1.0;
        } else if (TOKEN_MINTS[token]) {
          const mint = TOKEN_MINTS[token];

          // First, try pair address lookup if available
          const pairAddress = MINT_TO_PAIR_ADDRESS_EX[mint];
          if (pairAddress) {
            try {
              const pairData = await fetchDexscreenerData(
                `/pairs/solana/${pairAddress}`,
              );
              if (
                Array.isArray(pairData?.pairs) &&
                pairData.pairs.length > 0 &&
                pairData.pairs[0]?.priceUsd
              ) {
                priceUsd = Number(pairData.pairs[0].priceUsd);
              }
            } catch (e) {
              // Silently continue if pair lookup fails
            }
          }

          // If pair lookup didn't work, try mint-based lookup
          if (!priceUsd || priceUsd <= 0) {
            const data = await fetchDexscreenerData(`/tokens/${mint}`);
            let pairs = Array.isArray(data?.pairs) ? data.pairs : [];
            let price =
              pairs.length > 0 && pairs[0]?.priceUsd
                ? Number(pairs[0].priceUsd)
                : null;

            // Fallback to search if no pairs found
            if (!price || price <= 0) {
              const searchSymbol = MINT_TO_SEARCH_SYMBOL[mint];
              if (searchSymbol) {
                try {
                  const searchData = await fetchDexscreenerData(
                    `/search/?q=${encodeURIComponent(searchSymbol)}`,
                  );
                  const searchPairs = Array.isArray(searchData?.pairs)
                    ? searchData.pairs
                    : [];

                  // Look for pairs where this token is the base on Solana
                  let matchingPair = searchPairs.find(
                    (p: any) =>
                      p?.baseToken?.address === mint && p?.chainId === "solana",
                  );

                  // If not found as base on Solana, try as quote token on Solana
                  if (!matchingPair) {
                    matchingPair = searchPairs.find(
                      (p: any) =>
                        p?.quoteToken?.address === mint &&
                        p?.chainId === "solana",
                    );
                  }

                  // If still not found on Solana, try any chain as base
                  if (!matchingPair) {
                    matchingPair = searchPairs.find(
                      (p: any) => p?.baseToken?.address === mint,
                    );
                  }

                  // If still not found, try as quote on any chain
                  if (!matchingPair) {
                    matchingPair = searchPairs.find(
                      (p: any) => p?.quoteToken?.address === mint,
                    );
                  }

                  // Last resort: just take the first result
                  if (!matchingPair && searchPairs.length > 0) {
                    matchingPair = searchPairs[0];
                  }

                  if (matchingPair && matchingPair.priceUsd) {
                    price = Number(matchingPair.priceUsd);
                  }
                } catch (e) {
                  // Silently continue
                }
              }
            }

            if (typeof price === "number" && isFinite(price) && price > 0) {
              priceUsd = price;
            }
          }
        }
      } catch {}

      if (priceUsd === null || !isFinite(priceUsd) || priceUsd <= 0) {
        priceUsd = FALLBACK_USD[token] ?? FALLBACK_USD.FIXERCOIN;
      }

      const rateInPKR = priceUsd * PKR_PER_USD * MARKUP;
      return jsonCors(200, {
        token,
        priceUsd,
        priceInPKR: rateInPKR,
        rate: rateInPKR,
        pkrPerUsd: PKR_PER_USD,
        markup: MARKUP,
      });
    }

    // Dedicated token price endpoint: /api/token/price?token=FIXERCOIN or ?token=USDC or ?token=H4qKn... (mint)
    if (normalizedPath === "/token/price") {
      const tokenParam = (
        url.searchParams.get("token") || "FIXERCOIN"
      ).toUpperCase();
      // Support providing a mint address via 'mint' query param as well
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
        FIXERCOIN: 0.00008139, // Real-time market price
        SOL: 149.38, // Real-time market price
        USDC: 1.0,
        USDT: 1.0,
        LOCKER: 0.00001112, // Real-time market price
      };

      const PKR_PER_USD = 280; // base FX
      const MARKUP = 1.0425; // 4.25%

      // Determine token symbol and mint to query
      let token = tokenParam;
      let mint = mintParam || TOKEN_MINTS[token] || "";

      // If tokenParam looks like a mint (long base58), use it as mint and try to resolve symbol
      if (!mint && tokenParam && tokenParam.length > 40) {
        mint = tokenParam;
        // Try to map mint to known symbol
        const inv = Object.entries(TOKEN_MINTS).find(([, m]) => m === mint);
        if (inv) token = inv[0];
      }

      let priceUsd: number | null = null;
      let priceChange24h: number = 0;
      let volume24h: number = 0;
      let matchingPair: any = null;

      try {
        // Stablecoins -> 1
        if (token === "USDC" || token === "USDT") {
          priceUsd = 1.0;
          priceChange24h = 0;
          volume24h = 0;
        } else {
          // If we have a mint, try pair lookup and token lookup via DexScreener
          if (!mint && TOKEN_MINTS[token]) mint = TOKEN_MINTS[token];

          if (mint) {
            // Pair address lookup
            const pairAddress = MINT_TO_PAIR_ADDRESS_EX[mint];
            if (pairAddress) {
              try {
                const pairData = await fetchDexscreenerData(
                  `/pairs/solana/${pairAddress}`,
                );
                if (
                  Array.isArray(pairData?.pairs) &&
                  pairData.pairs.length > 0 &&
                  pairData.pairs[0]?.priceUsd
                ) {
                  matchingPair = pairData.pairs[0];
                  priceUsd = Number(matchingPair.priceUsd);
                  priceChange24h = matchingPair.priceChange?.h24 || 0;
                  volume24h = matchingPair.volume?.h24 || 0;
                }
              } catch (e) {
                // continue
              }
            }

            // Mint-based lookup
            if (!priceUsd || priceUsd <= 0) {
              try {
                const data = await fetchDexscreenerData(`/tokens/${mint}`);
                const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
                const p = pairs.length > 0 ? pairs[0] : null;
                if (p && p.priceUsd) {
                  matchingPair = p;
                  priceUsd = Number(p.priceUsd);
                  priceChange24h = p.priceChange?.h24 || 0;
                  volume24h = p.volume?.h24 || 0;
                }
              } catch (e) {
                // continue
              }
            }

            // Search fallback
            if ((!priceUsd || priceUsd <= 0) && mint) {
              const searchSymbol = MINT_TO_SEARCH_SYMBOL[mint];
              if (searchSymbol) {
                try {
                  const searchData = await fetchDexscreenerData(
                    `/search/?q=${encodeURIComponent(searchSymbol)}`,
                  );
                  const searchPairs = Array.isArray(searchData?.pairs)
                    ? searchData.pairs
                    : [];
                  let foundPair = searchPairs.find(
                    (p: any) =>
                      p?.baseToken?.address === mint && p?.chainId === "solana",
                  );
                  if (!foundPair) {
                    foundPair = searchPairs.find(
                      (p: any) =>
                        p?.quoteToken?.address === mint &&
                        p?.chainId === "solana",
                    );
                  }
                  if (!foundPair) foundPair = searchPairs[0];
                  if (foundPair && foundPair.priceUsd) {
                    matchingPair = foundPair;
                    priceUsd = Number(foundPair.priceUsd);
                    priceChange24h = foundPair.priceChange?.h24 || 0;
                    volume24h = foundPair.volume?.h24 || 0;
                  }
                } catch (e) {
                  // continue
                }
              }
            }
          }
        }
      } catch (e) {
        // ignore
      }

      if (priceUsd === null || !isFinite(priceUsd) || priceUsd <= 0) {
        priceUsd = FALLBACK_USD[token] ?? FALLBACK_USD.FIXERCOIN;
        priceChange24h = 0;
        volume24h = 0;
      }

      const rateInPKR = priceUsd * PKR_PER_USD * MARKUP;
      return jsonCors(200, {
        token,
        mint,
        priceUsd,
        priceInPKR: rateInPKR,
        rate: rateInPKR,
        pkrPerUsd: PKR_PER_USD,
        markup: MARKUP,
        priceChange24h,
        volume24h,
        pair: matchingPair || undefined,
      });
    }

    // Stablecoin 24h change: /api/stable-24h?symbols=USDC,USDT
    if (normalizedPath === "/stable-24h") {
      const symbolsParam = (
        url.searchParams.get("symbols") || "USDC,USDT"
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
        return jsonCors(400, { error: "No supported symbols provided" });
      }

      const apiUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      try {
        const resp = await fetch(apiUrl, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timeoutId);
        const result: Record<
          string,
          { priceUsd: number; change24h: number; mint: string }
        > = {};
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
        return jsonCors(200, { data: result });
      } catch (e) {
        clearTimeout(timeoutId);
        const result: Record<
          string,
          { priceUsd: number; change24h: number; mint: string }
        > = {};
        symbols.forEach((sym) => {
          const meta = COINGECKO_IDS[sym];
          if (!meta) return;
          result[sym] = { priceUsd: 1, change24h: 0, mint: meta.mint };
        });
        return jsonCors(200, { data: result });
      }
    }

    // DexScreener: /api/dexscreener/tokens?mints=...
    if (normalizedPath === "/dexscreener/tokens") {
      const mints = url.searchParams.get("mints");
      if (!mints) {
        return jsonCors(400, { error: "Missing 'mints' query parameter" });
      }
      const rawMints = mints
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const uniqSorted = Array.from(new Set(rawMints)).sort();
      if (uniqSorted.length === 0) {
        return jsonCors(400, { error: "No valid token mints provided" });
      }

      // Mint to pair address mapping for pump.fun tokens
      const MINT_TO_PAIR_ADDRESS: Record<string, string> = {
        H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump:
          "5CgLEWq9VJUEQ8my8UaxEovuSWArGoXCvaftpbX4RQMy",
        EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump:
          "7X7KkV94Y9jFhkXEMhgVcMHMRzALiGj5xKmM6TT3cUvK",
      };

      // Mint to search symbol mapping for tokens not found via mint lookup
      const MINT_TO_SEARCH_SYMBOL: Record<string, string> = {
        H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: "FIXERCOIN",
        EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: "LOCKER",
      };

      const pathForFetch = `/tokens/${uniqSorted.join(",")}`;
      const data = await fetchDexscreenerData(pathForFetch);
      let pairs = Array.isArray(data?.pairs)
        ? data.pairs.filter((p: any) => p?.chainId === "solana")
        : [];

      // Find which mints were found
      const foundMints = new Set<string>();
      pairs.forEach((p: any) => {
        if (p?.baseToken?.address) foundMints.add(p.baseToken.address);
      });

      // For missing mints, try pair address lookup first, then search-based lookup
      const missingMints = uniqSorted.filter((m) => !foundMints.has(m));
      if (missingMints.length > 0) {
        for (const mint of missingMints) {
          let found = false;

          // First, try pair address lookup if available
          const pairAddress = MINT_TO_PAIR_ADDRESS[mint];
          if (pairAddress) {
            try {
              const pairData = await fetchDexscreenerData(
                `/pairs/solana/${pairAddress}`,
              );
              if (Array.isArray(pairData?.pairs) && pairData.pairs.length > 0) {
                pairs.push(pairData.pairs[0]);
                found = true;
              }
            } catch (e) {
              // Silently continue if pair lookup fails
            }
          }

          // If pair lookup failed or unavailable, try search-based lookup
          if (!found) {
            const searchSymbol = MINT_TO_SEARCH_SYMBOL[mint];
            if (searchSymbol) {
              try {
                const searchData = await fetchDexscreenerData(
                  `/search/?q=${encodeURIComponent(searchSymbol)}`,
                );
                if (Array.isArray(searchData?.pairs)) {
                  // Look for pairs where this token is the base on Solana
                  let matchingPair = searchData.pairs.find(
                    (p: any) =>
                      p?.baseToken?.address === mint && p?.chainId === "solana",
                  );

                  // If not found as base on Solana, try as quote token on Solana
                  if (!matchingPair) {
                    matchingPair = searchData.pairs.find(
                      (p: any) =>
                        p?.quoteToken?.address === mint &&
                        p?.chainId === "solana",
                    );
                  }

                  // If still not found on Solana, try any chain as base
                  if (!matchingPair) {
                    matchingPair = searchData.pairs.find(
                      (p: any) => p?.baseToken?.address === mint,
                    );
                  }

                  // If still not found, try as quote on any chain
                  if (!matchingPair) {
                    matchingPair = searchData.pairs.find(
                      (p: any) => p?.quoteToken?.address === mint,
                    );
                  }

                  // Last resort: just take the first result
                  if (!matchingPair && searchData.pairs.length > 0) {
                    matchingPair = searchData.pairs[0];
                  }

                  if (matchingPair) {
                    pairs.push(matchingPair);
                  }
                }
              } catch (e) {
                // Silently continue if search fails
              }
            }
          }
        }
      }

      return jsonCors(200, {
        schemaVersion: data?.schemaVersion || "1.0.0",
        pairs,
      });
    }

    // DexScreener: /api/dexscreener/search?q=...
    if (normalizedPath === "/dexscreener/search") {
      const q = url.searchParams.get("q");
      if (!q) {
        return jsonCors(400, { error: "Missing 'q' query parameter" });
      }
      const data = await fetchDexscreenerData(
        `/search/?q=${encodeURIComponent(q)}`,
      );
      const pairs = Array.isArray(data?.pairs)
        ? data.pairs.filter((p: any) => p?.chainId === "solana").slice(0, 20)
        : [];
      return jsonCors(200, {
        schemaVersion: data?.schemaVersion || "1.0.0",
        pairs,
      });
    }

    // DexScreener: /api/dexscreener/trending
    if (normalizedPath === "/dexscreener/trending") {
      const data = await fetchDexscreenerData(`/pairs/solana`);
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
      return jsonCors(200, {
        schemaVersion: data?.schemaVersion || "1.0.0",
        pairs,
      });
    }

    // SOL price: /api/sol/price
    if (normalizedPath === "/sol/price") {
      try {
        const SOL_MINT = "So11111111111111111111111111111111111111112";
        const data = await fetchDexscreenerData(`/tokens/${SOL_MINT}`);
        const pair =
          Array.isArray(data?.pairs) && data.pairs.length > 0
            ? data.pairs[0]
            : null;
        if (!pair) {
          return jsonCors(404, { error: "SOL price data not found" });
        }
        const priceUsd = parseFloat(pair.priceUsd || "0");
        return jsonCors(200, {
          token: "SOL",
          price: priceUsd,
          priceUsd,
          priceChange24h: pair.priceChange?.h24 || 0,
          volume24h: pair.volume?.h24 || 0,
          marketCap: pair.marketCap || 0,
        });
      } catch (e: any) {
        return jsonCors(502, {
          error: "Failed to fetch SOL price",
          details: e?.message || String(e),
        });
      }
    }

    // Jupiter: /api/jupiter/price?ids=... (comma-separated mints)
    if (normalizedPath === "/jupiter/price") {
      const ids = url.searchParams.get("ids");
      if (!ids) {
        return jsonCors(400, {
          error: "Missing 'ids' query parameter (comma-separated mints)",
        });
      }

      const JUPITER_PRICE_ENDPOINTS = [
        "https://price.jup.ag/v4",
        "https://api.jup.ag/price/v2",
      ];

      let currentIdx = 0;
      let lastError: string = "";
      const params = new URLSearchParams({ ids });

      for (let i = 0; i < JUPITER_PRICE_ENDPOINTS.length; i++) {
        const endpoint =
          JUPITER_PRICE_ENDPOINTS[
            (currentIdx + i) % JUPITER_PRICE_ENDPOINTS.length
          ];
        const apiUrl = `${endpoint}/price?${params.toString()}`;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          const resp = await fetch(apiUrl, {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (!resp.ok) {
            if (resp.status === 429) continue;
            lastError = `HTTP ${resp.status}: ${resp.statusText}`;
            continue;
          }
          const data = await resp.json();
          currentIdx = i;
          return jsonCors(200, data);
        } catch (e: any) {
          lastError = e?.message || String(e);
        }
      }
      return jsonCors(502, {
        error: `All Jupiter price endpoints failed`,
        details: lastError || "Unknown error",
        data: {},
      });
    }

    // Jupiter: /api/jupiter/tokens?type=strict|all
    if (normalizedPath === "/jupiter/tokens") {
      const type = url.searchParams.get("type") || "strict";
      const typesToTry = [type, "all"]; // fallback
      const baseEndpoints = (t: string) => [
        `https://token.jup.ag/${t}`,
        "https://cache.jup.ag/tokens",
      ];

      const fetchWithTimeout = (u: string, ms: number) => {
        const timeoutPromise = new Promise<Response>((resolve) => {
          setTimeout(
            () =>
              resolve(
                new Response("", {
                  status: 504,
                  statusText: "Gateway Timeout",
                }),
              ),
            ms,
          );
        });
        return Promise.race([
          fetch(u, {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
            },
          }),
          timeoutPromise,
        ]) as Promise<Response>;
      };

      let lastError = "";
      for (const t of typesToTry) {
        const endpoints = baseEndpoints(t);
        for (let attempt = 1; attempt <= 3; attempt++) {
          for (const endpoint of endpoints) {
            try {
              const resp = await fetchWithTimeout(endpoint, 15000);
              if (!resp.ok) {
                lastError = `${endpoint} -> ${resp.status} ${resp.statusText}`;
                if (resp.status === 429 || resp.status >= 500) continue;
                continue;
              }
              const data = await resp.json();
              return jsonCors(200, data);
            } catch (e: any) {
              lastError = `${endpoint} -> ${e?.message || String(e)}`;
            }
          }
          await new Promise((r) => setTimeout(r, attempt * 500));
        }
      }

      return jsonCors(502, {
        error: {
          message: "All Jupiter token endpoints failed",
          details: lastError || "Unknown error",
        },
        data: [],
      });
    }

    // Jupiter: /api/jupiter/quote
    if (normalizedPath === "/jupiter/quote") {
      const inputMint = url.searchParams.get("inputMint");
      const outputMint = url.searchParams.get("outputMint");
      const amount = url.searchParams.get("amount");
      const slippageBps = url.searchParams.get("slippageBps") || "50";
      const asLegacyTransaction =
        url.searchParams.get("asLegacyTransaction") || "false";
      if (!inputMint || !outputMint || !amount) {
        return jsonCors(400, {
          error: "Missing required query params: inputMint, outputMint, amount",
        });
      }
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount,
        slippageBps,
        onlyDirectRoutes: "false",
        asLegacyTransaction,
      });
      const urlStr = `https://lite-api.jup.ag/swap/v1/quote?${params.toString()}`;

      let lastStatus = 0;
      let lastText = "";
      for (let attempt = 1; attempt <= 3; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const resp = await fetch(urlStr, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        lastStatus = resp.status;
        if (resp.ok) {
          const data = await resp.json();
          return jsonCors(200, data);
        }
        lastText = await resp.text().catch(() => "");
        if (resp.status === 429 || resp.status >= 500) {
          await new Promise((r) => setTimeout(r, attempt * 500));
          continue;
        }
        break;
      }
      return jsonCors(lastStatus || 500, {
        error: "Quote failed",
        details: lastText,
      });
    }

    // Jupiter: /api/jupiter/swap (POST)
    if (normalizedPath === "/jupiter/swap") {
      if (request.method !== "POST") {
        return jsonCors(405, { error: "Method Not Allowed" });
      }
      let body: any = {};
      try {
        body = await request.json();
      } catch (_) {}
      if (!body || !body.quoteResponse || !body.userPublicKey) {
        return jsonCors(400, {
          error:
            "Missing required body: { quoteResponse, userPublicKey, ...options }",
        });
      }

      let lastErr = "";
      for (let attempt = 1; attempt <= 2; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const resp = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          lastErr = text;

          // Parse error to check for 1016 or simulation failures
          let errorData: any = {};
          try {
            errorData = JSON.parse(text);
          } catch (_) {}

          const errorMsg =
            errorData?.error?.message ||
            errorData?.error ||
            errorData?.message ||
            text;
          const errorCode = errorData?.code || errorData?.error?.code;

          // Log details for debugging
          console.error(
            `Jupiter swap error (attempt ${attempt}/2):`,
            errorCode,
            errorMsg,
          );

          // Return error response with code and message for client to handle
          return jsonCors(resp.status, {
            error: errorMsg || `Swap failed: ${resp.statusText}`,
            code: errorCode,
            message: errorMsg,
            details: text,
          });
        }

        const data = await resp.json();
        return jsonCors(200, data);
      }

      return jsonCors(502, {
        error: "Swap request failed",
        details: lastErr,
      });
    }

    // Wallet balance: /api/wallet/balance?publicKey=... (also supports wallet/address)
    if (normalizedPath === "/wallet/balance" && request.method === "GET") {
      const pk =
        url.searchParams.get("publicKey") ||
        url.searchParams.get("wallet") ||
        url.searchParams.get("address") ||
        "";
      if (!pk) {
        return jsonCors(400, { error: "Missing 'publicKey' parameter" });
      }

      const endpoints = [
        env.HELIUS_API_KEY
          ? `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`
          : "",
        env.SOLANA_RPC_URL || "",
        env.HELIUS_RPC_URL || "",
        env.MORALIS_RPC_URL || "",
        env.ALCHEMY_RPC_URL || "",
        DEFAULT_RPC_URL || "",
        "https://api.mainnet-beta.solana.com",
        "https://rpc.ankr.com/solana",
        "https://solana.publicnode.com",
      ].filter(Boolean);

      const rpcBody = {
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [pk],
      };

      let lastErr = "";
      for (const rpcUrl of endpoints) {
        try {
          const resp = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rpcBody),
          });
          const data = await resp.json().catch(() => null);
          if (!data) continue;
          if (data.error) {
            lastErr = data.error?.message || "RPC error";
            continue;
          }
          const lamports =
            typeof data.result === "number"
              ? data.result
              : (data.result?.value ?? null);
          if (typeof lamports === "number" && isFinite(lamports)) {
            const balance = lamports / 1_000_000_000;
            return jsonCors(200, {
              publicKey: pk,
              balance,
              balanceLamports: lamports,
            });
          }
        } catch (e: any) {
          lastErr = e?.message || String(e);
          continue;
        }
      }
      return jsonCors(502, {
        error: "Failed to fetch balance",
        details: lastErr || "All RPC endpoints failed",
      });
    }

    // Solana RPC proxy: /api/solana-rpc (POST JSON-RPC)
    if (normalizedPath === "/solana-rpc" && request.method === "POST") {
      let rpcRequest: any = null;
      try {
        rpcRequest = await request.json();
      } catch {
        return jsonCors(400, { error: "Invalid JSON body" });
      }
      if (!rpcRequest || typeof rpcRequest !== "object" || !rpcRequest.method) {
        return jsonCors(400, { error: "Missing RPC method" });
      }

      const endpoints = [
        env.SOLANA_RPC || "",
        env.SOLANA_RPC_URL || "",
        env.HELIUS_RPC_URL || "",
        env.MORALIS_RPC_URL || "",
        env.ALCHEMY_RPC_URL || "",
        "https://api.mainnet-beta.solana.com",
        "https://rpc.ankr.com/solana",
        "https://solana.publicnode.com",
      ].filter(Boolean);

      let lastErr = "";
      for (const rpcUrl of endpoints) {
        try {
          const resp = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rpcRequest),
          });
          const text = await resp.text();
          // Always return upstream status and body to the client
          return new Response(text, {
            status: resp.status,
            headers: applyCors(
              new Headers({ "Content-Type": "application/json" }),
            ),
          });
        } catch (e: any) {
          lastErr = e?.message || String(e);
          continue;
        }
      }
      return jsonCors(502, {
        error: "All RPC endpoints failed",
        details: lastErr || "Unknown error",
      });
    }

    // DexTools price proxy: /api/dextools/price?tokenAddress=...&chainId=solana
    if (normalizedPath === "/dextools/price" && request.method === "GET") {
      const tokenAddress = url.searchParams.get("tokenAddress") || "";
      const chainId = url.searchParams.get("chainId") || "solana";

      if (!tokenAddress) {
        return jsonCors(400, { error: "Missing 'tokenAddress' parameter" });
      }

      try {
        const dexUrl = `https://api.dextools.io/v1/token/${chainId}/${tokenAddress}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(dexUrl, {
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          return jsonCors(resp.status, {
            error: `DexTools API returned ${resp.status}`,
          });
        }

        const data = await resp.json();
        return jsonCors(200, data.data || data);
      } catch (e: any) {
        return jsonCors(502, {
          error: "Failed to fetch DexTools price",
          details: e?.message || String(e),
        });
      }
    }

    // CoinMarketCap price proxy: /api/coinmarketcap/quotes?symbols=...
    if (
      normalizedPath === "/coinmarketcap/quotes" &&
      request.method === "GET"
    ) {
      const symbols = url.searchParams.get("symbols") || "";

      if (!symbols) {
        return jsonCors(400, { error: "Missing 'symbols' parameter" });
      }

      try {
        const cmcApiKey = env.COINMARKETCAP_API_KEY || "";
        if (!cmcApiKey) {
          return jsonCors(500, {
            error: "CoinMarketCap API key not configured",
          });
        }

        const cmcUrl = new URL(
          "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest",
        );
        cmcUrl.searchParams.set("symbol", symbols);
        cmcUrl.searchParams.set("convert", "USD");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(cmcUrl.toString(), {
          headers: {
            Accept: "application/json",
            "X-CMC_PRO_API_KEY": cmcApiKey,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          return jsonCors(resp.status, {
            error: `CoinMarketCap API returned ${resp.status}`,
          });
        }

        const data = await resp.json();
        return jsonCors(200, data);
      } catch (e: any) {
        return jsonCors(502, {
          error: "Failed to fetch CoinMarketCap prices",
          details: e?.message || String(e),
        });
      }
    }

    // Pump.fun BUY endpoint: /api/pumpfun/buy
    if (normalizedPath === "/pumpfun/buy" && request.method === "POST") {
      try {
        let body: any = {};
        try {
          body = await request.json();
        } catch {
          return jsonCors(400, {
            error: "Invalid JSON body",
          });
        }

        const { mint, amount, buyer } = body;

        if (!mint || typeof amount !== "number" || !buyer) {
          return jsonCors(400, {
            error:
              "Missing required fields: mint, amount (number), buyer (string)",
          });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const portalUrl = "https://pumpportal.fun/api/trade";
        const res = await fetch(portalUrl, {
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

        clearTimeout(timeoutId);
        const text = await res.text();

        return new Response(text, {
          status: res.status,
          headers: applyCors(
            new Headers({ "Content-Type": "application/json" }),
          ),
        });
      } catch (error: any) {
        const message = error?.message || "Unknown error";
        console.error("Pump.fun BUY endpoint error:", error);

        return jsonCors(502, {
          error: "Failed to request BUY transaction",
          details: message,
        });
      }
    }

    // Pump.fun SELL endpoint: /api/pumpfun/sell
    if (normalizedPath === "/pumpfun/sell" && request.method === "POST") {
      try {
        let body: any = {};
        try {
          body = await request.json();
        } catch {
          return jsonCors(400, {
            error: "Invalid JSON body",
          });
        }

        const { mint, amount, seller } = body;

        if (!mint || typeof amount !== "number" || !seller) {
          return jsonCors(400, {
            error:
              "Missing required fields: mint, amount (number), seller (string)",
          });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const portalUrl = "https://pumpportal.fun/api/trade";
        const res = await fetch(portalUrl, {
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

        clearTimeout(timeoutId);
        const text = await res.text();

        return new Response(text, {
          status: res.status,
          headers: applyCors(
            new Headers({ "Content-Type": "application/json" }),
          ),
        });
      } catch (error: any) {
        const message = error?.message || "Unknown error";
        console.error("Pump.fun SELL endpoint error:", error);

        return jsonCors(502, {
          error: "Failed to request SELL transaction",
          details: message,
        });
      }
    }

    // Pump.fun CURVE endpoint: /api/pumpfun/curve
    if (normalizedPath === "/pumpfun/curve" && request.method === "GET") {
      try {
        const mint = url.searchParams.get("mint");

        if (!mint) {
          return jsonCors(400, {
            error: "Missing required parameter: mint",
          });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const pumpFunUrl = `https://pump.fun/api/curve?mint=${encodeURIComponent(mint)}`;
        const res = await fetch(pumpFunUrl, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const text = await res.text();

        return new Response(text, {
          status: res.status,
          headers: applyCors(
            new Headers({ "Content-Type": "application/json" }),
          ),
        });
      } catch (error: any) {
        const message = error?.message || "Unknown error";
        console.error("Pump.fun CURVE endpoint error:", error);

        return jsonCors(502, {
          error: "Failed to check curve state",
          details: message,
        });
      }
    }

    return jsonCors(404, { error: `No handler for ${normalizedPath}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonCors(502, { error: message, schemaVersion: "1.0.0", pairs: [] });
  }
};
