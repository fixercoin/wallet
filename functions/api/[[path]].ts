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

    return jsonCors(404, { error: `No handler for ${normalizedPath}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonCors(502, { error: message, schemaVersion: "1.0.0", pairs: [] });
  }
};
