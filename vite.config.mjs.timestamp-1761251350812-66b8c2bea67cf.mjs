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
    params: [
      rawTx,
      {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        encoding: "base64"
      }
    ]
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
        console.log(
          `Jupiter quote request: ${inputMint} -> ${outputMint}, amount: ${amount}`
        );
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
          try {
            const response = await fetchWithTimeout(8e3);
            lastStatus = response.status;
            if (response.ok) {
              const data = await response.json();
              console.log(`Jupiter quote successful (${response.status})`);
              return res.json(data);
            }
            lastText = await response.text().catch(() => "(unable to read response)");
            if (response.status === 404 || response.status === 400) {
              console.warn(
                `Jupiter quote returned ${response.status} - likely no route for this pair: ${inputMint} -> ${outputMint}`
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
          } catch (fetchError) {
            const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
            console.warn(
              `Fetch error on attempt ${attempt}/2:`,
              errorMsg
            );
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, attempt * 250));
              continue;
            }
            lastText = errorMsg;
            lastStatus = 500;
            break;
          }
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
        mint: "Ghj3B53xFd3qUw3nywhRFbqAnoTEmLbLPaToM7gABm63",
        symbol: "FXM",
        name: "FIXORIUM",
        decimals: 6,
        logoURI: "https://cdn.builder.io/api/v1/image/assets%2F2d0b2b3809b6429b9e89e004f5d46d31%2F4014ec1ff0b64b6491c04ad7c29f00c8?format=webp&width=800",
        balance: 0,
        price: 0,
        priceChange24h: 0
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
import { WebSocketServer } from "file:///app/code/node_modules/ws/index.js";
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic2VydmVyL3JvdXRlcy9zb2xhbmEtcHJveHkudHMiLCAic2VydmVyL3JvdXRlcy9zb2xhbmEtc2VuZC50cyIsICJzZXJ2ZXIvcm91dGVzL3NvbGFuYS1zaW11bGF0ZS50cyIsICJzZXJ2ZXIvcm91dGVzL3dhbGxldC1iYWxhbmNlLnRzIiwgInNlcnZlci9yb3V0ZXMvZXhjaGFuZ2UtcmF0ZS50cyIsICJzZXJ2ZXIvcm91dGVzL2RleHNjcmVlbmVyLXByb3h5LnRzIiwgInNlcnZlci9yb3V0ZXMvc3BsLW1ldGEudHMiLCAic2VydmVyL3JvdXRlcy9qdXBpdGVyLXByb3h5LnRzIiwgInNlcnZlci9yb3V0ZXMvZm9yZXgtcmF0ZS50cyIsICJzZXJ2ZXIvcm91dGVzL3N0YWJsZS0yNGgudHMiLCAic2VydmVyL3JvdXRlcy9wMnAtb3JkZXJzLnRzIiwgInNlcnZlci9yb3V0ZXMvb3JkZXJzLnRzIiwgInNlcnZlci9yb3V0ZXMvZml4b3JpdW0tdG9rZW5zLnRzIiwgInNlcnZlci9pbmRleC50cyIsICJ2aXRlLmNvbmZpZy5tanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc29sYW5hLXByb3h5LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL3NvbGFuYS1wcm94eS50c1wiO2V4cG9ydCBhc3luYyBmdW5jdGlvbiBoYW5kbGVTb2xhbmFScGMocmVxOiBSZXF1ZXN0KTogUHJvbWlzZTxSZXNwb25zZT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXEuanNvbigpO1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goXG4gICAgICBcImh0dHBzOi8vc29sYW5hLW1haW5uZXQuZy5hbGNoZW15LmNvbS92Mi8zWjk5RllXQjF0RkVCcVlTeVY2MHQteDdGc0ZDU0VqWFwiLFxuICAgICAge1xuICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuICAgICAgfVxuICAgICk7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKGRhdGEsIHtcbiAgICAgIGhlYWRlcnM6IHsgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSxcbiAgICAgIHN0YXR1czogcmVzcG9uc2Uuc3RhdHVzLFxuICAgIH0pO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFxuICAgICAgSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogZS5tZXNzYWdlIHx8IFwiUlBDIFByb3h5IGZhaWxlZFwiIH0pLFxuICAgICAgeyBzdGF0dXM6IDUwMCB9XG4gICAgKTtcbiAgfVxufVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc29sYW5hLXNlbmQudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc29sYW5hLXNlbmQudHNcIjtleHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlU29sYW5hU2VuZChyYXdUeDogc3RyaW5nKSB7XG4gIGNvbnN0IGJvZHkgPSB7XG4gICAganNvbnJwYzogXCIyLjBcIixcbiAgICBpZDogMSxcbiAgICBtZXRob2Q6IFwic2VuZFRyYW5zYWN0aW9uXCIsXG4gICAgcGFyYW1zOiBbXG4gICAgICByYXdUeCxcbiAgICAgIHtcbiAgICAgICAgc2tpcFByZWZsaWdodDogZmFsc2UsXG4gICAgICAgIHByZWZsaWdodENvbW1pdG1lbnQ6IFwiY29uZmlybWVkXCIsXG4gICAgICAgIGVuY29kaW5nOiBcImJhc2U2NFwiLFxuICAgICAgfSxcbiAgICBdLFxuICB9O1xuXG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goXG4gICAgXCJodHRwczovL3NvbGFuYS1tYWlubmV0LmcuYWxjaGVteS5jb20vdjIvM1o5OUZZV0IxdEZFQnFZU3lWNjB0LXg3RnNGQ1NFalhcIixcbiAgICB7XG4gICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9LFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSksXG4gICAgfSxcbiAgKTtcblxuICByZXR1cm4gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xufVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc29sYW5hLXNpbXVsYXRlLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL3NvbGFuYS1zaW11bGF0ZS50c1wiO2V4cG9ydCBhc3luYyBmdW5jdGlvbiBoYW5kbGVTb2xhbmFTaW11bGF0ZSh0eEJhc2U2NDogc3RyaW5nKSB7XG4gIGNvbnN0IGJvZHkgPSB7XG4gICAganNvbnJwYzogXCIyLjBcIixcbiAgICBpZDogMSxcbiAgICBtZXRob2Q6IFwic2ltdWxhdGVUcmFuc2FjdGlvblwiLFxuICAgIHBhcmFtczogW3R4QmFzZTY0LCB7IGVuY29kaW5nOiBcImJhc2U2NFwiLCBjb21taXRtZW50OiBcInByb2Nlc3NlZFwiIH1dLFxuICB9O1xuXG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goXG4gICAgXCJodHRwczovL3NvbGFuYS1tYWlubmV0LmcuYWxjaGVteS5jb20vdjIvM1o5OUZZV0IxdEZFQnFZU3lWNjB0LXg3RnNGQ1NFalhcIixcbiAgICB7XG4gICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9LFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSksXG4gICAgfSxcbiAgKTtcblxuICByZXR1cm4gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xufVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvd2FsbGV0LWJhbGFuY2UudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvd2FsbGV0LWJhbGFuY2UudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVXYWxsZXRCYWxhbmNlOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgcHVibGljS2V5IH0gPSByZXEucXVlcnk7XG5cbiAgICBpZiAoIXB1YmxpY0tleSB8fCB0eXBlb2YgcHVibGljS2V5ICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oe1xuICAgICAgICBlcnJvcjogXCJNaXNzaW5nIG9yIGludmFsaWQgJ3B1YmxpY0tleScgcGFyYW1ldGVyXCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBib2R5ID0ge1xuICAgICAganNvbnJwYzogXCIyLjBcIixcbiAgICAgIGlkOiAxLFxuICAgICAgbWV0aG9kOiBcImdldEJhbGFuY2VcIixcbiAgICAgIHBhcmFtczogW3B1YmxpY0tleV0sXG4gICAgfTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goXG4gICAgICBcImh0dHBzOi8vc29sYW5hLW1haW5uZXQuZy5hbGNoZW15LmNvbS92Mi8zWjk5RllXQjF0RkVCcVlTeVY2MHQteDdGc0ZDU0VqWFwiLFxuICAgICAge1xuICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuICAgICAgfSxcbiAgICApO1xuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblxuICAgIGlmIChkYXRhLmVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFwiU29sYW5hIFJQQyBlcnJvcjpcIiwgZGF0YS5lcnJvcik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgICBlcnJvcjogZGF0YS5lcnJvci5tZXNzYWdlIHx8IFwiRmFpbGVkIHRvIGZldGNoIGJhbGFuY2VcIixcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGJhbGFuY2VMYW1wb3J0cyA9IGRhdGEucmVzdWx0O1xuICAgIGNvbnN0IGJhbGFuY2VTT0wgPSBiYWxhbmNlTGFtcG9ydHMgLyAxXzAwMF8wMDBfMDAwO1xuXG4gICAgcmVzLmpzb24oe1xuICAgICAgcHVibGljS2V5LFxuICAgICAgYmFsYW5jZTogYmFsYW5jZVNPTCxcbiAgICAgIGJhbGFuY2VMYW1wb3J0cyxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiV2FsbGV0IGJhbGFuY2UgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIkludGVybmFsIHNlcnZlciBlcnJvclwiLFxuICAgIH0pO1xuICB9XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvZXhjaGFuZ2UtcmF0ZS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9leGNoYW5nZS1yYXRlLnRzXCI7aW1wb3J0IHsgUmVxdWVzdEhhbmRsZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG4vLyBUb2tlbiBtaW50IGFkZHJlc3NlcyBmb3IgU29sYW5hIG1haW5uZXQgKGltcG9ydGVkIGZyb20gc2hhcmVkIGNvbnN0YW50cylcbmNvbnN0IFRPS0VOX01JTlRTID0ge1xuICBTT0w6IFwiU28xMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMlwiLFxuICBVU0RDOiBcIkVQakZXZGQ1QXVmcVNTcWVNMnFOMXh6eWJhcEM4RzR3RUdHa1p3eVREdDF2XCIsXG4gIFVTRFQ6IFwiRXM5dk1GcnphQ0VSbUpmckY0SDJGWUQ0S0NvTmtZMTFNY0NlOEJlbkVuc1wiLFxuICBGSVhFUkNPSU46IFwiSDRxS244Rk1GaGE4akp1ajh4TXJ5TXFSaEgzaDdHakx1eHc3VFZpeHB1bXBcIixcbiAgTE9DS0VSOiBcIkVOMW5Zclc2Mzc1ek1QVWtwa0d5R1NFWFc4V21BcVl1NHloZjZ4bkdwdW1wXCIsXG59IGFzIGNvbnN0O1xuXG5jb25zdCBGQUxMQkFDS19SQVRFUzogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHtcbiAgRklYRVJDT0lOOiAwLjAwNSwgLy8gJDAuMDA1IHBlciBGSVhFUkNPSU5cbiAgU09MOiAxODAsIC8vICQxODAgcGVyIFNPTFxuICBVU0RDOiAxLjAsIC8vICQxIFVTRENcbiAgVVNEVDogMS4wLCAvLyAkMSBVU0RUXG4gIExPQ0tFUjogMC4xLCAvLyAkMC4xIHBlciBMT0NLRVJcbn07XG5cbmNvbnN0IFBLUl9QRVJfVVNEID0gMjgwOyAvLyBBcHByb3hpbWF0ZSBjb252ZXJzaW9uIHJhdGVcbmNvbnN0IE1BUktVUCA9IDEuMDQyNTsgLy8gNC4yNSUgbWFya3VwXG5cbmludGVyZmFjZSBEZXhzY3JlZW5lclJlc3BvbnNlIHtcbiAgcGFpcnM6IEFycmF5PHtcbiAgICBiYXNlVG9rZW46IHsgYWRkcmVzczogc3RyaW5nIH07XG4gICAgcHJpY2VVc2Q/OiBzdHJpbmc7XG4gIH0+O1xufVxuXG5hc3luYyBmdW5jdGlvbiBmZXRjaFRva2VuUHJpY2VGcm9tRGV4U2NyZWVuZXIoXG4gIG1pbnQ6IHN0cmluZyxcbik6IFByb21pc2U8bnVtYmVyIHwgbnVsbD4ge1xuICB0cnkge1xuICAgIGNvbnN0IHVybCA9IGBodHRwczovL2FwaS5kZXhzY3JlZW5lci5jb20vbGF0ZXN0L2RleC90b2tlbnMvJHttaW50fWA7XG4gICAgY29uc29sZS5sb2coYFtEZXhTY3JlZW5lcl0gRmV0Y2hpbmcgcHJpY2UgZm9yICR7bWludH0gZnJvbTogJHt1cmx9YCk7XG5cbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCA4MDAwKTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICBBY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoY29tcGF0aWJsZTsgU29sYW5hV2FsbGV0LzEuMClcIixcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgIGBbRGV4U2NyZWVuZXJdIFx1Mjc0QyBBUEkgcmV0dXJuZWQgJHtyZXNwb25zZS5zdGF0dXN9IGZvciBtaW50ICR7bWludH1gLFxuICAgICAgKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGRhdGEgPSAoYXdhaXQgcmVzcG9uc2UuanNvbigpKSBhcyBEZXhzY3JlZW5lclJlc3BvbnNlO1xuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYFtEZXhTY3JlZW5lcl0gUmVzcG9uc2UgcmVjZWl2ZWQgZm9yICR7bWludH06YCxcbiAgICAgIEpTT04uc3RyaW5naWZ5KGRhdGEpLnN1YnN0cmluZygwLCAyMDApLFxuICAgICk7XG5cbiAgICBpZiAoZGF0YS5wYWlycyAmJiBkYXRhLnBhaXJzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IHByaWNlVXNkID0gZGF0YS5wYWlyc1swXS5wcmljZVVzZDtcbiAgICAgIGlmIChwcmljZVVzZCkge1xuICAgICAgICBjb25zdCBwcmljZSA9IHBhcnNlRmxvYXQocHJpY2VVc2QpO1xuICAgICAgICBjb25zb2xlLmxvZyhgW0RleFNjcmVlbmVyXSBcdTI3MDUgR290IHByaWNlIGZvciAke21pbnR9OiAkJHtwcmljZX1gKTtcbiAgICAgICAgcmV0dXJuIHByaWNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnNvbGUud2FybihgW0RleFNjcmVlbmVyXSBObyBwYWlycyBmb3VuZCBpbiByZXNwb25zZSBmb3IgJHttaW50fWApO1xuICAgIHJldHVybiBudWxsO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBgW0RleFNjcmVlbmVyXSBcdTI3NEMgRmFpbGVkIHRvIGZldGNoICR7bWludH06YCxcbiAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVFeGNoYW5nZVJhdGU6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgdG9rZW4gPSAocmVxLnF1ZXJ5LnRva2VuIGFzIHN0cmluZykgfHwgXCJGSVhFUkNPSU5cIjtcblxuICAgIGxldCBwcmljZVVzZDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbiAgICAvLyBGZXRjaCBwcmljZSBmcm9tIERleFNjcmVlbmVyIGJhc2VkIG9uIHRva2VuXG4gICAgaWYgKHRva2VuID09PSBcIkZJWEVSQ09JTlwiKSB7XG4gICAgICBwcmljZVVzZCA9IGF3YWl0IGZldGNoVG9rZW5QcmljZUZyb21EZXhTY3JlZW5lcihUT0tFTl9NSU5UUy5GSVhFUkNPSU4pO1xuICAgIH0gZWxzZSBpZiAodG9rZW4gPT09IFwiU09MXCIpIHtcbiAgICAgIHByaWNlVXNkID0gYXdhaXQgZmV0Y2hUb2tlblByaWNlRnJvbURleFNjcmVlbmVyKFRPS0VOX01JTlRTLlNPTCk7XG4gICAgfSBlbHNlIGlmICh0b2tlbiA9PT0gXCJVU0RDXCIgfHwgdG9rZW4gPT09IFwiVVNEVFwiKSB7XG4gICAgICAvLyBTdGFibGVjb2lucyBhcmUgYWx3YXlzIH4xIFVTRFxuICAgICAgcHJpY2VVc2QgPSAxLjA7XG4gICAgfSBlbHNlIGlmICh0b2tlbiA9PT0gXCJMT0NLRVJcIikge1xuICAgICAgcHJpY2VVc2QgPSBhd2FpdCBmZXRjaFRva2VuUHJpY2VGcm9tRGV4U2NyZWVuZXIoVE9LRU5fTUlOVFMuTE9DS0VSKTtcbiAgICB9XG5cbiAgICAvLyBGYWxsIGJhY2sgdG8gaGFyZGNvZGVkIHJhdGVzIGlmIERleFNjcmVlbmVyIGZldGNoIGZhaWxzIG9yIHByaWNlIGlzIGludmFsaWRcbiAgICBpZiAocHJpY2VVc2QgPT09IG51bGwgfHwgcHJpY2VVc2QgPD0gMCkge1xuICAgICAgcHJpY2VVc2QgPSBGQUxMQkFDS19SQVRFU1t0b2tlbl0gfHwgRkFMTEJBQ0tfUkFURVMuRklYRVJDT0lOO1xuICAgICAgY29uc29sZS5sb2coXG4gICAgICAgIGBbRXhjaGFuZ2VSYXRlXSBVc2luZyBmYWxsYmFjayByYXRlIGZvciAke3Rva2VufTogJCR7cHJpY2VVc2R9YCxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICBgW0V4Y2hhbmdlUmF0ZV0gRmV0Y2hlZCAke3Rva2VufSBwcmljZSBmcm9tIERleFNjcmVlbmVyOiAkJHtwcmljZVVzZH1gLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBDb252ZXJ0IHRvIFBLUiB3aXRoIG1hcmt1cFxuICAgIGNvbnN0IHJhdGVJblBLUiA9IHByaWNlVXNkICogUEtSX1BFUl9VU0QgKiBNQVJLVVA7XG5cbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbRXhjaGFuZ2VSYXRlXSAke3Rva2VufTogJCR7cHJpY2VVc2QudG9GaXhlZCg2KX0gVVNEIC0+ICR7cmF0ZUluUEtSLnRvRml4ZWQoMil9IFBLUiAod2l0aCAkeyhNQVJLVVAgLSAxKSAqIDEwMH0lIG1hcmt1cClgLFxuICAgICk7XG5cbiAgICByZXMuanNvbih7XG4gICAgICB0b2tlbixcbiAgICAgIHByaWNlVXNkLFxuICAgICAgcHJpY2VJblBLUjogcmF0ZUluUEtSLFxuICAgICAgcmF0ZTogcmF0ZUluUEtSLFxuICAgICAgcGtrUGVyVXNkOiBQS1JfUEVSX1VTRCxcbiAgICAgIG1hcmt1cDogTUFSS1VQLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJbRXhjaGFuZ2VSYXRlXSBFcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBcIkZhaWxlZCB0byBmZXRjaCBleGNoYW5nZSByYXRlXCIsXG4gICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgfSk7XG4gIH1cbn07XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9kZXhzY3JlZW5lci1wcm94eS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9kZXhzY3JlZW5lci1wcm94eS50c1wiO2ltcG9ydCB7IFJlcXVlc3RIYW5kbGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuaW50ZXJmYWNlIERleHNjcmVlbmVyVG9rZW4ge1xuICBjaGFpbklkOiBzdHJpbmc7XG4gIGRleElkOiBzdHJpbmc7XG4gIHVybDogc3RyaW5nO1xuICBwYWlyQWRkcmVzczogc3RyaW5nO1xuICBiYXNlVG9rZW46IHtcbiAgICBhZGRyZXNzOiBzdHJpbmc7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIHN5bWJvbDogc3RyaW5nO1xuICB9O1xuICBxdW90ZVRva2VuOiB7XG4gICAgYWRkcmVzczogc3RyaW5nO1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBzeW1ib2w6IHN0cmluZztcbiAgfTtcbiAgcHJpY2VOYXRpdmU6IHN0cmluZztcbiAgcHJpY2VVc2Q/OiBzdHJpbmc7XG4gIHR4bnM6IHtcbiAgICBtNTogeyBidXlzOiBudW1iZXI7IHNlbGxzOiBudW1iZXIgfTtcbiAgICBoMTogeyBidXlzOiBudW1iZXI7IHNlbGxzOiBudW1iZXIgfTtcbiAgICBoNjogeyBidXlzOiBudW1iZXI7IHNlbGxzOiBudW1iZXIgfTtcbiAgICBoMjQ6IHsgYnV5czogbnVtYmVyOyBzZWxsczogbnVtYmVyIH07XG4gIH07XG4gIHZvbHVtZToge1xuICAgIGgyNDogbnVtYmVyO1xuICAgIGg2OiBudW1iZXI7XG4gICAgaDE6IG51bWJlcjtcbiAgICBtNTogbnVtYmVyO1xuICB9O1xuICBwcmljZUNoYW5nZToge1xuICAgIG01OiBudW1iZXI7XG4gICAgaDE6IG51bWJlcjtcbiAgICBoNjogbnVtYmVyO1xuICAgIGgyNDogbnVtYmVyO1xuICB9O1xuICBsaXF1aWRpdHk/OiB7XG4gICAgdXNkPzogbnVtYmVyO1xuICAgIGJhc2U/OiBudW1iZXI7XG4gICAgcXVvdGU/OiBudW1iZXI7XG4gIH07XG4gIGZkdj86IG51bWJlcjtcbiAgbWFya2V0Q2FwPzogbnVtYmVyO1xuICBpbmZvPzoge1xuICAgIGltYWdlVXJsPzogc3RyaW5nO1xuICAgIHdlYnNpdGVzPzogQXJyYXk8eyBsYWJlbDogc3RyaW5nOyB1cmw6IHN0cmluZyB9PjtcbiAgICBzb2NpYWxzPzogQXJyYXk8eyB0eXBlOiBzdHJpbmc7IHVybDogc3RyaW5nIH0+O1xuICB9O1xufVxuXG5pbnRlcmZhY2UgRGV4c2NyZWVuZXJSZXNwb25zZSB7XG4gIHNjaGVtYVZlcnNpb246IHN0cmluZztcbiAgcGFpcnM6IERleHNjcmVlbmVyVG9rZW5bXTtcbn1cblxuLy8gRGV4U2NyZWVuZXIgZW5kcG9pbnRzIGZvciBmYWlsb3ZlclxuY29uc3QgREVYU0NSRUVORVJfRU5EUE9JTlRTID0gW1xuICBcImh0dHBzOi8vYXBpLmRleHNjcmVlbmVyLmNvbS9sYXRlc3QvZGV4XCIsXG4gIFwiaHR0cHM6Ly9hcGkuZGV4c2NyZWVuZXIuaW8vbGF0ZXN0L2RleFwiLCAvLyBBbHRlcm5hdGl2ZSBkb21haW5cbl07XG5cbmNvbnN0IENBQ0hFX1RUTF9NUyA9IDMwXzAwMDsgLy8gMzAgc2Vjb25kc1xuY29uc3QgTUFYX1RPS0VOU19QRVJfQkFUQ0ggPSAyMDtcblxubGV0IGN1cnJlbnRFbmRwb2ludEluZGV4ID0gMDtcbmNvbnN0IGNhY2hlID0gbmV3IE1hcDxcbiAgc3RyaW5nLFxuICB7IGRhdGE6IERleHNjcmVlbmVyUmVzcG9uc2U7IGV4cGlyZXNBdDogbnVtYmVyIH1cbj4oKTtcbmNvbnN0IGluZmxpZ2h0UmVxdWVzdHMgPSBuZXcgTWFwPHN0cmluZywgUHJvbWlzZTxEZXhzY3JlZW5lclJlc3BvbnNlPj4oKTtcblxuY29uc3QgdHJ5RGV4c2NyZWVuZXJFbmRwb2ludHMgPSBhc3luYyAoXG4gIHBhdGg6IHN0cmluZyxcbik6IFByb21pc2U8RGV4c2NyZWVuZXJSZXNwb25zZT4gPT4ge1xuICBsZXQgbGFzdEVycm9yOiBFcnJvciB8IG51bGwgPSBudWxsO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgREVYU0NSRUVORVJfRU5EUE9JTlRTLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZW5kcG9pbnRJbmRleCA9XG4gICAgICAoY3VycmVudEVuZHBvaW50SW5kZXggKyBpKSAlIERFWFNDUkVFTkVSX0VORFBPSU5UUy5sZW5ndGg7XG4gICAgY29uc3QgZW5kcG9pbnQgPSBERVhTQ1JFRU5FUl9FTkRQT0lOVFNbZW5kcG9pbnRJbmRleF07XG4gICAgY29uc3QgdXJsID0gYCR7ZW5kcG9pbnR9JHtwYXRofWA7XG5cbiAgICB0cnkge1xuICAgICAgY29uc29sZS5sb2coYFRyeWluZyBEZXhTY3JlZW5lciBBUEk6ICR7dXJsfWApO1xuXG4gICAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIDEyMDAwKTsgLy8gMTJzIHRpbWVvdXRcblxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoY29tcGF0aWJsZTsgU29sYW5hV2FsbGV0LzEuMClcIixcbiAgICAgICAgfSxcbiAgICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICAgIH0pO1xuXG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcblxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MjkpIHtcbiAgICAgICAgICAvLyBSYXRlIGxpbWl0ZWQgLSB0cnkgbmV4dCBlbmRwb2ludFxuICAgICAgICAgIGNvbnNvbGUud2FybihgUmF0ZSBsaW1pdGVkIG9uICR7ZW5kcG9pbnR9LCB0cnlpbmcgbmV4dC4uLmApO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgSFRUUCAke3Jlc3BvbnNlLnN0YXR1c306ICR7cmVzcG9uc2Uuc3RhdHVzVGV4dH1gKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZGF0YSA9IChhd2FpdCByZXNwb25zZS5qc29uKCkpIGFzIERleHNjcmVlbmVyUmVzcG9uc2U7XG5cbiAgICAgIC8vIFN1Y2Nlc3MgLSB1cGRhdGUgY3VycmVudCBlbmRwb2ludFxuICAgICAgY3VycmVudEVuZHBvaW50SW5kZXggPSBlbmRwb2ludEluZGV4O1xuICAgICAgY29uc29sZS5sb2coYERleFNjcmVlbmVyIEFQSSBjYWxsIHN1Y2Nlc3NmdWwgdmlhICR7ZW5kcG9pbnR9YCk7XG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc3QgZXJyb3JNc2cgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgICBjb25zb2xlLndhcm4oYERleFNjcmVlbmVyIGVuZHBvaW50ICR7ZW5kcG9pbnR9IGZhaWxlZDpgLCBlcnJvck1zZyk7XG4gICAgICBsYXN0RXJyb3IgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IgOiBuZXcgRXJyb3IoU3RyaW5nKGVycm9yKSk7XG5cbiAgICAgIC8vIFNtYWxsIGRlbGF5IGJlZm9yZSB0cnlpbmcgbmV4dCBlbmRwb2ludFxuICAgICAgaWYgKGkgPCBERVhTQ1JFRU5FUl9FTkRQT0lOVFMubGVuZ3RoIC0gMSkge1xuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCAxMDAwKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgIGBBbGwgRGV4U2NyZWVuZXIgZW5kcG9pbnRzIGZhaWxlZC4gTGFzdCBlcnJvcjogJHtsYXN0RXJyb3I/Lm1lc3NhZ2UgfHwgXCJVbmtub3duIGVycm9yXCJ9YCxcbiAgKTtcbn07XG5cbmNvbnN0IGZldGNoRGV4c2NyZWVuZXJEYXRhID0gYXN5bmMgKFxuICBwYXRoOiBzdHJpbmcsXG4pOiBQcm9taXNlPERleHNjcmVlbmVyUmVzcG9uc2U+ID0+IHtcbiAgY29uc3QgY2FjaGVkID0gY2FjaGUuZ2V0KHBhdGgpO1xuICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXG4gIGlmIChjYWNoZWQgJiYgY2FjaGVkLmV4cGlyZXNBdCA+IG5vdykge1xuICAgIHJldHVybiBjYWNoZWQuZGF0YTtcbiAgfVxuXG4gIGNvbnN0IGV4aXN0aW5nID0gaW5mbGlnaHRSZXF1ZXN0cy5nZXQocGF0aCk7XG4gIGlmIChleGlzdGluZykge1xuICAgIHJldHVybiBleGlzdGluZztcbiAgfVxuXG4gIGNvbnN0IHJlcXVlc3QgPSAoYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgdHJ5RGV4c2NyZWVuZXJFbmRwb2ludHMocGF0aCk7XG4gICAgICBjYWNoZS5zZXQocGF0aCwgeyBkYXRhLCBleHBpcmVzQXQ6IERhdGUubm93KCkgKyBDQUNIRV9UVExfTVMgfSk7XG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgaW5mbGlnaHRSZXF1ZXN0cy5kZWxldGUocGF0aCk7XG4gICAgfVxuICB9KSgpO1xuXG4gIGluZmxpZ2h0UmVxdWVzdHMuc2V0KHBhdGgsIHJlcXVlc3QpO1xuICByZXR1cm4gcmVxdWVzdDtcbn07XG5cbmNvbnN0IG1lcmdlUGFpcnNCeVRva2VuID0gKHBhaXJzOiBEZXhzY3JlZW5lclRva2VuW10pOiBEZXhzY3JlZW5lclRva2VuW10gPT4ge1xuICBjb25zdCBieU1pbnQgPSBuZXcgTWFwPHN0cmluZywgRGV4c2NyZWVuZXJUb2tlbj4oKTtcblxuICBwYWlycy5mb3JFYWNoKChwYWlyKSA9PiB7XG4gICAgY29uc3QgbWludCA9IHBhaXIuYmFzZVRva2VuPy5hZGRyZXNzIHx8IHBhaXIucGFpckFkZHJlc3M7XG4gICAgaWYgKCFtaW50KSByZXR1cm47XG5cbiAgICBjb25zdCBleGlzdGluZyA9IGJ5TWludC5nZXQobWludCk7XG4gICAgY29uc3QgZXhpc3RpbmdMaXF1aWRpdHkgPSBleGlzdGluZz8ubGlxdWlkaXR5Py51c2QgPz8gMDtcbiAgICBjb25zdCBjYW5kaWRhdGVMaXF1aWRpdHkgPSBwYWlyLmxpcXVpZGl0eT8udXNkID8/IDA7XG5cbiAgICBpZiAoIWV4aXN0aW5nIHx8IGNhbmRpZGF0ZUxpcXVpZGl0eSA+IGV4aXN0aW5nTGlxdWlkaXR5KSB7XG4gICAgICBieU1pbnQuc2V0KG1pbnQsIHBhaXIpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIEFycmF5LmZyb20oYnlNaW50LnZhbHVlcygpKTtcbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVEZXhzY3JlZW5lclRva2VuczogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IG1pbnRzIH0gPSByZXEucXVlcnk7XG5cbiAgICBpZiAoIW1pbnRzIHx8IHR5cGVvZiBtaW50cyAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgY29uc29sZS53YXJuKGBbRGV4U2NyZWVuZXJdIEludmFsaWQgbWludHMgcGFyYW1ldGVyOmAsIG1pbnRzKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7XG4gICAgICAgIGVycm9yOlxuICAgICAgICAgIFwiTWlzc2luZyBvciBpbnZhbGlkICdtaW50cycgcGFyYW1ldGVyLiBFeHBlY3RlZCBjb21tYS1zZXBhcmF0ZWQgdG9rZW4gbWludHMuXCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZyhgW0RleFNjcmVlbmVyXSBUb2tlbnMgcmVxdWVzdCBmb3IgbWludHM6ICR7bWludHN9YCk7XG5cbiAgICBjb25zdCByYXdNaW50cyA9IG1pbnRzXG4gICAgICAuc3BsaXQoXCIsXCIpXG4gICAgICAubWFwKChtaW50KSA9PiBtaW50LnRyaW0oKSlcbiAgICAgIC5maWx0ZXIoQm9vbGVhbik7XG5cbiAgICBjb25zdCB1bmlxdWVNaW50cyA9IEFycmF5LmZyb20obmV3IFNldChyYXdNaW50cykpO1xuXG4gICAgaWYgKHVuaXF1ZU1pbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IFwiTm8gdmFsaWQgdG9rZW4gbWludHMgcHJvdmlkZWQuXCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBiYXRjaGVzOiBzdHJpbmdbXVtdID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB1bmlxdWVNaW50cy5sZW5ndGg7IGkgKz0gTUFYX1RPS0VOU19QRVJfQkFUQ0gpIHtcbiAgICAgIGJhdGNoZXMucHVzaCh1bmlxdWVNaW50cy5zbGljZShpLCBpICsgTUFYX1RPS0VOU19QRVJfQkFUQ0gpKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHRzOiBEZXhzY3JlZW5lclRva2VuW10gPSBbXTtcbiAgICBsZXQgc2NoZW1hVmVyc2lvbiA9IFwiMS4wLjBcIjtcblxuICAgIGZvciAoY29uc3QgYmF0Y2ggb2YgYmF0Y2hlcykge1xuICAgICAgY29uc3QgcGF0aCA9IGAvdG9rZW5zLyR7YmF0Y2guam9pbihcIixcIil9YDtcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBmZXRjaERleHNjcmVlbmVyRGF0YShwYXRoKTtcbiAgICAgIGlmIChkYXRhPy5zY2hlbWFWZXJzaW9uKSB7XG4gICAgICAgIHNjaGVtYVZlcnNpb24gPSBkYXRhLnNjaGVtYVZlcnNpb247XG4gICAgICB9XG5cbiAgICAgIGlmICghZGF0YSB8fCAhQXJyYXkuaXNBcnJheShkYXRhLnBhaXJzKSkge1xuICAgICAgICBjb25zb2xlLndhcm4oXCJJbnZhbGlkIHJlc3BvbnNlIGZvcm1hdCBmcm9tIERleFNjcmVlbmVyIEFQSSBiYXRjaFwiKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHJlc3VsdHMucHVzaCguLi5kYXRhLnBhaXJzKTtcbiAgICB9XG5cbiAgICBjb25zdCBzb2xhbmFQYWlycyA9IG1lcmdlUGFpcnNCeVRva2VuKHJlc3VsdHMpXG4gICAgICAuZmlsdGVyKChwYWlyOiBEZXhzY3JlZW5lclRva2VuKSA9PiBwYWlyLmNoYWluSWQgPT09IFwic29sYW5hXCIpXG4gICAgICAuc29ydCgoYTogRGV4c2NyZWVuZXJUb2tlbiwgYjogRGV4c2NyZWVuZXJUb2tlbikgPT4ge1xuICAgICAgICBjb25zdCBhTGlxdWlkaXR5ID0gYS5saXF1aWRpdHk/LnVzZCB8fCAwO1xuICAgICAgICBjb25zdCBiTGlxdWlkaXR5ID0gYi5saXF1aWRpdHk/LnVzZCB8fCAwO1xuICAgICAgICBpZiAoYkxpcXVpZGl0eSAhPT0gYUxpcXVpZGl0eSkgcmV0dXJuIGJMaXF1aWRpdHkgLSBhTGlxdWlkaXR5O1xuXG4gICAgICAgIGNvbnN0IGFWb2x1bWUgPSBhLnZvbHVtZT8uaDI0IHx8IDA7XG4gICAgICAgIGNvbnN0IGJWb2x1bWUgPSBiLnZvbHVtZT8uaDI0IHx8IDA7XG4gICAgICAgIHJldHVybiBiVm9sdW1lIC0gYVZvbHVtZTtcbiAgICAgIH0pO1xuXG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0RleFNjcmVlbmVyXSBcdTI3MDUgUmVzcG9uc2U6ICR7c29sYW5hUGFpcnMubGVuZ3RofSBTb2xhbmEgcGFpcnMgZm91bmQgYWNyb3NzICR7YmF0Y2hlcy5sZW5ndGh9IGJhdGNoKGVzKWAsXG4gICAgKTtcbiAgICByZXMuanNvbih7IHNjaGVtYVZlcnNpb24sIHBhaXJzOiBzb2xhbmFQYWlycyB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiW0RleFNjcmVlbmVyXSBcdTI3NEMgVG9rZW5zIHByb3h5IGVycm9yOlwiLCB7XG4gICAgICBtaW50czogcmVxLnF1ZXJ5Lm1pbnRzLFxuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICAgIHN0YWNrOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3Iuc3RhY2sgOiB1bmRlZmluZWQsXG4gICAgfSk7XG5cbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBlcnJvcjoge1xuICAgICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgZXJyb3JcIixcbiAgICAgICAgZGV0YWlsczogU3RyaW5nKGVycm9yKSxcbiAgICAgIH0sXG4gICAgICBzY2hlbWFWZXJzaW9uOiBcIjEuMC4wXCIsXG4gICAgICBwYWlyczogW10sXG4gICAgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVEZXhzY3JlZW5lclNlYXJjaDogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHEgfSA9IHJlcS5xdWVyeTtcblxuICAgIGlmICghcSB8fCB0eXBlb2YgcSAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IFwiTWlzc2luZyBvciBpbnZhbGlkICdxJyBwYXJhbWV0ZXIgZm9yIHNlYXJjaCBxdWVyeS5cIixcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKGBbRGV4U2NyZWVuZXJdIFNlYXJjaCByZXF1ZXN0IGZvcjogJHtxfWApO1xuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IGZldGNoRGV4c2NyZWVuZXJEYXRhKFxuICAgICAgYC9zZWFyY2gvP3E9JHtlbmNvZGVVUklDb21wb25lbnQocSl9YCxcbiAgICApO1xuXG4gICAgLy8gRmlsdGVyIGZvciBTb2xhbmEgcGFpcnMgYW5kIGxpbWl0IHJlc3VsdHNcbiAgICBjb25zdCBzb2xhbmFQYWlycyA9IChkYXRhLnBhaXJzIHx8IFtdKVxuICAgICAgLmZpbHRlcigocGFpcjogRGV4c2NyZWVuZXJUb2tlbikgPT4gcGFpci5jaGFpbklkID09PSBcInNvbGFuYVwiKVxuICAgICAgLnNsaWNlKDAsIDIwKTsgLy8gTGltaXQgdG8gMjAgcmVzdWx0c1xuXG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0RleFNjcmVlbmVyXSBcdTI3MDUgU2VhcmNoIHJlc3BvbnNlOiAke3NvbGFuYVBhaXJzLmxlbmd0aH0gcmVzdWx0c2AsXG4gICAgKTtcbiAgICByZXMuanNvbih7XG4gICAgICBzY2hlbWFWZXJzaW9uOiBkYXRhLnNjaGVtYVZlcnNpb24gfHwgXCIxLjAuMFwiLFxuICAgICAgcGFpcnM6IHNvbGFuYVBhaXJzLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJbRGV4U2NyZWVuZXJdIFx1Mjc0QyBTZWFyY2ggcHJveHkgZXJyb3I6XCIsIHtcbiAgICAgIHF1ZXJ5OiByZXEucXVlcnkucSxcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgfSk7XG5cbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBlcnJvcjoge1xuICAgICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgZXJyb3JcIixcbiAgICAgICAgZGV0YWlsczogU3RyaW5nKGVycm9yKSxcbiAgICAgIH0sXG4gICAgICBzY2hlbWFWZXJzaW9uOiBcIjEuMC4wXCIsXG4gICAgICBwYWlyczogW10sXG4gICAgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVEZXhzY3JlZW5lclRyZW5kaW5nOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnNvbGUubG9nKFwiW0RleFNjcmVlbmVyXSBUcmVuZGluZyB0b2tlbnMgcmVxdWVzdFwiKTtcblxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBmZXRjaERleHNjcmVlbmVyRGF0YShcIi9wYWlycy9zb2xhbmFcIik7XG5cbiAgICAvLyBHZXQgdG9wIHRyZW5kaW5nIHBhaXJzLCBzb3J0ZWQgYnkgdm9sdW1lIGFuZCBsaXF1aWRpdHlcbiAgICBjb25zdCB0cmVuZGluZ1BhaXJzID0gKGRhdGEucGFpcnMgfHwgW10pXG4gICAgICAuZmlsdGVyKFxuICAgICAgICAocGFpcjogRGV4c2NyZWVuZXJUb2tlbikgPT5cbiAgICAgICAgICBwYWlyLnZvbHVtZT8uaDI0ID4gMTAwMCAmJiAvLyBNaW5pbXVtIHZvbHVtZSBmaWx0ZXJcbiAgICAgICAgICBwYWlyLmxpcXVpZGl0eT8udXNkICYmXG4gICAgICAgICAgcGFpci5saXF1aWRpdHkudXNkID4gMTAwMDAsIC8vIE1pbmltdW0gbGlxdWlkaXR5IGZpbHRlclxuICAgICAgKVxuICAgICAgLnNvcnQoKGE6IERleHNjcmVlbmVyVG9rZW4sIGI6IERleHNjcmVlbmVyVG9rZW4pID0+IHtcbiAgICAgICAgLy8gU29ydCBieSAyNGggdm9sdW1lXG4gICAgICAgIGNvbnN0IGFWb2x1bWUgPSBhLnZvbHVtZT8uaDI0IHx8IDA7XG4gICAgICAgIGNvbnN0IGJWb2x1bWUgPSBiLnZvbHVtZT8uaDI0IHx8IDA7XG4gICAgICAgIHJldHVybiBiVm9sdW1lIC0gYVZvbHVtZTtcbiAgICAgIH0pXG4gICAgICAuc2xpY2UoMCwgNTApOyAvLyBUb3AgNTAgdHJlbmRpbmdcblxuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYFtEZXhTY3JlZW5lcl0gXHUyNzA1IFRyZW5kaW5nIHJlc3BvbnNlOiAke3RyZW5kaW5nUGFpcnMubGVuZ3RofSB0cmVuZGluZyBwYWlyc2AsXG4gICAgKTtcbiAgICByZXMuanNvbih7XG4gICAgICBzY2hlbWFWZXJzaW9uOiBkYXRhLnNjaGVtYVZlcnNpb24gfHwgXCIxLjAuMFwiLFxuICAgICAgcGFpcnM6IHRyZW5kaW5nUGFpcnMsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIltEZXhTY3JlZW5lcl0gXHUyNzRDIFRyZW5kaW5nIHByb3h5IGVycm9yOlwiLCB7XG4gICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgIH0pO1xuXG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgZXJyb3I6IHtcbiAgICAgICAgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIkludGVybmFsIGVycm9yXCIsXG4gICAgICAgIGRldGFpbHM6IFN0cmluZyhlcnJvciksXG4gICAgICB9LFxuICAgICAgc2NoZW1hVmVyc2lvbjogXCIxLjAuMFwiLFxuICAgICAgcGFpcnM6IFtdLFxuICAgIH0pO1xuICB9XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc3BsLW1ldGEudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc3BsLW1ldGEudHNcIjtpbXBvcnQgdHlwZSB7IFJlcXVlc3RIYW5kbGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZVN1Ym1pdFNwbE1ldGE6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3Qge1xuICAgICAgbmFtZSxcbiAgICAgIHN5bWJvbCxcbiAgICAgIGRlc2NyaXB0aW9uLFxuICAgICAgbG9nb1VSSSxcbiAgICAgIHdlYnNpdGUsXG4gICAgICB0d2l0dGVyLFxuICAgICAgdGVsZWdyYW0sXG4gICAgICBkZXhwYWlyLFxuICAgICAgbGFzdFVwZGF0ZWQsXG4gICAgfSA9IHJlcS5ib2R5IHx8IHt9O1xuXG4gICAgLy8gQmFzaWMgdmFsaWRhdGlvblxuICAgIGlmICghbmFtZSB8fCAhc3ltYm9sKSB7XG4gICAgICByZXR1cm4gcmVzXG4gICAgICAgIC5zdGF0dXMoNDAwKVxuICAgICAgICAuanNvbih7IGVycm9yOiBcIk1pc3NpbmcgcmVxdWlyZWQgZmllbGRzOiBuYW1lLCBzeW1ib2xcIiB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBwYXlsb2FkID0ge1xuICAgICAgbmFtZTogU3RyaW5nKG5hbWUpLFxuICAgICAgc3ltYm9sOiBTdHJpbmcoc3ltYm9sKSxcbiAgICAgIGRlc2NyaXB0aW9uOiBTdHJpbmcoZGVzY3JpcHRpb24gfHwgXCJcIiksXG4gICAgICBsb2dvVVJJOiBTdHJpbmcobG9nb1VSSSB8fCBcIlwiKSxcbiAgICAgIHdlYnNpdGU6IFN0cmluZyh3ZWJzaXRlIHx8IFwiXCIpLFxuICAgICAgdHdpdHRlcjogU3RyaW5nKHR3aXR0ZXIgfHwgXCJcIiksXG4gICAgICB0ZWxlZ3JhbTogU3RyaW5nKHRlbGVncmFtIHx8IFwiXCIpLFxuICAgICAgZGV4cGFpcjogU3RyaW5nKGRleHBhaXIgfHwgXCJcIiksXG4gICAgICBsYXN0VXBkYXRlZDogbGFzdFVwZGF0ZWRcbiAgICAgICAgPyBuZXcgRGF0ZShsYXN0VXBkYXRlZCkudG9JU09TdHJpbmcoKVxuICAgICAgICA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIHJlY2VpdmVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIHNvdXJjZTogXCJzcGwtbWV0YS1mb3JtXCIsXG4gICAgfTtcblxuICAgIC8vIEZvciBub3csIGp1c3QgYWNrbm93bGVkZ2UgcmVjZWlwdC4gRXh0ZXJuYWwgZGlyZWN0b3JpZXMgKFNvbHNjYW4vRGV4c2NyZWVuZXIpXG4gICAgLy8gdHlwaWNhbGx5IHJlcXVpcmUgbWFudWFsIHZlcmlmaWNhdGlvbiBvciBwYXJ0bmVyIEFQSXMuXG4gICAgLy8gWW91IGNhbiB3aXJlIHRoaXMgdG8gYSB3ZWJob29rIG9yIHNlcnZpY2Ugd2l0aCBjcmVkZW50aWFscy5cbiAgICBjb25zb2xlLmxvZyhcIltTUEwtTUVUQV0gU3VibWlzc2lvbiByZWNlaXZlZDpcIiwgcGF5bG9hZCk7XG5cbiAgICByZXR1cm4gcmVzLnN0YXR1cygyMDIpLmpzb24oeyBzdGF0dXM6IFwicXVldWVkXCIsIHBheWxvYWQgfSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnN0IG1zZyA9IGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiBTdHJpbmcoZXJyKTtcbiAgICBjb25zb2xlLmVycm9yKFwiW1NQTC1NRVRBXSBTdWJtaXQgZXJyb3I6XCIsIG1zZyk7XG4gICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IG1zZyB9KTtcbiAgfVxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2p1cGl0ZXItcHJveHkudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvanVwaXRlci1wcm94eS50c1wiO2ltcG9ydCB7IFJlcXVlc3RIYW5kbGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuaW50ZXJmYWNlIEp1cGl0ZXJQcmljZVJlc3BvbnNlIHtcbiAgZGF0YTogUmVjb3JkPHN0cmluZywgeyBwcmljZTogbnVtYmVyIH0+O1xufVxuXG4vLyBKdXBpdGVyIGVuZHBvaW50c1xuY29uc3QgSlVQSVRFUl9QUklDRV9FTkRQT0lOVFMgPSBbXG4gIFwiaHR0cHM6Ly9wcmljZS5qdXAuYWcvdjRcIixcbiAgXCJodHRwczovL2FwaS5qdXAuYWcvcHJpY2UvdjJcIixcbl07XG5jb25zdCBKVVBJVEVSX1NXQVBfQkFTRSA9IFwiaHR0cHM6Ly9saXRlLWFwaS5qdXAuYWcvc3dhcC92MVwiO1xuXG5sZXQgY3VycmVudEVuZHBvaW50SW5kZXggPSAwO1xuXG5jb25zdCB0cnlKdXBpdGVyRW5kcG9pbnRzID0gYXN5bmMgKFxuICBwYXRoOiBzdHJpbmcsXG4gIHBhcmFtczogVVJMU2VhcmNoUGFyYW1zLFxuKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgbGV0IGxhc3RFcnJvcjogRXJyb3IgfCBudWxsID0gbnVsbDtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IEpVUElURVJfUFJJQ0VfRU5EUE9JTlRTLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZW5kcG9pbnRJbmRleCA9XG4gICAgICAoY3VycmVudEVuZHBvaW50SW5kZXggKyBpKSAlIEpVUElURVJfUFJJQ0VfRU5EUE9JTlRTLmxlbmd0aDtcbiAgICBjb25zdCBlbmRwb2ludCA9IEpVUElURVJfUFJJQ0VfRU5EUE9JTlRTW2VuZHBvaW50SW5kZXhdO1xuICAgIGNvbnN0IHVybCA9IGAke2VuZHBvaW50fSR7cGF0aH0/JHtwYXJhbXMudG9TdHJpbmcoKX1gO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnNvbGUubG9nKGBUcnlpbmcgSnVwaXRlciBBUEk6ICR7dXJsfWApO1xuXG4gICAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIDUwMDApO1xuXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICBBY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChjb21wYXRpYmxlOyBTb2xhbmFXYWxsZXQvMS4wKVwiLFxuICAgICAgICB9LFxuICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgfSk7XG5cbiAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQyOSkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgUmF0ZSBsaW1pdGVkIG9uICR7ZW5kcG9pbnR9LCB0cnlpbmcgbmV4dC4uLmApO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgSFRUUCAke3Jlc3BvbnNlLnN0YXR1c306ICR7cmVzcG9uc2Uuc3RhdHVzVGV4dH1gKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblxuICAgICAgY3VycmVudEVuZHBvaW50SW5kZXggPSBlbmRwb2ludEluZGV4O1xuICAgICAgY29uc29sZS5sb2coYEp1cGl0ZXIgQVBJIGNhbGwgc3VjY2Vzc2Z1bCB2aWEgJHtlbmRwb2ludH1gKTtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zdCBlcnJvck1zZyA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbiAgICAgIGNvbnNvbGUud2FybihgSnVwaXRlciBlbmRwb2ludCAke2VuZHBvaW50fSBmYWlsZWQ6YCwgZXJyb3JNc2cpO1xuICAgICAgbGFzdEVycm9yID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yIDogbmV3IEVycm9yKFN0cmluZyhlcnJvcikpO1xuXG4gICAgICBpZiAoaSA8IEpVUElURVJfUFJJQ0VfRU5EUE9JTlRTLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMTAwMCkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHRocm93IG5ldyBFcnJvcihcbiAgICBgQWxsIEp1cGl0ZXIgZW5kcG9pbnRzIGZhaWxlZC4gTGFzdCBlcnJvcjogJHtsYXN0RXJyb3I/Lm1lc3NhZ2UgfHwgXCJVbmtub3duIGVycm9yXCJ9YCxcbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVKdXBpdGVyUHJpY2U6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBpZHMgfSA9IHJlcS5xdWVyeTtcblxuICAgIGlmICghaWRzIHx8IHR5cGVvZiBpZHMgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7XG4gICAgICAgIGVycm9yOlxuICAgICAgICAgIFwiTWlzc2luZyBvciBpbnZhbGlkICdpZHMnIHBhcmFtZXRlci4gRXhwZWN0ZWQgY29tbWEtc2VwYXJhdGVkIHRva2VuIG1pbnRzLlwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coYEp1cGl0ZXIgcHJpY2UgcmVxdWVzdCBmb3IgdG9rZW5zOiAke2lkc31gKTtcblxuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgICAgaWRzOiBpZHMsXG4gICAgfSk7XG5cbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdHJ5SnVwaXRlckVuZHBvaW50cyhcIi9wcmljZVwiLCBwYXJhbXMpO1xuXG4gICAgaWYgKCFkYXRhIHx8IHR5cGVvZiBkYXRhICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHJlc3BvbnNlIGZvcm1hdCBmcm9tIEp1cGl0ZXIgQVBJXCIpO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYEp1cGl0ZXIgcHJpY2UgcmVzcG9uc2U6ICR7T2JqZWN0LmtleXMoZGF0YS5kYXRhIHx8IHt9KS5sZW5ndGh9IHRva2Vuc2AsXG4gICAgKTtcbiAgICByZXMuanNvbihkYXRhKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiSnVwaXRlciBwcmljZSBwcm94eSBlcnJvcjpcIiwge1xuICAgICAgaWRzOiByZXEucXVlcnkuaWRzLFxuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICAgIHN0YWNrOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3Iuc3RhY2sgOiB1bmRlZmluZWQsXG4gICAgfSk7XG5cbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBlcnJvcjoge1xuICAgICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgZXJyb3JcIixcbiAgICAgICAgZGV0YWlsczogU3RyaW5nKGVycm9yKSxcbiAgICAgIH0sXG4gICAgICBkYXRhOiB7fSxcbiAgICB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUp1cGl0ZXJUb2tlbnM6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyB0eXBlID0gXCJzdHJpY3RcIiB9ID0gcmVxLnF1ZXJ5IGFzIHsgdHlwZT86IHN0cmluZyB9O1xuXG4gICAgY29uc29sZS5sb2coYEp1cGl0ZXIgdG9rZW5zIHJlcXVlc3Q6ICR7dHlwZX1gKTtcblxuICAgIGNvbnN0IHR5cGVzVG9UcnkgPSBbdHlwZSB8fCBcInN0cmljdFwiLCBcImFsbFwiXTsgLy8gZmFsbGJhY2sgdG8gJ2FsbCcgaWYgJ3N0cmljdCcgZmFpbHNcbiAgICBjb25zdCBiYXNlRW5kcG9pbnRzID0gKHQ6IHN0cmluZykgPT4gW1xuICAgICAgYGh0dHBzOi8vdG9rZW4uanVwLmFnLyR7dH1gLFxuICAgICAgXCJodHRwczovL2NhY2hlLmp1cC5hZy90b2tlbnNcIixcbiAgICBdO1xuXG4gICAgY29uc3QgZmV0Y2hXaXRoVGltZW91dCA9ICh1cmw6IHN0cmluZywgdGltZW91dE1zOiBudW1iZXIpID0+IHtcbiAgICAgIGNvbnN0IHRpbWVvdXRQcm9taXNlID0gbmV3IFByb21pc2U8UmVzcG9uc2U+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgIHNldFRpbWVvdXQoXG4gICAgICAgICAgKCkgPT5cbiAgICAgICAgICAgIHJlc29sdmUoXG4gICAgICAgICAgICAgIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogNTA0LCBzdGF0dXNUZXh0OiBcIkdhdGV3YXkgVGltZW91dFwiIH0pLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICB0aW1lb3V0TXMsXG4gICAgICAgICk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBQcm9taXNlLnJhY2UoW1xuICAgICAgICBmZXRjaCh1cmwsIHtcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgICAgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKGNvbXBhdGlibGU7IFNvbGFuYVdhbGxldC8xLjApXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSksXG4gICAgICAgIHRpbWVvdXRQcm9taXNlLFxuICAgICAgXSkgYXMgUHJvbWlzZTxSZXNwb25zZT47XG4gICAgfTtcblxuICAgIGxldCBsYXN0RXJyb3I6IHN0cmluZyA9IFwiXCI7XG5cbiAgICBmb3IgKGNvbnN0IHQgb2YgdHlwZXNUb1RyeSkge1xuICAgICAgY29uc3QgZW5kcG9pbnRzID0gYmFzZUVuZHBvaW50cyh0KTtcbiAgICAgIGZvciAobGV0IGF0dGVtcHQgPSAxOyBhdHRlbXB0IDw9IDI7IGF0dGVtcHQrKykge1xuICAgICAgICBmb3IgKGNvbnN0IGVuZHBvaW50IG9mIGVuZHBvaW50cykge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoV2l0aFRpbWVvdXQoZW5kcG9pbnQsIDgwMDApO1xuICAgICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgICBsYXN0RXJyb3IgPSBgJHtlbmRwb2ludH0gLT4gJHtyZXNwb25zZS5zdGF0dXN9ICR7cmVzcG9uc2Uuc3RhdHVzVGV4dH1gO1xuICAgICAgICAgICAgICAvLyByZXRyeSBvbiByYXRlIGxpbWl0aW5nIC8gc2VydmVyIGVycm9yc1xuICAgICAgICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MjkgfHwgcmVzcG9uc2Uuc3RhdHVzID49IDUwMCkgY29udGludWU7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgICAgIGNvbnN0IGNvdW50ID0gQXJyYXkuaXNBcnJheShkYXRhKSA/IGRhdGEubGVuZ3RoIDogMDtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgICBgSnVwaXRlciB0b2tlbnMgcmVzcG9uc2UgKCR7dH0pIHZpYSAke2VuZHBvaW50fTogJHtjb3VudH0gdG9rZW5zYCxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gcmVzLmpzb24oZGF0YSk7XG4gICAgICAgICAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgICAgICAgICBsYXN0RXJyb3IgPSBgJHtlbmRwb2ludH0gLT4gJHtlPy5tZXNzYWdlIHx8IFN0cmluZyhlKX1gO1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBKdXBpdGVyIHRva2VucyBmZXRjaCBmYWlsZWQ6ICR7bGFzdEVycm9yfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocikgPT4gc2V0VGltZW91dChyLCBhdHRlbXB0ICogMjUwKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAyKS5qc29uKHtcbiAgICAgIGVycm9yOiB7XG4gICAgICAgIG1lc3NhZ2U6IFwiQWxsIEp1cGl0ZXIgdG9rZW4gZW5kcG9pbnRzIGZhaWxlZFwiLFxuICAgICAgICBkZXRhaWxzOiBsYXN0RXJyb3IgfHwgXCJVbmtub3duIGVycm9yXCIsXG4gICAgICB9LFxuICAgICAgZGF0YTogW10sXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkp1cGl0ZXIgdG9rZW5zIHByb3h5IGVycm9yOlwiLCB7XG4gICAgICB0eXBlOiByZXEucXVlcnkudHlwZSxcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgfSk7XG5cbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBlcnJvcjoge1xuICAgICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgZXJyb3JcIixcbiAgICAgICAgZGV0YWlsczogU3RyaW5nKGVycm9yKSxcbiAgICAgIH0sXG4gICAgICBkYXRhOiBbXSxcbiAgICB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUp1cGl0ZXJRdW90ZTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IGlucHV0TWludCwgb3V0cHV0TWludCwgYW1vdW50LCBzbGlwcGFnZUJwcywgYXNMZWdhY3lUcmFuc2FjdGlvbiB9ID1cbiAgICAgIHJlcS5xdWVyeTtcblxuICAgIGlmIChcbiAgICAgICFpbnB1dE1pbnQgfHxcbiAgICAgICFvdXRwdXRNaW50IHx8XG4gICAgICAhYW1vdW50IHx8XG4gICAgICB0eXBlb2YgaW5wdXRNaW50ICE9PSBcInN0cmluZ1wiIHx8XG4gICAgICB0eXBlb2Ygb3V0cHV0TWludCAhPT0gXCJzdHJpbmdcIiB8fFxuICAgICAgdHlwZW9mIGFtb3VudCAhPT0gXCJzdHJpbmdcIlxuICAgICkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IFwiTWlzc2luZyByZXF1aXJlZCBxdWVyeSBwYXJhbXM6IGlucHV0TWludCwgb3V0cHV0TWludCwgYW1vdW50XCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcbiAgICAgIGlucHV0TWludCxcbiAgICAgIG91dHB1dE1pbnQsXG4gICAgICBhbW91bnQsXG4gICAgICBzbGlwcGFnZUJwczogdHlwZW9mIHNsaXBwYWdlQnBzID09PSBcInN0cmluZ1wiID8gc2xpcHBhZ2VCcHMgOiBcIjUwXCIsXG4gICAgICBvbmx5RGlyZWN0Um91dGVzOiBcImZhbHNlXCIsXG4gICAgICBhc0xlZ2FjeVRyYW5zYWN0aW9uOlxuICAgICAgICB0eXBlb2YgYXNMZWdhY3lUcmFuc2FjdGlvbiA9PT0gXCJzdHJpbmdcIiA/IGFzTGVnYWN5VHJhbnNhY3Rpb24gOiBcImZhbHNlXCIsXG4gICAgfSk7XG5cbiAgICBjb25zdCB1cmwgPSBgJHtKVVBJVEVSX1NXQVBfQkFTRX0vcXVvdGU/JHtwYXJhbXMudG9TdHJpbmcoKX1gO1xuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYEp1cGl0ZXIgcXVvdGUgcmVxdWVzdDogJHtpbnB1dE1pbnR9IC0+ICR7b3V0cHV0TWludH0sIGFtb3VudDogJHthbW91bnR9YCxcbiAgICApO1xuXG4gICAgY29uc3QgZmV0Y2hXaXRoVGltZW91dCA9ICh0aW1lb3V0TXM6IG51bWJlcikgPT4ge1xuICAgICAgY29uc3QgdGltZW91dFByb21pc2UgPSBuZXcgUHJvbWlzZTxSZXNwb25zZT4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgc2V0VGltZW91dChcbiAgICAgICAgICAoKSA9PlxuICAgICAgICAgICAgcmVzb2x2ZShcbiAgICAgICAgICAgICAgbmV3IFJlc3BvbnNlKFwiXCIsIHsgc3RhdHVzOiA1MDQsIHN0YXR1c1RleHQ6IFwiR2F0ZXdheSBUaW1lb3V0XCIgfSksXG4gICAgICAgICAgICApLFxuICAgICAgICAgIHRpbWVvdXRNcyxcbiAgICAgICAgKTtcbiAgICAgIH0pO1xuICAgICAgY29uc3QgZmV0Y2hQcm9taXNlID0gZmV0Y2godXJsLCB7XG4gICAgICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgIEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKGNvbXBhdGlibGU7IFNvbGFuYVdhbGxldC8xLjApXCIsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBQcm9taXNlLnJhY2UoW2ZldGNoUHJvbWlzZSwgdGltZW91dFByb21pc2VdKSBhcyBQcm9taXNlPFJlc3BvbnNlPjtcbiAgICB9O1xuXG4gICAgLy8gVHJ5IHVwIHRvIDIgYXR0ZW1wdHMgd2l0aCBzbWFsbCBiYWNrb2ZmIG9uIDV4eC80MjlcbiAgICBsZXQgbGFzdFN0YXR1cyA9IDA7XG4gICAgbGV0IGxhc3RUZXh0ID0gXCJcIjtcbiAgICBmb3IgKGxldCBhdHRlbXB0ID0gMTsgYXR0ZW1wdCA8PSAyOyBhdHRlbXB0KyspIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2hXaXRoVGltZW91dCg4MDAwKTtcbiAgICAgICAgbGFzdFN0YXR1cyA9IHJlc3BvbnNlLnN0YXR1cztcbiAgICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgSnVwaXRlciBxdW90ZSBzdWNjZXNzZnVsICgke3Jlc3BvbnNlLnN0YXR1c30pYCk7XG4gICAgICAgICAgcmV0dXJuIHJlcy5qc29uKGRhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGFzdFRleHQgPSBhd2FpdCByZXNwb25zZVxuICAgICAgICAgIC50ZXh0KClcbiAgICAgICAgICAuY2F0Y2goKCkgPT4gXCIodW5hYmxlIHRvIHJlYWQgcmVzcG9uc2UpXCIpO1xuXG4gICAgICAgIC8vIElmIDQwNCBvciA0MDAsIGxpa2VseSBtZWFucyBubyByb3V0ZSBleGlzdHMgZm9yIHRoaXMgcGFpclxuICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MDQgfHwgcmVzcG9uc2Uuc3RhdHVzID09PSA0MDApIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICBgSnVwaXRlciBxdW90ZSByZXR1cm5lZCAke3Jlc3BvbnNlLnN0YXR1c30gLSBsaWtlbHkgbm8gcm91dGUgZm9yIHRoaXMgcGFpcjogJHtpbnB1dE1pbnR9IC0+ICR7b3V0cHV0TWludH1gLFxuICAgICAgICAgICk7XG4gICAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMocmVzcG9uc2Uuc3RhdHVzKS5qc29uKHtcbiAgICAgICAgICAgIGVycm9yOiBgTm8gc3dhcCByb3V0ZSBmb3VuZCBmb3IgdGhpcyBwYWlyYCxcbiAgICAgICAgICAgIGRldGFpbHM6IGxhc3RUZXh0LFxuICAgICAgICAgICAgY29kZTpcbiAgICAgICAgICAgICAgcmVzcG9uc2Uuc3RhdHVzID09PSA0MDQgPyBcIk5PX1JPVVRFX0ZPVU5EXCIgOiBcIklOVkFMSURfUEFSQU1TXCIsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXRyeSBvbiByYXRlIGxpbWl0IG9yIHNlcnZlciBlcnJvcnNcbiAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDI5IHx8IHJlc3BvbnNlLnN0YXR1cyA+PSA1MDApIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICBgSnVwaXRlciBBUEkgcmV0dXJuZWQgJHtyZXNwb25zZS5zdGF0dXN9LCByZXRyeWluZy4uLiAoYXR0ZW1wdCAke2F0dGVtcHR9LzIpYCxcbiAgICAgICAgICApO1xuICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyKSA9PiBzZXRUaW1lb3V0KHIsIGF0dGVtcHQgKiAyNTApKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE90aGVyIGVycm9yIHN0YXR1cywgZG9uJ3QgcmV0cnlcbiAgICAgICAgYnJlYWs7XG4gICAgICB9IGNhdGNoIChmZXRjaEVycm9yKSB7XG4gICAgICAgIGNvbnN0IGVycm9yTXNnID1cbiAgICAgICAgICBmZXRjaEVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBmZXRjaEVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZmV0Y2hFcnJvcik7XG4gICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICBgRmV0Y2ggZXJyb3Igb24gYXR0ZW1wdCAke2F0dGVtcHR9LzI6YCxcbiAgICAgICAgICBlcnJvck1zZyxcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAoYXR0ZW1wdCA8IDIpIHtcbiAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocikgPT4gc2V0VGltZW91dChyLCBhdHRlbXB0ICogMjUwKSk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBsYXN0VGV4dCA9IGVycm9yTXNnO1xuICAgICAgICBsYXN0U3RhdHVzID0gNTAwO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzLnN0YXR1cyhsYXN0U3RhdHVzIHx8IDUwMCkuanNvbih7XG4gICAgICBlcnJvcjogYFF1b3RlIEFQSSBlcnJvcmAsXG4gICAgICBkZXRhaWxzOiBsYXN0VGV4dCxcbiAgICAgIGNvZGU6IGxhc3RTdGF0dXMgPT09IDUwNCA/IFwiVElNRU9VVFwiIDogXCJBUElfRVJST1JcIixcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiSnVwaXRlciBxdW90ZSBwcm94eSBlcnJvcjpcIiwge1xuICAgICAgcGFyYW1zOiByZXEucXVlcnksXG4gICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgc3RhY2s6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5zdGFjayA6IHVuZGVmaW5lZCxcbiAgICB9KTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIkludGVybmFsIGVycm9yXCIsXG4gICAgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVKdXBpdGVyU3dhcDogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBib2R5ID0gcmVxLmJvZHkgfHwge307XG4gICAgY29uc29sZS5sb2coXG4gICAgICBcImhhbmRsZUp1cGl0ZXJTd2FwIHJlY2VpdmVkIGJvZHkga2V5czpcIixcbiAgICAgIE9iamVjdC5rZXlzKGJvZHkgfHwge30pLFxuICAgICk7XG5cbiAgICBpZiAoIWJvZHkgfHwgIWJvZHkucXVvdGVSZXNwb25zZSB8fCAhYm9keS51c2VyUHVibGljS2V5KSB7XG4gICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgIFwiaGFuZGxlSnVwaXRlclN3YXAgbWlzc2luZyBmaWVsZHMsIGJvZHk6XCIsXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuICAgICAgKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7XG4gICAgICAgIGVycm9yOlxuICAgICAgICAgIFwiTWlzc2luZyByZXF1aXJlZCBib2R5OiB7IHF1b3RlUmVzcG9uc2UsIHVzZXJQdWJsaWNLZXksIC4uLm9wdGlvbnMgfVwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBjb25zdCB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgMjAwMDApO1xuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHtKVVBJVEVSX1NXQVBfQkFTRX0vc3dhcGAsIHtcbiAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoY29tcGF0aWJsZTsgU29sYW5hV2FsbGV0LzEuMClcIixcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KSxcbiAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgfSk7XG5cbiAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcblxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgIGNvbnN0IHRleHQgPSBhd2FpdCByZXNwb25zZS50ZXh0KCkuY2F0Y2goKCkgPT4gXCJcIik7XG4gICAgICByZXR1cm4gcmVzXG4gICAgICAgIC5zdGF0dXMocmVzcG9uc2Uuc3RhdHVzKVxuICAgICAgICAuanNvbih7IGVycm9yOiBgU3dhcCBmYWlsZWQ6ICR7cmVzcG9uc2Uuc3RhdHVzVGV4dH1gLCBkZXRhaWxzOiB0ZXh0IH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgcmVzLmpzb24oZGF0YSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkp1cGl0ZXIgc3dhcCBwcm94eSBlcnJvcjpcIiwge1xuICAgICAgYm9keTogcmVxLmJvZHksXG4gICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgc3RhY2s6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5zdGFjayA6IHVuZGVmaW5lZCxcbiAgICB9KTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIkludGVybmFsIGVycm9yXCIsXG4gICAgfSk7XG4gIH1cbn07XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9mb3JleC1yYXRlLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2ZvcmV4LXJhdGUudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVGb3JleFJhdGU6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgYmFzZSA9IFN0cmluZyhyZXEucXVlcnkuYmFzZSB8fCBcIlVTRFwiKS50b1VwcGVyQ2FzZSgpO1xuICAgIGNvbnN0IHN5bWJvbHMgPSBTdHJpbmcocmVxLnF1ZXJ5LnN5bWJvbHMgfHwgXCJQS1JcIikudG9VcHBlckNhc2UoKTtcbiAgICBjb25zdCBmaXJzdFN5bWJvbCA9IHN5bWJvbHMuc3BsaXQoXCIsXCIpWzBdO1xuICAgIGNvbnN0IFBST1ZJREVSX1RJTUVPVVRfTVMgPSA1MDAwO1xuXG4gICAgY29uc3QgcHJvdmlkZXJzOiBBcnJheTx7XG4gICAgICBuYW1lOiBzdHJpbmc7XG4gICAgICB1cmw6IHN0cmluZztcbiAgICAgIHBhcnNlOiAoajogYW55KSA9PiBudW1iZXIgfCBudWxsO1xuICAgIH0+ID0gW1xuICAgICAge1xuICAgICAgICBuYW1lOiBcImV4Y2hhbmdlcmF0ZS5ob3N0XCIsXG4gICAgICAgIHVybDogYGh0dHBzOi8vYXBpLmV4Y2hhbmdlcmF0ZS5ob3N0L2xhdGVzdD9iYXNlPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGJhc2UpfSZzeW1ib2xzPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGZpcnN0U3ltYm9sKX1gLFxuICAgICAgICBwYXJzZTogKGopID0+XG4gICAgICAgICAgaiAmJiBqLnJhdGVzICYmIHR5cGVvZiBqLnJhdGVzW2ZpcnN0U3ltYm9sXSA9PT0gXCJudW1iZXJcIlxuICAgICAgICAgICAgPyBqLnJhdGVzW2ZpcnN0U3ltYm9sXVxuICAgICAgICAgICAgOiBudWxsLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogXCJmcmFua2Z1cnRlclwiLFxuICAgICAgICB1cmw6IGBodHRwczovL2FwaS5mcmFua2Z1cnRlci5hcHAvbGF0ZXN0P2Zyb209JHtlbmNvZGVVUklDb21wb25lbnQoYmFzZSl9JnRvPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGZpcnN0U3ltYm9sKX1gLFxuICAgICAgICBwYXJzZTogKGopID0+XG4gICAgICAgICAgaiAmJiBqLnJhdGVzICYmIHR5cGVvZiBqLnJhdGVzW2ZpcnN0U3ltYm9sXSA9PT0gXCJudW1iZXJcIlxuICAgICAgICAgICAgPyBqLnJhdGVzW2ZpcnN0U3ltYm9sXVxuICAgICAgICAgICAgOiBudWxsLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogXCJlci1hcGlcIixcbiAgICAgICAgdXJsOiBgaHR0cHM6Ly9vcGVuLmVyLWFwaS5jb20vdjYvbGF0ZXN0LyR7ZW5jb2RlVVJJQ29tcG9uZW50KGJhc2UpfWAsXG4gICAgICAgIHBhcnNlOiAoaikgPT5cbiAgICAgICAgICBqICYmIGoucmF0ZXMgJiYgdHlwZW9mIGoucmF0ZXNbZmlyc3RTeW1ib2xdID09PSBcIm51bWJlclwiXG4gICAgICAgICAgICA/IGoucmF0ZXNbZmlyc3RTeW1ib2xdXG4gICAgICAgICAgICA6IG51bGwsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiBcImZhd2F6YWhtZWQtY2RuXCIsXG4gICAgICAgIHVybDogYGh0dHBzOi8vY2RuLmpzZGVsaXZyLm5ldC9naC9mYXdhemFobWVkMC9jdXJyZW5jeS1hcGlAMS9sYXRlc3QvY3VycmVuY2llcy8ke2Jhc2UudG9Mb3dlckNhc2UoKX0vJHtmaXJzdFN5bWJvbC50b0xvd2VyQ2FzZSgpfS5qc29uYCxcbiAgICAgICAgcGFyc2U6IChqKSA9PlxuICAgICAgICAgIGogJiYgdHlwZW9mIGpbZmlyc3RTeW1ib2wudG9Mb3dlckNhc2UoKV0gPT09IFwibnVtYmVyXCJcbiAgICAgICAgICAgID8galtmaXJzdFN5bWJvbC50b0xvd2VyQ2FzZSgpXVxuICAgICAgICAgICAgOiBudWxsLFxuICAgICAgfSxcbiAgICBdO1xuXG4gICAgY29uc3QgZmV0Y2hQcm92aWRlciA9IGFzeW5jIChcbiAgICAgIHByb3ZpZGVyOiAodHlwZW9mIHByb3ZpZGVycylbbnVtYmVyXSxcbiAgICApOiBQcm9taXNlPHsgcmF0ZTogbnVtYmVyOyBwcm92aWRlcjogc3RyaW5nIH0+ID0+IHtcbiAgICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgICBjb25zdCB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KFxuICAgICAgICAoKSA9PiBjb250cm9sbGVyLmFib3J0KCksXG4gICAgICAgIFBST1ZJREVSX1RJTUVPVVRfTVMsXG4gICAgICApO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzcCA9IGF3YWl0IGZldGNoKHByb3ZpZGVyLnVybCwge1xuICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChjb21wYXRpYmxlOyBTb2xhbmFXYWxsZXQvMS4wKVwiLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCBhcyBhbnksXG4gICAgICAgIH0gYXMgYW55KTtcbiAgICAgICAgaWYgKCFyZXNwLm9rKSB7XG4gICAgICAgICAgY29uc3QgcmVhc29uID0gYCR7cmVzcC5zdGF0dXN9ICR7cmVzcC5zdGF0dXNUZXh0fWA7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKHJlYXNvbi50cmltKCkgfHwgXCJub24tb2sgcmVzcG9uc2VcIik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QganNvbiA9IGF3YWl0IHJlc3AuanNvbigpO1xuICAgICAgICBjb25zdCByYXRlID0gcHJvdmlkZXIucGFyc2UoanNvbik7XG4gICAgICAgIGlmICh0eXBlb2YgcmF0ZSA9PT0gXCJudW1iZXJcIiAmJiBpc0Zpbml0ZShyYXRlKSAmJiByYXRlID4gMCkge1xuICAgICAgICAgIHJldHVybiB7IHJhdGUsIHByb3ZpZGVyOiBwcm92aWRlci5uYW1lIH07XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaW52YWxpZCByZXNwb25zZSBwYXlsb2FkXCIpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBbJHtwcm92aWRlci5uYW1lfV0gJHttZXNzYWdlfWApO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IHJ1blByb3ZpZGVycyA9ICgpID0+IHtcbiAgICAgIGNvbnN0IGF0dGVtcHRzID0gcHJvdmlkZXJzLm1hcCgocCkgPT4gZmV0Y2hQcm92aWRlcihwKSk7XG4gICAgICBpZiAodHlwZW9mIChQcm9taXNlIGFzIGFueSkuYW55ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIChQcm9taXNlIGFzIGFueSkuYW55KGF0dGVtcHRzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx7IHJhdGU6IG51bWJlcjsgcHJvdmlkZXI6IHN0cmluZyB9PihcbiAgICAgICAgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICBsZXQgcmVtYWluaW5nID0gYXR0ZW1wdHMubGVuZ3RoO1xuICAgICAgICAgIGF0dGVtcHRzLmZvckVhY2goKGF0dGVtcHQpID0+IHtcbiAgICAgICAgICAgIGF0dGVtcHQudGhlbihyZXNvbHZlKS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgICAgIGVycm9ycy5wdXNoKGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiBTdHJpbmcoZXJyKSk7XG4gICAgICAgICAgICAgIHJlbWFpbmluZyAtPSAxO1xuICAgICAgICAgICAgICBpZiAocmVtYWluaW5nID09PSAwKSByZWplY3QobmV3IEVycm9yKGVycm9ycy5qb2luKFwiOyBcIikpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgKTtcbiAgICB9O1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgcmF0ZSwgcHJvdmlkZXIgfSA9IGF3YWl0IHJ1blByb3ZpZGVycygpO1xuICAgICAgcmVzLmpzb24oe1xuICAgICAgICBiYXNlLFxuICAgICAgICBzeW1ib2xzOiBbZmlyc3RTeW1ib2xdLFxuICAgICAgICByYXRlczogeyBbZmlyc3RTeW1ib2xdOiByYXRlIH0sXG4gICAgICAgIHByb3ZpZGVyLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnN0IG1zZyA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbiAgICAgIHJlc1xuICAgICAgICAuc3RhdHVzKDUwMilcbiAgICAgICAgLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gZmV0Y2ggZm9yZXggcmF0ZVwiLCBkZXRhaWxzOiBtc2cgfSk7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiVW5leHBlY3RlZCBlcnJvclwiIH0pO1xuICB9XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc3RhYmxlLTI0aC50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9zdGFibGUtMjRoLnRzXCI7aW1wb3J0IHsgUmVxdWVzdEhhbmRsZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5leHBvcnQgY29uc3QgaGFuZGxlU3RhYmxlMjRoOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHN5bWJvbHNQYXJhbSA9IFN0cmluZyhyZXEucXVlcnkuc3ltYm9scyB8fCBcIlVTREMsVVNEVFwiKS50b1VwcGVyQ2FzZSgpO1xuICAgIGNvbnN0IHN5bWJvbHMgPSBBcnJheS5mcm9tKFxuICAgICAgbmV3IFNldChcbiAgICAgICAgU3RyaW5nKHN5bWJvbHNQYXJhbSlcbiAgICAgICAgICAuc3BsaXQoXCIsXCIpXG4gICAgICAgICAgLm1hcCgocykgPT4gcy50cmltKCkpXG4gICAgICAgICAgLmZpbHRlcihCb29sZWFuKSxcbiAgICAgICksXG4gICAgKTtcblxuICAgIGNvbnN0IENPSU5HRUNLT19JRFM6IFJlY29yZDxzdHJpbmcsIHsgaWQ6IHN0cmluZzsgbWludDogc3RyaW5nIH0+ID0ge1xuICAgICAgVVNEQzoge1xuICAgICAgICBpZDogXCJ1c2QtY29pblwiLFxuICAgICAgICBtaW50OiBcIkVQakZXZGQ1QXVmcVNTcWVNMnFOMXh6eWJhcEM4RzR3RUdHa1p3eVREdDF2XCIsXG4gICAgICB9LFxuICAgICAgVVNEVDoge1xuICAgICAgICBpZDogXCJ0ZXRoZXJcIixcbiAgICAgICAgbWludDogXCJFczl2TUZyemFDRVJtSmZyRjRIMkZZRDRLQ29Oa1kxMU1jQ2U4QmVuRW5zXCIsXG4gICAgICB9LFxuICAgIH07XG5cbiAgICBjb25zdCBpZHMgPSBzeW1ib2xzXG4gICAgICAubWFwKChzKSA9PiBDT0lOR0VDS09fSURTW3NdPy5pZClcbiAgICAgIC5maWx0ZXIoQm9vbGVhbilcbiAgICAgIC5qb2luKFwiLFwiKTtcblxuICAgIGlmICghaWRzKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogXCJObyBzdXBwb3J0ZWQgc3ltYm9scyBwcm92aWRlZFwiIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGFwaVVybCA9IGBodHRwczovL2FwaS5jb2luZ2Vja28uY29tL2FwaS92My9zaW1wbGUvcHJpY2U/aWRzPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGlkcyl9JnZzX2N1cnJlbmNpZXM9dXNkJmluY2x1ZGVfMjRocl9jaGFuZ2U9dHJ1ZWA7XG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBjb25zdCB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgMTIwMDApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBmZXRjaChhcGlVcmwsIHtcbiAgICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCBhcyBhbnksXG4gICAgICAgIGhlYWRlcnM6IHsgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIiB9LFxuICAgICAgfSBhcyBhbnkpO1xuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG5cbiAgICAgIGNvbnN0IHJlc3VsdDogUmVjb3JkPFxuICAgICAgICBzdHJpbmcsXG4gICAgICAgIHsgcHJpY2VVc2Q6IG51bWJlcjsgY2hhbmdlMjRoOiBudW1iZXI7IG1pbnQ6IHN0cmluZyB9XG4gICAgICA+ID0ge307XG5cbiAgICAgIGlmIChyZXNwLm9rKSB7XG4gICAgICAgIGNvbnN0IGpzb24gPSBhd2FpdCByZXNwLmpzb24oKTtcbiAgICAgICAgc3ltYm9scy5mb3JFYWNoKChzeW0pID0+IHtcbiAgICAgICAgICBjb25zdCBtZXRhID0gQ09JTkdFQ0tPX0lEU1tzeW1dO1xuICAgICAgICAgIGlmICghbWV0YSkgcmV0dXJuO1xuICAgICAgICAgIGNvbnN0IGQgPSAoanNvbiBhcyBhbnkpPy5bbWV0YS5pZF07XG4gICAgICAgICAgY29uc3QgcHJpY2UgPSB0eXBlb2YgZD8udXNkID09PSBcIm51bWJlclwiID8gZC51c2QgOiAxO1xuICAgICAgICAgIGNvbnN0IGNoYW5nZSA9XG4gICAgICAgICAgICB0eXBlb2YgZD8udXNkXzI0aF9jaGFuZ2UgPT09IFwibnVtYmVyXCIgPyBkLnVzZF8yNGhfY2hhbmdlIDogMDtcbiAgICAgICAgICByZXN1bHRbc3ltXSA9IHsgcHJpY2VVc2Q6IHByaWNlLCBjaGFuZ2UyNGg6IGNoYW5nZSwgbWludDogbWV0YS5taW50IH07XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3ltYm9scy5mb3JFYWNoKChzeW0pID0+IHtcbiAgICAgICAgICBjb25zdCBtZXRhID0gQ09JTkdFQ0tPX0lEU1tzeW1dO1xuICAgICAgICAgIGlmICghbWV0YSkgcmV0dXJuO1xuICAgICAgICAgIHJlc3VsdFtzeW1dID0geyBwcmljZVVzZDogMSwgY2hhbmdlMjRoOiAwLCBtaW50OiBtZXRhLm1pbnQgfTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHJlcy5qc29uKHsgZGF0YTogcmVzdWx0IH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgY29uc3QgcmVzdWx0OiBSZWNvcmQ8XG4gICAgICAgIHN0cmluZyxcbiAgICAgICAgeyBwcmljZVVzZDogbnVtYmVyOyBjaGFuZ2UyNGg6IG51bWJlcjsgbWludDogc3RyaW5nIH1cbiAgICAgID4gPSB7fTtcbiAgICAgIHN5bWJvbHMuZm9yRWFjaCgoc3ltKSA9PiB7XG4gICAgICAgIGNvbnN0IG1ldGEgPSBDT0lOR0VDS09fSURTW3N5bV07XG4gICAgICAgIGlmICghbWV0YSkgcmV0dXJuO1xuICAgICAgICByZXN1bHRbc3ltXSA9IHsgcHJpY2VVc2Q6IDEsIGNoYW5nZTI0aDogMCwgbWludDogbWV0YS5taW50IH07XG4gICAgICB9KTtcbiAgICAgIHJlcy5qc29uKHsgZGF0YTogcmVzdWx0IH0pO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIlVuZXhwZWN0ZWQgZXJyb3JcIiB9KTtcbiAgfVxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL3AycC1vcmRlcnMudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvcDJwLW9yZGVycy50c1wiO2ltcG9ydCB7IFJlcXVlc3RIYW5kbGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuZXhwb3J0IGludGVyZmFjZSBQMlBPcmRlciB7XG4gIGlkOiBzdHJpbmc7XG4gIHR5cGU6IFwiYnV5XCIgfCBcInNlbGxcIjtcbiAgY3JlYXRvcl93YWxsZXQ6IHN0cmluZztcbiAgdG9rZW46IHN0cmluZztcbiAgdG9rZW5fYW1vdW50OiBzdHJpbmc7XG4gIHBrcl9hbW91bnQ6IG51bWJlcjtcbiAgcGF5bWVudF9tZXRob2Q6IHN0cmluZztcbiAgc3RhdHVzOiBcImFjdGl2ZVwiIHwgXCJwZW5kaW5nXCIgfCBcImNvbXBsZXRlZFwiIHwgXCJjYW5jZWxsZWRcIiB8IFwiZGlzcHV0ZWRcIjtcbiAgb25saW5lOiBib29sZWFuO1xuICBjcmVhdGVkX2F0OiBudW1iZXI7XG4gIHVwZGF0ZWRfYXQ6IG51bWJlcjtcbiAgYWNjb3VudF9uYW1lPzogc3RyaW5nO1xuICBhY2NvdW50X251bWJlcj86IHN0cmluZztcbiAgd2FsbGV0X2FkZHJlc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHJhZGVSb29tIHtcbiAgaWQ6IHN0cmluZztcbiAgYnV5ZXJfd2FsbGV0OiBzdHJpbmc7XG4gIHNlbGxlcl93YWxsZXQ6IHN0cmluZztcbiAgb3JkZXJfaWQ6IHN0cmluZztcbiAgc3RhdHVzOlxuICAgIHwgXCJwZW5kaW5nXCJcbiAgICB8IFwicGF5bWVudF9jb25maXJtZWRcIlxuICAgIHwgXCJhc3NldHNfdHJhbnNmZXJyZWRcIlxuICAgIHwgXCJjb21wbGV0ZWRcIlxuICAgIHwgXCJjYW5jZWxsZWRcIjtcbiAgY3JlYXRlZF9hdDogbnVtYmVyO1xuICB1cGRhdGVkX2F0OiBudW1iZXI7XG59XG5cbi8vIEluLW1lbW9yeSBzdG9yZSBmb3IgZGV2ZWxvcG1lbnQgKHdpbGwgYmUgcmVwbGFjZWQgd2l0aCBkYXRhYmFzZSlcbmNvbnN0IG9yZGVyczogTWFwPHN0cmluZywgUDJQT3JkZXI+ID0gbmV3IE1hcCgpO1xuY29uc3Qgcm9vbXM6IE1hcDxzdHJpbmcsIFRyYWRlUm9vbT4gPSBuZXcgTWFwKCk7XG5jb25zdCBtZXNzYWdlczogTWFwPFxuICBzdHJpbmcsXG4gIEFycmF5PHtcbiAgICBpZDogc3RyaW5nO1xuICAgIHNlbmRlcl93YWxsZXQ6IHN0cmluZztcbiAgICBtZXNzYWdlOiBzdHJpbmc7XG4gICAgY3JlYXRlZF9hdDogbnVtYmVyO1xuICB9PlxuPiA9IG5ldyBNYXAoKTtcblxuLy8gSGVscGVyIGZ1bmN0aW9uc1xuZnVuY3Rpb24gZ2VuZXJhdGVJZChwcmVmaXg6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtwcmVmaXh9LSR7RGF0ZS5ub3coKX0tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyLCA4KX1gO1xufVxuXG4vLyBQMlAgT3JkZXJzIGVuZHBvaW50c1xuZXhwb3J0IGNvbnN0IGhhbmRsZUxpc3RQMlBPcmRlcnM6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyB0eXBlLCBzdGF0dXMsIHRva2VuLCBvbmxpbmUgfSA9IHJlcS5xdWVyeTtcblxuICAgIGxldCBmaWx0ZXJlZCA9IEFycmF5LmZyb20ob3JkZXJzLnZhbHVlcygpKTtcblxuICAgIGlmICh0eXBlKSBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcigobykgPT4gby50eXBlID09PSB0eXBlKTtcbiAgICBpZiAoc3RhdHVzKSBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcigobykgPT4gby5zdGF0dXMgPT09IHN0YXR1cyk7XG4gICAgaWYgKHRva2VuKSBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcigobykgPT4gby50b2tlbiA9PT0gdG9rZW4pO1xuICAgIGlmIChvbmxpbmUgPT09IFwidHJ1ZVwiKSBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcigobykgPT4gby5vbmxpbmUpO1xuICAgIGlmIChvbmxpbmUgPT09IFwiZmFsc2VcIikgZmlsdGVyZWQgPSBmaWx0ZXJlZC5maWx0ZXIoKG8pID0+ICFvLm9ubGluZSk7XG5cbiAgICBmaWx0ZXJlZC5zb3J0KChhLCBiKSA9PiBiLmNyZWF0ZWRfYXQgLSBhLmNyZWF0ZWRfYXQpO1xuXG4gICAgcmVzLmpzb24oeyBvcmRlcnM6IGZpbHRlcmVkIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJMaXN0IFAyUCBvcmRlcnMgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBsaXN0IG9yZGVyc1wiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlQ3JlYXRlUDJQT3JkZXI6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3Qge1xuICAgICAgdHlwZSxcbiAgICAgIGNyZWF0b3Jfd2FsbGV0LFxuICAgICAgdG9rZW4sXG4gICAgICB0b2tlbl9hbW91bnQsXG4gICAgICBwa3JfYW1vdW50LFxuICAgICAgcGF5bWVudF9tZXRob2QsXG4gICAgICBvbmxpbmUsXG4gICAgICBhY2NvdW50X25hbWUsXG4gICAgICBhY2NvdW50X251bWJlcixcbiAgICAgIHdhbGxldF9hZGRyZXNzLFxuICAgIH0gPSByZXEuYm9keTtcblxuICAgIGlmIChcbiAgICAgICF0eXBlIHx8XG4gICAgICAhY3JlYXRvcl93YWxsZXQgfHxcbiAgICAgICF0b2tlbiB8fFxuICAgICAgIXRva2VuX2Ftb3VudCB8fFxuICAgICAgIXBrcl9hbW91bnQgfHxcbiAgICAgICFwYXltZW50X21ldGhvZFxuICAgICkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6IFwiTWlzc2luZyByZXF1aXJlZCBmaWVsZHNcIiB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBpZCA9IGdlbmVyYXRlSWQoXCJvcmRlclwiKTtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXG4gICAgY29uc3Qgb3JkZXI6IFAyUE9yZGVyID0ge1xuICAgICAgaWQsXG4gICAgICB0eXBlLFxuICAgICAgY3JlYXRvcl93YWxsZXQsXG4gICAgICB0b2tlbixcbiAgICAgIHRva2VuX2Ftb3VudDogU3RyaW5nKHRva2VuX2Ftb3VudCksXG4gICAgICBwa3JfYW1vdW50OiBOdW1iZXIocGtyX2Ftb3VudCksXG4gICAgICBwYXltZW50X21ldGhvZCxcbiAgICAgIHN0YXR1czogXCJhY3RpdmVcIixcbiAgICAgIG9ubGluZTogb25saW5lICE9PSBmYWxzZSxcbiAgICAgIGNyZWF0ZWRfYXQ6IG5vdyxcbiAgICAgIHVwZGF0ZWRfYXQ6IG5vdyxcbiAgICAgIGFjY291bnRfbmFtZSxcbiAgICAgIGFjY291bnRfbnVtYmVyLFxuICAgICAgd2FsbGV0X2FkZHJlc3M6IHR5cGUgPT09IFwic2VsbFwiID8gd2FsbGV0X2FkZHJlc3MgOiB1bmRlZmluZWQsXG4gICAgfTtcblxuICAgIG9yZGVycy5zZXQoaWQsIG9yZGVyKTtcblxuICAgIHJlcy5zdGF0dXMoMjAxKS5qc29uKHsgb3JkZXIgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkNyZWF0ZSBQMlAgb3JkZXIgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBjcmVhdGUgb3JkZXJcIiB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUdldFAyUE9yZGVyOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgb3JkZXJJZCB9ID0gcmVxLnBhcmFtcztcbiAgICBjb25zdCBvcmRlciA9IG9yZGVycy5nZXQob3JkZXJJZCk7XG5cbiAgICBpZiAoIW9yZGVyKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJPcmRlciBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICByZXMuanNvbih7IG9yZGVyIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJHZXQgUDJQIG9yZGVyIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gZ2V0IG9yZGVyXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVVcGRhdGVQMlBPcmRlcjogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IG9yZGVySWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgY29uc3Qgb3JkZXIgPSBvcmRlcnMuZ2V0KG9yZGVySWQpO1xuXG4gICAgaWYgKCFvcmRlcikge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6IFwiT3JkZXIgbm90IGZvdW5kXCIgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXBkYXRlZDogUDJQT3JkZXIgPSB7XG4gICAgICAuLi5vcmRlcixcbiAgICAgIC4uLnJlcS5ib2R5LFxuICAgICAgaWQ6IG9yZGVyLmlkLFxuICAgICAgY3JlYXRlZF9hdDogb3JkZXIuY3JlYXRlZF9hdCxcbiAgICAgIHVwZGF0ZWRfYXQ6IERhdGUubm93KCksXG4gICAgfTtcblxuICAgIG9yZGVycy5zZXQob3JkZXJJZCwgdXBkYXRlZCk7XG4gICAgcmVzLmpzb24oeyBvcmRlcjogdXBkYXRlZCB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiVXBkYXRlIFAyUCBvcmRlciBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIHVwZGF0ZSBvcmRlclwiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlRGVsZXRlUDJQT3JkZXI6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBvcmRlcklkIH0gPSByZXEucGFyYW1zO1xuXG4gICAgaWYgKCFvcmRlcnMuaGFzKG9yZGVySWQpKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJPcmRlciBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICBvcmRlcnMuZGVsZXRlKG9yZGVySWQpO1xuICAgIHJlcy5qc29uKHsgb2s6IHRydWUgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkRlbGV0ZSBQMlAgb3JkZXIgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBkZWxldGUgb3JkZXJcIiB9KTtcbiAgfVxufTtcblxuLy8gVHJhZGUgUm9vbXMgZW5kcG9pbnRzXG5leHBvcnQgY29uc3QgaGFuZGxlTGlzdFRyYWRlUm9vbXM6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyB3YWxsZXQgfSA9IHJlcS5xdWVyeTtcblxuICAgIGxldCBmaWx0ZXJlZCA9IEFycmF5LmZyb20ocm9vbXMudmFsdWVzKCkpO1xuXG4gICAgaWYgKHdhbGxldCkge1xuICAgICAgZmlsdGVyZWQgPSBmaWx0ZXJlZC5maWx0ZXIoXG4gICAgICAgIChyKSA9PiByLmJ1eWVyX3dhbGxldCA9PT0gd2FsbGV0IHx8IHIuc2VsbGVyX3dhbGxldCA9PT0gd2FsbGV0LFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBmaWx0ZXJlZC5zb3J0KChhLCBiKSA9PiBiLmNyZWF0ZWRfYXQgLSBhLmNyZWF0ZWRfYXQpO1xuXG4gICAgcmVzLmpzb24oeyByb29tczogZmlsdGVyZWQgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkxpc3QgdHJhZGUgcm9vbXMgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBsaXN0IHJvb21zXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVDcmVhdGVUcmFkZVJvb206IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBidXllcl93YWxsZXQsIHNlbGxlcl93YWxsZXQsIG9yZGVyX2lkIH0gPSByZXEuYm9keTtcblxuICAgIGlmICghYnV5ZXJfd2FsbGV0IHx8ICFzZWxsZXJfd2FsbGV0IHx8ICFvcmRlcl9pZCkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6IFwiTWlzc2luZyByZXF1aXJlZCBmaWVsZHNcIiB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBpZCA9IGdlbmVyYXRlSWQoXCJyb29tXCIpO1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cbiAgICBjb25zdCByb29tOiBUcmFkZVJvb20gPSB7XG4gICAgICBpZCxcbiAgICAgIGJ1eWVyX3dhbGxldCxcbiAgICAgIHNlbGxlcl93YWxsZXQsXG4gICAgICBvcmRlcl9pZCxcbiAgICAgIHN0YXR1czogXCJwZW5kaW5nXCIsXG4gICAgICBjcmVhdGVkX2F0OiBub3csXG4gICAgICB1cGRhdGVkX2F0OiBub3csXG4gICAgfTtcblxuICAgIHJvb21zLnNldChpZCwgcm9vbSk7XG5cbiAgICByZXMuc3RhdHVzKDIwMSkuanNvbih7IHJvb20gfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkNyZWF0ZSB0cmFkZSByb29tIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gY3JlYXRlIHJvb21cIiB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUdldFRyYWRlUm9vbTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHJvb21JZCB9ID0gcmVxLnBhcmFtcztcbiAgICBjb25zdCByb29tID0gcm9vbXMuZ2V0KHJvb21JZCk7XG5cbiAgICBpZiAoIXJvb20pIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiBcIlJvb20gbm90IGZvdW5kXCIgfSk7XG4gICAgfVxuXG4gICAgcmVzLmpzb24oeyByb29tIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJHZXQgdHJhZGUgcm9vbSBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGdldCByb29tXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVVcGRhdGVUcmFkZVJvb206IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyByb29tSWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgY29uc3Qgcm9vbSA9IHJvb21zLmdldChyb29tSWQpO1xuXG4gICAgaWYgKCFyb29tKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJSb29tIG5vdCBmb3VuZFwiIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVwZGF0ZWQ6IFRyYWRlUm9vbSA9IHtcbiAgICAgIC4uLnJvb20sXG4gICAgICAuLi5yZXEuYm9keSxcbiAgICAgIGlkOiByb29tLmlkLFxuICAgICAgY3JlYXRlZF9hdDogcm9vbS5jcmVhdGVkX2F0LFxuICAgICAgdXBkYXRlZF9hdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuXG4gICAgcm9vbXMuc2V0KHJvb21JZCwgdXBkYXRlZCk7XG4gICAgcmVzLmpzb24oeyByb29tOiB1cGRhdGVkIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJVcGRhdGUgdHJhZGUgcm9vbSBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIHVwZGF0ZSByb29tXCIgfSk7XG4gIH1cbn07XG5cbi8vIFRyYWRlIE1lc3NhZ2VzIGVuZHBvaW50c1xuZXhwb3J0IGNvbnN0IGhhbmRsZUxpc3RUcmFkZU1lc3NhZ2VzOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgcm9vbUlkIH0gPSByZXEucGFyYW1zO1xuXG4gICAgY29uc3Qgcm9vbU1lc3NhZ2VzID0gbWVzc2FnZXMuZ2V0KHJvb21JZCkgfHwgW107XG4gICAgcmVzLmpzb24oeyBtZXNzYWdlczogcm9vbU1lc3NhZ2VzIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJMaXN0IHRyYWRlIG1lc3NhZ2VzIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gbGlzdCBtZXNzYWdlc1wiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlQWRkVHJhZGVNZXNzYWdlOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgcm9vbUlkIH0gPSByZXEucGFyYW1zO1xuICAgIGNvbnN0IHsgc2VuZGVyX3dhbGxldCwgbWVzc2FnZSwgYXR0YWNobWVudF91cmwgfSA9IHJlcS5ib2R5O1xuXG4gICAgaWYgKCFzZW5kZXJfd2FsbGV0IHx8ICFtZXNzYWdlKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogXCJNaXNzaW5nIHJlcXVpcmVkIGZpZWxkc1wiIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGlkID0gZ2VuZXJhdGVJZChcIm1zZ1wiKTtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXG4gICAgY29uc3QgbXNnID0ge1xuICAgICAgaWQsXG4gICAgICBzZW5kZXJfd2FsbGV0LFxuICAgICAgbWVzc2FnZSxcbiAgICAgIGF0dGFjaG1lbnRfdXJsLFxuICAgICAgY3JlYXRlZF9hdDogbm93LFxuICAgIH07XG5cbiAgICBpZiAoIW1lc3NhZ2VzLmhhcyhyb29tSWQpKSB7XG4gICAgICBtZXNzYWdlcy5zZXQocm9vbUlkLCBbXSk7XG4gICAgfVxuXG4gICAgbWVzc2FnZXMuZ2V0KHJvb21JZCkhLnB1c2gobXNnKTtcblxuICAgIHJlcy5zdGF0dXMoMjAxKS5qc29uKHsgbWVzc2FnZTogbXNnIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJBZGQgdHJhZGUgbWVzc2FnZSBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGFkZCBtZXNzYWdlXCIgfSk7XG4gIH1cbn07XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9vcmRlcnMudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvb3JkZXJzLnRzXCI7aW1wb3J0IHsgUmVxdWVzdEhhbmRsZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5pbnRlcmZhY2UgT3JkZXIge1xuICBpZDogc3RyaW5nO1xuICBzaWRlOiBcImJ1eVwiIHwgXCJzZWxsXCI7XG4gIGFtb3VudFBLUjogbnVtYmVyO1xuICBxdW90ZUFzc2V0OiBzdHJpbmc7XG4gIHByaWNlUEtSUGVyUXVvdGU6IG51bWJlcjtcbiAgcGF5bWVudE1ldGhvZDogc3RyaW5nO1xuICByb29tSWQ6IHN0cmluZztcbiAgY3JlYXRlZEJ5OiBzdHJpbmc7XG4gIGNyZWF0ZWRBdDogbnVtYmVyO1xuICBhY2NvdW50TmFtZT86IHN0cmluZztcbiAgYWNjb3VudE51bWJlcj86IHN0cmluZztcbiAgd2FsbGV0QWRkcmVzcz86IHN0cmluZztcbn1cblxuLy8gSW4tbWVtb3J5IHN0b3JlIGZvciBvcmRlcnMgKHdpbGwgYmUgcmVwbGFjZWQgd2l0aCBkYXRhYmFzZSBpbiBwcm9kdWN0aW9uKVxuY29uc3Qgb3JkZXJzU3RvcmUgPSBuZXcgTWFwPHN0cmluZywgT3JkZXI+KCk7XG5cbi8vIEFkbWluIHBhc3N3b3JkIGZvciB2YWxpZGF0aW9uXG5jb25zdCBBRE1JTl9QQVNTV09SRCA9IFwiUGFraXN0YW4jIzEyM1wiO1xuXG5jb25zdCBnZW5lcmF0ZUlkID0gKHByZWZpeDogc3RyaW5nKTogc3RyaW5nID0+IHtcbiAgcmV0dXJuIGAke3ByZWZpeH0tJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIsIDgpfWA7XG59O1xuXG5jb25zdCB2YWxpZGF0ZUFkbWluVG9rZW4gPSAodG9rZW46IHN0cmluZyk6IGJvb2xlYW4gPT4ge1xuICByZXR1cm4gdG9rZW4gPT09IEFETUlOX1BBU1NXT1JEO1xufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUxpc3RPcmRlcnM6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyByb29tSWQgfSA9IHJlcS5xdWVyeTtcblxuICAgIGxldCBmaWx0ZXJlZCA9IEFycmF5LmZyb20ob3JkZXJzU3RvcmUudmFsdWVzKCkpO1xuXG4gICAgaWYgKHJvb21JZCAmJiB0eXBlb2Ygcm9vbUlkID09PSBcInN0cmluZ1wiKSB7XG4gICAgICBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcigobykgPT4gby5yb29tSWQgPT09IHJvb21JZCk7XG4gICAgfVxuXG4gICAgLy8gU29ydCBieSBjcmVhdGVkIGRhdGUsIG5ld2VzdCBmaXJzdFxuICAgIGZpbHRlcmVkLnNvcnQoKGEsIGIpID0+IGIuY3JlYXRlZEF0IC0gYS5jcmVhdGVkQXQpO1xuXG4gICAgcmVzLmpzb24oeyBvcmRlcnM6IGZpbHRlcmVkIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJMaXN0IG9yZGVycyBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGxpc3Qgb3JkZXJzXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVDcmVhdGVPcmRlcjogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7XG4gICAgICBzaWRlLFxuICAgICAgYW1vdW50UEtSLFxuICAgICAgcXVvdGVBc3NldCxcbiAgICAgIHByaWNlUEtSUGVyUXVvdGUsXG4gICAgICBwYXltZW50TWV0aG9kLFxuICAgICAgcm9vbUlkID0gXCJnbG9iYWxcIixcbiAgICAgIGNyZWF0ZWRCeSxcbiAgICAgIGFjY291bnROYW1lLFxuICAgICAgYWNjb3VudE51bWJlcixcbiAgICAgIHdhbGxldEFkZHJlc3MsXG4gICAgfSA9IHJlcS5ib2R5O1xuXG4gICAgLy8gVmFsaWRhdGUgcmVxdWlyZWQgZmllbGRzXG4gICAgaWYgKFxuICAgICAgIXNpZGUgfHxcbiAgICAgICFhbW91bnRQS1IgfHxcbiAgICAgICFxdW90ZUFzc2V0IHx8XG4gICAgICAhcHJpY2VQS1JQZXJRdW90ZSB8fFxuICAgICAgIXBheW1lbnRNZXRob2RcbiAgICApIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7XG4gICAgICAgIGVycm9yOlxuICAgICAgICAgIFwiTWlzc2luZyByZXF1aXJlZCBmaWVsZHM6IHNpZGUsIGFtb3VudFBLUiwgcXVvdGVBc3NldCwgcHJpY2VQS1JQZXJRdW90ZSwgcGF5bWVudE1ldGhvZFwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gVmFsaWRhdGUgYXV0aG9yaXphdGlvblxuICAgIGNvbnN0IGF1dGhIZWFkZXIgPSByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uO1xuICAgIGNvbnN0IHRva2VuID0gYXV0aEhlYWRlcj8ucmVwbGFjZShcIkJlYXJlciBcIiwgXCJcIik7XG5cbiAgICBpZiAoIXRva2VuIHx8ICF2YWxpZGF0ZUFkbWluVG9rZW4odG9rZW4pKSB7XG4gICAgICByZXR1cm4gcmVzXG4gICAgICAgIC5zdGF0dXMoNDAxKVxuICAgICAgICAuanNvbih7IGVycm9yOiBcIlVuYXV0aG9yaXplZDogaW52YWxpZCBvciBtaXNzaW5nIGFkbWluIHRva2VuXCIgfSk7XG4gICAgfVxuXG4gICAgLy8gVmFsaWRhdGUgbnVtZXJpYyBmaWVsZHNcbiAgICBjb25zdCBhbW91bnQgPSBOdW1iZXIoYW1vdW50UEtSKTtcbiAgICBjb25zdCBwcmljZSA9IE51bWJlcihwcmljZVBLUlBlclF1b3RlKTtcblxuICAgIGlmICghaXNGaW5pdGUoYW1vdW50KSB8fCBhbW91bnQgPD0gMCkge1xuICAgICAgcmV0dXJuIHJlc1xuICAgICAgICAuc3RhdHVzKDQwMClcbiAgICAgICAgLmpzb24oeyBlcnJvcjogXCJJbnZhbGlkIGFtb3VudFBLUjogbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlclwiIH0pO1xuICAgIH1cblxuICAgIGlmICghaXNGaW5pdGUocHJpY2UpIHx8IHByaWNlIDw9IDApIHtcbiAgICAgIHJldHVybiByZXNcbiAgICAgICAgLnN0YXR1cyg0MDApXG4gICAgICAgIC5qc29uKHsgZXJyb3I6IFwiSW52YWxpZCBwcmljZVBLUlBlclF1b3RlOiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyXCIgfSk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIG9yZGVyXG4gICAgY29uc3QgaWQgPSBnZW5lcmF0ZUlkKFwib3JkZXJcIik7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblxuICAgIGNvbnN0IG9yZGVyOiBPcmRlciA9IHtcbiAgICAgIGlkLFxuICAgICAgc2lkZTogc2lkZSBhcyBcImJ1eVwiIHwgXCJzZWxsXCIsXG4gICAgICBhbW91bnRQS1I6IGFtb3VudCxcbiAgICAgIHF1b3RlQXNzZXQsXG4gICAgICBwcmljZVBLUlBlclF1b3RlOiBwcmljZSxcbiAgICAgIHBheW1lbnRNZXRob2QsXG4gICAgICByb29tSWQsXG4gICAgICBjcmVhdGVkQnk6IGNyZWF0ZWRCeSB8fCBcImFkbWluXCIsXG4gICAgICBjcmVhdGVkQXQ6IG5vdyxcbiAgICAgIGFjY291bnROYW1lLFxuICAgICAgYWNjb3VudE51bWJlcixcbiAgICAgIHdhbGxldEFkZHJlc3MsXG4gICAgfTtcblxuICAgIG9yZGVyc1N0b3JlLnNldChpZCwgb3JkZXIpO1xuXG4gICAgcmVzLnN0YXR1cygyMDEpLmpzb24oeyBvcmRlciB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiQ3JlYXRlIG9yZGVyIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gY3JlYXRlIG9yZGVyXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVHZXRPcmRlcjogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IG9yZGVySWQgfSA9IHJlcS5wYXJhbXM7XG5cbiAgICBjb25zdCBvcmRlciA9IG9yZGVyc1N0b3JlLmdldChvcmRlcklkKTtcblxuICAgIGlmICghb3JkZXIpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiBcIk9yZGVyIG5vdCBmb3VuZFwiIH0pO1xuICAgIH1cblxuICAgIHJlcy5qc29uKHsgb3JkZXIgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkdldCBvcmRlciBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGdldCBvcmRlclwiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlVXBkYXRlT3JkZXI6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBvcmRlcklkIH0gPSByZXEucGFyYW1zO1xuXG4gICAgLy8gVmFsaWRhdGUgYXV0aG9yaXphdGlvblxuICAgIGNvbnN0IGF1dGhIZWFkZXIgPSByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uO1xuICAgIGNvbnN0IHRva2VuID0gYXV0aEhlYWRlcj8ucmVwbGFjZShcIkJlYXJlciBcIiwgXCJcIik7XG5cbiAgICBpZiAoIXRva2VuIHx8ICF2YWxpZGF0ZUFkbWluVG9rZW4odG9rZW4pKSB7XG4gICAgICByZXR1cm4gcmVzXG4gICAgICAgIC5zdGF0dXMoNDAxKVxuICAgICAgICAuanNvbih7IGVycm9yOiBcIlVuYXV0aG9yaXplZDogaW52YWxpZCBvciBtaXNzaW5nIGFkbWluIHRva2VuXCIgfSk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3JkZXIgPSBvcmRlcnNTdG9yZS5nZXQob3JkZXJJZCk7XG5cbiAgICBpZiAoIW9yZGVyKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJPcmRlciBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1cGRhdGVkOiBPcmRlciA9IHtcbiAgICAgIC4uLm9yZGVyLFxuICAgICAgLi4ucmVxLmJvZHksXG4gICAgICBpZDogb3JkZXIuaWQsXG4gICAgICBjcmVhdGVkQXQ6IG9yZGVyLmNyZWF0ZWRBdCxcbiAgICB9O1xuXG4gICAgb3JkZXJzU3RvcmUuc2V0KG9yZGVySWQsIHVwZGF0ZWQpO1xuICAgIHJlcy5qc29uKHsgb3JkZXI6IHVwZGF0ZWQgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIlVwZGF0ZSBvcmRlciBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIHVwZGF0ZSBvcmRlclwiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlRGVsZXRlT3JkZXI6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBvcmRlcklkIH0gPSByZXEucGFyYW1zO1xuXG4gICAgLy8gVmFsaWRhdGUgYXV0aG9yaXphdGlvblxuICAgIGNvbnN0IGF1dGhIZWFkZXIgPSByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uO1xuICAgIGNvbnN0IHRva2VuID0gYXV0aEhlYWRlcj8ucmVwbGFjZShcIkJlYXJlciBcIiwgXCJcIik7XG5cbiAgICBpZiAoIXRva2VuIHx8ICF2YWxpZGF0ZUFkbWluVG9rZW4odG9rZW4pKSB7XG4gICAgICByZXR1cm4gcmVzXG4gICAgICAgIC5zdGF0dXMoNDAxKVxuICAgICAgICAuanNvbih7IGVycm9yOiBcIlVuYXV0aG9yaXplZDogaW52YWxpZCBvciBtaXNzaW5nIGFkbWluIHRva2VuXCIgfSk7XG4gICAgfVxuXG4gICAgaWYgKCFvcmRlcnNTdG9yZS5oYXMob3JkZXJJZCkpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiBcIk9yZGVyIG5vdCBmb3VuZFwiIH0pO1xuICAgIH1cblxuICAgIG9yZGVyc1N0b3JlLmRlbGV0ZShvcmRlcklkKTtcbiAgICByZXMuanNvbih7IG9rOiB0cnVlIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJEZWxldGUgb3JkZXIgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBkZWxldGUgb3JkZXJcIiB9KTtcbiAgfVxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2ZpeG9yaXVtLXRva2Vucy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9maXhvcml1bS10b2tlbnMudHNcIjtpbXBvcnQgeyBUb2tlbkluZm8gfSBmcm9tIFwiQC9saWIvd2FsbGV0XCI7XG5cbi8vIE1vY2sgZGF0YSBmb3IgRml4b3JpdW0tZGVwbG95ZWQgdG9rZW5zXG4vLyBJbiBhIHJlYWwgaW1wbGVtZW50YXRpb24sIHRoaXMgd291bGQgZmV0Y2ggZnJvbSBhIGRhdGFiYXNlIG9yIGJsb2NrY2hhaW5cbmNvbnN0IEZJWE9SSVVNX1RPS0VOUzogVG9rZW5JbmZvW10gPSBbXG4gIHtcbiAgICBtaW50OiBcIkdoajNCNTN4RmQzcVV3M255d2hSRmJxQW5vVEVtTGJMUGFUb003Z0FCbTYzXCIsXG4gICAgc3ltYm9sOiBcIkZYTVwiLFxuICAgIG5hbWU6IFwiRklYT1JJVU1cIixcbiAgICBkZWNpbWFsczogNixcbiAgICBsb2dvVVJJOlxuICAgICAgXCJodHRwczovL2Nkbi5idWlsZGVyLmlvL2FwaS92MS9pbWFnZS9hc3NldHMlMkYyZDBiMmIzODA5YjY0MjliOWU4OWUwMDRmNWQ0NmQzMSUyRjQwMTRlYzFmZjBiNjRiNjQ5MWMwNGFkN2MyOWYwMGM4P2Zvcm1hdD13ZWJwJndpZHRoPTgwMFwiLFxuICAgIGJhbGFuY2U6IDAsXG4gICAgcHJpY2U6IDAsXG4gICAgcHJpY2VDaGFuZ2UyNGg6IDAsXG4gIH0sXG5dO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlRml4b3JpdW1Ub2tlbnMocmVxOiBhbnksIHJlczogYW55KSB7XG4gIHRyeSB7XG4gICAgLy8gSW4gYSByZWFsIGltcGxlbWVudGF0aW9uLCB5b3UgY291bGQ6XG4gICAgLy8gMS4gRmV0Y2ggdG9rZW5zIGZyb20gYSBkYXRhYmFzZVxuICAgIC8vIDIuIFNjYW4gdGhlIGJsb2NrY2hhaW4gZm9yIHRva2VucyBjcmVhdGVkIGJ5IEZpeG9yaXVtXG4gICAgLy8gMy4gRmlsdGVyIHRva2VucyBieSBjcmVhdG9yL2F1dGhvcml0eVxuXG4gICAgLy8gRm9yIG5vdywgcmV0dXJuIHRoZSBtb2NrIHRva2Vuc1xuICAgIHJlcy5qc29uKHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICB0b2tlbnM6IEZJWE9SSVVNX1RPS0VOUyxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBcIkZhaWxlZCB0byBmZXRjaCBGaXhvcml1bSB0b2tlbnNcIixcbiAgICAgIG1lc3NhZ2U6IGVycm9yPy5tZXNzYWdlLFxuICAgIH0pO1xuICB9XG59XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvaW5kZXgudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9pbmRleC50c1wiO2ltcG9ydCBleHByZXNzIGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgY29ycyBmcm9tIFwiY29yc1wiO1xuaW1wb3J0IHsgaGFuZGxlU29sYW5hUnBjIH0gZnJvbSBcIi4vcm91dGVzL3NvbGFuYS1wcm94eVwiO1xuaW1wb3J0IHsgaGFuZGxlU29sYW5hU2VuZCB9IGZyb20gXCIuL3JvdXRlcy9zb2xhbmEtc2VuZFwiO1xuaW1wb3J0IHsgaGFuZGxlU29sYW5hU2ltdWxhdGUgfSBmcm9tIFwiLi9yb3V0ZXMvc29sYW5hLXNpbXVsYXRlXCI7XG5pbXBvcnQgeyBoYW5kbGVXYWxsZXRCYWxhbmNlIH0gZnJvbSBcIi4vcm91dGVzL3dhbGxldC1iYWxhbmNlXCI7XG5pbXBvcnQgeyBoYW5kbGVFeGNoYW5nZVJhdGUgfSBmcm9tIFwiLi9yb3V0ZXMvZXhjaGFuZ2UtcmF0ZVwiO1xuaW1wb3J0IHtcbiAgaGFuZGxlRGV4c2NyZWVuZXJUb2tlbnMsXG4gIGhhbmRsZURleHNjcmVlbmVyU2VhcmNoLFxuICBoYW5kbGVEZXhzY3JlZW5lclRyZW5kaW5nLFxufSBmcm9tIFwiLi9yb3V0ZXMvZGV4c2NyZWVuZXItcHJveHlcIjtcbmltcG9ydCB7IGhhbmRsZVN1Ym1pdFNwbE1ldGEgfSBmcm9tIFwiLi9yb3V0ZXMvc3BsLW1ldGFcIjtcbmltcG9ydCB7XG4gIGhhbmRsZUp1cGl0ZXJQcmljZSxcbiAgaGFuZGxlSnVwaXRlclF1b3RlLFxuICBoYW5kbGVKdXBpdGVyU3dhcCxcbiAgaGFuZGxlSnVwaXRlclRva2Vucyxcbn0gZnJvbSBcIi4vcm91dGVzL2p1cGl0ZXItcHJveHlcIjtcbmltcG9ydCB7IGhhbmRsZUZvcmV4UmF0ZSB9IGZyb20gXCIuL3JvdXRlcy9mb3JleC1yYXRlXCI7XG5pbXBvcnQgeyBoYW5kbGVTdGFibGUyNGggfSBmcm9tIFwiLi9yb3V0ZXMvc3RhYmxlLTI0aFwiO1xuaW1wb3J0IHtcbiAgaGFuZGxlTGlzdFAyUE9yZGVycyxcbiAgaGFuZGxlQ3JlYXRlUDJQT3JkZXIsXG4gIGhhbmRsZUdldFAyUE9yZGVyLFxuICBoYW5kbGVVcGRhdGVQMlBPcmRlcixcbiAgaGFuZGxlRGVsZXRlUDJQT3JkZXIsXG4gIGhhbmRsZUxpc3RUcmFkZVJvb21zLFxuICBoYW5kbGVDcmVhdGVUcmFkZVJvb20sXG4gIGhhbmRsZUdldFRyYWRlUm9vbSxcbiAgaGFuZGxlVXBkYXRlVHJhZGVSb29tLFxuICBoYW5kbGVMaXN0VHJhZGVNZXNzYWdlcyxcbiAgaGFuZGxlQWRkVHJhZGVNZXNzYWdlLFxufSBmcm9tIFwiLi9yb3V0ZXMvcDJwLW9yZGVyc1wiO1xuaW1wb3J0IHtcbiAgaGFuZGxlTGlzdE9yZGVycyxcbiAgaGFuZGxlQ3JlYXRlT3JkZXIsXG4gIGhhbmRsZUdldE9yZGVyLFxuICBoYW5kbGVVcGRhdGVPcmRlcixcbiAgaGFuZGxlRGVsZXRlT3JkZXIsXG59IGZyb20gXCIuL3JvdXRlcy9vcmRlcnNcIjtcbmltcG9ydCB7IGhhbmRsZUZpeG9yaXVtVG9rZW5zIH0gZnJvbSBcIi4vcm91dGVzL2ZpeG9yaXVtLXRva2Vuc1wiO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlU2VydmVyKCk6IFByb21pc2U8ZXhwcmVzcy5BcHBsaWNhdGlvbj4ge1xuICBjb25zdCBhcHAgPSBleHByZXNzKCk7XG5cbiAgLy8gTWlkZGxld2FyZVxuICBhcHAudXNlKGNvcnMoKSk7XG4gIGFwcC51c2UoZXhwcmVzcy5qc29uKCkpO1xuXG4gIC8vIERleFNjcmVlbmVyIHJvdXRlc1xuICBhcHAuZ2V0KFwiL2FwaS9kZXhzY3JlZW5lci90b2tlbnNcIiwgaGFuZGxlRGV4c2NyZWVuZXJUb2tlbnMpO1xuICBhcHAuZ2V0KFwiL2FwaS9kZXhzY3JlZW5lci9zZWFyY2hcIiwgaGFuZGxlRGV4c2NyZWVuZXJTZWFyY2gpO1xuICBhcHAuZ2V0KFwiL2FwaS9kZXhzY3JlZW5lci90cmVuZGluZ1wiLCBoYW5kbGVEZXhzY3JlZW5lclRyZW5kaW5nKTtcblxuICAvLyBKdXBpdGVyIHJvdXRlc1xuICBhcHAuZ2V0KFwiL2FwaS9qdXBpdGVyL3ByaWNlXCIsIGhhbmRsZUp1cGl0ZXJQcmljZSk7XG4gIGFwcC5nZXQoXCIvYXBpL2p1cGl0ZXIvcXVvdGVcIiwgaGFuZGxlSnVwaXRlclF1b3RlKTtcbiAgYXBwLnBvc3QoXCIvYXBpL2p1cGl0ZXIvc3dhcFwiLCBoYW5kbGVKdXBpdGVyU3dhcCk7XG4gIGFwcC5nZXQoXCIvYXBpL2p1cGl0ZXIvdG9rZW5zXCIsIGhhbmRsZUp1cGl0ZXJUb2tlbnMpO1xuXG4gIC8vIFNvbGFuYSBSUEMgcHJveHlcbiAgYXBwLnBvc3QoXCIvYXBpL3NvbGFuYS1ycGNcIiwgaGFuZGxlU29sYW5hUnBjKTtcbiAgYXBwLnBvc3QoXCIvYXBpL3NvbGFuYS1zaW11bGF0ZVwiLCAocmVxLCByZXMpID0+IHtcbiAgICBjb25zdCB7IHNpZ25lZEJhc2U2NCB9ID0gcmVxLmJvZHk7XG4gICAgaGFuZGxlU29sYW5hU2ltdWxhdGUoc2lnbmVkQmFzZTY0KVxuICAgICAgLnRoZW4oKHJlc3VsdCkgPT4gcmVzLmpzb24ocmVzdWx0KSlcbiAgICAgIC5jYXRjaCgoZXJyKSA9PiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gIH0pO1xuICBhcHAucG9zdChcIi9hcGkvc29sYW5hLXNlbmRcIiwgKHJlcSwgcmVzKSA9PiB7XG4gICAgY29uc3QgeyBzaWduZWRCYXNlNjQgfSA9IHJlcS5ib2R5O1xuICAgIGhhbmRsZVNvbGFuYVNlbmQoc2lnbmVkQmFzZTY0KVxuICAgICAgLnRoZW4oKHJlc3VsdCkgPT4gcmVzLmpzb24ocmVzdWx0KSlcbiAgICAgIC5jYXRjaCgoZXJyKSA9PiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XG4gIH0pO1xuXG4gIC8vIFdhbGxldCByb3V0ZXNcbiAgYXBwLmdldChcIi9hcGkvd2FsbGV0L2JhbGFuY2VcIiwgaGFuZGxlV2FsbGV0QmFsYW5jZSk7XG5cbiAgLy8gRXhjaGFuZ2UgcmF0ZSByb3V0ZXNcbiAgYXBwLmdldChcIi9hcGkvZXhjaGFuZ2UtcmF0ZVwiLCBoYW5kbGVFeGNoYW5nZVJhdGUpO1xuICBhcHAuZ2V0KFwiL2FwaS9mb3JleC9yYXRlXCIsIGhhbmRsZUZvcmV4UmF0ZSk7XG4gIGFwcC5nZXQoXCIvYXBpL3N0YWJsZS0yNGhcIiwgaGFuZGxlU3RhYmxlMjRoKTtcblxuICAvLyBPcmRlcnMgcm91dGVzIChuZXcgQVBJKVxuICBhcHAuZ2V0KFwiL2FwaS9vcmRlcnNcIiwgaGFuZGxlTGlzdE9yZGVycyk7XG4gIGFwcC5wb3N0KFwiL2FwaS9vcmRlcnNcIiwgaGFuZGxlQ3JlYXRlT3JkZXIpO1xuICBhcHAuZ2V0KFwiL2FwaS9vcmRlcnMvOm9yZGVySWRcIiwgaGFuZGxlR2V0T3JkZXIpO1xuICBhcHAucHV0KFwiL2FwaS9vcmRlcnMvOm9yZGVySWRcIiwgaGFuZGxlVXBkYXRlT3JkZXIpO1xuICBhcHAuZGVsZXRlKFwiL2FwaS9vcmRlcnMvOm9yZGVySWRcIiwgaGFuZGxlRGVsZXRlT3JkZXIpO1xuXG4gIC8vIFAyUCBPcmRlcnMgcm91dGVzIChsZWdhY3kgQVBJKVxuICBhcHAuZ2V0KFwiL2FwaS9wMnAvb3JkZXJzXCIsIGhhbmRsZUxpc3RQMlBPcmRlcnMpO1xuICBhcHAucG9zdChcIi9hcGkvcDJwL29yZGVyc1wiLCBoYW5kbGVDcmVhdGVQMlBPcmRlcik7XG4gIGFwcC5nZXQoXCIvYXBpL3AycC9vcmRlcnMvOm9yZGVySWRcIiwgaGFuZGxlR2V0UDJQT3JkZXIpO1xuICBhcHAucHV0KFwiL2FwaS9wMnAvb3JkZXJzLzpvcmRlcklkXCIsIGhhbmRsZVVwZGF0ZVAyUE9yZGVyKTtcbiAgYXBwLmRlbGV0ZShcIi9hcGkvcDJwL29yZGVycy86b3JkZXJJZFwiLCBoYW5kbGVEZWxldGVQMlBPcmRlcik7XG5cbiAgLy8gVHJhZGUgUm9vbXMgcm91dGVzXG4gIGFwcC5nZXQoXCIvYXBpL3AycC9yb29tc1wiLCBoYW5kbGVMaXN0VHJhZGVSb29tcyk7XG4gIGFwcC5wb3N0KFwiL2FwaS9wMnAvcm9vbXNcIiwgaGFuZGxlQ3JlYXRlVHJhZGVSb29tKTtcbiAgYXBwLmdldChcIi9hcGkvcDJwL3Jvb21zLzpyb29tSWRcIiwgaGFuZGxlR2V0VHJhZGVSb29tKTtcbiAgYXBwLnB1dChcIi9hcGkvcDJwL3Jvb21zLzpyb29tSWRcIiwgaGFuZGxlVXBkYXRlVHJhZGVSb29tKTtcblxuICAvLyBUcmFkZSBNZXNzYWdlcyByb3V0ZXNcbiAgYXBwLmdldChcIi9hcGkvcDJwL3Jvb21zLzpyb29tSWQvbWVzc2FnZXNcIiwgaGFuZGxlTGlzdFRyYWRlTWVzc2FnZXMpO1xuICBhcHAucG9zdChcIi9hcGkvcDJwL3Jvb21zLzpyb29tSWQvbWVzc2FnZXNcIiwgaGFuZGxlQWRkVHJhZGVNZXNzYWdlKTtcblxuICAvLyBTUEwtTUVUQSBzdWJtaXRcbiAgYXBwLnBvc3QoXCIvYXBpL3NwbC1tZXRhL3N1Ym1pdFwiLCBoYW5kbGVTdWJtaXRTcGxNZXRhKTtcblxuICAvLyBGaXhvcml1bSB0b2tlbnNcbiAgYXBwLmdldChcIi9hcGkvZml4b3JpdW0tdG9rZW5zXCIsIGhhbmRsZUZpeG9yaXVtVG9rZW5zKTtcblxuICAvLyBIZWFsdGggY2hlY2tcbiAgYXBwLmdldChcIi9oZWFsdGhcIiwgKHJlcSwgcmVzKSA9PiB7XG4gICAgcmVzLmpzb24oeyBzdGF0dXM6IFwib2tcIiwgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkgfSk7XG4gIH0pO1xuXG4gIC8vIDQwNCBoYW5kbGVyXG4gIGFwcC51c2UoKHJlcSwgcmVzKSA9PiB7XG4gICAgcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJBUEkgZW5kcG9pbnQgbm90IGZvdW5kXCIsIHBhdGg6IHJlcS5wYXRoIH0pO1xuICB9KTtcblxuICByZXR1cm4gYXBwO1xufVxuXG4vLyBDbG91ZGZsYXJlIFdvcmtlcnMgY29tcGF0aWJpbGl0eSBleHBvcnRcbmV4cG9ydCBkZWZhdWx0IHtcbiAgYXN5bmMgZmV0Y2gocmVxOiBSZXF1ZXN0KTogUHJvbWlzZTxSZXNwb25zZT4ge1xuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwocmVxLnVybCk7XG5cbiAgICBpZiAodXJsLnBhdGhuYW1lLnN0YXJ0c1dpdGgoXCIvYXBpL3NvbGFuYS1ycGNcIikpIHtcbiAgICAgIHJldHVybiBhd2FpdCBoYW5kbGVTb2xhbmFScGMocmVxIGFzIGFueSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShcIldhbGxldCBiYWNrZW5kIGFjdGl2ZVwiLCB7IHN0YXR1czogMjAwIH0pO1xuICB9LFxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcC9jb2RlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL2NvZGUvdml0ZS5jb25maWcubWpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS92aXRlLmNvbmZpZy5tanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tIFwidXJsXCI7XG5pbXBvcnQgeyBXZWJTb2NrZXRTZXJ2ZXIgfSBmcm9tIFwid3NcIjtcblxuY29uc3QgX19kaXJuYW1lID0gcGF0aC5kaXJuYW1lKGZpbGVVUkxUb1BhdGgobmV3IFVSTChpbXBvcnQubWV0YS51cmwpKSk7XG5cbmxldCBhcGlTZXJ2ZXIgPSBudWxsO1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGJhc2U6IFwiLi9cIixcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAge1xuICAgICAgbmFtZTogXCJleHByZXNzLXNlcnZlclwiLFxuICAgICAgYXBwbHk6IFwic2VydmVcIixcbiAgICAgIGFzeW5jIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgICAgLy8gTG9hZCBhbmQgaW5pdGlhbGl6ZSB0aGUgRXhwcmVzcyBzZXJ2ZXJcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB7IGNyZWF0ZVNlcnZlcjogY3JlYXRlRXhwcmVzc1NlcnZlciB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICAgXCIuL3NlcnZlci9pbmRleC50c1wiXG4gICAgICAgICAgKTtcbiAgICAgICAgICBhcGlTZXJ2ZXIgPSBhd2FpdCBjcmVhdGVFeHByZXNzU2VydmVyKCk7XG4gICAgICAgICAgY29uc29sZS5sb2coXCJbVml0ZV0gXHUyNzA1IEV4cHJlc3Mgc2VydmVyIGluaXRpYWxpemVkXCIpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKFwiW1ZpdGVdIFx1Mjc0QyBGYWlsZWQgdG8gaW5pdGlhbGl6ZSBFeHByZXNzOlwiLCBlcnIpO1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlZ2lzdGVyIG1pZGRsZXdhcmUgQkVGT1JFIG90aGVyIG1pZGRsZXdhcmVcbiAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICAgICAgICAvLyBPbmx5IGhhbmRsZSAvYXBpIGFuZCAvaGVhbHRoIHJlcXVlc3RzIHdpdGggdGhlIEV4cHJlc3MgYXBwXG4gICAgICAgICAgaWYgKHJlcS51cmwuc3RhcnRzV2l0aChcIi9hcGlcIikgfHwgcmVxLnVybCA9PT0gXCIvaGVhbHRoXCIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgICBgW1ZpdGUgTWlkZGxld2FyZV0gUm91dGluZyAke3JlcS5tZXRob2R9ICR7cmVxLnVybH0gdG8gRXhwcmVzc2AsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIGFwaVNlcnZlcihyZXEsIHJlcywgbmV4dCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gTGlnaHR3ZWlnaHQgaW4tbWVtb3J5IFdlYlNvY2tldCByb29tcyBhdCAvd3MvOnJvb21JZCBmb3IgZGV2XG4gICAgICAgIGNvbnN0IHdzcyA9IG5ldyBXZWJTb2NrZXRTZXJ2ZXIoeyBub1NlcnZlcjogdHJ1ZSB9KTtcbiAgICAgICAgY29uc3Qgcm9vbXMgPSBuZXcgTWFwKCk7IC8vIHJvb21JZCAtPiBTZXQ8V2ViU29ja2V0PlxuXG4gICAgICAgIHNlcnZlci5odHRwU2VydmVyPy5vbihcInVwZ3JhZGVcIiwgKHJlcXVlc3QsIHNvY2tldCwgaGVhZCkgPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB1cmwgPSByZXF1ZXN0LnVybCB8fCBcIlwiO1xuICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSB1cmwubWF0Y2goL15cXC93c1xcLyguKykkLyk7XG4gICAgICAgICAgICBpZiAoIW1hdGNoKSByZXR1cm47IC8vIG5vdCBvdXIgV1Mgcm91dGVcblxuICAgICAgICAgICAgd3NzLmhhbmRsZVVwZ3JhZGUocmVxdWVzdCwgc29ja2V0LCBoZWFkLCAod3MpID0+IHtcbiAgICAgICAgICAgICAgY29uc3Qgcm9vbUlkID0gZGVjb2RlVVJJQ29tcG9uZW50KG1hdGNoWzFdKTtcbiAgICAgICAgICAgICAgaWYgKCFyb29tcy5oYXMocm9vbUlkKSkgcm9vbXMuc2V0KHJvb21JZCwgbmV3IFNldCgpKTtcbiAgICAgICAgICAgICAgY29uc3Qgc2V0ID0gcm9vbXMuZ2V0KHJvb21JZCk7XG4gICAgICAgICAgICAgIHNldC5hZGQod3MpO1xuXG4gICAgICAgICAgICAgIHdzLm9uKFwibWVzc2FnZVwiLCAoZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBtc2c7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIG1zZyA9IEpTT04ucGFyc2UoZGF0YS50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG1zZyAmJiBtc2cudHlwZSA9PT0gXCJjaGF0XCIpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIGtpbmQ6IFwiY2hhdFwiLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgICAgaWQ6IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpLFxuICAgICAgICAgICAgICAgICAgICAgIHRleHQ6IFN0cmluZyhtc2cudGV4dCB8fCBcIlwiKSxcbiAgICAgICAgICAgICAgICAgICAgICBhdDogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBjbGllbnQgb2Ygc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgY2xpZW50LnNlbmQocGF5bG9hZCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1zZyAmJiBtc2cua2luZCA9PT0gXCJub3RpZmljYXRpb25cIikge1xuICAgICAgICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAga2luZDogXCJub3RpZmljYXRpb25cIixcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogbXNnLmRhdGEsXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY2xpZW50IG9mIHNldCkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgIGNsaWVudC5zZW5kKHBheWxvYWQpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtc2cgJiYgbXNnLnR5cGUgPT09IFwicGluZ1wiKSB7XG4gICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB3cy5zZW5kKEpTT04uc3RyaW5naWZ5KHsga2luZDogXCJwb25nXCIsIHRzOiBEYXRlLm5vdygpIH0pKTtcbiAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgIHdzLm9uKFwiY2xvc2VcIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHNldC5kZWxldGUod3MpO1xuICAgICAgICAgICAgICAgIGlmIChzZXQuc2l6ZSA9PT0gMCkgcm9vbXMuZGVsZXRlKHJvb21JZCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gaWdub3JlIHdzIGVycm9yc1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gRG9uJ3QgcmV0dXJuIGFueXRoaW5nIC0gbWlkZGxld2FyZSBpcyBhbHJlYWR5IHJlZ2lzdGVyZWRcbiAgICAgIH0sXG4gICAgfSxcbiAgXSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6IFwiZGlzdC9zcGFcIixcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgfSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJjbGllbnRcIiksXG4gICAgICBcIkBzaGFyZWRcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJzaGFyZWRcIiksXG4gICAgICBcIkB1dGlsc1wiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcInV0aWxzXCIpLFxuICAgIH0sXG4gIH0sXG59O1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFBeVAsZUFBc0IsZ0JBQWdCLEtBQWlDO0FBQzlULE1BQUk7QUFDRixVQUFNLE9BQU8sTUFBTSxJ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QkFBRyxHQUFHLFNBQVMsTUFBTTtBQUNuQixvQkFBSSxPQUFPLEVBQUU7QUFDYixvQkFBSSxJQUFJLFNBQVMsRUFBRyxDQUFBQSxPQUFNLE9BQU8sTUFBTTtBQUFBLGNBQ3pDLENBQUM7QUFBQSxZQUNILENBQUM7QUFBQSxVQUNILFNBQVMsR0FBRztBQUFBLFVBRVo7QUFBQSxRQUNGLENBQUM7QUFBQSxNQUdIO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLGFBQWE7QUFBQSxFQUNmO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxXQUFXLFFBQVE7QUFBQSxNQUNyQyxXQUFXLEtBQUssUUFBUSxXQUFXLFFBQVE7QUFBQSxNQUMzQyxVQUFVLEtBQUssUUFBUSxXQUFXLE9BQU87QUFBQSxJQUMzQztBQUFBLEVBQ0Y7QUFDRjsiLAogICJuYW1lcyI6IFsicGF0aCIsICJjdXJyZW50RW5kcG9pbnRJbmRleCIsICJwYXRoIiwgImdlbmVyYXRlSWQiLCAicm9vbXMiXQp9Cg==
