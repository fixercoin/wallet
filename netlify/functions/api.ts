// Netlify Functions entry to handle /api/* routes
// Currently implements /api/solana-rpc for wallet balances & SPL token accounts

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
      return { ok: true, body: data };
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
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
      if (i < DEXSCREENER_ENDPOINTS.length - 1) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(lastError?.message || "All DexScreener endpoints failed");
}

export const handler = async (event: any) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(204, "");
  }

  const path =
    (event.path || "").replace(/^\/.netlify\/functions\/api/, "") || "/";

  try {
    // Solana RPC
    if (path === "/solana-rpc" && event.httpMethod === "POST") {
      let body: any = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {}

      const method = body?.method;
      const params = body?.params ?? [];
      const id = body?.id ?? Date.now();

      if (!method || typeof method !== "string") {
        return jsonResponse(400, { error: "Missing RPC method" });
      }

      const result = await callRpc(method, params, id);
      return jsonResponse(200, result.body);
    }

    // DexScreener: tokens
    if (path === "/dexscreener/tokens" && event.httpMethod === "GET") {
      const mints = event.queryStringParameters?.mints;
      if (!mints) return jsonResponse(400, { error: "Missing 'mints' query parameter" });
      const data = await tryDexEndpoints(`/tokens/${mints}`);
      const pairs = Array.isArray(data?.pairs) ? data.pairs.filter((p: any) => p?.chainId === "solana") : [];
      return jsonResponse(200, { schemaVersion: data?.schemaVersion || "1.0.0", pairs });
    }

    // DexScreener: search
    if (path === "/dexscreener/search" && event.httpMethod === "GET") {
      const q = event.queryStringParameters?.q;
      if (!q) return jsonResponse(400, { error: "Missing 'q' query parameter" });
      const data = await tryDexEndpoints(`/search/?q=${encodeURIComponent(q)}`);
      const pairs = Array.isArray(data?.pairs) ? data.pairs.filter((p: any) => p?.chainId === "solana").slice(0, 20) : [];
      return jsonResponse(200, { schemaVersion: data?.schemaVersion || "1.0.0", pairs });
    }

    // DexScreener: trending
    if (path === "/dexscreener/trending" && event.httpMethod === "GET") {
      const data = await tryDexEndpoints(`/pairs/solana`);
      const pairs = Array.isArray(data?.pairs)
        ? data.pairs
            .filter((p: any) => (p?.volume?.h24 || 0) > 1000 && (p?.liquidity?.usd || 0) > 10000)
            .sort((a: any, b: any) => (b?.volume?.h24 || 0) - (a?.volume?.h24 || 0))
            .slice(0, 50)
        : [];
      return jsonResponse(200, { schemaVersion: data?.schemaVersion || "1.0.0", pairs });
    }

    // Unknown API route
    return jsonResponse(404, { error: `No handler for ${path}` });
  } catch (error) {
    return jsonResponse(502, {
      error: error instanceof Error ? error.message : String(error),
      schemaVersion: "1.0.0",
      pairs: [],
    });
  }
};
