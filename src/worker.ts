export interface Env {
  SOLANA_RPC?: string;
}

// RPC endpoints
// Prefer reliable public providers by default
const DEFAULT_SOLANA_RPC = "https://solana.publicnode.com";
const FALLBACK_RPC_ENDPOINTS = [
  "https://solana.publicnode.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
];

// External API endpoints
const PUMPFUN_QUOTE = "https://pumpportal.fun/api/quote";
const PUMPFUN_TRADE = "https://pumpportal.fun/api/trade";
const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex";
const DEXSCREENER_IO = "https://api.dexscreener.io/latest/dex"; // Alternative
const JUPITER_PRICE_BASE = "https://price.jup.ag/v4";
const JUPITER_SWAP_BASE = "https://lite-api.jup.ag/swap/v1";
const JUPITER_TOKENS_BASE = "https://token.jup.ag";
const DEXTOOLS_BASE = "https://api.dextools.io/free/v2/token/matic";
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const SOLANA_TOKENLIST_URL =
  "https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json";

// CORS headers
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

// Utility: Fetch with timeout
function timeoutFetch(
  resource: string,
  options: RequestInit = {},
  ms = 20000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const init = { ...options, signal: controller.signal };
  return fetch(resource, init)
    .finally(() => clearTimeout(timer))
    .catch((e) => {
      clearTimeout(timer);
      throw e;
    });
}

// Utility: Browser-like headers
function browserHeaders(overrides: Record<string, string> = {}) {
  return Object.assign(
    {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
    },
    overrides,
  );
}

// Utility: Safe JSON parsing
async function safeJson(resp: Response): Promise<any> {
  try {
    return await resp.json();
  } catch {
    try {
      const t = await resp.text();
      return { text: t };
    } catch {
      return null;
    }
  }
}

// ============ ROUTE HANDLERS ============

// Health check
async function handleHealth(): Promise<Response> {
  const upstream: Record<string, string> = {};
  const tests = [
    ["dexscreener", `${DEXSCREENER_BASE}/pairs/solana`],
    [
      "jupiter",
      `${JUPITER_PRICE_BASE}/price?ids=So11111111111111111111111111111111111111112`,
    ],
    ["pumpfun", PUMPFUN_QUOTE],
  ];

  await Promise.allSettled(
    tests.map(async ([name, endpoint]) => {
      try {
        const r = await timeoutFetch(
          endpoint,
          { method: "GET", headers: browserHeaders() },
          5000,
        );
        upstream[name] = r.ok ? "ok" : `fail:${r.status}`;
      } catch (e: any) {
        upstream[name] = `fail:${String(e?.message || e).slice(0, 50)}`;
      }
    }),
  );

  return new Response(
    JSON.stringify({
      status: "ok",
      upstream,
      timestamp: new Date().toISOString(),
    }),
    { headers: CORS_HEADERS },
  );
}

// Wallet balance - SOL
async function handleWalletBalance(url: URL, env: Env): Promise<Response> {
  const publicKey = url.searchParams.get("publicKey");
  if (!publicKey) {
    return new Response(JSON.stringify({ error: "publicKey required" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const SOLANA_RPC = env.SOLANA_RPC ?? DEFAULT_SOLANA_RPC;
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "getBalance",
    params: [publicKey],
  };

  try {
    const rpcRes = await timeoutFetch(SOLANA_RPC, {
      method: "POST",
      headers: browserHeaders(),
      body: JSON.stringify(payload),
    });
    const rpcJson = await rpcRes.json();
    const lamports = rpcJson?.result?.value ?? 0;
    const sol = lamports / 1_000_000_000;
    return new Response(JSON.stringify({ lamports, sol, publicKey }), {
      headers: CORS_HEADERS,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: "rpc_error",
        details: String(e?.message || e).slice(0, 200),
      }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

// Wallet tokens - SPL accounts
async function handleWalletTokens(url: URL, env: Env): Promise<Response> {
  const publicKey = url.searchParams.get("publicKey");
  if (!publicKey) {
    return new Response(JSON.stringify({ error: "publicKey required" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const SOLANA_RPC = env.SOLANA_RPC ?? DEFAULT_SOLANA_RPC;
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "getTokenAccountsByOwner",
    params: [
      publicKey,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed" },
    ],
  };

  try {
    const rpcRes = await timeoutFetch(SOLANA_RPC, {
      method: "POST",
      headers: browserHeaders(),
      body: JSON.stringify(payload),
    });
    const rpcJson = await rpcRes.json();
    const arr = rpcJson?.result?.value ?? [];
    const tokens = arr.map((t: any) => {
      const acc = t.account?.data?.parsed?.info;
      const mint = acc?.mint;
      const amountRaw = acc?.tokenAmount?.amount ?? "0";
      const decimals = acc?.tokenAmount?.decimals ?? 0;
      const uiAmount = Number(amountRaw) / Math.pow(10, decimals);
      return { mint, amountRaw, uiAmount, decimals, owner: t.pubkey };
    });
    return new Response(JSON.stringify({ tokens }), { headers: CORS_HEADERS });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: "rpc_error", details: String(e?.message || e) }),
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

// Generic price endpoint using DexScreener
async function handlePrice(url: URL): Promise<Response> {
  const mint = url.searchParams.get("mint");
  if (!mint) {
    return new Response(JSON.stringify({ error: "mint required" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  try {
    const r = await timeoutFetch(`${DEXSCREENER_BASE}/tokens/${mint}`, {
      method: "GET",
      headers: browserHeaders(),
    });
    const j = await safeJson(r);
    return new Response(JSON.stringify({ data: j }), { headers: CORS_HEADERS });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 502,
      headers: CORS_HEADERS,
    });
  }
}

// ... rest of the worker unchanged (routes dispatching etc.)
