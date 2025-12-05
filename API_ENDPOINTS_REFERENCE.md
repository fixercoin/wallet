# Fixorium Wallet - Complete API Endpoints Reference

This document outlines all available API endpoints for your Cloudflare Workers deployment. Copy the handler functions and add them to your `worker.js` file.

---

## 1. Health & Status Endpoints

### GET `/api/health`

Health check with upstream service status.

**Request:**

```
GET https://your-worker.workers.dev/api/health
```

**Response (200):**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**Handler:**

```javascript
async function handleHealth() {
  return new Response(
    JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
    {
      headers: { "content-type": "application/json", ...corsHeaders() },
    },
  );
}
```

### GET `/api/ping`

Ping endpoint.

**Request:**

```
GET https://your-worker.workers.dev/api/ping
```

**Response (200):**

```json
{
  "status": "pong",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**Handler:**

```javascript
async function handlePing() {
  return new Response(
    JSON.stringify({ status: "pong", timestamp: new Date().toISOString() }),
    {
      headers: { "content-type": "application/json", ...corsHeaders() },
    },
  );
}
```

### GET `/api`

Root API information.

**Request:**

```
GET https://your-worker.workers.dev/api
```

**Response (200):**

```json
{
  "status": "ok",
  "message": "Fixorium Worker API",
  "version": "1.0.0",
  "endpoints": [
    "/api/health",
    "/api/ping",
    "/api/wallet/balance?publicKey=...",
    "/api/forex/rate?base=USD&symbols=PKR",
    "/api/dexscreener/tokens?mints=...",
    "/api/dexscreener/price?tokenAddress=...",
    "/api/jupiter/price?ids=...",
    "/api/jupiter/quote?inputMint=...&outputMint=...&amount=..."
  ]
}
```

---

## 2. Wallet Endpoints

### GET `/api/wallet/balance`

Get SOL balance for a wallet.

**Request:**

```
GET https://your-worker.workers.dev/api/wallet/balance?publicKey=<public_key>
```

**Query Parameters:**

- `publicKey` (required): Solana public key

**Response (200):**

```json
{
  "publicKey": "So11111111111111111111111111111111111111112",
  "balance": 1.5,
  "balanceLamports": 1500000000
}
```

**Response (400):**

```json
{
  "error": "Missing publicKey parameter"
}
```

**Handler:**

```javascript
async function handleWalletBalance(reqUrl, env) {
  const publicKey =
    reqUrl.searchParams.get("publicKey") ||
    reqUrl.searchParams.get("wallet") ||
    reqUrl.searchParams.get("address");
  if (!publicKey) {
    return new Response(
      JSON.stringify({ error: "Missing publicKey parameter" }),
      {
        status: 400,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  }

  const rpcCandidates = [];
  if (env && env.SOLANA_RPC_URL) rpcCandidates.push(env.SOLANA_RPC_URL);
  if (env && env.ALCHEMY_RPC_URL) rpcCandidates.push(env.ALCHEMY_RPC_URL);
  if (env && env.HELIUS_RPC_URL) rpcCandidates.push(env.HELIUS_RPC_URL);
  if (env && env.MORALIS_RPC_URL) rpcCandidates.push(env.MORALIS_RPC_URL);
  if (env && env.HELIUS_API_KEY)
    rpcCandidates.push(
      `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`,
    );
  rpcCandidates.push(
    "https://solana.publicnode.com",
    "https://rpc.ankr.com/solana",
    "https://api.mainnet-beta.solana.com",
  );

  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getBalance",
    params: [publicKey],
  };

  let lastErr = null;
  for (const endpoint of rpcCandidates) {
    try {
      const res = await timeoutFetch(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        6000,
      );
      if (!res.ok) {
        lastErr = new Error(`RPC ${endpoint} ${res.status}`);
        continue;
      }
      const j = await res.json();
      if (j.error) {
        lastErr = new Error(j.error.message || JSON.stringify(j.error));
        continue;
      }
      const balLamports = j.result?.value ?? j.result ?? j;
      const lam =
        typeof balLamports === "object" && "value" in balLamports
          ? balLamports.value
          : balLamports;
      const balanceLamports = Number(lam) ?? 0;
      const balance = balanceLamports / 1_000_000_000;
      return new Response(
        JSON.stringify({ publicKey, balance, balanceLamports }),
        { headers: { "content-type": "application/json", ...corsHeaders() } },
      );
    } catch (e) {
      lastErr = e;
      continue;
    }
  }

  return new Response(
    JSON.stringify({ error: lastErr ? lastErr.message : "All RPCs failed" }),
    {
      status: 502,
      headers: { "content-type": "application/json", ...corsHeaders() },
    },
  );
}
```

---

## 3. Forex Endpoints

### GET `/api/forex/rate`

Get forex exchange rates.

**Request:**

```
GET https://your-worker.workers.dev/api/forex/rate?base=USD&symbols=PKR
```

**Query Parameters:**

- `base` (optional, default: USD): Base currency code
- `symbols` (optional, default: PKR): Target currency code(s)

**Response (200):**

```json
{
  "base": "USD",
  "symbols": ["PKR"],
  "rates": {
    "PKR": 277.5
  },
  "provider": "exchangerate.host"
}
```

**Handler:**

```javascript
async function handleForexRate(reqUrl) {
  const base = (reqUrl.searchParams.get("base") || "USD").toUpperCase();
  const symbols = (reqUrl.searchParams.get("symbols") || "PKR").toUpperCase();
  const first = symbols.split(",")[0];

  const providers = [
    {
      name: "exchangerate.host",
      url: `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(first)}`,
      parse: (j) => j?.rates?.[first] ?? null,
    },
    {
      name: "frankfurter",
      url: `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(first)}`,
      parse: (j) => j?.rates?.[first] ?? null,
    },
    {
      name: "er-api",
      url: `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
      parse: (j) => j?.rates?.[first] ?? null,
    },
  ];

  const attempts = providers.map(async (p) => {
    try {
      const r = await timeoutFetch(
        p.url,
        { headers: { Accept: "application/json" } },
        4000,
      );
      if (!r.ok) throw new Error(`${p.name} ${r.status}`);
      const j = await r.json();
      const rate = p.parse(j);
      if (typeof rate === "number" && isFinite(rate) && rate > 0)
        return { rate, provider: p.name };
      throw new Error("invalid payload");
    } catch (e) {
      throw new Error(`${p.name}: ${e.message}`);
    }
  });

  try {
    let res;
    if (typeof Promise.any === "function") {
      res = await Promise.any(attempts);
    } else {
      res = await (async () => {
        const errs = [];
        for (const a of attempts) {
          try {
            const r = await a;
            return r;
          } catch (e) {
            errs.push(e.message);
          }
        }
        throw new Error(errs.join("; "));
      })();
    }

    return new Response(
      JSON.stringify({
        base,
        symbols: [first],
        rates: { [first]: res.rate },
        provider: res.provider,
      }),
      {
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch forex rate",
        details: e.message || String(e),
      }),
      {
        status: 502,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  }
}
```

---

## 4. DexScreener Endpoints

### GET `/api/dexscreener/price`

Get token price from DexScreener.

**Request:**

```
GET https://your-worker.workers.dev/api/dexscreener/price?tokenAddress=<mint>
```

**Query Parameters:**

- `tokenAddress` (required): Token mint address

**Response (200):**

```json
{
  "token": "EPjFWdd5Au...",
  "priceUsd": 1.0
}
```

**Response (404):**

```json
{
  "token": "EPjFWdd5Au...",
  "priceUsd": null,
  "message": "Price not available"
}
```

**Handler:**

```javascript
async function handleDexPrice(reqUrl) {
  const token =
    reqUrl.searchParams.get("tokenAddress") ||
    reqUrl.searchParams.get("token") ||
    reqUrl.searchParams.get("mint");
  if (!token)
    return new Response(
      JSON.stringify({ error: "Missing tokenAddress parameter" }),
      {
        status: 400,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  try {
    const data = await tryDexscreener(`/tokens/${encodeURIComponent(token)}`);
    const price = data?.pairs?.[0]?.priceUsd ?? null;
    if (price)
      return new Response(JSON.stringify({ token, priceUsd: Number(price) }), {
        headers: { "content-type": "application/json", ...corsHeaders() },
      });
    return new Response(
      JSON.stringify({ token, priceUsd: null, message: "Price not available" }),
      {
        status: 404,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "DexScreener fetch failed",
        details: e.message || String(e),
      }),
      {
        status: 502,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  }
}
```

### GET `/api/dexscreener/tokens`

Get token data for multiple mints.

**Request:**

```
GET https://your-worker.workers.dev/api/dexscreener/tokens?mints=<mint1>,<mint2>,...
```

**Query Parameters:**

- `mints` (required): Comma-separated token mint addresses

**Response (200):**

```json
{
  "schemaVersion": "1.0.0",
  "pairs": [
    {
      "baseToken": { "address": "...", "name": "..." },
      "quoteToken": { "address": "...", "name": "..." },
      "priceUsd": 1.0,
      "liquidity": { "usd": 10000 }
    }
  ]
}
```

**Handler:**

```javascript
async function handleDexTokens(reqUrl) {
  const mints = reqUrl.searchParams.get("mints");
  if (!mints)
    return new Response(
      JSON.stringify({ error: "Missing 'mints' parameter" }),
      {
        status: 400,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  const raw = mints
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(raw));
  if (unique.length === 0)
    return new Response(JSON.stringify({ error: "No valid mints provided" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders() },
    });

  const MAX_DEX_BATCH = 20;
  const batches = [];
  for (let i = 0; i < unique.length; i += MAX_DEX_BATCH)
    batches.push(unique.slice(i, i + MAX_DEX_BATCH));

  const results = [];
  let schemaVersion = "1.0.0";

  for (const batch of batches) {
    try {
      const path = `/tokens/${batch.join(",")}`;
      const data = await tryDexscreener(path);
      if (!data) continue;
      if (data.schemaVersion) schemaVersion = data.schemaVersion;
      if (Array.isArray(data.pairs)) results.push(...data.pairs);
    } catch (e) {
      // continue to next batch
    }
  }

  const dedup = new Map();
  for (const p of results) {
    const key = `${p.baseToken?.address || ""}:${p.quoteToken?.address || ""}`;
    if (!dedup.has(key)) dedup.set(key, p);
  }
  const pairs = Array.from(dedup.values()).filter(
    (p) => p.chainId === "solana",
  );

  return new Response(JSON.stringify({ schemaVersion, pairs }), {
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
}
```

### GET `/api/dexscreener/search`

Search for tokens on DexScreener.

**Request:**

```
GET https://your-worker.workers.dev/api/dexscreener/search?q=<query>
```

**Query Parameters:**

- `q` (required): Search query

**Response (200):**

```json
{
  "schemaVersion": "1.0.0",
  "pairs": [
    {
      "baseToken": { "address": "...", "name": "..." },
      "quoteToken": { "address": "...", "name": "..." },
      "priceUsd": 1.0
    }
  ]
}
```

**Handler:**

```javascript
async function handleDexSearch(reqUrl) {
  const q = reqUrl.searchParams.get("q");
  if (!q)
    return new Response(JSON.stringify({ error: "Missing 'q' parameter" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders() },
    });
  try {
    const data = await tryDexscreener(`/search/?q=${encodeURIComponent(q)}`);
    const pairs = (data?.pairs || [])
      .filter((p) => p.chainId === "solana")
      .slice(0, 20);
    return new Response(
      JSON.stringify({ schemaVersion: data?.schemaVersion || "1.0.0", pairs }),
      { headers: { "content-type": "application/json", ...corsHeaders() } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Search failed",
        details: e.message || String(e),
      }),
      {
        status: 502,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  }
}
```

---

## 5. Jupiter Endpoints

### GET `/api/jupiter/price`

Get token prices from Jupiter.

**Request:**

```
GET https://your-worker.workers.dev/api/jupiter/price?ids=<mint1>,<mint2>
```

**Query Parameters:**

- `ids` (required): Comma-separated token mint addresses

**Response (200):**

```json
{
  "data": {
    "So11111111111111111111111111111111111111112": {
      "id": "So11111111111111111111111111111111111111112",
      "price": 150.25
    }
  }
}
```

**Handler:**

```javascript
async function handleJupiterPrice(reqUrl, env) {
  const ids = reqUrl.searchParams.get("ids");
  if (!ids)
    return new Response(JSON.stringify({ error: "Missing 'ids' parameter" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders() },
    });

  const params = `?ids=${encodeURIComponent(ids)}`;
  const candidates = [];
  if (env && env.JUPITER_PRICE_BASE)
    candidates.push(normalizeBase(env.JUPITER_PRICE_BASE) + `/price${params}`);
  candidates.push(`https://price.jup.ag/v4/price${params}`);
  candidates.push(`https://api.jup.ag/price/v2${params}`);

  try {
    const result = await tryJupiter(
      candidates,
      { method: "GET", headers: { Accept: "application/json" } },
      7000,
    );
    const ct = result.headers.get("content-type") || "application/json";
    return new Response(result.body, {
      status: result.status,
      headers: { "content-type": ct, ...corsHeaders() },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch Jupiter price",
        details: e.message || String(e),
      }),
      {
        status: 502,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  }
}
```

### GET `/api/jupiter/quote`

Get a swap quote from Jupiter.

**Request:**

```
GET https://your-worker.workers.dev/api/jupiter/quote?inputMint=<mint>&outputMint=<mint>&amount=<amount>
```

**Query Parameters:**

- `inputMint` (required): Input token mint
- `outputMint` (required): Output token mint
- `amount` (required): Amount in smallest units
- `slippageBps` (optional): Slippage in basis points

**Response (200):**

```json
{
  "inputMint": "EPjFWdd5...",
  "outputMint": "So11111...",
  "inAmount": "1000000",
  "outAmount": "150000000",
  "priceImpactPct": "0.05"
}
```

**Handler:**

```javascript
async function handleJupiterQuote(reqUrl, env) {
  const params = reqUrl.search;
  const candidates = [];
  if (env && env.JUPITER_QUOTE_BASE)
    candidates.push(normalizeBase(env.JUPITER_QUOTE_BASE) + params);
  candidates.push(`https://quote-api.jup.ag/v6/quote${params}`);
  candidates.push(`https://api.jup.ag/quote/v1${params}`);

  const headers = { Accept: "application/json" };
  if (env && env.JUPITER_API_KEY) headers["x-api-key"] = env.JUPITER_API_KEY;

  try {
    const result = await tryJupiter(
      candidates,
      { method: "GET", headers },
      8000,
    );
    const ct = result.headers.get("content-type") || "application/json";
    return new Response(result.body, {
      status: result.status,
      headers: { "content-type": ct, ...corsHeaders() },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch Jupiter quote",
        details: e.message || String(e),
      }),
      {
        status: 502,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  }
}
```

### POST `/api/jupiter/swap`

Execute a swap transaction via Jupiter.

**Request:**

```
POST https://your-worker.workers.dev/api/jupiter/swap
Content-Type: application/json

{
  "quoteResponse": { ... },
  "userPublicKey": "...",
  "wrapUnwrapSOL": true
}
```

**Response (200):**

```json
{
  "swapTransaction": "...",
  "lastValidBlockHeight": 123456
}
```

**Handler:**

```javascript
async function handleJupiterSwap(req, env) {
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders() },
    });
  }

  const candidates = [];
  if (env && env.JUPITER_SWAP_BASE)
    candidates.push(normalizeBase(env.JUPITER_SWAP_BASE) + "/swap");
  candidates.push("https://quote-api.jup.ag/v6/swap");
  candidates.push("https://lite-api.jup.ag/swap/v1");

  const headers = { "Content-Type": "application/json" };
  if (env && env.JUPITER_API_KEY) headers["x-api-key"] = env.JUPITER_API_KEY;

  try {
    const result = await tryJupiter(
      candidates,
      { method: "POST", headers, body: JSON.stringify(body) },
      10000,
    );
    const ct = result.headers.get("content-type") || "application/json";
    return new Response(result.body, {
      status: result.status,
      headers: { "content-type": ct, ...corsHeaders() },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Failed to execute Jupiter swap",
        details: e.message || String(e),
      }),
      {
        status: 502,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  }
}
```

### GET `/api/sol/price`

Get SOL token price from Jupiter.

**Request:**

```
GET https://your-worker.workers.dev/api/sol/price
```

**Response (200):**

```json
{
  "token": "SOL",
  "mint": "So11111111111111111111111111111111111111112",
  "price": 150.25,
  "priceUsd": 150.25,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**Handler:**

```javascript
async function handleSolPrice(env) {
  const SOL_MINT = "So11111111111111111111111111111111111111112";
  const params = `?ids=${encodeURIComponent(SOL_MINT)}`;
  const candidates = [];
  if (env && env.JUPITER_PRICE_BASE)
    candidates.push(normalizeBase(env.JUPITER_PRICE_BASE) + `/price${params}`);
  candidates.push(`https://price.jup.ag/v4/price${params}`);
  candidates.push(`https://api.jup.ag/price/v2${params}`);

  try {
    const result = await tryJupiter(
      candidates,
      { method: "GET", headers: { Accept: "application/json" } },
      7000,
    );
    if (result.status === 200) {
      const data = JSON.parse(result.body);
      const solPrice = data?.data?.[SOL_MINT]?.price ?? null;
      if (solPrice) {
        return new Response(
          JSON.stringify({
            token: "SOL",
            mint: SOL_MINT,
            price: solPrice,
            priceUsd: solPrice,
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { "content-type": "application/json", ...corsHeaders() },
          },
        );
      }
    }
    return new Response(
      JSON.stringify({
        error: "Failed to fetch SOL price",
        details: "Price data not available",
      }),
      {
        status: 502,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch SOL price",
        details: e.message || String(e),
      }),
      {
        status: 502,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  }
}
```

---

## 6. Solana RPC Endpoints

### POST `/api/solana-rpc`

Direct proxy to Solana RPC endpoints.

**Request:**

```
POST https://your-worker.workers.dev/api/solana-rpc
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getBalance",
  "params": ["<public_key>"]
}
```

**Response (200):**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "value": 1500000000
  },
  "id": 1
}
```

**Handler:**

```javascript
async function handleSolanaRpc(req, env) {
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders() },
    });
  }

  const candidates = [];
  if (env && env.SOLANA_RPC_URL) candidates.push(env.SOLANA_RPC_URL);
  if (env && env.ALCHEMY_RPC_URL) candidates.push(env.ALCHEMY_RPC_URL);
  if (env && env.HELIUS_RPC_URL) candidates.push(env.HELIUS_RPC_URL);
  if (env && env.MORALIS_RPC_URL) candidates.push(env.MORALIS_RPC_URL);
  if (env && env.HELIUS_API_KEY)
    candidates.push(
      `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`,
    );
  candidates.push(
    "https://solana.publicnode.com",
    "https://rpc.ankr.com/solana",
    "https://api.mainnet-beta.solana.com",
  );

  for (const endpoint of candidates) {
    try {
      const r = await timeoutFetch(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        7000,
      );
      const text = await r.text();
      return new Response(text, {
        status: r.status,
        headers: {
          "content-type": r.headers.get("content-type") || "application/json",
          ...corsHeaders(),
        },
      });
    } catch (e) {
      // try next
    }
  }
  return new Response(JSON.stringify({ error: "All RPC endpoints failed" }), {
    status: 502,
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
}
```

---

## 7. Helper Functions

Add these utility functions to your worker.js:

### CORS Headers

```javascript
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}
```

### Timeout Fetch

```javascript
async function timeoutFetch(url, opts = {}, ms = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal, ...opts });
    return response;
  } finally {
    clearTimeout(id);
  }
}
```

### Try DexScreener

```javascript
const DEXSCREENER_BASES = [
  "https://api.dexscreener.com/latest/dex",
  "https://api.dexscreener.io/latest/dex",
];

async function tryDexscreener(path) {
  for (const base of DEXSCREENER_BASES) {
    try {
      const url = `${base}${path}`;
      const res = await timeoutFetch(
        url,
        { headers: { Accept: "application/json" } },
        8000,
      );
      if (!res.ok) continue;
      const data = await res.json();
      return data;
    } catch (e) {
      // continue
    }
  }
  throw new Error("All DexScreener endpoints failed");
}
```

### Try Jupiter

```javascript
async function tryJupiter(urlCandidates, options = {}, ms = 8000) {
  for (const candidate of urlCandidates) {
    try {
      const res = await timeoutFetch(candidate, options, ms);
      if (!res) continue;
      const text = await res.text();
      return { status: res.status, headers: res.headers, body: text };
    } catch (e) {
      // try next
    }
  }
  throw new Error("All Jupiter endpoints failed");
}
```

### Normalize Base

```javascript
function normalizeBase(v) {
  if (!v) return "";
  return v.replace(/\/+$|^\/+/, "");
}
```

---

## 8. Main Router Template

Add this to your worker's `fetch` handler:

```javascript
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$|^\/+/, "");

    try {
      // Basic routing
      if (pathname === "" || pathname === "api") return handleApiRoot();
      if (pathname === "api/health") return handleHealth();
      if (pathname === "api/ping") return handlePing();

      if (pathname === "api/forex/rate") return handleForexRate(url);
      if (pathname === "api/wallet/balance" || pathname === "api/balance")
        return handleWalletBalance(url, env);
      if (pathname === "api/sol/price") return handleSolPrice(env);

      if (pathname === "api/dexscreener/tokens") return handleDexTokens(url);
      if (pathname === "api/dexscreener/search") return handleDexSearch(url);
      if (pathname === "api/dexscreener/price") return handleDexPrice(url);

      // Jupiter v6 proxies
      if (pathname === "api/jupiter/quote" && request.method === "GET")
        return handleJupiterQuote(url, env);
      if (pathname === "api/jupiter/price" && request.method === "GET")
        return handleJupiterPrice(url, env);
      if (pathname === "api/jupiter/swap" && request.method === "POST")
        return handleJupiterSwap(request, env);

      if (pathname === "api/solana-rpc" && request.method === "POST")
        return handleSolanaRpc(request, env);

      // If unknown API route, return 404 for /api prefixed paths
      if (pathname.startsWith("api")) {
        return new Response(
          JSON.stringify({
            error: "API endpoint not found",
            path: `/${pathname}`,
          }),
          {
            status: 404,
            headers: { "content-type": "application/json", ...corsHeaders() },
          },
        );
      }

      // Fallback: serve placeholder HTML
      const html = `<!doctype html><html lang="en">...`;
      return new Response(html, {
        headers: { "content-type": "text/html; charset=UTF-8" },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "Unhandled error",
          details: (err && err.message) || String(err),
        }),
        {
          status: 500,
          headers: { "content-type": "application/json", ...corsHeaders() },
        },
      );
    }
  },
};
```

---

## Environment Variables

Configure these in your Cloudflare Workers environment:

```
SOLANA_RPC_URL=<your-rpc-url>
ALCHEMY_RPC_URL=<your-alchemy-url>
HELIUS_RPC_URL=<your-helius-url>
HELIUS_API_KEY=<your-helius-key>
MORALIS_RPC_URL=<your-moralis-url>
JUPITER_QUOTE_BASE=<custom-jupiter-base>
JUPITER_PRICE_BASE=<custom-jupiter-price-base>
JUPITER_SWAP_BASE=<custom-jupiter-swap-base>
JUPITER_API_KEY=<your-jupiter-key>
```

---

## Testing Examples

### Test Health

```bash
curl https://abc.khanbabusargodha.workers.dev/api/health
```

### Test Wallet Balance

```bash
curl "https://abc.khanbabusargodha.workers.dev/api/wallet/balance?publicKey=<public_key>"
```

### Test Forex Rate

```bash
curl "https://abc.khanbabusargodha.workers.dev/api/forex/rate?base=USD&symbols=PKR"
```

### Test DexScreener Price

```bash
curl "https://abc.khanbabusargodha.workers.dev/api/dexscreener/price?tokenAddress=<mint>"
```

### Test Jupiter Price

```bash
curl "https://abc.khanbabusargodha.workers.dev/api/jupiter/price?ids=<mint1>,<mint2>"
```

### Test Jupiter Quote

```bash
curl "https://abc.khanbabusargodha.workers.dev/api/jupiter/quote?inputMint=<mint1>&outputMint=<mint2>&amount=1000000"
```

---

## Notes

- All endpoints are CORS-enabled
- Fallback RPC endpoints are built-in for reliability
- Timeouts are configured per endpoint type (4-10 seconds)
- All responses include proper error handling with descriptive messages
- Copy the handler functions into your worker.js and update routing as needed
