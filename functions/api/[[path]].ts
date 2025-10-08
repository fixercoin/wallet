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
import { ALCHEMY_RPC_URL as DEFAULT_RPC_URL } from "../../utils/solanaConfig";

async function proxyToSolanaRPC(
  request: Request,
  env: Record<string, string | undefined>,
) {
  let rpcUrl = "";
  if (env.HELIUS_API_KEY) {
    rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`;
  } else if (env.ALCHEMY_RPC_URL) {
    rpcUrl = env.ALCHEMY_RPC_URL;
  } else if (DEFAULT_RPC_URL) {
    rpcUrl = DEFAULT_RPC_URL;
  } else {
    const headers = applyCors(
      new Headers({ "Content-Type": "application/json" }),
    );
    return new Response(
      JSON.stringify({ error: "No Solana RPC endpoint configured." }),
      { status: 500, headers },
    );
  }

  const response = await fetch(createForwardRequest(request, rpcUrl));
  const headers = applyCors(new Headers(response.headers));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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

function jsonCors(status: number, body: any) {
  const headers = applyCors(
    new Headers({ "Content-Type": "application/json" }),
  );
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers,
  });
}

export const onRequest = async ({ request, env }) => {
  const url = new URL(request.url);
  const rawPath = url.pathname.replace(/^\/api/, "") || "/";
  const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: applyCors(new Headers()),
    });
  }

  try {
    // Solana RPC proxy
    if (normalizedPath === "/solana-rpc") {
      return await proxyToSolanaRPC(request, env);
    }

    // DexScreener: /api/dexscreener/tokens?mints=...
    if (normalizedPath === "/dexscreener/tokens") {
      const mints = url.searchParams.get("mints");
      if (!mints) {
        return jsonCors(400, { error: "Missing 'mints' query parameter" });
      }
      const data = await tryDexscreenerEndpoints(`/tokens/${mints}`);
      const pairs = Array.isArray(data?.pairs)
        ? data.pairs.filter((p: any) => p?.chainId === "solana")
        : [];
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
      const data = await tryDexscreenerEndpoints(
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
      const data = await tryDexscreenerEndpoints(`/pairs/solana`);
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
        const endpoint = JUPITER_PRICE_ENDPOINTS[(currentIdx + i) % JUPITER_PRICE_ENDPOINTS.length];
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
          setTimeout(() => resolve(new Response("", { status: 504, statusText: "Gateway Timeout" })), ms);
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
        error: { message: "All Jupiter token endpoints failed", details: lastError || "Unknown error" },
        data: [],
      });
    }

    // Jupiter: /api/jupiter/quote
    if (normalizedPath === "/jupiter/quote") {
      const inputMint = url.searchParams.get("inputMint");
      const outputMint = url.searchParams.get("outputMint");
      const amount = url.searchParams.get("amount");
      const slippageBps = url.searchParams.get("slippageBps") || "50";
      const asLegacyTransaction = url.searchParams.get("asLegacyTransaction") || "false";
      if (!inputMint || !outputMint || !amount) {
        return jsonCors(400, { error: "Missing required query params: inputMint, outputMint, amount" });
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
      return jsonCors(lastStatus || 500, { error: "Quote failed", details: lastText });
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
        return jsonCors(400, { error: "Missing required body: { quoteResponse, userPublicKey, ...options }" });
      }
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
        return jsonCors(resp.status, { error: `Swap failed: ${resp.statusText}`, details: text });
      }
      const data = await resp.json();
      return jsonCors(200, data);
    }

    return jsonCors(404, { error: `No handler for ${normalizedPath}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonCors(502, { error: message, schemaVersion: "1.0.0", pairs: [] });
  }
};
