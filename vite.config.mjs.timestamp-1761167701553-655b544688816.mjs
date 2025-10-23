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
  const response = await fetch(
    "https://solana-mainnet.g.alchemy.com/v2/3Z99FYWB1tFEBqYSyV60t-x7FsFCSEjX",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
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
  const response = await fetch(
    "https://solana-mainnet.g.alchemy.com/v2/3Z99FYWB1tFEBqYSyV60t-x7FsFCSEjX",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
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

// server/routes/fixorium-tokens.ts
async function handleFixoriumTokens(req, res) {
  try {
    res.json({
      success: true,
      tokens: FIXORIUM_TOKENS
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch Fixorium tokens",
      message: error?.message
    });
  }
}
var FIXORIUM_TOKENS;
var init_fixorium_tokens = __esm({
  "server/routes/fixorium-tokens.ts"() {
    FIXORIUM_TOKENS = [
      {
        mint: "So11111111111111111111111111111111111111112",
        symbol: "SOL",
        name: "Solana",
        decimals: 9,
        logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
        balance: 0,
        price: 190,
        priceChange24h: 5.2
      }
    ];
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
  app.get("/api/fixorium-tokens", handleFixoriumTokens);
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
    init_fixorium_tokens();
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic2VydmVyL3JvdXRlcy9zb2xhbmEtcHJveHkudHMiLCAic2VydmVyL3JvdXRlcy9zb2xhbmEtc2VuZC50cyIsICJzZXJ2ZXIvcm91dGVzL3NvbGFuYS1zaW11bGF0ZS50cyIsICJzZXJ2ZXIvcm91dGVzL3dhbGxldC1iYWxhbmNlLnRzIiwgInNlcnZlci9yb3V0ZXMvZXhjaGFuZ2UtcmF0ZS50cyIsICJzZXJ2ZXIvcm91dGVzL2RleHNjcmVlbmVyLXByb3h5LnRzIiwgInNlcnZlci9yb3V0ZXMvc3BsLW1ldGEudHMiLCAic2VydmVyL3JvdXRlcy9qdXBpdGVyLXByb3h5LnRzIiwgInNlcnZlci9yb3V0ZXMvZm9yZXgtcmF0ZS50cyIsICJzZXJ2ZXIvcm91dGVzL3N0YWJsZS0yNGgudHMiLCAic2VydmVyL3JvdXRlcy9wMnAtb3JkZXJzLnRzIiwgInNlcnZlci9yb3V0ZXMvb3JkZXJzLnRzIiwgInNlcnZlci9yb3V0ZXMvZml4b3JpdW0tdG9rZW5zLnRzIiwgInNlcnZlci9pbmRleC50cyIsICJ2aXRlLmNvbmZpZy5tanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc29sYW5hLXByb3h5LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL3NvbGFuYS1wcm94eS50c1wiO2V4cG9ydCBhc3luYyBmdW5jdGlvbiBoYW5kbGVTb2xhbmFScGMocmVxOiBSZXF1ZXN0KTogUHJvbWlzZTxSZXNwb25zZT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXEuanNvbigpO1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goXG4gICAgICBcImh0dHBzOi8vc29sYW5hLW1haW5uZXQuZy5hbGNoZW15LmNvbS92Mi8zWjk5RllXQjF0RkVCcVlTeVY2MHQteDdGc0ZDU0VqWFwiLFxuICAgICAge1xuICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuICAgICAgfVxuICAgICk7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKGRhdGEsIHtcbiAgICAgIGhlYWRlcnM6IHsgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSxcbiAgICAgIHN0YXR1czogcmVzcG9uc2Uuc3RhdHVzLFxuICAgIH0pO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFxuICAgICAgSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogZS5tZXNzYWdlIHx8IFwiUlBDIFByb3h5IGZhaWxlZFwiIH0pLFxuICAgICAgeyBzdGF0dXM6IDUwMCB9XG4gICAgKTtcbiAgfVxufVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc29sYW5hLXNlbmQudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc29sYW5hLXNlbmQudHNcIjtleHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlU29sYW5hU2VuZChyYXdUeDogc3RyaW5nKSB7XG4gIGNvbnN0IGJvZHkgPSB7XG4gICAganNvbnJwYzogXCIyLjBcIixcbiAgICBpZDogMSxcbiAgICBtZXRob2Q6IFwic2VuZFRyYW5zYWN0aW9uXCIsXG4gICAgcGFyYW1zOiBbcmF3VHgsIHsgc2tpcFByZWZsaWdodDogZmFsc2UsIHByZWZsaWdodENvbW1pdG1lbnQ6IFwiY29uZmlybWVkXCIgfV0sXG4gIH07XG5cbiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChcbiAgICBcImh0dHBzOi8vc29sYW5hLW1haW5uZXQuZy5hbGNoZW15LmNvbS92Mi8zWjk5RllXQjF0RkVCcVlTeVY2MHQteDdGc0ZDU0VqWFwiLFxuICAgIHtcbiAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KSxcbiAgICB9XG4gICk7XG5cbiAgcmV0dXJuIGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL3NvbGFuYS1zaW11bGF0ZS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9zb2xhbmEtc2ltdWxhdGUudHNcIjtleHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlU29sYW5hU2ltdWxhdGUodHhCYXNlNjQ6IHN0cmluZykge1xuICBjb25zdCBib2R5ID0ge1xuICAgIGpzb25ycGM6IFwiMi4wXCIsXG4gICAgaWQ6IDEsXG4gICAgbWV0aG9kOiBcInNpbXVsYXRlVHJhbnNhY3Rpb25cIixcbiAgICBwYXJhbXM6IFt0eEJhc2U2NCwgeyBlbmNvZGluZzogXCJiYXNlNjRcIiwgY29tbWl0bWVudDogXCJwcm9jZXNzZWRcIiB9XSxcbiAgfTtcblxuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKFxuICAgIFwiaHR0cHM6Ly9zb2xhbmEtbWFpbm5ldC5nLmFsY2hlbXkuY29tL3YyLzNaOTlGWVdCMXRGRUJxWVN5VjYwdC14N0ZzRkNTRWpYXCIsXG4gICAge1xuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgIGhlYWRlcnM6IHsgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuICAgIH0sXG4gICk7XG5cbiAgcmV0dXJuIGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL3dhbGxldC1iYWxhbmNlLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL3dhbGxldC1iYWxhbmNlLnRzXCI7aW1wb3J0IHsgUmVxdWVzdEhhbmRsZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5leHBvcnQgY29uc3QgaGFuZGxlV2FsbGV0QmFsYW5jZTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHB1YmxpY0tleSB9ID0gcmVxLnF1ZXJ5O1xuXG4gICAgaWYgKCFwdWJsaWNLZXkgfHwgdHlwZW9mIHB1YmxpY0tleSAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IFwiTWlzc2luZyBvciBpbnZhbGlkICdwdWJsaWNLZXknIHBhcmFtZXRlclwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgYm9keSA9IHtcbiAgICAgIGpzb25ycGM6IFwiMi4wXCIsXG4gICAgICBpZDogMSxcbiAgICAgIG1ldGhvZDogXCJnZXRCYWxhbmNlXCIsXG4gICAgICBwYXJhbXM6IFtwdWJsaWNLZXldLFxuICAgIH07XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKFxuICAgICAgXCJodHRwczovL3NvbGFuYS1tYWlubmV0LmcuYWxjaGVteS5jb20vdjIvM1o5OUZZV0IxdEZFQnFZU3lWNjB0LXg3RnNGQ1NFalhcIixcbiAgICAgIHtcbiAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KSxcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG5cbiAgICBpZiAoZGF0YS5lcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihcIlNvbGFuYSBSUEMgZXJyb3I6XCIsIGRhdGEuZXJyb3IpO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IGRhdGEuZXJyb3IubWVzc2FnZSB8fCBcIkZhaWxlZCB0byBmZXRjaCBiYWxhbmNlXCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBiYWxhbmNlTGFtcG9ydHMgPSBkYXRhLnJlc3VsdDtcbiAgICBjb25zdCBiYWxhbmNlU09MID0gYmFsYW5jZUxhbXBvcnRzIC8gMV8wMDBfMDAwXzAwMDtcblxuICAgIHJlcy5qc29uKHtcbiAgICAgIHB1YmxpY0tleSxcbiAgICAgIGJhbGFuY2U6IGJhbGFuY2VTT0wsXG4gICAgICBiYWxhbmNlTGFtcG9ydHMsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIldhbGxldCBiYWxhbmNlIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJJbnRlcm5hbCBzZXJ2ZXIgZXJyb3JcIixcbiAgICB9KTtcbiAgfVxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2V4Y2hhbmdlLXJhdGUudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvZXhjaGFuZ2UtcmF0ZS50c1wiO2ltcG9ydCB7IFJlcXVlc3RIYW5kbGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuLy8gVG9rZW4gbWludCBhZGRyZXNzZXMgZm9yIFNvbGFuYSBtYWlubmV0IChpbXBvcnRlZCBmcm9tIHNoYXJlZCBjb25zdGFudHMpXG5jb25zdCBUT0tFTl9NSU5UUyA9IHtcbiAgU09MOiBcIlNvMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTJcIixcbiAgVVNEQzogXCJFUGpGV2RkNUF1ZnFTU3FlTTJxTjF4enliYXBDOEc0d0VHR2tad3lURHQxdlwiLFxuICBVU0RUOiBcIkVzOXZNRnJ6YUNFUm1KZnJGNEgyRllENEtDb05rWTExTWNDZThCZW5FbnNcIixcbiAgRklYRVJDT0lOOiBcIkg0cUtuOEZNRmhhOGpKdWo4eE1yeU1xUmhIM2g3R2pMdXh3N1RWaXhwdW1wXCIsXG4gIExPQ0tFUjogXCJFTjFuWXJXNjM3NXpNUFVrcGtHeUdTRVhXOFdtQXFZdTR5aGY2eG5HcHVtcFwiLFxufSBhcyBjb25zdDtcblxuY29uc3QgRkFMTEJBQ0tfUkFURVM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gIEZJWEVSQ09JTjogMC4wMDUsIC8vICQwLjAwNSBwZXIgRklYRVJDT0lOXG4gIFNPTDogMTgwLCAvLyAkMTgwIHBlciBTT0xcbiAgVVNEQzogMS4wLCAvLyAkMSBVU0RDXG4gIFVTRFQ6IDEuMCwgLy8gJDEgVVNEVFxuICBMT0NLRVI6IDAuMSwgLy8gJDAuMSBwZXIgTE9DS0VSXG59O1xuXG5jb25zdCBQS1JfUEVSX1VTRCA9IDI4MDsgLy8gQXBwcm94aW1hdGUgY29udmVyc2lvbiByYXRlXG5jb25zdCBNQVJLVVAgPSAxLjA0MjU7IC8vIDQuMjUlIG1hcmt1cFxuXG5pbnRlcmZhY2UgRGV4c2NyZWVuZXJSZXNwb25zZSB7XG4gIHBhaXJzOiBBcnJheTx7XG4gICAgYmFzZVRva2VuOiB7IGFkZHJlc3M6IHN0cmluZyB9O1xuICAgIHByaWNlVXNkPzogc3RyaW5nO1xuICB9Pjtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZmV0Y2hUb2tlblByaWNlRnJvbURleFNjcmVlbmVyKFxuICBtaW50OiBzdHJpbmcsXG4pOiBQcm9taXNlPG51bWJlciB8IG51bGw+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly9hcGkuZGV4c2NyZWVuZXIuY29tL2xhdGVzdC9kZXgvdG9rZW5zLyR7bWludH1gO1xuICAgIGNvbnNvbGUubG9nKGBbRGV4U2NyZWVuZXJdIEZldGNoaW5nIHByaWNlIGZvciAke21pbnR9IGZyb206ICR7dXJsfWApO1xuXG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBjb25zdCB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgODAwMCk7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKGNvbXBhdGlibGU7IFNvbGFuYVdhbGxldC8xLjApXCIsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICBgW0RleFNjcmVlbmVyXSBcdTI3NEMgQVBJIHJldHVybmVkICR7cmVzcG9uc2Uuc3RhdHVzfSBmb3IgbWludCAke21pbnR9YCxcbiAgICAgICk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBkYXRhID0gKGF3YWl0IHJlc3BvbnNlLmpzb24oKSkgYXMgRGV4c2NyZWVuZXJSZXNwb25zZTtcbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbRGV4U2NyZWVuZXJdIFJlc3BvbnNlIHJlY2VpdmVkIGZvciAke21pbnR9OmAsXG4gICAgICBKU09OLnN0cmluZ2lmeShkYXRhKS5zdWJzdHJpbmcoMCwgMjAwKSxcbiAgICApO1xuXG4gICAgaWYgKGRhdGEucGFpcnMgJiYgZGF0YS5wYWlycy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBwcmljZVVzZCA9IGRhdGEucGFpcnNbMF0ucHJpY2VVc2Q7XG4gICAgICBpZiAocHJpY2VVc2QpIHtcbiAgICAgICAgY29uc3QgcHJpY2UgPSBwYXJzZUZsb2F0KHByaWNlVXNkKTtcbiAgICAgICAgY29uc29sZS5sb2coYFtEZXhTY3JlZW5lcl0gXHUyNzA1IEdvdCBwcmljZSBmb3IgJHttaW50fTogJCR7cHJpY2V9YCk7XG4gICAgICAgIHJldHVybiBwcmljZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zb2xlLndhcm4oYFtEZXhTY3JlZW5lcl0gTm8gcGFpcnMgZm91bmQgaW4gcmVzcG9uc2UgZm9yICR7bWludH1gKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgYFtEZXhTY3JlZW5lcl0gXHUyNzRDIEZhaWxlZCB0byBmZXRjaCAke21pbnR9OmAsXG4gICAgICBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgaGFuZGxlRXhjaGFuZ2VSYXRlOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHRva2VuID0gKHJlcS5xdWVyeS50b2tlbiBhcyBzdHJpbmcpIHx8IFwiRklYRVJDT0lOXCI7XG5cbiAgICBsZXQgcHJpY2VVc2Q6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gICAgLy8gRmV0Y2ggcHJpY2UgZnJvbSBEZXhTY3JlZW5lciBiYXNlZCBvbiB0b2tlblxuICAgIGlmICh0b2tlbiA9PT0gXCJGSVhFUkNPSU5cIikge1xuICAgICAgcHJpY2VVc2QgPSBhd2FpdCBmZXRjaFRva2VuUHJpY2VGcm9tRGV4U2NyZWVuZXIoVE9LRU5fTUlOVFMuRklYRVJDT0lOKTtcbiAgICB9IGVsc2UgaWYgKHRva2VuID09PSBcIlNPTFwiKSB7XG4gICAgICBwcmljZVVzZCA9IGF3YWl0IGZldGNoVG9rZW5QcmljZUZyb21EZXhTY3JlZW5lcihUT0tFTl9NSU5UUy5TT0wpO1xuICAgIH0gZWxzZSBpZiAodG9rZW4gPT09IFwiVVNEQ1wiIHx8IHRva2VuID09PSBcIlVTRFRcIikge1xuICAgICAgLy8gU3RhYmxlY29pbnMgYXJlIGFsd2F5cyB+MSBVU0RcbiAgICAgIHByaWNlVXNkID0gMS4wO1xuICAgIH0gZWxzZSBpZiAodG9rZW4gPT09IFwiTE9DS0VSXCIpIHtcbiAgICAgIHByaWNlVXNkID0gYXdhaXQgZmV0Y2hUb2tlblByaWNlRnJvbURleFNjcmVlbmVyKFRPS0VOX01JTlRTLkxPQ0tFUik7XG4gICAgfVxuXG4gICAgLy8gRmFsbCBiYWNrIHRvIGhhcmRjb2RlZCByYXRlcyBpZiBEZXhTY3JlZW5lciBmZXRjaCBmYWlscyBvciBwcmljZSBpcyBpbnZhbGlkXG4gICAgaWYgKHByaWNlVXNkID09PSBudWxsIHx8IHByaWNlVXNkIDw9IDApIHtcbiAgICAgIHByaWNlVXNkID0gRkFMTEJBQ0tfUkFURVNbdG9rZW5dIHx8IEZBTExCQUNLX1JBVEVTLkZJWEVSQ09JTjtcbiAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICBgW0V4Y2hhbmdlUmF0ZV0gVXNpbmcgZmFsbGJhY2sgcmF0ZSBmb3IgJHt0b2tlbn06ICQke3ByaWNlVXNkfWAsXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgYFtFeGNoYW5nZVJhdGVdIEZldGNoZWQgJHt0b2tlbn0gcHJpY2UgZnJvbSBEZXhTY3JlZW5lcjogJCR7cHJpY2VVc2R9YCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gQ29udmVydCB0byBQS1Igd2l0aCBtYXJrdXBcbiAgICBjb25zdCByYXRlSW5QS1IgPSBwcmljZVVzZCAqIFBLUl9QRVJfVVNEICogTUFSS1VQO1xuXG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0V4Y2hhbmdlUmF0ZV0gJHt0b2tlbn06ICQke3ByaWNlVXNkLnRvRml4ZWQoNil9IFVTRCAtPiAke3JhdGVJblBLUi50b0ZpeGVkKDIpfSBQS1IgKHdpdGggJHsoTUFSS1VQIC0gMSkgKiAxMDB9JSBtYXJrdXApYCxcbiAgICApO1xuXG4gICAgcmVzLmpzb24oe1xuICAgICAgdG9rZW4sXG4gICAgICBwcmljZVVzZCxcbiAgICAgIHByaWNlSW5QS1I6IHJhdGVJblBLUixcbiAgICAgIHJhdGU6IHJhdGVJblBLUixcbiAgICAgIHBra1BlclVzZDogUEtSX1BFUl9VU0QsXG4gICAgICBtYXJrdXA6IE1BUktVUCxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiW0V4Y2hhbmdlUmF0ZV0gRXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBlcnJvcjogXCJGYWlsZWQgdG8gZmV0Y2ggZXhjaGFuZ2UgcmF0ZVwiLFxuICAgICAgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgIH0pO1xuICB9XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvZGV4c2NyZWVuZXItcHJveHkudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvZGV4c2NyZWVuZXItcHJveHkudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbmludGVyZmFjZSBEZXhzY3JlZW5lclRva2VuIHtcbiAgY2hhaW5JZDogc3RyaW5nO1xuICBkZXhJZDogc3RyaW5nO1xuICB1cmw6IHN0cmluZztcbiAgcGFpckFkZHJlc3M6IHN0cmluZztcbiAgYmFzZVRva2VuOiB7XG4gICAgYWRkcmVzczogc3RyaW5nO1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBzeW1ib2w6IHN0cmluZztcbiAgfTtcbiAgcXVvdGVUb2tlbjoge1xuICAgIGFkZHJlc3M6IHN0cmluZztcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgc3ltYm9sOiBzdHJpbmc7XG4gIH07XG4gIHByaWNlTmF0aXZlOiBzdHJpbmc7XG4gIHByaWNlVXNkPzogc3RyaW5nO1xuICB0eG5zOiB7XG4gICAgbTU6IHsgYnV5czogbnVtYmVyOyBzZWxsczogbnVtYmVyIH07XG4gICAgaDE6IHsgYnV5czogbnVtYmVyOyBzZWxsczogbnVtYmVyIH07XG4gICAgaDY6IHsgYnV5czogbnVtYmVyOyBzZWxsczogbnVtYmVyIH07XG4gICAgaDI0OiB7IGJ1eXM6IG51bWJlcjsgc2VsbHM6IG51bWJlciB9O1xuICB9O1xuICB2b2x1bWU6IHtcbiAgICBoMjQ6IG51bWJlcjtcbiAgICBoNjogbnVtYmVyO1xuICAgIGgxOiBudW1iZXI7XG4gICAgbTU6IG51bWJlcjtcbiAgfTtcbiAgcHJpY2VDaGFuZ2U6IHtcbiAgICBtNTogbnVtYmVyO1xuICAgIGgxOiBudW1iZXI7XG4gICAgaDY6IG51bWJlcjtcbiAgICBoMjQ6IG51bWJlcjtcbiAgfTtcbiAgbGlxdWlkaXR5Pzoge1xuICAgIHVzZD86IG51bWJlcjtcbiAgICBiYXNlPzogbnVtYmVyO1xuICAgIHF1b3RlPzogbnVtYmVyO1xuICB9O1xuICBmZHY/OiBudW1iZXI7XG4gIG1hcmtldENhcD86IG51bWJlcjtcbiAgaW5mbz86IHtcbiAgICBpbWFnZVVybD86IHN0cmluZztcbiAgICB3ZWJzaXRlcz86IEFycmF5PHsgbGFiZWw6IHN0cmluZzsgdXJsOiBzdHJpbmcgfT47XG4gICAgc29jaWFscz86IEFycmF5PHsgdHlwZTogc3RyaW5nOyB1cmw6IHN0cmluZyB9PjtcbiAgfTtcbn1cblxuaW50ZXJmYWNlIERleHNjcmVlbmVyUmVzcG9uc2Uge1xuICBzY2hlbWFWZXJzaW9uOiBzdHJpbmc7XG4gIHBhaXJzOiBEZXhzY3JlZW5lclRva2VuW107XG59XG5cbi8vIERleFNjcmVlbmVyIGVuZHBvaW50cyBmb3IgZmFpbG92ZXJcbmNvbnN0IERFWFNDUkVFTkVSX0VORFBPSU5UUyA9IFtcbiAgXCJodHRwczovL2FwaS5kZXhzY3JlZW5lci5jb20vbGF0ZXN0L2RleFwiLFxuICBcImh0dHBzOi8vYXBpLmRleHNjcmVlbmVyLmlvL2xhdGVzdC9kZXhcIiwgLy8gQWx0ZXJuYXRpdmUgZG9tYWluXG5dO1xuXG5jb25zdCBDQUNIRV9UVExfTVMgPSAzMF8wMDA7IC8vIDMwIHNlY29uZHNcbmNvbnN0IE1BWF9UT0tFTlNfUEVSX0JBVENIID0gMjA7XG5cbmxldCBjdXJyZW50RW5kcG9pbnRJbmRleCA9IDA7XG5jb25zdCBjYWNoZSA9IG5ldyBNYXA8XG4gIHN0cmluZyxcbiAgeyBkYXRhOiBEZXhzY3JlZW5lclJlc3BvbnNlOyBleHBpcmVzQXQ6IG51bWJlciB9XG4+KCk7XG5jb25zdCBpbmZsaWdodFJlcXVlc3RzID0gbmV3IE1hcDxzdHJpbmcsIFByb21pc2U8RGV4c2NyZWVuZXJSZXNwb25zZT4+KCk7XG5cbmNvbnN0IHRyeURleHNjcmVlbmVyRW5kcG9pbnRzID0gYXN5bmMgKFxuICBwYXRoOiBzdHJpbmcsXG4pOiBQcm9taXNlPERleHNjcmVlbmVyUmVzcG9uc2U+ID0+IHtcbiAgbGV0IGxhc3RFcnJvcjogRXJyb3IgfCBudWxsID0gbnVsbDtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IERFWFNDUkVFTkVSX0VORFBPSU5UUy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGVuZHBvaW50SW5kZXggPVxuICAgICAgKGN1cnJlbnRFbmRwb2ludEluZGV4ICsgaSkgJSBERVhTQ1JFRU5FUl9FTkRQT0lOVFMubGVuZ3RoO1xuICAgIGNvbnN0IGVuZHBvaW50ID0gREVYU0NSRUVORVJfRU5EUE9JTlRTW2VuZHBvaW50SW5kZXhdO1xuICAgIGNvbnN0IHVybCA9IGAke2VuZHBvaW50fSR7cGF0aH1gO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnNvbGUubG9nKGBUcnlpbmcgRGV4U2NyZWVuZXIgQVBJOiAke3VybH1gKTtcblxuICAgICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCAxMjAwMCk7IC8vIDEycyB0aW1lb3V0XG5cbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgIEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKGNvbXBhdGlibGU7IFNvbGFuYVdhbGxldC8xLjApXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICB9KTtcblxuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG5cbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDI5KSB7XG4gICAgICAgICAgLy8gUmF0ZSBsaW1pdGVkIC0gdHJ5IG5leHQgZW5kcG9pbnRcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFJhdGUgbGltaXRlZCBvbiAke2VuZHBvaW50fSwgdHJ5aW5nIG5leHQuLi5gKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9OiAke3Jlc3BvbnNlLnN0YXR1c1RleHR9YCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGRhdGEgPSAoYXdhaXQgcmVzcG9uc2UuanNvbigpKSBhcyBEZXhzY3JlZW5lclJlc3BvbnNlO1xuXG4gICAgICAvLyBTdWNjZXNzIC0gdXBkYXRlIGN1cnJlbnQgZW5kcG9pbnRcbiAgICAgIGN1cnJlbnRFbmRwb2ludEluZGV4ID0gZW5kcG9pbnRJbmRleDtcbiAgICAgIGNvbnNvbGUubG9nKGBEZXhTY3JlZW5lciBBUEkgY2FsbCBzdWNjZXNzZnVsIHZpYSAke2VuZHBvaW50fWApO1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnN0IGVycm9yTXNnID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgICAgY29uc29sZS53YXJuKGBEZXhTY3JlZW5lciBlbmRwb2ludCAke2VuZHBvaW50fSBmYWlsZWQ6YCwgZXJyb3JNc2cpO1xuICAgICAgbGFzdEVycm9yID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yIDogbmV3IEVycm9yKFN0cmluZyhlcnJvcikpO1xuXG4gICAgICAvLyBTbWFsbCBkZWxheSBiZWZvcmUgdHJ5aW5nIG5leHQgZW5kcG9pbnRcbiAgICAgIGlmIChpIDwgREVYU0NSRUVORVJfRU5EUE9JTlRTLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMTAwMCkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHRocm93IG5ldyBFcnJvcihcbiAgICBgQWxsIERleFNjcmVlbmVyIGVuZHBvaW50cyBmYWlsZWQuIExhc3QgZXJyb3I6ICR7bGFzdEVycm9yPy5tZXNzYWdlIHx8IFwiVW5rbm93biBlcnJvclwifWAsXG4gICk7XG59O1xuXG5jb25zdCBmZXRjaERleHNjcmVlbmVyRGF0YSA9IGFzeW5jIChcbiAgcGF0aDogc3RyaW5nLFxuKTogUHJvbWlzZTxEZXhzY3JlZW5lclJlc3BvbnNlPiA9PiB7XG4gIGNvbnN0IGNhY2hlZCA9IGNhY2hlLmdldChwYXRoKTtcbiAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblxuICBpZiAoY2FjaGVkICYmIGNhY2hlZC5leHBpcmVzQXQgPiBub3cpIHtcbiAgICByZXR1cm4gY2FjaGVkLmRhdGE7XG4gIH1cblxuICBjb25zdCBleGlzdGluZyA9IGluZmxpZ2h0UmVxdWVzdHMuZ2V0KHBhdGgpO1xuICBpZiAoZXhpc3RpbmcpIHtcbiAgICByZXR1cm4gZXhpc3Rpbmc7XG4gIH1cblxuICBjb25zdCByZXF1ZXN0ID0gKGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHRyeURleHNjcmVlbmVyRW5kcG9pbnRzKHBhdGgpO1xuICAgICAgY2FjaGUuc2V0KHBhdGgsIHsgZGF0YSwgZXhwaXJlc0F0OiBEYXRlLm5vdygpICsgQ0FDSEVfVFRMX01TIH0pO1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGluZmxpZ2h0UmVxdWVzdHMuZGVsZXRlKHBhdGgpO1xuICAgIH1cbiAgfSkoKTtcblxuICBpbmZsaWdodFJlcXVlc3RzLnNldChwYXRoLCByZXF1ZXN0KTtcbiAgcmV0dXJuIHJlcXVlc3Q7XG59O1xuXG5jb25zdCBtZXJnZVBhaXJzQnlUb2tlbiA9IChwYWlyczogRGV4c2NyZWVuZXJUb2tlbltdKTogRGV4c2NyZWVuZXJUb2tlbltdID0+IHtcbiAgY29uc3QgYnlNaW50ID0gbmV3IE1hcDxzdHJpbmcsIERleHNjcmVlbmVyVG9rZW4+KCk7XG5cbiAgcGFpcnMuZm9yRWFjaCgocGFpcikgPT4ge1xuICAgIGNvbnN0IG1pbnQgPSBwYWlyLmJhc2VUb2tlbj8uYWRkcmVzcyB8fCBwYWlyLnBhaXJBZGRyZXNzO1xuICAgIGlmICghbWludCkgcmV0dXJuO1xuXG4gICAgY29uc3QgZXhpc3RpbmcgPSBieU1pbnQuZ2V0KG1pbnQpO1xuICAgIGNvbnN0IGV4aXN0aW5nTGlxdWlkaXR5ID0gZXhpc3Rpbmc/LmxpcXVpZGl0eT8udXNkID8/IDA7XG4gICAgY29uc3QgY2FuZGlkYXRlTGlxdWlkaXR5ID0gcGFpci5saXF1aWRpdHk/LnVzZCA/PyAwO1xuXG4gICAgaWYgKCFleGlzdGluZyB8fCBjYW5kaWRhdGVMaXF1aWRpdHkgPiBleGlzdGluZ0xpcXVpZGl0eSkge1xuICAgICAgYnlNaW50LnNldChtaW50LCBwYWlyKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBBcnJheS5mcm9tKGJ5TWludC52YWx1ZXMoKSk7XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlRGV4c2NyZWVuZXJUb2tlbnM6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBtaW50cyB9ID0gcmVxLnF1ZXJ5O1xuXG4gICAgaWYgKCFtaW50cyB8fCB0eXBlb2YgbWludHMgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgIGNvbnNvbGUud2FybihgW0RleFNjcmVlbmVyXSBJbnZhbGlkIG1pbnRzIHBhcmFtZXRlcjpgLCBtaW50cyk7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oe1xuICAgICAgICBlcnJvcjpcbiAgICAgICAgICBcIk1pc3Npbmcgb3IgaW52YWxpZCAnbWludHMnIHBhcmFtZXRlci4gRXhwZWN0ZWQgY29tbWEtc2VwYXJhdGVkIHRva2VuIG1pbnRzLlwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coYFtEZXhTY3JlZW5lcl0gVG9rZW5zIHJlcXVlc3QgZm9yIG1pbnRzOiAke21pbnRzfWApO1xuXG4gICAgY29uc3QgcmF3TWludHMgPSBtaW50c1xuICAgICAgLnNwbGl0KFwiLFwiKVxuICAgICAgLm1hcCgobWludCkgPT4gbWludC50cmltKCkpXG4gICAgICAuZmlsdGVyKEJvb2xlYW4pO1xuXG4gICAgY29uc3QgdW5pcXVlTWludHMgPSBBcnJheS5mcm9tKG5ldyBTZXQocmF3TWludHMpKTtcblxuICAgIGlmICh1bmlxdWVNaW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7XG4gICAgICAgIGVycm9yOiBcIk5vIHZhbGlkIHRva2VuIG1pbnRzIHByb3ZpZGVkLlwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgYmF0Y2hlczogc3RyaW5nW11bXSA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdW5pcXVlTWludHMubGVuZ3RoOyBpICs9IE1BWF9UT0tFTlNfUEVSX0JBVENIKSB7XG4gICAgICBiYXRjaGVzLnB1c2godW5pcXVlTWludHMuc2xpY2UoaSwgaSArIE1BWF9UT0tFTlNfUEVSX0JBVENIKSk7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0czogRGV4c2NyZWVuZXJUb2tlbltdID0gW107XG4gICAgbGV0IHNjaGVtYVZlcnNpb24gPSBcIjEuMC4wXCI7XG5cbiAgICBmb3IgKGNvbnN0IGJhdGNoIG9mIGJhdGNoZXMpIHtcbiAgICAgIGNvbnN0IHBhdGggPSBgL3Rva2Vucy8ke2JhdGNoLmpvaW4oXCIsXCIpfWA7XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgZmV0Y2hEZXhzY3JlZW5lckRhdGEocGF0aCk7XG4gICAgICBpZiAoZGF0YT8uc2NoZW1hVmVyc2lvbikge1xuICAgICAgICBzY2hlbWFWZXJzaW9uID0gZGF0YS5zY2hlbWFWZXJzaW9uO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWRhdGEgfHwgIUFycmF5LmlzQXJyYXkoZGF0YS5wYWlycykpIHtcbiAgICAgICAgY29uc29sZS53YXJuKFwiSW52YWxpZCByZXNwb25zZSBmb3JtYXQgZnJvbSBEZXhTY3JlZW5lciBBUEkgYmF0Y2hcIik7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICByZXN1bHRzLnB1c2goLi4uZGF0YS5wYWlycyk7XG4gICAgfVxuXG4gICAgY29uc3Qgc29sYW5hUGFpcnMgPSBtZXJnZVBhaXJzQnlUb2tlbihyZXN1bHRzKVxuICAgICAgLmZpbHRlcigocGFpcjogRGV4c2NyZWVuZXJUb2tlbikgPT4gcGFpci5jaGFpbklkID09PSBcInNvbGFuYVwiKVxuICAgICAgLnNvcnQoKGE6IERleHNjcmVlbmVyVG9rZW4sIGI6IERleHNjcmVlbmVyVG9rZW4pID0+IHtcbiAgICAgICAgY29uc3QgYUxpcXVpZGl0eSA9IGEubGlxdWlkaXR5Py51c2QgfHwgMDtcbiAgICAgICAgY29uc3QgYkxpcXVpZGl0eSA9IGIubGlxdWlkaXR5Py51c2QgfHwgMDtcbiAgICAgICAgaWYgKGJMaXF1aWRpdHkgIT09IGFMaXF1aWRpdHkpIHJldHVybiBiTGlxdWlkaXR5IC0gYUxpcXVpZGl0eTtcblxuICAgICAgICBjb25zdCBhVm9sdW1lID0gYS52b2x1bWU/LmgyNCB8fCAwO1xuICAgICAgICBjb25zdCBiVm9sdW1lID0gYi52b2x1bWU/LmgyNCB8fCAwO1xuICAgICAgICByZXR1cm4gYlZvbHVtZSAtIGFWb2x1bWU7XG4gICAgICB9KTtcblxuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYFtEZXhTY3JlZW5lcl0gXHUyNzA1IFJlc3BvbnNlOiAke3NvbGFuYVBhaXJzLmxlbmd0aH0gU29sYW5hIHBhaXJzIGZvdW5kIGFjcm9zcyAke2JhdGNoZXMubGVuZ3RofSBiYXRjaChlcylgLFxuICAgICk7XG4gICAgcmVzLmpzb24oeyBzY2hlbWFWZXJzaW9uLCBwYWlyczogc29sYW5hUGFpcnMgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIltEZXhTY3JlZW5lcl0gXHUyNzRDIFRva2VucyBwcm94eSBlcnJvcjpcIiwge1xuICAgICAgbWludHM6IHJlcS5xdWVyeS5taW50cyxcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICBzdGFjazogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLnN0YWNrIDogdW5kZWZpbmVkLFxuICAgIH0pO1xuXG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgZXJyb3I6IHtcbiAgICAgICAgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIkludGVybmFsIGVycm9yXCIsXG4gICAgICAgIGRldGFpbHM6IFN0cmluZyhlcnJvciksXG4gICAgICB9LFxuICAgICAgc2NoZW1hVmVyc2lvbjogXCIxLjAuMFwiLFxuICAgICAgcGFpcnM6IFtdLFxuICAgIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlRGV4c2NyZWVuZXJTZWFyY2g6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBxIH0gPSByZXEucXVlcnk7XG5cbiAgICBpZiAoIXEgfHwgdHlwZW9mIHEgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7XG4gICAgICAgIGVycm9yOiBcIk1pc3Npbmcgb3IgaW52YWxpZCAncScgcGFyYW1ldGVyIGZvciBzZWFyY2ggcXVlcnkuXCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZyhgW0RleFNjcmVlbmVyXSBTZWFyY2ggcmVxdWVzdCBmb3I6ICR7cX1gKTtcblxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBmZXRjaERleHNjcmVlbmVyRGF0YShcbiAgICAgIGAvc2VhcmNoLz9xPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHEpfWAsXG4gICAgKTtcblxuICAgIC8vIEZpbHRlciBmb3IgU29sYW5hIHBhaXJzIGFuZCBsaW1pdCByZXN1bHRzXG4gICAgY29uc3Qgc29sYW5hUGFpcnMgPSAoZGF0YS5wYWlycyB8fCBbXSlcbiAgICAgIC5maWx0ZXIoKHBhaXI6IERleHNjcmVlbmVyVG9rZW4pID0+IHBhaXIuY2hhaW5JZCA9PT0gXCJzb2xhbmFcIilcbiAgICAgIC5zbGljZSgwLCAyMCk7IC8vIExpbWl0IHRvIDIwIHJlc3VsdHNcblxuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYFtEZXhTY3JlZW5lcl0gXHUyNzA1IFNlYXJjaCByZXNwb25zZTogJHtzb2xhbmFQYWlycy5sZW5ndGh9IHJlc3VsdHNgLFxuICAgICk7XG4gICAgcmVzLmpzb24oe1xuICAgICAgc2NoZW1hVmVyc2lvbjogZGF0YS5zY2hlbWFWZXJzaW9uIHx8IFwiMS4wLjBcIixcbiAgICAgIHBhaXJzOiBzb2xhbmFQYWlycyxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiW0RleFNjcmVlbmVyXSBcdTI3NEMgU2VhcmNoIHByb3h5IGVycm9yOlwiLCB7XG4gICAgICBxdWVyeTogcmVxLnF1ZXJ5LnEsXG4gICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgIH0pO1xuXG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgZXJyb3I6IHtcbiAgICAgICAgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIkludGVybmFsIGVycm9yXCIsXG4gICAgICAgIGRldGFpbHM6IFN0cmluZyhlcnJvciksXG4gICAgICB9LFxuICAgICAgc2NoZW1hVmVyc2lvbjogXCIxLjAuMFwiLFxuICAgICAgcGFpcnM6IFtdLFxuICAgIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlRGV4c2NyZWVuZXJUcmVuZGluZzogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zb2xlLmxvZyhcIltEZXhTY3JlZW5lcl0gVHJlbmRpbmcgdG9rZW5zIHJlcXVlc3RcIik7XG5cbiAgICBjb25zdCBkYXRhID0gYXdhaXQgZmV0Y2hEZXhzY3JlZW5lckRhdGEoXCIvcGFpcnMvc29sYW5hXCIpO1xuXG4gICAgLy8gR2V0IHRvcCB0cmVuZGluZyBwYWlycywgc29ydGVkIGJ5IHZvbHVtZSBhbmQgbGlxdWlkaXR5XG4gICAgY29uc3QgdHJlbmRpbmdQYWlycyA9IChkYXRhLnBhaXJzIHx8IFtdKVxuICAgICAgLmZpbHRlcihcbiAgICAgICAgKHBhaXI6IERleHNjcmVlbmVyVG9rZW4pID0+XG4gICAgICAgICAgcGFpci52b2x1bWU/LmgyNCA+IDEwMDAgJiYgLy8gTWluaW11bSB2b2x1bWUgZmlsdGVyXG4gICAgICAgICAgcGFpci5saXF1aWRpdHk/LnVzZCAmJlxuICAgICAgICAgIHBhaXIubGlxdWlkaXR5LnVzZCA+IDEwMDAwLCAvLyBNaW5pbXVtIGxpcXVpZGl0eSBmaWx0ZXJcbiAgICAgIClcbiAgICAgIC5zb3J0KChhOiBEZXhzY3JlZW5lclRva2VuLCBiOiBEZXhzY3JlZW5lclRva2VuKSA9PiB7XG4gICAgICAgIC8vIFNvcnQgYnkgMjRoIHZvbHVtZVxuICAgICAgICBjb25zdCBhVm9sdW1lID0gYS52b2x1bWU/LmgyNCB8fCAwO1xuICAgICAgICBjb25zdCBiVm9sdW1lID0gYi52b2x1bWU/LmgyNCB8fCAwO1xuICAgICAgICByZXR1cm4gYlZvbHVtZSAtIGFWb2x1bWU7XG4gICAgICB9KVxuICAgICAgLnNsaWNlKDAsIDUwKTsgLy8gVG9wIDUwIHRyZW5kaW5nXG5cbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbRGV4U2NyZWVuZXJdIFx1MjcwNSBUcmVuZGluZyByZXNwb25zZTogJHt0cmVuZGluZ1BhaXJzLmxlbmd0aH0gdHJlbmRpbmcgcGFpcnNgLFxuICAgICk7XG4gICAgcmVzLmpzb24oe1xuICAgICAgc2NoZW1hVmVyc2lvbjogZGF0YS5zY2hlbWFWZXJzaW9uIHx8IFwiMS4wLjBcIixcbiAgICAgIHBhaXJzOiB0cmVuZGluZ1BhaXJzLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJbRGV4U2NyZWVuZXJdIFx1Mjc0QyBUcmVuZGluZyBwcm94eSBlcnJvcjpcIiwge1xuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICB9KTtcblxuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiB7XG4gICAgICAgIG1lc3NhZ2U6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJJbnRlcm5hbCBlcnJvclwiLFxuICAgICAgICBkZXRhaWxzOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgfSxcbiAgICAgIHNjaGVtYVZlcnNpb246IFwiMS4wLjBcIixcbiAgICAgIHBhaXJzOiBbXSxcbiAgICB9KTtcbiAgfVxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL3NwbC1tZXRhLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL3NwbC1tZXRhLnRzXCI7aW1wb3J0IHR5cGUgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVTdWJtaXRTcGxNZXRhOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHtcbiAgICAgIG5hbWUsXG4gICAgICBzeW1ib2wsXG4gICAgICBkZXNjcmlwdGlvbixcbiAgICAgIGxvZ29VUkksXG4gICAgICB3ZWJzaXRlLFxuICAgICAgdHdpdHRlcixcbiAgICAgIHRlbGVncmFtLFxuICAgICAgZGV4cGFpcixcbiAgICAgIGxhc3RVcGRhdGVkLFxuICAgIH0gPSByZXEuYm9keSB8fCB7fTtcblxuICAgIC8vIEJhc2ljIHZhbGlkYXRpb25cbiAgICBpZiAoIW5hbWUgfHwgIXN5bWJvbCkge1xuICAgICAgcmV0dXJuIHJlc1xuICAgICAgICAuc3RhdHVzKDQwMClcbiAgICAgICAgLmpzb24oeyBlcnJvcjogXCJNaXNzaW5nIHJlcXVpcmVkIGZpZWxkczogbmFtZSwgc3ltYm9sXCIgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgcGF5bG9hZCA9IHtcbiAgICAgIG5hbWU6IFN0cmluZyhuYW1lKSxcbiAgICAgIHN5bWJvbDogU3RyaW5nKHN5bWJvbCksXG4gICAgICBkZXNjcmlwdGlvbjogU3RyaW5nKGRlc2NyaXB0aW9uIHx8IFwiXCIpLFxuICAgICAgbG9nb1VSSTogU3RyaW5nKGxvZ29VUkkgfHwgXCJcIiksXG4gICAgICB3ZWJzaXRlOiBTdHJpbmcod2Vic2l0ZSB8fCBcIlwiKSxcbiAgICAgIHR3aXR0ZXI6IFN0cmluZyh0d2l0dGVyIHx8IFwiXCIpLFxuICAgICAgdGVsZWdyYW06IFN0cmluZyh0ZWxlZ3JhbSB8fCBcIlwiKSxcbiAgICAgIGRleHBhaXI6IFN0cmluZyhkZXhwYWlyIHx8IFwiXCIpLFxuICAgICAgbGFzdFVwZGF0ZWQ6IGxhc3RVcGRhdGVkXG4gICAgICAgID8gbmV3IERhdGUobGFzdFVwZGF0ZWQpLnRvSVNPU3RyaW5nKClcbiAgICAgICAgOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICByZWNlaXZlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICBzb3VyY2U6IFwic3BsLW1ldGEtZm9ybVwiLFxuICAgIH07XG5cbiAgICAvLyBGb3Igbm93LCBqdXN0IGFja25vd2xlZGdlIHJlY2VpcHQuIEV4dGVybmFsIGRpcmVjdG9yaWVzIChTb2xzY2FuL0RleHNjcmVlbmVyKVxuICAgIC8vIHR5cGljYWxseSByZXF1aXJlIG1hbnVhbCB2ZXJpZmljYXRpb24gb3IgcGFydG5lciBBUElzLlxuICAgIC8vIFlvdSBjYW4gd2lyZSB0aGlzIHRvIGEgd2ViaG9vayBvciBzZXJ2aWNlIHdpdGggY3JlZGVudGlhbHMuXG4gICAgY29uc29sZS5sb2coXCJbU1BMLU1FVEFdIFN1Ym1pc3Npb24gcmVjZWl2ZWQ6XCIsIHBheWxvYWQpO1xuXG4gICAgcmV0dXJuIHJlcy5zdGF0dXMoMjAyKS5qc29uKHsgc3RhdHVzOiBcInF1ZXVlZFwiLCBwYXlsb2FkIH0pO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zdCBtc2cgPSBlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogU3RyaW5nKGVycik7XG4gICAgY29uc29sZS5lcnJvcihcIltTUEwtTUVUQV0gU3VibWl0IGVycm9yOlwiLCBtc2cpO1xuICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBtc2cgfSk7XG4gIH1cbn07XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9qdXBpdGVyLXByb3h5LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2p1cGl0ZXItcHJveHkudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbmludGVyZmFjZSBKdXBpdGVyUHJpY2VSZXNwb25zZSB7XG4gIGRhdGE6IFJlY29yZDxzdHJpbmcsIHsgcHJpY2U6IG51bWJlciB9Pjtcbn1cblxuLy8gSnVwaXRlciBlbmRwb2ludHNcbmNvbnN0IEpVUElURVJfUFJJQ0VfRU5EUE9JTlRTID0gW1xuICBcImh0dHBzOi8vcHJpY2UuanVwLmFnL3Y0XCIsXG4gIFwiaHR0cHM6Ly9hcGkuanVwLmFnL3ByaWNlL3YyXCIsXG5dO1xuY29uc3QgSlVQSVRFUl9TV0FQX0JBU0UgPSBcImh0dHBzOi8vbGl0ZS1hcGkuanVwLmFnL3N3YXAvdjFcIjtcblxubGV0IGN1cnJlbnRFbmRwb2ludEluZGV4ID0gMDtcblxuY29uc3QgdHJ5SnVwaXRlckVuZHBvaW50cyA9IGFzeW5jIChcbiAgcGF0aDogc3RyaW5nLFxuICBwYXJhbXM6IFVSTFNlYXJjaFBhcmFtcyxcbik6IFByb21pc2U8YW55PiA9PiB7XG4gIGxldCBsYXN0RXJyb3I6IEVycm9yIHwgbnVsbCA9IG51bGw7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBKVVBJVEVSX1BSSUNFX0VORFBPSU5UUy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGVuZHBvaW50SW5kZXggPVxuICAgICAgKGN1cnJlbnRFbmRwb2ludEluZGV4ICsgaSkgJSBKVVBJVEVSX1BSSUNFX0VORFBPSU5UUy5sZW5ndGg7XG4gICAgY29uc3QgZW5kcG9pbnQgPSBKVVBJVEVSX1BSSUNFX0VORFBPSU5UU1tlbmRwb2ludEluZGV4XTtcbiAgICBjb25zdCB1cmwgPSBgJHtlbmRwb2ludH0ke3BhdGh9PyR7cGFyYW1zLnRvU3RyaW5nKCl9YDtcblxuICAgIHRyeSB7XG4gICAgICBjb25zb2xlLmxvZyhgVHJ5aW5nIEp1cGl0ZXIgQVBJOiAke3VybH1gKTtcblxuICAgICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCA1MDAwKTtcblxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoY29tcGF0aWJsZTsgU29sYW5hV2FsbGV0LzEuMClcIixcbiAgICAgICAgfSxcbiAgICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICAgIH0pO1xuXG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcblxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MjkpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFJhdGUgbGltaXRlZCBvbiAke2VuZHBvaW50fSwgdHJ5aW5nIG5leHQuLi5gKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9OiAke3Jlc3BvbnNlLnN0YXR1c1RleHR9YCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG5cbiAgICAgIGN1cnJlbnRFbmRwb2ludEluZGV4ID0gZW5kcG9pbnRJbmRleDtcbiAgICAgIGNvbnNvbGUubG9nKGBKdXBpdGVyIEFQSSBjYWxsIHN1Y2Nlc3NmdWwgdmlhICR7ZW5kcG9pbnR9YCk7XG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc3QgZXJyb3JNc2cgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgICBjb25zb2xlLndhcm4oYEp1cGl0ZXIgZW5kcG9pbnQgJHtlbmRwb2ludH0gZmFpbGVkOmAsIGVycm9yTXNnKTtcbiAgICAgIGxhc3RFcnJvciA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvciA6IG5ldyBFcnJvcihTdHJpbmcoZXJyb3IpKTtcblxuICAgICAgaWYgKGkgPCBKVVBJVEVSX1BSSUNFX0VORFBPSU5UUy5sZW5ndGggLSAxKSB7XG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDEwMDApKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgYEFsbCBKdXBpdGVyIGVuZHBvaW50cyBmYWlsZWQuIExhc3QgZXJyb3I6ICR7bGFzdEVycm9yPy5tZXNzYWdlIHx8IFwiVW5rbm93biBlcnJvclwifWAsXG4gICk7XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlSnVwaXRlclByaWNlOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgaWRzIH0gPSByZXEucXVlcnk7XG5cbiAgICBpZiAoIWlkcyB8fCB0eXBlb2YgaWRzICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oe1xuICAgICAgICBlcnJvcjpcbiAgICAgICAgICBcIk1pc3Npbmcgb3IgaW52YWxpZCAnaWRzJyBwYXJhbWV0ZXIuIEV4cGVjdGVkIGNvbW1hLXNlcGFyYXRlZCB0b2tlbiBtaW50cy5cIixcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKGBKdXBpdGVyIHByaWNlIHJlcXVlc3QgZm9yIHRva2VuczogJHtpZHN9YCk7XG5cbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcbiAgICAgIGlkczogaWRzLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHRyeUp1cGl0ZXJFbmRwb2ludHMoXCIvcHJpY2VcIiwgcGFyYW1zKTtcblxuICAgIGlmICghZGF0YSB8fCB0eXBlb2YgZGF0YSAhPT0gXCJvYmplY3RcIikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCByZXNwb25zZSBmb3JtYXQgZnJvbSBKdXBpdGVyIEFQSVwiKTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBKdXBpdGVyIHByaWNlIHJlc3BvbnNlOiAke09iamVjdC5rZXlzKGRhdGEuZGF0YSB8fCB7fSkubGVuZ3RofSB0b2tlbnNgLFxuICAgICk7XG4gICAgcmVzLmpzb24oZGF0YSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkp1cGl0ZXIgcHJpY2UgcHJveHkgZXJyb3I6XCIsIHtcbiAgICAgIGlkczogcmVxLnF1ZXJ5LmlkcyxcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICBzdGFjazogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLnN0YWNrIDogdW5kZWZpbmVkLFxuICAgIH0pO1xuXG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgZXJyb3I6IHtcbiAgICAgICAgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIkludGVybmFsIGVycm9yXCIsXG4gICAgICAgIGRldGFpbHM6IFN0cmluZyhlcnJvciksXG4gICAgICB9LFxuICAgICAgZGF0YToge30sXG4gICAgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVKdXBpdGVyVG9rZW5zOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgdHlwZSA9IFwic3RyaWN0XCIgfSA9IHJlcS5xdWVyeSBhcyB7IHR5cGU/OiBzdHJpbmcgfTtcblxuICAgIGNvbnNvbGUubG9nKGBKdXBpdGVyIHRva2VucyByZXF1ZXN0OiAke3R5cGV9YCk7XG5cbiAgICBjb25zdCB0eXBlc1RvVHJ5ID0gW3R5cGUgfHwgXCJzdHJpY3RcIiwgXCJhbGxcIl07IC8vIGZhbGxiYWNrIHRvICdhbGwnIGlmICdzdHJpY3QnIGZhaWxzXG4gICAgY29uc3QgYmFzZUVuZHBvaW50cyA9ICh0OiBzdHJpbmcpID0+IFtcbiAgICAgIGBodHRwczovL3Rva2VuLmp1cC5hZy8ke3R9YCxcbiAgICAgIFwiaHR0cHM6Ly9jYWNoZS5qdXAuYWcvdG9rZW5zXCIsXG4gICAgXTtcblxuICAgIGNvbnN0IGZldGNoV2l0aFRpbWVvdXQgPSAodXJsOiBzdHJpbmcsIHRpbWVvdXRNczogbnVtYmVyKSA9PiB7XG4gICAgICBjb25zdCB0aW1lb3V0UHJvbWlzZSA9IG5ldyBQcm9taXNlPFJlc3BvbnNlPigocmVzb2x2ZSkgPT4ge1xuICAgICAgICBzZXRUaW1lb3V0KFxuICAgICAgICAgICgpID0+XG4gICAgICAgICAgICByZXNvbHZlKFxuICAgICAgICAgICAgICBuZXcgUmVzcG9uc2UoXCJcIiwgeyBzdGF0dXM6IDUwNCwgc3RhdHVzVGV4dDogXCJHYXRld2F5IFRpbWVvdXRcIiB9KSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgdGltZW91dE1zLFxuICAgICAgICApO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yYWNlKFtcbiAgICAgICAgZmV0Y2godXJsLCB7XG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChjb21wYXRpYmxlOyBTb2xhbmFXYWxsZXQvMS4wKVwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgICB0aW1lb3V0UHJvbWlzZSxcbiAgICAgIF0pIGFzIFByb21pc2U8UmVzcG9uc2U+O1xuICAgIH07XG5cbiAgICBsZXQgbGFzdEVycm9yOiBzdHJpbmcgPSBcIlwiO1xuXG4gICAgZm9yIChjb25zdCB0IG9mIHR5cGVzVG9UcnkpIHtcbiAgICAgIGNvbnN0IGVuZHBvaW50cyA9IGJhc2VFbmRwb2ludHModCk7XG4gICAgICBmb3IgKGxldCBhdHRlbXB0ID0gMTsgYXR0ZW1wdCA8PSAyOyBhdHRlbXB0KyspIHtcbiAgICAgICAgZm9yIChjb25zdCBlbmRwb2ludCBvZiBlbmRwb2ludHMpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaFdpdGhUaW1lb3V0KGVuZHBvaW50LCA4MDAwKTtcbiAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgICAgbGFzdEVycm9yID0gYCR7ZW5kcG9pbnR9IC0+ICR7cmVzcG9uc2Uuc3RhdHVzfSAke3Jlc3BvbnNlLnN0YXR1c1RleHR9YDtcbiAgICAgICAgICAgICAgLy8gcmV0cnkgb24gcmF0ZSBsaW1pdGluZyAvIHNlcnZlciBlcnJvcnNcbiAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDI5IHx8IHJlc3BvbnNlLnN0YXR1cyA+PSA1MDApIGNvbnRpbnVlO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgICAgICBjb25zdCBjb3VudCA9IEFycmF5LmlzQXJyYXkoZGF0YSkgPyBkYXRhLmxlbmd0aCA6IDA7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICAgYEp1cGl0ZXIgdG9rZW5zIHJlc3BvbnNlICgke3R9KSB2aWEgJHtlbmRwb2ludH06ICR7Y291bnR9IHRva2Vuc2AsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIHJlcy5qc29uKGRhdGEpO1xuICAgICAgICAgIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgICAgICAgICAgbGFzdEVycm9yID0gYCR7ZW5kcG9pbnR9IC0+ICR7ZT8ubWVzc2FnZSB8fCBTdHJpbmcoZSl9YDtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgSnVwaXRlciB0b2tlbnMgZmV0Y2ggZmFpbGVkOiAke2xhc3RFcnJvcn1gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgYXR0ZW1wdCAqIDI1MCkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXMuc3RhdHVzKDUwMikuanNvbih7XG4gICAgICBlcnJvcjoge1xuICAgICAgICBtZXNzYWdlOiBcIkFsbCBKdXBpdGVyIHRva2VuIGVuZHBvaW50cyBmYWlsZWRcIixcbiAgICAgICAgZGV0YWlsczogbGFzdEVycm9yIHx8IFwiVW5rbm93biBlcnJvclwiLFxuICAgICAgfSxcbiAgICAgIGRhdGE6IFtdLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJKdXBpdGVyIHRva2VucyBwcm94eSBlcnJvcjpcIiwge1xuICAgICAgdHlwZTogcmVxLnF1ZXJ5LnR5cGUsXG4gICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgIH0pO1xuXG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgZXJyb3I6IHtcbiAgICAgICAgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIkludGVybmFsIGVycm9yXCIsXG4gICAgICAgIGRldGFpbHM6IFN0cmluZyhlcnJvciksXG4gICAgICB9LFxuICAgICAgZGF0YTogW10sXG4gICAgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVKdXBpdGVyUXVvdGU6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBpbnB1dE1pbnQsIG91dHB1dE1pbnQsIGFtb3VudCwgc2xpcHBhZ2VCcHMsIGFzTGVnYWN5VHJhbnNhY3Rpb24gfSA9XG4gICAgICByZXEucXVlcnk7XG5cbiAgICBpZiAoXG4gICAgICAhaW5wdXRNaW50IHx8XG4gICAgICAhb3V0cHV0TWludCB8fFxuICAgICAgIWFtb3VudCB8fFxuICAgICAgdHlwZW9mIGlucHV0TWludCAhPT0gXCJzdHJpbmdcIiB8fFxuICAgICAgdHlwZW9mIG91dHB1dE1pbnQgIT09IFwic3RyaW5nXCIgfHxcbiAgICAgIHR5cGVvZiBhbW91bnQgIT09IFwic3RyaW5nXCJcbiAgICApIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7XG4gICAgICAgIGVycm9yOiBcIk1pc3NpbmcgcmVxdWlyZWQgcXVlcnkgcGFyYW1zOiBpbnB1dE1pbnQsIG91dHB1dE1pbnQsIGFtb3VudFwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7XG4gICAgICBpbnB1dE1pbnQsXG4gICAgICBvdXRwdXRNaW50LFxuICAgICAgYW1vdW50LFxuICAgICAgc2xpcHBhZ2VCcHM6IHR5cGVvZiBzbGlwcGFnZUJwcyA9PT0gXCJzdHJpbmdcIiA/IHNsaXBwYWdlQnBzIDogXCI1MFwiLFxuICAgICAgb25seURpcmVjdFJvdXRlczogXCJmYWxzZVwiLFxuICAgICAgYXNMZWdhY3lUcmFuc2FjdGlvbjpcbiAgICAgICAgdHlwZW9mIGFzTGVnYWN5VHJhbnNhY3Rpb24gPT09IFwic3RyaW5nXCIgPyBhc0xlZ2FjeVRyYW5zYWN0aW9uIDogXCJmYWxzZVwiLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXJsID0gYCR7SlVQSVRFUl9TV0FQX0JBU0V9L3F1b3RlPyR7cGFyYW1zLnRvU3RyaW5nKCl9YDtcblxuICAgIGNvbnN0IGZldGNoV2l0aFRpbWVvdXQgPSAodGltZW91dE1zOiBudW1iZXIpID0+IHtcbiAgICAgIGNvbnN0IHRpbWVvdXRQcm9taXNlID0gbmV3IFByb21pc2U8UmVzcG9uc2U+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgIHNldFRpbWVvdXQoXG4gICAgICAgICAgKCkgPT5cbiAgICAgICAgICAgIHJlc29sdmUoXG4gICAgICAgICAgICAgIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogNTA0LCBzdGF0dXNUZXh0OiBcIkdhdGV3YXkgVGltZW91dFwiIH0pLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICB0aW1lb3V0TXMsXG4gICAgICAgICk7XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGZldGNoUHJvbWlzZSA9IGZldGNoKHVybCwge1xuICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICBBY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChjb21wYXRpYmxlOyBTb2xhbmFXYWxsZXQvMS4wKVwiLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yYWNlKFtmZXRjaFByb21pc2UsIHRpbWVvdXRQcm9taXNlXSkgYXMgUHJvbWlzZTxSZXNwb25zZT47XG4gICAgfTtcblxuICAgIC8vIFRyeSB1cCB0byAzIGF0dGVtcHRzIHdpdGggc21hbGwgYmFja29mZiBvbiA1eHgvNDI5XG4gICAgbGV0IGxhc3RTdGF0dXMgPSAwO1xuICAgIGxldCBsYXN0VGV4dCA9IFwiXCI7XG4gICAgZm9yIChsZXQgYXR0ZW1wdCA9IDE7IGF0dGVtcHQgPD0gMjsgYXR0ZW1wdCsrKSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoV2l0aFRpbWVvdXQoODAwMCk7XG4gICAgICBsYXN0U3RhdHVzID0gcmVzcG9uc2Uuc3RhdHVzO1xuICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIHJldHVybiByZXMuanNvbihkYXRhKTtcbiAgICAgIH1cbiAgICAgIGxhc3RUZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpLmNhdGNoKCgpID0+IFwiXCIpO1xuXG4gICAgICAvLyBJZiA0MDQgb3IgNDAwLCBsaWtlbHkgbWVhbnMgbm8gcm91dGUgZXhpc3RzIGZvciB0aGlzIHBhaXJcbiAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQwNCB8fCByZXNwb25zZS5zdGF0dXMgPT09IDQwMCkge1xuICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgYEp1cGl0ZXIgcXVvdGUgcmV0dXJuZWQgJHtyZXNwb25zZS5zdGF0dXN9IC0gbGlrZWx5IG5vIHJvdXRlIGZvciB0aGlzIHBhaXJgLFxuICAgICAgICAgIHsgaW5wdXRNaW50OiByZXEucXVlcnkuaW5wdXRNaW50LCBvdXRwdXRNaW50OiByZXEucXVlcnkub3V0cHV0TWludCB9LFxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyhyZXNwb25zZS5zdGF0dXMpLmpzb24oe1xuICAgICAgICAgIGVycm9yOiBgTm8gc3dhcCByb3V0ZSBmb3VuZCBmb3IgdGhpcyBwYWlyYCxcbiAgICAgICAgICBkZXRhaWxzOiBsYXN0VGV4dCxcbiAgICAgICAgICBjb2RlOiByZXNwb25zZS5zdGF0dXMgPT09IDQwNCA/IFwiTk9fUk9VVEVfRk9VTkRcIiA6IFwiSU5WQUxJRF9QQVJBTVNcIixcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFJldHJ5IG9uIHJhdGUgbGltaXQgb3Igc2VydmVyIGVycm9yc1xuICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDI5IHx8IHJlc3BvbnNlLnN0YXR1cyA+PSA1MDApIHtcbiAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgIGBKdXBpdGVyIEFQSSByZXR1cm5lZCAke3Jlc3BvbnNlLnN0YXR1c30sIHJldHJ5aW5nLi4uIChhdHRlbXB0ICR7YXR0ZW1wdH0vMilgLFxuICAgICAgICApO1xuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocikgPT4gc2V0VGltZW91dChyLCBhdHRlbXB0ICogMjUwKSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcy5zdGF0dXMobGFzdFN0YXR1cyB8fCA1MDApLmpzb24oe1xuICAgICAgZXJyb3I6IGBRdW90ZSBBUEkgZXJyb3JgLFxuICAgICAgZGV0YWlsczogbGFzdFRleHQsXG4gICAgICBjb2RlOiBsYXN0U3RhdHVzID09PSA1MDQgPyBcIlRJTUVPVVRcIiA6IFwiQVBJX0VSUk9SXCIsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkp1cGl0ZXIgcXVvdGUgcHJveHkgZXJyb3I6XCIsIHtcbiAgICAgIHBhcmFtczogcmVxLnF1ZXJ5LFxuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICAgIHN0YWNrOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3Iuc3RhY2sgOiB1bmRlZmluZWQsXG4gICAgfSk7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJJbnRlcm5hbCBlcnJvclwiLFxuICAgIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlSnVwaXRlclN3YXA6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgYm9keSA9IHJlcS5ib2R5IHx8IHt9O1xuICAgIGNvbnNvbGUubG9nKFxuICAgICAgXCJoYW5kbGVKdXBpdGVyU3dhcCByZWNlaXZlZCBib2R5IGtleXM6XCIsXG4gICAgICBPYmplY3Qua2V5cyhib2R5IHx8IHt9KSxcbiAgICApO1xuXG4gICAgaWYgKCFib2R5IHx8ICFib2R5LnF1b3RlUmVzcG9uc2UgfHwgIWJvZHkudXNlclB1YmxpY0tleSkge1xuICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICBcImhhbmRsZUp1cGl0ZXJTd2FwIG1pc3NpbmcgZmllbGRzLCBib2R5OlwiLFxuICAgICAgICBKU09OLnN0cmluZ2lmeShib2R5KSxcbiAgICAgICk7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oe1xuICAgICAgICBlcnJvcjpcbiAgICAgICAgICBcIk1pc3NpbmcgcmVxdWlyZWQgYm9keTogeyBxdW90ZVJlc3BvbnNlLCB1c2VyUHVibGljS2V5LCAuLi5vcHRpb25zIH1cIixcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIDIwMDAwKTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7SlVQSVRFUl9TV0FQX0JBU0V9L3N3YXBgLCB7XG4gICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICBBY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKGNvbXBhdGlibGU7IFNvbGFuYVdhbGxldC8xLjApXCIsXG4gICAgICB9LFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSksXG4gICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxuICAgIH0pO1xuXG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpLmNhdGNoKCgpID0+IFwiXCIpO1xuICAgICAgcmV0dXJuIHJlc1xuICAgICAgICAuc3RhdHVzKHJlc3BvbnNlLnN0YXR1cylcbiAgICAgICAgLmpzb24oeyBlcnJvcjogYFN3YXAgZmFpbGVkOiAke3Jlc3BvbnNlLnN0YXR1c1RleHR9YCwgZGV0YWlsczogdGV4dCB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgIHJlcy5qc29uKGRhdGEpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJKdXBpdGVyIHN3YXAgcHJveHkgZXJyb3I6XCIsIHtcbiAgICAgIGJvZHk6IHJlcS5ib2R5LFxuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICAgIHN0YWNrOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3Iuc3RhY2sgOiB1bmRlZmluZWQsXG4gICAgfSk7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJJbnRlcm5hbCBlcnJvclwiLFxuICAgIH0pO1xuICB9XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvZm9yZXgtcmF0ZS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9mb3JleC1yYXRlLnRzXCI7aW1wb3J0IHsgUmVxdWVzdEhhbmRsZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5leHBvcnQgY29uc3QgaGFuZGxlRm9yZXhSYXRlOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGJhc2UgPSBTdHJpbmcocmVxLnF1ZXJ5LmJhc2UgfHwgXCJVU0RcIikudG9VcHBlckNhc2UoKTtcbiAgICBjb25zdCBzeW1ib2xzID0gU3RyaW5nKHJlcS5xdWVyeS5zeW1ib2xzIHx8IFwiUEtSXCIpLnRvVXBwZXJDYXNlKCk7XG4gICAgY29uc3QgZmlyc3RTeW1ib2wgPSBzeW1ib2xzLnNwbGl0KFwiLFwiKVswXTtcbiAgICBjb25zdCBQUk9WSURFUl9USU1FT1VUX01TID0gNTAwMDtcblxuICAgIGNvbnN0IHByb3ZpZGVyczogQXJyYXk8e1xuICAgICAgbmFtZTogc3RyaW5nO1xuICAgICAgdXJsOiBzdHJpbmc7XG4gICAgICBwYXJzZTogKGo6IGFueSkgPT4gbnVtYmVyIHwgbnVsbDtcbiAgICB9PiA9IFtcbiAgICAgIHtcbiAgICAgICAgbmFtZTogXCJleGNoYW5nZXJhdGUuaG9zdFwiLFxuICAgICAgICB1cmw6IGBodHRwczovL2FwaS5leGNoYW5nZXJhdGUuaG9zdC9sYXRlc3Q/YmFzZT0ke2VuY29kZVVSSUNvbXBvbmVudChiYXNlKX0mc3ltYm9scz0ke2VuY29kZVVSSUNvbXBvbmVudChmaXJzdFN5bWJvbCl9YCxcbiAgICAgICAgcGFyc2U6IChqKSA9PlxuICAgICAgICAgIGogJiYgai5yYXRlcyAmJiB0eXBlb2Ygai5yYXRlc1tmaXJzdFN5bWJvbF0gPT09IFwibnVtYmVyXCJcbiAgICAgICAgICAgID8gai5yYXRlc1tmaXJzdFN5bWJvbF1cbiAgICAgICAgICAgIDogbnVsbCxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6IFwiZnJhbmtmdXJ0ZXJcIixcbiAgICAgICAgdXJsOiBgaHR0cHM6Ly9hcGkuZnJhbmtmdXJ0ZXIuYXBwL2xhdGVzdD9mcm9tPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGJhc2UpfSZ0bz0ke2VuY29kZVVSSUNvbXBvbmVudChmaXJzdFN5bWJvbCl9YCxcbiAgICAgICAgcGFyc2U6IChqKSA9PlxuICAgICAgICAgIGogJiYgai5yYXRlcyAmJiB0eXBlb2Ygai5yYXRlc1tmaXJzdFN5bWJvbF0gPT09IFwibnVtYmVyXCJcbiAgICAgICAgICAgID8gai5yYXRlc1tmaXJzdFN5bWJvbF1cbiAgICAgICAgICAgIDogbnVsbCxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6IFwiZXItYXBpXCIsXG4gICAgICAgIHVybDogYGh0dHBzOi8vb3Blbi5lci1hcGkuY29tL3Y2L2xhdGVzdC8ke2VuY29kZVVSSUNvbXBvbmVudChiYXNlKX1gLFxuICAgICAgICBwYXJzZTogKGopID0+XG4gICAgICAgICAgaiAmJiBqLnJhdGVzICYmIHR5cGVvZiBqLnJhdGVzW2ZpcnN0U3ltYm9sXSA9PT0gXCJudW1iZXJcIlxuICAgICAgICAgICAgPyBqLnJhdGVzW2ZpcnN0U3ltYm9sXVxuICAgICAgICAgICAgOiBudWxsLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogXCJmYXdhemFobWVkLWNkblwiLFxuICAgICAgICB1cmw6IGBodHRwczovL2Nkbi5qc2RlbGl2ci5uZXQvZ2gvZmF3YXphaG1lZDAvY3VycmVuY3ktYXBpQDEvbGF0ZXN0L2N1cnJlbmNpZXMvJHtiYXNlLnRvTG93ZXJDYXNlKCl9LyR7Zmlyc3RTeW1ib2wudG9Mb3dlckNhc2UoKX0uanNvbmAsXG4gICAgICAgIHBhcnNlOiAoaikgPT5cbiAgICAgICAgICBqICYmIHR5cGVvZiBqW2ZpcnN0U3ltYm9sLnRvTG93ZXJDYXNlKCldID09PSBcIm51bWJlclwiXG4gICAgICAgICAgICA/IGpbZmlyc3RTeW1ib2wudG9Mb3dlckNhc2UoKV1cbiAgICAgICAgICAgIDogbnVsbCxcbiAgICAgIH0sXG4gICAgXTtcblxuICAgIGNvbnN0IGZldGNoUHJvdmlkZXIgPSBhc3luYyAoXG4gICAgICBwcm92aWRlcjogKHR5cGVvZiBwcm92aWRlcnMpW251bWJlcl0sXG4gICAgKTogUHJvbWlzZTx7IHJhdGU6IG51bWJlcjsgcHJvdmlkZXI6IHN0cmluZyB9PiA9PiB7XG4gICAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dChcbiAgICAgICAgKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLFxuICAgICAgICBQUk9WSURFUl9USU1FT1VUX01TLFxuICAgICAgKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBmZXRjaChwcm92aWRlci51cmwsIHtcbiAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBBY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgICBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoY29tcGF0aWJsZTsgU29sYW5hV2FsbGV0LzEuMClcIixcbiAgICAgICAgICB9LFxuICAgICAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwgYXMgYW55LFxuICAgICAgICB9IGFzIGFueSk7XG4gICAgICAgIGlmICghcmVzcC5vaykge1xuICAgICAgICAgIGNvbnN0IHJlYXNvbiA9IGAke3Jlc3Auc3RhdHVzfSAke3Jlc3Auc3RhdHVzVGV4dH1gO1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihyZWFzb24udHJpbSgpIHx8IFwibm9uLW9rIHJlc3BvbnNlXCIpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGpzb24gPSBhd2FpdCByZXNwLmpzb24oKTtcbiAgICAgICAgY29uc3QgcmF0ZSA9IHByb3ZpZGVyLnBhcnNlKGpzb24pO1xuICAgICAgICBpZiAodHlwZW9mIHJhdGUgPT09IFwibnVtYmVyXCIgJiYgaXNGaW5pdGUocmF0ZSkgJiYgcmF0ZSA+IDApIHtcbiAgICAgICAgICByZXR1cm4geyByYXRlLCBwcm92aWRlcjogcHJvdmlkZXIubmFtZSB9O1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImludmFsaWQgcmVzcG9uc2UgcGF5bG9hZFwiKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgWyR7cHJvdmlkZXIubmFtZX1dICR7bWVzc2FnZX1gKTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBjb25zdCBydW5Qcm92aWRlcnMgPSAoKSA9PiB7XG4gICAgICBjb25zdCBhdHRlbXB0cyA9IHByb3ZpZGVycy5tYXAoKHApID0+IGZldGNoUHJvdmlkZXIocCkpO1xuICAgICAgaWYgKHR5cGVvZiAoUHJvbWlzZSBhcyBhbnkpLmFueSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHJldHVybiAoUHJvbWlzZSBhcyBhbnkpLmFueShhdHRlbXB0cyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IFByb21pc2U8eyByYXRlOiBudW1iZXI7IHByb3ZpZGVyOiBzdHJpbmcgfT4oXG4gICAgICAgIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgbGV0IHJlbWFpbmluZyA9IGF0dGVtcHRzLmxlbmd0aDtcbiAgICAgICAgICBhdHRlbXB0cy5mb3JFYWNoKChhdHRlbXB0KSA9PiB7XG4gICAgICAgICAgICBhdHRlbXB0LnRoZW4ocmVzb2x2ZSkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgICBlcnJvcnMucHVzaChlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogU3RyaW5nKGVycikpO1xuICAgICAgICAgICAgICByZW1haW5pbmcgLT0gMTtcbiAgICAgICAgICAgICAgaWYgKHJlbWFpbmluZyA9PT0gMCkgcmVqZWN0KG5ldyBFcnJvcihlcnJvcnMuam9pbihcIjsgXCIpKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgfTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IHJhdGUsIHByb3ZpZGVyIH0gPSBhd2FpdCBydW5Qcm92aWRlcnMoKTtcbiAgICAgIHJlcy5qc29uKHtcbiAgICAgICAgYmFzZSxcbiAgICAgICAgc3ltYm9sczogW2ZpcnN0U3ltYm9sXSxcbiAgICAgICAgcmF0ZXM6IHsgW2ZpcnN0U3ltYm9sXTogcmF0ZSB9LFxuICAgICAgICBwcm92aWRlcixcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zdCBtc2cgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgICByZXNcbiAgICAgICAgLnN0YXR1cyg1MDIpXG4gICAgICAgIC5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGZldGNoIGZvcmV4IHJhdGVcIiwgZGV0YWlsczogbXNnIH0pO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIlVuZXhwZWN0ZWQgZXJyb3JcIiB9KTtcbiAgfVxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL3N0YWJsZS0yNGgudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc3RhYmxlLTI0aC50c1wiO2ltcG9ydCB7IFJlcXVlc3RIYW5kbGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZVN0YWJsZTI0aDogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBzeW1ib2xzUGFyYW0gPSBTdHJpbmcocmVxLnF1ZXJ5LnN5bWJvbHMgfHwgXCJVU0RDLFVTRFRcIikudG9VcHBlckNhc2UoKTtcbiAgICBjb25zdCBzeW1ib2xzID0gQXJyYXkuZnJvbShcbiAgICAgIG5ldyBTZXQoXG4gICAgICAgIFN0cmluZyhzeW1ib2xzUGFyYW0pXG4gICAgICAgICAgLnNwbGl0KFwiLFwiKVxuICAgICAgICAgIC5tYXAoKHMpID0+IHMudHJpbSgpKVxuICAgICAgICAgIC5maWx0ZXIoQm9vbGVhbiksXG4gICAgICApLFxuICAgICk7XG5cbiAgICBjb25zdCBDT0lOR0VDS09fSURTOiBSZWNvcmQ8c3RyaW5nLCB7IGlkOiBzdHJpbmc7IG1pbnQ6IHN0cmluZyB9PiA9IHtcbiAgICAgIFVTREM6IHtcbiAgICAgICAgaWQ6IFwidXNkLWNvaW5cIixcbiAgICAgICAgbWludDogXCJFUGpGV2RkNUF1ZnFTU3FlTTJxTjF4enliYXBDOEc0d0VHR2tad3lURHQxdlwiLFxuICAgICAgfSxcbiAgICAgIFVTRFQ6IHtcbiAgICAgICAgaWQ6IFwidGV0aGVyXCIsXG4gICAgICAgIG1pbnQ6IFwiRXM5dk1GcnphQ0VSbUpmckY0SDJGWUQ0S0NvTmtZMTFNY0NlOEJlbkVuc1wiLFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgY29uc3QgaWRzID0gc3ltYm9sc1xuICAgICAgLm1hcCgocykgPT4gQ09JTkdFQ0tPX0lEU1tzXT8uaWQpXG4gICAgICAuZmlsdGVyKEJvb2xlYW4pXG4gICAgICAuam9pbihcIixcIik7XG5cbiAgICBpZiAoIWlkcykge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6IFwiTm8gc3VwcG9ydGVkIHN5bWJvbHMgcHJvdmlkZWRcIiB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBhcGlVcmwgPSBgaHR0cHM6Ly9hcGkuY29pbmdlY2tvLmNvbS9hcGkvdjMvc2ltcGxlL3ByaWNlP2lkcz0ke2VuY29kZVVSSUNvbXBvbmVudChpZHMpfSZ2c19jdXJyZW5jaWVzPXVzZCZpbmNsdWRlXzI0aHJfY2hhbmdlPXRydWVgO1xuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIDEyMDAwKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwID0gYXdhaXQgZmV0Y2goYXBpVXJsLCB7XG4gICAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwgYXMgYW55LFxuICAgICAgICBoZWFkZXJzOiB7IEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSxcbiAgICAgIH0gYXMgYW55KTtcbiAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuXG4gICAgICBjb25zdCByZXN1bHQ6IFJlY29yZDxcbiAgICAgICAgc3RyaW5nLFxuICAgICAgICB7IHByaWNlVXNkOiBudW1iZXI7IGNoYW5nZTI0aDogbnVtYmVyOyBtaW50OiBzdHJpbmcgfVxuICAgICAgPiA9IHt9O1xuXG4gICAgICBpZiAocmVzcC5vaykge1xuICAgICAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzcC5qc29uKCk7XG4gICAgICAgIHN5bWJvbHMuZm9yRWFjaCgoc3ltKSA9PiB7XG4gICAgICAgICAgY29uc3QgbWV0YSA9IENPSU5HRUNLT19JRFNbc3ltXTtcbiAgICAgICAgICBpZiAoIW1ldGEpIHJldHVybjtcbiAgICAgICAgICBjb25zdCBkID0gKGpzb24gYXMgYW55KT8uW21ldGEuaWRdO1xuICAgICAgICAgIGNvbnN0IHByaWNlID0gdHlwZW9mIGQ/LnVzZCA9PT0gXCJudW1iZXJcIiA/IGQudXNkIDogMTtcbiAgICAgICAgICBjb25zdCBjaGFuZ2UgPVxuICAgICAgICAgICAgdHlwZW9mIGQ/LnVzZF8yNGhfY2hhbmdlID09PSBcIm51bWJlclwiID8gZC51c2RfMjRoX2NoYW5nZSA6IDA7XG4gICAgICAgICAgcmVzdWx0W3N5bV0gPSB7IHByaWNlVXNkOiBwcmljZSwgY2hhbmdlMjRoOiBjaGFuZ2UsIG1pbnQ6IG1ldGEubWludCB9O1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN5bWJvbHMuZm9yRWFjaCgoc3ltKSA9PiB7XG4gICAgICAgICAgY29uc3QgbWV0YSA9IENPSU5HRUNLT19JRFNbc3ltXTtcbiAgICAgICAgICBpZiAoIW1ldGEpIHJldHVybjtcbiAgICAgICAgICByZXN1bHRbc3ltXSA9IHsgcHJpY2VVc2Q6IDEsIGNoYW5nZTI0aDogMCwgbWludDogbWV0YS5taW50IH07XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICByZXMuanNvbih7IGRhdGE6IHJlc3VsdCB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgIGNvbnN0IHJlc3VsdDogUmVjb3JkPFxuICAgICAgICBzdHJpbmcsXG4gICAgICAgIHsgcHJpY2VVc2Q6IG51bWJlcjsgY2hhbmdlMjRoOiBudW1iZXI7IG1pbnQ6IHN0cmluZyB9XG4gICAgICA+ID0ge307XG4gICAgICBzeW1ib2xzLmZvckVhY2goKHN5bSkgPT4ge1xuICAgICAgICBjb25zdCBtZXRhID0gQ09JTkdFQ0tPX0lEU1tzeW1dO1xuICAgICAgICBpZiAoIW1ldGEpIHJldHVybjtcbiAgICAgICAgcmVzdWx0W3N5bV0gPSB7IHByaWNlVXNkOiAxLCBjaGFuZ2UyNGg6IDAsIG1pbnQ6IG1ldGEubWludCB9O1xuICAgICAgfSk7XG4gICAgICByZXMuanNvbih7IGRhdGE6IHJlc3VsdCB9KTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJVbmV4cGVjdGVkIGVycm9yXCIgfSk7XG4gIH1cbn07XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9wMnAtb3JkZXJzLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL3AycC1vcmRlcnMudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUDJQT3JkZXIge1xuICBpZDogc3RyaW5nO1xuICB0eXBlOiBcImJ1eVwiIHwgXCJzZWxsXCI7XG4gIGNyZWF0b3Jfd2FsbGV0OiBzdHJpbmc7XG4gIHRva2VuOiBzdHJpbmc7XG4gIHRva2VuX2Ftb3VudDogc3RyaW5nO1xuICBwa3JfYW1vdW50OiBudW1iZXI7XG4gIHBheW1lbnRfbWV0aG9kOiBzdHJpbmc7XG4gIHN0YXR1czogXCJhY3RpdmVcIiB8IFwicGVuZGluZ1wiIHwgXCJjb21wbGV0ZWRcIiB8IFwiY2FuY2VsbGVkXCIgfCBcImRpc3B1dGVkXCI7XG4gIG9ubGluZTogYm9vbGVhbjtcbiAgY3JlYXRlZF9hdDogbnVtYmVyO1xuICB1cGRhdGVkX2F0OiBudW1iZXI7XG4gIGFjY291bnRfbmFtZT86IHN0cmluZztcbiAgYWNjb3VudF9udW1iZXI/OiBzdHJpbmc7XG4gIHdhbGxldF9hZGRyZXNzPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRyYWRlUm9vbSB7XG4gIGlkOiBzdHJpbmc7XG4gIGJ1eWVyX3dhbGxldDogc3RyaW5nO1xuICBzZWxsZXJfd2FsbGV0OiBzdHJpbmc7XG4gIG9yZGVyX2lkOiBzdHJpbmc7XG4gIHN0YXR1czpcbiAgICB8IFwicGVuZGluZ1wiXG4gICAgfCBcInBheW1lbnRfY29uZmlybWVkXCJcbiAgICB8IFwiYXNzZXRzX3RyYW5zZmVycmVkXCJcbiAgICB8IFwiY29tcGxldGVkXCJcbiAgICB8IFwiY2FuY2VsbGVkXCI7XG4gIGNyZWF0ZWRfYXQ6IG51bWJlcjtcbiAgdXBkYXRlZF9hdDogbnVtYmVyO1xufVxuXG4vLyBJbi1tZW1vcnkgc3RvcmUgZm9yIGRldmVsb3BtZW50ICh3aWxsIGJlIHJlcGxhY2VkIHdpdGggZGF0YWJhc2UpXG5jb25zdCBvcmRlcnM6IE1hcDxzdHJpbmcsIFAyUE9yZGVyPiA9IG5ldyBNYXAoKTtcbmNvbnN0IHJvb21zOiBNYXA8c3RyaW5nLCBUcmFkZVJvb20+ID0gbmV3IE1hcCgpO1xuY29uc3QgbWVzc2FnZXM6IE1hcDxcbiAgc3RyaW5nLFxuICBBcnJheTx7XG4gICAgaWQ6IHN0cmluZztcbiAgICBzZW5kZXJfd2FsbGV0OiBzdHJpbmc7XG4gICAgbWVzc2FnZTogc3RyaW5nO1xuICAgIGNyZWF0ZWRfYXQ6IG51bWJlcjtcbiAgfT5cbj4gPSBuZXcgTWFwKCk7XG5cbi8vIEhlbHBlciBmdW5jdGlvbnNcbmZ1bmN0aW9uIGdlbmVyYXRlSWQocHJlZml4OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYCR7cHJlZml4fS0ke0RhdGUubm93KCl9LSR7TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMiwgOCl9YDtcbn1cblxuLy8gUDJQIE9yZGVycyBlbmRwb2ludHNcbmV4cG9ydCBjb25zdCBoYW5kbGVMaXN0UDJQT3JkZXJzOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgdHlwZSwgc3RhdHVzLCB0b2tlbiwgb25saW5lIH0gPSByZXEucXVlcnk7XG5cbiAgICBsZXQgZmlsdGVyZWQgPSBBcnJheS5mcm9tKG9yZGVycy52YWx1ZXMoKSk7XG5cbiAgICBpZiAodHlwZSkgZmlsdGVyZWQgPSBmaWx0ZXJlZC5maWx0ZXIoKG8pID0+IG8udHlwZSA9PT0gdHlwZSk7XG4gICAgaWYgKHN0YXR1cykgZmlsdGVyZWQgPSBmaWx0ZXJlZC5maWx0ZXIoKG8pID0+IG8uc3RhdHVzID09PSBzdGF0dXMpO1xuICAgIGlmICh0b2tlbikgZmlsdGVyZWQgPSBmaWx0ZXJlZC5maWx0ZXIoKG8pID0+IG8udG9rZW4gPT09IHRva2VuKTtcbiAgICBpZiAob25saW5lID09PSBcInRydWVcIikgZmlsdGVyZWQgPSBmaWx0ZXJlZC5maWx0ZXIoKG8pID0+IG8ub25saW5lKTtcbiAgICBpZiAob25saW5lID09PSBcImZhbHNlXCIpIGZpbHRlcmVkID0gZmlsdGVyZWQuZmlsdGVyKChvKSA9PiAhby5vbmxpbmUpO1xuXG4gICAgZmlsdGVyZWQuc29ydCgoYSwgYikgPT4gYi5jcmVhdGVkX2F0IC0gYS5jcmVhdGVkX2F0KTtcblxuICAgIHJlcy5qc29uKHsgb3JkZXJzOiBmaWx0ZXJlZCB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiTGlzdCBQMlAgb3JkZXJzIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gbGlzdCBvcmRlcnNcIiB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUNyZWF0ZVAyUE9yZGVyOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHtcbiAgICAgIHR5cGUsXG4gICAgICBjcmVhdG9yX3dhbGxldCxcbiAgICAgIHRva2VuLFxuICAgICAgdG9rZW5fYW1vdW50LFxuICAgICAgcGtyX2Ftb3VudCxcbiAgICAgIHBheW1lbnRfbWV0aG9kLFxuICAgICAgb25saW5lLFxuICAgICAgYWNjb3VudF9uYW1lLFxuICAgICAgYWNjb3VudF9udW1iZXIsXG4gICAgICB3YWxsZXRfYWRkcmVzcyxcbiAgICB9ID0gcmVxLmJvZHk7XG5cbiAgICBpZiAoXG4gICAgICAhdHlwZSB8fFxuICAgICAgIWNyZWF0b3Jfd2FsbGV0IHx8XG4gICAgICAhdG9rZW4gfHxcbiAgICAgICF0b2tlbl9hbW91bnQgfHxcbiAgICAgICFwa3JfYW1vdW50IHx8XG4gICAgICAhcGF5bWVudF9tZXRob2RcbiAgICApIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiBcIk1pc3NpbmcgcmVxdWlyZWQgZmllbGRzXCIgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgaWQgPSBnZW5lcmF0ZUlkKFwib3JkZXJcIik7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblxuICAgIGNvbnN0IG9yZGVyOiBQMlBPcmRlciA9IHtcbiAgICAgIGlkLFxuICAgICAgdHlwZSxcbiAgICAgIGNyZWF0b3Jfd2FsbGV0LFxuICAgICAgdG9rZW4sXG4gICAgICB0b2tlbl9hbW91bnQ6IFN0cmluZyh0b2tlbl9hbW91bnQpLFxuICAgICAgcGtyX2Ftb3VudDogTnVtYmVyKHBrcl9hbW91bnQpLFxuICAgICAgcGF5bWVudF9tZXRob2QsXG4gICAgICBzdGF0dXM6IFwiYWN0aXZlXCIsXG4gICAgICBvbmxpbmU6IG9ubGluZSAhPT0gZmFsc2UsXG4gICAgICBjcmVhdGVkX2F0OiBub3csXG4gICAgICB1cGRhdGVkX2F0OiBub3csXG4gICAgICBhY2NvdW50X25hbWUsXG4gICAgICBhY2NvdW50X251bWJlcixcbiAgICAgIHdhbGxldF9hZGRyZXNzOiB0eXBlID09PSBcInNlbGxcIiA/IHdhbGxldF9hZGRyZXNzIDogdW5kZWZpbmVkLFxuICAgIH07XG5cbiAgICBvcmRlcnMuc2V0KGlkLCBvcmRlcik7XG5cbiAgICByZXMuc3RhdHVzKDIwMSkuanNvbih7IG9yZGVyIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJDcmVhdGUgUDJQIG9yZGVyIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gY3JlYXRlIG9yZGVyXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVHZXRQMlBPcmRlcjogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IG9yZGVySWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgY29uc3Qgb3JkZXIgPSBvcmRlcnMuZ2V0KG9yZGVySWQpO1xuXG4gICAgaWYgKCFvcmRlcikge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6IFwiT3JkZXIgbm90IGZvdW5kXCIgfSk7XG4gICAgfVxuXG4gICAgcmVzLmpzb24oeyBvcmRlciB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiR2V0IFAyUCBvcmRlciBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGdldCBvcmRlclwiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlVXBkYXRlUDJQT3JkZXI6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBvcmRlcklkIH0gPSByZXEucGFyYW1zO1xuICAgIGNvbnN0IG9yZGVyID0gb3JkZXJzLmdldChvcmRlcklkKTtcblxuICAgIGlmICghb3JkZXIpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiBcIk9yZGVyIG5vdCBmb3VuZFwiIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVwZGF0ZWQ6IFAyUE9yZGVyID0ge1xuICAgICAgLi4ub3JkZXIsXG4gICAgICAuLi5yZXEuYm9keSxcbiAgICAgIGlkOiBvcmRlci5pZCxcbiAgICAgIGNyZWF0ZWRfYXQ6IG9yZGVyLmNyZWF0ZWRfYXQsXG4gICAgICB1cGRhdGVkX2F0OiBEYXRlLm5vdygpLFxuICAgIH07XG5cbiAgICBvcmRlcnMuc2V0KG9yZGVySWQsIHVwZGF0ZWQpO1xuICAgIHJlcy5qc29uKHsgb3JkZXI6IHVwZGF0ZWQgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIlVwZGF0ZSBQMlAgb3JkZXIgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byB1cGRhdGUgb3JkZXJcIiB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZURlbGV0ZVAyUE9yZGVyOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgb3JkZXJJZCB9ID0gcmVxLnBhcmFtcztcblxuICAgIGlmICghb3JkZXJzLmhhcyhvcmRlcklkKSkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6IFwiT3JkZXIgbm90IGZvdW5kXCIgfSk7XG4gICAgfVxuXG4gICAgb3JkZXJzLmRlbGV0ZShvcmRlcklkKTtcbiAgICByZXMuanNvbih7IG9rOiB0cnVlIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJEZWxldGUgUDJQIG9yZGVyIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gZGVsZXRlIG9yZGVyXCIgfSk7XG4gIH1cbn07XG5cbi8vIFRyYWRlIFJvb21zIGVuZHBvaW50c1xuZXhwb3J0IGNvbnN0IGhhbmRsZUxpc3RUcmFkZVJvb21zOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgd2FsbGV0IH0gPSByZXEucXVlcnk7XG5cbiAgICBsZXQgZmlsdGVyZWQgPSBBcnJheS5mcm9tKHJvb21zLnZhbHVlcygpKTtcblxuICAgIGlmICh3YWxsZXQpIHtcbiAgICAgIGZpbHRlcmVkID0gZmlsdGVyZWQuZmlsdGVyKFxuICAgICAgICAocikgPT4gci5idXllcl93YWxsZXQgPT09IHdhbGxldCB8fCByLnNlbGxlcl93YWxsZXQgPT09IHdhbGxldCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgZmlsdGVyZWQuc29ydCgoYSwgYikgPT4gYi5jcmVhdGVkX2F0IC0gYS5jcmVhdGVkX2F0KTtcblxuICAgIHJlcy5qc29uKHsgcm9vbXM6IGZpbHRlcmVkIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJMaXN0IHRyYWRlIHJvb21zIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gbGlzdCByb29tc1wiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlQ3JlYXRlVHJhZGVSb29tOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgYnV5ZXJfd2FsbGV0LCBzZWxsZXJfd2FsbGV0LCBvcmRlcl9pZCB9ID0gcmVxLmJvZHk7XG5cbiAgICBpZiAoIWJ1eWVyX3dhbGxldCB8fCAhc2VsbGVyX3dhbGxldCB8fCAhb3JkZXJfaWQpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiBcIk1pc3NpbmcgcmVxdWlyZWQgZmllbGRzXCIgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgaWQgPSBnZW5lcmF0ZUlkKFwicm9vbVwiKTtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXG4gICAgY29uc3Qgcm9vbTogVHJhZGVSb29tID0ge1xuICAgICAgaWQsXG4gICAgICBidXllcl93YWxsZXQsXG4gICAgICBzZWxsZXJfd2FsbGV0LFxuICAgICAgb3JkZXJfaWQsXG4gICAgICBzdGF0dXM6IFwicGVuZGluZ1wiLFxuICAgICAgY3JlYXRlZF9hdDogbm93LFxuICAgICAgdXBkYXRlZF9hdDogbm93LFxuICAgIH07XG5cbiAgICByb29tcy5zZXQoaWQsIHJvb20pO1xuXG4gICAgcmVzLnN0YXR1cygyMDEpLmpzb24oeyByb29tIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJDcmVhdGUgdHJhZGUgcm9vbSBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGNyZWF0ZSByb29tXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVHZXRUcmFkZVJvb206IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyByb29tSWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgY29uc3Qgcm9vbSA9IHJvb21zLmdldChyb29tSWQpO1xuXG4gICAgaWYgKCFyb29tKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJSb29tIG5vdCBmb3VuZFwiIH0pO1xuICAgIH1cblxuICAgIHJlcy5qc29uKHsgcm9vbSB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiR2V0IHRyYWRlIHJvb20gZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBnZXQgcm9vbVwiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlVXBkYXRlVHJhZGVSb29tOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgcm9vbUlkIH0gPSByZXEucGFyYW1zO1xuICAgIGNvbnN0IHJvb20gPSByb29tcy5nZXQocm9vbUlkKTtcblxuICAgIGlmICghcm9vbSkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6IFwiUm9vbSBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1cGRhdGVkOiBUcmFkZVJvb20gPSB7XG4gICAgICAuLi5yb29tLFxuICAgICAgLi4ucmVxLmJvZHksXG4gICAgICBpZDogcm9vbS5pZCxcbiAgICAgIGNyZWF0ZWRfYXQ6IHJvb20uY3JlYXRlZF9hdCxcbiAgICAgIHVwZGF0ZWRfYXQ6IERhdGUubm93KCksXG4gICAgfTtcblxuICAgIHJvb21zLnNldChyb29tSWQsIHVwZGF0ZWQpO1xuICAgIHJlcy5qc29uKHsgcm9vbTogdXBkYXRlZCB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiVXBkYXRlIHRyYWRlIHJvb20gZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byB1cGRhdGUgcm9vbVwiIH0pO1xuICB9XG59O1xuXG4vLyBUcmFkZSBNZXNzYWdlcyBlbmRwb2ludHNcbmV4cG9ydCBjb25zdCBoYW5kbGVMaXN0VHJhZGVNZXNzYWdlczogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHJvb21JZCB9ID0gcmVxLnBhcmFtcztcblxuICAgIGNvbnN0IHJvb21NZXNzYWdlcyA9IG1lc3NhZ2VzLmdldChyb29tSWQpIHx8IFtdO1xuICAgIHJlcy5qc29uKHsgbWVzc2FnZXM6IHJvb21NZXNzYWdlcyB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiTGlzdCB0cmFkZSBtZXNzYWdlcyBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGxpc3QgbWVzc2FnZXNcIiB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUFkZFRyYWRlTWVzc2FnZTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHJvb21JZCB9ID0gcmVxLnBhcmFtcztcbiAgICBjb25zdCB7IHNlbmRlcl93YWxsZXQsIG1lc3NhZ2UsIGF0dGFjaG1lbnRfdXJsIH0gPSByZXEuYm9keTtcblxuICAgIGlmICghc2VuZGVyX3dhbGxldCB8fCAhbWVzc2FnZSkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6IFwiTWlzc2luZyByZXF1aXJlZCBmaWVsZHNcIiB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBpZCA9IGdlbmVyYXRlSWQoXCJtc2dcIik7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblxuICAgIGNvbnN0IG1zZyA9IHtcbiAgICAgIGlkLFxuICAgICAgc2VuZGVyX3dhbGxldCxcbiAgICAgIG1lc3NhZ2UsXG4gICAgICBhdHRhY2htZW50X3VybCxcbiAgICAgIGNyZWF0ZWRfYXQ6IG5vdyxcbiAgICB9O1xuXG4gICAgaWYgKCFtZXNzYWdlcy5oYXMocm9vbUlkKSkge1xuICAgICAgbWVzc2FnZXMuc2V0KHJvb21JZCwgW10pO1xuICAgIH1cblxuICAgIG1lc3NhZ2VzLmdldChyb29tSWQpIS5wdXNoKG1zZyk7XG5cbiAgICByZXMuc3RhdHVzKDIwMSkuanNvbih7IG1lc3NhZ2U6IG1zZyB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiQWRkIHRyYWRlIG1lc3NhZ2UgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBhZGQgbWVzc2FnZVwiIH0pO1xuICB9XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvb3JkZXJzLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL29yZGVycy50c1wiO2ltcG9ydCB7IFJlcXVlc3RIYW5kbGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuaW50ZXJmYWNlIE9yZGVyIHtcbiAgaWQ6IHN0cmluZztcbiAgc2lkZTogXCJidXlcIiB8IFwic2VsbFwiO1xuICBhbW91bnRQS1I6IG51bWJlcjtcbiAgcXVvdGVBc3NldDogc3RyaW5nO1xuICBwcmljZVBLUlBlclF1b3RlOiBudW1iZXI7XG4gIHBheW1lbnRNZXRob2Q6IHN0cmluZztcbiAgcm9vbUlkOiBzdHJpbmc7XG4gIGNyZWF0ZWRCeTogc3RyaW5nO1xuICBjcmVhdGVkQXQ6IG51bWJlcjtcbiAgYWNjb3VudE5hbWU/OiBzdHJpbmc7XG4gIGFjY291bnROdW1iZXI/OiBzdHJpbmc7XG4gIHdhbGxldEFkZHJlc3M/OiBzdHJpbmc7XG59XG5cbi8vIEluLW1lbW9yeSBzdG9yZSBmb3Igb3JkZXJzICh3aWxsIGJlIHJlcGxhY2VkIHdpdGggZGF0YWJhc2UgaW4gcHJvZHVjdGlvbilcbmNvbnN0IG9yZGVyc1N0b3JlID0gbmV3IE1hcDxzdHJpbmcsIE9yZGVyPigpO1xuXG4vLyBBZG1pbiBwYXNzd29yZCBmb3IgdmFsaWRhdGlvblxuY29uc3QgQURNSU5fUEFTU1dPUkQgPSBcIlBha2lzdGFuIyMxMjNcIjtcblxuY29uc3QgZ2VuZXJhdGVJZCA9IChwcmVmaXg6IHN0cmluZyk6IHN0cmluZyA9PiB7XG4gIHJldHVybiBgJHtwcmVmaXh9LSR7RGF0ZS5ub3coKX0tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyLCA4KX1gO1xufTtcblxuY29uc3QgdmFsaWRhdGVBZG1pblRva2VuID0gKHRva2VuOiBzdHJpbmcpOiBib29sZWFuID0+IHtcbiAgcmV0dXJuIHRva2VuID09PSBBRE1JTl9QQVNTV09SRDtcbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVMaXN0T3JkZXJzOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgcm9vbUlkIH0gPSByZXEucXVlcnk7XG5cbiAgICBsZXQgZmlsdGVyZWQgPSBBcnJheS5mcm9tKG9yZGVyc1N0b3JlLnZhbHVlcygpKTtcblxuICAgIGlmIChyb29tSWQgJiYgdHlwZW9mIHJvb21JZCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgZmlsdGVyZWQgPSBmaWx0ZXJlZC5maWx0ZXIoKG8pID0+IG8ucm9vbUlkID09PSByb29tSWQpO1xuICAgIH1cblxuICAgIC8vIFNvcnQgYnkgY3JlYXRlZCBkYXRlLCBuZXdlc3QgZmlyc3RcbiAgICBmaWx0ZXJlZC5zb3J0KChhLCBiKSA9PiBiLmNyZWF0ZWRBdCAtIGEuY3JlYXRlZEF0KTtcblxuICAgIHJlcy5qc29uKHsgb3JkZXJzOiBmaWx0ZXJlZCB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiTGlzdCBvcmRlcnMgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBsaXN0IG9yZGVyc1wiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlQ3JlYXRlT3JkZXI6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3Qge1xuICAgICAgc2lkZSxcbiAgICAgIGFtb3VudFBLUixcbiAgICAgIHF1b3RlQXNzZXQsXG4gICAgICBwcmljZVBLUlBlclF1b3RlLFxuICAgICAgcGF5bWVudE1ldGhvZCxcbiAgICAgIHJvb21JZCA9IFwiZ2xvYmFsXCIsXG4gICAgICBjcmVhdGVkQnksXG4gICAgICBhY2NvdW50TmFtZSxcbiAgICAgIGFjY291bnROdW1iZXIsXG4gICAgICB3YWxsZXRBZGRyZXNzLFxuICAgIH0gPSByZXEuYm9keTtcblxuICAgIC8vIFZhbGlkYXRlIHJlcXVpcmVkIGZpZWxkc1xuICAgIGlmIChcbiAgICAgICFzaWRlIHx8XG4gICAgICAhYW1vdW50UEtSIHx8XG4gICAgICAhcXVvdGVBc3NldCB8fFxuICAgICAgIXByaWNlUEtSUGVyUXVvdGUgfHxcbiAgICAgICFwYXltZW50TWV0aG9kXG4gICAgKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oe1xuICAgICAgICBlcnJvcjpcbiAgICAgICAgICBcIk1pc3NpbmcgcmVxdWlyZWQgZmllbGRzOiBzaWRlLCBhbW91bnRQS1IsIHF1b3RlQXNzZXQsIHByaWNlUEtSUGVyUXVvdGUsIHBheW1lbnRNZXRob2RcIixcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFZhbGlkYXRlIGF1dGhvcml6YXRpb25cbiAgICBjb25zdCBhdXRoSGVhZGVyID0gcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbjtcbiAgICBjb25zdCB0b2tlbiA9IGF1dGhIZWFkZXI/LnJlcGxhY2UoXCJCZWFyZXIgXCIsIFwiXCIpO1xuXG4gICAgaWYgKCF0b2tlbiB8fCAhdmFsaWRhdGVBZG1pblRva2VuKHRva2VuKSkge1xuICAgICAgcmV0dXJuIHJlc1xuICAgICAgICAuc3RhdHVzKDQwMSlcbiAgICAgICAgLmpzb24oeyBlcnJvcjogXCJVbmF1dGhvcml6ZWQ6IGludmFsaWQgb3IgbWlzc2luZyBhZG1pbiB0b2tlblwiIH0pO1xuICAgIH1cblxuICAgIC8vIFZhbGlkYXRlIG51bWVyaWMgZmllbGRzXG4gICAgY29uc3QgYW1vdW50ID0gTnVtYmVyKGFtb3VudFBLUik7XG4gICAgY29uc3QgcHJpY2UgPSBOdW1iZXIocHJpY2VQS1JQZXJRdW90ZSk7XG5cbiAgICBpZiAoIWlzRmluaXRlKGFtb3VudCkgfHwgYW1vdW50IDw9IDApIHtcbiAgICAgIHJldHVybiByZXNcbiAgICAgICAgLnN0YXR1cyg0MDApXG4gICAgICAgIC5qc29uKHsgZXJyb3I6IFwiSW52YWxpZCBhbW91bnRQS1I6IG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXJcIiB9KTtcbiAgICB9XG5cbiAgICBpZiAoIWlzRmluaXRlKHByaWNlKSB8fCBwcmljZSA8PSAwKSB7XG4gICAgICByZXR1cm4gcmVzXG4gICAgICAgIC5zdGF0dXMoNDAwKVxuICAgICAgICAuanNvbih7IGVycm9yOiBcIkludmFsaWQgcHJpY2VQS1JQZXJRdW90ZTogbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlclwiIH0pO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSBvcmRlclxuICAgIGNvbnN0IGlkID0gZ2VuZXJhdGVJZChcIm9yZGVyXCIpO1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cbiAgICBjb25zdCBvcmRlcjogT3JkZXIgPSB7XG4gICAgICBpZCxcbiAgICAgIHNpZGU6IHNpZGUgYXMgXCJidXlcIiB8IFwic2VsbFwiLFxuICAgICAgYW1vdW50UEtSOiBhbW91bnQsXG4gICAgICBxdW90ZUFzc2V0LFxuICAgICAgcHJpY2VQS1JQZXJRdW90ZTogcHJpY2UsXG4gICAgICBwYXltZW50TWV0aG9kLFxuICAgICAgcm9vbUlkLFxuICAgICAgY3JlYXRlZEJ5OiBjcmVhdGVkQnkgfHwgXCJhZG1pblwiLFxuICAgICAgY3JlYXRlZEF0OiBub3csXG4gICAgICBhY2NvdW50TmFtZSxcbiAgICAgIGFjY291bnROdW1iZXIsXG4gICAgICB3YWxsZXRBZGRyZXNzLFxuICAgIH07XG5cbiAgICBvcmRlcnNTdG9yZS5zZXQoaWQsIG9yZGVyKTtcblxuICAgIHJlcy5zdGF0dXMoMjAxKS5qc29uKHsgb3JkZXIgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkNyZWF0ZSBvcmRlciBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGNyZWF0ZSBvcmRlclwiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlR2V0T3JkZXI6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBvcmRlcklkIH0gPSByZXEucGFyYW1zO1xuXG4gICAgY29uc3Qgb3JkZXIgPSBvcmRlcnNTdG9yZS5nZXQob3JkZXJJZCk7XG5cbiAgICBpZiAoIW9yZGVyKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJPcmRlciBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICByZXMuanNvbih7IG9yZGVyIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJHZXQgb3JkZXIgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBnZXQgb3JkZXJcIiB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZVVwZGF0ZU9yZGVyOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgb3JkZXJJZCB9ID0gcmVxLnBhcmFtcztcblxuICAgIC8vIFZhbGlkYXRlIGF1dGhvcml6YXRpb25cbiAgICBjb25zdCBhdXRoSGVhZGVyID0gcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbjtcbiAgICBjb25zdCB0b2tlbiA9IGF1dGhIZWFkZXI/LnJlcGxhY2UoXCJCZWFyZXIgXCIsIFwiXCIpO1xuXG4gICAgaWYgKCF0b2tlbiB8fCAhdmFsaWRhdGVBZG1pblRva2VuKHRva2VuKSkge1xuICAgICAgcmV0dXJuIHJlc1xuICAgICAgICAuc3RhdHVzKDQwMSlcbiAgICAgICAgLmpzb24oeyBlcnJvcjogXCJVbmF1dGhvcml6ZWQ6IGludmFsaWQgb3IgbWlzc2luZyBhZG1pbiB0b2tlblwiIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IG9yZGVyID0gb3JkZXJzU3RvcmUuZ2V0KG9yZGVySWQpO1xuXG4gICAgaWYgKCFvcmRlcikge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6IFwiT3JkZXIgbm90IGZvdW5kXCIgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXBkYXRlZDogT3JkZXIgPSB7XG4gICAgICAuLi5vcmRlcixcbiAgICAgIC4uLnJlcS5ib2R5LFxuICAgICAgaWQ6IG9yZGVyLmlkLFxuICAgICAgY3JlYXRlZEF0OiBvcmRlci5jcmVhdGVkQXQsXG4gICAgfTtcblxuICAgIG9yZGVyc1N0b3JlLnNldChvcmRlcklkLCB1cGRhdGVkKTtcbiAgICByZXMuanNvbih7IG9yZGVyOiB1cGRhdGVkIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJVcGRhdGUgb3JkZXIgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byB1cGRhdGUgb3JkZXJcIiB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZURlbGV0ZU9yZGVyOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgb3JkZXJJZCB9ID0gcmVxLnBhcmFtcztcblxuICAgIC8vIFZhbGlkYXRlIGF1dGhvcml6YXRpb25cbiAgICBjb25zdCBhdXRoSGVhZGVyID0gcmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbjtcbiAgICBjb25zdCB0b2tlbiA9IGF1dGhIZWFkZXI/LnJlcGxhY2UoXCJCZWFyZXIgXCIsIFwiXCIpO1xuXG4gICAgaWYgKCF0b2tlbiB8fCAhdmFsaWRhdGVBZG1pblRva2VuKHRva2VuKSkge1xuICAgICAgcmV0dXJuIHJlc1xuICAgICAgICAuc3RhdHVzKDQwMSlcbiAgICAgICAgLmpzb24oeyBlcnJvcjogXCJVbmF1dGhvcml6ZWQ6IGludmFsaWQgb3IgbWlzc2luZyBhZG1pbiB0b2tlblwiIH0pO1xuICAgIH1cblxuICAgIGlmICghb3JkZXJzU3RvcmUuaGFzKG9yZGVySWQpKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJPcmRlciBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICBvcmRlcnNTdG9yZS5kZWxldGUob3JkZXJJZCk7XG4gICAgcmVzLmpzb24oeyBvazogdHJ1ZSB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiRGVsZXRlIG9yZGVyIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gZGVsZXRlIG9yZGVyXCIgfSk7XG4gIH1cbn07XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9maXhvcml1bS10b2tlbnMudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvZml4b3JpdW0tdG9rZW5zLnRzXCI7aW1wb3J0IHsgVG9rZW5JbmZvIH0gZnJvbSBcIkAvbGliL3dhbGxldFwiO1xuXG4vLyBNb2NrIGRhdGEgZm9yIEZpeG9yaXVtLWRlcGxveWVkIHRva2Vuc1xuLy8gSW4gYSByZWFsIGltcGxlbWVudGF0aW9uLCB0aGlzIHdvdWxkIGZldGNoIGZyb20gYSBkYXRhYmFzZSBvciBibG9ja2NoYWluXG5jb25zdCBGSVhPUklVTV9UT0tFTlM6IFRva2VuSW5mb1tdID0gW1xuICB7XG4gICAgbWludDogXCJTbzExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTEyXCIsXG4gICAgc3ltYm9sOiBcIlNPTFwiLFxuICAgIG5hbWU6IFwiU29sYW5hXCIsXG4gICAgZGVjaW1hbHM6IDksXG4gICAgbG9nb1VSSTpcbiAgICAgIFwiaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL3NvbGFuYS1sYWJzL3Rva2VuLWxpc3QvbWFpbi9hc3NldHMvbWFpbm5ldC9TbzExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTEyL2xvZ28ucG5nXCIsXG4gICAgYmFsYW5jZTogMCxcbiAgICBwcmljZTogMTkwLFxuICAgIHByaWNlQ2hhbmdlMjRoOiA1LjIsXG4gIH0sXG5dO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlRml4b3JpdW1Ub2tlbnMocmVxOiBhbnksIHJlczogYW55KSB7XG4gIHRyeSB7XG4gICAgLy8gSW4gYSByZWFsIGltcGxlbWVudGF0aW9uLCB5b3UgY291bGQ6XG4gICAgLy8gMS4gRmV0Y2ggdG9rZW5zIGZyb20gYSBkYXRhYmFzZVxuICAgIC8vIDIuIFNjYW4gdGhlIGJsb2NrY2hhaW4gZm9yIHRva2VucyBjcmVhdGVkIGJ5IEZpeG9yaXVtXG4gICAgLy8gMy4gRmlsdGVyIHRva2VucyBieSBjcmVhdG9yL2F1dGhvcml0eVxuXG4gICAgLy8gRm9yIG5vdywgcmV0dXJuIHRoZSBtb2NrIHRva2Vuc1xuICAgIHJlcy5qc29uKHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICB0b2tlbnM6IEZJWE9SSVVNX1RPS0VOUyxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBcIkZhaWxlZCB0byBmZXRjaCBGaXhvcml1bSB0b2tlbnNcIixcbiAgICAgIG1lc3NhZ2U6IGVycm9yPy5tZXNzYWdlLFxuICAgIH0pO1xuICB9XG59XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvaW5kZXgudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9pbmRleC50c1wiO2ltcG9ydCBleHByZXNzIGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgY29ycyBmcm9tIFwiY29yc1wiO1xuaW1wb3J0IHsgaGFuZGxlU29sYW5hUnBjIH0gZnJvbSBcIi4vcm91dGVzL3NvbGFuYS1wcm94eVwiO1xuaW1wb3J0IHsgaGFuZGxlU29sYW5hU2VuZCB9IGZyb20gXCIuL3JvdXRlcy9zb2xhbmEtc2VuZFwiO1xuaW1wb3J0IHsgaGFuZGxlU29sYW5hU2ltdWxhdGUgfSBmcm9tIFwiLi9yb3V0ZXMvc29sYW5hLXNpbXVsYXRlXCI7XG5pbXBvcnQgeyBoYW5kbGVXYWxsZXRCYWxhbmNlIH0gZnJvbSBcIi4vcm91dGVzL3dhbGxldC1iYWxhbmNlXCI7XG5pbXBvcnQgeyBoYW5kbGVFeGNoYW5nZVJhdGUgfSBmcm9tIFwiLi9yb3V0ZXMvZXhjaGFuZ2UtcmF0ZVwiO1xuaW1wb3J0IHtcbiAgaGFuZGxlRGV4c2NyZWVuZXJUb2tlbnMsXG4gIGhhbmRsZURleHNjcmVlbmVyU2VhcmNoLFxuICBoYW5kbGVEZXhzY3JlZW5lclRyZW5kaW5nLFxufSBmcm9tIFwiLi9yb3V0ZXMvZGV4c2NyZWVuZXItcHJveHlcIjtcbmltcG9ydCB7IGhhbmRsZVN1Ym1pdFNwbE1ldGEgfSBmcm9tIFwiLi9yb3V0ZXMvc3BsLW1ldGFcIjtcbmltcG9ydCB7XG4gIGhhbmRsZUp1cGl0ZXJQcmljZSxcbiAgaGFuZGxlSnVwaXRlclF1b3RlLFxuICBoYW5kbGVKdXBpdGVyU3dhcCxcbiAgaGFuZGxlSnVwaXRlclRva2Vucyxcbn0gZnJvbSBcIi4vcm91dGVzL2p1cGl0ZXItcHJveHlcIjtcbmltcG9ydCB7IGhhbmRsZUZvcmV4UmF0ZSB9IGZyb20gXCIuL3JvdXRlcy9mb3JleC1yYXRlXCI7XG5pbXBvcnQgeyBoYW5kbGVTdGFibGUyNGggfSBmcm9tIFwiLi9yb3V0ZXMvc3RhYmxlLTI0aFwiO1xuaW1wb3J0IHtcbiAgaGFuZGxlTGlzdFAyUE9yZGVycyxcbiAgaGFuZGxlQ3JlYXRlUDJQT3JkZXIsXG4gIGhhbmRsZUdldFAyUE9yZGVyLFxuICBoYW5kbGVVcGRhdGVQMlBPcmRlcixcbiAgaGFuZGxlRGVsZXRlUDJQT3JkZXIsXG4gIGhhbmRsZUxpc3RUcmFkZVJvb21zLFxuICBoYW5kbGVDcmVhdGVUcmFkZVJvb20sXG4gIGhhbmRsZUdldFRyYWRlUm9vbSxcbiAgaGFuZGxlVXBkYXRlVHJhZGVSb29tLFxuICBoYW5kbGVMaXN0VHJhZGVNZXNzYWdlcyxcbiAgaGFuZGxlQWRkVHJhZGVNZXNzYWdlLFxufSBmcm9tIFwiLi9yb3V0ZXMvcDJwLW9yZGVyc1wiO1xuaW1wb3J0IHtcbiAgaGFuZGxlTGlzdE9yZGVycyxcbiAgaGFuZGxlQ3JlYXRlT3JkZXIsXG4gIGhhbmRsZUdldE9yZGVyLFxuICBoYW5kbGVVcGRhdGVPcmRlcixcbiAgaGFuZGxlRGVsZXRlT3JkZXIsXG59IGZyb20gXCIuL3JvdXRlcy9vcmRlcnNcIjtcbmltcG9ydCB7IGhhbmRsZUZpeG9yaXVtVG9rZW5zIH0gZnJvbSBcIi4vcm91dGVzL2ZpeG9yaXVtLXRva2Vuc1wiO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlU2VydmVyKCk6IFByb21pc2U8ZXhwcmVzcy5BcHBsaWNhdGlvbj4ge1xuICBjb25zdCBhcHAgPSBleHByZXNzKCk7XG5cbiAgLy8gTWlkZGxld2FyZVxuICBhcHAudXNlKGNvcnMoKSk7XG4gIGFwcC51c2UoZXhwcmVzcy5qc29uKCkpO1xuXG4gIC8vIERleFNjcmVlbmVyIHJvdXRlc1xuICBhcHAuZ2V0KFwiL2FwaS9kZXhzY3JlZW5lci90b2tlbnNcIiwgaGFuZGxlRGV4c2NyZWVuZXJUb2tlbnMpO1xuICBhcHAuZ2V0KFwiL2FwaS9kZXhzY3JlZW5lci9zZWFyY2hcIiwgaGFuZGxlRGV4c2NyZWVuZXJTZWFyY2gpO1xuICBhcHAuZ2V0KFwiL2FwaS9kZXhzY3JlZW5lci90cmVuZGluZ1wiLCBoYW5kbGVEZXhzY3JlZW5lclRyZW5kaW5nKTtcblxuICAvLyBKdXBpdGVyIHJvdXRlc1xuICBhcHAuZ2V0KFwiL2FwaS9qdXBpdGVyL3ByaWNlXCIsIGhhbmRsZUp1cGl0ZXJQcmljZSk7XG4gIGFwcC5nZXQoXCIvYXBpL2p1cGl0ZXIvcXVvdGVcIiwgaGFuZGxlSnVwaXRlclF1b3RlKTtcbiAgYXBwLnBvc3QoXCIvYXBpL2p1cGl0ZXIvc3dhcFwiLCBoYW5kbGVKdXBpdGVyU3dhcCk7XG4gIGFwcC5nZXQoXCIvYXBpL2p1cGl0ZXIvdG9rZW5zXCIsIGhhbmRsZUp1cGl0ZXJUb2tlbnMpO1xuXG4gIC8vIFNvbGFuYSBSUEMgcHJveHlcbiAgYXBwLnBvc3QoXCIvYXBpL3NvbGFuYS1ycGNcIiwgaGFuZGxlU29sYW5hUnBjKTtcbiAgYXBwLnBvc3QoXCIvYXBpL3NvbGFuYS1zaW11bGF0ZVwiLCAocmVxLCByZXMpID0+IHtcbiAgICBjb25zdCB7IHNpZ25lZEJhc2U2NCB9ID0gcmVxLmJvZHk7XG4gICAgaGFuZGxlU29sYW5hU2ltdWxhdGUoc2lnbmVkQmFzZTY0KVxuICAgICAgLnRoZW4oKHJlc3VsdCkgPT4gcmVzLmpzb24ocmVzdWx0KSlcbiAgICAgIC5jYXRjaCgoZXJyKSA9PiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gIH0pO1xuICBhcHAucG9zdChcIi9hcGkvc29sYW5hLXNlbmRcIiwgKHJlcSwgcmVzKSA9PiB7XG4gICAgY29uc3QgeyBzaWduZWRCYXNlNjQgfSA9IHJlcS5ib2R5O1xuICAgIGhhbmRsZVNvbGFuYVNlbmQoc2lnbmVkQmFzZTY0KVxuICAgICAgLnRoZW4oKHJlc3VsdCkgPT4gcmVzLmpzb24ocmVzdWx0KSlcbiAgICAgIC5jYXRjaCgoZXJyKSA9PiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gIH0pO1xuXG4gIC8vIFdhbGxldCByb3V0ZXNcbiAgYXBwLmdldChcIi9hcGkvd2FsbGV0L2JhbGFuY2VcIiwgaGFuZGxlV2FsbGV0QmFsYW5jZSk7XG5cbiAgLy8gRXhjaGFuZ2UgcmF0ZSByb3V0ZXNcbiAgYXBwLmdldChcIi9hcGkvZXhjaGFuZ2UtcmF0ZVwiLCBoYW5kbGVFeGNoYW5nZVJhdGUpO1xuICBhcHAuZ2V0KFwiL2FwaS9mb3JleC9yYXRlXCIsIGhhbmRsZUZvcmV4UmF0ZSk7XG4gIGFwcC5nZXQoXCIvYXBpL3N0YWJsZS0yNGhcIiwgaGFuZGxlU3RhYmxlMjRoKTtcblxuICAvLyBPcmRlcnMgcm91dGVzIChuZXcgQVBJKVxuICBhcHAuZ2V0KFwiL2FwaS9vcmRlcnNcIiwgaGFuZGxlTGlzdE9yZGVycyk7XG4gIGFwcC5wb3N0KFwiL2FwaS9vcmRlcnNcIiwgaGFuZGxlQ3JlYXRlT3JkZXIpO1xuICBhcHAuZ2V0KFwiL2FwaS9vcmRlcnMvOm9yZGVySWRcIiwgaGFuZGxlR2V0T3JkZXIpO1xuICBhcHAucHV0KFwiL2FwaS9vcmRlcnMvOm9yZGVySWRcIiwgaGFuZGxlVXBkYXRlT3JkZXIpO1xuICBhcHAuZGVsZXRlKFwiL2FwaS9vcmRlcnMvOm9yZGVySWRcIiwgaGFuZGxlRGVsZXRlT3JkZXIpO1xuXG4gIC8vIFAyUCBPcmRlcnMgcm91dGVzIChsZWdhY3kgQVBJKVxuICBhcHAuZ2V0KFwiL2FwaS9wMnAvb3JkZXJzXCIsIGhhbmRsZUxpc3RQMlBPcmRlcnMpO1xuICBhcHAucG9zdChcIi9hcGkvcDJwL29yZGVyc1wiLCBoYW5kbGVDcmVhdGVQMlBPcmRlcik7XG4gIGFwcC5nZXQoXCIvYXBpL3AycC9vcmRlcnMvOm9yZGVySWRcIiwgaGFuZGxlR2V0UDJQT3JkZXIpO1xuICBhcHAucHV0KFwiL2FwaS9wMnAvb3JkZXJzLzpvcmRlcklkXCIsIGhhbmRsZVVwZGF0ZVAyUE9yZGVyKTtcbiAgYXBwLmRlbGV0ZShcIi9hcGkvcDJwL29yZGVycy86b3JkZXJJZFwiLCBoYW5kbGVEZWxldGVQMlBPcmRlcik7XG5cbiAgLy8gVHJhZGUgUm9vbXMgcm91dGVzXG4gIGFwcC5nZXQoXCIvYXBpL3AycC9yb29tc1wiLCBoYW5kbGVMaXN0VHJhZGVSb29tcyk7XG4gIGFwcC5wb3N0KFwiL2FwaS9wMnAvcm9vbXNcIiwgaGFuZGxlQ3JlYXRlVHJhZGVSb29tKTtcbiAgYXBwLmdldChcIi9hcGkvcDJwL3Jvb21zLzpyb29tSWRcIiwgaGFuZGxlR2V0VHJhZGVSb29tKTtcbiAgYXBwLnB1dChcIi9hcGkvcDJwL3Jvb21zLzpyb29tSWRcIiwgaGFuZGxlVXBkYXRlVHJhZGVSb29tKTtcblxuICAvLyBUcmFkZSBNZXNzYWdlcyByb3V0ZXNcbiAgYXBwLmdldChcIi9hcGkvcDJwL3Jvb21zLzpyb29tSWQvbWVzc2FnZXNcIiwgaGFuZGxlTGlzdFRyYWRlTWVzc2FnZXMpO1xuICBhcHAucG9zdChcIi9hcGkvcDJwL3Jvb21zLzpyb29tSWQvbWVzc2FnZXNcIiwgaGFuZGxlQWRkVHJhZGVNZXNzYWdlKTtcblxuICAvLyBTUEwtTUVUQSBzdWJtaXRcbiAgYXBwLnBvc3QoXCIvYXBpL3NwbC1tZXRhL3N1Ym1pdFwiLCBoYW5kbGVTdWJtaXRTcGxNZXRhKTtcblxuICAvLyBGaXhvcml1bSB0b2tlbnNcbiAgYXBwLmdldChcIi9hcGkvZml4b3JpdW0tdG9rZW5zXCIsIGhhbmRsZUZpeG9yaXVtVG9rZW5zKTtcblxuICAvLyBIZWFsdGggY2hlY2tcbiAgYXBwLmdldChcIi9oZWFsdGhcIiwgKHJlcSwgcmVzKSA9PiB7XG4gICAgcmVzLmpzb24oeyBzdGF0dXM6IFwib2tcIiwgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkgfSk7XG4gIH0pO1xuXG4gIC8vIDQwNCBoYW5kbGVyXG4gIGFwcC51c2UoKHJlcSwgcmVzKSA9PiB7XG4gICAgcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJBUEkgZW5kcG9pbnQgbm90IGZvdW5kXCIsIHBhdGg6IHJlcS5wYXRoIH0pO1xuICB9KTtcblxuICByZXR1cm4gYXBwO1xufVxuXG4vLyBDbG91ZGZsYXJlIFdvcmtlcnMgY29tcGF0aWJpbGl0eSBleHBvcnRcbmV4cG9ydCBkZWZhdWx0IHtcbiAgYXN5bmMgZmV0Y2gocmVxOiBSZXF1ZXN0KTogUHJvbWlzZTxSZXNwb25zZT4ge1xuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwocmVxLnVybCk7XG5cbiAgICBpZiAodXJsLnBhdGhuYW1lLnN0YXJ0c1dpdGgoXCIvYXBpL3NvbGFuYS1ycGNcIikpIHtcbiAgICAgIHJldHVybiBhd2FpdCBoYW5kbGVTb2xhbmFScGMocmVxIGFzIGFueSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShcIldhbGxldCBiYWNrZW5kIGFjdGl2ZVwiLCB7IHN0YXR1czogMjAwIH0pO1xuICB9LFxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcC9jb2RlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL2NvZGUvdml0ZS5jb25maWcubWpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS92aXRlLmNvbmZpZy5tanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tIFwidXJsXCI7XG5pbXBvcnQgeyBXZWJTb2NrZXRTZXJ2ZXIgfSBmcm9tIFwid3NcIjtcblxuY29uc3QgX19kaXJuYW1lID0gcGF0aC5kaXJuYW1lKGZpbGVVUkxUb1BhdGgobmV3IFVSTChpbXBvcnQubWV0YS51cmwpKSk7XG5cbmxldCBhcGlTZXJ2ZXIgPSBudWxsO1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGJhc2U6IFwiLi9cIixcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAge1xuICAgICAgbmFtZTogXCJleHByZXNzLXNlcnZlclwiLFxuICAgICAgYXBwbHk6IFwic2VydmVcIixcbiAgICAgIGFzeW5jIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgICAgLy8gTG9hZCBhbmQgaW5pdGlhbGl6ZSB0aGUgRXhwcmVzcyBzZXJ2ZXJcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB7IGNyZWF0ZVNlcnZlcjogY3JlYXRlRXhwcmVzc1NlcnZlciB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICAgXCIuL3NlcnZlci9pbmRleC50c1wiXG4gICAgICAgICAgKTtcbiAgICAgICAgICBhcGlTZXJ2ZXIgPSBhd2FpdCBjcmVhdGVFeHByZXNzU2VydmVyKCk7XG4gICAgICAgICAgY29uc29sZS5sb2coXCJbVml0ZV0gXHUyNzA1IEV4cHJlc3Mgc2VydmVyIGluaXRpYWxpemVkXCIpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKFwiW1ZpdGVdIFx1Mjc0QyBGYWlsZWQgdG8gaW5pdGlhbGl6ZSBFeHByZXNzOlwiLCBlcnIpO1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlZ2lzdGVyIG1pZGRsZXdhcmUgQkVGT1JFIG90aGVyIG1pZGRsZXdhcmVcbiAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICAgICAgICAvLyBPbmx5IGhhbmRsZSAvYXBpIGFuZCAvaGVhbHRoIHJlcXVlc3RzIHdpdGggdGhlIEV4cHJlc3MgYXBwXG4gICAgICAgICAgaWYgKHJlcS51cmwuc3RhcnRzV2l0aChcIi9hcGlcIikgfHwgcmVxLnVybCA9PT0gXCIvaGVhbHRoXCIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgICBgW1ZpdGUgTWlkZGxld2FyZV0gUm91dGluZyAke3JlcS5tZXRob2R9ICR7cmVxLnVybH0gdG8gRXhwcmVzc2AsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIGFwaVNlcnZlcihyZXEsIHJlcywgbmV4dCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gTGlnaHR3ZWlnaHQgaW4tbWVtb3J5IFdlYlNvY2tldCByb29tcyBhdCAvd3MvOnJvb21JZCBmb3IgZGV2XG4gICAgICAgIGNvbnN0IHdzcyA9IG5ldyBXZWJTb2NrZXRTZXJ2ZXIoeyBub1NlcnZlcjogdHJ1ZSB9KTtcbiAgICAgICAgY29uc3Qgcm9vbXMgPSBuZXcgTWFwKCk7IC8vIHJvb21JZCAtPiBTZXQ8V2ViU29ja2V0PlxuXG4gICAgICAgIHNlcnZlci5odHRwU2VydmVyPy5vbihcInVwZ3JhZGVcIiwgKHJlcXVlc3QsIHNvY2tldCwgaGVhZCkgPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB1cmwgPSByZXF1ZXN0LnVybCB8fCBcIlwiO1xuICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSB1cmwubWF0Y2goL15cXC93c1xcLyguKykkLyk7XG4gICAgICAgICAgICBpZiAoIW1hdGNoKSByZXR1cm47IC8vIG5vdCBvdXIgV1Mgcm91dGVcblxuICAgICAgICAgICAgd3NzLmhhbmRsZVVwZ3JhZGUocmVxdWVzdCwgc29ja2V0LCBoZWFkLCAod3MpID0+IHtcbiAgICAgICAgICAgICAgY29uc3Qgcm9vbUlkID0gZGVjb2RlVVJJQ29tcG9uZW50KG1hdGNoWzFdKTtcbiAgICAgICAgICAgICAgaWYgKCFyb29tcy5oYXMocm9vbUlkKSkgcm9vbXMuc2V0KHJvb21JZCwgbmV3IFNldCgpKTtcbiAgICAgICAgICAgICAgY29uc3Qgc2V0ID0gcm9vbXMuZ2V0KHJvb21JZCk7XG4gICAgICAgICAgICAgIHNldC5hZGQod3MpO1xuXG4gICAgICAgICAgICAgIHdzLm9uKFwibWVzc2FnZVwiLCAoZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBtc2c7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIG1zZyA9IEpTT04ucGFyc2UoZGF0YS50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG1zZyAmJiBtc2cudHlwZSA9PT0gXCJjaGF0XCIpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIGtpbmQ6IFwiY2hhdFwiLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgICAgaWQ6IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpLFxuICAgICAgICAgICAgICAgICAgICAgIHRleHQ6IFN0cmluZyhtc2cudGV4dCB8fCBcIlwiKSxcbiAgICAgICAgICAgICAgICAgICAgICBhdDogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBjbGllbnQgb2Ygc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgY2xpZW50LnNlbmQocGF5bG9hZCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1zZyAmJiBtc2cua2luZCA9PT0gXCJub3RpZmljYXRpb25cIikge1xuICAgICAgICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAga2luZDogXCJub3RpZmljYXRpb25cIixcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogbXNnLmRhdGEsXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY2xpZW50IG9mIHNldCkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgIGNsaWVudC5zZW5kKHBheWxvYWQpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtc2cgJiYgbXNnLnR5cGUgPT09IFwicGluZ1wiKSB7XG4gICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB3cy5zZW5kKEpTT04uc3RyaW5naWZ5KHsga2luZDogXCJwb25nXCIsIHRzOiBEYXRlLm5vdygpIH0pKTtcbiAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgIHdzLm9uKFwiY2xvc2VcIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHNldC5kZWxldGUod3MpO1xuICAgICAgICAgICAgICAgIGlmIChzZXQuc2l6ZSA9PT0gMCkgcm9vbXMuZGVsZXRlKHJvb21JZCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gaWdub3JlIHdzIGVycm9yc1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gRG9uJ3QgcmV0dXJuIGFueXRoaW5nIC0gbWlkZGxld2FyZSBpcyBhbHJlYWR5IHJlZ2lzdGVyZWRcbiAgICAgIH0sXG4gICAgfSxcbiAgXSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6IFwiZGlzdC9zcGFcIixcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgfSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJjbGllbnRcIiksXG4gICAgICBcIkBzaGFyZWRcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJzaGFyZWRcIiksXG4gICAgICBcIkB1dGlsc1wiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcInV0aWxzXCIpLFxuICAgIH0sXG4gIH0sXG59O1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFBeVAsZUFB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
