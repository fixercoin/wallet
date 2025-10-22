var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/routes/solana-proxy.ts
async function handleSolanaRpc(req) {
  try {
    const body = await req.json();
    const response = await fetch(
      "https://solana-mainnet.g.alchemy.com/v2/3Z99FYWB1tFEBqYSyV60t-x7FsFCSEjX",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }
    );
    const data = await response.text();
    return new Response(data, {
      headers: { "Content-Type": "application/json" },
      status: response.status
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message || "RPC Proxy failed" }),
      { status: 500 }
    );
  }
}
var init_solana_proxy = __esm({
  "server/routes/solana-proxy.ts"() {
  }
});

// server/routes/solana-send.ts
async function handleSolanaSend(rawTx) {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "sendTransaction",
    params: [rawTx, { skipPreflight: false, preflightCommitment: "confirmed" }]
  };
  const response = await fetch("/api/solana-rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return await response.json();
}
var init_solana_send = __esm({
  "server/routes/solana-send.ts"() {
  }
});

// server/routes/solana-simulate.ts
async function handleSolanaSimulate(txBase64) {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "simulateTransaction",
    params: [txBase64, { encoding: "base64", commitment: "processed" }]
  };
  const response = await fetch("/api/solana-rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return await response.json();
}
var init_solana_simulate = __esm({
  "server/routes/solana-simulate.ts"() {
  }
});

// server/routes/wallet-balance.ts
var handleWalletBalance;
var init_wallet_balance = __esm({
  "server/routes/wallet-balance.ts"() {
    handleWalletBalance = async (req, res) => {
      try {
        const { publicKey } = req.query;
        if (!publicKey || typeof publicKey !== "string") {
          return res.status(400).json({
            error: "Missing or invalid 'publicKey' parameter"
          });
        }
        const body = {
          jsonrpc: "2.0",
          id: 1,
          method: "getBalance",
          params: [publicKey]
        };
        const response = await fetch(
          "https://solana-mainnet.g.alchemy.com/v2/3Z99FYWB1tFEBqYSyV60t-x7FsFCSEjX",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          }
        );
        const data = await response.json();
        if (data.error) {
          console.error("Solana RPC error:", data.error);
          return res.status(500).json({
            error: data.error.message || "Failed to fetch balance"
          });
        }
        const balanceLamports = data.result;
        const balanceSOL = balanceLamports / 1e9;
        res.json({
          publicKey,
          balance: balanceSOL,
          balanceLamports
        });
      } catch (error) {
        console.error("Wallet balance error:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "Internal server error"
        });
      }
    };
  }
});

// server/routes/exchange-rate.ts
async function fetchTokenPriceFromDexScreener(mint) {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
    console.log(`[DexScreener] Fetching price for ${mint} from: ${url}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8e3);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)"
      }
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      console.warn(
        `[DexScreener] \u274C API returned ${response.status} for mint ${mint}`
      );
      return null;
    }
    const data = await response.json();
    console.log(
      `[DexScreener] Response received for ${mint}:`,
      JSON.stringify(data).substring(0, 200)
    );
    if (data.pairs && data.pairs.length > 0) {
      const priceUsd = data.pairs[0].priceUsd;
      if (priceUsd) {
        const price = parseFloat(priceUsd);
        console.log(`[DexScreener] \u2705 Got price for ${mint}: $${price}`);
        return price;
      }
    }
    console.warn(`[DexScreener] No pairs found in response for ${mint}`);
    return null;
  } catch (error) {
    console.error(
      `[DexScreener] \u274C Failed to fetch ${mint}:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}
var TOKEN_MINTS, FALLBACK_RATES, PKR_PER_USD, MARKUP, handleExchangeRate;
var init_exchange_rate = __esm({
  "server/routes/exchange-rate.ts"() {
    TOKEN_MINTS = {
      SOL: "So11111111111111111111111111111111111111112",
      USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
      FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
      LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump"
    };
    FALLBACK_RATES = {
      FIXERCOIN: 5e-3,
      // $0.005 per FIXERCOIN
      SOL: 180,
      // $180 per SOL
      USDC: 1,
      // $1 USDC
      USDT: 1,
      // $1 USDT
      LOCKER: 0.1
      // $0.1 per LOCKER
    };
    PKR_PER_USD = 280;
    MARKUP = 1.0425;
    handleExchangeRate = async (req, res) => {
      try {
        const token = req.query.token || "FIXERCOIN";
        let priceUsd = null;
        if (token === "FIXERCOIN") {
          priceUsd = await fetchTokenPriceFromDexScreener(TOKEN_MINTS.FIXERCOIN);
        } else if (token === "SOL") {
          priceUsd = await fetchTokenPriceFromDexScreener(TOKEN_MINTS.SOL);
        } else if (token === "USDC" || token === "USDT") {
          priceUsd = 1;
        } else if (token === "LOCKER") {
          priceUsd = await fetchTokenPriceFromDexScreener(TOKEN_MINTS.LOCKER);
        }
        if (priceUsd === null || priceUsd <= 0) {
          priceUsd = FALLBACK_RATES[token] || FALLBACK_RATES.FIXERCOIN;
          console.log(
            `[ExchangeRate] Using fallback rate for ${token}: $${priceUsd}`
          );
        } else {
          console.log(
            `[ExchangeRate] Fetched ${token} price from DexScreener: $${priceUsd}`
          );
        }
        const rateInPKR = priceUsd * PKR_PER_USD * MARKUP;
        console.log(
          `[ExchangeRate] ${token}: $${priceUsd.toFixed(6)} USD -> ${rateInPKR.toFixed(2)} PKR (with ${(MARKUP - 1) * 100}% markup)`
        );
        res.json({
          token,
          priceUsd,
          priceInPKR: rateInPKR,
          rate: rateInPKR,
          pkkPerUsd: PKR_PER_USD,
          markup: MARKUP
        });
      } catch (error) {
        console.error("[ExchangeRate] Error:", error);
        res.status(500).json({
          error: "Failed to fetch exchange rate",
          message: error instanceof Error ? error.message : String(error)
        });
      }
    };
  }
});

// server/routes/dexscreener-proxy.ts
var DEXSCREENER_ENDPOINTS, CACHE_TTL_MS, MAX_TOKENS_PER_BATCH, currentEndpointIndex, cache, inflightRequests, tryDexscreenerEndpoints, fetchDexscreenerData, mergePairsByToken, handleDexscreenerTokens, handleDexscreenerSearch, handleDexscreenerTrending;
var init_dexscreener_proxy = __esm({
  "server/routes/dexscreener-proxy.ts"() {
    DEXSCREENER_ENDPOINTS = [
      "https://api.dexscreener.com/latest/dex",
      "https://api.dexscreener.io/latest/dex"
      // Alternative domain
    ];
    CACHE_TTL_MS = 3e4;
    MAX_TOKENS_PER_BATCH = 20;
    currentEndpointIndex = 0;
    cache = /* @__PURE__ */ new Map();
    inflightRequests = /* @__PURE__ */ new Map();
    tryDexscreenerEndpoints = async (path2) => {
      let lastError = null;
      for (let i = 0; i < DEXSCREENER_ENDPOINTS.length; i++) {
        const endpointIndex = (currentEndpointIndex + i) % DEXSCREENER_ENDPOINTS.length;
        const endpoint = DEXSCREENER_ENDPOINTS[endpointIndex];
        const url = `${endpoint}${path2}`;
        try {
          console.log(`Trying DexScreener API: ${url}`);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12e3);
          const response = await fetch(url, {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)"
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            if (response.status === 429) {
              console.warn(`Rate limited on ${endpoint}, trying next...`);
              continue;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const data = await response.json();
          currentEndpointIndex = endpointIndex;
          console.log(`DexScreener API call successful via ${endpoint}`);
          return data;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.warn(`DexScreener endpoint ${endpoint} failed:`, errorMsg);
          lastError = error instanceof Error ? error : new Error(String(error));
          if (i < DEXSCREENER_ENDPOINTS.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1e3));
          }
        }
      }
      throw new Error(
        `All DexScreener endpoints failed. Last error: ${lastError?.message || "Unknown error"}`
      );
    };
    fetchDexscreenerData = async (path2) => {
      const cached = cache.get(path2);
      const now = Date.now();
      if (cached && cached.expiresAt > now) {
        return cached.data;
      }
      const existing = inflightRequests.get(path2);
      if (existing) {
        return existing;
      }
      const request = (async () => {
        try {
          const data = await tryDexscreenerEndpoints(path2);
          cache.set(path2, { data, expiresAt: Date.now() + CACHE_TTL_MS });
          return data;
        } finally {
          inflightRequests.delete(path2);
        }
      })();
      inflightRequests.set(path2, request);
      return request;
    };
    mergePairsByToken = (pairs) => {
      const byMint = /* @__PURE__ */ new Map();
      pairs.forEach((pair) => {
        const mint = pair.baseToken?.address || pair.pairAddress;
        if (!mint) return;
        const existing = byMint.get(mint);
        const existingLiquidity = existing?.liquidity?.usd ?? 0;
        const candidateLiquidity = pair.liquidity?.usd ?? 0;
        if (!existing || candidateLiquidity > existingLiquidity) {
          byMint.set(mint, pair);
        }
      });
      return Array.from(byMint.values());
    };
    handleDexscreenerTokens = async (req, res) => {
      try {
        const { mints } = req.query;
        if (!mints || typeof mints !== "string") {
          console.warn(`[DexScreener] Invalid mints parameter:`, mints);
          return res.status(400).json({
            error: "Missing or invalid 'mints' parameter. Expected comma-separated token mints."
          });
        }
        console.log(`[DexScreener] Tokens request for mints: ${mints}`);
        const rawMints = mints.split(",").map((mint) => mint.trim()).filter(Boolean);
        const uniqueMints = Array.from(new Set(rawMints));
        if (uniqueMints.length === 0) {
          return res.status(400).json({
            error: "No valid token mints provided."
          });
        }
        const batches = [];
        for (let i = 0; i < uniqueMints.length; i += MAX_TOKENS_PER_BATCH) {
          batches.push(uniqueMints.slice(i, i + MAX_TOKENS_PER_BATCH));
        }
        const results = [];
        let schemaVersion = "1.0.0";
        for (const batch of batches) {
          const path2 = `/tokens/${batch.join(",")}`;
          const data = await fetchDexscreenerData(path2);
          if (data?.schemaVersion) {
            schemaVersion = data.schemaVersion;
          }
          if (!data || !Array.isArray(data.pairs)) {
            console.warn("Invalid response format from DexScreener API batch");
            continue;
          }
          results.push(...data.pairs);
        }
        const solanaPairs = mergePairsByToken(results).filter((pair) => pair.chainId === "solana").sort((a, b) => {
          const aLiquidity = a.liquidity?.usd || 0;
          const bLiquidity = b.liquidity?.usd || 0;
          if (bLiquidity !== aLiquidity) return bLiquidity - aLiquidity;
          const aVolume = a.volume?.h24 || 0;
          const bVolume = b.volume?.h24 || 0;
          return bVolume - aVolume;
        });
        console.log(
          `[DexScreener] \u2705 Response: ${solanaPairs.length} Solana pairs found across ${batches.length} batch(es)`
        );
        res.json({ schemaVersion, pairs: solanaPairs });
      } catch (error) {
        console.error("[DexScreener] \u274C Tokens proxy error:", {
          mints: req.query.mints,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : void 0
        });
        res.status(500).json({
          error: {
            message: error instanceof Error ? error.message : "Internal error",
            details: String(error)
          },
          schemaVersion: "1.0.0",
          pairs: []
        });
      }
    };
    handleDexscreenerSearch = async (req, res) => {
      try {
        const { q } = req.query;
        if (!q || typeof q !== "string") {
          return res.status(400).json({
            error: "Missing or invalid 'q' parameter for search query."
          });
        }
        console.log(`[DexScreener] Search request for: ${q}`);
        const data = await fetchDexscreenerData(
          `/search/?q=${encodeURIComponent(q)}`
        );
        const solanaPairs = (data.pairs || []).filter((pair) => pair.chainId === "solana").slice(0, 20);
        console.log(
          `[DexScreener] \u2705 Search response: ${solanaPairs.length} results`
        );
        res.json({
          schemaVersion: data.schemaVersion || "1.0.0",
          pairs: solanaPairs
        });
      } catch (error) {
        console.error("[DexScreener] \u274C Search proxy error:", {
          query: req.query.q,
          error: error instanceof Error ? error.message : String(error)
        });
        res.status(500).json({
          error: {
            message: error instanceof Error ? error.message : "Internal error",
            details: String(error)
          },
          schemaVersion: "1.0.0",
          pairs: []
        });
      }
    };
    handleDexscreenerTrending = async (req, res) => {
      try {
        console.log("[DexScreener] Trending tokens request");
        const data = await fetchDexscreenerData("/pairs/solana");
        const trendingPairs = (data.pairs || []).filter(
          (pair) => pair.volume?.h24 > 1e3 && // Minimum volume filter
          pair.liquidity?.usd && pair.liquidity.usd > 1e4
          // Minimum liquidity filter
        ).sort((a, b) => {
          const aVolume = a.volume?.h24 || 0;
          const bVolume = b.volume?.h24 || 0;
          return bVolume - aVolume;
        }).slice(0, 50);
        console.log(
          `[DexScreener] \u2705 Trending response: ${trendingPairs.length} trending pairs`
        );
        res.json({
          schemaVersion: data.schemaVersion || "1.0.0",
          pairs: trendingPairs
        });
      } catch (error) {
        console.error("[DexScreener] \u274C Trending proxy error:", {
          error: error instanceof Error ? error.message : String(error)
        });
        res.status(500).json({
          error: {
            message: error instanceof Error ? error.message : "Internal error",
            details: String(error)
          },
          schemaVersion: "1.0.0",
          pairs: []
        });
      }
    };
  }
});

// server/routes/spl-meta.ts
var handleSubmitSplMeta;
var init_spl_meta = __esm({
  "server/routes/spl-meta.ts"() {
    handleSubmitSplMeta = async (req, res) => {
      try {
        const {
          name,
          symbol,
          description,
          logoURI,
          website,
          twitter,
          telegram,
          dexpair,
          lastUpdated
        } = req.body || {};
        if (!name || !symbol) {
          return res.status(400).json({ error: "Missing required fields: name, symbol" });
        }
        const payload = {
          name: String(name),
          symbol: String(symbol),
          description: String(description || ""),
          logoURI: String(logoURI || ""),
          website: String(website || ""),
          twitter: String(twitter || ""),
          telegram: String(telegram || ""),
          dexpair: String(dexpair || ""),
          lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
          receivedAt: (/* @__PURE__ */ new Date()).toISOString(),
          source: "spl-meta-form"
        };
        console.log("[SPL-META] Submission received:", payload);
        return res.status(202).json({ status: "queued", payload });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[SPL-META] Submit error:", msg);
        return res.status(500).json({ error: msg });
      }
    };
  }
});

// server/routes/jupiter-proxy.ts
var JUPITER_PRICE_ENDPOINTS, JUPITER_SWAP_BASE, currentEndpointIndex2, tryJupiterEndpoints, handleJupiterPrice, handleJupiterTokens, handleJupiterQuote, handleJupiterSwap;
var init_jupiter_proxy = __esm({
  "server/routes/jupiter-proxy.ts"() {
    JUPITER_PRICE_ENDPOINTS = [
      "https://price.jup.ag/v4",
      "https://api.jup.ag/price/v2"
    ];
    JUPITER_SWAP_BASE = "https://lite-api.jup.ag/swap/v1";
    currentEndpointIndex2 = 0;
    tryJupiterEndpoints = async (path2, params) => {
      let lastError = null;
      for (let i = 0; i < JUPITER_PRICE_ENDPOINTS.length; i++) {
        const endpointIndex = (currentEndpointIndex2 + i) % JUPITER_PRICE_ENDPOINTS.length;
        const endpoint = JUPITER_PRICE_ENDPOINTS[endpointIndex];
        const url = `${endpoint}${path2}?${params.toString()}`;
        try {
          console.log(`Trying Jupiter API: ${url}`);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5e3);
          const response = await fetch(url, {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)"
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            if (response.status === 429) {
              console.warn(`Rate limited on ${endpoint}, trying next...`);
              continue;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const data = await response.json();
          currentEndpointIndex2 = endpointIndex;
          console.log(`Jupiter API call successful via ${endpoint}`);
          return data;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.warn(`Jupiter endpoint ${endpoint} failed:`, errorMsg);
          lastError = error instanceof Error ? error : new Error(String(error));
          if (i < JUPITER_PRICE_ENDPOINTS.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1e3));
          }
        }
      }
      throw new Error(
        `All Jupiter endpoints failed. Last error: ${lastError?.message || "Unknown error"}`
      );
    };
    handleJupiterPrice = async (req, res) => {
      try {
        const { ids } = req.query;
        if (!ids || typeof ids !== "string") {
          return res.status(400).json({
            error: "Missing or invalid 'ids' parameter. Expected comma-separated token mints."
          });
        }
        console.log(`Jupiter price request for tokens: ${ids}`);
        const params = new URLSearchParams({
          ids
        });
        const data = await tryJupiterEndpoints("/price", params);
        if (!data || typeof data !== "object") {
          throw new Error("Invalid response format from Jupiter API");
        }
        console.log(
          `Jupiter price response: ${Object.keys(data.data || {}).length} tokens`
        );
        res.json(data);
      } catch (error) {
        console.error("Jupiter price proxy error:", {
          ids: req.query.ids,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : void 0
        });
        res.status(500).json({
          error: {
            message: error instanceof Error ? error.message : "Internal error",
            details: String(error)
          },
          data: {}
        });
      }
    };
    handleJupiterTokens = async (req, res) => {
      try {
        const { type = "strict" } = req.query;
        console.log(`Jupiter tokens request: ${type}`);
        const typesToTry = [type || "strict", "all"];
        const baseEndpoints = (t) => [
          `https://token.jup.ag/${t}`,
          "https://cache.jup.ag/tokens"
        ];
        const fetchWithTimeout = (url, timeoutMs) => {
          const timeoutPromise = new Promise((resolve) => {
            setTimeout(
              () => resolve(
                new Response("", { status: 504, statusText: "Gateway Timeout" })
              ),
              timeoutMs
            );
          });
          return Promise.race([
            fetch(url, {
              method: "GET",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)"
              }
            }),
            timeoutPromise
          ]);
        };
        let lastError = "";
        for (const t of typesToTry) {
          const endpoints = baseEndpoints(t);
          for (let attempt = 1; attempt <= 2; attempt++) {
            for (const endpoint of endpoints) {
              try {
                const response = await fetchWithTimeout(endpoint, 8e3);
                if (!response.ok) {
                  lastError = `${endpoint} -> ${response.status} ${response.statusText}`;
                  if (response.status === 429 || response.status >= 500) continue;
                  continue;
                }
                const data = await response.json();
                const count = Array.isArray(data) ? data.length : 0;
                console.log(
                  `Jupiter tokens response (${t}) via ${endpoint}: ${count} tokens`
                );
                return res.json(data);
              } catch (e) {
                lastError = `${endpoint} -> ${e?.message || String(e)}`;
                console.warn(`Jupiter tokens fetch failed: ${lastError}`);
              }
            }
            await new Promise((r) => setTimeout(r, attempt * 250));
          }
        }
        return res.status(502).json({
          error: {
            message: "All Jupiter token endpoints failed",
            details: lastError || "Unknown error"
          },
          data: []
        });
      } catch (error) {
        console.error("Jupiter tokens proxy error:", {
          type: req.query.type,
          error: error instanceof Error ? error.message : String(error)
        });
        res.status(500).json({
          error: {
            message: error instanceof Error ? error.message : "Internal error",
            details: String(error)
          },
          data: []
        });
      }
    };
    handleJupiterQuote = async (req, res) => {
      try {
        const { inputMint, outputMint, amount, slippageBps, asLegacyTransaction } = req.query;
        if (!inputMint || !outputMint || !amount || typeof inputMint !== "string" || typeof outputMint !== "string" || typeof amount !== "string") {
          return res.status(400).json({
            error: "Missing required query params: inputMint, outputMint, amount"
          });
        }
        const params = new URLSearchParams({
          inputMint,
          outputMint,
          amount,
          slippageBps: typeof slippageBps === "string" ? slippageBps : "50",
          onlyDirectRoutes: "false",
          asLegacyTransaction: typeof asLegacyTransaction === "string" ? asLegacyTransaction : "false"
        });
        const url = `${JUPITER_SWAP_BASE}/quote?${params.toString()}`;
        const fetchWithTimeout = (timeoutMs) => {
          const timeoutPromise = new Promise((resolve) => {
            setTimeout(
              () => resolve(
                new Response("", { status: 504, statusText: "Gateway Timeout" })
              ),
              timeoutMs
            );
          });
          const fetchPromise = fetch(url, {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)"
            }
          });
          return Promise.race([fetchPromise, timeoutPromise]);
        };
        let lastStatus = 0;
        let lastText = "";
        for (let attempt = 1; attempt <= 2; attempt++) {
          const response = await fetchWithTimeout(8e3);
          lastStatus = response.status;
          if (response.ok) {
            const data = await response.json();
            return res.json(data);
          }
          lastText = await response.text().catch(() => "");
          if (response.status === 404 || response.status === 400) {
            console.warn(
              `Jupiter quote returned ${response.status} - likely no route for this pair`,
              { inputMint: req.query.inputMint, outputMint: req.query.outputMint }
            );
            return res.status(response.status).json({
              error: `No swap route found for this pair`,
              details: lastText,
              code: response.status === 404 ? "NO_ROUTE_FOUND" : "INVALID_PARAMS"
            });
          }
          if (response.status === 429 || response.status >= 500) {
            console.warn(
              `Jupiter API returned ${response.status}, retrying... (attempt ${attempt}/2)`
            );
            await new Promise((r) => setTimeout(r, attempt * 250));
            continue;
          }
          break;
        }
        return res.status(lastStatus || 500).json({
          error: `Quote API error`,
          details: lastText,
          code: lastStatus === 504 ? "TIMEOUT" : "API_ERROR"
        });
      } catch (error) {
        console.error("Jupiter quote proxy error:", {
          params: req.query,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : void 0
        });
        res.status(500).json({
          error: error instanceof Error ? error.message : "Internal error"
        });
      }
    };
    handleJupiterSwap = async (req, res) => {
      try {
        const body = req.body || {};
        console.log(
          "handleJupiterSwap received body keys:",
          Object.keys(body || {})
        );
        if (!body || !body.quoteResponse || !body.userPublicKey) {
          console.warn(
            "handleJupiterSwap missing fields, body:",
            JSON.stringify(body)
          );
          return res.status(400).json({
            error: "Missing required body: { quoteResponse, userPublicKey, ...options }"
          });
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2e4);
        const response = await fetch(`${JUPITER_SWAP_BASE}/swap`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)"
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          return res.status(response.status).json({ error: `Swap failed: ${response.statusText}`, details: text });
        }
        const data = await response.json();
        res.json(data);
      } catch (error) {
        console.error("Jupiter swap proxy error:", {
          body: req.body,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : void 0
        });
        res.status(500).json({
          error: error instanceof Error ? error.message : "Internal error"
        });
      }
    };
  }
});

// server/routes/forex-rate.ts
var handleForexRate;
var init_forex_rate = __esm({
  "server/routes/forex-rate.ts"() {
    handleForexRate = async (req, res) => {
      try {
        const base = String(req.query.base || "USD").toUpperCase();
        const symbols = String(req.query.symbols || "PKR").toUpperCase();
        const firstSymbol = symbols.split(",")[0];
        const PROVIDER_TIMEOUT_MS = 5e3;
        const providers = [
          {
            name: "exchangerate.host",
            url: `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(firstSymbol)}`,
            parse: (j) => j && j.rates && typeof j.rates[firstSymbol] === "number" ? j.rates[firstSymbol] : null
          },
          {
            name: "frankfurter",
            url: `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(firstSymbol)}`,
            parse: (j) => j && j.rates && typeof j.rates[firstSymbol] === "number" ? j.rates[firstSymbol] : null
          },
          {
            name: "er-api",
            url: `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
            parse: (j) => j && j.rates && typeof j.rates[firstSymbol] === "number" ? j.rates[firstSymbol] : null
          },
          {
            name: "fawazahmed-cdn",
            url: `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/${base.toLowerCase()}/${firstSymbol.toLowerCase()}.json`,
            parse: (j) => j && typeof j[firstSymbol.toLowerCase()] === "number" ? j[firstSymbol.toLowerCase()] : null
          }
        ];
        const fetchProvider = async (provider) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(
            () => controller.abort(),
            PROVIDER_TIMEOUT_MS
          );
          try {
            const resp = await fetch(provider.url, {
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)"
              },
              signal: controller.signal
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
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`[${provider.name}] ${message}`);
          } finally {
            clearTimeout(timeoutId);
          }
        };
        const runProviders = () => {
          const attempts = providers.map((p) => fetchProvider(p));
          if (typeof Promise.any === "function") {
            return Promise.any(attempts);
          }
          return new Promise(
            (resolve, reject) => {
              const errors = [];
              let remaining = attempts.length;
              attempts.forEach((attempt) => {
                attempt.then(resolve).catch((err) => {
                  errors.push(err instanceof Error ? err.message : String(err));
                  remaining -= 1;
                  if (remaining === 0) reject(new Error(errors.join("; ")));
                });
              });
            }
          );
        };
        try {
          const { rate, provider } = await runProviders();
          res.json({
            base,
            symbols: [firstSymbol],
            rates: { [firstSymbol]: rate },
            provider
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          res.status(502).json({ error: "Failed to fetch forex rate", details: msg });
        }
      } catch (error) {
        res.status(500).json({ error: "Unexpected error" });
      }
    };
  }
});

// server/routes/stable-24h.ts
var handleStable24h;
var init_stable_24h = __esm({
  "server/routes/stable-24h.ts"() {
    handleStable24h = async (req, res) => {
      try {
        const symbolsParam = String(req.query.symbols || "USDC,USDT").toUpperCase();
        const symbols = Array.from(
          new Set(
            String(symbolsParam).split(",").map((s) => s.trim()).filter(Boolean)
          )
        );
        const COINGECKO_IDS = {
          USDC: {
            id: "usd-coin",
            mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
          },
          USDT: {
            id: "tether",
            mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns"
          }
        };
        const ids = symbols.map((s) => COINGECKO_IDS[s]?.id).filter(Boolean).join(",");
        if (!ids) {
          return res.status(400).json({ error: "No supported symbols provided" });
        }
        const apiUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12e3);
        try {
          const resp = await fetch(apiUrl, {
            signal: controller.signal,
            headers: { Accept: "application/json" }
          });
          clearTimeout(timeoutId);
          const result = {};
          if (resp.ok) {
            const json = await resp.json();
            symbols.forEach((sym) => {
              const meta = COINGECKO_IDS[sym];
              if (!meta) return;
              const d = json?.[meta.id];
              const price = typeof d?.usd === "number" ? d.usd : 1;
              const change = typeof d?.usd_24h_change === "number" ? d.usd_24h_change : 0;
              result[sym] = { priceUsd: price, change24h: change, mint: meta.mint };
            });
          } else {
            symbols.forEach((sym) => {
              const meta = COINGECKO_IDS[sym];
              if (!meta) return;
              result[sym] = { priceUsd: 1, change24h: 0, mint: meta.mint };
            });
          }
          res.json({ data: result });
        } catch (e) {
          clearTimeout(timeoutId);
          const result = {};
          symbols.forEach((sym) => {
            const meta = COINGECKO_IDS[sym];
            if (!meta) return;
            result[sym] = { priceUsd: 1, change24h: 0, mint: meta.mint };
          });
          res.json({ data: result });
        }
      } catch (error) {
        res.status(500).json({ error: "Unexpected error" });
      }
    };
  }
});

// server/routes/p2p-orders.ts
function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
var orders, rooms, messages, handleListP2POrders, handleCreateP2POrder, handleGetP2POrder, handleUpdateP2POrder, handleDeleteP2POrder, handleListTradeRooms, handleCreateTradeRoom, handleGetTradeRoom, handleUpdateTradeRoom, handleListTradeMessages, handleAddTradeMessage;
var init_p2p_orders = __esm({
  "server/routes/p2p-orders.ts"() {
    orders = /* @__PURE__ */ new Map();
    rooms = /* @__PURE__ */ new Map();
    messages = /* @__PURE__ */ new Map();
    handleListP2POrders = async (req, res) => {
      try {
        const { type, status, token, online } = req.query;
        let filtered = Array.from(orders.values());
        if (type) filtered = filtered.filter((o) => o.type === type);
        if (status) filtered = filtered.filter((o) => o.status === status);
        if (token) filtered = filtered.filter((o) => o.token === token);
        if (online === "true") filtered = filtered.filter((o) => o.online);
        if (online === "false") filtered = filtered.filter((o) => !o.online);
        filtered.sort((a, b) => b.created_at - a.created_at);
        res.json({ orders: filtered });
      } catch (error) {
        console.error("List P2P orders error:", error);
        res.status(500).json({ error: "Failed to list orders" });
      }
    };
    handleCreateP2POrder = async (req, res) => {
      try {
        const {
          type,
          creator_wallet,
          token,
          token_amount,
          pkr_amount,
          payment_method,
          online,
          account_name,
          account_number,
          wallet_address
        } = req.body;
        if (!type || !creator_wallet || !token || !token_amount || !pkr_amount || !payment_method) {
          return res.status(400).json({ error: "Missing required fields" });
        }
        const id = generateId("order");
        const now = Date.now();
        const order = {
          id,
          type,
          creator_wallet,
          token,
          token_amount: String(token_amount),
          pkr_amount: Number(pkr_amount),
          payment_method,
          status: "active",
          online: online !== false,
          created_at: now,
          updated_at: now,
          account_name,
          account_number,
          wallet_address: type === "sell" ? wallet_address : void 0
        };
        orders.set(id, order);
        res.status(201).json({ order });
      } catch (error) {
        console.error("Create P2P order error:", error);
        res.status(500).json({ error: "Failed to create order" });
      }
    };
    handleGetP2POrder = async (req, res) => {
      try {
        const { orderId } = req.params;
        const order = orders.get(orderId);
        if (!order) {
          return res.status(404).json({ error: "Order not found" });
        }
        res.json({ order });
      } catch (error) {
        console.error("Get P2P order error:", error);
        res.status(500).json({ error: "Failed to get order" });
      }
    };
    handleUpdateP2POrder = async (req, res) => {
      try {
        const { orderId } = req.params;
        const order = orders.get(orderId);
        if (!order) {
          return res.status(404).json({ error: "Order not found" });
        }
        const updated = {
          ...order,
          ...req.body,
          id: order.id,
          created_at: order.created_at,
          updated_at: Date.now()
        };
        orders.set(orderId, updated);
        res.json({ order: updated });
      } catch (error) {
        console.error("Update P2P order error:", error);
        res.status(500).json({ error: "Failed to update order" });
      }
    };
    handleDeleteP2POrder = async (req, res) => {
      try {
        const { orderId } = req.params;
        if (!orders.has(orderId)) {
          return res.status(404).json({ error: "Order not found" });
        }
        orders.delete(orderId);
        res.json({ ok: true });
      } catch (error) {
        console.error("Delete P2P order error:", error);
        res.status(500).json({ error: "Failed to delete order" });
      }
    };
    handleListTradeRooms = async (req, res) => {
      try {
        const { wallet } = req.query;
        let filtered = Array.from(rooms.values());
        if (wallet) {
          filtered = filtered.filter(
            (r) => r.buyer_wallet === wallet || r.seller_wallet === wallet
          );
        }
        filtered.sort((a, b) => b.created_at - a.created_at);
        res.json({ rooms: filtered });
      } catch (error) {
        console.error("List trade rooms error:", error);
        res.status(500).json({ error: "Failed to list rooms" });
      }
    };
    handleCreateTradeRoom = async (req, res) => {
      try {
        const { buyer_wallet, seller_wallet, order_id } = req.body;
        if (!buyer_wallet || !seller_wallet || !order_id) {
          return res.status(400).json({ error: "Missing required fields" });
        }
        const id = generateId("room");
        const now = Date.now();
        const room = {
          id,
          buyer_wallet,
          seller_wallet,
          order_id,
          status: "pending",
          created_at: now,
          updated_at: now
        };
        rooms.set(id, room);
        res.status(201).json({ room });
      } catch (error) {
        console.error("Create trade room error:", error);
        res.status(500).json({ error: "Failed to create room" });
      }
    };
    handleGetTradeRoom = async (req, res) => {
      try {
        const { roomId } = req.params;
        const room = rooms.get(roomId);
        if (!room) {
          return res.status(404).json({ error: "Room not found" });
        }
        res.json({ room });
      } catch (error) {
        console.error("Get trade room error:", error);
        res.status(500).json({ error: "Failed to get room" });
      }
    };
    handleUpdateTradeRoom = async (req, res) => {
      try {
        const { roomId } = req.params;
        const room = rooms.get(roomId);
        if (!room) {
          return res.status(404).json({ error: "Room not found" });
        }
        const updated = {
          ...room,
          ...req.body,
          id: room.id,
          created_at: room.created_at,
          updated_at: Date.now()
        };
        rooms.set(roomId, updated);
        res.json({ room: updated });
      } catch (error) {
        console.error("Update trade room error:", error);
        res.status(500).json({ error: "Failed to update room" });
      }
    };
    handleListTradeMessages = async (req, res) => {
      try {
        const { roomId } = req.params;
        const roomMessages = messages.get(roomId) || [];
        res.json({ messages: roomMessages });
      } catch (error) {
        console.error("List trade messages error:", error);
        res.status(500).json({ error: "Failed to list messages" });
      }
    };
    handleAddTradeMessage = async (req, res) => {
      try {
        const { roomId } = req.params;
        const { sender_wallet, message, attachment_url } = req.body;
        if (!sender_wallet || !message) {
          return res.status(400).json({ error: "Missing required fields" });
        }
        const id = generateId("msg");
        const now = Date.now();
        const msg = {
          id,
          sender_wallet,
          message,
          attachment_url,
          created_at: now
        };
        if (!messages.has(roomId)) {
          messages.set(roomId, []);
        }
        messages.get(roomId).push(msg);
        res.status(201).json({ message: msg });
      } catch (error) {
        console.error("Add trade message error:", error);
        res.status(500).json({ error: "Failed to add message" });
      }
    };
  }
});

// server/routes/orders.ts
var ordersStore, ADMIN_PASSWORD, generateId2, validateAdminToken, handleListOrders, handleCreateOrder, handleGetOrder, handleUpdateOrder, handleDeleteOrder;
var init_orders = __esm({
  "server/routes/orders.ts"() {
    ordersStore = /* @__PURE__ */ new Map();
    ADMIN_PASSWORD = "Pakistan##123";
    generateId2 = (prefix) => {
      return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    };
    validateAdminToken = (token) => {
      return token === ADMIN_PASSWORD;
    };
    handleListOrders = async (req, res) => {
      try {
        const { roomId } = req.query;
        let filtered = Array.from(ordersStore.values());
        if (roomId && typeof roomId === "string") {
          filtered = filtered.filter((o) => o.roomId === roomId);
        }
        filtered.sort((a, b) => b.createdAt - a.createdAt);
        res.json({ orders: filtered });
      } catch (error) {
        console.error("List orders error:", error);
        res.status(500).json({ error: "Failed to list orders" });
      }
    };
    handleCreateOrder = async (req, res) => {
      try {
        const {
          side,
          amountPKR,
          quoteAsset,
          pricePKRPerQuote,
          paymentMethod,
          roomId = "global",
          createdBy,
          accountName,
          accountNumber,
          walletAddress
        } = req.body;
        if (!side || !amountPKR || !quoteAsset || !pricePKRPerQuote || !paymentMethod) {
          return res.status(400).json({
            error: "Missing required fields: side, amountPKR, quoteAsset, pricePKRPerQuote, paymentMethod"
          });
        }
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace("Bearer ", "");
        if (!token || !validateAdminToken(token)) {
          return res.status(401).json({ error: "Unauthorized: invalid or missing admin token" });
        }
        const amount = Number(amountPKR);
        const price = Number(pricePKRPerQuote);
        if (!isFinite(amount) || amount <= 0) {
          return res.status(400).json({ error: "Invalid amountPKR: must be a positive number" });
        }
        if (!isFinite(price) || price <= 0) {
          return res.status(400).json({ error: "Invalid pricePKRPerQuote: must be a positive number" });
        }
        const id = generateId2("order");
        const now = Date.now();
        const order = {
          id,
          side,
          amountPKR: amount,
          quoteAsset,
          pricePKRPerQuote: price,
          paymentMethod,
          roomId,
          createdBy: createdBy || "admin",
          createdAt: now,
          accountName,
          accountNumber,
          walletAddress
        };
        ordersStore.set(id, order);
        res.status(201).json({ order });
      } catch (error) {
        console.error("Create order error:", error);
        res.status(500).json({ error: "Failed to create order" });
      }
    };
    handleGetOrder = async (req, res) => {
      try {
        const { orderId } = req.params;
        const order = ordersStore.get(orderId);
        if (!order) {
          return res.status(404).json({ error: "Order not found" });
        }
        res.json({ order });
      } catch (error) {
        console.error("Get order error:", error);
        res.status(500).json({ error: "Failed to get order" });
      }
    };
    handleUpdateOrder = async (req, res) => {
      try {
        const { orderId } = req.params;
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace("Bearer ", "");
        if (!token || !validateAdminToken(token)) {
          return res.status(401).json({ error: "Unauthorized: invalid or missing admin token" });
        }
        const order = ordersStore.get(orderId);
        if (!order) {
          return res.status(404).json({ error: "Order not found" });
        }
        const updated = {
          ...order,
          ...req.body,
          id: order.id,
          createdAt: order.createdAt
        };
        ordersStore.set(orderId, updated);
        res.json({ order: updated });
      } catch (error) {
        console.error("Update order error:", error);
        res.status(500).json({ error: "Failed to update order" });
      }
    };
    handleDeleteOrder = async (req, res) => {
      try {
        const { orderId } = req.params;
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace("Bearer ", "");
        if (!token || !validateAdminToken(token)) {
          return res.status(401).json({ error: "Unauthorized: invalid or missing admin token" });
        }
        if (!ordersStore.has(orderId)) {
          return res.status(404).json({ error: "Order not found" });
        }
        ordersStore.delete(orderId);
        res.json({ ok: true });
      } catch (error) {
        console.error("Delete order error:", error);
        res.status(500).json({ error: "Failed to delete order" });
      }
    };
  }
});

// server/index.ts
var server_exports = {};
__export(server_exports, {
  createServer: () => createServer,
  default: () => server_default
});
import express from "file:///app/code/node_modules/express/index.js";
import cors from "file:///app/code/node_modules/cors/lib/index.js";
async function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get("/api/dexscreener/tokens", handleDexscreenerTokens);
  app.get("/api/dexscreener/search", handleDexscreenerSearch);
  app.get("/api/dexscreener/trending", handleDexscreenerTrending);
  app.get("/api/jupiter/price", handleJupiterPrice);
  app.get("/api/jupiter/quote", handleJupiterQuote);
  app.post("/api/jupiter/swap", handleJupiterSwap);
  app.get("/api/jupiter/tokens", handleJupiterTokens);
  app.post("/api/solana-rpc", handleSolanaRpc);
  app.post("/api/solana-simulate", (req, res) => {
    const { signedBase64 } = req.body;
    handleSolanaSimulate(signedBase64).then((result) => res.json(result)).catch((err) => res.status(500).json({ error: err.message }));
  });
  app.post("/api/solana-send", (req, res) => {
    const { signedBase64 } = req.body;
    handleSolanaSend(signedBase64).then((result) => res.json(result)).catch((err) => res.status(500).json({ error: err.message }));
  });
  app.get("/api/wallet/balance", handleWalletBalance);
  app.get("/api/exchange-rate", handleExchangeRate);
  app.get("/api/forex/rate", handleForexRate);
  app.get("/api/stable-24h", handleStable24h);
  app.get("/api/orders", handleListOrders);
  app.post("/api/orders", handleCreateOrder);
  app.get("/api/orders/:orderId", handleGetOrder);
  app.put("/api/orders/:orderId", handleUpdateOrder);
  app.delete("/api/orders/:orderId", handleDeleteOrder);
  app.get("/api/p2p/orders", handleListP2POrders);
  app.post("/api/p2p/orders", handleCreateP2POrder);
  app.get("/api/p2p/orders/:orderId", handleGetP2POrder);
  app.put("/api/p2p/orders/:orderId", handleUpdateP2POrder);
  app.delete("/api/p2p/orders/:orderId", handleDeleteP2POrder);
  app.get("/api/p2p/rooms", handleListTradeRooms);
  app.post("/api/p2p/rooms", handleCreateTradeRoom);
  app.get("/api/p2p/rooms/:roomId", handleGetTradeRoom);
  app.put("/api/p2p/rooms/:roomId", handleUpdateTradeRoom);
  app.get("/api/p2p/rooms/:roomId/messages", handleListTradeMessages);
  app.post("/api/p2p/rooms/:roomId/messages", handleAddTradeMessage);
  app.post("/api/spl-meta/submit", handleSubmitSplMeta);
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.use((req, res) => {
    res.status(404).json({ error: "API endpoint not found", path: req.path });
  });
  return app;
}
var server_default;
var init_server = __esm({
  "server/index.ts"() {
    init_solana_proxy();
    init_solana_send();
    init_solana_simulate();
    init_wallet_balance();
    init_exchange_rate();
    init_dexscreener_proxy();
    init_spl_meta();
    init_jupiter_proxy();
    init_forex_rate();
    init_stable_24h();
    init_p2p_orders();
    init_orders();
    server_default = {
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname.startsWith("/api/solana-rpc")) {
          return await handleSolanaRpc(req);
        }
        return new Response("Wallet backend active", { status: 200 });
      }
    };
  }
});

// vite.config.mjs
import { defineConfig } from "file:///app/code/node_modules/vite/dist/node/index.js";
import react from "file:///app/code/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "file:///app/code/node_modules/ws/wrapper.mjs";
var __vite_injected_original_import_meta_url = "file:///app/code/vite.config.mjs";
var __dirname = path.dirname(fileURLToPath(new URL(__vite_injected_original_import_meta_url)));
var apiServer = null;
var vite_config_default = {
  base: "./",
  plugins: [
    react(),
    {
      name: "express-server",
      apply: "serve",
      async configureServer(server) {
        try {
          const { createServer: createExpressServer } = await Promise.resolve().then(() => (init_server(), server_exports));
          apiServer = await createExpressServer();
          console.log("[Vite] \u2705 Express server initialized");
        } catch (err) {
          console.error("[Vite] \u274C Failed to initialize Express:", err);
          throw err;
        }
        server.middlewares.use((req, res, next) => {
          if (req.url.startsWith("/api") || req.url === "/health") {
            console.log(
              `[Vite Middleware] Routing ${req.method} ${req.url} to Express`
            );
            return apiServer(req, res, next);
          }
          next();
        });
        const wss = new WebSocketServer({ noServer: true });
        const rooms2 = /* @__PURE__ */ new Map();
        server.httpServer?.on("upgrade", (request, socket, head) => {
          try {
            const url = request.url || "";
            const match = url.match(/^\/ws\/(.+)$/);
            if (!match) return;
            wss.handleUpgrade(request, socket, head, (ws) => {
              const roomId = decodeURIComponent(match[1]);
              if (!rooms2.has(roomId)) rooms2.set(roomId, /* @__PURE__ */ new Set());
              const set = rooms2.get(roomId);
              set.add(ws);
              ws.on("message", (data) => {
                let msg;
                try {
                  msg = JSON.parse(data.toString());
                } catch {
                  return;
                }
                if (msg && msg.type === "chat") {
                  const payload = JSON.stringify({
                    kind: "chat",
                    data: {
                      id: Math.random().toString(36).slice(2),
                      text: String(msg.text || ""),
                      at: Date.now()
                    }
                  });
                  for (const client of set) {
                    try {
                      client.send(payload);
                    } catch {
                    }
                  }
                } else if (msg && msg.kind === "notification") {
                  const payload = JSON.stringify({
                    kind: "notification",
                    data: msg.data
                  });
                  for (const client of set) {
                    try {
                      client.send(payload);
                    } catch {
                    }
                  }
                } else if (msg && msg.type === "ping") {
                  try {
                    ws.send(JSON.stringify({ kind: "pong", ts: Date.now() }));
                  } catch {
                  }
                }
              });
              ws.on("close", () => {
                set.delete(ws);
                if (set.size === 0) rooms2.delete(roomId);
              });
            });
          } catch (e) {
          }
        });
      }
    }
  ],
  build: {
    outDir: "dist/spa",
    emptyOutDir: true
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client"),
      "@shared": path.resolve(__dirname, "shared"),
      "@utils": path.resolve(__dirname, "utils")
    }
  }
};
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic2VydmVyL3JvdXRlcy9zb2xhbmEtcHJveHkudHMiLCAic2VydmVyL3JvdXRlcy9zb2xhbmEtc2VuZC50cyIsICJzZXJ2ZXIvcm91dGVzL3NvbGFuYS1zaW11bGF0ZS50cyIsICJzZXJ2ZXIvcm91dGVzL3dhbGxldC1iYWxhbmNlLnRzIiwgInNlcnZlci9yb3V0ZXMvZXhjaGFuZ2UtcmF0ZS50cyIsICJzZXJ2ZXIvcm91dGVzL2RleHNjcmVlbmVyLXByb3h5LnRzIiwgInNlcnZlci9yb3V0ZXMvc3BsLW1ldGEudHMiLCAic2VydmVyL3JvdXRlcy9qdXBpdGVyLXByb3h5LnRzIiwgInNlcnZlci9yb3V0ZXMvZm9yZXgtcmF0ZS50cyIsICJzZXJ2ZXIvcm91dGVzL3N0YWJsZS0yNGgudHMiLCAic2VydmVyL3JvdXRlcy9wMnAtb3JkZXJzLnRzIiwgInNlcnZlci9yb3V0ZXMvb3JkZXJzLnRzIiwgInNlcnZlci9pbmRleC50cyIsICJ2aXRlLmNvbmZpZy5tanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc29sYW5hLXByb3h5LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL3NvbGFuYS1wcm94eS50c1wiO2V4cG9ydCBhc3luYyBmdW5jdGlvbiBoYW5kbGVTb2xhbmFScGMocmVxOiBSZXF1ZXN0KTogUHJvbWlzZTxSZXNwb25zZT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXEuanNvbigpO1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goXG4gICAgICBcImh0dHBzOi8vc29sYW5hLW1haW5uZXQuZy5hbGNoZW15LmNvbS92Mi8zWjk5RllXQjF0RkVCcVlTeVY2MHQteDdGc0ZDU0VqWFwiLFxuICAgICAge1xuICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuICAgICAgfVxuICAgICk7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKGRhdGEsIHtcbiAgICAgIGhlYWRlcnM6IHsgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSxcbiAgICAgIHN0YXR1czogcmVzcG9uc2Uuc3RhdHVzLFxuICAgIH0pO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFxuICAgICAgSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogZS5tZXNzYWdlIHx8IFwiUlBDIFByb3h5IGZhaWxlZFwiIH0pLFxuICAgICAgeyBzdGF0dXM6IDUwMCB9XG4gICAgKTtcbiAgfVxufVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc29sYW5hLXNlbmQudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc29sYW5hLXNlbmQudHNcIjtleHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlU29sYW5hU2VuZChyYXdUeDogc3RyaW5nKSB7XG4gIGNvbnN0IGJvZHkgPSB7XG4gICAganNvbnJwYzogXCIyLjBcIixcbiAgICBpZDogMSxcbiAgICBtZXRob2Q6IFwic2VuZFRyYW5zYWN0aW9uXCIsXG4gICAgcGFyYW1zOiBbcmF3VHgsIHsgc2tpcFByZWZsaWdodDogZmFsc2UsIHByZWZsaWdodENvbW1pdG1lbnQ6IFwiY29uZmlybWVkXCIgfV0sXG4gIH07XG5cbiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChcIi9hcGkvc29sYW5hLXJwY1wiLCB7XG4gICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSksXG4gIH0pO1xuXG4gIHJldHVybiBhd2FpdCByZXNwb25zZS5qc29uKCk7XG59XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9zb2xhbmEtc2ltdWxhdGUudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc29sYW5hLXNpbXVsYXRlLnRzXCI7ZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZVNvbGFuYVNpbXVsYXRlKHR4QmFzZTY0OiBzdHJpbmcpIHtcbiAgY29uc3QgYm9keSA9IHtcbiAgICBqc29ucnBjOiBcIjIuMFwiLFxuICAgIGlkOiAxLFxuICAgIG1ldGhvZDogXCJzaW11bGF0ZVRyYW5zYWN0aW9uXCIsXG4gICAgcGFyYW1zOiBbdHhCYXNlNjQsIHsgZW5jb2Rpbmc6IFwiYmFzZTY0XCIsIGNvbW1pdG1lbnQ6IFwicHJvY2Vzc2VkXCIgfV0sXG4gIH07XG5cbiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChcIi9hcGkvc29sYW5hLXJwY1wiLCB7XG4gICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSksXG4gIH0pO1xuXG4gIHJldHVybiBhd2FpdCByZXNwb25zZS5qc29uKCk7XG59XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy93YWxsZXQtYmFsYW5jZS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vYXBwL2NvZGUvc2VydmVyL3JvdXRlcy93YWxsZXQtYmFsYW5jZS50c1wiO2ltcG9ydCB7IFJlcXVlc3RIYW5kbGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZVdhbGxldEJhbGFuY2U6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBwdWJsaWNLZXkgfSA9IHJlcS5xdWVyeTtcblxuICAgIGlmICghcHVibGljS2V5IHx8IHR5cGVvZiBwdWJsaWNLZXkgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7XG4gICAgICAgIGVycm9yOiBcIk1pc3Npbmcgb3IgaW52YWxpZCAncHVibGljS2V5JyBwYXJhbWV0ZXJcIixcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGJvZHkgPSB7XG4gICAgICBqc29ucnBjOiBcIjIuMFwiLFxuICAgICAgaWQ6IDEsXG4gICAgICBtZXRob2Q6IFwiZ2V0QmFsYW5jZVwiLFxuICAgICAgcGFyYW1zOiBbcHVibGljS2V5XSxcbiAgICB9O1xuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChcbiAgICAgIFwiaHR0cHM6Ly9zb2xhbmEtbWFpbm5ldC5nLmFsY2hlbXkuY29tL3YyLzNaOTlGWVdCMXRGRUJxWVN5VjYwdC14N0ZzRkNTRWpYXCIsXG4gICAgICB7XG4gICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgIGhlYWRlcnM6IHsgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSksXG4gICAgICB9LFxuICAgICk7XG5cbiAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuXG4gICAgaWYgKGRhdGEuZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJTb2xhbmEgUlBDIGVycm9yOlwiLCBkYXRhLmVycm9yKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICAgIGVycm9yOiBkYXRhLmVycm9yLm1lc3NhZ2UgfHwgXCJGYWlsZWQgdG8gZmV0Y2ggYmFsYW5jZVwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgYmFsYW5jZUxhbXBvcnRzID0gZGF0YS5yZXN1bHQ7XG4gICAgY29uc3QgYmFsYW5jZVNPTCA9IGJhbGFuY2VMYW1wb3J0cyAvIDFfMDAwXzAwMF8wMDA7XG5cbiAgICByZXMuanNvbih7XG4gICAgICBwdWJsaWNLZXksXG4gICAgICBiYWxhbmNlOiBiYWxhbmNlU09MLFxuICAgICAgYmFsYW5jZUxhbXBvcnRzLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJXYWxsZXQgYmFsYW5jZSBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgc2VydmVyIGVycm9yXCIsXG4gICAgfSk7XG4gIH1cbn07XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9leGNoYW5nZS1yYXRlLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2V4Y2hhbmdlLXJhdGUudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbi8vIFRva2VuIG1pbnQgYWRkcmVzc2VzIGZvciBTb2xhbmEgbWFpbm5ldCAoaW1wb3J0ZWQgZnJvbSBzaGFyZWQgY29uc3RhbnRzKVxuY29uc3QgVE9LRU5fTUlOVFMgPSB7XG4gIFNPTDogXCJTbzExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTEyXCIsXG4gIFVTREM6IFwiRVBqRldkZDVBdWZxU1NxZU0ycU4xeHp5YmFwQzhHNHdFR0drWnd5VER0MXZcIixcbiAgVVNEVDogXCJFczl2TUZyemFDRVJtSmZyRjRIMkZZRDRLQ29Oa1kxMU1jQ2U4QmVuRW5zXCIsXG4gIEZJWEVSQ09JTjogXCJINHFLbjhGTUZoYThqSnVqOHhNcnlNcVJoSDNoN0dqTHV4dzdUVml4cHVtcFwiLFxuICBMT0NLRVI6IFwiRU4xbllyVzYzNzV6TVBVa3BrR3lHU0VYVzhXbUFxWXU0eWhmNnhuR3B1bXBcIixcbn0gYXMgY29uc3Q7XG5cbmNvbnN0IEZBTExCQUNLX1JBVEVTOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge1xuICBGSVhFUkNPSU46IDAuMDA1LCAvLyAkMC4wMDUgcGVyIEZJWEVSQ09JTlxuICBTT0w6IDE4MCwgLy8gJDE4MCBwZXIgU09MXG4gIFVTREM6IDEuMCwgLy8gJDEgVVNEQ1xuICBVU0RUOiAxLjAsIC8vICQxIFVTRFRcbiAgTE9DS0VSOiAwLjEsIC8vICQwLjEgcGVyIExPQ0tFUlxufTtcblxuY29uc3QgUEtSX1BFUl9VU0QgPSAyODA7IC8vIEFwcHJveGltYXRlIGNvbnZlcnNpb24gcmF0ZVxuY29uc3QgTUFSS1VQID0gMS4wNDI1OyAvLyA0LjI1JSBtYXJrdXBcblxuaW50ZXJmYWNlIERleHNjcmVlbmVyUmVzcG9uc2Uge1xuICBwYWlyczogQXJyYXk8e1xuICAgIGJhc2VUb2tlbjogeyBhZGRyZXNzOiBzdHJpbmcgfTtcbiAgICBwcmljZVVzZD86IHN0cmluZztcbiAgfT47XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGZldGNoVG9rZW5QcmljZUZyb21EZXhTY3JlZW5lcihcbiAgbWludDogc3RyaW5nLFxuKTogUHJvbWlzZTxudW1iZXIgfCBudWxsPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgdXJsID0gYGh0dHBzOi8vYXBpLmRleHNjcmVlbmVyLmNvbS9sYXRlc3QvZGV4L3Rva2Vucy8ke21pbnR9YDtcbiAgICBjb25zb2xlLmxvZyhgW0RleFNjcmVlbmVyXSBGZXRjaGluZyBwcmljZSBmb3IgJHttaW50fSBmcm9tOiAke3VybH1gKTtcblxuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIDgwMDApO1xuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChjb21wYXRpYmxlOyBTb2xhbmFXYWxsZXQvMS4wKVwiLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcblxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgYFtEZXhTY3JlZW5lcl0gXHUyNzRDIEFQSSByZXR1cm5lZCAke3Jlc3BvbnNlLnN0YXR1c30gZm9yIG1pbnQgJHttaW50fWAsXG4gICAgICApO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgZGF0YSA9IChhd2FpdCByZXNwb25zZS5qc29uKCkpIGFzIERleHNjcmVlbmVyUmVzcG9uc2U7XG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0RleFNjcmVlbmVyXSBSZXNwb25zZSByZWNlaXZlZCBmb3IgJHttaW50fTpgLFxuICAgICAgSlNPTi5zdHJpbmdpZnkoZGF0YSkuc3Vic3RyaW5nKDAsIDIwMCksXG4gICAgKTtcblxuICAgIGlmIChkYXRhLnBhaXJzICYmIGRhdGEucGFpcnMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgcHJpY2VVc2QgPSBkYXRhLnBhaXJzWzBdLnByaWNlVXNkO1xuICAgICAgaWYgKHByaWNlVXNkKSB7XG4gICAgICAgIGNvbnN0IHByaWNlID0gcGFyc2VGbG9hdChwcmljZVVzZCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbRGV4U2NyZWVuZXJdIFx1MjcwNSBHb3QgcHJpY2UgZm9yICR7bWludH06ICQke3ByaWNlfWApO1xuICAgICAgICByZXR1cm4gcHJpY2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc29sZS53YXJuKGBbRGV4U2NyZWVuZXJdIE5vIHBhaXJzIGZvdW5kIGluIHJlc3BvbnNlIGZvciAke21pbnR9YCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcbiAgICAgIGBbRGV4U2NyZWVuZXJdIFx1Mjc0QyBGYWlsZWQgdG8gZmV0Y2ggJHttaW50fTpgLFxuICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IGhhbmRsZUV4Y2hhbmdlUmF0ZTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB0b2tlbiA9IChyZXEucXVlcnkudG9rZW4gYXMgc3RyaW5nKSB8fCBcIkZJWEVSQ09JTlwiO1xuXG4gICAgbGV0IHByaWNlVXNkOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICAgIC8vIEZldGNoIHByaWNlIGZyb20gRGV4U2NyZWVuZXIgYmFzZWQgb24gdG9rZW5cbiAgICBpZiAodG9rZW4gPT09IFwiRklYRVJDT0lOXCIpIHtcbiAgICAgIHByaWNlVXNkID0gYXdhaXQgZmV0Y2hUb2tlblByaWNlRnJvbURleFNjcmVlbmVyKFRPS0VOX01JTlRTLkZJWEVSQ09JTik7XG4gICAgfSBlbHNlIGlmICh0b2tlbiA9PT0gXCJTT0xcIikge1xuICAgICAgcHJpY2VVc2QgPSBhd2FpdCBmZXRjaFRva2VuUHJpY2VGcm9tRGV4U2NyZWVuZXIoVE9LRU5fTUlOVFMuU09MKTtcbiAgICB9IGVsc2UgaWYgKHRva2VuID09PSBcIlVTRENcIiB8fCB0b2tlbiA9PT0gXCJVU0RUXCIpIHtcbiAgICAgIC8vIFN0YWJsZWNvaW5zIGFyZSBhbHdheXMgfjEgVVNEXG4gICAgICBwcmljZVVzZCA9IDEuMDtcbiAgICB9IGVsc2UgaWYgKHRva2VuID09PSBcIkxPQ0tFUlwiKSB7XG4gICAgICBwcmljZVVzZCA9IGF3YWl0IGZldGNoVG9rZW5QcmljZUZyb21EZXhTY3JlZW5lcihUT0tFTl9NSU5UUy5MT0NLRVIpO1xuICAgIH1cblxuICAgIC8vIEZhbGwgYmFjayB0byBoYXJkY29kZWQgcmF0ZXMgaWYgRGV4U2NyZWVuZXIgZmV0Y2ggZmFpbHMgb3IgcHJpY2UgaXMgaW52YWxpZFxuICAgIGlmIChwcmljZVVzZCA9PT0gbnVsbCB8fCBwcmljZVVzZCA8PSAwKSB7XG4gICAgICBwcmljZVVzZCA9IEZBTExCQUNLX1JBVEVTW3Rva2VuXSB8fCBGQUxMQkFDS19SQVRFUy5GSVhFUkNPSU47XG4gICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgYFtFeGNoYW5nZVJhdGVdIFVzaW5nIGZhbGxiYWNrIHJhdGUgZm9yICR7dG9rZW59OiAkJHtwcmljZVVzZH1gLFxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coXG4gICAgICAgIGBbRXhjaGFuZ2VSYXRlXSBGZXRjaGVkICR7dG9rZW59IHByaWNlIGZyb20gRGV4U2NyZWVuZXI6ICQke3ByaWNlVXNkfWAsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIENvbnZlcnQgdG8gUEtSIHdpdGggbWFya3VwXG4gICAgY29uc3QgcmF0ZUluUEtSID0gcHJpY2VVc2QgKiBQS1JfUEVSX1VTRCAqIE1BUktVUDtcblxuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYFtFeGNoYW5nZVJhdGVdICR7dG9rZW59OiAkJHtwcmljZVVzZC50b0ZpeGVkKDYpfSBVU0QgLT4gJHtyYXRlSW5QS1IudG9GaXhlZCgyKX0gUEtSICh3aXRoICR7KE1BUktVUCAtIDEpICogMTAwfSUgbWFya3VwKWAsXG4gICAgKTtcblxuICAgIHJlcy5qc29uKHtcbiAgICAgIHRva2VuLFxuICAgICAgcHJpY2VVc2QsXG4gICAgICBwcmljZUluUEtSOiByYXRlSW5QS1IsXG4gICAgICByYXRlOiByYXRlSW5QS1IsXG4gICAgICBwa2tQZXJVc2Q6IFBLUl9QRVJfVVNELFxuICAgICAgbWFya3VwOiBNQVJLVVAsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIltFeGNoYW5nZVJhdGVdIEVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgZXJyb3I6IFwiRmFpbGVkIHRvIGZldGNoIGV4Y2hhbmdlIHJhdGVcIixcbiAgICAgIG1lc3NhZ2U6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICB9KTtcbiAgfVxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2RleHNjcmVlbmVyLXByb3h5LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2RleHNjcmVlbmVyLXByb3h5LnRzXCI7aW1wb3J0IHsgUmVxdWVzdEhhbmRsZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5pbnRlcmZhY2UgRGV4c2NyZWVuZXJUb2tlbiB7XG4gIGNoYWluSWQ6IHN0cmluZztcbiAgZGV4SWQ6IHN0cmluZztcbiAgdXJsOiBzdHJpbmc7XG4gIHBhaXJBZGRyZXNzOiBzdHJpbmc7XG4gIGJhc2VUb2tlbjoge1xuICAgIGFkZHJlc3M6IHN0cmluZztcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgc3ltYm9sOiBzdHJpbmc7XG4gIH07XG4gIHF1b3RlVG9rZW46IHtcbiAgICBhZGRyZXNzOiBzdHJpbmc7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIHN5bWJvbDogc3RyaW5nO1xuICB9O1xuICBwcmljZU5hdGl2ZTogc3RyaW5nO1xuICBwcmljZVVzZD86IHN0cmluZztcbiAgdHhuczoge1xuICAgIG01OiB7IGJ1eXM6IG51bWJlcjsgc2VsbHM6IG51bWJlciB9O1xuICAgIGgxOiB7IGJ1eXM6IG51bWJlcjsgc2VsbHM6IG51bWJlciB9O1xuICAgIGg2OiB7IGJ1eXM6IG51bWJlcjsgc2VsbHM6IG51bWJlciB9O1xuICAgIGgyNDogeyBidXlzOiBudW1iZXI7IHNlbGxzOiBudW1iZXIgfTtcbiAgfTtcbiAgdm9sdW1lOiB7XG4gICAgaDI0OiBudW1iZXI7XG4gICAgaDY6IG51bWJlcjtcbiAgICBoMTogbnVtYmVyO1xuICAgIG01OiBudW1iZXI7XG4gIH07XG4gIHByaWNlQ2hhbmdlOiB7XG4gICAgbTU6IG51bWJlcjtcbiAgICBoMTogbnVtYmVyO1xuICAgIGg2OiBudW1iZXI7XG4gICAgaDI0OiBudW1iZXI7XG4gIH07XG4gIGxpcXVpZGl0eT86IHtcbiAgICB1c2Q/OiBudW1iZXI7XG4gICAgYmFzZT86IG51bWJlcjtcbiAgICBxdW90ZT86IG51bWJlcjtcbiAgfTtcbiAgZmR2PzogbnVtYmVyO1xuICBtYXJrZXRDYXA/OiBudW1iZXI7XG4gIGluZm8/OiB7XG4gICAgaW1hZ2VVcmw/OiBzdHJpbmc7XG4gICAgd2Vic2l0ZXM/OiBBcnJheTx7IGxhYmVsOiBzdHJpbmc7IHVybDogc3RyaW5nIH0+O1xuICAgIHNvY2lhbHM/OiBBcnJheTx7IHR5cGU6IHN0cmluZzsgdXJsOiBzdHJpbmcgfT47XG4gIH07XG59XG5cbmludGVyZmFjZSBEZXhzY3JlZW5lclJlc3BvbnNlIHtcbiAgc2NoZW1hVmVyc2lvbjogc3RyaW5nO1xuICBwYWlyczogRGV4c2NyZWVuZXJUb2tlbltdO1xufVxuXG4vLyBEZXhTY3JlZW5lciBlbmRwb2ludHMgZm9yIGZhaWxvdmVyXG5jb25zdCBERVhTQ1JFRU5FUl9FTkRQT0lOVFMgPSBbXG4gIFwiaHR0cHM6Ly9hcGkuZGV4c2NyZWVuZXIuY29tL2xhdGVzdC9kZXhcIixcbiAgXCJodHRwczovL2FwaS5kZXhzY3JlZW5lci5pby9sYXRlc3QvZGV4XCIsIC8vIEFsdGVybmF0aXZlIGRvbWFpblxuXTtcblxuY29uc3QgQ0FDSEVfVFRMX01TID0gMzBfMDAwOyAvLyAzMCBzZWNvbmRzXG5jb25zdCBNQVhfVE9LRU5TX1BFUl9CQVRDSCA9IDIwO1xuXG5sZXQgY3VycmVudEVuZHBvaW50SW5kZXggPSAwO1xuY29uc3QgY2FjaGUgPSBuZXcgTWFwPFxuICBzdHJpbmcsXG4gIHsgZGF0YTogRGV4c2NyZWVuZXJSZXNwb25zZTsgZXhwaXJlc0F0OiBudW1iZXIgfVxuPigpO1xuY29uc3QgaW5mbGlnaHRSZXF1ZXN0cyA9IG5ldyBNYXA8c3RyaW5nLCBQcm9taXNlPERleHNjcmVlbmVyUmVzcG9uc2U+PigpO1xuXG5jb25zdCB0cnlEZXhzY3JlZW5lckVuZHBvaW50cyA9IGFzeW5jIChcbiAgcGF0aDogc3RyaW5nLFxuKTogUHJvbWlzZTxEZXhzY3JlZW5lclJlc3BvbnNlPiA9PiB7XG4gIGxldCBsYXN0RXJyb3I6IEVycm9yIHwgbnVsbCA9IG51bGw7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBERVhTQ1JFRU5FUl9FTkRQT0lOVFMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBlbmRwb2ludEluZGV4ID1cbiAgICAgIChjdXJyZW50RW5kcG9pbnRJbmRleCArIGkpICUgREVYU0NSRUVORVJfRU5EUE9JTlRTLmxlbmd0aDtcbiAgICBjb25zdCBlbmRwb2ludCA9IERFWFNDUkVFTkVSX0VORFBPSU5UU1tlbmRwb2ludEluZGV4XTtcbiAgICBjb25zdCB1cmwgPSBgJHtlbmRwb2ludH0ke3BhdGh9YDtcblxuICAgIHRyeSB7XG4gICAgICBjb25zb2xlLmxvZyhgVHJ5aW5nIERleFNjcmVlbmVyIEFQSTogJHt1cmx9YCk7XG5cbiAgICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgICBjb25zdCB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgMTIwMDApOyAvLyAxMnMgdGltZW91dFxuXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICBBY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChjb21wYXRpYmxlOyBTb2xhbmFXYWxsZXQvMS4wKVwiLFxuICAgICAgICB9LFxuICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgfSk7XG5cbiAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQyOSkge1xuICAgICAgICAgIC8vIFJhdGUgbGltaXRlZCAtIHRyeSBuZXh0IGVuZHBvaW50XG4gICAgICAgICAgY29uc29sZS53YXJuKGBSYXRlIGxpbWl0ZWQgb24gJHtlbmRwb2ludH0sIHRyeWluZyBuZXh0Li4uYCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBIVFRQICR7cmVzcG9uc2Uuc3RhdHVzfTogJHtyZXNwb25zZS5zdGF0dXNUZXh0fWApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBkYXRhID0gKGF3YWl0IHJlc3BvbnNlLmpzb24oKSkgYXMgRGV4c2NyZWVuZXJSZXNwb25zZTtcblxuICAgICAgLy8gU3VjY2VzcyAtIHVwZGF0ZSBjdXJyZW50IGVuZHBvaW50XG4gICAgICBjdXJyZW50RW5kcG9pbnRJbmRleCA9IGVuZHBvaW50SW5kZXg7XG4gICAgICBjb25zb2xlLmxvZyhgRGV4U2NyZWVuZXIgQVBJIGNhbGwgc3VjY2Vzc2Z1bCB2aWEgJHtlbmRwb2ludH1gKTtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zdCBlcnJvck1zZyA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbiAgICAgIGNvbnNvbGUud2FybihgRGV4U2NyZWVuZXIgZW5kcG9pbnQgJHtlbmRwb2ludH0gZmFpbGVkOmAsIGVycm9yTXNnKTtcbiAgICAgIGxhc3RFcnJvciA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvciA6IG5ldyBFcnJvcihTdHJpbmcoZXJyb3IpKTtcblxuICAgICAgLy8gU21hbGwgZGVsYXkgYmVmb3JlIHRyeWluZyBuZXh0IGVuZHBvaW50XG4gICAgICBpZiAoaSA8IERFWFNDUkVFTkVSX0VORFBPSU5UUy5sZW5ndGggLSAxKSB7XG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDEwMDApKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgYEFsbCBEZXhTY3JlZW5lciBlbmRwb2ludHMgZmFpbGVkLiBMYXN0IGVycm9yOiAke2xhc3RFcnJvcj8ubWVzc2FnZSB8fCBcIlVua25vd24gZXJyb3JcIn1gLFxuICApO1xufTtcblxuY29uc3QgZmV0Y2hEZXhzY3JlZW5lckRhdGEgPSBhc3luYyAoXG4gIHBhdGg6IHN0cmluZyxcbik6IFByb21pc2U8RGV4c2NyZWVuZXJSZXNwb25zZT4gPT4ge1xuICBjb25zdCBjYWNoZWQgPSBjYWNoZS5nZXQocGF0aCk7XG4gIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cbiAgaWYgKGNhY2hlZCAmJiBjYWNoZWQuZXhwaXJlc0F0ID4gbm93KSB7XG4gICAgcmV0dXJuIGNhY2hlZC5kYXRhO1xuICB9XG5cbiAgY29uc3QgZXhpc3RpbmcgPSBpbmZsaWdodFJlcXVlc3RzLmdldChwYXRoKTtcbiAgaWYgKGV4aXN0aW5nKSB7XG4gICAgcmV0dXJuIGV4aXN0aW5nO1xuICB9XG5cbiAgY29uc3QgcmVxdWVzdCA9IChhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0cnlEZXhzY3JlZW5lckVuZHBvaW50cyhwYXRoKTtcbiAgICAgIGNhY2hlLnNldChwYXRoLCB7IGRhdGEsIGV4cGlyZXNBdDogRGF0ZS5ub3coKSArIENBQ0hFX1RUTF9NUyB9KTtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBpbmZsaWdodFJlcXVlc3RzLmRlbGV0ZShwYXRoKTtcbiAgICB9XG4gIH0pKCk7XG5cbiAgaW5mbGlnaHRSZXF1ZXN0cy5zZXQocGF0aCwgcmVxdWVzdCk7XG4gIHJldHVybiByZXF1ZXN0O1xufTtcblxuY29uc3QgbWVyZ2VQYWlyc0J5VG9rZW4gPSAocGFpcnM6IERleHNjcmVlbmVyVG9rZW5bXSk6IERleHNjcmVlbmVyVG9rZW5bXSA9PiB7XG4gIGNvbnN0IGJ5TWludCA9IG5ldyBNYXA8c3RyaW5nLCBEZXhzY3JlZW5lclRva2VuPigpO1xuXG4gIHBhaXJzLmZvckVhY2goKHBhaXIpID0+IHtcbiAgICBjb25zdCBtaW50ID0gcGFpci5iYXNlVG9rZW4/LmFkZHJlc3MgfHwgcGFpci5wYWlyQWRkcmVzcztcbiAgICBpZiAoIW1pbnQpIHJldHVybjtcblxuICAgIGNvbnN0IGV4aXN0aW5nID0gYnlNaW50LmdldChtaW50KTtcbiAgICBjb25zdCBleGlzdGluZ0xpcXVpZGl0eSA9IGV4aXN0aW5nPy5saXF1aWRpdHk/LnVzZCA/PyAwO1xuICAgIGNvbnN0IGNhbmRpZGF0ZUxpcXVpZGl0eSA9IHBhaXIubGlxdWlkaXR5Py51c2QgPz8gMDtcblxuICAgIGlmICghZXhpc3RpbmcgfHwgY2FuZGlkYXRlTGlxdWlkaXR5ID4gZXhpc3RpbmdMaXF1aWRpdHkpIHtcbiAgICAgIGJ5TWludC5zZXQobWludCwgcGFpcik7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gQXJyYXkuZnJvbShieU1pbnQudmFsdWVzKCkpO1xufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZURleHNjcmVlbmVyVG9rZW5zOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgbWludHMgfSA9IHJlcS5xdWVyeTtcblxuICAgIGlmICghbWludHMgfHwgdHlwZW9mIG1pbnRzICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICBjb25zb2xlLndhcm4oYFtEZXhTY3JlZW5lcl0gSW52YWxpZCBtaW50cyBwYXJhbWV0ZXI6YCwgbWludHMpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6XG4gICAgICAgICAgXCJNaXNzaW5nIG9yIGludmFsaWQgJ21pbnRzJyBwYXJhbWV0ZXIuIEV4cGVjdGVkIGNvbW1hLXNlcGFyYXRlZCB0b2tlbiBtaW50cy5cIixcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKGBbRGV4U2NyZWVuZXJdIFRva2VucyByZXF1ZXN0IGZvciBtaW50czogJHttaW50c31gKTtcblxuICAgIGNvbnN0IHJhd01pbnRzID0gbWludHNcbiAgICAgIC5zcGxpdChcIixcIilcbiAgICAgIC5tYXAoKG1pbnQpID0+IG1pbnQudHJpbSgpKVxuICAgICAgLmZpbHRlcihCb29sZWFuKTtcblxuICAgIGNvbnN0IHVuaXF1ZU1pbnRzID0gQXJyYXkuZnJvbShuZXcgU2V0KHJhd01pbnRzKSk7XG5cbiAgICBpZiAodW5pcXVlTWludHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oe1xuICAgICAgICBlcnJvcjogXCJObyB2YWxpZCB0b2tlbiBtaW50cyBwcm92aWRlZC5cIixcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGJhdGNoZXM6IHN0cmluZ1tdW10gPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHVuaXF1ZU1pbnRzLmxlbmd0aDsgaSArPSBNQVhfVE9LRU5TX1BFUl9CQVRDSCkge1xuICAgICAgYmF0Y2hlcy5wdXNoKHVuaXF1ZU1pbnRzLnNsaWNlKGksIGkgKyBNQVhfVE9LRU5TX1BFUl9CQVRDSCkpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdHM6IERleHNjcmVlbmVyVG9rZW5bXSA9IFtdO1xuICAgIGxldCBzY2hlbWFWZXJzaW9uID0gXCIxLjAuMFwiO1xuXG4gICAgZm9yIChjb25zdCBiYXRjaCBvZiBiYXRjaGVzKSB7XG4gICAgICBjb25zdCBwYXRoID0gYC90b2tlbnMvJHtiYXRjaC5qb2luKFwiLFwiKX1gO1xuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGZldGNoRGV4c2NyZWVuZXJEYXRhKHBhdGgpO1xuICAgICAgaWYgKGRhdGE/LnNjaGVtYVZlcnNpb24pIHtcbiAgICAgICAgc2NoZW1hVmVyc2lvbiA9IGRhdGEuc2NoZW1hVmVyc2lvbjtcbiAgICAgIH1cblxuICAgICAgaWYgKCFkYXRhIHx8ICFBcnJheS5pc0FycmF5KGRhdGEucGFpcnMpKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihcIkludmFsaWQgcmVzcG9uc2UgZm9ybWF0IGZyb20gRGV4U2NyZWVuZXIgQVBJIGJhdGNoXCIpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgcmVzdWx0cy5wdXNoKC4uLmRhdGEucGFpcnMpO1xuICAgIH1cblxuICAgIGNvbnN0IHNvbGFuYVBhaXJzID0gbWVyZ2VQYWlyc0J5VG9rZW4ocmVzdWx0cylcbiAgICAgIC5maWx0ZXIoKHBhaXI6IERleHNjcmVlbmVyVG9rZW4pID0+IHBhaXIuY2hhaW5JZCA9PT0gXCJzb2xhbmFcIilcbiAgICAgIC5zb3J0KChhOiBEZXhzY3JlZW5lclRva2VuLCBiOiBEZXhzY3JlZW5lclRva2VuKSA9PiB7XG4gICAgICAgIGNvbnN0IGFMaXF1aWRpdHkgPSBhLmxpcXVpZGl0eT8udXNkIHx8IDA7XG4gICAgICAgIGNvbnN0IGJMaXF1aWRpdHkgPSBiLmxpcXVpZGl0eT8udXNkIHx8IDA7XG4gICAgICAgIGlmIChiTGlxdWlkaXR5ICE9PSBhTGlxdWlkaXR5KSByZXR1cm4gYkxpcXVpZGl0eSAtIGFMaXF1aWRpdHk7XG5cbiAgICAgICAgY29uc3QgYVZvbHVtZSA9IGEudm9sdW1lPy5oMjQgfHwgMDtcbiAgICAgICAgY29uc3QgYlZvbHVtZSA9IGIudm9sdW1lPy5oMjQgfHwgMDtcbiAgICAgICAgcmV0dXJuIGJWb2x1bWUgLSBhVm9sdW1lO1xuICAgICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbRGV4U2NyZWVuZXJdIFx1MjcwNSBSZXNwb25zZTogJHtzb2xhbmFQYWlycy5sZW5ndGh9IFNvbGFuYSBwYWlycyBmb3VuZCBhY3Jvc3MgJHtiYXRjaGVzLmxlbmd0aH0gYmF0Y2goZXMpYCxcbiAgICApO1xuICAgIHJlcy5qc29uKHsgc2NoZW1hVmVyc2lvbiwgcGFpcnM6IHNvbGFuYVBhaXJzIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJbRGV4U2NyZWVuZXJdIFx1Mjc0QyBUb2tlbnMgcHJveHkgZXJyb3I6XCIsIHtcbiAgICAgIG1pbnRzOiByZXEucXVlcnkubWludHMsXG4gICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgc3RhY2s6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5zdGFjayA6IHVuZGVmaW5lZCxcbiAgICB9KTtcblxuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiB7XG4gICAgICAgIG1lc3NhZ2U6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJJbnRlcm5hbCBlcnJvclwiLFxuICAgICAgICBkZXRhaWxzOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgfSxcbiAgICAgIHNjaGVtYVZlcnNpb246IFwiMS4wLjBcIixcbiAgICAgIHBhaXJzOiBbXSxcbiAgICB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZURleHNjcmVlbmVyU2VhcmNoOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgcSB9ID0gcmVxLnF1ZXJ5O1xuXG4gICAgaWYgKCFxIHx8IHR5cGVvZiBxICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oe1xuICAgICAgICBlcnJvcjogXCJNaXNzaW5nIG9yIGludmFsaWQgJ3EnIHBhcmFtZXRlciBmb3Igc2VhcmNoIHF1ZXJ5LlwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coYFtEZXhTY3JlZW5lcl0gU2VhcmNoIHJlcXVlc3QgZm9yOiAke3F9YCk7XG5cbiAgICBjb25zdCBkYXRhID0gYXdhaXQgZmV0Y2hEZXhzY3JlZW5lckRhdGEoXG4gICAgICBgL3NlYXJjaC8/cT0ke2VuY29kZVVSSUNvbXBvbmVudChxKX1gLFxuICAgICk7XG5cbiAgICAvLyBGaWx0ZXIgZm9yIFNvbGFuYSBwYWlycyBhbmQgbGltaXQgcmVzdWx0c1xuICAgIGNvbnN0IHNvbGFuYVBhaXJzID0gKGRhdGEucGFpcnMgfHwgW10pXG4gICAgICAuZmlsdGVyKChwYWlyOiBEZXhzY3JlZW5lclRva2VuKSA9PiBwYWlyLmNoYWluSWQgPT09IFwic29sYW5hXCIpXG4gICAgICAuc2xpY2UoMCwgMjApOyAvLyBMaW1pdCB0byAyMCByZXN1bHRzXG5cbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbRGV4U2NyZWVuZXJdIFx1MjcwNSBTZWFyY2ggcmVzcG9uc2U6ICR7c29sYW5hUGFpcnMubGVuZ3RofSByZXN1bHRzYCxcbiAgICApO1xuICAgIHJlcy5qc29uKHtcbiAgICAgIHNjaGVtYVZlcnNpb246IGRhdGEuc2NoZW1hVmVyc2lvbiB8fCBcIjEuMC4wXCIsXG4gICAgICBwYWlyczogc29sYW5hUGFpcnMsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIltEZXhTY3JlZW5lcl0gXHUyNzRDIFNlYXJjaCBwcm94eSBlcnJvcjpcIiwge1xuICAgICAgcXVlcnk6IHJlcS5xdWVyeS5xLFxuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICB9KTtcblxuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiB7XG4gICAgICAgIG1lc3NhZ2U6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJJbnRlcm5hbCBlcnJvclwiLFxuICAgICAgICBkZXRhaWxzOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgfSxcbiAgICAgIHNjaGVtYVZlcnNpb246IFwiMS4wLjBcIixcbiAgICAgIHBhaXJzOiBbXSxcbiAgICB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZURleHNjcmVlbmVyVHJlbmRpbmc6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc29sZS5sb2coXCJbRGV4U2NyZWVuZXJdIFRyZW5kaW5nIHRva2VucyByZXF1ZXN0XCIpO1xuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IGZldGNoRGV4c2NyZWVuZXJEYXRhKFwiL3BhaXJzL3NvbGFuYVwiKTtcblxuICAgIC8vIEdldCB0b3AgdHJlbmRpbmcgcGFpcnMsIHNvcnRlZCBieSB2b2x1bWUgYW5kIGxpcXVpZGl0eVxuICAgIGNvbnN0IHRyZW5kaW5nUGFpcnMgPSAoZGF0YS5wYWlycyB8fCBbXSlcbiAgICAgIC5maWx0ZXIoXG4gICAgICAgIChwYWlyOiBEZXhzY3JlZW5lclRva2VuKSA9PlxuICAgICAgICAgIHBhaXIudm9sdW1lPy5oMjQgPiAxMDAwICYmIC8vIE1pbmltdW0gdm9sdW1lIGZpbHRlclxuICAgICAgICAgIHBhaXIubGlxdWlkaXR5Py51c2QgJiZcbiAgICAgICAgICBwYWlyLmxpcXVpZGl0eS51c2QgPiAxMDAwMCwgLy8gTWluaW11bSBsaXF1aWRpdHkgZmlsdGVyXG4gICAgICApXG4gICAgICAuc29ydCgoYTogRGV4c2NyZWVuZXJUb2tlbiwgYjogRGV4c2NyZWVuZXJUb2tlbikgPT4ge1xuICAgICAgICAvLyBTb3J0IGJ5IDI0aCB2b2x1bWVcbiAgICAgICAgY29uc3QgYVZvbHVtZSA9IGEudm9sdW1lPy5oMjQgfHwgMDtcbiAgICAgICAgY29uc3QgYlZvbHVtZSA9IGIudm9sdW1lPy5oMjQgfHwgMDtcbiAgICAgICAgcmV0dXJuIGJWb2x1bWUgLSBhVm9sdW1lO1xuICAgICAgfSlcbiAgICAgIC5zbGljZSgwLCA1MCk7IC8vIFRvcCA1MCB0cmVuZGluZ1xuXG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0RleFNjcmVlbmVyXSBcdTI3MDUgVHJlbmRpbmcgcmVzcG9uc2U6ICR7dHJlbmRpbmdQYWlycy5sZW5ndGh9IHRyZW5kaW5nIHBhaXJzYCxcbiAgICApO1xuICAgIHJlcy5qc29uKHtcbiAgICAgIHNjaGVtYVZlcnNpb246IGRhdGEuc2NoZW1hVmVyc2lvbiB8fCBcIjEuMC4wXCIsXG4gICAgICBwYWlyczogdHJlbmRpbmdQYWlycyxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiW0RleFNjcmVlbmVyXSBcdTI3NEMgVHJlbmRpbmcgcHJveHkgZXJyb3I6XCIsIHtcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgfSk7XG5cbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBlcnJvcjoge1xuICAgICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgZXJyb3JcIixcbiAgICAgICAgZGV0YWlsczogU3RyaW5nKGVycm9yKSxcbiAgICAgIH0sXG4gICAgICBzY2hlbWFWZXJzaW9uOiBcIjEuMC4wXCIsXG4gICAgICBwYWlyczogW10sXG4gICAgfSk7XG4gIH1cbn07XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9zcGwtbWV0YS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9zcGwtbWV0YS50c1wiO2ltcG9ydCB0eXBlIHsgUmVxdWVzdEhhbmRsZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5leHBvcnQgY29uc3QgaGFuZGxlU3VibWl0U3BsTWV0YTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7XG4gICAgICBuYW1lLFxuICAgICAgc3ltYm9sLFxuICAgICAgZGVzY3JpcHRpb24sXG4gICAgICBsb2dvVVJJLFxuICAgICAgd2Vic2l0ZSxcbiAgICAgIHR3aXR0ZXIsXG4gICAgICB0ZWxlZ3JhbSxcbiAgICAgIGRleHBhaXIsXG4gICAgICBsYXN0VXBkYXRlZCxcbiAgICB9ID0gcmVxLmJvZHkgfHwge307XG5cbiAgICAvLyBCYXNpYyB2YWxpZGF0aW9uXG4gICAgaWYgKCFuYW1lIHx8ICFzeW1ib2wpIHtcbiAgICAgIHJldHVybiByZXNcbiAgICAgICAgLnN0YXR1cyg0MDApXG4gICAgICAgIC5qc29uKHsgZXJyb3I6IFwiTWlzc2luZyByZXF1aXJlZCBmaWVsZHM6IG5hbWUsIHN5bWJvbFwiIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHBheWxvYWQgPSB7XG4gICAgICBuYW1lOiBTdHJpbmcobmFtZSksXG4gICAgICBzeW1ib2w6IFN0cmluZyhzeW1ib2wpLFxuICAgICAgZGVzY3JpcHRpb246IFN0cmluZyhkZXNjcmlwdGlvbiB8fCBcIlwiKSxcbiAgICAgIGxvZ29VUkk6IFN0cmluZyhsb2dvVVJJIHx8IFwiXCIpLFxuICAgICAgd2Vic2l0ZTogU3RyaW5nKHdlYnNpdGUgfHwgXCJcIiksXG4gICAgICB0d2l0dGVyOiBTdHJpbmcodHdpdHRlciB8fCBcIlwiKSxcbiAgICAgIHRlbGVncmFtOiBTdHJpbmcodGVsZWdyYW0gfHwgXCJcIiksXG4gICAgICBkZXhwYWlyOiBTdHJpbmcoZGV4cGFpciB8fCBcIlwiKSxcbiAgICAgIGxhc3RVcGRhdGVkOiBsYXN0VXBkYXRlZFxuICAgICAgICA/IG5ldyBEYXRlKGxhc3RVcGRhdGVkKS50b0lTT1N0cmluZygpXG4gICAgICAgIDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgcmVjZWl2ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgc291cmNlOiBcInNwbC1tZXRhLWZvcm1cIixcbiAgICB9O1xuXG4gICAgLy8gRm9yIG5vdywganVzdCBhY2tub3dsZWRnZSByZWNlaXB0LiBFeHRlcm5hbCBkaXJlY3RvcmllcyAoU29sc2Nhbi9EZXhzY3JlZW5lcilcbiAgICAvLyB0eXBpY2FsbHkgcmVxdWlyZSBtYW51YWwgdmVyaWZpY2F0aW9uIG9yIHBhcnRuZXIgQVBJcy5cbiAgICAvLyBZb3UgY2FuIHdpcmUgdGhpcyB0byBhIHdlYmhvb2sgb3Igc2VydmljZSB3aXRoIGNyZWRlbnRpYWxzLlxuICAgIGNvbnNvbGUubG9nKFwiW1NQTC1NRVRBXSBTdWJtaXNzaW9uIHJlY2VpdmVkOlwiLCBwYXlsb2FkKTtcblxuICAgIHJldHVybiByZXMuc3RhdHVzKDIwMikuanNvbih7IHN0YXR1czogXCJxdWV1ZWRcIiwgcGF5bG9hZCB9KTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc3QgbXNnID0gZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpO1xuICAgIGNvbnNvbGUuZXJyb3IoXCJbU1BMLU1FVEFdIFN1Ym1pdCBlcnJvcjpcIiwgbXNnKTtcbiAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogbXNnIH0pO1xuICB9XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvanVwaXRlci1wcm94eS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9qdXBpdGVyLXByb3h5LnRzXCI7aW1wb3J0IHsgUmVxdWVzdEhhbmRsZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5pbnRlcmZhY2UgSnVwaXRlclByaWNlUmVzcG9uc2Uge1xuICBkYXRhOiBSZWNvcmQ8c3RyaW5nLCB7IHByaWNlOiBudW1iZXIgfT47XG59XG5cbi8vIEp1cGl0ZXIgZW5kcG9pbnRzXG5jb25zdCBKVVBJVEVSX1BSSUNFX0VORFBPSU5UUyA9IFtcbiAgXCJodHRwczovL3ByaWNlLmp1cC5hZy92NFwiLFxuICBcImh0dHBzOi8vYXBpLmp1cC5hZy9wcmljZS92MlwiLFxuXTtcbmNvbnN0IEpVUElURVJfU1dBUF9CQVNFID0gXCJodHRwczovL2xpdGUtYXBpLmp1cC5hZy9zd2FwL3YxXCI7XG5cbmxldCBjdXJyZW50RW5kcG9pbnRJbmRleCA9IDA7XG5cbmNvbnN0IHRyeUp1cGl0ZXJFbmRwb2ludHMgPSBhc3luYyAoXG4gIHBhdGg6IHN0cmluZyxcbiAgcGFyYW1zOiBVUkxTZWFyY2hQYXJhbXMsXG4pOiBQcm9taXNlPGFueT4gPT4ge1xuICBsZXQgbGFzdEVycm9yOiBFcnJvciB8IG51bGwgPSBudWxsO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgSlVQSVRFUl9QUklDRV9FTkRQT0lOVFMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBlbmRwb2ludEluZGV4ID1cbiAgICAgIChjdXJyZW50RW5kcG9pbnRJbmRleCArIGkpICUgSlVQSVRFUl9QUklDRV9FTkRQT0lOVFMubGVuZ3RoO1xuICAgIGNvbnN0IGVuZHBvaW50ID0gSlVQSVRFUl9QUklDRV9FTkRQT0lOVFNbZW5kcG9pbnRJbmRleF07XG4gICAgY29uc3QgdXJsID0gYCR7ZW5kcG9pbnR9JHtwYXRofT8ke3BhcmFtcy50b1N0cmluZygpfWA7XG5cbiAgICB0cnkge1xuICAgICAgY29uc29sZS5sb2coYFRyeWluZyBKdXBpdGVyIEFQSTogJHt1cmx9YCk7XG5cbiAgICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgICBjb25zdCB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgNTAwMCk7XG5cbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgIEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKGNvbXBhdGlibGU7IFNvbGFuYVdhbGxldC8xLjApXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICB9KTtcblxuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG5cbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDI5KSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBSYXRlIGxpbWl0ZWQgb24gJHtlbmRwb2ludH0sIHRyeWluZyBuZXh0Li4uYCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBIVFRQICR7cmVzcG9uc2Uuc3RhdHVzfTogJHtyZXNwb25zZS5zdGF0dXNUZXh0fWApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuXG4gICAgICBjdXJyZW50RW5kcG9pbnRJbmRleCA9IGVuZHBvaW50SW5kZXg7XG4gICAgICBjb25zb2xlLmxvZyhgSnVwaXRlciBBUEkgY2FsbCBzdWNjZXNzZnVsIHZpYSAke2VuZHBvaW50fWApO1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnN0IGVycm9yTXNnID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgICAgY29uc29sZS53YXJuKGBKdXBpdGVyIGVuZHBvaW50ICR7ZW5kcG9pbnR9IGZhaWxlZDpgLCBlcnJvck1zZyk7XG4gICAgICBsYXN0RXJyb3IgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IgOiBuZXcgRXJyb3IoU3RyaW5nKGVycm9yKSk7XG5cbiAgICAgIGlmIChpIDwgSlVQSVRFUl9QUklDRV9FTkRQT0lOVFMubGVuZ3RoIC0gMSkge1xuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCAxMDAwKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgIGBBbGwgSnVwaXRlciBlbmRwb2ludHMgZmFpbGVkLiBMYXN0IGVycm9yOiAke2xhc3RFcnJvcj8ubWVzc2FnZSB8fCBcIlVua25vd24gZXJyb3JcIn1gLFxuICApO1xufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUp1cGl0ZXJQcmljZTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IGlkcyB9ID0gcmVxLnF1ZXJ5O1xuXG4gICAgaWYgKCFpZHMgfHwgdHlwZW9mIGlkcyAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6XG4gICAgICAgICAgXCJNaXNzaW5nIG9yIGludmFsaWQgJ2lkcycgcGFyYW1ldGVyLiBFeHBlY3RlZCBjb21tYS1zZXBhcmF0ZWQgdG9rZW4gbWludHMuXCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZyhgSnVwaXRlciBwcmljZSByZXF1ZXN0IGZvciB0b2tlbnM6ICR7aWRzfWApO1xuXG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7XG4gICAgICBpZHM6IGlkcyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0cnlKdXBpdGVyRW5kcG9pbnRzKFwiL3ByaWNlXCIsIHBhcmFtcyk7XG5cbiAgICBpZiAoIWRhdGEgfHwgdHlwZW9mIGRhdGEgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgcmVzcG9uc2UgZm9ybWF0IGZyb20gSnVwaXRlciBBUElcIik7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coXG4gICAgICBgSnVwaXRlciBwcmljZSByZXNwb25zZTogJHtPYmplY3Qua2V5cyhkYXRhLmRhdGEgfHwge30pLmxlbmd0aH0gdG9rZW5zYCxcbiAgICApO1xuICAgIHJlcy5qc29uKGRhdGEpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJKdXBpdGVyIHByaWNlIHByb3h5IGVycm9yOlwiLCB7XG4gICAgICBpZHM6IHJlcS5xdWVyeS5pZHMsXG4gICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgc3RhY2s6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5zdGFjayA6IHVuZGVmaW5lZCxcbiAgICB9KTtcblxuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiB7XG4gICAgICAgIG1lc3NhZ2U6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJJbnRlcm5hbCBlcnJvclwiLFxuICAgICAgICBkZXRhaWxzOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgfSxcbiAgICAgIGRhdGE6IHt9LFxuICAgIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlSnVwaXRlclRva2VuczogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHR5cGUgPSBcInN0cmljdFwiIH0gPSByZXEucXVlcnkgYXMgeyB0eXBlPzogc3RyaW5nIH07XG5cbiAgICBjb25zb2xlLmxvZyhgSnVwaXRlciB0b2tlbnMgcmVxdWVzdDogJHt0eXBlfWApO1xuXG4gICAgY29uc3QgdHlwZXNUb1RyeSA9IFt0eXBlIHx8IFwic3RyaWN0XCIsIFwiYWxsXCJdOyAvLyBmYWxsYmFjayB0byAnYWxsJyBpZiAnc3RyaWN0JyBmYWlsc1xuICAgIGNvbnN0IGJhc2VFbmRwb2ludHMgPSAodDogc3RyaW5nKSA9PiBbXG4gICAgICBgaHR0cHM6Ly90b2tlbi5qdXAuYWcvJHt0fWAsXG4gICAgICBcImh0dHBzOi8vY2FjaGUuanVwLmFnL3Rva2Vuc1wiLFxuICAgIF07XG5cbiAgICBjb25zdCBmZXRjaFdpdGhUaW1lb3V0ID0gKHVybDogc3RyaW5nLCB0aW1lb3V0TXM6IG51bWJlcikgPT4ge1xuICAgICAgY29uc3QgdGltZW91dFByb21pc2UgPSBuZXcgUHJvbWlzZTxSZXNwb25zZT4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgc2V0VGltZW91dChcbiAgICAgICAgICAoKSA9PlxuICAgICAgICAgICAgcmVzb2x2ZShcbiAgICAgICAgICAgICAgbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiA1MDQsIHN0YXR1c1RleHQ6IFwiR2F0ZXdheSBUaW1lb3V0XCIgfSksXG4gICAgICAgICAgICApLFxuICAgICAgICAgIHRpbWVvdXRNcyxcbiAgICAgICAgKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIFByb21pc2UucmFjZShbXG4gICAgICAgIGZldGNoKHVybCwge1xuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBBY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgICBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoY29tcGF0aWJsZTsgU29sYW5hV2FsbGV0LzEuMClcIixcbiAgICAgICAgICB9LFxuICAgICAgICB9KSxcbiAgICAgICAgdGltZW91dFByb21pc2UsXG4gICAgICBdKSBhcyBQcm9taXNlPFJlc3BvbnNlPjtcbiAgICB9O1xuXG4gICAgbGV0IGxhc3RFcnJvcjogc3RyaW5nID0gXCJcIjtcblxuICAgIGZvciAoY29uc3QgdCBvZiB0eXBlc1RvVHJ5KSB7XG4gICAgICBjb25zdCBlbmRwb2ludHMgPSBiYXNlRW5kcG9pbnRzKHQpO1xuICAgICAgZm9yIChsZXQgYXR0ZW1wdCA9IDE7IGF0dGVtcHQgPD0gMjsgYXR0ZW1wdCsrKSB7XG4gICAgICAgIGZvciAoY29uc3QgZW5kcG9pbnQgb2YgZW5kcG9pbnRzKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2hXaXRoVGltZW91dChlbmRwb2ludCwgODAwMCk7XG4gICAgICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgICAgIGxhc3RFcnJvciA9IGAke2VuZHBvaW50fSAtPiAke3Jlc3BvbnNlLnN0YXR1c30gJHtyZXNwb25zZS5zdGF0dXNUZXh0fWA7XG4gICAgICAgICAgICAgIC8vIHJldHJ5IG9uIHJhdGUgbGltaXRpbmcgLyBzZXJ2ZXIgZXJyb3JzXG4gICAgICAgICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQyOSB8fCByZXNwb25zZS5zdGF0dXMgPj0gNTAwKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgICAgICAgY29uc3QgY291bnQgPSBBcnJheS5pc0FycmF5KGRhdGEpID8gZGF0YS5sZW5ndGggOiAwO1xuICAgICAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgICAgIGBKdXBpdGVyIHRva2VucyByZXNwb25zZSAoJHt0fSkgdmlhICR7ZW5kcG9pbnR9OiAke2NvdW50fSB0b2tlbnNgLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHJldHVybiByZXMuanNvbihkYXRhKTtcbiAgICAgICAgICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICAgICAgICAgIGxhc3RFcnJvciA9IGAke2VuZHBvaW50fSAtPiAke2U/Lm1lc3NhZ2UgfHwgU3RyaW5nKGUpfWA7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYEp1cGl0ZXIgdG9rZW5zIGZldGNoIGZhaWxlZDogJHtsYXN0RXJyb3J9YCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyKSA9PiBzZXRUaW1lb3V0KHIsIGF0dGVtcHQgKiAyNTApKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDIpLmpzb24oe1xuICAgICAgZXJyb3I6IHtcbiAgICAgICAgbWVzc2FnZTogXCJBbGwgSnVwaXRlciB0b2tlbiBlbmRwb2ludHMgZmFpbGVkXCIsXG4gICAgICAgIGRldGFpbHM6IGxhc3RFcnJvciB8fCBcIlVua25vd24gZXJyb3JcIixcbiAgICAgIH0sXG4gICAgICBkYXRhOiBbXSxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiSnVwaXRlciB0b2tlbnMgcHJveHkgZXJyb3I6XCIsIHtcbiAgICAgIHR5cGU6IHJlcS5xdWVyeS50eXBlLFxuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICB9KTtcblxuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiB7XG4gICAgICAgIG1lc3NhZ2U6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJJbnRlcm5hbCBlcnJvclwiLFxuICAgICAgICBkZXRhaWxzOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgfSxcbiAgICAgIGRhdGE6IFtdLFxuICAgIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlSnVwaXRlclF1b3RlOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgaW5wdXRNaW50LCBvdXRwdXRNaW50LCBhbW91bnQsIHNsaXBwYWdlQnBzLCBhc0xlZ2FjeVRyYW5zYWN0aW9uIH0gPVxuICAgICAgcmVxLnF1ZXJ5O1xuXG4gICAgaWYgKFxuICAgICAgIWlucHV0TWludCB8fFxuICAgICAgIW91dHB1dE1pbnQgfHxcbiAgICAgICFhbW91bnQgfHxcbiAgICAgIHR5cGVvZiBpbnB1dE1pbnQgIT09IFwic3RyaW5nXCIgfHxcbiAgICAgIHR5cGVvZiBvdXRwdXRNaW50ICE9PSBcInN0cmluZ1wiIHx8XG4gICAgICB0eXBlb2YgYW1vdW50ICE9PSBcInN0cmluZ1wiXG4gICAgKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oe1xuICAgICAgICBlcnJvcjogXCJNaXNzaW5nIHJlcXVpcmVkIHF1ZXJ5IHBhcmFtczogaW5wdXRNaW50LCBvdXRwdXRNaW50LCBhbW91bnRcIixcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgICAgaW5wdXRNaW50LFxuICAgICAgb3V0cHV0TWludCxcbiAgICAgIGFtb3VudCxcbiAgICAgIHNsaXBwYWdlQnBzOiB0eXBlb2Ygc2xpcHBhZ2VCcHMgPT09IFwic3RyaW5nXCIgPyBzbGlwcGFnZUJwcyA6IFwiNTBcIixcbiAgICAgIG9ubHlEaXJlY3RSb3V0ZXM6IFwiZmFsc2VcIixcbiAgICAgIGFzTGVnYWN5VHJhbnNhY3Rpb246XG4gICAgICAgIHR5cGVvZiBhc0xlZ2FjeVRyYW5zYWN0aW9uID09PSBcInN0cmluZ1wiID8gYXNMZWdhY3lUcmFuc2FjdGlvbiA6IFwiZmFsc2VcIixcbiAgICB9KTtcblxuICAgIGNvbnN0IHVybCA9IGAke0pVUElURVJfU1dBUF9CQVNFfS9xdW90ZT8ke3BhcmFtcy50b1N0cmluZygpfWA7XG5cbiAgICBjb25zdCBmZXRjaFdpdGhUaW1lb3V0ID0gKHRpbWVvdXRNczogbnVtYmVyKSA9PiB7XG4gICAgICBjb25zdCB0aW1lb3V0UHJvbWlzZSA9IG5ldyBQcm9taXNlPFJlc3BvbnNlPigocmVzb2x2ZSkgPT4ge1xuICAgICAgICBzZXRUaW1lb3V0KFxuICAgICAgICAgICgpID0+XG4gICAgICAgICAgICByZXNvbHZlKFxuICAgICAgICAgICAgICBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDUwNCwgc3RhdHVzVGV4dDogXCJHYXRld2F5IFRpbWVvdXRcIiB9KSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgdGltZW91dE1zLFxuICAgICAgICApO1xuICAgICAgfSk7XG4gICAgICBjb25zdCBmZXRjaFByb21pc2UgPSBmZXRjaCh1cmwsIHtcbiAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoY29tcGF0aWJsZTsgU29sYW5hV2FsbGV0LzEuMClcIixcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIFByb21pc2UucmFjZShbZmV0Y2hQcm9taXNlLCB0aW1lb3V0UHJvbWlzZV0pIGFzIFByb21pc2U8UmVzcG9uc2U+O1xuICAgIH07XG5cbiAgICAvLyBUcnkgdXAgdG8gMyBhdHRlbXB0cyB3aXRoIHNtYWxsIGJhY2tvZmYgb24gNXh4LzQyOVxuICAgIGxldCBsYXN0U3RhdHVzID0gMDtcbiAgICBsZXQgbGFzdFRleHQgPSBcIlwiO1xuICAgIGZvciAobGV0IGF0dGVtcHQgPSAxOyBhdHRlbXB0IDw9IDI7IGF0dGVtcHQrKykge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaFdpdGhUaW1lb3V0KDgwMDApO1xuICAgICAgbGFzdFN0YXR1cyA9IHJlc3BvbnNlLnN0YXR1cztcbiAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgICByZXR1cm4gcmVzLmpzb24oZGF0YSk7XG4gICAgICB9XG4gICAgICBsYXN0VGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKS5jYXRjaCgoKSA9PiBcIlwiKTtcblxuICAgICAgLy8gSWYgNDA0IG9yIDQwMCwgbGlrZWx5IG1lYW5zIG5vIHJvdXRlIGV4aXN0cyBmb3IgdGhpcyBwYWlyXG4gICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MDQgfHwgcmVzcG9uc2Uuc3RhdHVzID09PSA0MDApIHtcbiAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgIGBKdXBpdGVyIHF1b3RlIHJldHVybmVkICR7cmVzcG9uc2Uuc3RhdHVzfSAtIGxpa2VseSBubyByb3V0ZSBmb3IgdGhpcyBwYWlyYCxcbiAgICAgICAgICB7IGlucHV0TWludDogcmVxLnF1ZXJ5LmlucHV0TWludCwgb3V0cHV0TWludDogcmVxLnF1ZXJ5Lm91dHB1dE1pbnQgfSxcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMocmVzcG9uc2Uuc3RhdHVzKS5qc29uKHtcbiAgICAgICAgICBlcnJvcjogYE5vIHN3YXAgcm91dGUgZm91bmQgZm9yIHRoaXMgcGFpcmAsXG4gICAgICAgICAgZGV0YWlsczogbGFzdFRleHQsXG4gICAgICAgICAgY29kZTogcmVzcG9uc2Uuc3RhdHVzID09PSA0MDQgPyBcIk5PX1JPVVRFX0ZPVU5EXCIgOiBcIklOVkFMSURfUEFSQU1TXCIsXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBSZXRyeSBvbiByYXRlIGxpbWl0IG9yIHNlcnZlciBlcnJvcnNcbiAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQyOSB8fCByZXNwb25zZS5zdGF0dXMgPj0gNTAwKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICBgSnVwaXRlciBBUEkgcmV0dXJuZWQgJHtyZXNwb25zZS5zdGF0dXN9LCByZXRyeWluZy4uLiAoYXR0ZW1wdCAke2F0dGVtcHR9LzIpYCxcbiAgICAgICAgKTtcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgYXR0ZW1wdCAqIDI1MCkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHJldHVybiByZXMuc3RhdHVzKGxhc3RTdGF0dXMgfHwgNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBgUXVvdGUgQVBJIGVycm9yYCxcbiAgICAgIGRldGFpbHM6IGxhc3RUZXh0LFxuICAgICAgY29kZTogbGFzdFN0YXR1cyA9PT0gNTA0ID8gXCJUSU1FT1VUXCIgOiBcIkFQSV9FUlJPUlwiLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJKdXBpdGVyIHF1b3RlIHByb3h5IGVycm9yOlwiLCB7XG4gICAgICBwYXJhbXM6IHJlcS5xdWVyeSxcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICBzdGFjazogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLnN0YWNrIDogdW5kZWZpbmVkLFxuICAgIH0pO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgZXJyb3JcIixcbiAgICB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUp1cGl0ZXJTd2FwOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGJvZHkgPSByZXEuYm9keSB8fCB7fTtcbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIFwiaGFuZGxlSnVwaXRlclN3YXAgcmVjZWl2ZWQgYm9keSBrZXlzOlwiLFxuICAgICAgT2JqZWN0LmtleXMoYm9keSB8fCB7fSksXG4gICAgKTtcblxuICAgIGlmICghYm9keSB8fCAhYm9keS5xdW90ZVJlc3BvbnNlIHx8ICFib2R5LnVzZXJQdWJsaWNLZXkpIHtcbiAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgXCJoYW5kbGVKdXBpdGVyU3dhcCBtaXNzaW5nIGZpZWxkcywgYm9keTpcIixcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoYm9keSksXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6XG4gICAgICAgICAgXCJNaXNzaW5nIHJlcXVpcmVkIGJvZHk6IHsgcXVvdGVSZXNwb25zZSwgdXNlclB1YmxpY0tleSwgLi4ub3B0aW9ucyB9XCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCAyMDAwMCk7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke0pVUElURVJfU1dBUF9CQVNFfS9zd2FwYCwge1xuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChjb21wYXRpYmxlOyBTb2xhbmFXYWxsZXQvMS4wKVwiLFxuICAgICAgfSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICB9KTtcblxuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgY29uc3QgdGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKS5jYXRjaCgoKSA9PiBcIlwiKTtcbiAgICAgIHJldHVybiByZXNcbiAgICAgICAgLnN0YXR1cyhyZXNwb25zZS5zdGF0dXMpXG4gICAgICAgIC5qc29uKHsgZXJyb3I6IGBTd2FwIGZhaWxlZDogJHtyZXNwb25zZS5zdGF0dXNUZXh0fWAsIGRldGFpbHM6IHRleHQgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICByZXMuanNvbihkYXRhKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiSnVwaXRlciBzd2FwIHByb3h5IGVycm9yOlwiLCB7XG4gICAgICBib2R5OiByZXEuYm9keSxcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICBzdGFjazogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLnN0YWNrIDogdW5kZWZpbmVkLFxuICAgIH0pO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgZXJyb3JcIixcbiAgICB9KTtcbiAgfVxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2ZvcmV4LXJhdGUudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvZm9yZXgtcmF0ZS50c1wiO2ltcG9ydCB7IFJlcXVlc3RIYW5kbGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUZvcmV4UmF0ZTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBiYXNlID0gU3RyaW5nKHJlcS5xdWVyeS5iYXNlIHx8IFwiVVNEXCIpLnRvVXBwZXJDYXNlKCk7XG4gICAgY29uc3Qgc3ltYm9scyA9IFN0cmluZyhyZXEucXVlcnkuc3ltYm9scyB8fCBcIlBLUlwiKS50b1VwcGVyQ2FzZSgpO1xuICAgIGNvbnN0IGZpcnN0U3ltYm9sID0gc3ltYm9scy5zcGxpdChcIixcIilbMF07XG4gICAgY29uc3QgUFJPVklERVJfVElNRU9VVF9NUyA9IDUwMDA7XG5cbiAgICBjb25zdCBwcm92aWRlcnM6IEFycmF5PHtcbiAgICAgIG5hbWU6IHN0cmluZztcbiAgICAgIHVybDogc3RyaW5nO1xuICAgICAgcGFyc2U6IChqOiBhbnkpID0+IG51bWJlciB8IG51bGw7XG4gICAgfT4gPSBbXG4gICAgICB7XG4gICAgICAgIG5hbWU6IFwiZXhjaGFuZ2VyYXRlLmhvc3RcIixcbiAgICAgICAgdXJsOiBgaHR0cHM6Ly9hcGkuZXhjaGFuZ2VyYXRlLmhvc3QvbGF0ZXN0P2Jhc2U9JHtlbmNvZGVVUklDb21wb25lbnQoYmFzZSl9JnN5bWJvbHM9JHtlbmNvZGVVUklDb21wb25lbnQoZmlyc3RTeW1ib2wpfWAsXG4gICAgICAgIHBhcnNlOiAoaikgPT5cbiAgICAgICAgICBqICYmIGoucmF0ZXMgJiYgdHlwZW9mIGoucmF0ZXNbZmlyc3RTeW1ib2xdID09PSBcIm51bWJlclwiXG4gICAgICAgICAgICA/IGoucmF0ZXNbZmlyc3RTeW1ib2xdXG4gICAgICAgICAgICA6IG51bGwsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiBcImZyYW5rZnVydGVyXCIsXG4gICAgICAgIHVybDogYGh0dHBzOi8vYXBpLmZyYW5rZnVydGVyLmFwcC9sYXRlc3Q/ZnJvbT0ke2VuY29kZVVSSUNvbXBvbmVudChiYXNlKX0mdG89JHtlbmNvZGVVUklDb21wb25lbnQoZmlyc3RTeW1ib2wpfWAsXG4gICAgICAgIHBhcnNlOiAoaikgPT5cbiAgICAgICAgICBqICYmIGoucmF0ZXMgJiYgdHlwZW9mIGoucmF0ZXNbZmlyc3RTeW1ib2xdID09PSBcIm51bWJlclwiXG4gICAgICAgICAgICA/IGoucmF0ZXNbZmlyc3RTeW1ib2xdXG4gICAgICAgICAgICA6IG51bGwsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiBcImVyLWFwaVwiLFxuICAgICAgICB1cmw6IGBodHRwczovL29wZW4uZXItYXBpLmNvbS92Ni9sYXRlc3QvJHtlbmNvZGVVUklDb21wb25lbnQoYmFzZSl9YCxcbiAgICAgICAgcGFyc2U6IChqKSA9PlxuICAgICAgICAgIGogJiYgai5yYXRlcyAmJiB0eXBlb2Ygai5yYXRlc1tmaXJzdFN5bWJvbF0gPT09IFwibnVtYmVyXCJcbiAgICAgICAgICAgID8gai5yYXRlc1tmaXJzdFN5bWJvbF1cbiAgICAgICAgICAgIDogbnVsbCxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6IFwiZmF3YXphaG1lZC1jZG5cIixcbiAgICAgICAgdXJsOiBgaHR0cHM6Ly9jZG4uanNkZWxpdnIubmV0L2doL2Zhd2F6YWhtZWQwL2N1cnJlbmN5LWFwaUAxL2xhdGVzdC9jdXJyZW5jaWVzLyR7YmFzZS50b0xvd2VyQ2FzZSgpfS8ke2ZpcnN0U3ltYm9sLnRvTG93ZXJDYXNlKCl9Lmpzb25gLFxuICAgICAgICBwYXJzZTogKGopID0+XG4gICAgICAgICAgaiAmJiB0eXBlb2YgaltmaXJzdFN5bWJvbC50b0xvd2VyQ2FzZSgpXSA9PT0gXCJudW1iZXJcIlxuICAgICAgICAgICAgPyBqW2ZpcnN0U3ltYm9sLnRvTG93ZXJDYXNlKCldXG4gICAgICAgICAgICA6IG51bGwsXG4gICAgICB9LFxuICAgIF07XG5cbiAgICBjb25zdCBmZXRjaFByb3ZpZGVyID0gYXN5bmMgKFxuICAgICAgcHJvdmlkZXI6ICh0eXBlb2YgcHJvdmlkZXJzKVtudW1iZXJdLFxuICAgICk6IFByb21pc2U8eyByYXRlOiBudW1iZXI7IHByb3ZpZGVyOiBzdHJpbmcgfT4gPT4ge1xuICAgICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoXG4gICAgICAgICgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSxcbiAgICAgICAgUFJPVklERVJfVElNRU9VVF9NUyxcbiAgICAgICk7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXNwID0gYXdhaXQgZmV0Y2gocHJvdmlkZXIudXJsLCB7XG4gICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgICAgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKGNvbXBhdGlibGU7IFNvbGFuYVdhbGxldC8xLjApXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsIGFzIGFueSxcbiAgICAgICAgfSBhcyBhbnkpO1xuICAgICAgICBpZiAoIXJlc3Aub2spIHtcbiAgICAgICAgICBjb25zdCByZWFzb24gPSBgJHtyZXNwLnN0YXR1c30gJHtyZXNwLnN0YXR1c1RleHR9YDtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IocmVhc29uLnRyaW0oKSB8fCBcIm5vbi1vayByZXNwb25zZVwiKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzcC5qc29uKCk7XG4gICAgICAgIGNvbnN0IHJhdGUgPSBwcm92aWRlci5wYXJzZShqc29uKTtcbiAgICAgICAgaWYgKHR5cGVvZiByYXRlID09PSBcIm51bWJlclwiICYmIGlzRmluaXRlKHJhdGUpICYmIHJhdGUgPiAwKSB7XG4gICAgICAgICAgcmV0dXJuIHsgcmF0ZSwgcHJvdmlkZXI6IHByb3ZpZGVyLm5hbWUgfTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnZhbGlkIHJlc3BvbnNlIHBheWxvYWRcIik7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFske3Byb3ZpZGVyLm5hbWV9XSAke21lc3NhZ2V9YCk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3QgcnVuUHJvdmlkZXJzID0gKCkgPT4ge1xuICAgICAgY29uc3QgYXR0ZW1wdHMgPSBwcm92aWRlcnMubWFwKChwKSA9PiBmZXRjaFByb3ZpZGVyKHApKTtcbiAgICAgIGlmICh0eXBlb2YgKFByb21pc2UgYXMgYW55KS5hbnkgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICByZXR1cm4gKFByb21pc2UgYXMgYW55KS5hbnkoYXR0ZW1wdHMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHsgcmF0ZTogbnVtYmVyOyBwcm92aWRlcjogc3RyaW5nIH0+KFxuICAgICAgICAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgIGxldCByZW1haW5pbmcgPSBhdHRlbXB0cy5sZW5ndGg7XG4gICAgICAgICAgYXR0ZW1wdHMuZm9yRWFjaCgoYXR0ZW1wdCkgPT4ge1xuICAgICAgICAgICAgYXR0ZW1wdC50aGVuKHJlc29sdmUpLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAgICAgZXJyb3JzLnB1c2goZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpKTtcbiAgICAgICAgICAgICAgcmVtYWluaW5nIC09IDE7XG4gICAgICAgICAgICAgIGlmIChyZW1haW5pbmcgPT09IDApIHJlamVjdChuZXcgRXJyb3IoZXJyb3JzLmpvaW4oXCI7IFwiKSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICApO1xuICAgIH07XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgeyByYXRlLCBwcm92aWRlciB9ID0gYXdhaXQgcnVuUHJvdmlkZXJzKCk7XG4gICAgICByZXMuanNvbih7XG4gICAgICAgIGJhc2UsXG4gICAgICAgIHN5bWJvbHM6IFtmaXJzdFN5bWJvbF0sXG4gICAgICAgIHJhdGVzOiB7IFtmaXJzdFN5bWJvbF06IHJhdGUgfSxcbiAgICAgICAgcHJvdmlkZXIsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc3QgbXNnID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgICAgcmVzXG4gICAgICAgIC5zdGF0dXMoNTAyKVxuICAgICAgICAuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBmZXRjaCBmb3JleCByYXRlXCIsIGRldGFpbHM6IG1zZyB9KTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJVbmV4cGVjdGVkIGVycm9yXCIgfSk7XG4gIH1cbn07XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9zdGFibGUtMjRoLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL3N0YWJsZS0yNGgudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVTdGFibGUyNGg6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3Qgc3ltYm9sc1BhcmFtID0gU3RyaW5nKHJlcS5xdWVyeS5zeW1ib2xzIHx8IFwiVVNEQyxVU0RUXCIpLnRvVXBwZXJDYXNlKCk7XG4gICAgY29uc3Qgc3ltYm9scyA9IEFycmF5LmZyb20oXG4gICAgICBuZXcgU2V0KFxuICAgICAgICBTdHJpbmcoc3ltYm9sc1BhcmFtKVxuICAgICAgICAgIC5zcGxpdChcIixcIilcbiAgICAgICAgICAubWFwKChzKSA9PiBzLnRyaW0oKSlcbiAgICAgICAgICAuZmlsdGVyKEJvb2xlYW4pLFxuICAgICAgKSxcbiAgICApO1xuXG4gICAgY29uc3QgQ09JTkdFQ0tPX0lEUzogUmVjb3JkPHN0cmluZywgeyBpZDogc3RyaW5nOyBtaW50OiBzdHJpbmcgfT4gPSB7XG4gICAgICBVU0RDOiB7XG4gICAgICAgIGlkOiBcInVzZC1jb2luXCIsXG4gICAgICAgIG1pbnQ6IFwiRVBqRldkZDVBdWZxU1NxZU0ycU4xeHp5YmFwQzhHNHdFR0drWnd5VER0MXZcIixcbiAgICAgIH0sXG4gICAgICBVU0RUOiB7XG4gICAgICAgIGlkOiBcInRldGhlclwiLFxuICAgICAgICBtaW50OiBcIkVzOXZNRnJ6YUNFUm1KZnJGNEgyRllENEtDb05rWTExTWNDZThCZW5FbnNcIixcbiAgICAgIH0sXG4gICAgfTtcblxuICAgIGNvbnN0IGlkcyA9IHN5bWJvbHNcbiAgICAgIC5tYXAoKHMpID0+IENPSU5HRUNLT19JRFNbc10/LmlkKVxuICAgICAgLmZpbHRlcihCb29sZWFuKVxuICAgICAgLmpvaW4oXCIsXCIpO1xuXG4gICAgaWYgKCFpZHMpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiBcIk5vIHN1cHBvcnRlZCBzeW1ib2xzIHByb3ZpZGVkXCIgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgYXBpVXJsID0gYGh0dHBzOi8vYXBpLmNvaW5nZWNrby5jb20vYXBpL3YzL3NpbXBsZS9wcmljZT9pZHM9JHtlbmNvZGVVUklDb21wb25lbnQoaWRzKX0mdnNfY3VycmVuY2llcz11c2QmaW5jbHVkZV8yNGhyX2NoYW5nZT10cnVlYDtcbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCAxMjAwMCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcCA9IGF3YWl0IGZldGNoKGFwaVVybCwge1xuICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsIGFzIGFueSxcbiAgICAgICAgaGVhZGVyczogeyBBY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgICB9IGFzIGFueSk7XG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcblxuICAgICAgY29uc3QgcmVzdWx0OiBSZWNvcmQ8XG4gICAgICAgIHN0cmluZyxcbiAgICAgICAgeyBwcmljZVVzZDogbnVtYmVyOyBjaGFuZ2UyNGg6IG51bWJlcjsgbWludDogc3RyaW5nIH1cbiAgICAgID4gPSB7fTtcblxuICAgICAgaWYgKHJlc3Aub2spIHtcbiAgICAgICAgY29uc3QganNvbiA9IGF3YWl0IHJlc3AuanNvbigpO1xuICAgICAgICBzeW1ib2xzLmZvckVhY2goKHN5bSkgPT4ge1xuICAgICAgICAgIGNvbnN0IG1ldGEgPSBDT0lOR0VDS09fSURTW3N5bV07XG4gICAgICAgICAgaWYgKCFtZXRhKSByZXR1cm47XG4gICAgICAgICAgY29uc3QgZCA9IChqc29uIGFzIGFueSk/LlttZXRhLmlkXTtcbiAgICAgICAgICBjb25zdCBwcmljZSA9IHR5cGVvZiBkPy51c2QgPT09IFwibnVtYmVyXCIgPyBkLnVzZCA6IDE7XG4gICAgICAgICAgY29uc3QgY2hhbmdlID1cbiAgICAgICAgICAgIHR5cGVvZiBkPy51c2RfMjRoX2NoYW5nZSA9PT0gXCJudW1iZXJcIiA/IGQudXNkXzI0aF9jaGFuZ2UgOiAwO1xuICAgICAgICAgIHJlc3VsdFtzeW1dID0geyBwcmljZVVzZDogcHJpY2UsIGNoYW5nZTI0aDogY2hhbmdlLCBtaW50OiBtZXRhLm1pbnQgfTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzeW1ib2xzLmZvckVhY2goKHN5bSkgPT4ge1xuICAgICAgICAgIGNvbnN0IG1ldGEgPSBDT0lOR0VDS09fSURTW3N5bV07XG4gICAgICAgICAgaWYgKCFtZXRhKSByZXR1cm47XG4gICAgICAgICAgcmVzdWx0W3N5bV0gPSB7IHByaWNlVXNkOiAxLCBjaGFuZ2UyNGg6IDAsIG1pbnQ6IG1ldGEubWludCB9O1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgcmVzLmpzb24oeyBkYXRhOiByZXN1bHQgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICBjb25zdCByZXN1bHQ6IFJlY29yZDxcbiAgICAgICAgc3RyaW5nLFxuICAgICAgICB7IHByaWNlVXNkOiBudW1iZXI7IGNoYW5nZTI0aDogbnVtYmVyOyBtaW50OiBzdHJpbmcgfVxuICAgICAgPiA9IHt9O1xuICAgICAgc3ltYm9scy5mb3JFYWNoKChzeW0pID0+IHtcbiAgICAgICAgY29uc3QgbWV0YSA9IENPSU5HRUNLT19JRFNbc3ltXTtcbiAgICAgICAgaWYgKCFtZXRhKSByZXR1cm47XG4gICAgICAgIHJlc3VsdFtzeW1dID0geyBwcmljZVVzZDogMSwgY2hhbmdlMjRoOiAwLCBtaW50OiBtZXRhLm1pbnQgfTtcbiAgICAgIH0pO1xuICAgICAgcmVzLmpzb24oeyBkYXRhOiByZXN1bHQgfSk7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiVW5leHBlY3RlZCBlcnJvclwiIH0pO1xuICB9XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvcDJwLW9yZGVycy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9wMnAtb3JkZXJzLnRzXCI7aW1wb3J0IHsgUmVxdWVzdEhhbmRsZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFAyUE9yZGVyIHtcbiAgaWQ6IHN0cmluZztcbiAgdHlwZTogXCJidXlcIiB8IFwic2VsbFwiO1xuICBjcmVhdG9yX3dhbGxldDogc3RyaW5nO1xuICB0b2tlbjogc3RyaW5nO1xuICB0b2tlbl9hbW91bnQ6IHN0cmluZztcbiAgcGtyX2Ftb3VudDogbnVtYmVyO1xuICBwYXltZW50X21ldGhvZDogc3RyaW5nO1xuICBzdGF0dXM6IFwiYWN0aXZlXCIgfCBcInBlbmRpbmdcIiB8IFwiY29tcGxldGVkXCIgfCBcImNhbmNlbGxlZFwiIHwgXCJkaXNwdXRlZFwiO1xuICBvbmxpbmU6IGJvb2xlYW47XG4gIGNyZWF0ZWRfYXQ6IG51bWJlcjtcbiAgdXBkYXRlZF9hdDogbnVtYmVyO1xuICBhY2NvdW50X25hbWU/OiBzdHJpbmc7XG4gIGFjY291bnRfbnVtYmVyPzogc3RyaW5nO1xuICB3YWxsZXRfYWRkcmVzcz86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUcmFkZVJvb20ge1xuICBpZDogc3RyaW5nO1xuICBidXllcl93YWxsZXQ6IHN0cmluZztcbiAgc2VsbGVyX3dhbGxldDogc3RyaW5nO1xuICBvcmRlcl9pZDogc3RyaW5nO1xuICBzdGF0dXM6XG4gICAgfCBcInBlbmRpbmdcIlxuICAgIHwgXCJwYXltZW50X2NvbmZpcm1lZFwiXG4gICAgfCBcImFzc2V0c190cmFuc2ZlcnJlZFwiXG4gICAgfCBcImNvbXBsZXRlZFwiXG4gICAgfCBcImNhbmNlbGxlZFwiO1xuICBjcmVhdGVkX2F0OiBudW1iZXI7XG4gIHVwZGF0ZWRfYXQ6IG51bWJlcjtcbn1cblxuLy8gSW4tbWVtb3J5IHN0b3JlIGZvciBkZXZlbG9wbWVudCAod2lsbCBiZSByZXBsYWNlZCB3aXRoIGRhdGFiYXNlKVxuY29uc3Qgb3JkZXJzOiBNYXA8c3RyaW5nLCBQMlBPcmRlcj4gPSBuZXcgTWFwKCk7XG5jb25zdCByb29tczogTWFwPHN0cmluZywgVHJhZGVSb29tPiA9IG5ldyBNYXAoKTtcbmNvbnN0IG1lc3NhZ2VzOiBNYXA8XG4gIHN0cmluZyxcbiAgQXJyYXk8e1xuICAgIGlkOiBzdHJpbmc7XG4gICAgc2VuZGVyX3dhbGxldDogc3RyaW5nO1xuICAgIG1lc3NhZ2U6IHN0cmluZztcbiAgICBjcmVhdGVkX2F0OiBudW1iZXI7XG4gIH0+XG4+ID0gbmV3IE1hcCgpO1xuXG4vLyBIZWxwZXIgZnVuY3Rpb25zXG5mdW5jdGlvbiBnZW5lcmF0ZUlkKHByZWZpeDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAke3ByZWZpeH0tJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIsIDgpfWA7XG59XG5cbi8vIFAyUCBPcmRlcnMgZW5kcG9pbnRzXG5leHBvcnQgY29uc3QgaGFuZGxlTGlzdFAyUE9yZGVyczogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHR5cGUsIHN0YXR1cywgdG9rZW4sIG9ubGluZSB9ID0gcmVxLnF1ZXJ5O1xuXG4gICAgbGV0IGZpbHRlcmVkID0gQXJyYXkuZnJvbShvcmRlcnMudmFsdWVzKCkpO1xuXG4gICAgaWYgKHR5cGUpIGZpbHRlcmVkID0gZmlsdGVyZWQuZmlsdGVyKChvKSA9PiBvLnR5cGUgPT09IHR5cGUpO1xuICAgIGlmIChzdGF0dXMpIGZpbHRlcmVkID0gZmlsdGVyZWQuZmlsdGVyKChvKSA9PiBvLnN0YXR1cyA9PT0gc3RhdHVzKTtcbiAgICBpZiAodG9rZW4pIGZpbHRlcmVkID0gZmlsdGVyZWQuZmlsdGVyKChvKSA9PiBvLnRva2VuID09PSB0b2tlbik7XG4gICAgaWYgKG9ubGluZSA9PT0gXCJ0cnVlXCIpIGZpbHRlcmVkID0gZmlsdGVyZWQuZmlsdGVyKChvKSA9PiBvLm9ubGluZSk7XG4gICAgaWYgKG9ubGluZSA9PT0gXCJmYWxzZVwiKSBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcigobykgPT4gIW8ub25saW5lKTtcblxuICAgIGZpbHRlcmVkLnNvcnQoKGEsIGIpID0+IGIuY3JlYXRlZF9hdCAtIGEuY3JlYXRlZF9hdCk7XG5cbiAgICByZXMuanNvbih7IG9yZGVyczogZmlsdGVyZWQgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkxpc3QgUDJQIG9yZGVycyBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGxpc3Qgb3JkZXJzXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVDcmVhdGVQMlBPcmRlcjogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7XG4gICAgICB0eXBlLFxuICAgICAgY3JlYXRvcl93YWxsZXQsXG4gICAgICB0b2tlbixcbiAgICAgIHRva2VuX2Ftb3VudCxcbiAgICAgIHBrcl9hbW91bnQsXG4gICAgICBwYXltZW50X21ldGhvZCxcbiAgICAgIG9ubGluZSxcbiAgICAgIGFjY291bnRfbmFtZSxcbiAgICAgIGFjY291bnRfbnVtYmVyLFxuICAgICAgd2FsbGV0X2FkZHJlc3MsXG4gICAgfSA9IHJlcS5ib2R5O1xuXG4gICAgaWYgKFxuICAgICAgIXR5cGUgfHxcbiAgICAgICFjcmVhdG9yX3dhbGxldCB8fFxuICAgICAgIXRva2VuIHx8XG4gICAgICAhdG9rZW5fYW1vdW50IHx8XG4gICAgICAhcGtyX2Ftb3VudCB8fFxuICAgICAgIXBheW1lbnRfbWV0aG9kXG4gICAgKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogXCJNaXNzaW5nIHJlcXVpcmVkIGZpZWxkc1wiIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGlkID0gZ2VuZXJhdGVJZChcIm9yZGVyXCIpO1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cbiAgICBjb25zdCBvcmRlcjogUDJQT3JkZXIgPSB7XG4gICAgICBpZCxcbiAgICAgIHR5cGUsXG4gICAgICBjcmVhdG9yX3dhbGxldCxcbiAgICAgIHRva2VuLFxuICAgICAgdG9rZW5fYW1vdW50OiBTdHJpbmcodG9rZW5fYW1vdW50KSxcbiAgICAgIHBrcl9hbW91bnQ6IE51bWJlcihwa3JfYW1vdW50KSxcbiAgICAgIHBheW1lbnRfbWV0aG9kLFxuICAgICAgc3RhdHVzOiBcImFjdGl2ZVwiLFxuICAgICAgb25saW5lOiBvbmxpbmUgIT09IGZhbHNlLFxuICAgICAgY3JlYXRlZF9hdDogbm93LFxuICAgICAgdXBkYXRlZF9hdDogbm93LFxuICAgICAgYWNjb3VudF9uYW1lLFxuICAgICAgYWNjb3VudF9udW1iZXIsXG4gICAgICB3YWxsZXRfYWRkcmVzczogdHlwZSA9PT0gXCJzZWxsXCIgPyB3YWxsZXRfYWRkcmVzcyA6IHVuZGVmaW5lZCxcbiAgICB9O1xuXG4gICAgb3JkZXJzLnNldChpZCwgb3JkZXIpO1xuXG4gICAgcmVzLnN0YXR1cygyMDEpLmpzb24oeyBvcmRlciB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiQ3JlYXRlIFAyUCBvcmRlciBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGNyZWF0ZSBvcmRlclwiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlR2V0UDJQT3JkZXI6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBvcmRlcklkIH0gPSByZXEucGFyYW1zO1xuICAgIGNvbnN0IG9yZGVyID0gb3JkZXJzLmdldChvcmRlcklkKTtcblxuICAgIGlmICghb3JkZXIpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiBcIk9yZGVyIG5vdCBmb3VuZFwiIH0pO1xuICAgIH1cblxuICAgIHJlcy5qc29uKHsgb3JkZXIgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkdldCBQMlAgb3JkZXIgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBnZXQgb3JkZXJcIiB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZVVwZGF0ZVAyUE9yZGVyOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgb3JkZXJJZCB9ID0gcmVxLnBhcmFtcztcbiAgICBjb25zdCBvcmRlciA9IG9yZGVycy5nZXQob3JkZXJJZCk7XG5cbiAgICBpZiAoIW9yZGVyKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJPcmRlciBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1cGRhdGVkOiBQMlBPcmRlciA9IHtcbiAgICAgIC4uLm9yZGVyLFxuICAgICAgLi4ucmVxLmJvZHksXG4gICAgICBpZDogb3JkZXIuaWQsXG4gICAgICBjcmVhdGVkX2F0OiBvcmRlci5jcmVhdGVkX2F0LFxuICAgICAgdXBkYXRlZF9hdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuXG4gICAgb3JkZXJzLnNldChvcmRlcklkLCB1cGRhdGVkKTtcbiAgICByZXMuanNvbih7IG9yZGVyOiB1cGRhdGVkIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJVcGRhdGUgUDJQIG9yZGVyIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gdXBkYXRlIG9yZGVyXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVEZWxldGVQMlBPcmRlcjogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IG9yZGVySWQgfSA9IHJlcS5wYXJhbXM7XG5cbiAgICBpZiAoIW9yZGVycy5oYXMob3JkZXJJZCkpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiBcIk9yZGVyIG5vdCBmb3VuZFwiIH0pO1xuICAgIH1cblxuICAgIG9yZGVycy5kZWxldGUob3JkZXJJZCk7XG4gICAgcmVzLmpzb24oeyBvazogdHJ1ZSB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiRGVsZXRlIFAyUCBvcmRlciBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGRlbGV0ZSBvcmRlclwiIH0pO1xuICB9XG59O1xuXG4vLyBUcmFkZSBSb29tcyBlbmRwb2ludHNcbmV4cG9ydCBjb25zdCBoYW5kbGVMaXN0VHJhZGVSb29tczogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHdhbGxldCB9ID0gcmVxLnF1ZXJ5O1xuXG4gICAgbGV0IGZpbHRlcmVkID0gQXJyYXkuZnJvbShyb29tcy52YWx1ZXMoKSk7XG5cbiAgICBpZiAod2FsbGV0KSB7XG4gICAgICBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcihcbiAgICAgICAgKHIpID0+IHIuYnV5ZXJfd2FsbGV0ID09PSB3YWxsZXQgfHwgci5zZWxsZXJfd2FsbGV0ID09PSB3YWxsZXQsXG4gICAgICApO1xuICAgIH1cblxuICAgIGZpbHRlcmVkLnNvcnQoKGEsIGIpID0+IGIuY3JlYXRlZF9hdCAtIGEuY3JlYXRlZF9hdCk7XG5cbiAgICByZXMuanNvbih7IHJvb21zOiBmaWx0ZXJlZCB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiTGlzdCB0cmFkZSByb29tcyBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGxpc3Qgcm9vbXNcIiB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUNyZWF0ZVRyYWRlUm9vbTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IGJ1eWVyX3dhbGxldCwgc2VsbGVyX3dhbGxldCwgb3JkZXJfaWQgfSA9IHJlcS5ib2R5O1xuXG4gICAgaWYgKCFidXllcl93YWxsZXQgfHwgIXNlbGxlcl93YWxsZXQgfHwgIW9yZGVyX2lkKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogXCJNaXNzaW5nIHJlcXVpcmVkIGZpZWxkc1wiIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGlkID0gZ2VuZXJhdGVJZChcInJvb21cIik7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblxuICAgIGNvbnN0IHJvb206IFRyYWRlUm9vbSA9IHtcbiAgICAgIGlkLFxuICAgICAgYnV5ZXJfd2FsbGV0LFxuICAgICAgc2VsbGVyX3dhbGxldCxcbiAgICAgIG9yZGVyX2lkLFxuICAgICAgc3RhdHVzOiBcInBlbmRpbmdcIixcbiAgICAgIGNyZWF0ZWRfYXQ6IG5vdyxcbiAgICAgIHVwZGF0ZWRfYXQ6IG5vdyxcbiAgICB9O1xuXG4gICAgcm9vbXMuc2V0KGlkLCByb29tKTtcblxuICAgIHJlcy5zdGF0dXMoMjAxKS5qc29uKHsgcm9vbSB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiQ3JlYXRlIHRyYWRlIHJvb20gZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBjcmVhdGUgcm9vbVwiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlR2V0VHJhZGVSb29tOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgcm9vbUlkIH0gPSByZXEucGFyYW1zO1xuICAgIGNvbnN0IHJvb20gPSByb29tcy5nZXQocm9vbUlkKTtcblxuICAgIGlmICghcm9vbSkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6IFwiUm9vbSBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICByZXMuanNvbih7IHJvb20gfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkdldCB0cmFkZSByb29tIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gZ2V0IHJvb21cIiB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZVVwZGF0ZVRyYWRlUm9vbTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHJvb21JZCB9ID0gcmVxLnBhcmFtcztcbiAgICBjb25zdCByb29tID0gcm9vbXMuZ2V0KHJvb21JZCk7XG5cbiAgICBpZiAoIXJvb20pIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiBcIlJvb20gbm90IGZvdW5kXCIgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXBkYXRlZDogVHJhZGVSb29tID0ge1xuICAgICAgLi4ucm9vbSxcbiAgICAgIC4uLnJlcS5ib2R5LFxuICAgICAgaWQ6IHJvb20uaWQsXG4gICAgICBjcmVhdGVkX2F0OiByb29tLmNyZWF0ZWRfYXQsXG4gICAgICB1cGRhdGVkX2F0OiBEYXRlLm5vdygpLFxuICAgIH07XG5cbiAgICByb29tcy5zZXQocm9vbUlkLCB1cGRhdGVkKTtcbiAgICByZXMuanNvbih7IHJvb206IHVwZGF0ZWQgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIlVwZGF0ZSB0cmFkZSByb29tIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gdXBkYXRlIHJvb21cIiB9KTtcbiAgfVxufTtcblxuLy8gVHJhZGUgTWVzc2FnZXMgZW5kcG9pbnRzXG5leHBvcnQgY29uc3QgaGFuZGxlTGlzdFRyYWRlTWVzc2FnZXM6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyByb29tSWQgfSA9IHJlcS5wYXJhbXM7XG5cbiAgICBjb25zdCByb29tTWVzc2FnZXMgPSBtZXNzYWdlcy5nZXQocm9vbUlkKSB8fCBbXTtcbiAgICByZXMuanNvbih7IG1lc3NhZ2VzOiByb29tTWVzc2FnZXMgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkxpc3QgdHJhZGUgbWVzc2FnZXMgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBsaXN0IG1lc3NhZ2VzXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVBZGRUcmFkZU1lc3NhZ2U6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyByb29tSWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgY29uc3QgeyBzZW5kZXJfd2FsbGV0LCBtZXNzYWdlLCBhdHRhY2htZW50X3VybCB9ID0gcmVxLmJvZHk7XG5cbiAgICBpZiAoIXNlbmRlcl93YWxsZXQgfHwgIW1lc3NhZ2UpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiBcIk1pc3NpbmcgcmVxdWlyZWQgZmllbGRzXCIgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgaWQgPSBnZW5lcmF0ZUlkKFwibXNnXCIpO1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cbiAgICBjb25zdCBtc2cgPSB7XG4gICAgICBpZCxcbiAgICAgIHNlbmRlcl93YWxsZXQsXG4gICAgICBtZXNzYWdlLFxuICAgICAgYXR0YWNobWVudF91cmwsXG4gICAgICBjcmVhdGVkX2F0OiBub3csXG4gICAgfTtcblxuICAgIGlmICghbWVzc2FnZXMuaGFzKHJvb21JZCkpIHtcbiAgICAgIG1lc3NhZ2VzLnNldChyb29tSWQsIFtdKTtcbiAgICB9XG5cbiAgICBtZXNzYWdlcy5nZXQocm9vbUlkKSEucHVzaChtc2cpO1xuXG4gICAgcmVzLnN0YXR1cygyMDEpLmpzb24oeyBtZXNzYWdlOiBtc2cgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkFkZCB0cmFkZSBtZXNzYWdlIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gYWRkIG1lc3NhZ2VcIiB9KTtcbiAgfVxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL29yZGVycy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9vcmRlcnMudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbmludGVyZmFjZSBPcmRlciB7XG4gIGlkOiBzdHJpbmc7XG4gIHNpZGU6IFwiYnV5XCIgfCBcInNlbGxcIjtcbiAgYW1vdW50UEtSOiBudW1iZXI7XG4gIHF1b3RlQXNzZXQ6IHN0cmluZztcbiAgcHJpY2VQS1JQZXJRdW90ZTogbnVtYmVyO1xuICBwYXltZW50TWV0aG9kOiBzdHJpbmc7XG4gIHJvb21JZDogc3RyaW5nO1xuICBjcmVhdGVkQnk6IHN0cmluZztcbiAgY3JlYXRlZEF0OiBudW1iZXI7XG4gIGFjY291bnROYW1lPzogc3RyaW5nO1xuICBhY2NvdW50TnVtYmVyPzogc3RyaW5nO1xuICB3YWxsZXRBZGRyZXNzPzogc3RyaW5nO1xufVxuXG4vLyBJbi1tZW1vcnkgc3RvcmUgZm9yIG9yZGVycyAod2lsbCBiZSByZXBsYWNlZCB3aXRoIGRhdGFiYXNlIGluIHByb2R1Y3Rpb24pXG5jb25zdCBvcmRlcnNTdG9yZSA9IG5ldyBNYXA8c3RyaW5nLCBPcmRlcj4oKTtcblxuLy8gQWRtaW4gcGFzc3dvcmQgZm9yIHZhbGlkYXRpb25cbmNvbnN0IEFETUlOX1BBU1NXT1JEID0gXCJQYWtpc3RhbiMjMTIzXCI7XG5cbmNvbnN0IGdlbmVyYXRlSWQgPSAocHJlZml4OiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICByZXR1cm4gYCR7cHJlZml4fS0ke0RhdGUubm93KCl9LSR7TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMiwgOCl9YDtcbn07XG5cbmNvbnN0IHZhbGlkYXRlQWRtaW5Ub2tlbiA9ICh0b2tlbjogc3RyaW5nKTogYm9vbGVhbiA9PiB7XG4gIHJldHVybiB0b2tlbiA9PT0gQURNSU5fUEFTU1dPUkQ7XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlTGlzdE9yZGVyczogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHJvb21JZCB9ID0gcmVxLnF1ZXJ5O1xuXG4gICAgbGV0IGZpbHRlcmVkID0gQXJyYXkuZnJvbShvcmRlcnNTdG9yZS52YWx1ZXMoKSk7XG5cbiAgICBpZiAocm9vbUlkICYmIHR5cGVvZiByb29tSWQgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIGZpbHRlcmVkID0gZmlsdGVyZWQuZmlsdGVyKChvKSA9PiBvLnJvb21JZCA9PT0gcm9vbUlkKTtcbiAgICB9XG5cbiAgICAvLyBTb3J0IGJ5IGNyZWF0ZWQgZGF0ZSwgbmV3ZXN0IGZpcnN0XG4gICAgZmlsdGVyZWQuc29ydCgoYSwgYikgPT4gYi5jcmVhdGVkQXQgLSBhLmNyZWF0ZWRBdCk7XG5cbiAgICByZXMuanNvbih7IG9yZGVyczogZmlsdGVyZWQgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkxpc3Qgb3JkZXJzIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gbGlzdCBvcmRlcnNcIiB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUNyZWF0ZU9yZGVyOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHtcbiAgICAgIHNpZGUsXG4gICAgICBhbW91bnRQS1IsXG4gICAgICBxdW90ZUFzc2V0LFxuICAgICAgcHJpY2VQS1JQZXJRdW90ZSxcbiAgICAgIHBheW1lbnRNZXRob2QsXG4gICAgICByb29tSWQgPSBcImdsb2JhbFwiLFxuICAgICAgY3JlYXRlZEJ5LFxuICAgICAgYWNjb3VudE5hbWUsXG4gICAgICBhY2NvdW50TnVtYmVyLFxuICAgICAgd2FsbGV0QWRkcmVzcyxcbiAgICB9ID0gcmVxLmJvZHk7XG5cbiAgICAvLyBWYWxpZGF0ZSByZXF1aXJlZCBmaWVsZHNcbiAgICBpZiAoXG4gICAgICAhc2lkZSB8fFxuICAgICAgIWFtb3VudFBLUiB8fFxuICAgICAgIXF1b3RlQXNzZXQgfHxcbiAgICAgICFwcmljZVBLUlBlclF1b3RlIHx8XG4gICAgICAhcGF5bWVudE1ldGhvZFxuICAgICkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6XG4gICAgICAgICAgXCJNaXNzaW5nIHJlcXVpcmVkIGZpZWxkczogc2lkZSwgYW1vdW50UEtSLCBxdW90ZUFzc2V0LCBwcmljZVBLUlBlclF1b3RlLCBwYXltZW50TWV0aG9kXCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBWYWxpZGF0ZSBhdXRob3JpemF0aW9uXG4gICAgY29uc3QgYXV0aEhlYWRlciA9IHJlcS5oZWFkZXJzLmF1dGhvcml6YXRpb247XG4gICAgY29uc3QgdG9rZW4gPSBhdXRoSGVhZGVyPy5yZXBsYWNlKFwiQmVhcmVyIFwiLCBcIlwiKTtcblxuICAgIGlmICghdG9rZW4gfHwgIXZhbGlkYXRlQWRtaW5Ub2tlbih0b2tlbikpIHtcbiAgICAgIHJldHVybiByZXNcbiAgICAgICAgLnN0YXR1cyg0MDEpXG4gICAgICAgIC5qc29uKHsgZXJyb3I6IFwiVW5hdXRob3JpemVkOiBpbnZhbGlkIG9yIG1pc3NpbmcgYWRtaW4gdG9rZW5cIiB9KTtcbiAgICB9XG5cbiAgICAvLyBWYWxpZGF0ZSBudW1lcmljIGZpZWxkc1xuICAgIGNvbnN0IGFtb3VudCA9IE51bWJlcihhbW91bnRQS1IpO1xuICAgIGNvbnN0IHByaWNlID0gTnVtYmVyKHByaWNlUEtSUGVyUXVvdGUpO1xuXG4gICAgaWYgKCFpc0Zpbml0ZShhbW91bnQpIHx8IGFtb3VudCA8PSAwKSB7XG4gICAgICByZXR1cm4gcmVzXG4gICAgICAgIC5zdGF0dXMoNDAwKVxuICAgICAgICAuanNvbih7IGVycm9yOiBcIkludmFsaWQgYW1vdW50UEtSOiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyXCIgfSk7XG4gICAgfVxuXG4gICAgaWYgKCFpc0Zpbml0ZShwcmljZSkgfHwgcHJpY2UgPD0gMCkge1xuICAgICAgcmV0dXJuIHJlc1xuICAgICAgICAuc3RhdHVzKDQwMClcbiAgICAgICAgLmpzb24oeyBlcnJvcjogXCJJbnZhbGlkIHByaWNlUEtSUGVyUXVvdGU6IG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXJcIiB9KTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgb3JkZXJcbiAgICBjb25zdCBpZCA9IGdlbmVyYXRlSWQoXCJvcmRlclwiKTtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXG4gICAgY29uc3Qgb3JkZXI6IE9yZGVyID0ge1xuICAgICAgaWQsXG4gICAgICBzaWRlOiBzaWRlIGFzIFwiYnV5XCIgfCBcInNlbGxcIixcbiAgICAgIGFtb3VudFBLUjogYW1vdW50LFxuICAgICAgcXVvdGVBc3NldCxcbiAgICAgIHByaWNlUEtSUGVyUXVvdGU6IHByaWNlLFxuICAgICAgcGF5bWVudE1ldGhvZCxcbiAgICAgIHJvb21JZCxcbiAgICAgIGNyZWF0ZWRCeTogY3JlYXRlZEJ5IHx8IFwiYWRtaW5cIixcbiAgICAgIGNyZWF0ZWRBdDogbm93LFxuICAgICAgYWNjb3VudE5hbWUsXG4gICAgICBhY2NvdW50TnVtYmVyLFxuICAgICAgd2FsbGV0QWRkcmVzcyxcbiAgICB9O1xuXG4gICAgb3JkZXJzU3RvcmUuc2V0KGlkLCBvcmRlcik7XG5cbiAgICByZXMuc3RhdHVzKDIwMSkuanNvbih7IG9yZGVyIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJDcmVhdGUgb3JkZXIgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBjcmVhdGUgb3JkZXJcIiB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUdldE9yZGVyOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgb3JkZXJJZCB9ID0gcmVxLnBhcmFtcztcblxuICAgIGNvbnN0IG9yZGVyID0gb3JkZXJzU3RvcmUuZ2V0KG9yZGVySWQpO1xuXG4gICAgaWYgKCFvcmRlcikge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6IFwiT3JkZXIgbm90IGZvdW5kXCIgfSk7XG4gICAgfVxuXG4gICAgcmVzLmpzb24oeyBvcmRlciB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiR2V0IG9yZGVyIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gZ2V0IG9yZGVyXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVVcGRhdGVPcmRlcjogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IG9yZGVySWQgfSA9IHJlcS5wYXJhbXM7XG5cbiAgICAvLyBWYWxpZGF0ZSBhdXRob3JpemF0aW9uXG4gICAgY29uc3QgYXV0aEhlYWRlciA9IHJlcS5oZWFkZXJzLmF1dGhvcml6YXRpb247XG4gICAgY29uc3QgdG9rZW4gPSBhdXRoSGVhZGVyPy5yZXBsYWNlKFwiQmVhcmVyIFwiLCBcIlwiKTtcblxuICAgIGlmICghdG9rZW4gfHwgIXZhbGlkYXRlQWRtaW5Ub2tlbih0b2tlbikpIHtcbiAgICAgIHJldHVybiByZXNcbiAgICAgICAgLnN0YXR1cyg0MDEpXG4gICAgICAgIC5qc29uKHsgZXJyb3I6IFwiVW5hdXRob3JpemVkOiBpbnZhbGlkIG9yIG1pc3NpbmcgYWRtaW4gdG9rZW5cIiB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBvcmRlciA9IG9yZGVyc1N0b3JlLmdldChvcmRlcklkKTtcblxuICAgIGlmICghb3JkZXIpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiBcIk9yZGVyIG5vdCBmb3VuZFwiIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVwZGF0ZWQ6IE9yZGVyID0ge1xuICAgICAgLi4ub3JkZXIsXG4gICAgICAuLi5yZXEuYm9keSxcbiAgICAgIGlkOiBvcmRlci5pZCxcbiAgICAgIGNyZWF0ZWRBdDogb3JkZXIuY3JlYXRlZEF0LFxuICAgIH07XG5cbiAgICBvcmRlcnNTdG9yZS5zZXQob3JkZXJJZCwgdXBkYXRlZCk7XG4gICAgcmVzLmpzb24oeyBvcmRlcjogdXBkYXRlZCB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiVXBkYXRlIG9yZGVyIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gdXBkYXRlIG9yZGVyXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVEZWxldGVPcmRlcjogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IG9yZGVySWQgfSA9IHJlcS5wYXJhbXM7XG5cbiAgICAvLyBWYWxpZGF0ZSBhdXRob3JpemF0aW9uXG4gICAgY29uc3QgYXV0aEhlYWRlciA9IHJlcS5oZWFkZXJzLmF1dGhvcml6YXRpb247XG4gICAgY29uc3QgdG9rZW4gPSBhdXRoSGVhZGVyPy5yZXBsYWNlKFwiQmVhcmVyIFwiLCBcIlwiKTtcblxuICAgIGlmICghdG9rZW4gfHwgIXZhbGlkYXRlQWRtaW5Ub2tlbih0b2tlbikpIHtcbiAgICAgIHJldHVybiByZXNcbiAgICAgICAgLnN0YXR1cyg0MDEpXG4gICAgICAgIC5qc29uKHsgZXJyb3I6IFwiVW5hdXRob3JpemVkOiBpbnZhbGlkIG9yIG1pc3NpbmcgYWRtaW4gdG9rZW5cIiB9KTtcbiAgICB9XG5cbiAgICBpZiAoIW9yZGVyc1N0b3JlLmhhcyhvcmRlcklkKSkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6IFwiT3JkZXIgbm90IGZvdW5kXCIgfSk7XG4gICAgfVxuXG4gICAgb3JkZXJzU3RvcmUuZGVsZXRlKG9yZGVySWQpO1xuICAgIHJlcy5qc29uKHsgb2s6IHRydWUgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkRlbGV0ZSBvcmRlciBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGRlbGV0ZSBvcmRlclwiIH0pO1xuICB9XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL2luZGV4LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS9zZXJ2ZXIvaW5kZXgudHNcIjtpbXBvcnQgZXhwcmVzcyBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IGNvcnMgZnJvbSBcImNvcnNcIjtcbmltcG9ydCB7IGhhbmRsZVNvbGFuYVJwYyB9IGZyb20gXCIuL3JvdXRlcy9zb2xhbmEtcHJveHlcIjtcbmltcG9ydCB7IGhhbmRsZVNvbGFuYVNlbmQgfSBmcm9tIFwiLi9yb3V0ZXMvc29sYW5hLXNlbmRcIjtcbmltcG9ydCB7IGhhbmRsZVNvbGFuYVNpbXVsYXRlIH0gZnJvbSBcIi4vcm91dGVzL3NvbGFuYS1zaW11bGF0ZVwiO1xuaW1wb3J0IHsgaGFuZGxlV2FsbGV0QmFsYW5jZSB9IGZyb20gXCIuL3JvdXRlcy93YWxsZXQtYmFsYW5jZVwiO1xuaW1wb3J0IHsgaGFuZGxlRXhjaGFuZ2VSYXRlIH0gZnJvbSBcIi4vcm91dGVzL2V4Y2hhbmdlLXJhdGVcIjtcbmltcG9ydCB7XG4gIGhhbmRsZURleHNjcmVlbmVyVG9rZW5zLFxuICBoYW5kbGVEZXhzY3JlZW5lclNlYXJjaCxcbiAgaGFuZGxlRGV4c2NyZWVuZXJUcmVuZGluZyxcbn0gZnJvbSBcIi4vcm91dGVzL2RleHNjcmVlbmVyLXByb3h5XCI7XG5pbXBvcnQgeyBoYW5kbGVTdWJtaXRTcGxNZXRhIH0gZnJvbSBcIi4vcm91dGVzL3NwbC1tZXRhXCI7XG5pbXBvcnQge1xuICBoYW5kbGVKdXBpdGVyUHJpY2UsXG4gIGhhbmRsZUp1cGl0ZXJRdW90ZSxcbiAgaGFuZGxlSnVwaXRlclN3YXAsXG4gIGhhbmRsZUp1cGl0ZXJUb2tlbnMsXG59IGZyb20gXCIuL3JvdXRlcy9qdXBpdGVyLXByb3h5XCI7XG5pbXBvcnQgeyBoYW5kbGVGb3JleFJhdGUgfSBmcm9tIFwiLi9yb3V0ZXMvZm9yZXgtcmF0ZVwiO1xuaW1wb3J0IHsgaGFuZGxlU3RhYmxlMjRoIH0gZnJvbSBcIi4vcm91dGVzL3N0YWJsZS0yNGhcIjtcbmltcG9ydCB7XG4gIGhhbmRsZUxpc3RQMlBPcmRlcnMsXG4gIGhhbmRsZUNyZWF0ZVAyUE9yZGVyLFxuICBoYW5kbGVHZXRQMlBPcmRlcixcbiAgaGFuZGxlVXBkYXRlUDJQT3JkZXIsXG4gIGhhbmRsZURlbGV0ZVAyUE9yZGVyLFxuICBoYW5kbGVMaXN0VHJhZGVSb29tcyxcbiAgaGFuZGxlQ3JlYXRlVHJhZGVSb29tLFxuICBoYW5kbGVHZXRUcmFkZVJvb20sXG4gIGhhbmRsZVVwZGF0ZVRyYWRlUm9vbSxcbiAgaGFuZGxlTGlzdFRyYWRlTWVzc2FnZXMsXG4gIGhhbmRsZUFkZFRyYWRlTWVzc2FnZSxcbn0gZnJvbSBcIi4vcm91dGVzL3AycC1vcmRlcnNcIjtcbmltcG9ydCB7XG4gIGhhbmRsZUxpc3RPcmRlcnMsXG4gIGhhbmRsZUNyZWF0ZU9yZGVyLFxuICBoYW5kbGVHZXRPcmRlcixcbiAgaGFuZGxlVXBkYXRlT3JkZXIsXG4gIGhhbmRsZURlbGV0ZU9yZGVyLFxufSBmcm9tIFwiLi9yb3V0ZXMvb3JkZXJzXCI7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVTZXJ2ZXIoKTogUHJvbWlzZTxleHByZXNzLkFwcGxpY2F0aW9uPiB7XG4gIGNvbnN0IGFwcCA9IGV4cHJlc3MoKTtcblxuICAvLyBNaWRkbGV3YXJlXG4gIGFwcC51c2UoY29ycygpKTtcbiAgYXBwLnVzZShleHByZXNzLmpzb24oKSk7XG5cbiAgLy8gRGV4U2NyZWVuZXIgcm91dGVzXG4gIGFwcC5nZXQoXCIvYXBpL2RleHNjcmVlbmVyL3Rva2Vuc1wiLCBoYW5kbGVEZXhzY3JlZW5lclRva2Vucyk7XG4gIGFwcC5nZXQoXCIvYXBpL2RleHNjcmVlbmVyL3NlYXJjaFwiLCBoYW5kbGVEZXhzY3JlZW5lclNlYXJjaCk7XG4gIGFwcC5nZXQoXCIvYXBpL2RleHNjcmVlbmVyL3RyZW5kaW5nXCIsIGhhbmRsZURleHNjcmVlbmVyVHJlbmRpbmcpO1xuXG4gIC8vIEp1cGl0ZXIgcm91dGVzXG4gIGFwcC5nZXQoXCIvYXBpL2p1cGl0ZXIvcHJpY2VcIiwgaGFuZGxlSnVwaXRlclByaWNlKTtcbiAgYXBwLmdldChcIi9hcGkvanVwaXRlci9xdW90ZVwiLCBoYW5kbGVKdXBpdGVyUXVvdGUpO1xuICBhcHAucG9zdChcIi9hcGkvanVwaXRlci9zd2FwXCIsIGhhbmRsZUp1cGl0ZXJTd2FwKTtcbiAgYXBwLmdldChcIi9hcGkvanVwaXRlci90b2tlbnNcIiwgaGFuZGxlSnVwaXRlclRva2Vucyk7XG5cbiAgLy8gU29sYW5hIFJQQyBwcm94eVxuICBhcHAucG9zdChcIi9hcGkvc29sYW5hLXJwY1wiLCBoYW5kbGVTb2xhbmFScGMpO1xuICBhcHAucG9zdChcIi9hcGkvc29sYW5hLXNpbXVsYXRlXCIsIChyZXEsIHJlcykgPT4ge1xuICAgIGNvbnN0IHsgc2lnbmVkQmFzZTY0IH0gPSByZXEuYm9keTtcbiAgICBoYW5kbGVTb2xhbmFTaW11bGF0ZShzaWduZWRCYXNlNjQpLnRoZW4oKHJlc3VsdCkgPT4gcmVzLmpzb24ocmVzdWx0KSkuY2F0Y2goKGVycikgPT4gcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogZXJyLm1lc3NhZ2UgfSkpO1xuICB9KTtcbiAgYXBwLnBvc3QoXCIvYXBpL3NvbGFuYS1zZW5kXCIsIChyZXEsIHJlcykgPT4ge1xuICAgIGNvbnN0IHsgc2lnbmVkQmFzZTY0IH0gPSByZXEuYm9keTtcbiAgICBoYW5kbGVTb2xhbmFTZW5kKHNpZ25lZEJhc2U2NCkudGhlbigocmVzdWx0KSA9PiByZXMuanNvbihyZXN1bHQpKS5jYXRjaCgoZXJyKSA9PiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gIH0pO1xuXG4gIC8vIFdhbGxldCByb3V0ZXNcbiAgYXBwLmdldChcIi9hcGkvd2FsbGV0L2JhbGFuY2VcIiwgaGFuZGxlV2FsbGV0QmFsYW5jZSk7XG5cbiAgLy8gRXhjaGFuZ2UgcmF0ZSByb3V0ZXNcbiAgYXBwLmdldChcIi9hcGkvZXhjaGFuZ2UtcmF0ZVwiLCBoYW5kbGVFeGNoYW5nZVJhdGUpO1xuICBhcHAuZ2V0KFwiL2FwaS9mb3JleC9yYXRlXCIsIGhhbmRsZUZvcmV4UmF0ZSk7XG4gIGFwcC5nZXQoXCIvYXBpL3N0YWJsZS0yNGhcIiwgaGFuZGxlU3RhYmxlMjRoKTtcblxuICAvLyBPcmRlcnMgcm91dGVzIChuZXcgQVBJKVxuICBhcHAuZ2V0KFwiL2FwaS9vcmRlcnNcIiwgaGFuZGxlTGlzdE9yZGVycyk7XG4gIGFwcC5wb3N0KFwiL2FwaS9vcmRlcnNcIiwgaGFuZGxlQ3JlYXRlT3JkZXIpO1xuICBhcHAuZ2V0KFwiL2FwaS9vcmRlcnMvOm9yZGVySWRcIiwgaGFuZGxlR2V0T3JkZXIpO1xuICBhcHAucHV0KFwiL2FwaS9vcmRlcnMvOm9yZGVySWRcIiwgaGFuZGxlVXBkYXRlT3JkZXIpO1xuICBhcHAuZGVsZXRlKFwiL2FwaS9vcmRlcnMvOm9yZGVySWRcIiwgaGFuZGxlRGVsZXRlT3JkZXIpO1xuXG4gIC8vIFAyUCBPcmRlcnMgcm91dGVzIChsZWdhY3kgQVBJKVxuICBhcHAuZ2V0KFwiL2FwaS9wMnAvb3JkZXJzXCIsIGhhbmRsZUxpc3RQMlBPcmRlcnMpO1xuICBhcHAucG9zdChcIi9hcGkvcDJwL29yZGVyc1wiLCBoYW5kbGVDcmVhdGVQMlBPcmRlcik7XG4gIGFwcC5nZXQoXCIvYXBpL3AycC9vcmRlcnMvOm9yZGVySWRcIiwgaGFuZGxlR2V0UDJQT3JkZXIpO1xuICBhcHAucHV0KFwiL2FwaS9wMnAvb3JkZXJzLzpvcmRlcklkXCIsIGhhbmRsZVVwZGF0ZVAyUE9yZGVyKTtcbiAgYXBwLmRlbGV0ZShcIi9hcGkvcDJwL29yZGVycy86b3JkZXJJZFwiLCBoYW5kbGVEZWxldGVQMlBPcmRlcik7XG5cbiAgLy8gVHJhZGUgUm9vbXMgcm91dGVzXG4gIGFwcC5nZXQoXCIvYXBpL3AycC9yb29tc1wiLCBoYW5kbGVMaXN0VHJhZGVSb29tcyk7XG4gIGFwcC5wb3N0KFwiL2FwaS9wMnAvcm9vbXNcIiwgaGFuZGxlQ3JlYXRlVHJhZGVSb29tKTtcbiAgYXBwLmdldChcIi9hcGkvcDJwL3Jvb21zLzpyb29tSWRcIiwgaGFuZGxlR2V0VHJhZGVSb29tKTtcbiAgYXBwLnB1dChcIi9hcGkvcDJwL3Jvb21zLzpyb29tSWRcIiwgaGFuZGxlVXBkYXRlVHJhZGVSb29tKTtcblxuICAvLyBUcmFkZSBNZXNzYWdlcyByb3V0ZXNcbiAgYXBwLmdldChcIi9hcGkvcDJwL3Jvb21zLzpyb29tSWQvbWVzc2FnZXNcIiwgaGFuZGxlTGlzdFRyYWRlTWVzc2FnZXMpO1xuICBhcHAucG9zdChcIi9hcGkvcDJwL3Jvb21zLzpyb29tSWQvbWVzc2FnZXNcIiwgaGFuZGxlQWRkVHJhZGVNZXNzYWdlKTtcblxuICAvLyBTUEwtTUVUQSBzdWJtaXRcbiAgYXBwLnBvc3QoXCIvYXBpL3NwbC1tZXRhL3N1Ym1pdFwiLCBoYW5kbGVTdWJtaXRTcGxNZXRhKTtcblxuICAvLyBIZWFsdGggY2hlY2tcbiAgYXBwLmdldChcIi9oZWFsdGhcIiwgKHJlcSwgcmVzKSA9PiB7XG4gICAgcmVzLmpzb24oeyBzdGF0dXM6IFwib2tcIiwgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkgfSk7XG4gIH0pO1xuXG4gIC8vIDQwNCBoYW5kbGVyXG4gIGFwcC51c2UoKHJlcSwgcmVzKSA9PiB7XG4gICAgcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJBUEkgZW5kcG9pbnQgbm90IGZvdW5kXCIsIHBhdGg6IHJlcS5wYXRoIH0pO1xuICB9KTtcblxuICByZXR1cm4gYXBwO1xufVxuXG4vLyBDbG91ZGZsYXJlIFdvcmtlcnMgY29tcGF0aWJpbGl0eSBleHBvcnRcbmV4cG9ydCBkZWZhdWx0IHtcbiAgYXN5bmMgZmV0Y2gocmVxOiBSZXF1ZXN0KTogUHJvbWlzZTxSZXNwb25zZT4ge1xuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwocmVxLnVybCk7XG5cbiAgICBpZiAodXJsLnBhdGhuYW1lLnN0YXJ0c1dpdGgoXCIvYXBpL3NvbGFuYS1ycGNcIikpIHtcbiAgICAgIHJldHVybiBhd2FpdCBoYW5kbGVTb2xhbmFScGMocmVxIGFzIGFueSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShcIldhbGxldCBiYWNrZW5kIGFjdGl2ZVwiLCB7IHN0YXR1czogMjAwIH0pO1xuICB9LFxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcC9jb2RlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL2NvZGUvdml0ZS5jb25maWcubWpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS92aXRlLmNvbmZpZy5tanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tIFwidXJsXCI7XG5pbXBvcnQgeyBXZWJTb2NrZXRTZXJ2ZXIgfSBmcm9tIFwid3NcIjtcblxuY29uc3QgX19kaXJuYW1lID0gcGF0aC5kaXJuYW1lKGZpbGVVUkxUb1BhdGgobmV3IFVSTChpbXBvcnQubWV0YS51cmwpKSk7XG5cbmxldCBhcGlTZXJ2ZXIgPSBudWxsO1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGJhc2U6IFwiLi9cIixcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAge1xuICAgICAgbmFtZTogXCJleHByZXNzLXNlcnZlclwiLFxuICAgICAgYXBwbHk6IFwic2VydmVcIixcbiAgICAgIGFzeW5jIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgICAgLy8gTG9hZCBhbmQgaW5pdGlhbGl6ZSB0aGUgRXhwcmVzcyBzZXJ2ZXJcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB7IGNyZWF0ZVNlcnZlcjogY3JlYXRlRXhwcmVzc1NlcnZlciB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICAgXCIuL3NlcnZlci9pbmRleC50c1wiXG4gICAgICAgICAgKTtcbiAgICAgICAgICBhcGlTZXJ2ZXIgPSBhd2FpdCBjcmVhdGVFeHByZXNzU2VydmVyKCk7XG4gICAgICAgICAgY29uc29sZS5sb2coXCJbVml0ZV0gXHUyNzA1IEV4cHJlc3Mgc2VydmVyIGluaXRpYWxpemVkXCIpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKFwiW1ZpdGVdIFx1Mjc0QyBGYWlsZWQgdG8gaW5pdGlhbGl6ZSBFeHByZXNzOlwiLCBlcnIpO1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlZ2lzdGVyIG1pZGRsZXdhcmUgQkVGT1JFIG90aGVyIG1pZGRsZXdhcmVcbiAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICAgICAgICAvLyBPbmx5IGhhbmRsZSAvYXBpIGFuZCAvaGVhbHRoIHJlcXVlc3RzIHdpdGggdGhlIEV4cHJlc3MgYXBwXG4gICAgICAgICAgaWYgKHJlcS51cmwuc3RhcnRzV2l0aChcIi9hcGlcIikgfHwgcmVxLnVybCA9PT0gXCIvaGVhbHRoXCIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgICBgW1ZpdGUgTWlkZGxld2FyZV0gUm91dGluZyAke3JlcS5tZXRob2R9ICR7cmVxLnVybH0gdG8gRXhwcmVzc2AsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIGFwaVNlcnZlcihyZXEsIHJlcywgbmV4dCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gTGlnaHR3ZWlnaHQgaW4tbWVtb3J5IFdlYlNvY2tldCByb29tcyBhdCAvd3MvOnJvb21JZCBmb3IgZGV2XG4gICAgICAgIGNvbnN0IHdzcyA9IG5ldyBXZWJTb2NrZXRTZXJ2ZXIoeyBub1NlcnZlcjogdHJ1ZSB9KTtcbiAgICAgICAgY29uc3Qgcm9vbXMgPSBuZXcgTWFwKCk7IC8vIHJvb21JZCAtPiBTZXQ8V2ViU29ja2V0PlxuXG4gICAgICAgIHNlcnZlci5odHRwU2VydmVyPy5vbihcInVwZ3JhZGVcIiwgKHJlcXVlc3QsIHNvY2tldCwgaGVhZCkgPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB1cmwgPSByZXF1ZXN0LnVybCB8fCBcIlwiO1xuICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSB1cmwubWF0Y2goL15cXC93c1xcLyguKykkLyk7XG4gICAgICAgICAgICBpZiAoIW1hdGNoKSByZXR1cm47IC8vIG5vdCBvdXIgV1Mgcm91dGVcblxuICAgICAgICAgICAgd3NzLmhhbmRsZVVwZ3JhZGUocmVxdWVzdCwgc29ja2V0LCBoZWFkLCAod3MpID0+IHtcbiAgICAgICAgICAgICAgY29uc3Qgcm9vbUlkID0gZGVjb2RlVVJJQ29tcG9uZW50KG1hdGNoWzFdKTtcbiAgICAgICAgICAgICAgaWYgKCFyb29tcy5oYXMocm9vbUlkKSkgcm9vbXMuc2V0KHJvb21JZCwgbmV3IFNldCgpKTtcbiAgICAgICAgICAgICAgY29uc3Qgc2V0ID0gcm9vbXMuZ2V0KHJvb21JZCk7XG4gICAgICAgICAgICAgIHNldC5hZGQod3MpO1xuXG4gICAgICAgICAgICAgIHdzLm9uKFwibWVzc2FnZVwiLCAoZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBtc2c7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIG1zZyA9IEpTT04ucGFyc2UoZGF0YS50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG1zZyAmJiBtc2cudHlwZSA9PT0gXCJjaGF0XCIpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIGtpbmQ6IFwiY2hhdFwiLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgICAgaWQ6IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpLFxuICAgICAgICAgICAgICAgICAgICAgIHRleHQ6IFN0cmluZyhtc2cudGV4dCB8fCBcIlwiKSxcbiAgICAgICAgICAgICAgICAgICAgICBhdDogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBjbGllbnQgb2Ygc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgY2xpZW50LnNlbmQocGF5bG9hZCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1zZyAmJiBtc2cua2luZCA9PT0gXCJub3RpZmljYXRpb25cIikge1xuICAgICAgICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAga2luZDogXCJub3RpZmljYXRpb25cIixcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogbXNnLmRhdGEsXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY2xpZW50IG9mIHNldCkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgIGNsaWVudC5zZW5kKHBheWxvYWQpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtc2cgJiYgbXNnLnR5cGUgPT09IFwicGluZ1wiKSB7XG4gICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB3cy5zZW5kKEpTT04uc3RyaW5naWZ5KHsga2luZDogXCJwb25nXCIsIHRzOiBEYXRlLm5vdygpIH0pKTtcbiAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgIHdzLm9uKFwiY2xvc2VcIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHNldC5kZWxldGUod3MpO1xuICAgICAgICAgICAgICAgIGlmIChzZXQuc2l6ZSA9PT0gMCkgcm9vbXMuZGVsZXRlKHJvb21JZCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gaWdub3JlIHdzIGVycm9yc1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gRG9uJ3QgcmV0dXJuIGFueXRoaW5nIC0gbWlkZGxld2FyZSBpcyBhbHJlYWR5IHJlZ2lzdGVyZWRcbiAgICAgIH0sXG4gICAgfSxcbiAgXSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6IFwiZGlzdC9zcGFcIixcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgfSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJjbGllbnRcIiksXG4gICAgICBcIkBzaGFyZWRcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJzaGFyZWRcIiksXG4gICAgICBcIkB1dGlsc1wiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcInV0aWxzXCIpLFxuICAgIH0sXG4g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QUFLLEtBQUssVUFBVSxFQUFFLE1BQU0sUUFBUSxJQUFJLEtBQUssSUFBSSxFQUFFLENBQUMsQ0FBQztBQUFBLGtCQUMxRCxRQUFRO0FBQUEsa0JBQUM7QUFBQSxnQkFDWDtBQUFBLGNBQ0YsQ0FBQztBQUVELGlCQUFHLEdBQUcsU0FBUyxNQUFNO0FBQ25CLG9CQUFJLE9BQU8sRUFBRTtBQUNiLG9CQUFJLElBQUksU0FBUyxFQUFHLENBQUFBLE9BQU0sT0FBTyxNQUFNO0FBQUEsY0FDekMsQ0FBQztBQUFBLFlBQ0gsQ0FBQztBQUFBLFVBQ0gsU0FBUyxHQUFHO0FBQUEsVUFFWjtBQUFBLFFBQ0YsQ0FBQztBQUFBLE1BR0g7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsYUFBYTtBQUFBLEVBQ2Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLFdBQVcsUUFBUTtBQUFBLE1BQ3JDLFdBQVcsS0FBSyxRQUFRLFdBQVcsUUFBUTtBQUFBLE1BQzNDLFVBQVUsS0FBSyxRQUFRLFdBQVcsT0FBTztBQUFBLElBQzNDO0FBQUEsRUFDRjtBQUNGOyIsCiAgIm5hbWVzIjogWyJwYXRoIiwgImN1cnJlbnRFbmRwb2ludEluZGV4IiwgInBhdGgiLCAiZ2VuZXJhdGVJZCIsICJyb29tcyJdCn0K
