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
var RPC_ENDPOINTS, handleSolanaRpc;
var init_solana_proxy = __esm({
  "server/routes/solana-proxy.ts"() {
    RPC_ENDPOINTS = [
      // Prefer environment-configured RPC first
      process.env.SOLANA_RPC_URL || "",
      // Provider-specific overrides
      process.env.ALCHEMY_RPC_URL || "",
      process.env.HELIUS_RPC_URL || "",
      process.env.MORALIS_RPC_URL || "",
      process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : "",
      // Fallback public endpoints (prefer more reliable public node providers first)
      "https://solana.publicnode.com",
      "https://rpc.ankr.com/solana",
      "https://api.mainnet-beta.solana.com"
    ].filter(Boolean);
    handleSolanaRpc = async (req, res) => {
      try {
        const body = req.body;
        if (!body) {
          return res.status(400).json({
            error: "Missing request body"
          });
        }
        const method = body.method || "unknown";
        console.log(
          `[RPC Proxy] ${method} request to ${RPC_ENDPOINTS.length} endpoints`
        );
        let lastError = null;
        let lastErrorStatus = null;
        let lastErrorData = null;
        for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
          const endpoint = RPC_ENDPOINTS[i];
          try {
            console.log(
              `[RPC Proxy] ${method} - Attempting endpoint ${i + 1}/${RPC_ENDPOINTS.length}: ${endpoint.substring(0, 50)}...`
            );
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2e4);
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            const data = await response.text();
            let parsedData = null;
            try {
              parsedData = JSON.parse(data);
            } catch {
            }
            if (parsedData?.error) {
              const errorCode = parsedData.error.code;
              const errorMsg = parsedData.error.message;
              console.warn(
                `[RPC Proxy] ${method} - Endpoint returned RPC error code ${errorCode}: ${errorMsg}`
              );
              lastErrorData = parsedData;
              lastError = new Error(`RPC error (${errorCode}): ${errorMsg}`);
              if (i < RPC_ENDPOINTS.length - 1) {
                continue;
              }
            }
            if (response.status === 403) {
              console.warn(
                `[RPC Proxy] ${method} - Endpoint returned 403 (Access Forbidden), trying next...`
              );
              lastErrorStatus = 403;
              lastError = new Error(`Endpoint blocked: ${endpoint}`);
              continue;
            }
            if (response.status === 429) {
              console.warn(
                `[RPC Proxy] ${method} - Endpoint rate limited (429), trying next...`
              );
              lastErrorStatus = 429;
              lastError = new Error(`Rate limited: ${endpoint}`);
              continue;
            }
            if (!response.ok && response.status >= 500) {
              console.warn(
                `[RPC Proxy] ${method} - Endpoint returned ${response.status}, trying next...`
              );
              lastErrorStatus = response.status;
              lastError = new Error(`Server error: ${response.status}`);
              continue;
            }
            console.log(
              `[RPC Proxy] ${method} - SUCCESS with endpoint ${i + 1} (status: ${response.status})`
            );
            res.set("Content-Type", "application/json");
            return res.status(response.status).send(data);
          } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
            console.warn(
              `[RPC Proxy] ${method} - Endpoint ${i + 1} error:`,
              lastError.message
            );
            if (i < RPC_ENDPOINTS.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
            continue;
          }
        }
        console.error(
          `[RPC Proxy] ${method} - All ${RPC_ENDPOINTS.length} RPC endpoints failed`
        );
        return res.status(lastErrorStatus || 503).json({
          error: lastError?.message || "All RPC endpoints failed - no Solana RPC available",
          details: `Last error: ${lastErrorStatus || "unknown"}`,
          rpcErrorDetails: lastErrorData?.error || null,
          configuredEndpoints: RPC_ENDPOINTS.length
        });
      } catch (error) {
        console.error("[RPC Proxy] Handler error:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "Internal server error"
        });
      }
    };
  }
});

// server/routes/wallet-balance.ts
var RPC_ENDPOINTS2, handleWalletBalance;
var init_wallet_balance = __esm({
  "server/routes/wallet-balance.ts"() {
    RPC_ENDPOINTS2 = [
      // Prefer environment-configured RPC first
      process.env.SOLANA_RPC_URL || "",
      // Provider-specific overrides
      process.env.ALCHEMY_RPC_URL || "",
      process.env.HELIUS_RPC_URL || "",
      process.env.MORALIS_RPC_URL || "",
      process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : "",
      // Fallback public endpoints (prefer publicnode and ankr first)
      "https://solana.publicnode.com",
      "https://rpc.ankr.com/solana",
      "https://api.mainnet-beta.solana.com"
    ].filter(Boolean);
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
        let lastError = null;
        for (const endpoint of RPC_ENDPOINTS2) {
          try {
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body)
            });
            const data = await response.json();
            if (data.error) {
              console.warn(`RPC ${endpoint} returned error:`, data.error);
              lastError = new Error(data.error.message || "RPC error");
              continue;
            }
            const balanceLamports = data.result;
            const balanceSOL = balanceLamports / 1e9;
            return res.json({
              publicKey,
              balance: balanceSOL,
              balanceLamports
            });
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`RPC endpoint ${endpoint} failed:`, lastError.message);
            continue;
          }
        }
        console.error("All RPC endpoints failed for wallet balance");
        return res.status(500).json({
          error: lastError?.message || "Failed to fetch balance - all RPC endpoints failed"
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
  const pairAddress = MINT_TO_PAIR_ADDRESS[mint];
  if (pairAddress) {
    try {
      const pairUrl = `https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`;
      console.log(
        `[DexScreener] Trying pair address lookup for ${mint}: ${pairUrl}`
      );
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8e3);
      const response = await fetch(pairUrl, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)"
        }
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        if (data.pairs && data.pairs.length > 0) {
          const priceUsd = data.pairs[0].priceUsd;
          if (priceUsd) {
            const price = parseFloat(priceUsd);
            console.log(
              `[DexScreener] \u2705 Got price for ${mint} via pair address: $${price}`
            );
            return price;
          }
        }
      }
    } catch (error) {
      console.warn(
        `[DexScreener] \u26A0\uFE0F Pair address lookup failed:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
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
    const searchSymbol = MINT_TO_SEARCH_SYMBOL[mint];
    if (searchSymbol) {
      console.log(
        `[DexScreener] No pairs found, trying search fallback for ${searchSymbol}`
      );
      try {
        const searchUrl = `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(searchSymbol)}`;
        const searchController = new AbortController();
        const searchTimeoutId = setTimeout(
          () => searchController.abort(),
          8e3
        );
        const searchResponse = await fetch(searchUrl, {
          signal: searchController.signal,
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)"
          }
        });
        clearTimeout(searchTimeoutId);
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.pairs && searchData.pairs.length > 0) {
            let matchingPair = searchData.pairs.find(
              (p) => p.baseToken?.address === mint && p.chainId === "solana"
            );
            if (!matchingPair) {
              matchingPair = searchData.pairs.find(
                (p) => p.quoteToken?.address === mint && p.chainId === "solana"
              );
            }
            if (!matchingPair) {
              matchingPair = searchData.pairs.find(
                (p) => p.baseToken?.address === mint
              );
            }
            if (!matchingPair) {
              matchingPair = searchData.pairs.find(
                (p) => p.quoteToken?.address === mint
              );
            }
            if (!matchingPair) {
              matchingPair = searchData.pairs[0];
            }
            if (matchingPair && matchingPair.priceUsd) {
              const price = parseFloat(matchingPair.priceUsd);
              console.log(
                `[DexScreener] \u2705 Got price for ${mint} via search: $${price}`
              );
              return price;
            }
          }
        }
      } catch (searchErr) {
        console.warn(
          `[DexScreener] Search fallback failed:`,
          searchErr instanceof Error ? searchErr.message : String(searchErr)
        );
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
var TOKEN_MINTS, FALLBACK_RATES, PKR_PER_USD, MARKUP, MINT_TO_PAIR_ADDRESS, MINT_TO_SEARCH_SYMBOL, handleExchangeRate;
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
    MINT_TO_PAIR_ADDRESS = {
      H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: "5CgLEWq9VJUEQ8my8UaxEovuSWArGoXCvaftpbX4RQMy",
      EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: "7X7KkV94Y9jFhkXEMhgVcMHMRzALiGj5xKmM6TT3cUvK"
    };
    MINT_TO_SEARCH_SYMBOL = {
      H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: "FIXERCOIN",
      EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: "LOCKER"
    };
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
var DEXSCREENER_ENDPOINTS, CACHE_TTL_MS, MAX_TOKENS_PER_BATCH, currentEndpointIndex, cache, inflightRequests, tryDexscreenerEndpoints, fetchDexscreenerData, mergePairsByToken, MINT_TO_PAIR_ADDRESS2, MINT_TO_SEARCH_SYMBOL2, handleDexscreenerTokens, handleDexscreenerSearch, handleDexscreenerTrending;
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
    MINT_TO_PAIR_ADDRESS2 = {
      H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: "5CgLEWq9VJUEQ8my8UaxEovuSWArGoXCvaftpbX4RQMy",
      // FIXERCOIN
      EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: "7X7KkV94Y9jFhkXEMhgVcMHMRzALiGj5xKmM6TT3cUvK"
      // LOCKER (if available)
    };
    MINT_TO_SEARCH_SYMBOL2 = {
      H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: "FIXERCOIN",
      EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: "LOCKER"
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
        const requestedMintsSet = new Set(uniqueMints);
        const foundMintsSet = /* @__PURE__ */ new Set();
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
          data.pairs.forEach((pair) => {
            if (pair.baseToken?.address) {
              foundMintsSet.add(pair.baseToken.address);
            }
            if (pair.quoteToken?.address) {
              foundMintsSet.add(pair.quoteToken.address);
            }
          });
        }
        const missingMints = Array.from(requestedMintsSet).filter(
          (m) => !foundMintsSet.has(m)
        );
        if (missingMints.length > 0) {
          console.log(
            `[DexScreener] ${missingMints.length} mints not found via batch, trying pair/search fallback`
          );
          for (const mint of missingMints) {
            let found = false;
            const pairAddress = MINT_TO_PAIR_ADDRESS2[mint];
            if (pairAddress) {
              try {
                console.log(
                  `[DexScreener] Trying pair address lookup for ${mint}: ${pairAddress}`
                );
                const pairData = await fetchDexscreenerData(
                  `/pairs/solana/${pairAddress}`
                );
                console.log(
                  `[DexScreener] Pair lookup response: ${pairData ? "received" : "null"}, pairs: ${pairData?.pairs?.length || 0}`
                );
                if (pairData?.pairs && Array.isArray(pairData.pairs) && pairData.pairs.length > 0) {
                  let pair = pairData.pairs[0];
                  console.log(
                    `[DexScreener] Pair address lookup raw data: baseToken=${pair.baseToken?.address}, quoteToken=${pair.quoteToken?.address}, priceUsd=${pair.priceUsd}`
                  );
                  if (pair.quoteToken?.address === mint && pair.baseToken?.address !== mint) {
                    const basePrice = pair.priceUsd ? parseFloat(pair.priceUsd) : 0;
                    const invertedPrice = basePrice > 0 ? (1 / basePrice).toFixed(20) : "0";
                    console.log(
                      `[DexScreener] Swapping tokens: ${mint} was quoteToken, inverting price ${pair.priceUsd} -> ${invertedPrice}`
                    );
                    pair = {
                      ...pair,
                      baseToken: pair.quoteToken,
                      quoteToken: pair.baseToken,
                      priceUsd: invertedPrice,
                      priceNative: pair.priceNative ? (1 / parseFloat(pair.priceNative)).toString() : "0"
                    };
                  }
                  console.log(
                    `[DexScreener] \u2705 Found ${mint} via pair address, baseToken=${pair.baseToken?.symbol || "UNKNOWN"}, priceUsd: ${pair.priceUsd || "N/A"}`
                  );
                  results.push(pair);
                  foundMintsSet.add(mint);
                  found = true;
                } else {
                  console.warn(
                    `[DexScreener] Pair lookup returned no pairs for ${mint}`
                  );
                }
              } catch (pairErr) {
                console.warn(
                  `[DexScreener] \u26A0\uFE0F Pair address lookup failed for ${mint}:`,
                  pairErr instanceof Error ? pairErr.message : String(pairErr)
                );
              }
            }
            if (!found) {
              const searchSymbol = MINT_TO_SEARCH_SYMBOL2[mint];
              if (searchSymbol) {
                try {
                  console.log(
                    `[DexScreener] Searching for ${mint} using symbol: ${searchSymbol}`
                  );
                  const searchData = await fetchDexscreenerData(
                    `/search/?q=${encodeURIComponent(searchSymbol)}`
                  );
                  if (searchData?.pairs && Array.isArray(searchData.pairs)) {
                    let matchingPair = searchData.pairs.find(
                      (p) => p.baseToken?.address === mint && p.chainId === "solana"
                    );
                    if (!matchingPair) {
                      matchingPair = searchData.pairs.find(
                        (p) => p.quoteToken?.address === mint && p.chainId === "solana"
                      );
                    }
                    if (!matchingPair) {
                      matchingPair = searchData.pairs.find(
                        (p) => p.baseToken?.address === mint
                      );
                    }
                    if (!matchingPair) {
                      matchingPair = searchData.pairs.find(
                        (p) => p.quoteToken?.address === mint
                      );
                    }
                    if (!matchingPair && searchData.pairs.length > 0) {
                      matchingPair = searchData.pairs[0];
                    }
                    if (matchingPair) {
                      console.log(
                        `[DexScreener] \u2705 Found ${searchSymbol} (${mint}) via search, chainId: ${matchingPair.chainId}, priceUsd: ${matchingPair.priceUsd || "N/A"}`
                      );
                      results.push(matchingPair);
                      foundMintsSet.add(mint);
                    } else {
                      console.warn(
                        `[DexScreener] \u26A0\uFE0F Search returned 0 results for ${mint}`
                      );
                    }
                  }
                } catch (searchErr) {
                  console.warn(
                    `[DexScreener] \u26A0\uFE0F Search fallback failed for ${mint}:`,
                    searchErr instanceof Error ? searchErr.message : String(searchErr)
                  );
                }
              }
            }
          }
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
          `[DexScreener] \u2705 Response: ${solanaPairs.length} Solana pairs found across ${batches.length} batch(es)` + (missingMints.length > 0 ? ` (${missingMints.length} required search fallback)` : "")
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

// server/routes/coinmarketcap-proxy.ts
var CMC_API_KEY, CMC_BASE_URL, handleCoinMarketCapQuotes, handleCoinMarketCapSearch;
var init_coinmarketcap_proxy = __esm({
  "server/routes/coinmarketcap-proxy.ts"() {
    CMC_API_KEY = process.env.COINMARKETCAP_API_KEY || "";
    CMC_BASE_URL = "https://pro-api.coinmarketcap.com/v1";
    handleCoinMarketCapQuotes = async (req, res) => {
      try {
        const symbols = req.query.symbols;
        if (!symbols || !symbols.trim()) {
          return res.status(400).json({
            error: "Missing or empty 'symbols' query parameter"
          });
        }
        if (!CMC_API_KEY) {
          console.warn(
            "[CoinMarketCap] No API key configured - set COINMARKETCAP_API_KEY environment variable"
          );
          return res.status(503).json({
            error: "CoinMarketCap API key not configured on server. Please add COINMARKETCAP_API_KEY to environment variables.",
            data: null
          });
        }
        console.log(
          `[CoinMarketCap] Fetching quotes for symbols: ${symbols.substring(0, 100)}`
        );
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15e3);
        const url = new URL(`${CMC_BASE_URL}/cryptocurrency/quotes/latest`);
        url.searchParams.append("symbol", symbols);
        url.searchParams.append("convert", "USD");
        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "X-CMC_PRO_API_KEY": CMC_API_KEY,
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          console.error(
            `[CoinMarketCap] API error: ${response.status} ${response.statusText}`
          );
          return res.status(response.status).json({
            error: `CoinMarketCap API error: ${response.status}`,
            details: errorText,
            data: null
          });
        }
        const data = await response.json();
        if (data.status?.error_code !== 0) {
          console.warn(
            `[CoinMarketCap] API returned error: ${data.status?.error_message}`
          );
          return res.status(400).json({
            error: data.status?.error_message || "CoinMarketCap API error",
            data: null
          });
        }
        console.log(
          `[CoinMarketCap] \u2705 Got quotes for ${Object.keys(data.data || {}).length} symbols`
        );
        res.json(data);
      } catch (error) {
        if (error.name === "AbortError") {
          console.warn("[CoinMarketCap] Request timeout");
          return res.status(504).json({
            error: "CoinMarketCap request timeout",
            data: null
          });
        }
        console.error("[CoinMarketCap] Proxy error:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "Internal server error",
          data: null
        });
      }
    };
    handleCoinMarketCapSearch = async (req, res) => {
      try {
        const query = req.query.q;
        if (!query || !query.trim()) {
          return res.status(400).json({
            error: "Missing or empty 'q' query parameter"
          });
        }
        if (!CMC_API_KEY) {
          return res.status(503).json({
            error: "CoinMarketCap API key not configured. Set COINMARKETCAP_API_KEY environment variable.",
            data: null
          });
        }
        console.log(`[CoinMarketCap] Searching for: ${query}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15e3);
        const url = new URL(`${CMC_BASE_URL}/cryptocurrency/map`);
        url.searchParams.append("symbol", query.toUpperCase());
        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "X-CMC_PRO_API_KEY": CMC_API_KEY,
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          console.error(
            `[CoinMarketCap] Search error: ${response.status} ${response.statusText}`
          );
          return res.status(response.status).json({
            error: `CoinMarketCap search error: ${response.status}`,
            details: errorText,
            data: null
          });
        }
        const data = await response.json();
        res.json(data);
      } catch (error) {
        if (error.name === "AbortError") {
          return res.status(504).json({
            error: "CoinMarketCap search timeout",
            data: null
          });
        }
        console.error("[CoinMarketCap] Search proxy error:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "Internal server error",
          data: null
        });
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
          const timeoutId = setTimeout(() => controller.abort(), 15e3);
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
          for (let attempt = 1; attempt <= 3; attempt++) {
            for (const endpoint of endpoints) {
              try {
                const response = await fetchWithTimeout(endpoint, 15e3);
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
            await new Promise((r) => setTimeout(r, attempt * 500));
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
        for (let attempt = 1; attempt <= 3; attempt++) {
          const response = await fetchWithTimeout(15e3);
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
              `Jupiter API returned ${response.status}, retrying... (attempt ${attempt}/3)`
            );
            await new Promise((r) => setTimeout(r, attempt * 500));
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

// server/routes/dextools-proxy.ts
var DEXTOOLS_API_BASE, handleDexToolsPrice;
var init_dextools_proxy = __esm({
  "server/routes/dextools-proxy.ts"() {
    DEXTOOLS_API_BASE = "https://api.dextools.io/v1";
    handleDexToolsPrice = async (req, res) => {
      try {
        const { tokenAddress, chainId } = req.query;
        if (!tokenAddress || typeof tokenAddress !== "string") {
          return res.status(400).json({
            error: "Missing or invalid 'tokenAddress' parameter"
          });
        }
        const chain = chainId || "solana";
        console.log(
          `[DexTools Proxy] Fetching price for ${tokenAddress} on chain ${chain}`
        );
        const url = `${DEXTOOLS_API_BASE}/token/${chain}/${tokenAddress}`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json"
          }
        });
        if (!response.ok) {
          console.warn(
            `[DexTools Proxy] API returned ${response.status} for ${tokenAddress}`
          );
          return res.status(response.status).json({
            error: `DexTools API error: ${response.status}`
          });
        }
        const data = await response.json();
        if (data.data?.priceUsd) {
          console.log(
            `[DexTools Proxy] Price retrieved: ${tokenAddress} = $${data.data.priceUsd}`
          );
          return res.json({
            tokenAddress,
            priceUsd: data.data.priceUsd,
            priceUsdChange24h: data.data.priceUsdChange24h,
            marketCap: data.data.marketCap,
            liquidity: data.data.liquidity,
            volume24h: data.data.volume24h
          });
        }
        console.warn(`[DexTools Proxy] No price data for ${tokenAddress}`);
        return res.status(404).json({
          error: "Token not found in DexTools",
          tokenAddress
        });
      } catch (error) {
        console.error("[DexTools Proxy] Error:", error);
        return res.status(500).json({
          error: error instanceof Error ? error.message : "Internal server error"
        });
      }
    };
  }
});

// server/routes/p2p-orders.ts
function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
var rooms, messages, handleListTradeRooms, handleCreateTradeRoom, handleGetTradeRoom, handleUpdateTradeRoom, handleListTradeMessages, handleAddTradeMessage;
var init_p2p_orders = __esm({
  "server/routes/p2p-orders.ts"() {
    rooms = /* @__PURE__ */ new Map();
    messages = /* @__PURE__ */ new Map();
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
import express from "file:///root/app/code/node_modules/express/index.js";
import cors from "file:///root/app/code/node_modules/cors/lib/index.js";
async function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get("/api/dexscreener/tokens", handleDexscreenerTokens);
  app.get("/api/dexscreener/search", handleDexscreenerSearch);
  app.get("/api/dexscreener/trending", handleDexscreenerTrending);
  app.get("/api/coinmarketcap/quotes", handleCoinMarketCapQuotes);
  app.get("/api/coinmarketcap/search", handleCoinMarketCapSearch);
  app.get("/api/dextools/price", handleDexToolsPrice);
  app.get("/api/jupiter/price", handleJupiterPrice);
  app.get("/api/jupiter/quote", handleJupiterQuote);
  app.post("/api/jupiter/swap", handleJupiterSwap);
  app.get("/api/jupiter/tokens", handleJupiterTokens);
  app.post("/api/solana-rpc", handleSolanaRpc);
  app.get("/api/wallet/balance", handleWalletBalance);
  app.all(["/api/pumpfun/quote", "/api/pumpfun/swap"], async (req, res) => {
    try {
      const path2 = req.path.replace("/api/pumpfun", "");
      if (path2 === "//quote" || path2 === "/quote") {
        const method = req.method.toUpperCase();
        let inputMint = "";
        let outputMint = "";
        let amount = "";
        if (method === "POST") {
          const body = req.body || {};
          inputMint = body.inputMint || body.input_mint || "";
          outputMint = body.outputMint || body.output_mint || "";
          amount = body.amount || "";
        } else {
          inputMint = String(req.query.inputMint || req.query.input_mint || "");
          outputMint = String(
            req.query.outputMint || req.query.output_mint || ""
          );
          amount = String(req.query.amount || "");
        }
        if (!inputMint || !outputMint || !amount) {
          return res.status(400).json({
            error: "Missing required parameters: inputMint, outputMint, amount"
          });
        }
        const url = `https://api.pumpfun.com/api/v1/quote?input_mint=${encodeURIComponent(
          inputMint
        )}&output_mint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1e4);
        const resp = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (!resp.ok)
          return res.status(resp.status).json({ error: "Pumpfun API error" });
        const data = await resp.json();
        return res.json(data);
      }
      if (path2 === "//swap" || path2 === "/swap") {
        if (req.method !== "POST")
          return res.status(405).json({ error: "Method not allowed" });
        const body = req.body || {};
        const resp = await fetch("https://api.pumpfun.com/api/v1/swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        if (!resp.ok)
          return res.status(resp.status).json({ error: "Pumpfun swap failed" });
        const data = await resp.json();
        return res.json(data);
      }
      return res.status(404).json({ error: "Pumpfun proxy path not found" });
    } catch (e) {
      return res.status(502).json({
        error: "Failed to proxy Pumpfun request",
        details: e?.message || String(e)
      });
    }
  });
  app.get("/api/token/price", async (req, res) => {
    try {
      const tokenParam = String(
        req.query.token || req.query.symbol || "FIXERCOIN"
      ).toUpperCase();
      const mintParam = String(req.query.mint || "");
      const FALLBACK_USD = {
        FIXERCOIN: 5e-3,
        SOL: 180,
        USDC: 1,
        USDT: 1,
        LOCKER: 0.1
      };
      if (tokenParam === "USDC" || tokenParam === "USDT") {
        return res.json({ token: tokenParam, priceUsd: 1 });
      }
      if (tokenParam === "SOL")
        return res.json({ token: "SOL", priceUsd: FALLBACK_USD.SOL });
      if (tokenParam === "FIXERCOIN")
        return res.json({
          token: "FIXERCOIN",
          priceUsd: FALLBACK_USD.FIXERCOIN
        });
      if (tokenParam === "LOCKER")
        return res.json({ token: "LOCKER", priceUsd: FALLBACK_USD.LOCKER });
      const TOKEN_MINTS2 = {
        SOL: "So11111111111111111111111111111111111111112",
        USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
        FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
        LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump"
      };
      let token = tokenParam;
      let mint = mintParam || TOKEN_MINTS2[token] || "";
      if (!mint && tokenParam && tokenParam.length > 40) {
        mint = tokenParam;
        const inv = Object.entries(TOKEN_MINTS2).find(([, m]) => m === mint);
        if (inv) token = inv[0];
      }
      const fallback = FALLBACK_USD[token] ?? null;
      if (fallback !== null) return res.json({ token, priceUsd: fallback });
      return res.status(404).json({ error: "Token price not available" });
    } catch (e) {
      return res.status(502).json({
        error: "Failed to fetch token price",
        details: e?.message || String(e)
      });
    }
  });
  app.get("/api/exchange-rate", handleExchangeRate);
  app.get("/api/forex/rate", handleForexRate);
  app.get("/api/stable-24h", handleStable24h);
  app.get("/api/orders", handleListOrders);
  app.post("/api/orders", handleCreateOrder);
  app.get("/api/orders/:orderId", handleGetOrder);
  app.put("/api/orders/:orderId", handleUpdateOrder);
  app.delete("/api/orders/:orderId", handleDeleteOrder);
  app.get(
    "/api/p2p/orders",
    (req, res) => res.status(410).json({ error: "P2P orders API is disabled on this server" })
  );
  app.post(
    "/api/p2p/orders",
    (req, res) => res.status(410).json({ error: "P2P orders API is disabled on this server" })
  );
  app.get(
    "/api/p2p/orders/:orderId",
    (req, res) => res.status(410).json({ error: "P2P orders API is disabled on this server" })
  );
  app.put(
    "/api/p2p/orders/:orderId",
    (req, res) => res.status(410).json({ error: "P2P orders API is disabled on this server" })
  );
  app.delete(
    "/api/p2p/orders/:orderId",
    (req, res) => res.status(410).json({ error: "P2P orders API is disabled on this server" })
  );
  app.get("/api/p2p/rooms", handleListTradeRooms);
  app.post("/api/p2p/rooms", handleCreateTradeRoom);
  app.get("/api/p2p/rooms/:roomId", handleGetTradeRoom);
  app.put("/api/p2p/rooms/:roomId", handleUpdateTradeRoom);
  app.get("/api/p2p/rooms/:roomId/messages", handleListTradeMessages);
  app.post("/api/p2p/rooms/:roomId/messages", handleAddTradeMessage);
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
    init_wallet_balance();
    init_exchange_rate();
    init_dexscreener_proxy();
    init_coinmarketcap_proxy();
    init_jupiter_proxy();
    init_forex_rate();
    init_stable_24h();
    init_dextools_proxy();
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
import { defineConfig } from "file:///root/app/code/node_modules/vite/dist/node/index.js";
import react from "file:///root/app/code/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "file:///root/app/code/node_modules/ws/wrapper.mjs";
var __vite_injected_original_import_meta_url = "file:///root/app/code/vite.config.mjs";
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic2VydmVyL3JvdXRlcy9zb2xhbmEtcHJveHkudHMiLCAic2VydmVyL3JvdXRlcy93YWxsZXQtYmFsYW5jZS50cyIsICJzZXJ2ZXIvcm91dGVzL2V4Y2hhbmdlLXJhdGUudHMiLCAic2VydmVyL3JvdXRlcy9kZXhzY3JlZW5lci1wcm94eS50cyIsICJzZXJ2ZXIvcm91dGVzL2NvaW5tYXJrZXRjYXAtcHJveHkudHMiLCAic2VydmVyL3JvdXRlcy9qdXBpdGVyLXByb3h5LnRzIiwgInNlcnZlci9yb3V0ZXMvZm9yZXgtcmF0ZS50cyIsICJzZXJ2ZXIvcm91dGVzL3N0YWJsZS0yNGgudHMiLCAic2VydmVyL3JvdXRlcy9kZXh0b29scy1wcm94eS50cyIsICJzZXJ2ZXIvcm91dGVzL3AycC1vcmRlcnMudHMiLCAic2VydmVyL3JvdXRlcy9vcmRlcnMudHMiLCAic2VydmVyL2luZGV4LnRzIiwgInZpdGUuY29uZmlnLm1qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc29sYW5hLXByb3h5LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc29sYW5hLXByb3h5LnRzXCI7aW1wb3J0IHsgUmVxdWVzdEhhbmRsZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5jb25zdCBSUENfRU5EUE9JTlRTID0gW1xuICAvLyBQcmVmZXIgZW52aXJvbm1lbnQtY29uZmlndXJlZCBSUEMgZmlyc3RcbiAgcHJvY2Vzcy5lbnYuU09MQU5BX1JQQ19VUkwgfHwgXCJcIixcbiAgLy8gUHJvdmlkZXItc3BlY2lmaWMgb3ZlcnJpZGVzXG4gIHByb2Nlc3MuZW52LkFMQ0hFTVlfUlBDX1VSTCB8fCBcIlwiLFxuICBwcm9jZXNzLmVudi5IRUxJVVNfUlBDX1VSTCB8fCBcIlwiLFxuICBwcm9jZXNzLmVudi5NT1JBTElTX1JQQ19VUkwgfHwgXCJcIixcbiAgcHJvY2Vzcy5lbnYuSEVMSVVTX0FQSV9LRVlcbiAgICA/IGBodHRwczovL21haW5uZXQuaGVsaXVzLXJwYy5jb20vP2FwaS1rZXk9JHtwcm9jZXNzLmVudi5IRUxJVVNfQVBJX0tFWX1gXG4gICAgOiBcIlwiLFxuICAvLyBGYWxsYmFjayBwdWJsaWMgZW5kcG9pbnRzIChwcmVmZXIgbW9yZSByZWxpYWJsZSBwdWJsaWMgbm9kZSBwcm92aWRlcnMgZmlyc3QpXG4gIFwiaHR0cHM6Ly9zb2xhbmEucHVibGljbm9kZS5jb21cIixcbiAgXCJodHRwczovL3JwYy5hbmtyLmNvbS9zb2xhbmFcIixcbiAgXCJodHRwczovL2FwaS5tYWlubmV0LWJldGEuc29sYW5hLmNvbVwiLFxuXS5maWx0ZXIoQm9vbGVhbik7XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVTb2xhbmFScGM6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgYm9keSA9IHJlcS5ib2R5O1xuXG4gICAgaWYgKCFib2R5KSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oe1xuICAgICAgICBlcnJvcjogXCJNaXNzaW5nIHJlcXVlc3QgYm9keVwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgbWV0aG9kID0gYm9keS5tZXRob2QgfHwgXCJ1bmtub3duXCI7XG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW1JQQyBQcm94eV0gJHttZXRob2R9IHJlcXVlc3QgdG8gJHtSUENfRU5EUE9JTlRTLmxlbmd0aH0gZW5kcG9pbnRzYCxcbiAgICApO1xuXG4gICAgbGV0IGxhc3RFcnJvcjogRXJyb3IgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgbGFzdEVycm9yU3RhdHVzOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgbGFzdEVycm9yRGF0YTogYW55ID0gbnVsbDtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgUlBDX0VORFBPSU5UUy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgZW5kcG9pbnQgPSBSUENfRU5EUE9JTlRTW2ldO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgYFtSUEMgUHJveHldICR7bWV0aG9kfSAtIEF0dGVtcHRpbmcgZW5kcG9pbnQgJHtpICsgMX0vJHtSUENfRU5EUE9JTlRTLmxlbmd0aH06ICR7ZW5kcG9pbnQuc3Vic3RyaW5nKDAsIDUwKX0uLi5gLFxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCAyMDAwMCk7IC8vIDIwIHNlY29uZCB0aW1lb3V0XG5cbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChlbmRwb2ludCwge1xuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9LFxuICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuICAgICAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuXG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XG4gICAgICAgIGxldCBwYXJzZWREYXRhOiBhbnkgPSBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHBhcnNlZERhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICB9IGNhdGNoIHt9XG5cbiAgICAgICAgLy8gQ2hlY2sgZm9yIFJQQyBlcnJvcnMgaW4gcmVzcG9uc2VcbiAgICAgICAgaWYgKHBhcnNlZERhdGE/LmVycm9yKSB7XG4gICAgICAgICAgY29uc3QgZXJyb3JDb2RlID0gcGFyc2VkRGF0YS5lcnJvci5jb2RlO1xuICAgICAgICAgIGNvbnN0IGVycm9yTXNnID0gcGFyc2VkRGF0YS5lcnJvci5tZXNzYWdlO1xuICAgICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICAgIGBbUlBDIFByb3h5XSAke21ldGhvZH0gLSBFbmRwb2ludCByZXR1cm5lZCBSUEMgZXJyb3IgY29kZSAke2Vycm9yQ29kZX06ICR7ZXJyb3JNc2d9YCxcbiAgICAgICAgICApO1xuICAgICAgICAgIGxhc3RFcnJvckRhdGEgPSBwYXJzZWREYXRhO1xuICAgICAgICAgIGxhc3RFcnJvciA9IG5ldyBFcnJvcihgUlBDIGVycm9yICgke2Vycm9yQ29kZX0pOiAke2Vycm9yTXNnfWApO1xuXG4gICAgICAgICAgLy8gU29tZSBlbmRwb2ludHMgZG9uJ3Qgc3VwcG9ydCBjZXJ0YWluIG1ldGhvZHMsIHNraXAgYW5kIHRyeSBuZXh0XG4gICAgICAgICAgaWYgKGkgPCBSUENfRU5EUE9JTlRTLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRyZWF0IDQwMyBlcnJvcnMgYXMgZW5kcG9pbnQgYmVpbmcgYmxvY2tlZC9yYXRlIGxpbWl0ZWQsIHRyeSBuZXh0XG4gICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQwMykge1xuICAgICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICAgIGBbUlBDIFByb3h5XSAke21ldGhvZH0gLSBFbmRwb2ludCByZXR1cm5lZCA0MDMgKEFjY2VzcyBGb3JiaWRkZW4pLCB0cnlpbmcgbmV4dC4uLmAsXG4gICAgICAgICAgKTtcbiAgICAgICAgICBsYXN0RXJyb3JTdGF0dXMgPSA0MDM7XG4gICAgICAgICAgbGFzdEVycm9yID0gbmV3IEVycm9yKGBFbmRwb2ludCBibG9ja2VkOiAke2VuZHBvaW50fWApO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVHJlYXQgNDI5IChyYXRlIGxpbWl0KSBhcyB0ZW1wb3JhcnksIHNraXAgdG8gbmV4dFxuICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MjkpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICBgW1JQQyBQcm94eV0gJHttZXRob2R9IC0gRW5kcG9pbnQgcmF0ZSBsaW1pdGVkICg0MjkpLCB0cnlpbmcgbmV4dC4uLmAsXG4gICAgICAgICAgKTtcbiAgICAgICAgICBsYXN0RXJyb3JTdGF0dXMgPSA0Mjk7XG4gICAgICAgICAgbGFzdEVycm9yID0gbmV3IEVycm9yKGBSYXRlIGxpbWl0ZWQ6ICR7ZW5kcG9pbnR9YCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGb3Igb3RoZXIgc2VydmVyIGVycm9ycywgdHJ5IG5leHQgZW5kcG9pbnRcbiAgICAgICAgaWYgKCFyZXNwb25zZS5vayAmJiByZXNwb25zZS5zdGF0dXMgPj0gNTAwKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgYFtSUEMgUHJveHldICR7bWV0aG9kfSAtIEVuZHBvaW50IHJldHVybmVkICR7cmVzcG9uc2Uuc3RhdHVzfSwgdHJ5aW5nIG5leHQuLi5gLFxuICAgICAgICAgICk7XG4gICAgICAgICAgbGFzdEVycm9yU3RhdHVzID0gcmVzcG9uc2Uuc3RhdHVzO1xuICAgICAgICAgIGxhc3RFcnJvciA9IG5ldyBFcnJvcihgU2VydmVyIGVycm9yOiAke3Jlc3BvbnNlLnN0YXR1c31gKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN1Y2Nlc3Mgb3IgY2xpZW50IGVycm9yIC0gcmV0dXJuIHJlc3BvbnNlXG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIGBbUlBDIFByb3h5XSAke21ldGhvZH0gLSBTVUNDRVNTIHdpdGggZW5kcG9pbnQgJHtpICsgMX0gKHN0YXR1czogJHtyZXNwb25zZS5zdGF0dXN9KWAsXG4gICAgICAgICk7XG4gICAgICAgIHJlcy5zZXQoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyhyZXNwb25zZS5zdGF0dXMpLnNlbmQoZGF0YSk7XG4gICAgICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICAgICAgbGFzdEVycm9yID0gZSBpbnN0YW5jZW9mIEVycm9yID8gZSA6IG5ldyBFcnJvcihTdHJpbmcoZSkpO1xuICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgYFtSUEMgUHJveHldICR7bWV0aG9kfSAtIEVuZHBvaW50ICR7aSArIDF9IGVycm9yOmAsXG4gICAgICAgICAgbGFzdEVycm9yLm1lc3NhZ2UsXG4gICAgICAgICk7XG4gICAgICAgIC8vIFRyeSBuZXh0IGVuZHBvaW50XG4gICAgICAgIGlmIChpIDwgUlBDX0VORFBPSU5UUy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgNTAwKSk7IC8vIEJyaWVmIGRlbGF5IGJlZm9yZSByZXRyeVxuICAgICAgICB9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBgW1JQQyBQcm94eV0gJHttZXRob2R9IC0gQWxsICR7UlBDX0VORFBPSU5UUy5sZW5ndGh9IFJQQyBlbmRwb2ludHMgZmFpbGVkYCxcbiAgICApO1xuICAgIHJldHVybiByZXMuc3RhdHVzKGxhc3RFcnJvclN0YXR1cyB8fCA1MDMpLmpzb24oe1xuICAgICAgZXJyb3I6XG4gICAgICAgIGxhc3RFcnJvcj8ubWVzc2FnZSB8fFxuICAgICAgICBcIkFsbCBSUEMgZW5kcG9pbnRzIGZhaWxlZCAtIG5vIFNvbGFuYSBSUEMgYXZhaWxhYmxlXCIsXG4gICAgICBkZXRhaWxzOiBgTGFzdCBlcnJvcjogJHtsYXN0RXJyb3JTdGF0dXMgfHwgXCJ1bmtub3duXCJ9YCxcbiAgICAgIHJwY0Vycm9yRGV0YWlsczogbGFzdEVycm9yRGF0YT8uZXJyb3IgfHwgbnVsbCxcbiAgICAgIGNvbmZpZ3VyZWRFbmRwb2ludHM6IFJQQ19FTkRQT0lOVFMubGVuZ3RoLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJbUlBDIFByb3h5XSBIYW5kbGVyIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJJbnRlcm5hbCBzZXJ2ZXIgZXJyb3JcIixcbiAgICB9KTtcbiAgfVxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Jvb3QvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Jvb3QvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy93YWxsZXQtYmFsYW5jZS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL3dhbGxldC1iYWxhbmNlLnRzXCI7aW1wb3J0IHsgUmVxdWVzdEhhbmRsZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG4vLyBIZWxpdXMsIE1vcmFsaXMsIGFuZCBBbGNoZW15IGFyZSBSUEMgcHJvdmlkZXJzIGZvciBTb2xhbmEgYmxvY2tjaGFpbiBjYWxsc1xuLy8gVGhleSBmZXRjaCB3YWxsZXQgYmFsYW5jZSBhbmQgdG9rZW4gYWNjb3VudCBkYXRhIC0gTk9UIGZvciB0b2tlbiBwcmljZSBmZXRjaGluZ1xuLy8gVG9rZW4gcHJpY2VzIHNob3VsZCBjb21lIGZyb20gZGVkaWNhdGVkIHByaWNlIEFQSXMgbGlrZSBKdXBpdGVyLCBEZXhTY3JlZW5lciwgb3IgRGV4VG9vbHNcbmNvbnN0IFJQQ19FTkRQT0lOVFMgPSBbXG4gIC8vIFByZWZlciBlbnZpcm9ubWVudC1jb25maWd1cmVkIFJQQyBmaXJzdFxuICBwcm9jZXNzLmVudi5TT0xBTkFfUlBDX1VSTCB8fCBcIlwiLFxuICAvLyBQcm92aWRlci1zcGVjaWZpYyBvdmVycmlkZXNcbiAgcHJvY2Vzcy5lbnYuQUxDSEVNWV9SUENfVVJMIHx8IFwiXCIsXG4gIHByb2Nlc3MuZW52LkhFTElVU19SUENfVVJMIHx8IFwiXCIsXG4gIHByb2Nlc3MuZW52Lk1PUkFMSVNfUlBDX1VSTCB8fCBcIlwiLFxuICBwcm9jZXNzLmVudi5IRUxJVVNfQVBJX0tFWVxuICAgID8gYGh0dHBzOi8vbWFpbm5ldC5oZWxpdXMtcnBjLmNvbS8/YXBpLWtleT0ke3Byb2Nlc3MuZW52LkhFTElVU19BUElfS0VZfWBcbiAgICA6IFwiXCIsXG4gIC8vIEZhbGxiYWNrIHB1YmxpYyBlbmRwb2ludHMgKHByZWZlciBwdWJsaWNub2RlIGFuZCBhbmtyIGZpcnN0KVxuICBcImh0dHBzOi8vc29sYW5hLnB1YmxpY25vZGUuY29tXCIsXG4gIFwiaHR0cHM6Ly9ycGMuYW5rci5jb20vc29sYW5hXCIsXG4gIFwiaHR0cHM6Ly9hcGkubWFpbm5ldC1iZXRhLnNvbGFuYS5jb21cIixcbl0uZmlsdGVyKEJvb2xlYW4pO1xuXG5leHBvcnQgY29uc3QgaGFuZGxlV2FsbGV0QmFsYW5jZTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHB1YmxpY0tleSB9ID0gcmVxLnF1ZXJ5O1xuXG4gICAgaWYgKCFwdWJsaWNLZXkgfHwgdHlwZW9mIHB1YmxpY0tleSAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IFwiTWlzc2luZyBvciBpbnZhbGlkICdwdWJsaWNLZXknIHBhcmFtZXRlclwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgYm9keSA9IHtcbiAgICAgIGpzb25ycGM6IFwiMi4wXCIsXG4gICAgICBpZDogMSxcbiAgICAgIG1ldGhvZDogXCJnZXRCYWxhbmNlXCIsXG4gICAgICBwYXJhbXM6IFtwdWJsaWNLZXldLFxuICAgIH07XG5cbiAgICBsZXQgbGFzdEVycm9yOiBFcnJvciB8IG51bGwgPSBudWxsO1xuXG4gICAgZm9yIChjb25zdCBlbmRwb2ludCBvZiBSUENfRU5EUE9JTlRTKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGVuZHBvaW50LCB7XG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG5cbiAgICAgICAgaWYgKGRhdGEuZXJyb3IpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFJQQyAke2VuZHBvaW50fSByZXR1cm5lZCBlcnJvcjpgLCBkYXRhLmVycm9yKTtcbiAgICAgICAgICBsYXN0RXJyb3IgPSBuZXcgRXJyb3IoZGF0YS5lcnJvci5tZXNzYWdlIHx8IFwiUlBDIGVycm9yXCIpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYmFsYW5jZUxhbXBvcnRzID0gZGF0YS5yZXN1bHQ7XG4gICAgICAgIGNvbnN0IGJhbGFuY2VTT0wgPSBiYWxhbmNlTGFtcG9ydHMgLyAxXzAwMF8wMDBfMDAwO1xuXG4gICAgICAgIHJldHVybiByZXMuanNvbih7XG4gICAgICAgICAgcHVibGljS2V5LFxuICAgICAgICAgIGJhbGFuY2U6IGJhbGFuY2VTT0wsXG4gICAgICAgICAgYmFsYW5jZUxhbXBvcnRzLFxuICAgICAgICB9KTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxhc3RFcnJvciA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvciA6IG5ldyBFcnJvcihTdHJpbmcoZXJyb3IpKTtcbiAgICAgICAgY29uc29sZS53YXJuKGBSUEMgZW5kcG9pbnQgJHtlbmRwb2ludH0gZmFpbGVkOmAsIGxhc3RFcnJvci5tZXNzYWdlKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc29sZS5lcnJvcihcIkFsbCBSUEMgZW5kcG9pbnRzIGZhaWxlZCBmb3Igd2FsbGV0IGJhbGFuY2VcIik7XG4gICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOlxuICAgICAgICBsYXN0RXJyb3I/Lm1lc3NhZ2UgfHxcbiAgICAgICAgXCJGYWlsZWQgdG8gZmV0Y2ggYmFsYW5jZSAtIGFsbCBSUEMgZW5kcG9pbnRzIGZhaWxlZFwiLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJXYWxsZXQgYmFsYW5jZSBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgc2VydmVyIGVycm9yXCIsXG4gICAgfSk7XG4gIH1cbn07XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvZXhjaGFuZ2UtcmF0ZS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2V4Y2hhbmdlLXJhdGUudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbi8vIFRva2VuIG1pbnQgYWRkcmVzc2VzIGZvciBTb2xhbmEgbWFpbm5ldCAoaW1wb3J0ZWQgZnJvbSBzaGFyZWQgY29uc3RhbnRzKVxuY29uc3QgVE9LRU5fTUlOVFMgPSB7XG4gIFNPTDogXCJTbzExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTEyXCIsXG4gIFVTREM6IFwiRVBqRldkZDVBdWZxU1NxZU0ycU4xeHp5YmFwQzhHNHdFR0drWnd5VER0MXZcIixcbiAgVVNEVDogXCJFczl2TUZyemFDRVJtSmZyRjRIMkZZRDRLQ29Oa1kxMU1jQ2U4QmVuRW5zXCIsXG4gIEZJWEVSQ09JTjogXCJINHFLbjhGTUZoYThqSnVqOHhNcnlNcVJoSDNoN0dqTHV4dzdUVml4cHVtcFwiLFxuICBMT0NLRVI6IFwiRU4xbllyVzYzNzV6TVBVa3BrR3lHU0VYVzhXbUFxWXU0eWhmNnhuR3B1bXBcIixcbn0gYXMgY29uc3Q7XG5cbmNvbnN0IEZBTExCQUNLX1JBVEVTOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge1xuICBGSVhFUkNPSU46IDAuMDA1LCAvLyAkMC4wMDUgcGVyIEZJWEVSQ09JTlxuICBTT0w6IDE4MCwgLy8gJDE4MCBwZXIgU09MXG4gIFVTREM6IDEuMCwgLy8gJDEgVVNEQ1xuICBVU0RUOiAxLjAsIC8vICQxIFVTRFRcbiAgTE9DS0VSOiAwLjEsIC8vICQwLjEgcGVyIExPQ0tFUlxufTtcblxuY29uc3QgUEtSX1BFUl9VU0QgPSAyODA7IC8vIEFwcHJveGltYXRlIGNvbnZlcnNpb24gcmF0ZVxuY29uc3QgTUFSS1VQID0gMS4wNDI1OyAvLyA0LjI1JSBtYXJrdXBcblxuaW50ZXJmYWNlIERleHNjcmVlbmVyUmVzcG9uc2Uge1xuICBwYWlyczogQXJyYXk8e1xuICAgIGJhc2VUb2tlbjogeyBhZGRyZXNzOiBzdHJpbmcgfTtcbiAgICBwcmljZVVzZD86IHN0cmluZztcbiAgfT47XG59XG5cbmNvbnN0IE1JTlRfVE9fUEFJUl9BRERSRVNTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBINHFLbjhGTUZoYThqSnVqOHhNcnlNcVJoSDNoN0dqTHV4dzdUVml4cHVtcDpcbiAgICBcIjVDZ0xFV3E5VkpVRVE4bXk4VWF4RW92dVNXQXJHb1hDdmFmdHBiWDRSUU15XCIsXG4gIEVOMW5Zclc2Mzc1ek1QVWtwa0d5R1NFWFc4V21BcVl1NHloZjZ4bkdwdW1wOlxuICAgIFwiN1g3S2tWOTRZOWpGaGtYRU1oZ1ZjTUhNUnpBTGlHajV4S21NNlRUM2NVdktcIixcbn07XG5cbmNvbnN0IE1JTlRfVE9fU0VBUkNIX1NZTUJPTDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgSDRxS244Rk1GaGE4akp1ajh4TXJ5TXFSaEgzaDdHakx1eHc3VFZpeHB1bXA6IFwiRklYRVJDT0lOXCIsXG4gIEVOMW5Zclc2Mzc1ek1QVWtwa0d5R1NFWFc4V21BcVl1NHloZjZ4bkdwdW1wOiBcIkxPQ0tFUlwiLFxufTtcblxuYXN5bmMgZnVuY3Rpb24gZmV0Y2hUb2tlblByaWNlRnJvbURleFNjcmVlbmVyKFxuICBtaW50OiBzdHJpbmcsXG4pOiBQcm9taXNlPG51bWJlciB8IG51bGw+IHtcbiAgLy8gRmlyc3QsIHRyeSBwYWlyIGFkZHJlc3MgbG9va3VwIGlmIGF2YWlsYWJsZVxuICBjb25zdCBwYWlyQWRkcmVzcyA9IE1JTlRfVE9fUEFJUl9BRERSRVNTW21pbnRdO1xuICBpZiAocGFpckFkZHJlc3MpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcGFpclVybCA9IGBodHRwczovL2FwaS5kZXhzY3JlZW5lci5jb20vbGF0ZXN0L2RleC9wYWlycy9zb2xhbmEvJHtwYWlyQWRkcmVzc31gO1xuICAgICAgY29uc29sZS5sb2coXG4gICAgICAgIGBbRGV4U2NyZWVuZXJdIFRyeWluZyBwYWlyIGFkZHJlc3MgbG9va3VwIGZvciAke21pbnR9OiAke3BhaXJVcmx9YCxcbiAgICAgICk7XG5cbiAgICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgICBjb25zdCB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgODAwMCk7XG5cbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2gocGFpclVybCwge1xuICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoY29tcGF0aWJsZTsgU29sYW5hV2FsbGV0LzEuMClcIixcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG5cbiAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zdCBkYXRhID0gKGF3YWl0IHJlc3BvbnNlLmpzb24oKSkgYXMgRGV4c2NyZWVuZXJSZXNwb25zZTtcbiAgICAgICAgaWYgKGRhdGEucGFpcnMgJiYgZGF0YS5wYWlycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgY29uc3QgcHJpY2VVc2QgPSBkYXRhLnBhaXJzWzBdLnByaWNlVXNkO1xuICAgICAgICAgIGlmIChwcmljZVVzZCkge1xuICAgICAgICAgICAgY29uc3QgcHJpY2UgPSBwYXJzZUZsb2F0KHByaWNlVXNkKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgICBgW0RleFNjcmVlbmVyXSBcdTI3MDUgR290IHByaWNlIGZvciAke21pbnR9IHZpYSBwYWlyIGFkZHJlc3M6ICQke3ByaWNlfWAsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIHByaWNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgIGBbRGV4U2NyZWVuZXJdIFx1MjZBMFx1RkUwRiBQYWlyIGFkZHJlc3MgbG9va3VwIGZhaWxlZDpgLFxuICAgICAgICBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8vIEZhbGxiYWNrOiB0cnkgbWludC1iYXNlZCBsb29rdXBcbiAgdHJ5IHtcbiAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly9hcGkuZGV4c2NyZWVuZXIuY29tL2xhdGVzdC9kZXgvdG9rZW5zLyR7bWludH1gO1xuICAgIGNvbnNvbGUubG9nKGBbRGV4U2NyZWVuZXJdIEZldGNoaW5nIHByaWNlIGZvciAke21pbnR9IGZyb206ICR7dXJsfWApO1xuXG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBjb25zdCB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgODAwMCk7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKGNvbXBhdGlibGU7IFNvbGFuYVdhbGxldC8xLjApXCIsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICBgW0RleFNjcmVlbmVyXSBcdTI3NEMgQVBJIHJldHVybmVkICR7cmVzcG9uc2Uuc3RhdHVzfSBmb3IgbWludCAke21pbnR9YCxcbiAgICAgICk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBkYXRhID0gKGF3YWl0IHJlc3BvbnNlLmpzb24oKSkgYXMgRGV4c2NyZWVuZXJSZXNwb25zZTtcbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbRGV4U2NyZWVuZXJdIFJlc3BvbnNlIHJlY2VpdmVkIGZvciAke21pbnR9OmAsXG4gICAgICBKU09OLnN0cmluZ2lmeShkYXRhKS5zdWJzdHJpbmcoMCwgMjAwKSxcbiAgICApO1xuXG4gICAgaWYgKGRhdGEucGFpcnMgJiYgZGF0YS5wYWlycy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBwcmljZVVzZCA9IGRhdGEucGFpcnNbMF0ucHJpY2VVc2Q7XG4gICAgICBpZiAocHJpY2VVc2QpIHtcbiAgICAgICAgY29uc3QgcHJpY2UgPSBwYXJzZUZsb2F0KHByaWNlVXNkKTtcbiAgICAgICAgY29uc29sZS5sb2coYFtEZXhTY3JlZW5lcl0gXHUyNzA1IEdvdCBwcmljZSBmb3IgJHttaW50fTogJCR7cHJpY2V9YCk7XG4gICAgICAgIHJldHVybiBwcmljZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBGYWxsYmFjazogdHJ5IHNlYXJjaC1iYXNlZCBsb29rdXAgZm9yIHNwZWNpZmljIHRva2Vuc1xuICAgIGNvbnN0IHNlYXJjaFN5bWJvbCA9IE1JTlRfVE9fU0VBUkNIX1NZTUJPTFttaW50XTtcbiAgICBpZiAoc2VhcmNoU3ltYm9sKSB7XG4gICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgYFtEZXhTY3JlZW5lcl0gTm8gcGFpcnMgZm91bmQsIHRyeWluZyBzZWFyY2ggZmFsbGJhY2sgZm9yICR7c2VhcmNoU3ltYm9sfWAsXG4gICAgICApO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc2VhcmNoVXJsID0gYGh0dHBzOi8vYXBpLmRleHNjcmVlbmVyLmNvbS9sYXRlc3QvZGV4L3NlYXJjaC8/cT0ke2VuY29kZVVSSUNvbXBvbmVudChzZWFyY2hTeW1ib2wpfWA7XG4gICAgICAgIGNvbnN0IHNlYXJjaENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgICAgIGNvbnN0IHNlYXJjaFRpbWVvdXRJZCA9IHNldFRpbWVvdXQoXG4gICAgICAgICAgKCkgPT4gc2VhcmNoQ29udHJvbGxlci5hYm9ydCgpLFxuICAgICAgICAgIDgwMDAsXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3Qgc2VhcmNoUmVzcG9uc2UgPSBhd2FpdCBmZXRjaChzZWFyY2hVcmwsIHtcbiAgICAgICAgICBzaWduYWw6IHNlYXJjaENvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgICBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoY29tcGF0aWJsZTsgU29sYW5hV2FsbGV0LzEuMClcIixcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHNlYXJjaFRpbWVvdXRJZCk7XG5cbiAgICAgICAgaWYgKHNlYXJjaFJlc3BvbnNlLm9rKSB7XG4gICAgICAgICAgY29uc3Qgc2VhcmNoRGF0YSA9XG4gICAgICAgICAgICAoYXdhaXQgc2VhcmNoUmVzcG9uc2UuanNvbigpKSBhcyBEZXhzY3JlZW5lclJlc3BvbnNlO1xuICAgICAgICAgIGlmIChzZWFyY2hEYXRhLnBhaXJzICYmIHNlYXJjaERhdGEucGFpcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgLy8gTG9vayBmb3IgcGFpcnMgd2hlcmUgdGhpcyB0b2tlbiBpcyB0aGUgYmFzZSBvbiBTb2xhbmFcbiAgICAgICAgICAgIGxldCBtYXRjaGluZ1BhaXIgPSBzZWFyY2hEYXRhLnBhaXJzLmZpbmQoXG4gICAgICAgICAgICAgIChwKSA9PlxuICAgICAgICAgICAgICAgIHAuYmFzZVRva2VuPy5hZGRyZXNzID09PSBtaW50ICYmXG4gICAgICAgICAgICAgICAgKHAgYXMgYW55KS5jaGFpbklkID09PSBcInNvbGFuYVwiLFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgLy8gSWYgbm90IGZvdW5kIGFzIGJhc2Ugb24gU29sYW5hLCB0cnkgYXMgcXVvdGUgdG9rZW4gb24gU29sYW5hXG4gICAgICAgICAgICBpZiAoIW1hdGNoaW5nUGFpcikge1xuICAgICAgICAgICAgICBtYXRjaGluZ1BhaXIgPSBzZWFyY2hEYXRhLnBhaXJzLmZpbmQoXG4gICAgICAgICAgICAgICAgKHApID0+XG4gICAgICAgICAgICAgICAgICAocCBhcyBhbnkpLnF1b3RlVG9rZW4/LmFkZHJlc3MgPT09IG1pbnQgJiZcbiAgICAgICAgICAgICAgICAgIChwIGFzIGFueSkuY2hhaW5JZCA9PT0gXCJzb2xhbmFcIixcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSWYgc3RpbGwgbm90IGZvdW5kIG9uIFNvbGFuYSwgdHJ5IGFueSBjaGFpbiBhcyBiYXNlXG4gICAgICAgICAgICBpZiAoIW1hdGNoaW5nUGFpcikge1xuICAgICAgICAgICAgICBtYXRjaGluZ1BhaXIgPSBzZWFyY2hEYXRhLnBhaXJzLmZpbmQoXG4gICAgICAgICAgICAgICAgKHApID0+IHAuYmFzZVRva2VuPy5hZGRyZXNzID09PSBtaW50LFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiBzdGlsbCBub3QgZm91bmQsIHRyeSBhcyBxdW90ZSBvbiBhbnkgY2hhaW5cbiAgICAgICAgICAgIGlmICghbWF0Y2hpbmdQYWlyKSB7XG4gICAgICAgICAgICAgIG1hdGNoaW5nUGFpciA9IHNlYXJjaERhdGEucGFpcnMuZmluZChcbiAgICAgICAgICAgICAgICAocCkgPT4gKHAgYXMgYW55KS5xdW90ZVRva2VuPy5hZGRyZXNzID09PSBtaW50LFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBMYXN0IHJlc29ydDoganVzdCB0YWtlIHRoZSBmaXJzdCByZXN1bHRcbiAgICAgICAgICAgIGlmICghbWF0Y2hpbmdQYWlyKSB7XG4gICAgICAgICAgICAgIG1hdGNoaW5nUGFpciA9IHNlYXJjaERhdGEucGFpcnNbMF07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChtYXRjaGluZ1BhaXIgJiYgbWF0Y2hpbmdQYWlyLnByaWNlVXNkKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHByaWNlID0gcGFyc2VGbG9hdChtYXRjaGluZ1BhaXIucHJpY2VVc2QpO1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICAgICBgW0RleFNjcmVlbmVyXSBcdTI3MDUgR290IHByaWNlIGZvciAke21pbnR9IHZpYSBzZWFyY2g6ICQke3ByaWNlfWAsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIHJldHVybiBwcmljZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKHNlYXJjaEVycikge1xuICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgYFtEZXhTY3JlZW5lcl0gU2VhcmNoIGZhbGxiYWNrIGZhaWxlZDpgLFxuICAgICAgICAgIHNlYXJjaEVyciBpbnN0YW5jZW9mIEVycm9yID8gc2VhcmNoRXJyLm1lc3NhZ2UgOiBTdHJpbmcoc2VhcmNoRXJyKSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zb2xlLndhcm4oYFtEZXhTY3JlZW5lcl0gTm8gcGFpcnMgZm91bmQgaW4gcmVzcG9uc2UgZm9yICR7bWludH1gKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgYFtEZXhTY3JlZW5lcl0gXHUyNzRDIEZhaWxlZCB0byBmZXRjaCAke21pbnR9OmAsXG4gICAgICBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgaGFuZGxlRXhjaGFuZ2VSYXRlOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHRva2VuID0gKHJlcS5xdWVyeS50b2tlbiBhcyBzdHJpbmcpIHx8IFwiRklYRVJDT0lOXCI7XG5cbiAgICBsZXQgcHJpY2VVc2Q6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gICAgLy8gRmV0Y2ggcHJpY2UgZnJvbSBEZXhTY3JlZW5lciBiYXNlZCBvbiB0b2tlblxuICAgIGlmICh0b2tlbiA9PT0gXCJGSVhFUkNPSU5cIikge1xuICAgICAgcHJpY2VVc2QgPSBhd2FpdCBmZXRjaFRva2VuUHJpY2VGcm9tRGV4U2NyZWVuZXIoVE9LRU5fTUlOVFMuRklYRVJDT0lOKTtcbiAgICB9IGVsc2UgaWYgKHRva2VuID09PSBcIlNPTFwiKSB7XG4gICAgICBwcmljZVVzZCA9IGF3YWl0IGZldGNoVG9rZW5QcmljZUZyb21EZXhTY3JlZW5lcihUT0tFTl9NSU5UUy5TT0wpO1xuICAgIH0gZWxzZSBpZiAodG9rZW4gPT09IFwiVVNEQ1wiIHx8IHRva2VuID09PSBcIlVTRFRcIikge1xuICAgICAgLy8gU3RhYmxlY29pbnMgYXJlIGFsd2F5cyB+MSBVU0RcbiAgICAgIHByaWNlVXNkID0gMS4wO1xuICAgIH0gZWxzZSBpZiAodG9rZW4gPT09IFwiTE9DS0VSXCIpIHtcbiAgICAgIHByaWNlVXNkID0gYXdhaXQgZmV0Y2hUb2tlblByaWNlRnJvbURleFNjcmVlbmVyKFRPS0VOX01JTlRTLkxPQ0tFUik7XG4gICAgfVxuXG4gICAgLy8gRmFsbCBiYWNrIHRvIGhhcmRjb2RlZCByYXRlcyBpZiBEZXhTY3JlZW5lciBmZXRjaCBmYWlscyBvciBwcmljZSBpcyBpbnZhbGlkXG4gICAgaWYgKHByaWNlVXNkID09PSBudWxsIHx8IHByaWNlVXNkIDw9IDApIHtcbiAgICAgIHByaWNlVXNkID0gRkFMTEJBQ0tfUkFURVNbdG9rZW5dIHx8IEZBTExCQUNLX1JBVEVTLkZJWEVSQ09JTjtcbiAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICBgW0V4Y2hhbmdlUmF0ZV0gVXNpbmcgZmFsbGJhY2sgcmF0ZSBmb3IgJHt0b2tlbn06ICQke3ByaWNlVXNkfWAsXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgYFtFeGNoYW5nZVJhdGVdIEZldGNoZWQgJHt0b2tlbn0gcHJpY2UgZnJvbSBEZXhTY3JlZW5lcjogJCR7cHJpY2VVc2R9YCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gQ29udmVydCB0byBQS1Igd2l0aCBtYXJrdXBcbiAgICBjb25zdCByYXRlSW5QS1IgPSBwcmljZVVzZCAqIFBLUl9QRVJfVVNEICogTUFSS1VQO1xuXG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0V4Y2hhbmdlUmF0ZV0gJHt0b2tlbn06ICQke3ByaWNlVXNkLnRvRml4ZWQoNil9IFVTRCAtPiAke3JhdGVJblBLUi50b0ZpeGVkKDIpfSBQS1IgKHdpdGggJHsoTUFSS1VQIC0gMSkgKiAxMDB9JSBtYXJrdXApYCxcbiAgICApO1xuXG4gICAgcmVzLmpzb24oe1xuICAgICAgdG9rZW4sXG4gICAgICBwcmljZVVzZCxcbiAgICAgIHByaWNlSW5QS1I6IHJhdGVJblBLUixcbiAgICAgIHJhdGU6IHJhdGVJblBLUixcbiAgICAgIHBra1BlclVzZDogUEtSX1BFUl9VU0QsXG4gICAgICBtYXJrdXA6IE1BUktVUCxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiW0V4Y2hhbmdlUmF0ZV0gRXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBlcnJvcjogXCJGYWlsZWQgdG8gZmV0Y2ggZXhjaGFuZ2UgcmF0ZVwiLFxuICAgICAgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgIH0pO1xuICB9XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2RleHNjcmVlbmVyLXByb3h5LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvZGV4c2NyZWVuZXItcHJveHkudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbmludGVyZmFjZSBEZXhzY3JlZW5lclRva2VuIHtcbiAgY2hhaW5JZDogc3RyaW5nO1xuICBkZXhJZDogc3RyaW5nO1xuICB1cmw6IHN0cmluZztcbiAgcGFpckFkZHJlc3M6IHN0cmluZztcbiAgYmFzZVRva2VuOiB7XG4gICAgYWRkcmVzczogc3RyaW5nO1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBzeW1ib2w6IHN0cmluZztcbiAgfTtcbiAgcXVvdGVUb2tlbjoge1xuICAgIGFkZHJlc3M6IHN0cmluZztcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgc3ltYm9sOiBzdHJpbmc7XG4gIH07XG4gIHByaWNlTmF0aXZlOiBzdHJpbmc7XG4gIHByaWNlVXNkPzogc3RyaW5nO1xuICB0eG5zOiB7XG4gICAgbTU6IHsgYnV5czogbnVtYmVyOyBzZWxsczogbnVtYmVyIH07XG4gICAgaDE6IHsgYnV5czogbnVtYmVyOyBzZWxsczogbnVtYmVyIH07XG4gICAgaDY6IHsgYnV5czogbnVtYmVyOyBzZWxsczogbnVtYmVyIH07XG4gICAgaDI0OiB7IGJ1eXM6IG51bWJlcjsgc2VsbHM6IG51bWJlciB9O1xuICB9O1xuICB2b2x1bWU6IHtcbiAgICBoMjQ6IG51bWJlcjtcbiAgICBoNjogbnVtYmVyO1xuICAgIGgxOiBudW1iZXI7XG4gICAgbTU6IG51bWJlcjtcbiAgfTtcbiAgcHJpY2VDaGFuZ2U6IHtcbiAgICBtNTogbnVtYmVyO1xuICAgIGgxOiBudW1iZXI7XG4gICAgaDY6IG51bWJlcjtcbiAgICBoMjQ6IG51bWJlcjtcbiAgfTtcbiAgbGlxdWlkaXR5Pzoge1xuICAgIHVzZD86IG51bWJlcjtcbiAgICBiYXNlPzogbnVtYmVyO1xuICAgIHF1b3RlPzogbnVtYmVyO1xuICB9O1xuICBmZHY/OiBudW1iZXI7XG4gIG1hcmtldENhcD86IG51bWJlcjtcbiAgaW5mbz86IHtcbiAgICBpbWFnZVVybD86IHN0cmluZztcbiAgICB3ZWJzaXRlcz86IEFycmF5PHsgbGFiZWw6IHN0cmluZzsgdXJsOiBzdHJpbmcgfT47XG4gICAgc29jaWFscz86IEFycmF5PHsgdHlwZTogc3RyaW5nOyB1cmw6IHN0cmluZyB9PjtcbiAgfTtcbn1cblxuaW50ZXJmYWNlIERleHNjcmVlbmVyUmVzcG9uc2Uge1xuICBzY2hlbWFWZXJzaW9uOiBzdHJpbmc7XG4gIHBhaXJzOiBEZXhzY3JlZW5lclRva2VuW107XG59XG5cbi8vIERleFNjcmVlbmVyIGVuZHBvaW50cyBmb3IgZmFpbG92ZXJcbmNvbnN0IERFWFNDUkVFTkVSX0VORFBPSU5UUyA9IFtcbiAgXCJodHRwczovL2FwaS5kZXhzY3JlZW5lci5jb20vbGF0ZXN0L2RleFwiLFxuICBcImh0dHBzOi8vYXBpLmRleHNjcmVlbmVyLmlvL2xhdGVzdC9kZXhcIiwgLy8gQWx0ZXJuYXRpdmUgZG9tYWluXG5dO1xuXG5jb25zdCBDQUNIRV9UVExfTVMgPSAzMF8wMDA7IC8vIDMwIHNlY29uZHNcbmNvbnN0IE1BWF9UT0tFTlNfUEVSX0JBVENIID0gMjA7XG5cbmxldCBjdXJyZW50RW5kcG9pbnRJbmRleCA9IDA7XG5jb25zdCBjYWNoZSA9IG5ldyBNYXA8XG4gIHN0cmluZyxcbiAgeyBkYXRhOiBEZXhzY3JlZW5lclJlc3BvbnNlOyBleHBpcmVzQXQ6IG51bWJlciB9XG4+KCk7XG5jb25zdCBpbmZsaWdodFJlcXVlc3RzID0gbmV3IE1hcDxzdHJpbmcsIFByb21pc2U8RGV4c2NyZWVuZXJSZXNwb25zZT4+KCk7XG5cbmNvbnN0IHRyeURleHNjcmVlbmVyRW5kcG9pbnRzID0gYXN5bmMgKFxuICBwYXRoOiBzdHJpbmcsXG4pOiBQcm9taXNlPERleHNjcmVlbmVyUmVzcG9uc2U+ID0+IHtcbiAgbGV0IGxhc3RFcnJvcjogRXJyb3IgfCBudWxsID0gbnVsbDtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IERFWFNDUkVFTkVSX0VORFBPSU5UUy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGVuZHBvaW50SW5kZXggPVxuICAgICAgKGN1cnJlbnRFbmRwb2ludEluZGV4ICsgaSkgJSBERVhTQ1JFRU5FUl9FTkRQT0lOVFMubGVuZ3RoO1xuICAgIGNvbnN0IGVuZHBvaW50ID0gREVYU0NSRUVORVJfRU5EUE9JTlRTW2VuZHBvaW50SW5kZXhdO1xuICAgIGNvbnN0IHVybCA9IGAke2VuZHBvaW50fSR7cGF0aH1gO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnNvbGUubG9nKGBUcnlpbmcgRGV4U2NyZWVuZXIgQVBJOiAke3VybH1gKTtcblxuICAgICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCAxMjAwMCk7IC8vIDEycyB0aW1lb3V0XG5cbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgIEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKGNvbXBhdGlibGU7IFNvbGFuYVdhbGxldC8xLjApXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICB9KTtcblxuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG5cbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDI5KSB7XG4gICAgICAgICAgLy8gUmF0ZSBsaW1pdGVkIC0gdHJ5IG5leHQgZW5kcG9pbnRcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFJhdGUgbGltaXRlZCBvbiAke2VuZHBvaW50fSwgdHJ5aW5nIG5leHQuLi5gKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9OiAke3Jlc3BvbnNlLnN0YXR1c1RleHR9YCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGRhdGEgPSAoYXdhaXQgcmVzcG9uc2UuanNvbigpKSBhcyBEZXhzY3JlZW5lclJlc3BvbnNlO1xuXG4gICAgICAvLyBTdWNjZXNzIC0gdXBkYXRlIGN1cnJlbnQgZW5kcG9pbnRcbiAgICAgIGN1cnJlbnRFbmRwb2ludEluZGV4ID0gZW5kcG9pbnRJbmRleDtcbiAgICAgIGNvbnNvbGUubG9nKGBEZXhTY3JlZW5lciBBUEkgY2FsbCBzdWNjZXNzZnVsIHZpYSAke2VuZHBvaW50fWApO1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnN0IGVycm9yTXNnID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgICAgY29uc29sZS53YXJuKGBEZXhTY3JlZW5lciBlbmRwb2ludCAke2VuZHBvaW50fSBmYWlsZWQ6YCwgZXJyb3JNc2cpO1xuICAgICAgbGFzdEVycm9yID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yIDogbmV3IEVycm9yKFN0cmluZyhlcnJvcikpO1xuXG4gICAgICAvLyBTbWFsbCBkZWxheSBiZWZvcmUgdHJ5aW5nIG5leHQgZW5kcG9pbnRcbiAgICAgIGlmIChpIDwgREVYU0NSRUVORVJfRU5EUE9JTlRTLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMTAwMCkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHRocm93IG5ldyBFcnJvcihcbiAgICBgQWxsIERleFNjcmVlbmVyIGVuZHBvaW50cyBmYWlsZWQuIExhc3QgZXJyb3I6ICR7bGFzdEVycm9yPy5tZXNzYWdlIHx8IFwiVW5rbm93biBlcnJvclwifWAsXG4gICk7XG59O1xuXG5jb25zdCBmZXRjaERleHNjcmVlbmVyRGF0YSA9IGFzeW5jIChcbiAgcGF0aDogc3RyaW5nLFxuKTogUHJvbWlzZTxEZXhzY3JlZW5lclJlc3BvbnNlPiA9PiB7XG4gIGNvbnN0IGNhY2hlZCA9IGNhY2hlLmdldChwYXRoKTtcbiAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblxuICBpZiAoY2FjaGVkICYmIGNhY2hlZC5leHBpcmVzQXQgPiBub3cpIHtcbiAgICByZXR1cm4gY2FjaGVkLmRhdGE7XG4gIH1cblxuICBjb25zdCBleGlzdGluZyA9IGluZmxpZ2h0UmVxdWVzdHMuZ2V0KHBhdGgpO1xuICBpZiAoZXhpc3RpbmcpIHtcbiAgICByZXR1cm4gZXhpc3Rpbmc7XG4gIH1cblxuICBjb25zdCByZXF1ZXN0ID0gKGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHRyeURleHNjcmVlbmVyRW5kcG9pbnRzKHBhdGgpO1xuICAgICAgY2FjaGUuc2V0KHBhdGgsIHsgZGF0YSwgZXhwaXJlc0F0OiBEYXRlLm5vdygpICsgQ0FDSEVfVFRMX01TIH0pO1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGluZmxpZ2h0UmVxdWVzdHMuZGVsZXRlKHBhdGgpO1xuICAgIH1cbiAgfSkoKTtcblxuICBpbmZsaWdodFJlcXVlc3RzLnNldChwYXRoLCByZXF1ZXN0KTtcbiAgcmV0dXJuIHJlcXVlc3Q7XG59O1xuXG5jb25zdCBtZXJnZVBhaXJzQnlUb2tlbiA9IChwYWlyczogRGV4c2NyZWVuZXJUb2tlbltdKTogRGV4c2NyZWVuZXJUb2tlbltdID0+IHtcbiAgY29uc3QgYnlNaW50ID0gbmV3IE1hcDxzdHJpbmcsIERleHNjcmVlbmVyVG9rZW4+KCk7XG5cbiAgcGFpcnMuZm9yRWFjaCgocGFpcikgPT4ge1xuICAgIGNvbnN0IG1pbnQgPSBwYWlyLmJhc2VUb2tlbj8uYWRkcmVzcyB8fCBwYWlyLnBhaXJBZGRyZXNzO1xuICAgIGlmICghbWludCkgcmV0dXJuO1xuXG4gICAgY29uc3QgZXhpc3RpbmcgPSBieU1pbnQuZ2V0KG1pbnQpO1xuICAgIGNvbnN0IGV4aXN0aW5nTGlxdWlkaXR5ID0gZXhpc3Rpbmc/LmxpcXVpZGl0eT8udXNkID8/IDA7XG4gICAgY29uc3QgY2FuZGlkYXRlTGlxdWlkaXR5ID0gcGFpci5saXF1aWRpdHk/LnVzZCA/PyAwO1xuXG4gICAgaWYgKCFleGlzdGluZyB8fCBjYW5kaWRhdGVMaXF1aWRpdHkgPiBleGlzdGluZ0xpcXVpZGl0eSkge1xuICAgICAgYnlNaW50LnNldChtaW50LCBwYWlyKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBBcnJheS5mcm9tKGJ5TWludC52YWx1ZXMoKSk7XG59O1xuXG4vLyBNaW50IHRvIHBhaXIgYWRkcmVzcyBtYXBwaW5nIGZvciBwdW1wLmZ1biB0b2tlbnNcbmNvbnN0IE1JTlRfVE9fUEFJUl9BRERSRVNTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBINHFLbjhGTUZoYThqSnVqOHhNcnlNcVJoSDNoN0dqTHV4dzdUVml4cHVtcDpcbiAgICBcIjVDZ0xFV3E5VkpVRVE4bXk4VWF4RW92dVNXQXJHb1hDdmFmdHBiWDRSUU15XCIsIC8vIEZJWEVSQ09JTlxuICBFTjFuWXJXNjM3NXpNUFVrcGtHeUdTRVhXOFdtQXFZdTR5aGY2eG5HcHVtcDpcbiAgICBcIjdYN0trVjk0WTlqRmhrWEVNaGdWY01ITVJ6QUxpR2o1eEttTTZUVDNjVXZLXCIsIC8vIExPQ0tFUiAoaWYgYXZhaWxhYmxlKVxufTtcblxuLy8gTWludCB0byBzZWFyY2ggc3ltYm9sIG1hcHBpbmcgZm9yIHRva2VucyBub3QgZm91bmQgdmlhIG1pbnQgbG9va3VwXG5jb25zdCBNSU5UX1RPX1NFQVJDSF9TWU1CT0w6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIEg0cUtuOEZNRmhhOGpKdWo4eE1yeU1xUmhIM2g3R2pMdXh3N1RWaXhwdW1wOiBcIkZJWEVSQ09JTlwiLFxuICBFTjFuWXJXNjM3NXpNUFVrcGtHeUdTRVhXOFdtQXFZdTR5aGY2eG5HcHVtcDogXCJMT0NLRVJcIixcbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVEZXhzY3JlZW5lclRva2VuczogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IG1pbnRzIH0gPSByZXEucXVlcnk7XG5cbiAgICBpZiAoIW1pbnRzIHx8IHR5cGVvZiBtaW50cyAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgY29uc29sZS53YXJuKGBbRGV4U2NyZWVuZXJdIEludmFsaWQgbWludHMgcGFyYW1ldGVyOmAsIG1pbnRzKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7XG4gICAgICAgIGVycm9yOlxuICAgICAgICAgIFwiTWlzc2luZyBvciBpbnZhbGlkICdtaW50cycgcGFyYW1ldGVyLiBFeHBlY3RlZCBjb21tYS1zZXBhcmF0ZWQgdG9rZW4gbWludHMuXCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZyhgW0RleFNjcmVlbmVyXSBUb2tlbnMgcmVxdWVzdCBmb3IgbWludHM6ICR7bWludHN9YCk7XG5cbiAgICBjb25zdCByYXdNaW50cyA9IG1pbnRzXG4gICAgICAuc3BsaXQoXCIsXCIpXG4gICAgICAubWFwKChtaW50KSA9PiBtaW50LnRyaW0oKSlcbiAgICAgIC5maWx0ZXIoQm9vbGVhbik7XG5cbiAgICBjb25zdCB1bmlxdWVNaW50cyA9IEFycmF5LmZyb20obmV3IFNldChyYXdNaW50cykpO1xuXG4gICAgaWYgKHVuaXF1ZU1pbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IFwiTm8gdmFsaWQgdG9rZW4gbWludHMgcHJvdmlkZWQuXCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBiYXRjaGVzOiBzdHJpbmdbXVtdID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB1bmlxdWVNaW50cy5sZW5ndGg7IGkgKz0gTUFYX1RPS0VOU19QRVJfQkFUQ0gpIHtcbiAgICAgIGJhdGNoZXMucHVzaCh1bmlxdWVNaW50cy5zbGljZShpLCBpICsgTUFYX1RPS0VOU19QRVJfQkFUQ0gpKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHRzOiBEZXhzY3JlZW5lclRva2VuW10gPSBbXTtcbiAgICBjb25zdCByZXF1ZXN0ZWRNaW50c1NldCA9IG5ldyBTZXQodW5pcXVlTWludHMpO1xuICAgIGNvbnN0IGZvdW5kTWludHNTZXQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBsZXQgc2NoZW1hVmVyc2lvbiA9IFwiMS4wLjBcIjtcblxuICAgIGZvciAoY29uc3QgYmF0Y2ggb2YgYmF0Y2hlcykge1xuICAgICAgY29uc3QgcGF0aCA9IGAvdG9rZW5zLyR7YmF0Y2guam9pbihcIixcIil9YDtcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBmZXRjaERleHNjcmVlbmVyRGF0YShwYXRoKTtcbiAgICAgIGlmIChkYXRhPy5zY2hlbWFWZXJzaW9uKSB7XG4gICAgICAgIHNjaGVtYVZlcnNpb24gPSBkYXRhLnNjaGVtYVZlcnNpb247XG4gICAgICB9XG5cbiAgICAgIGlmICghZGF0YSB8fCAhQXJyYXkuaXNBcnJheShkYXRhLnBhaXJzKSkge1xuICAgICAgICBjb25zb2xlLndhcm4oXCJJbnZhbGlkIHJlc3BvbnNlIGZvcm1hdCBmcm9tIERleFNjcmVlbmVyIEFQSSBiYXRjaFwiKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHJlc3VsdHMucHVzaCguLi5kYXRhLnBhaXJzKTtcblxuICAgICAgLy8gVHJhY2sgd2hpY2ggbWludHMgd2UgZm91bmQgKGJvdGggYmFzZSBhbmQgcXVvdGUgdG9rZW5zKVxuICAgICAgZGF0YS5wYWlycy5mb3JFYWNoKChwYWlyKSA9PiB7XG4gICAgICAgIGlmIChwYWlyLmJhc2VUb2tlbj8uYWRkcmVzcykge1xuICAgICAgICAgIGZvdW5kTWludHNTZXQuYWRkKHBhaXIuYmFzZVRva2VuLmFkZHJlc3MpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwYWlyLnF1b3RlVG9rZW4/LmFkZHJlc3MpIHtcbiAgICAgICAgICBmb3VuZE1pbnRzU2V0LmFkZChwYWlyLnF1b3RlVG9rZW4uYWRkcmVzcyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEZpbmQgbWludHMgdGhhdCB3ZXJlbid0IGZvdW5kIGluIHRoZSBpbml0aWFsIGJhdGNoIHJlcXVlc3RcbiAgICBjb25zdCBtaXNzaW5nTWludHMgPSBBcnJheS5mcm9tKHJlcXVlc3RlZE1pbnRzU2V0KS5maWx0ZXIoXG4gICAgICAobSkgPT4gIWZvdW5kTWludHNTZXQuaGFzKG0pLFxuICAgICk7XG5cbiAgICAvLyBGb3IgbWlzc2luZyBtaW50cywgdHJ5IHBhaXIgYWRkcmVzcyBsb29rdXAgZmlyc3QsIHRoZW4gc2VhcmNoIGZhbGxiYWNrXG4gICAgaWYgKG1pc3NpbmdNaW50cy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgYFtEZXhTY3JlZW5lcl0gJHttaXNzaW5nTWludHMubGVuZ3RofSBtaW50cyBub3QgZm91bmQgdmlhIGJhdGNoLCB0cnlpbmcgcGFpci9zZWFyY2ggZmFsbGJhY2tgLFxuICAgICAgKTtcblxuICAgICAgZm9yIChjb25zdCBtaW50IG9mIG1pc3NpbmdNaW50cykge1xuICAgICAgICBsZXQgZm91bmQgPSBmYWxzZTtcblxuICAgICAgICAvLyBGaXJzdCwgdHJ5IHBhaXIgYWRkcmVzcyBsb29rdXAgaWYgYXZhaWxhYmxlXG4gICAgICAgIGNvbnN0IHBhaXJBZGRyZXNzID0gTUlOVF9UT19QQUlSX0FERFJFU1NbbWludF07XG4gICAgICAgIGlmIChwYWlyQWRkcmVzcykge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICAgYFtEZXhTY3JlZW5lcl0gVHJ5aW5nIHBhaXIgYWRkcmVzcyBsb29rdXAgZm9yICR7bWludH06ICR7cGFpckFkZHJlc3N9YCxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBjb25zdCBwYWlyRGF0YSA9IGF3YWl0IGZldGNoRGV4c2NyZWVuZXJEYXRhKFxuICAgICAgICAgICAgICBgL3BhaXJzL3NvbGFuYS8ke3BhaXJBZGRyZXNzfWAsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICAgYFtEZXhTY3JlZW5lcl0gUGFpciBsb29rdXAgcmVzcG9uc2U6ICR7cGFpckRhdGEgPyBcInJlY2VpdmVkXCIgOiBcIm51bGxcIn0sIHBhaXJzOiAke3BhaXJEYXRhPy5wYWlycz8ubGVuZ3RoIHx8IDB9YCxcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgcGFpckRhdGE/LnBhaXJzICYmXG4gICAgICAgICAgICAgIEFycmF5LmlzQXJyYXkocGFpckRhdGEucGFpcnMpICYmXG4gICAgICAgICAgICAgIHBhaXJEYXRhLnBhaXJzLmxlbmd0aCA+IDBcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICBsZXQgcGFpciA9IHBhaXJEYXRhLnBhaXJzWzBdO1xuXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgICAgIGBbRGV4U2NyZWVuZXJdIFBhaXIgYWRkcmVzcyBsb29rdXAgcmF3IGRhdGE6IGJhc2VUb2tlbj0ke3BhaXIuYmFzZVRva2VuPy5hZGRyZXNzfSwgcXVvdGVUb2tlbj0ke3BhaXIucXVvdGVUb2tlbj8uYWRkcmVzc30sIHByaWNlVXNkPSR7cGFpci5wcmljZVVzZH1gLFxuICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgIC8vIElmIHRoZSByZXF1ZXN0ZWQgbWludCBpcyB0aGUgcXVvdGVUb2tlbiwgd2UgbmVlZCB0byBzd2FwIHRoZSB0b2tlbnNcbiAgICAgICAgICAgICAgLy8gYW5kIGludmVydCB0aGUgcHJpY2UgdG8gZ2V0IHRoZSBjb3JyZWN0IHJlcHJlc2VudGF0aW9uXG4gICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICBwYWlyLnF1b3RlVG9rZW4/LmFkZHJlc3MgPT09IG1pbnQgJiZcbiAgICAgICAgICAgICAgICBwYWlyLmJhc2VUb2tlbj8uYWRkcmVzcyAhPT0gbWludFxuICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBiYXNlUHJpY2UgPSBwYWlyLnByaWNlVXNkID8gcGFyc2VGbG9hdChwYWlyLnByaWNlVXNkKSA6IDA7XG4gICAgICAgICAgICAgICAgY29uc3QgaW52ZXJ0ZWRQcmljZSA9XG4gICAgICAgICAgICAgICAgICBiYXNlUHJpY2UgPiAwID8gKDEgLyBiYXNlUHJpY2UpLnRvRml4ZWQoMjApIDogXCIwXCI7XG5cbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICAgICAgIGBbRGV4U2NyZWVuZXJdIFN3YXBwaW5nIHRva2VuczogJHttaW50fSB3YXMgcXVvdGVUb2tlbiwgaW52ZXJ0aW5nIHByaWNlICR7cGFpci5wcmljZVVzZH0gLT4gJHtpbnZlcnRlZFByaWNlfWAsXG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIHBhaXIgPSB7XG4gICAgICAgICAgICAgICAgICAuLi5wYWlyLFxuICAgICAgICAgICAgICAgICAgYmFzZVRva2VuOiBwYWlyLnF1b3RlVG9rZW4sXG4gICAgICAgICAgICAgICAgICBxdW90ZVRva2VuOiBwYWlyLmJhc2VUb2tlbixcbiAgICAgICAgICAgICAgICAgIHByaWNlVXNkOiBpbnZlcnRlZFByaWNlLFxuICAgICAgICAgICAgICAgICAgcHJpY2VOYXRpdmU6IHBhaXIucHJpY2VOYXRpdmVcbiAgICAgICAgICAgICAgICAgICAgPyAoMSAvIHBhcnNlRmxvYXQocGFpci5wcmljZU5hdGl2ZSkpLnRvU3RyaW5nKClcbiAgICAgICAgICAgICAgICAgICAgOiBcIjBcIixcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgICAgICAgYFtEZXhTY3JlZW5lcl0gXHUyNzA1IEZvdW5kICR7bWludH0gdmlhIHBhaXIgYWRkcmVzcywgYmFzZVRva2VuPSR7cGFpci5iYXNlVG9rZW4/LnN5bWJvbCB8fCBcIlVOS05PV05cIn0sIHByaWNlVXNkOiAke3BhaXIucHJpY2VVc2QgfHwgXCJOL0FcIn1gLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICByZXN1bHRzLnB1c2gocGFpcik7XG4gICAgICAgICAgICAgIGZvdW5kTWludHNTZXQuYWRkKG1pbnQpO1xuICAgICAgICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICAgICAgYFtEZXhTY3JlZW5lcl0gUGFpciBsb29rdXAgcmV0dXJuZWQgbm8gcGFpcnMgZm9yICR7bWludH1gLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2ggKHBhaXJFcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICAgICAgYFtEZXhTY3JlZW5lcl0gXHUyNkEwXHVGRTBGIFBhaXIgYWRkcmVzcyBsb29rdXAgZmFpbGVkIGZvciAke21pbnR9OmAsXG4gICAgICAgICAgICAgIHBhaXJFcnIgaW5zdGFuY2VvZiBFcnJvciA/IHBhaXJFcnIubWVzc2FnZSA6IFN0cmluZyhwYWlyRXJyKSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgcGFpciBsb29rdXAgZmFpbGVkIG9yIHVuYXZhaWxhYmxlLCB0cnkgc2VhcmNoLWJhc2VkIGxvb2t1cFxuICAgICAgICBpZiAoIWZvdW5kKSB7XG4gICAgICAgICAgY29uc3Qgc2VhcmNoU3ltYm9sID0gTUlOVF9UT19TRUFSQ0hfU1lNQk9MW21pbnRdO1xuICAgICAgICAgIGlmIChzZWFyY2hTeW1ib2wpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgICAgIGBbRGV4U2NyZWVuZXJdIFNlYXJjaGluZyBmb3IgJHttaW50fSB1c2luZyBzeW1ib2w6ICR7c2VhcmNoU3ltYm9sfWAsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIGNvbnN0IHNlYXJjaERhdGEgPSBhd2FpdCBmZXRjaERleHNjcmVlbmVyRGF0YShcbiAgICAgICAgICAgICAgICBgL3NlYXJjaC8/cT0ke2VuY29kZVVSSUNvbXBvbmVudChzZWFyY2hTeW1ib2wpfWAsXG4gICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgaWYgKHNlYXJjaERhdGE/LnBhaXJzICYmIEFycmF5LmlzQXJyYXkoc2VhcmNoRGF0YS5wYWlycykpIHtcbiAgICAgICAgICAgICAgICAvLyBGaW5kIHRoZSBwYWlyIHRoYXQgbWF0Y2hlcyBvdXIgbWludFxuICAgICAgICAgICAgICAgIC8vIExvb2sgZm9yIHBhaXJzIHdoZXJlIHRoaXMgdG9rZW4gaXMgdGhlIGJhc2Ugb24gU29sYW5hXG4gICAgICAgICAgICAgICAgbGV0IG1hdGNoaW5nUGFpciA9IHNlYXJjaERhdGEucGFpcnMuZmluZChcbiAgICAgICAgICAgICAgICAgIChwKSA9PlxuICAgICAgICAgICAgICAgICAgICBwLmJhc2VUb2tlbj8uYWRkcmVzcyA9PT0gbWludCAmJiBwLmNoYWluSWQgPT09IFwic29sYW5hXCIsXG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIC8vIElmIG5vdCBmb3VuZCBhcyBiYXNlIG9uIFNvbGFuYSwgdHJ5IGFzIHF1b3RlIHRva2VuIG9uIFNvbGFuYVxuICAgICAgICAgICAgICAgIGlmICghbWF0Y2hpbmdQYWlyKSB7XG4gICAgICAgICAgICAgICAgICBtYXRjaGluZ1BhaXIgPSBzZWFyY2hEYXRhLnBhaXJzLmZpbmQoXG4gICAgICAgICAgICAgICAgICAgIChwKSA9PlxuICAgICAgICAgICAgICAgICAgICAgIHAucXVvdGVUb2tlbj8uYWRkcmVzcyA9PT0gbWludCAmJiBwLmNoYWluSWQgPT09IFwic29sYW5hXCIsXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIElmIHN0aWxsIG5vdCBmb3VuZCBvbiBTb2xhbmEsIHRyeSBhbnkgY2hhaW4gYXMgYmFzZVxuICAgICAgICAgICAgICAgIGlmICghbWF0Y2hpbmdQYWlyKSB7XG4gICAgICAgICAgICAgICAgICBtYXRjaGluZ1BhaXIgPSBzZWFyY2hEYXRhLnBhaXJzLmZpbmQoXG4gICAgICAgICAgICAgICAgICAgIChwKSA9PiBwLmJhc2VUb2tlbj8uYWRkcmVzcyA9PT0gbWludCxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gSWYgc3RpbGwgbm90IGZvdW5kLCB0cnkgYXMgcXVvdGUgb24gYW55IGNoYWluXG4gICAgICAgICAgICAgICAgaWYgKCFtYXRjaGluZ1BhaXIpIHtcbiAgICAgICAgICAgICAgICAgIG1hdGNoaW5nUGFpciA9IHNlYXJjaERhdGEucGFpcnMuZmluZChcbiAgICAgICAgICAgICAgICAgICAgKHApID0+IHAucXVvdGVUb2tlbj8uYWRkcmVzcyA9PT0gbWludCxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gTGFzdCByZXNvcnQ6IGp1c3QgdGFrZSB0aGUgZmlyc3QgcmVzdWx0XG4gICAgICAgICAgICAgICAgaWYgKCFtYXRjaGluZ1BhaXIgJiYgc2VhcmNoRGF0YS5wYWlycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICBtYXRjaGluZ1BhaXIgPSBzZWFyY2hEYXRhLnBhaXJzWzBdO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChtYXRjaGluZ1BhaXIpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgICAgICAgICBgW0RleFNjcmVlbmVyXSBcdTI3MDUgRm91bmQgJHtzZWFyY2hTeW1ib2x9ICgke21pbnR9KSB2aWEgc2VhcmNoLCBjaGFpbklkOiAke21hdGNoaW5nUGFpci5jaGFpbklkfSwgcHJpY2VVc2Q6ICR7bWF0Y2hpbmdQYWlyLnByaWNlVXNkIHx8IFwiTi9BXCJ9YCxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2gobWF0Y2hpbmdQYWlyKTtcbiAgICAgICAgICAgICAgICAgIGZvdW5kTWludHNTZXQuYWRkKG1pbnQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICAgICAgICAgIGBbRGV4U2NyZWVuZXJdIFx1MjZBMFx1RkUwRiBTZWFyY2ggcmV0dXJuZWQgMCByZXN1bHRzIGZvciAke21pbnR9YCxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChzZWFyY2hFcnIpIHtcbiAgICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICAgIGBbRGV4U2NyZWVuZXJdIFx1MjZBMFx1RkUwRiBTZWFyY2ggZmFsbGJhY2sgZmFpbGVkIGZvciAke21pbnR9OmAsXG4gICAgICAgICAgICAgICAgc2VhcmNoRXJyIGluc3RhbmNlb2YgRXJyb3JcbiAgICAgICAgICAgICAgICAgID8gc2VhcmNoRXJyLm1lc3NhZ2VcbiAgICAgICAgICAgICAgICAgIDogU3RyaW5nKHNlYXJjaEVyciksXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qgc29sYW5hUGFpcnMgPSBtZXJnZVBhaXJzQnlUb2tlbihyZXN1bHRzKVxuICAgICAgLmZpbHRlcigocGFpcjogRGV4c2NyZWVuZXJUb2tlbikgPT4gcGFpci5jaGFpbklkID09PSBcInNvbGFuYVwiKVxuICAgICAgLnNvcnQoKGE6IERleHNjcmVlbmVyVG9rZW4sIGI6IERleHNjcmVlbmVyVG9rZW4pID0+IHtcbiAgICAgICAgY29uc3QgYUxpcXVpZGl0eSA9IGEubGlxdWlkaXR5Py51c2QgfHwgMDtcbiAgICAgICAgY29uc3QgYkxpcXVpZGl0eSA9IGIubGlxdWlkaXR5Py51c2QgfHwgMDtcbiAgICAgICAgaWYgKGJMaXF1aWRpdHkgIT09IGFMaXF1aWRpdHkpIHJldHVybiBiTGlxdWlkaXR5IC0gYUxpcXVpZGl0eTtcblxuICAgICAgICBjb25zdCBhVm9sdW1lID0gYS52b2x1bWU/LmgyNCB8fCAwO1xuICAgICAgICBjb25zdCBiVm9sdW1lID0gYi52b2x1bWU/LmgyNCB8fCAwO1xuICAgICAgICByZXR1cm4gYlZvbHVtZSAtIGFWb2x1bWU7XG4gICAgICB9KTtcblxuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYFtEZXhTY3JlZW5lcl0gXHUyNzA1IFJlc3BvbnNlOiAke3NvbGFuYVBhaXJzLmxlbmd0aH0gU29sYW5hIHBhaXJzIGZvdW5kIGFjcm9zcyAke2JhdGNoZXMubGVuZ3RofSBiYXRjaChlcylgICtcbiAgICAgICAgKG1pc3NpbmdNaW50cy5sZW5ndGggPiAwXG4gICAgICAgICAgPyBgICgke21pc3NpbmdNaW50cy5sZW5ndGh9IHJlcXVpcmVkIHNlYXJjaCBmYWxsYmFjaylgXG4gICAgICAgICAgOiBcIlwiKSxcbiAgICApO1xuICAgIHJlcy5qc29uKHsgc2NoZW1hVmVyc2lvbiwgcGFpcnM6IHNvbGFuYVBhaXJzIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJbRGV4U2NyZWVuZXJdIFx1Mjc0QyBUb2tlbnMgcHJveHkgZXJyb3I6XCIsIHtcbiAgICAgIG1pbnRzOiByZXEucXVlcnkubWludHMsXG4gICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgc3RhY2s6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5zdGFjayA6IHVuZGVmaW5lZCxcbiAgICB9KTtcblxuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiB7XG4gICAgICAgIG1lc3NhZ2U6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJJbnRlcm5hbCBlcnJvclwiLFxuICAgICAgICBkZXRhaWxzOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgfSxcbiAgICAgIHNjaGVtYVZlcnNpb246IFwiMS4wLjBcIixcbiAgICAgIHBhaXJzOiBbXSxcbiAgICB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZURleHNjcmVlbmVyU2VhcmNoOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgcSB9ID0gcmVxLnF1ZXJ5O1xuXG4gICAgaWYgKCFxIHx8IHR5cGVvZiBxICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oe1xuICAgICAgICBlcnJvcjogXCJNaXNzaW5nIG9yIGludmFsaWQgJ3EnIHBhcmFtZXRlciBmb3Igc2VhcmNoIHF1ZXJ5LlwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coYFtEZXhTY3JlZW5lcl0gU2VhcmNoIHJlcXVlc3QgZm9yOiAke3F9YCk7XG5cbiAgICBjb25zdCBkYXRhID0gYXdhaXQgZmV0Y2hEZXhzY3JlZW5lckRhdGEoXG4gICAgICBgL3NlYXJjaC8/cT0ke2VuY29kZVVSSUNvbXBvbmVudChxKX1gLFxuICAgICk7XG5cbiAgICAvLyBGaWx0ZXIgZm9yIFNvbGFuYSBwYWlycyBhbmQgbGltaXQgcmVzdWx0c1xuICAgIGNvbnN0IHNvbGFuYVBhaXJzID0gKGRhdGEucGFpcnMgfHwgW10pXG4gICAgICAuZmlsdGVyKChwYWlyOiBEZXhzY3JlZW5lclRva2VuKSA9PiBwYWlyLmNoYWluSWQgPT09IFwic29sYW5hXCIpXG4gICAgICAuc2xpY2UoMCwgMjApOyAvLyBMaW1pdCB0byAyMCByZXN1bHRzXG5cbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbRGV4U2NyZWVuZXJdIFx1MjcwNSBTZWFyY2ggcmVzcG9uc2U6ICR7c29sYW5hUGFpcnMubGVuZ3RofSByZXN1bHRzYCxcbiAgICApO1xuICAgIHJlcy5qc29uKHtcbiAgICAgIHNjaGVtYVZlcnNpb246IGRhdGEuc2NoZW1hVmVyc2lvbiB8fCBcIjEuMC4wXCIsXG4gICAgICBwYWlyczogc29sYW5hUGFpcnMsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIltEZXhTY3JlZW5lcl0gXHUyNzRDIFNlYXJjaCBwcm94eSBlcnJvcjpcIiwge1xuICAgICAgcXVlcnk6IHJlcS5xdWVyeS5xLFxuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICB9KTtcblxuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiB7XG4gICAgICAgIG1lc3NhZ2U6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJJbnRlcm5hbCBlcnJvclwiLFxuICAgICAgICBkZXRhaWxzOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgfSxcbiAgICAgIHNjaGVtYVZlcnNpb246IFwiMS4wLjBcIixcbiAgICAgIHBhaXJzOiBbXSxcbiAgICB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZURleHNjcmVlbmVyVHJlbmRpbmc6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc29sZS5sb2coXCJbRGV4U2NyZWVuZXJdIFRyZW5kaW5nIHRva2VucyByZXF1ZXN0XCIpO1xuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IGZldGNoRGV4c2NyZWVuZXJEYXRhKFwiL3BhaXJzL3NvbGFuYVwiKTtcblxuICAgIC8vIEdldCB0b3AgdHJlbmRpbmcgcGFpcnMsIHNvcnRlZCBieSB2b2x1bWUgYW5kIGxpcXVpZGl0eVxuICAgIGNvbnN0IHRyZW5kaW5nUGFpcnMgPSAoZGF0YS5wYWlycyB8fCBbXSlcbiAgICAgIC5maWx0ZXIoXG4gICAgICAgIChwYWlyOiBEZXhzY3JlZW5lclRva2VuKSA9PlxuICAgICAgICAgIHBhaXIudm9sdW1lPy5oMjQgPiAxMDAwICYmIC8vIE1pbmltdW0gdm9sdW1lIGZpbHRlclxuICAgICAgICAgIHBhaXIubGlxdWlkaXR5Py51c2QgJiZcbiAgICAgICAgICBwYWlyLmxpcXVpZGl0eS51c2QgPiAxMDAwMCwgLy8gTWluaW11bSBsaXF1aWRpdHkgZmlsdGVyXG4gICAgICApXG4gICAgICAuc29ydCgoYTogRGV4c2NyZWVuZXJUb2tlbiwgYjogRGV4c2NyZWVuZXJUb2tlbikgPT4ge1xuICAgICAgICAvLyBTb3J0IGJ5IDI0aCB2b2x1bWVcbiAgICAgICAgY29uc3QgYVZvbHVtZSA9IGEudm9sdW1lPy5oMjQgfHwgMDtcbiAgICAgICAgY29uc3QgYlZvbHVtZSA9IGIudm9sdW1lPy5oMjQgfHwgMDtcbiAgICAgICAgcmV0dXJuIGJWb2x1bWUgLSBhVm9sdW1lO1xuICAgICAgfSlcbiAgICAgIC5zbGljZSgwLCA1MCk7IC8vIFRvcCA1MCB0cmVuZGluZ1xuXG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0RleFNjcmVlbmVyXSBcdTI3MDUgVHJlbmRpbmcgcmVzcG9uc2U6ICR7dHJlbmRpbmdQYWlycy5sZW5ndGh9IHRyZW5kaW5nIHBhaXJzYCxcbiAgICApO1xuICAgIHJlcy5qc29uKHtcbiAgICAgIHNjaGVtYVZlcnNpb246IGRhdGEuc2NoZW1hVmVyc2lvbiB8fCBcIjEuMC4wXCIsXG4gICAgICBwYWlyczogdHJlbmRpbmdQYWlycyxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiW0RleFNjcmVlbmVyXSBcdTI3NEMgVHJlbmRpbmcgcHJveHkgZXJyb3I6XCIsIHtcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgfSk7XG5cbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBlcnJvcjoge1xuICAgICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgZXJyb3JcIixcbiAgICAgICAgZGV0YWlsczogU3RyaW5nKGVycm9yKSxcbiAgICAgIH0sXG4gICAgICBzY2hlbWFWZXJzaW9uOiBcIjEuMC4wXCIsXG4gICAgICBwYWlyczogW10sXG4gICAgfSk7XG4gIH1cbn07XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvY29pbm1hcmtldGNhcC1wcm94eS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2NvaW5tYXJrZXRjYXAtcHJveHkudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbi8qKlxuICogQ29pbk1hcmtldENhcCBBUEkgUHJveHlcbiAqIFByb3ZpZGVzIHNlcnZlci1zaWRlIGFjY2VzcyB0byBDb2luTWFya2V0Q2FwIEFQSSB3aXRoIEFQSSBrZXkgbWFuYWdlbWVudFxuICovXG5cbmNvbnN0IENNQ19BUElfS0VZID0gcHJvY2Vzcy5lbnYuQ09JTk1BUktFVENBUF9BUElfS0VZIHx8IFwiXCI7XG5jb25zdCBDTUNfQkFTRV9VUkwgPSBcImh0dHBzOi8vcHJvLWFwaS5jb2lubWFya2V0Y2FwLmNvbS92MVwiO1xuXG5leHBvcnQgY29uc3QgaGFuZGxlQ29pbk1hcmtldENhcFF1b3RlczogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBzeW1ib2xzID0gcmVxLnF1ZXJ5LnN5bWJvbHMgYXMgc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG4gICAgaWYgKCFzeW1ib2xzIHx8ICFzeW1ib2xzLnRyaW0oKSkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IFwiTWlzc2luZyBvciBlbXB0eSAnc3ltYm9scycgcXVlcnkgcGFyYW1ldGVyXCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBJZiBubyBBUEkga2V5IGNvbmZpZ3VyZWQsIHJldHVybiBoZWxwZnVsIGVycm9yXG4gICAgaWYgKCFDTUNfQVBJX0tFWSkge1xuICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICBcIltDb2luTWFya2V0Q2FwXSBObyBBUEkga2V5IGNvbmZpZ3VyZWQgLSBzZXQgQ09JTk1BUktFVENBUF9BUElfS0VZIGVudmlyb25tZW50IHZhcmlhYmxlXCIsXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAzKS5qc29uKHtcbiAgICAgICAgZXJyb3I6XG4gICAgICAgICAgXCJDb2luTWFya2V0Q2FwIEFQSSBrZXkgbm90IGNvbmZpZ3VyZWQgb24gc2VydmVyLiBQbGVhc2UgYWRkIENPSU5NQVJLRVRDQVBfQVBJX0tFWSB0byBlbnZpcm9ubWVudCB2YXJpYWJsZXMuXCIsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbQ29pbk1hcmtldENhcF0gRmV0Y2hpbmcgcXVvdGVzIGZvciBzeW1ib2xzOiAke3N5bWJvbHMuc3Vic3RyaW5nKDAsIDEwMCl9YCxcbiAgICApO1xuXG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBjb25zdCB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgMTUwMDApO1xuXG4gICAgY29uc3QgdXJsID0gbmV3IFVSTChgJHtDTUNfQkFTRV9VUkx9L2NyeXB0b2N1cnJlbmN5L3F1b3Rlcy9sYXRlc3RgKTtcbiAgICB1cmwuc2VhcmNoUGFyYW1zLmFwcGVuZChcInN5bWJvbFwiLCBzeW1ib2xzKTtcbiAgICB1cmwuc2VhcmNoUGFyYW1zLmFwcGVuZChcImNvbnZlcnRcIiwgXCJVU0RcIik7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybC50b1N0cmluZygpLCB7XG4gICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIFwiWC1DTUNfUFJPX0FQSV9LRVlcIjogQ01DX0FQSV9LRVksXG4gICAgICAgIEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgfSxcbiAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgfSk7XG5cbiAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcblxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgIGNvbnN0IGVycm9yVGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKS5jYXRjaCgoKSA9PiBcIlwiKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgIGBbQ29pbk1hcmtldENhcF0gQVBJIGVycm9yOiAke3Jlc3BvbnNlLnN0YXR1c30gJHtyZXNwb25zZS5zdGF0dXNUZXh0fWAsXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMocmVzcG9uc2Uuc3RhdHVzKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IGBDb2luTWFya2V0Q2FwIEFQSSBlcnJvcjogJHtyZXNwb25zZS5zdGF0dXN9YCxcbiAgICAgICAgZGV0YWlsczogZXJyb3JUZXh0LFxuICAgICAgICBkYXRhOiBudWxsLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblxuICAgIC8vIENoZWNrIGZvciBBUEktbGV2ZWwgZXJyb3JzXG4gICAgaWYgKGRhdGEuc3RhdHVzPy5lcnJvcl9jb2RlICE9PSAwKSB7XG4gICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgIGBbQ29pbk1hcmtldENhcF0gQVBJIHJldHVybmVkIGVycm9yOiAke2RhdGEuc3RhdHVzPy5lcnJvcl9tZXNzYWdlfWAsXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IGRhdGEuc3RhdHVzPy5lcnJvcl9tZXNzYWdlIHx8IFwiQ29pbk1hcmtldENhcCBBUEkgZXJyb3JcIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYFtDb2luTWFya2V0Q2FwXSBcdTI3MDUgR290IHF1b3RlcyBmb3IgJHtPYmplY3Qua2V5cyhkYXRhLmRhdGEgfHwge30pLmxlbmd0aH0gc3ltYm9sc2AsXG4gICAgKTtcblxuICAgIHJlcy5qc29uKGRhdGEpO1xuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgLy8gSGFuZGxlIGFib3J0L3RpbWVvdXRcbiAgICBpZiAoZXJyb3IubmFtZSA9PT0gXCJBYm9ydEVycm9yXCIpIHtcbiAgICAgIGNvbnNvbGUud2FybihcIltDb2luTWFya2V0Q2FwXSBSZXF1ZXN0IHRpbWVvdXRcIik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDQpLmpzb24oe1xuICAgICAgICBlcnJvcjogXCJDb2luTWFya2V0Q2FwIHJlcXVlc3QgdGltZW91dFwiLFxuICAgICAgICBkYXRhOiBudWxsLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5lcnJvcihcIltDb2luTWFya2V0Q2FwXSBQcm94eSBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgc2VydmVyIGVycm9yXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlQ29pbk1hcmtldENhcFNlYXJjaDogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBxdWVyeSA9IHJlcS5xdWVyeS5xIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcblxuICAgIGlmICghcXVlcnkgfHwgIXF1ZXJ5LnRyaW0oKSkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IFwiTWlzc2luZyBvciBlbXB0eSAncScgcXVlcnkgcGFyYW1ldGVyXCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoIUNNQ19BUElfS0VZKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDMpLmpzb24oe1xuICAgICAgICBlcnJvcjpcbiAgICAgICAgICBcIkNvaW5NYXJrZXRDYXAgQVBJIGtleSBub3QgY29uZmlndXJlZC4gU2V0IENPSU5NQVJLRVRDQVBfQVBJX0tFWSBlbnZpcm9ubWVudCB2YXJpYWJsZS5cIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKGBbQ29pbk1hcmtldENhcF0gU2VhcmNoaW5nIGZvcjogJHtxdWVyeX1gKTtcblxuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIDE1MDAwKTtcblxuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoYCR7Q01DX0JBU0VfVVJMfS9jcnlwdG9jdXJyZW5jeS9tYXBgKTtcbiAgICB1cmwuc2VhcmNoUGFyYW1zLmFwcGVuZChcInN5bWJvbFwiLCBxdWVyeS50b1VwcGVyQ2FzZSgpKTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLnRvU3RyaW5nKCksIHtcbiAgICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgXCJYLUNNQ19QUk9fQVBJX0tFWVwiOiBDTUNfQVBJX0tFWSxcbiAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICB9LFxuICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICB9KTtcblxuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgY29uc3QgZXJyb3JUZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpLmNhdGNoKCgpID0+IFwiXCIpO1xuICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgYFtDb2luTWFya2V0Q2FwXSBTZWFyY2ggZXJyb3I6ICR7cmVzcG9uc2Uuc3RhdHVzfSAke3Jlc3BvbnNlLnN0YXR1c1RleHR9YCxcbiAgICAgICk7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyhyZXNwb25zZS5zdGF0dXMpLmpzb24oe1xuICAgICAgICBlcnJvcjogYENvaW5NYXJrZXRDYXAgc2VhcmNoIGVycm9yOiAke3Jlc3BvbnNlLnN0YXR1c31gLFxuICAgICAgICBkZXRhaWxzOiBlcnJvclRleHQsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgIHJlcy5qc29uKGRhdGEpO1xuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgaWYgKGVycm9yLm5hbWUgPT09IFwiQWJvcnRFcnJvclwiKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDQpLmpzb24oe1xuICAgICAgICBlcnJvcjogXCJDb2luTWFya2V0Q2FwIHNlYXJjaCB0aW1lb3V0XCIsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmVycm9yKFwiW0NvaW5NYXJrZXRDYXBdIFNlYXJjaCBwcm94eSBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgc2VydmVyIGVycm9yXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2p1cGl0ZXItcHJveHkudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Jvb3QvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9qdXBpdGVyLXByb3h5LnRzXCI7aW1wb3J0IHsgUmVxdWVzdEhhbmRsZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5pbnRlcmZhY2UgSnVwaXRlclByaWNlUmVzcG9uc2Uge1xuICBkYXRhOiBSZWNvcmQ8c3RyaW5nLCB7IHByaWNlOiBudW1iZXIgfT47XG59XG5cbi8vIEp1cGl0ZXIgZW5kcG9pbnRzXG5jb25zdCBKVVBJVEVSX1BSSUNFX0VORFBPSU5UUyA9IFtcbiAgXCJodHRwczovL3ByaWNlLmp1cC5hZy92NFwiLFxuICBcImh0dHBzOi8vYXBpLmp1cC5hZy9wcmljZS92MlwiLFxuXTtcbmNvbnN0IEpVUElURVJfU1dBUF9CQVNFID0gXCJodHRwczovL2xpdGUtYXBpLmp1cC5hZy9zd2FwL3YxXCI7XG5cbmxldCBjdXJyZW50RW5kcG9pbnRJbmRleCA9IDA7XG5cbmNvbnN0IHRyeUp1cGl0ZXJFbmRwb2ludHMgPSBhc3luYyAoXG4gIHBhdGg6IHN0cmluZyxcbiAgcGFyYW1zOiBVUkxTZWFyY2hQYXJhbXMsXG4pOiBQcm9taXNlPGFueT4gPT4ge1xuICBsZXQgbGFzdEVycm9yOiBFcnJvciB8IG51bGwgPSBudWxsO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgSlVQSVRFUl9QUklDRV9FTkRQT0lOVFMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBlbmRwb2ludEluZGV4ID1cbiAgICAgIChjdXJyZW50RW5kcG9pbnRJbmRleCArIGkpICUgSlVQSVRFUl9QUklDRV9FTkRQT0lOVFMubGVuZ3RoO1xuICAgIGNvbnN0IGVuZHBvaW50ID0gSlVQSVRFUl9QUklDRV9FTkRQT0lOVFNbZW5kcG9pbnRJbmRleF07XG4gICAgY29uc3QgdXJsID0gYCR7ZW5kcG9pbnR9JHtwYXRofT8ke3BhcmFtcy50b1N0cmluZygpfWA7XG5cbiAgICB0cnkge1xuICAgICAgY29uc29sZS5sb2coYFRyeWluZyBKdXBpdGVyIEFQSTogJHt1cmx9YCk7XG5cbiAgICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgICBjb25zdCB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgMTUwMDApO1xuXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICBBY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChjb21wYXRpYmxlOyBTb2xhbmFXYWxsZXQvMS4wKVwiLFxuICAgICAgICB9LFxuICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgfSk7XG5cbiAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQyOSkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgUmF0ZSBsaW1pdGVkIG9uICR7ZW5kcG9pbnR9LCB0cnlpbmcgbmV4dC4uLmApO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgSFRUUCAke3Jlc3BvbnNlLnN0YXR1c306ICR7cmVzcG9uc2Uuc3RhdHVzVGV4dH1gKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblxuICAgICAgY3VycmVudEVuZHBvaW50SW5kZXggPSBlbmRwb2ludEluZGV4O1xuICAgICAgY29uc29sZS5sb2coYEp1cGl0ZXIgQVBJIGNhbGwgc3VjY2Vzc2Z1bCB2aWEgJHtlbmRwb2ludH1gKTtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zdCBlcnJvck1zZyA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbiAgICAgIGNvbnNvbGUud2FybihgSnVwaXRlciBlbmRwb2ludCAke2VuZHBvaW50fSBmYWlsZWQ6YCwgZXJyb3JNc2cpO1xuICAgICAgbGFzdEVycm9yID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yIDogbmV3IEVycm9yKFN0cmluZyhlcnJvcikpO1xuXG4gICAgICBpZiAoaSA8IEpVUElURVJfUFJJQ0VfRU5EUE9JTlRTLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMTAwMCkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHRocm93IG5ldyBFcnJvcihcbiAgICBgQWxsIEp1cGl0ZXIgZW5kcG9pbnRzIGZhaWxlZC4gTGFzdCBlcnJvcjogJHtsYXN0RXJyb3I/Lm1lc3NhZ2UgfHwgXCJVbmtub3duIGVycm9yXCJ9YCxcbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVKdXBpdGVyUHJpY2U6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBpZHMgfSA9IHJlcS5xdWVyeTtcblxuICAgIGlmICghaWRzIHx8IHR5cGVvZiBpZHMgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7XG4gICAgICAgIGVycm9yOlxuICAgICAgICAgIFwiTWlzc2luZyBvciBpbnZhbGlkICdpZHMnIHBhcmFtZXRlci4gRXhwZWN0ZWQgY29tbWEtc2VwYXJhdGVkIHRva2VuIG1pbnRzLlwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coYEp1cGl0ZXIgcHJpY2UgcmVxdWVzdCBmb3IgdG9rZW5zOiAke2lkc31gKTtcblxuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgICAgaWRzOiBpZHMsXG4gICAgfSk7XG5cbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdHJ5SnVwaXRlckVuZHBvaW50cyhcIi9wcmljZVwiLCBwYXJhbXMpO1xuXG4gICAgaWYgKCFkYXRhIHx8IHR5cGVvZiBkYXRhICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHJlc3BvbnNlIGZvcm1hdCBmcm9tIEp1cGl0ZXIgQVBJXCIpO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYEp1cGl0ZXIgcHJpY2UgcmVzcG9uc2U6ICR7T2JqZWN0LmtleXMoZGF0YS5kYXRhIHx8IHt9KS5sZW5ndGh9IHRva2Vuc2AsXG4gICAgKTtcbiAgICByZXMuanNvbihkYXRhKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiSnVwaXRlciBwcmljZSBwcm94eSBlcnJvcjpcIiwge1xuICAgICAgaWRzOiByZXEucXVlcnkuaWRzLFxuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICAgIHN0YWNrOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3Iuc3RhY2sgOiB1bmRlZmluZWQsXG4gICAgfSk7XG5cbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBlcnJvcjoge1xuICAgICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgZXJyb3JcIixcbiAgICAgICAgZGV0YWlsczogU3RyaW5nKGVycm9yKSxcbiAgICAgIH0sXG4gICAgICBkYXRhOiB7fSxcbiAgICB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUp1cGl0ZXJUb2tlbnM6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyB0eXBlID0gXCJzdHJpY3RcIiB9ID0gcmVxLnF1ZXJ5IGFzIHsgdHlwZT86IHN0cmluZyB9O1xuXG4gICAgY29uc29sZS5sb2coYEp1cGl0ZXIgdG9rZW5zIHJlcXVlc3Q6ICR7dHlwZX1gKTtcblxuICAgIGNvbnN0IHR5cGVzVG9UcnkgPSBbdHlwZSB8fCBcInN0cmljdFwiLCBcImFsbFwiXTsgLy8gZmFsbGJhY2sgdG8gJ2FsbCcgaWYgJ3N0cmljdCcgZmFpbHNcbiAgICBjb25zdCBiYXNlRW5kcG9pbnRzID0gKHQ6IHN0cmluZykgPT4gW1xuICAgICAgYGh0dHBzOi8vdG9rZW4uanVwLmFnLyR7dH1gLFxuICAgICAgXCJodHRwczovL2NhY2hlLmp1cC5hZy90b2tlbnNcIixcbiAgICBdO1xuXG4gICAgY29uc3QgZmV0Y2hXaXRoVGltZW91dCA9ICh1cmw6IHN0cmluZywgdGltZW91dE1zOiBudW1iZXIpID0+IHtcbiAgICAgIGNvbnN0IHRpbWVvdXRQcm9taXNlID0gbmV3IFByb21pc2U8UmVzcG9uc2U+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgIHNldFRpbWVvdXQoXG4gICAgICAgICAgKCkgPT5cbiAgICAgICAgICAgIHJlc29sdmUoXG4gICAgICAgICAgICAgIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogNTA0LCBzdGF0dXNUZXh0OiBcIkdhdGV3YXkgVGltZW91dFwiIH0pLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICB0aW1lb3V0TXMsXG4gICAgICAgICk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBQcm9taXNlLnJhY2UoW1xuICAgICAgICBmZXRjaCh1cmwsIHtcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgICAgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKGNvbXBhdGlibGU7IFNvbGFuYVdhbGxldC8xLjApXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSksXG4gICAgICAgIHRpbWVvdXRQcm9taXNlLFxuICAgICAgXSkgYXMgUHJvbWlzZTxSZXNwb25zZT47XG4gICAgfTtcblxuICAgIGxldCBsYXN0RXJyb3I6IHN0cmluZyA9IFwiXCI7XG5cbiAgICBmb3IgKGNvbnN0IHQgb2YgdHlwZXNUb1RyeSkge1xuICAgICAgY29uc3QgZW5kcG9pbnRzID0gYmFzZUVuZHBvaW50cyh0KTtcbiAgICAgIGZvciAobGV0IGF0dGVtcHQgPSAxOyBhdHRlbXB0IDw9IDM7IGF0dGVtcHQrKykge1xuICAgICAgICBmb3IgKGNvbnN0IGVuZHBvaW50IG9mIGVuZHBvaW50cykge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoV2l0aFRpbWVvdXQoZW5kcG9pbnQsIDE1MDAwKTtcbiAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgICAgbGFzdEVycm9yID0gYCR7ZW5kcG9pbnR9IC0+ICR7cmVzcG9uc2Uuc3RhdHVzfSAke3Jlc3BvbnNlLnN0YXR1c1RleHR9YDtcbiAgICAgICAgICAgICAgLy8gcmV0cnkgb24gcmF0ZSBsaW1pdGluZyAvIHNlcnZlciBlcnJvcnNcbiAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDI5IHx8IHJlc3BvbnNlLnN0YXR1cyA+PSA1MDApIGNvbnRpbnVlO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgICAgICBjb25zdCBjb3VudCA9IEFycmF5LmlzQXJyYXkoZGF0YSkgPyBkYXRhLmxlbmd0aCA6IDA7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICAgYEp1cGl0ZXIgdG9rZW5zIHJlc3BvbnNlICgke3R9KSB2aWEgJHtlbmRwb2ludH06ICR7Y291bnR9IHRva2Vuc2AsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIHJlcy5qc29uKGRhdGEpO1xuICAgICAgICAgIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgICAgICAgICAgbGFzdEVycm9yID0gYCR7ZW5kcG9pbnR9IC0+ICR7ZT8ubWVzc2FnZSB8fCBTdHJpbmcoZSl9YDtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgSnVwaXRlciB0b2tlbnMgZmV0Y2ggZmFpbGVkOiAke2xhc3RFcnJvcn1gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgYXR0ZW1wdCAqIDUwMCkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXMuc3RhdHVzKDUwMikuanNvbih7XG4gICAgICBlcnJvcjoge1xuICAgICAgICBtZXNzYWdlOiBcIkFsbCBKdXBpdGVyIHRva2VuIGVuZHBvaW50cyBmYWlsZWRcIixcbiAgICAgICAgZGV0YWlsczogbGFzdEVycm9yIHx8IFwiVW5rbm93biBlcnJvclwiLFxuICAgICAgfSxcbiAgICAgIGRhdGE6IFtdLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJKdXBpdGVyIHRva2VucyBwcm94eSBlcnJvcjpcIiwge1xuICAgICAgdHlwZTogcmVxLnF1ZXJ5LnR5cGUsXG4gICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgIH0pO1xuXG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgZXJyb3I6IHtcbiAgICAgICAgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIkludGVybmFsIGVycm9yXCIsXG4gICAgICAgIGRldGFpbHM6IFN0cmluZyhlcnJvciksXG4gICAgICB9LFxuICAgICAgZGF0YTogW10sXG4gICAgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVKdXBpdGVyUXVvdGU6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBpbnB1dE1pbnQsIG91dHB1dE1pbnQsIGFtb3VudCwgc2xpcHBhZ2VCcHMsIGFzTGVnYWN5VHJhbnNhY3Rpb24gfSA9XG4gICAgICByZXEucXVlcnk7XG5cbiAgICBpZiAoXG4gICAgICAhaW5wdXRNaW50IHx8XG4gICAgICAhb3V0cHV0TWludCB8fFxuICAgICAgIWFtb3VudCB8fFxuICAgICAgdHlwZW9mIGlucHV0TWludCAhPT0gXCJzdHJpbmdcIiB8fFxuICAgICAgdHlwZW9mIG91dHB1dE1pbnQgIT09IFwic3RyaW5nXCIgfHxcbiAgICAgIHR5cGVvZiBhbW91bnQgIT09IFwic3RyaW5nXCJcbiAgICApIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7XG4gICAgICAgIGVycm9yOiBcIk1pc3NpbmcgcmVxdWlyZWQgcXVlcnkgcGFyYW1zOiBpbnB1dE1pbnQsIG91dHB1dE1pbnQsIGFtb3VudFwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7XG4gICAgICBpbnB1dE1pbnQsXG4gICAgICBvdXRwdXRNaW50LFxuICAgICAgYW1vdW50LFxuICAgICAgc2xpcHBhZ2VCcHM6IHR5cGVvZiBzbGlwcGFnZUJwcyA9PT0gXCJzdHJpbmdcIiA/IHNsaXBwYWdlQnBzIDogXCI1MFwiLFxuICAgICAgb25seURpcmVjdFJvdXRlczogXCJmYWxzZVwiLFxuICAgICAgYXNMZWdhY3lUcmFuc2FjdGlvbjpcbiAgICAgICAgdHlwZW9mIGFzTGVnYWN5VHJhbnNhY3Rpb24gPT09IFwic3RyaW5nXCIgPyBhc0xlZ2FjeVRyYW5zYWN0aW9uIDogXCJmYWxzZVwiLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXJsID0gYCR7SlVQSVRFUl9TV0FQX0JBU0V9L3F1b3RlPyR7cGFyYW1zLnRvU3RyaW5nKCl9YDtcblxuICAgIGNvbnN0IGZldGNoV2l0aFRpbWVvdXQgPSAodGltZW91dE1zOiBudW1iZXIpID0+IHtcbiAgICAgIGNvbnN0IHRpbWVvdXRQcm9taXNlID0gbmV3IFByb21pc2U8UmVzcG9uc2U+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgIHNldFRpbWVvdXQoXG4gICAgICAgICAgKCkgPT5cbiAgICAgICAgICAgIHJlc29sdmUoXG4gICAgICAgICAgICAgIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogNTA0LCBzdGF0dXNUZXh0OiBcIkdhdGV3YXkgVGltZW91dFwiIH0pLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICB0aW1lb3V0TXMsXG4gICAgICAgICk7XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGZldGNoUHJvbWlzZSA9IGZldGNoKHVybCwge1xuICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICBBY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChjb21wYXRpYmxlOyBTb2xhbmFXYWxsZXQvMS4wKVwiLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yYWNlKFtmZXRjaFByb21pc2UsIHRpbWVvdXRQcm9taXNlXSkgYXMgUHJvbWlzZTxSZXNwb25zZT47XG4gICAgfTtcblxuICAgIC8vIFRyeSB1cCB0byAzIGF0dGVtcHRzIHdpdGggc21hbGwgYmFja29mZiBvbiA1eHgvNDI5XG4gICAgbGV0IGxhc3RTdGF0dXMgPSAwO1xuICAgIGxldCBsYXN0VGV4dCA9IFwiXCI7XG4gICAgZm9yIChsZXQgYXR0ZW1wdCA9IDE7IGF0dGVtcHQgPD0gMzsgYXR0ZW1wdCsrKSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoV2l0aFRpbWVvdXQoMTUwMDApO1xuICAgICAgbGFzdFN0YXR1cyA9IHJlc3BvbnNlLnN0YXR1cztcbiAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgICByZXR1cm4gcmVzLmpzb24oZGF0YSk7XG4gICAgICB9XG4gICAgICBsYXN0VGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKS5jYXRjaCgoKSA9PiBcIlwiKTtcblxuICAgICAgLy8gSWYgNDA0IG9yIDQwMCwgbGlrZWx5IG1lYW5zIG5vIHJvdXRlIGV4aXN0cyBmb3IgdGhpcyBwYWlyXG4gICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MDQgfHwgcmVzcG9uc2Uuc3RhdHVzID09PSA0MDApIHtcbiAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgIGBKdXBpdGVyIHF1b3RlIHJldHVybmVkICR7cmVzcG9uc2Uuc3RhdHVzfSAtIGxpa2VseSBubyByb3V0ZSBmb3IgdGhpcyBwYWlyYCxcbiAgICAgICAgICB7IGlucHV0TWludDogcmVxLnF1ZXJ5LmlucHV0TWludCwgb3V0cHV0TWludDogcmVxLnF1ZXJ5Lm91dHB1dE1pbnQgfSxcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMocmVzcG9uc2Uuc3RhdHVzKS5qc29uKHtcbiAgICAgICAgICBlcnJvcjogYE5vIHN3YXAgcm91dGUgZm91bmQgZm9yIHRoaXMgcGFpcmAsXG4gICAgICAgICAgZGV0YWlsczogbGFzdFRleHQsXG4gICAgICAgICAgY29kZTogcmVzcG9uc2Uuc3RhdHVzID09PSA0MDQgPyBcIk5PX1JPVVRFX0ZPVU5EXCIgOiBcIklOVkFMSURfUEFSQU1TXCIsXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBSZXRyeSBvbiByYXRlIGxpbWl0IG9yIHNlcnZlciBlcnJvcnNcbiAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQyOSB8fCByZXNwb25zZS5zdGF0dXMgPj0gNTAwKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICBgSnVwaXRlciBBUEkgcmV0dXJuZWQgJHtyZXNwb25zZS5zdGF0dXN9LCByZXRyeWluZy4uLiAoYXR0ZW1wdCAke2F0dGVtcHR9LzMpYCxcbiAgICAgICAgKTtcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgYXR0ZW1wdCAqIDUwMCkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHJldHVybiByZXMuc3RhdHVzKGxhc3RTdGF0dXMgfHwgNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBgUXVvdGUgQVBJIGVycm9yYCxcbiAgICAgIGRldGFpbHM6IGxhc3RUZXh0LFxuICAgICAgY29kZTogbGFzdFN0YXR1cyA9PT0gNTA0ID8gXCJUSU1FT1VUXCIgOiBcIkFQSV9FUlJPUlwiLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJKdXBpdGVyIHF1b3RlIHByb3h5IGVycm9yOlwiLCB7XG4gICAgICBwYXJhbXM6IHJlcS5xdWVyeSxcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICBzdGFjazogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLnN0YWNrIDogdW5kZWZpbmVkLFxuICAgIH0pO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgZXJyb3JcIixcbiAgICB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUp1cGl0ZXJTd2FwOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGJvZHkgPSByZXEuYm9keSB8fCB7fTtcbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIFwiaGFuZGxlSnVwaXRlclN3YXAgcmVjZWl2ZWQgYm9keSBrZXlzOlwiLFxuICAgICAgT2JqZWN0LmtleXMoYm9keSB8fCB7fSksXG4gICAgKTtcblxuICAgIGlmICghYm9keSB8fCAhYm9keS5xdW90ZVJlc3BvbnNlIHx8ICFib2R5LnVzZXJQdWJsaWNLZXkpIHtcbiAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgXCJoYW5kbGVKdXBpdGVyU3dhcCBtaXNzaW5nIGZpZWxkcywgYm9keTpcIixcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoYm9keSksXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6XG4gICAgICAgICAgXCJNaXNzaW5nIHJlcXVpcmVkIGJvZHk6IHsgcXVvdGVSZXNwb25zZSwgdXNlclB1YmxpY0tleSwgLi4ub3B0aW9ucyB9XCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCAyMDAwMCk7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke0pVUElURVJfU1dBUF9CQVNFfS9zd2FwYCwge1xuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChjb21wYXRpYmxlOyBTb2xhbmFXYWxsZXQvMS4wKVwiLFxuICAgICAgfSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICB9KTtcblxuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgY29uc3QgdGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKS5jYXRjaCgoKSA9PiBcIlwiKTtcbiAgICAgIHJldHVybiByZXNcbiAgICAgICAgLnN0YXR1cyhyZXNwb25zZS5zdGF0dXMpXG4gICAgICAgIC5qc29uKHsgZXJyb3I6IGBTd2FwIGZhaWxlZDogJHtyZXNwb25zZS5zdGF0dXNUZXh0fWAsIGRldGFpbHM6IHRleHQgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICByZXMuanNvbihkYXRhKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiSnVwaXRlciBzd2FwIHByb3h5IGVycm9yOlwiLCB7XG4gICAgICBib2R5OiByZXEuYm9keSxcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICBzdGFjazogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLnN0YWNrIDogdW5kZWZpbmVkLFxuICAgIH0pO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgZXJyb3JcIixcbiAgICB9KTtcbiAgfVxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Jvb3QvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Jvb3QvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9mb3JleC1yYXRlLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvZm9yZXgtcmF0ZS50c1wiO2ltcG9ydCB7IFJlcXVlc3RIYW5kbGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUZvcmV4UmF0ZTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBiYXNlID0gU3RyaW5nKHJlcS5xdWVyeS5iYXNlIHx8IFwiVVNEXCIpLnRvVXBwZXJDYXNlKCk7XG4gICAgY29uc3Qgc3ltYm9scyA9IFN0cmluZyhyZXEucXVlcnkuc3ltYm9scyB8fCBcIlBLUlwiKS50b1VwcGVyQ2FzZSgpO1xuICAgIGNvbnN0IGZpcnN0U3ltYm9sID0gc3ltYm9scy5zcGxpdChcIixcIilbMF07XG4gICAgY29uc3QgUFJPVklERVJfVElNRU9VVF9NUyA9IDUwMDA7XG5cbiAgICBjb25zdCBwcm92aWRlcnM6IEFycmF5PHtcbiAgICAgIG5hbWU6IHN0cmluZztcbiAgICAgIHVybDogc3RyaW5nO1xuICAgICAgcGFyc2U6IChqOiBhbnkpID0+IG51bWJlciB8IG51bGw7XG4gICAgfT4gPSBbXG4gICAgICB7XG4gICAgICAgIG5hbWU6IFwiZXhjaGFuZ2VyYXRlLmhvc3RcIixcbiAgICAgICAgdXJsOiBgaHR0cHM6Ly9hcGkuZXhjaGFuZ2VyYXRlLmhvc3QvbGF0ZXN0P2Jhc2U9JHtlbmNvZGVVUklDb21wb25lbnQoYmFzZSl9JnN5bWJvbHM9JHtlbmNvZGVVUklDb21wb25lbnQoZmlyc3RTeW1ib2wpfWAsXG4gICAgICAgIHBhcnNlOiAoaikgPT5cbiAgICAgICAgICBqICYmIGoucmF0ZXMgJiYgdHlwZW9mIGoucmF0ZXNbZmlyc3RTeW1ib2xdID09PSBcIm51bWJlclwiXG4gICAgICAgICAgICA/IGoucmF0ZXNbZmlyc3RTeW1ib2xdXG4gICAgICAgICAgICA6IG51bGwsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiBcImZyYW5rZnVydGVyXCIsXG4gICAgICAgIHVybDogYGh0dHBzOi8vYXBpLmZyYW5rZnVydGVyLmFwcC9sYXRlc3Q/ZnJvbT0ke2VuY29kZVVSSUNvbXBvbmVudChiYXNlKX0mdG89JHtlbmNvZGVVUklDb21wb25lbnQoZmlyc3RTeW1ib2wpfWAsXG4gICAgICAgIHBhcnNlOiAoaikgPT5cbiAgICAgICAgICBqICYmIGoucmF0ZXMgJiYgdHlwZW9mIGoucmF0ZXNbZmlyc3RTeW1ib2xdID09PSBcIm51bWJlclwiXG4gICAgICAgICAgICA/IGoucmF0ZXNbZmlyc3RTeW1ib2xdXG4gICAgICAgICAgICA6IG51bGwsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiBcImVyLWFwaVwiLFxuICAgICAgICB1cmw6IGBodHRwczovL29wZW4uZXItYXBpLmNvbS92Ni9sYXRlc3QvJHtlbmNvZGVVUklDb21wb25lbnQoYmFzZSl9YCxcbiAgICAgICAgcGFyc2U6IChqKSA9PlxuICAgICAgICAgIGogJiYgai5yYXRlcyAmJiB0eXBlb2Ygai5yYXRlc1tmaXJzdFN5bWJvbF0gPT09IFwibnVtYmVyXCJcbiAgICAgICAgICAgID8gai5yYXRlc1tmaXJzdFN5bWJvbF1cbiAgICAgICAgICAgIDogbnVsbCxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6IFwiZmF3YXphaG1lZC1jZG5cIixcbiAgICAgICAgdXJsOiBgaHR0cHM6Ly9jZG4uanNkZWxpdnIubmV0L2doL2Zhd2F6YWhtZWQwL2N1cnJlbmN5LWFwaUAxL2xhdGVzdC9jdXJyZW5jaWVzLyR7YmFzZS50b0xvd2VyQ2FzZSgpfS8ke2ZpcnN0U3ltYm9sLnRvTG93ZXJDYXNlKCl9Lmpzb25gLFxuICAgICAgICBwYXJzZTogKGopID0+XG4gICAgICAgICAgaiAmJiB0eXBlb2YgaltmaXJzdFN5bWJvbC50b0xvd2VyQ2FzZSgpXSA9PT0gXCJudW1iZXJcIlxuICAgICAgICAgICAgPyBqW2ZpcnN0U3ltYm9sLnRvTG93ZXJDYXNlKCldXG4gICAgICAgICAgICA6IG51bGwsXG4gICAgICB9LFxuICAgIF07XG5cbiAgICBjb25zdCBmZXRjaFByb3ZpZGVyID0gYXN5bmMgKFxuICAgICAgcHJvdmlkZXI6ICh0eXBlb2YgcHJvdmlkZXJzKVtudW1iZXJdLFxuICAgICk6IFByb21pc2U8eyByYXRlOiBudW1iZXI7IHByb3ZpZGVyOiBzdHJpbmcgfT4gPT4ge1xuICAgICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoXG4gICAgICAgICgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSxcbiAgICAgICAgUFJPVklERVJfVElNRU9VVF9NUyxcbiAgICAgICk7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXNwID0gYXdhaXQgZmV0Y2gocHJvdmlkZXIudXJsLCB7XG4gICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgICAgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKGNvbXBhdGlibGU7IFNvbGFuYVdhbGxldC8xLjApXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsIGFzIGFueSxcbiAgICAgICAgfSBhcyBhbnkpO1xuICAgICAgICBpZiAoIXJlc3Aub2spIHtcbiAgICAgICAgICBjb25zdCByZWFzb24gPSBgJHtyZXNwLnN0YXR1c30gJHtyZXNwLnN0YXR1c1RleHR9YDtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IocmVhc29uLnRyaW0oKSB8fCBcIm5vbi1vayByZXNwb25zZVwiKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzcC5qc29uKCk7XG4gICAgICAgIGNvbnN0IHJhdGUgPSBwcm92aWRlci5wYXJzZShqc29uKTtcbiAgICAgICAgaWYgKHR5cGVvZiByYXRlID09PSBcIm51bWJlclwiICYmIGlzRmluaXRlKHJhdGUpICYmIHJhdGUgPiAwKSB7XG4gICAgICAgICAgcmV0dXJuIHsgcmF0ZSwgcHJvdmlkZXI6IHByb3ZpZGVyLm5hbWUgfTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnZhbGlkIHJlc3BvbnNlIHBheWxvYWRcIik7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFske3Byb3ZpZGVyLm5hbWV9XSAke21lc3NhZ2V9YCk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3QgcnVuUHJvdmlkZXJzID0gKCkgPT4ge1xuICAgICAgY29uc3QgYXR0ZW1wdHMgPSBwcm92aWRlcnMubWFwKChwKSA9PiBmZXRjaFByb3ZpZGVyKHApKTtcbiAgICAgIGlmICh0eXBlb2YgKFByb21pc2UgYXMgYW55KS5hbnkgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICByZXR1cm4gKFByb21pc2UgYXMgYW55KS5hbnkoYXR0ZW1wdHMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHsgcmF0ZTogbnVtYmVyOyBwcm92aWRlcjogc3RyaW5nIH0+KFxuICAgICAgICAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgIGxldCByZW1haW5pbmcgPSBhdHRlbXB0cy5sZW5ndGg7XG4gICAgICAgICAgYXR0ZW1wdHMuZm9yRWFjaCgoYXR0ZW1wdCkgPT4ge1xuICAgICAgICAgICAgYXR0ZW1wdC50aGVuKHJlc29sdmUpLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAgICAgZXJyb3JzLnB1c2goZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpKTtcbiAgICAgICAgICAgICAgcmVtYWluaW5nIC09IDE7XG4gICAgICAgICAgICAgIGlmIChyZW1haW5pbmcgPT09IDApIHJlamVjdChuZXcgRXJyb3IoZXJyb3JzLmpvaW4oXCI7IFwiKSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICApO1xuICAgIH07XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgeyByYXRlLCBwcm92aWRlciB9ID0gYXdhaXQgcnVuUHJvdmlkZXJzKCk7XG4gICAgICByZXMuanNvbih7XG4gICAgICAgIGJhc2UsXG4gICAgICAgIHN5bWJvbHM6IFtmaXJzdFN5bWJvbF0sXG4gICAgICAgIHJhdGVzOiB7IFtmaXJzdFN5bWJvbF06IHJhdGUgfSxcbiAgICAgICAgcHJvdmlkZXIsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc3QgbXNnID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgICAgcmVzXG4gICAgICAgIC5zdGF0dXMoNTAyKVxuICAgICAgICAuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBmZXRjaCBmb3JleCByYXRlXCIsIGRldGFpbHM6IG1zZyB9KTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJVbmV4cGVjdGVkIGVycm9yXCIgfSk7XG4gIH1cbn07XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc3RhYmxlLTI0aC50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL3N0YWJsZS0yNGgudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVTdGFibGUyNGg6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3Qgc3ltYm9sc1BhcmFtID0gU3RyaW5nKHJlcS5xdWVyeS5zeW1ib2xzIHx8IFwiVVNEQyxVU0RUXCIpLnRvVXBwZXJDYXNlKCk7XG4gICAgY29uc3Qgc3ltYm9scyA9IEFycmF5LmZyb20oXG4gICAgICBuZXcgU2V0KFxuICAgICAgICBTdHJpbmcoc3ltYm9sc1BhcmFtKVxuICAgICAgICAgIC5zcGxpdChcIixcIilcbiAgICAgICAgICAubWFwKChzKSA9PiBzLnRyaW0oKSlcbiAgICAgICAgICAuZmlsdGVyKEJvb2xlYW4pLFxuICAgICAgKSxcbiAgICApO1xuXG4gICAgY29uc3QgQ09JTkdFQ0tPX0lEUzogUmVjb3JkPHN0cmluZywgeyBpZDogc3RyaW5nOyBtaW50OiBzdHJpbmcgfT4gPSB7XG4gICAgICBVU0RDOiB7XG4gICAgICAgIGlkOiBcInVzZC1jb2luXCIsXG4gICAgICAgIG1pbnQ6IFwiRVBqRldkZDVBdWZxU1NxZU0ycU4xeHp5YmFwQzhHNHdFR0drWnd5VER0MXZcIixcbiAgICAgIH0sXG4gICAgICBVU0RUOiB7XG4gICAgICAgIGlkOiBcInRldGhlclwiLFxuICAgICAgICBtaW50OiBcIkVzOXZNRnJ6YUNFUm1KZnJGNEgyRllENEtDb05rWTExTWNDZThCZW5FbnNcIixcbiAgICAgIH0sXG4gICAgfTtcblxuICAgIGNvbnN0IGlkcyA9IHN5bWJvbHNcbiAgICAgIC5tYXAoKHMpID0+IENPSU5HRUNLT19JRFNbc10/LmlkKVxuICAgICAgLmZpbHRlcihCb29sZWFuKVxuICAgICAgLmpvaW4oXCIsXCIpO1xuXG4gICAgaWYgKCFpZHMpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiBcIk5vIHN1cHBvcnRlZCBzeW1ib2xzIHByb3ZpZGVkXCIgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgYXBpVXJsID0gYGh0dHBzOi8vYXBpLmNvaW5nZWNrby5jb20vYXBpL3YzL3NpbXBsZS9wcmljZT9pZHM9JHtlbmNvZGVVUklDb21wb25lbnQoaWRzKX0mdnNfY3VycmVuY2llcz11c2QmaW5jbHVkZV8yNGhyX2NoYW5nZT10cnVlYDtcbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCAxMjAwMCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcCA9IGF3YWl0IGZldGNoKGFwaVVybCwge1xuICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsIGFzIGFueSxcbiAgICAgICAgaGVhZGVyczogeyBBY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgICB9IGFzIGFueSk7XG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcblxuICAgICAgY29uc3QgcmVzdWx0OiBSZWNvcmQ8XG4gICAgICAgIHN0cmluZyxcbiAgICAgICAgeyBwcmljZVVzZDogbnVtYmVyOyBjaGFuZ2UyNGg6IG51bWJlcjsgbWludDogc3RyaW5nIH1cbiAgICAgID4gPSB7fTtcblxuICAgICAgaWYgKHJlc3Aub2spIHtcbiAgICAgICAgY29uc3QganNvbiA9IGF3YWl0IHJlc3AuanNvbigpO1xuICAgICAgICBzeW1ib2xzLmZvckVhY2goKHN5bSkgPT4ge1xuICAgICAgICAgIGNvbnN0IG1ldGEgPSBDT0lOR0VDS09fSURTW3N5bV07XG4gICAgICAgICAgaWYgKCFtZXRhKSByZXR1cm47XG4gICAgICAgICAgY29uc3QgZCA9IChqc29uIGFzIGFueSk/LlttZXRhLmlkXTtcbiAgICAgICAgICBjb25zdCBwcmljZSA9IHR5cGVvZiBkPy51c2QgPT09IFwibnVtYmVyXCIgPyBkLnVzZCA6IDE7XG4gICAgICAgICAgY29uc3QgY2hhbmdlID1cbiAgICAgICAgICAgIHR5cGVvZiBkPy51c2RfMjRoX2NoYW5nZSA9PT0gXCJudW1iZXJcIiA/IGQudXNkXzI0aF9jaGFuZ2UgOiAwO1xuICAgICAgICAgIHJlc3VsdFtzeW1dID0geyBwcmljZVVzZDogcHJpY2UsIGNoYW5nZTI0aDogY2hhbmdlLCBtaW50OiBtZXRhLm1pbnQgfTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzeW1ib2xzLmZvckVhY2goKHN5bSkgPT4ge1xuICAgICAgICAgIGNvbnN0IG1ldGEgPSBDT0lOR0VDS09fSURTW3N5bV07XG4gICAgICAgICAgaWYgKCFtZXRhKSByZXR1cm47XG4gICAgICAgICAgcmVzdWx0W3N5bV0gPSB7IHByaWNlVXNkOiAxLCBjaGFuZ2UyNGg6IDAsIG1pbnQ6IG1ldGEubWludCB9O1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgcmVzLmpzb24oeyBkYXRhOiByZXN1bHQgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICBjb25zdCByZXN1bHQ6IFJlY29yZDxcbiAgICAgICAgc3RyaW5nLFxuICAgICAgICB7IHByaWNlVXNkOiBudW1iZXI7IGNoYW5nZTI0aDogbnVtYmVyOyBtaW50OiBzdHJpbmcgfVxuICAgICAgPiA9IHt9O1xuICAgICAgc3ltYm9scy5mb3JFYWNoKChzeW0pID0+IHtcbiAgICAgICAgY29uc3QgbWV0YSA9IENPSU5HRUNLT19JRFNbc3ltXTtcbiAgICAgICAgaWYgKCFtZXRhKSByZXR1cm47XG4gICAgICAgIHJlc3VsdFtzeW1dID0geyBwcmljZVVzZDogMSwgY2hhbmdlMjRoOiAwLCBtaW50OiBtZXRhLm1pbnQgfTtcbiAgICAgIH0pO1xuICAgICAgcmVzLmpzb24oeyBkYXRhOiByZXN1bHQgfSk7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiVW5leHBlY3RlZCBlcnJvclwiIH0pO1xuICB9XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2RleHRvb2xzLXByb3h5LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvZGV4dG9vbHMtcHJveHkudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbmNvbnN0IERFWFRPT0xTX0FQSV9CQVNFID0gXCJodHRwczovL2FwaS5kZXh0b29scy5pby92MVwiO1xuXG5pbnRlcmZhY2UgRGV4VG9vbHNUb2tlblJlc3BvbnNlIHtcbiAgZGF0YT86IHtcbiAgICBhZGRyZXNzOiBzdHJpbmc7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIHN5bWJvbDogc3RyaW5nO1xuICAgIHByaWNlVXNkPzogbnVtYmVyO1xuICAgIHByaWNlVXNkQ2hhbmdlMjRoPzogbnVtYmVyO1xuICAgIG1hcmtldENhcD86IG51bWJlcjtcbiAgICBsaXF1aWRpdHk/OiBudW1iZXI7XG4gICAgdm9sdW1lMjRoPzogbnVtYmVyO1xuICB9O1xuICBlcnJvckNvZGU/OiBzdHJpbmc7XG4gIGVycm9yTXNnPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgaGFuZGxlRGV4VG9vbHNQcmljZTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHRva2VuQWRkcmVzcywgY2hhaW5JZCB9ID0gcmVxLnF1ZXJ5O1xuXG4gICAgaWYgKCF0b2tlbkFkZHJlc3MgfHwgdHlwZW9mIHRva2VuQWRkcmVzcyAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IFwiTWlzc2luZyBvciBpbnZhbGlkICd0b2tlbkFkZHJlc3MnIHBhcmFtZXRlclwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgY2hhaW4gPSBjaGFpbklkIHx8IFwic29sYW5hXCI7XG5cbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbRGV4VG9vbHMgUHJveHldIEZldGNoaW5nIHByaWNlIGZvciAke3Rva2VuQWRkcmVzc30gb24gY2hhaW4gJHtjaGFpbn1gLFxuICAgICk7XG5cbiAgICBjb25zdCB1cmwgPSBgJHtERVhUT09MU19BUElfQkFTRX0vdG9rZW4vJHtjaGFpbn0vJHt0b2tlbkFkZHJlc3N9YDtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICBgW0RleFRvb2xzIFByb3h5XSBBUEkgcmV0dXJuZWQgJHtyZXNwb25zZS5zdGF0dXN9IGZvciAke3Rva2VuQWRkcmVzc31gLFxuICAgICAgKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKHJlc3BvbnNlLnN0YXR1cykuanNvbih7XG4gICAgICAgIGVycm9yOiBgRGV4VG9vbHMgQVBJIGVycm9yOiAke3Jlc3BvbnNlLnN0YXR1c31gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgZGF0YTogRGV4VG9vbHNUb2tlblJlc3BvbnNlID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuXG4gICAgaWYgKGRhdGEuZGF0YT8ucHJpY2VVc2QpIHtcbiAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICBgW0RleFRvb2xzIFByb3h5XSBQcmljZSByZXRyaWV2ZWQ6ICR7dG9rZW5BZGRyZXNzfSA9ICQke2RhdGEuZGF0YS5wcmljZVVzZH1gLFxuICAgICAgKTtcbiAgICAgIHJldHVybiByZXMuanNvbih7XG4gICAgICAgIHRva2VuQWRkcmVzcyxcbiAgICAgICAgcHJpY2VVc2Q6IGRhdGEuZGF0YS5wcmljZVVzZCxcbiAgICAgICAgcHJpY2VVc2RDaGFuZ2UyNGg6IGRhdGEuZGF0YS5wcmljZVVzZENoYW5nZTI0aCxcbiAgICAgICAgbWFya2V0Q2FwOiBkYXRhLmRhdGEubWFya2V0Q2FwLFxuICAgICAgICBsaXF1aWRpdHk6IGRhdGEuZGF0YS5saXF1aWRpdHksXG4gICAgICAgIHZvbHVtZTI0aDogZGF0YS5kYXRhLnZvbHVtZTI0aCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnNvbGUud2FybihgW0RleFRvb2xzIFByb3h5XSBObyBwcmljZSBkYXRhIGZvciAke3Rva2VuQWRkcmVzc31gKTtcbiAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oe1xuICAgICAgZXJyb3I6IFwiVG9rZW4gbm90IGZvdW5kIGluIERleFRvb2xzXCIsXG4gICAgICB0b2tlbkFkZHJlc3MsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIltEZXhUb29scyBQcm94eV0gRXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJJbnRlcm5hbCBzZXJ2ZXIgZXJyb3JcIixcbiAgICB9KTtcbiAgfVxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Jvb3QvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Jvb3QvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9wMnAtb3JkZXJzLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvcDJwLW9yZGVycy50c1wiO2ltcG9ydCB7IFJlcXVlc3RIYW5kbGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuZXhwb3J0IGludGVyZmFjZSBQMlBPcmRlciB7XG4gIGlkOiBzdHJpbmc7XG4gIHR5cGU6IFwiYnV5XCIgfCBcInNlbGxcIjtcbiAgY3JlYXRvcl93YWxsZXQ6IHN0cmluZztcbiAgdG9rZW46IHN0cmluZztcbiAgdG9rZW5fYW1vdW50OiBzdHJpbmc7XG4gIHBrcl9hbW91bnQ6IG51bWJlcjtcbiAgcGF5bWVudF9tZXRob2Q6IHN0cmluZztcbiAgc3RhdHVzOiBcImFjdGl2ZVwiIHwgXCJwZW5kaW5nXCIgfCBcImNvbXBsZXRlZFwiIHwgXCJjYW5jZWxsZWRcIiB8IFwiZGlzcHV0ZWRcIjtcbiAgb25saW5lOiBib29sZWFuO1xuICBjcmVhdGVkX2F0OiBudW1iZXI7XG4gIHVwZGF0ZWRfYXQ6IG51bWJlcjtcbiAgYWNjb3VudF9uYW1lPzogc3RyaW5nO1xuICBhY2NvdW50X251bWJlcj86IHN0cmluZztcbiAgd2FsbGV0X2FkZHJlc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHJhZGVSb29tIHtcbiAgaWQ6IHN0cmluZztcbiAgYnV5ZXJfd2FsbGV0OiBzdHJpbmc7XG4gIHNlbGxlcl93YWxsZXQ6IHN0cmluZztcbiAgb3JkZXJfaWQ6IHN0cmluZztcbiAgc3RhdHVzOlxuICAgIHwgXCJwZW5kaW5nXCJcbiAgICB8IFwicGF5bWVudF9jb25maXJtZWRcIlxuICAgIHwgXCJhc3NldHNfdHJhbnNmZXJyZWRcIlxuICAgIHwgXCJjb21wbGV0ZWRcIlxuICAgIHwgXCJjYW5jZWxsZWRcIjtcbiAgY3JlYXRlZF9hdDogbnVtYmVyO1xuICB1cGRhdGVkX2F0OiBudW1iZXI7XG59XG5cbi8vIEluLW1lbW9yeSBzdG9yZSBmb3IgZGV2ZWxvcG1lbnQgKHdpbGwgYmUgcmVwbGFjZWQgd2l0aCBkYXRhYmFzZSlcbmNvbnN0IG9yZGVyczogTWFwPHN0cmluZywgUDJQT3JkZXI+ID0gbmV3IE1hcCgpO1xuY29uc3Qgcm9vbXM6IE1hcDxzdHJpbmcsIFRyYWRlUm9vbT4gPSBuZXcgTWFwKCk7XG5jb25zdCBtZXNzYWdlczogTWFwPFxuICBzdHJpbmcsXG4gIEFycmF5PHtcbiAgICBpZDogc3RyaW5nO1xuICAgIHNlbmRlcl93YWxsZXQ6IHN0cmluZztcbiAgICBtZXNzYWdlOiBzdHJpbmc7XG4gICAgY3JlYXRlZF9hdDogbnVtYmVyO1xuICB9PlxuPiA9IG5ldyBNYXAoKTtcblxuLy8gSGVscGVyIGZ1bmN0aW9uc1xuZnVuY3Rpb24gZ2VuZXJhdGVJZChwcmVmaXg6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtwcmVmaXh9LSR7RGF0ZS5ub3coKX0tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyLCA4KX1gO1xufVxuXG4vLyBQMlAgT3JkZXJzIGVuZHBvaW50c1xuZXhwb3J0IGNvbnN0IGhhbmRsZUxpc3RQMlBPcmRlcnM6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyB0eXBlLCBzdGF0dXMsIHRva2VuLCBvbmxpbmUgfSA9IHJlcS5xdWVyeTtcblxuICAgIGxldCBmaWx0ZXJlZCA9IEFycmF5LmZyb20ob3JkZXJzLnZhbHVlcygpKTtcblxuICAgIGlmICh0eXBlKSBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcigobykgPT4gby50eXBlID09PSB0eXBlKTtcbiAgICBpZiAoc3RhdHVzKSBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcigobykgPT4gby5zdGF0dXMgPT09IHN0YXR1cyk7XG4gICAgaWYgKHRva2VuKSBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcigobykgPT4gby50b2tlbiA9PT0gdG9rZW4pO1xuICAgIGlmIChvbmxpbmUgPT09IFwidHJ1ZVwiKSBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcigobykgPT4gby5vbmxpbmUpO1xuICAgIGlmIChvbmxpbmUgPT09IFwiZmFsc2VcIikgZmlsdGVyZWQgPSBmaWx0ZXJlZC5maWx0ZXIoKG8pID0+ICFvLm9ubGluZSk7XG5cbiAgICBmaWx0ZXJlZC5zb3J0KChhLCBiKSA9PiBiLmNyZWF0ZWRfYXQgLSBhLmNyZWF0ZWRfYXQpO1xuXG4gICAgcmVzLmpzb24oeyBvcmRlcnM6IGZpbHRlcmVkIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJMaXN0IFAyUCBvcmRlcnMgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBsaXN0IG9yZGVyc1wiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlQ3JlYXRlUDJQT3JkZXI6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3Qge1xuICAgICAgdHlwZSxcbiAgICAgIGNyZWF0b3Jfd2FsbGV0LFxuICAgICAgdG9rZW4sXG4gICAgICB0b2tlbl9hbW91bnQsXG4gICAgICBwa3JfYW1vdW50LFxuICAgICAgcGF5bWVudF9tZXRob2QsXG4gICAgICBvbmxpbmUsXG4gICAgICBhY2NvdW50X25hbWUsXG4gICAgICBhY2NvdW50X251bWJlcixcbiAgICAgIHdhbGxldF9hZGRyZXNzLFxuICAgIH0gPSByZXEuYm9keTtcblxuICAgIGlmIChcbiAgICAgICF0eXBlIHx8XG4gICAgICAhY3JlYXRvcl93YWxsZXQgfHxcbiAgICAgICF0b2tlbiB8fFxuICAgICAgIXRva2VuX2Ftb3VudCB8fFxuICAgICAgIXBrcl9hbW91bnQgfHxcbiAgICAgICFwYXltZW50X21ldGhvZFxuICAgICkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6IFwiTWlzc2luZyByZXF1aXJlZCBmaWVsZHNcIiB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBpZCA9IGdlbmVyYXRlSWQoXCJvcmRlclwiKTtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXG4gICAgY29uc3Qgb3JkZXI6IFAyUE9yZGVyID0ge1xuICAgICAgaWQsXG4gICAgICB0eXBlLFxuICAgICAgY3JlYXRvcl93YWxsZXQsXG4gICAgICB0b2tlbixcbiAgICAgIHRva2VuX2Ftb3VudDogU3RyaW5nKHRva2VuX2Ftb3VudCksXG4gICAgICBwa3JfYW1vdW50OiBOdW1iZXIocGtyX2Ftb3VudCksXG4gICAgICBwYXltZW50X21ldGhvZCxcbiAgICAgIHN0YXR1czogXCJhY3RpdmVcIixcbiAgICAgIG9ubGluZTogb25saW5lICE9PSBmYWxzZSxcbiAgICAgIGNyZWF0ZWRfYXQ6IG5vdyxcbiAgICAgIHVwZGF0ZWRfYXQ6IG5vdyxcbiAgICAgIGFjY291bnRfbmFtZSxcbiAgICAgIGFjY291bnRfbnVtYmVyLFxuICAgICAgd2FsbGV0X2FkZHJlc3M6IHR5cGUgPT09IFwic2VsbFwiID8gd2FsbGV0X2FkZHJlc3MgOiB1bmRlZmluZWQsXG4gICAgfTtcblxuICAgIG9yZGVycy5zZXQoaWQsIG9yZGVyKTtcblxuICAgIHJlcy5zdGF0dXMoMjAxKS5qc29uKHsgb3JkZXIgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkNyZWF0ZSBQMlAgb3JkZXIgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBjcmVhdGUgb3JkZXJcIiB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUdldFAyUE9yZGVyOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgb3JkZXJJZCB9ID0gcmVxLnBhcmFtcztcbiAgICBjb25zdCBvcmRlciA9IG9yZGVycy5nZXQob3JkZXJJZCk7XG5cbiAgICBpZiAoIW9yZGVyKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJPcmRlciBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICByZXMuanNvbih7IG9yZGVyIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJHZXQgUDJQIG9yZGVyIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gZ2V0IG9yZGVyXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVVcGRhdGVQMlBPcmRlcjogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IG9yZGVySWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgY29uc3Qgb3JkZXIgPSBvcmRlcnMuZ2V0KG9yZGVySWQpO1xuXG4gICAgaWYgKCFvcmRlcikge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6IFwiT3JkZXIgbm90IGZvdW5kXCIgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXBkYXRlZDogUDJQT3JkZXIgPSB7XG4gICAgICAuLi5vcmRlcixcbiAgICAgIC4uLnJlcS5ib2R5LFxuICAgICAgaWQ6IG9yZGVyLmlkLFxuICAgICAgY3JlYXRlZF9hdDogb3JkZXIuY3JlYXRlZF9hdCxcbiAgICAgIHVwZGF0ZWRfYXQ6IERhdGUubm93KCksXG4gICAgfTtcblxuICAgIG9yZGVycy5zZXQob3JkZXJJZCwgdXBkYXRlZCk7XG4gICAgcmVzLmpzb24oeyBvcmRlcjogdXBkYXRlZCB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiVXBkYXRlIFAyUCBvcmRlciBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIHVwZGF0ZSBvcmRlclwiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlRGVsZXRlUDJQT3JkZXI6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBvcmRlcklkIH0gPSByZXEucGFyYW1zO1xuXG4gICAgaWYgKCFvcmRlcnMuaGFzKG9yZGVySWQpKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJPcmRlciBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICBvcmRlcnMuZGVsZXRlKG9yZGVySWQpO1xuICAgIHJlcy5qc29uKHsgb2s6IHRydWUgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkRlbGV0ZSBQMlAgb3JkZXIgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBkZWxldGUgb3JkZXJcIiB9KTtcbiAgfVxufTtcblxuLy8gVHJhZGUgUm9vbXMgZW5kcG9pbnRzXG5leHBvcnQgY29uc3QgaGFuZGxlTGlzdFRyYWRlUm9vbXM6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyB3YWxsZXQgfSA9IHJlcS5xdWVyeTtcblxuICAgIGxldCBmaWx0ZXJlZCA9IEFycmF5LmZyb20ocm9vbXMudmFsdWVzKCkpO1xuXG4gICAgaWYgKHdhbGxldCkge1xuICAgICAgZmlsdGVyZWQgPSBmaWx0ZXJlZC5maWx0ZXIoXG4gICAgICAgIChyKSA9PiByLmJ1eWVyX3dhbGxldCA9PT0gd2FsbGV0IHx8IHIuc2VsbGVyX3dhbGxldCA9PT0gd2FsbGV0LFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBmaWx0ZXJlZC5zb3J0KChhLCBiKSA9PiBiLmNyZWF0ZWRfYXQgLSBhLmNyZWF0ZWRfYXQpO1xuXG4gICAgcmVzLmpzb24oeyByb29tczogZmlsdGVyZWQgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkxpc3QgdHJhZGUgcm9vbXMgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBsaXN0IHJvb21zXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVDcmVhdGVUcmFkZVJvb206IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBidXllcl93YWxsZXQsIHNlbGxlcl93YWxsZXQsIG9yZGVyX2lkIH0gPSByZXEuYm9keTtcblxuICAgIGlmICghYnV5ZXJfd2FsbGV0IHx8ICFzZWxsZXJfd2FsbGV0IHx8ICFvcmRlcl9pZCkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6IFwiTWlzc2luZyByZXF1aXJlZCBmaWVsZHNcIiB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBpZCA9IGdlbmVyYXRlSWQoXCJyb29tXCIpO1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cbiAgICBjb25zdCByb29tOiBUcmFkZVJvb20gPSB7XG4gICAgICBpZCxcbiAgICAgIGJ1eWVyX3dhbGxldCxcbiAgICAgIHNlbGxlcl93YWxsZXQsXG4gICAgICBvcmRlcl9pZCxcbiAgICAgIHN0YXR1czogXCJwZW5kaW5nXCIsXG4gICAgICBjcmVhdGVkX2F0OiBub3csXG4gICAgICB1cGRhdGVkX2F0OiBub3csXG4gICAgfTtcblxuICAgIHJvb21zLnNldChpZCwgcm9vbSk7XG5cbiAgICByZXMuc3RhdHVzKDIwMSkuanNvbih7IHJvb20gfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkNyZWF0ZSB0cmFkZSByb29tIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gY3JlYXRlIHJvb21cIiB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUdldFRyYWRlUm9vbTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHJvb21JZCB9ID0gcmVxLnBhcmFtcztcbiAgICBjb25zdCByb29tID0gcm9vbXMuZ2V0KHJvb21JZCk7XG5cbiAgICBpZiAoIXJvb20pIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiBcIlJvb20gbm90IGZvdW5kXCIgfSk7XG4gICAgfVxuXG4gICAgcmVzLmpzb24oeyByb29tIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJHZXQgdHJhZGUgcm9vbSBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGdldCByb29tXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVVcGRhdGVUcmFkZVJvb206IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyByb29tSWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgY29uc3Qgcm9vbSA9IHJvb21zLmdldChyb29tSWQpO1xuXG4gICAgaWYgKCFyb29tKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJSb29tIG5vdCBmb3VuZFwiIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVwZGF0ZWQ6IFRyYWRlUm9vbSA9IHtcbiAgICAgIC4uLnJvb20sXG4gICAgICAuLi5yZXEuYm9keSxcbiAgICAgIGlkOiByb29tLmlkLFxuICAgICAgY3JlYXRlZF9hdDogcm9vbS5jcmVhdGVkX2F0LFxuICAgICAgdXBkYXRlZF9hdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuXG4gICAgcm9vbXMuc2V0KHJvb21JZCwgdXBkYXRlZCk7XG4gICAgcmVzLmpzb24oeyByb29tOiB1cGRhdGVkIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJVcGRhdGUgdHJhZGUgcm9vbSBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIHVwZGF0ZSByb29tXCIgfSk7XG4gIH1cbn07XG5cbi8vIFRyYWRlIE1lc3NhZ2VzIGVuZHBvaW50c1xuZXhwb3J0IGNvbnN0IGhhbmRsZUxpc3RUcmFkZU1lc3NhZ2VzOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgcm9vbUlkIH0gPSByZXEucGFyYW1zO1xuXG4gICAgY29uc3Qgcm9vbU1lc3NhZ2VzID0gbWVzc2FnZXMuZ2V0KHJvb21JZCkgfHwgW107XG4gICAgcmVzLmpzb24oeyBtZXNzYWdlczogcm9vbU1lc3NhZ2VzIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJMaXN0IHRyYWRlIG1lc3NhZ2VzIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gbGlzdCBtZXNzYWdlc1wiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlQWRkVHJhZGVNZXNzYWdlOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgcm9vbUlkIH0gPSByZXEucGFyYW1zO1xuICAgIGNvbnN0IHsgc2VuZGVyX3dhbGxldCwgbWVzc2FnZSwgYXR0YWNobWVudF91cmwgfSA9IHJlcS5ib2R5O1xuXG4gICAgaWYgKCFzZW5kZXJfd2FsbGV0IHx8ICFtZXNzYWdlKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogXCJNaXNzaW5nIHJlcXVpcmVkIGZpZWxkc1wiIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGlkID0gZ2VuZXJhdGVJZChcIm1zZ1wiKTtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXG4gICAgY29uc3QgbXNnID0ge1xuICAgICAgaWQsXG4gICAgICBzZW5kZXJfd2FsbGV0LFxuICAgICAgbWVzc2FnZSxcbiAgICAgIGF0dGFjaG1lbnRfdXJsLFxuICAgICAgY3JlYXRlZF9hdDogbm93LFxuICAgIH07XG5cbiAgICBpZiAoIW1lc3NhZ2VzLmhhcyhyb29tSWQpKSB7XG4gICAgICBtZXNzYWdlcy5zZXQocm9vbUlkLCBbXSk7XG4gICAgfVxuXG4gICAgbWVzc2FnZXMuZ2V0KHJvb21JZCkhLnB1c2gobXNnKTtcblxuICAgIHJlcy5zdGF0dXMoMjAxKS5qc29uKHsgbWVzc2FnZTogbXNnIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJBZGQgdHJhZGUgbWVzc2FnZSBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGFkZCBtZXNzYWdlXCIgfSk7XG4gIH1cbn07XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvb3JkZXJzLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvb3JkZXJzLnRzXCI7aW1wb3J0IHsgUmVxdWVzdEhhbmRsZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5pbnRlcmZhY2UgT3JkZXIge1xuICBpZDogc3RyaW5nO1xuICBzaWRlOiBcImJ1eVwiIHwgXCJzZWxsXCI7XG4gIGFtb3VudFBLUjogbnVtYmVyO1xuICBxdW90ZUFzc2V0OiBzdHJpbmc7XG4gIHByaWNlUEtSUGVyUXVvdGU6IG51bWJlcjtcbiAgcGF5bWVudE1ldGhvZDogc3RyaW5nO1xuICByb29tSWQ6IHN0cmluZztcbiAgY3JlYXRlZEJ5OiBzdHJpbmc7XG4gIGNyZWF0ZWRBdDogbnVtYmVyO1xuICBhY2NvdW50TmFtZT86IHN0cmluZztcbiAgYWNjb3VudE51bWJlcj86IHN0cmluZztcbiAgd2FsbGV0QWRkcmVzcz86IHN0cmluZztcbn1cblxuLy8gSW4tbWVtb3J5IHN0b3JlIGZvciBvcmRlcnMgKHdpbGwgYmUgcmVwbGFjZWQgd2l0aCBkYXRhYmFzZSBpbiBwcm9kdWN0aW9uKVxuY29uc3Qgb3JkZXJzU3RvcmUgPSBuZXcgTWFwPHN0cmluZywgT3JkZXI+KCk7XG5cbi8vIEFkbWluIHBhc3N3b3JkIGZvciB2YWxpZGF0aW9uXG5jb25zdCBBRE1JTl9QQVNTV09SRCA9IFwiUGFraXN0YW4jIzEyM1wiO1xuXG5jb25zdCBnZW5lcmF0ZUlkID0gKHByZWZpeDogc3RyaW5nKTogc3RyaW5nID0+IHtcbiAgcmV0dXJuIGAke3ByZWZpeH0tJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIsIDgpfWA7XG59O1xuXG5jb25zdCB2YWxpZGF0ZUFkbWluVG9rZW4gPSAodG9rZW46IHN0cmluZyk6IGJvb2xlYW4gPT4ge1xuICByZXR1cm4gdG9rZW4gPT09IEFETUlOX1BBU1NXT1JEO1xufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUxpc3RPcmRlcnM6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyByb29tSWQgfSA9IHJlcS5xdWVyeTtcblxuICAgIGxldCBmaWx0ZXJlZCA9IEFycmF5LmZyb20ob3JkZXJzU3RvcmUudmFsdWVzKCkpO1xuXG4gICAgaWYgKHJvb21JZCAmJiB0eXBlb2Ygcm9vbUlkID09PSBcInN0cmluZ1wiKSB7XG4gICAgICBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcigobykgPT4gby5yb29tSWQgPT09IHJvb21JZCk7XG4gICAgfVxuXG4gICAgLy8gU29ydCBieSBjcmVhdGVkIGRhdGUsIG5ld2VzdCBmaXJzdFxuICAgIGZpbHRlcmVkLnNvcnQoKGEsIGIpID0+IGIuY3JlYXRlZEF0IC0gYS5jcmVhdGVkQXQpO1xuXG4gICAgcmVzLmpzb24oeyBvcmRlcnM6IGZpbHRlcmVkIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJMaXN0IG9yZGVycyBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGxpc3Qgb3JkZXJzXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVDcmVhdGVPcmRlcjogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7XG4gICAgICBzaWRlLFxuICAgICAgYW1vdW50UEtSLFxuICAgICAgcXVvdGVBc3NldCxcbiAgICAgIHByaWNlUEtSUGVyUXVvdGUsXG4gICAgICBwYXltZW50TWV0aG9kLFxuICAgICAgcm9vbUlkID0gXCJnbG9iYWxcIixcbiAgICAgIGNyZWF0ZWRCeSxcbiAgICAgIGFjY291bnROYW1lLFxuICAgICAgYWNjb3VudE51bWJlcixcbiAgICAgIHdhbGxldEFkZHJlc3MsXG4gICAgfSA9IHJlcS5ib2R5O1xuXG4gICAgLy8gVmFsaWRhdGUgcmVxdWlyZWQgZmllbGRzXG4gICAgaWYgKFxuICAgICAgIXNpZGUgfHxcbiAgICAgICFhbW91bnRQS1IgfHxcbiAgICAgICFxdW90ZUFzc2V0IHx8XG4gICAgICAhcHJpY2VQS1JQZXJRdW90ZSB8fFxuICAgICAgIXBheW1lbnRNZXRob2RcbiAgICApIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7XG4gICAgICAgIGVycm9yOlxuICAgICAgICAgIFwiTWlzc2luZyByZXF1aXJlZCBmaWVsZHM6IHNpZGUsIGFtb3VudFBLUiwgcXVvdGVBc3NldCwgcHJpY2VQS1JQZXJRdW90ZSwgcGF5bWVudE1ldGhvZFwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gVmFsaWRhdGUgYXV0aG9yaXphdGlvblxuICAgIGNvbnN0IGF1dGhIZWFkZXIgPSByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uO1xuICAgIGNvbnN0IHRva2VuID0gYXV0aEhlYWRlcj8ucmVwbGFjZShcIkJlYXJlciBcIiwgXCJcIik7XG5cbiAgICBpZiAoIXRva2VuIHx8ICF2YWxpZGF0ZUFkbWluVG9rZW4odG9rZW4pKSB7XG4gICAgICByZXR1cm4gcmVzXG4gICAgICAgIC5zdGF0dXMoNDAxKVxuICAgICAgICAuanNvbih7IGVycm9yOiBcIlVuYXV0aG9yaXplZDogaW52YWxpZCBvciBtaXNzaW5nIGFkbWluIHRva2VuXCIgfSk7XG4gICAgfVxuXG4gICAgLy8gVmFsaWRhdGUgbnVtZXJpYyBmaWVsZHNcbiAgICBjb25zdCBhbW91bnQgPSBOdW1iZXIoYW1vdW50UEtSKTtcbiAgICBjb25zdCBwcmljZSA9IE51bWJlcihwcmljZVBLUlBlclF1b3RlKTtcblxuICAgIGlmICghaXNGaW5pdGUoYW1vdW50KSB8fCBhbW91bnQgPD0gMCkge1xuICAgICAgcmV0dXJuIHJlc1xuICAgICAgICAuc3RhdHVzKDQwMClcbiAgICAgICAgLmpzb24oeyBlcnJvcjogXCJJbnZhbGlkIGFtb3VudFBLUjogbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlclwiIH0pO1xuICAgIH1cblxuICAgIGlmICghaXNGaW5pdGUocHJpY2UpIHx8IHByaWNlIDw9IDApIHtcbiAgICAgIHJldHVybiByZXNcbiAgICAgICAgLnN0YXR1cyg0MDApXG4gICAgICAgIC5qc29uKHsgZXJyb3I6IFwiSW52YWxpZCBwcmljZVBLUlBlclF1b3RlOiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyXCIgfSk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIG9yZGVyXG4gICAgY29uc3QgaWQgPSBnZW5lcmF0ZUlkKFwib3JkZXJcIik7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblxuICAgIGNvbnN0IG9yZGVyOiBPcmRlciA9IHtcbiAgICAgIGlkLFxuICAgICAgc2lkZTogc2lkZSBhcyBcImJ1eVwiIHwgXCJzZWxsXCIsXG4gICAgICBhbW91bnRQS1I6IGFtb3VudCxcbiAgICAgIHF1b3RlQXNzZXQsXG4gICAgICBwcmljZVBLUlBlclF1b3RlOiBwcmljZSxcbiAgICAgIHBheW1lbnRNZXRob2QsXG4gICAgICByb29tSWQsXG4gICAgICBjcmVhdGVkQnk6IGNyZWF0ZWRCeSB8fCBcImFkbWluXCIsXG4gICAgICBjcmVhdGVkQXQ6IG5vdyxcbiAgICAgIGFjY291bnROYW1lLFxuICAgICAgYWNjb3VudE51bWJlcixcbiAgICAgIHdhbGxldEFkZHJlc3MsXG4gICAgfTtcblxuICAgIG9yZGVyc1N0b3JlLnNldChpZCwgb3JkZXIpO1xuXG4gICAgcmVzLnN0YXR1cygyMDEpLmpzb24oeyBvcmRlciB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiQ3JlYXRlIG9yZGVyIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gY3JlYXRlIG9yZGVyXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVHZXRPcmRlcjogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IG9yZGVySWQgfSA9IHJlcS5wYXJhbXM7XG5cbiAgICBjb25zdCBvcmRlciA9IG9yZGVyc1N0b3JlLmdldChvcmRlcklkKTtcblxuICAgIGlmICghb3JkZXIpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiBcIk9yZGVyIG5vdCBmb3VuZFwiIH0pO1xuICAgIH1cblxuICAgIHJlcy5qc29uKHsgb3JkZXIgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkdldCBvcmRlciBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGdldCBvcmRlclwiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlVXBkYXRlT3JkZXI6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBvcmRlcklkIH0gPSByZXEucGFyYW1zO1xuXG4gICAgLy8gVmFsaWRhdGUgYXV0aG9yaXphdGlvblxuICAgIGNvbnN0IGF1dGhIZWFkZXIgPSByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uO1xuICAgIGNvbnN0IHRva2VuID0gYXV0aEhlYWRlcj8ucmVwbGFjZShcIkJlYXJlciBcIiwgXCJcIik7XG5cbiAgICBpZiAoIXRva2VuIHx8ICF2YWxpZGF0ZUFkbWluVG9rZW4odG9rZW4pKSB7XG4gICAgICByZXR1cm4gcmVzXG4gICAgICAgIC5zdGF0dXMoNDAxKVxuICAgICAgICAuanNvbih7IGVycm9yOiBcIlVuYXV0aG9yaXplZDogaW52YWxpZCBvciBtaXNzaW5nIGFkbWluIHRva2VuXCIgfSk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3JkZXIgPSBvcmRlcnNTdG9yZS5nZXQob3JkZXJJZCk7XG5cbiAgICBpZiAoIW9yZGVyKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJPcmRlciBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1cGRhdGVkOiBPcmRlciA9IHtcbiAgICAgIC4uLm9yZGVyLFxuICAgICAgLi4ucmVxLmJvZHksXG4gICAgICBpZDogb3JkZXIuaWQsXG4gICAgICBjcmVhdGVkQXQ6IG9yZGVyLmNyZWF0ZWRBdCxcbiAgICB9O1xuXG4gICAgb3JkZXJzU3RvcmUuc2V0KG9yZGVySWQsIHVwZGF0ZWQpO1xuICAgIHJlcy5qc29uKHsgb3JkZXI6IHVwZGF0ZWQgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIlVwZGF0ZSBvcmRlciBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIHVwZGF0ZSBvcmRlclwiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlRGVsZXRlT3JkZXI6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBvcmRlcklkIH0gPSByZXEucGFyYW1zO1xuXG4gICAgLy8gVmFsaWRhdGUgYXV0aG9yaXphdGlvblxuICAgIGNvbnN0IGF1dGhIZWFkZXIgPSByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uO1xuICAgIGNvbnN0IHRva2VuID0gYXV0aEhlYWRlcj8ucmVwbGFjZShcIkJlYXJlciBcIiwgXCJcIik7XG5cbiAgICBpZiAoIXRva2VuIHx8ICF2YWxpZGF0ZUFkbWluVG9rZW4odG9rZW4pKSB7XG4gICAgICByZXR1cm4gcmVzXG4gICAgICAgIC5zdGF0dXMoNDAxKVxuICAgICAgICAuanNvbih7IGVycm9yOiBcIlVuYXV0aG9yaXplZDogaW52YWxpZCBvciBtaXNzaW5nIGFkbWluIHRva2VuXCIgfSk7XG4gICAgfVxuXG4gICAgaWYgKCFvcmRlcnNTdG9yZS5oYXMob3JkZXJJZCkpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiBcIk9yZGVyIG5vdCBmb3VuZFwiIH0pO1xuICAgIH1cblxuICAgIG9yZGVyc1N0b3JlLmRlbGV0ZShvcmRlcklkKTtcbiAgICByZXMuanNvbih7IG9rOiB0cnVlIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJEZWxldGUgb3JkZXIgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBkZWxldGUgb3JkZXJcIiB9KTtcbiAgfVxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Jvb3QvYXBwL2NvZGUvc2VydmVyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvcm9vdC9hcHAvY29kZS9zZXJ2ZXIvaW5kZXgudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Jvb3QvYXBwL2NvZGUvc2VydmVyL2luZGV4LnRzXCI7aW1wb3J0IGV4cHJlc3MgZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBjb3JzIGZyb20gXCJjb3JzXCI7XG5pbXBvcnQgeyBoYW5kbGVTb2xhbmFScGMgfSBmcm9tIFwiLi9yb3V0ZXMvc29sYW5hLXByb3h5XCI7XG5pbXBvcnQgeyBoYW5kbGVXYWxsZXRCYWxhbmNlIH0gZnJvbSBcIi4vcm91dGVzL3dhbGxldC1iYWxhbmNlXCI7XG5pbXBvcnQgeyBoYW5kbGVFeGNoYW5nZVJhdGUgfSBmcm9tIFwiLi9yb3V0ZXMvZXhjaGFuZ2UtcmF0ZVwiO1xuaW1wb3J0IHtcbiAgaGFuZGxlRGV4c2NyZWVuZXJUb2tlbnMsXG4gIGhhbmRsZURleHNjcmVlbmVyU2VhcmNoLFxuICBoYW5kbGVEZXhzY3JlZW5lclRyZW5kaW5nLFxufSBmcm9tIFwiLi9yb3V0ZXMvZGV4c2NyZWVuZXItcHJveHlcIjtcbmltcG9ydCB7XG4gIGhhbmRsZUNvaW5NYXJrZXRDYXBRdW90ZXMsXG4gIGhhbmRsZUNvaW5NYXJrZXRDYXBTZWFyY2gsXG59IGZyb20gXCIuL3JvdXRlcy9jb2lubWFya2V0Y2FwLXByb3h5XCI7XG5pbXBvcnQge1xuICBoYW5kbGVKdXBpdGVyUHJpY2UsXG4gIGhhbmRsZUp1cGl0ZXJRdW90ZSxcbiAgaGFuZGxlSnVwaXRlclN3YXAsXG4gIGhhbmRsZUp1cGl0ZXJUb2tlbnMsXG59IGZyb20gXCIuL3JvdXRlcy9qdXBpdGVyLXByb3h5XCI7XG5pbXBvcnQgeyBoYW5kbGVGb3JleFJhdGUgfSBmcm9tIFwiLi9yb3V0ZXMvZm9yZXgtcmF0ZVwiO1xuaW1wb3J0IHsgaGFuZGxlU3RhYmxlMjRoIH0gZnJvbSBcIi4vcm91dGVzL3N0YWJsZS0yNGhcIjtcbmltcG9ydCB7IGhhbmRsZURleFRvb2xzUHJpY2UgfSBmcm9tIFwiLi9yb3V0ZXMvZGV4dG9vbHMtcHJveHlcIjtcbmltcG9ydCB7XG4gIGhhbmRsZUxpc3RUcmFkZVJvb21zLFxuICBoYW5kbGVDcmVhdGVUcmFkZVJvb20sXG4gIGhhbmRsZUdldFRyYWRlUm9vbSxcbiAgaGFuZGxlVXBkYXRlVHJhZGVSb29tLFxuICBoYW5kbGVMaXN0VHJhZGVNZXNzYWdlcyxcbiAgaGFuZGxlQWRkVHJhZGVNZXNzYWdlLFxufSBmcm9tIFwiLi9yb3V0ZXMvcDJwLW9yZGVyc1wiO1xuaW1wb3J0IHtcbiAgaGFuZGxlTGlzdE9yZGVycyxcbiAgaGFuZGxlQ3JlYXRlT3JkZXIsXG4gIGhhbmRsZUdldE9yZGVyLFxuICBoYW5kbGVVcGRhdGVPcmRlcixcbiAgaGFuZGxlRGVsZXRlT3JkZXIsXG59IGZyb20gXCIuL3JvdXRlcy9vcmRlcnNcIjtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVNlcnZlcigpOiBQcm9taXNlPGV4cHJlc3MuQXBwbGljYXRpb24+IHtcbiAgY29uc3QgYXBwID0gZXhwcmVzcygpO1xuXG4gIC8vIE1pZGRsZXdhcmVcbiAgYXBwLnVzZShjb3JzKCkpO1xuICBhcHAudXNlKGV4cHJlc3MuanNvbigpKTtcblxuICAvLyBEZXhTY3JlZW5lciByb3V0ZXNcbiAgYXBwLmdldChcIi9hcGkvZGV4c2NyZWVuZXIvdG9rZW5zXCIsIGhhbmRsZURleHNjcmVlbmVyVG9rZW5zKTtcbiAgYXBwLmdldChcIi9hcGkvZGV4c2NyZWVuZXIvc2VhcmNoXCIsIGhhbmRsZURleHNjcmVlbmVyU2VhcmNoKTtcbiAgYXBwLmdldChcIi9hcGkvZGV4c2NyZWVuZXIvdHJlbmRpbmdcIiwgaGFuZGxlRGV4c2NyZWVuZXJUcmVuZGluZyk7XG5cbiAgLy8gQ29pbk1hcmtldENhcCByb3V0ZXNcbiAgYXBwLmdldChcIi9hcGkvY29pbm1hcmtldGNhcC9xdW90ZXNcIiwgaGFuZGxlQ29pbk1hcmtldENhcFF1b3Rlcyk7XG4gIGFwcC5nZXQoXCIvYXBpL2NvaW5tYXJrZXRjYXAvc2VhcmNoXCIsIGhhbmRsZUNvaW5NYXJrZXRDYXBTZWFyY2gpO1xuXG4gIC8vIERleFRvb2xzIHJvdXRlc1xuICBhcHAuZ2V0KFwiL2FwaS9kZXh0b29scy9wcmljZVwiLCBoYW5kbGVEZXhUb29sc1ByaWNlKTtcblxuICAvLyBKdXBpdGVyIHJvdXRlc1xuICBhcHAuZ2V0KFwiL2FwaS9qdXBpdGVyL3ByaWNlXCIsIGhhbmRsZUp1cGl0ZXJQcmljZSk7XG4gIGFwcC5nZXQoXCIvYXBpL2p1cGl0ZXIvcXVvdGVcIiwgaGFuZGxlSnVwaXRlclF1b3RlKTtcbiAgYXBwLnBvc3QoXCIvYXBpL2p1cGl0ZXIvc3dhcFwiLCBoYW5kbGVKdXBpdGVyU3dhcCk7XG4gIGFwcC5nZXQoXCIvYXBpL2p1cGl0ZXIvdG9rZW5zXCIsIGhhbmRsZUp1cGl0ZXJUb2tlbnMpO1xuXG4gIC8vIFNvbGFuYSBSUEMgcHJveHlcbiAgYXBwLnBvc3QoXCIvYXBpL3NvbGFuYS1ycGNcIiwgaGFuZGxlU29sYW5hUnBjKTtcblxuICAvLyBXYWxsZXQgcm91dGVzXG4gIGFwcC5nZXQoXCIvYXBpL3dhbGxldC9iYWxhbmNlXCIsIGhhbmRsZVdhbGxldEJhbGFuY2UpO1xuXG4gIC8vIFB1bXBmdW4gcHJveHkgKHF1b3RlICYgc3dhcClcbiAgYXBwLmFsbChbXCIvYXBpL3B1bXBmdW4vcXVvdGVcIiwgXCIvYXBpL3B1bXBmdW4vc3dhcFwiXSwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHBhdGggPSByZXEucGF0aC5yZXBsYWNlKFwiL2FwaS9wdW1wZnVuXCIsIFwiXCIpO1xuICAgICAgLy8gL3F1b3RlIG9yIC9zd2FwXG4gICAgICBpZiAocGF0aCA9PT0gXCIvL3F1b3RlXCIgfHwgcGF0aCA9PT0gXCIvcXVvdGVcIikge1xuICAgICAgICAvLyBBY2NlcHQgUE9TVCB3aXRoIEpTT04gYm9keSBvciBHRVQgd2l0aCBxdWVyeSBwYXJhbXNcbiAgICAgICAgY29uc3QgbWV0aG9kID0gcmVxLm1ldGhvZC50b1VwcGVyQ2FzZSgpO1xuICAgICAgICBsZXQgaW5wdXRNaW50ID0gXCJcIjtcbiAgICAgICAgbGV0IG91dHB1dE1pbnQgPSBcIlwiO1xuICAgICAgICBsZXQgYW1vdW50ID0gXCJcIjtcblxuICAgICAgICBpZiAobWV0aG9kID09PSBcIlBPU1RcIikge1xuICAgICAgICAgIGNvbnN0IGJvZHkgPSByZXEuYm9keSB8fCB7fTtcbiAgICAgICAgICBpbnB1dE1pbnQgPSBib2R5LmlucHV0TWludCB8fCBib2R5LmlucHV0X21pbnQgfHwgXCJcIjtcbiAgICAgICAgICBvdXRwdXRNaW50ID0gYm9keS5vdXRwdXRNaW50IHx8IGJvZHkub3V0cHV0X21pbnQgfHwgXCJcIjtcbiAgICAgICAgICBhbW91bnQgPSBib2R5LmFtb3VudCB8fCBcIlwiO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlucHV0TWludCA9IFN0cmluZyhyZXEucXVlcnkuaW5wdXRNaW50IHx8IHJlcS5xdWVyeS5pbnB1dF9taW50IHx8IFwiXCIpO1xuICAgICAgICAgIG91dHB1dE1pbnQgPSBTdHJpbmcoXG4gICAgICAgICAgICByZXEucXVlcnkub3V0cHV0TWludCB8fCByZXEucXVlcnkub3V0cHV0X21pbnQgfHwgXCJcIixcbiAgICAgICAgICApO1xuICAgICAgICAgIGFtb3VudCA9IFN0cmluZyhyZXEucXVlcnkuYW1vdW50IHx8IFwiXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpbnB1dE1pbnQgfHwgIW91dHB1dE1pbnQgfHwgIWFtb3VudCkge1xuICAgICAgICAgIHJldHVybiByZXNcbiAgICAgICAgICAgIC5zdGF0dXMoNDAwKVxuICAgICAgICAgICAgLmpzb24oe1xuICAgICAgICAgICAgICBlcnJvcjpcbiAgICAgICAgICAgICAgICBcIk1pc3NpbmcgcmVxdWlyZWQgcGFyYW1ldGVyczogaW5wdXRNaW50LCBvdXRwdXRNaW50LCBhbW91bnRcIixcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdXJsID0gYGh0dHBzOi8vYXBpLnB1bXBmdW4uY29tL2FwaS92MS9xdW90ZT9pbnB1dF9taW50PSR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICAgICAgICAgIGlucHV0TWludCxcbiAgICAgICAgKX0mb3V0cHV0X21pbnQ9JHtlbmNvZGVVUklDb21wb25lbnQob3V0cHV0TWludCl9JmFtb3VudD0ke2VuY29kZVVSSUNvbXBvbmVudChhbW91bnQpfWA7XG5cbiAgICAgICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgICAgY29uc3QgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCAxMDAwMCk7XG4gICAgICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgICAgICBoZWFkZXJzOiB7IEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSxcbiAgICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgICB9KTtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICBpZiAoIXJlc3Aub2spXG4gICAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMocmVzcC5zdGF0dXMpLmpzb24oeyBlcnJvcjogXCJQdW1wZnVuIEFQSSBlcnJvclwiIH0pO1xuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcC5qc29uKCk7XG4gICAgICAgIHJldHVybiByZXMuanNvbihkYXRhKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHBhdGggPT09IFwiLy9zd2FwXCIgfHwgcGF0aCA9PT0gXCIvc3dhcFwiKSB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIilcbiAgICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDUpLmpzb24oeyBlcnJvcjogXCJNZXRob2Qgbm90IGFsbG93ZWRcIiB9KTtcbiAgICAgICAgY29uc3QgYm9keSA9IHJlcS5ib2R5IHx8IHt9O1xuICAgICAgICBjb25zdCByZXNwID0gYXdhaXQgZmV0Y2goXCJodHRwczovL2FwaS5wdW1wZnVuLmNvbS9hcGkvdjEvc3dhcFwiLCB7XG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSksXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIXJlc3Aub2spXG4gICAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMocmVzcC5zdGF0dXMpLmpzb24oeyBlcnJvcjogXCJQdW1wZnVuIHN3YXAgZmFpbGVkXCIgfSk7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwLmpzb24oKTtcbiAgICAgICAgcmV0dXJuIHJlcy5qc29uKGRhdGEpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJQdW1wZnVuIHByb3h5IHBhdGggbm90IGZvdW5kXCIgfSk7XG4gICAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgICByZXR1cm4gcmVzXG4gICAgICAgIC5zdGF0dXMoNTAyKVxuICAgICAgICAuanNvbih7XG4gICAgICAgICAgZXJyb3I6IFwiRmFpbGVkIHRvIHByb3h5IFB1bXBmdW4gcmVxdWVzdFwiLFxuICAgICAgICAgIGRldGFpbHM6IGU/Lm1lc3NhZ2UgfHwgU3RyaW5nKGUpLFxuICAgICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIFRva2VuIHByaWNlIGVuZHBvaW50IChzaW1wbGUsIHJvYnVzdCBmYWxsYmFjayArIHN0YWJsZWNvaW5zKVxuICBhcHAuZ2V0KFwiL2FwaS90b2tlbi9wcmljZVwiLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdG9rZW5QYXJhbSA9IFN0cmluZyhcbiAgICAgICAgcmVxLnF1ZXJ5LnRva2VuIHx8IHJlcS5xdWVyeS5zeW1ib2wgfHwgXCJGSVhFUkNPSU5cIixcbiAgICAgICkudG9VcHBlckNhc2UoKTtcbiAgICAgIGNvbnN0IG1pbnRQYXJhbSA9IFN0cmluZyhyZXEucXVlcnkubWludCB8fCBcIlwiKTtcblxuICAgICAgY29uc3QgRkFMTEJBQ0tfVVNEOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge1xuICAgICAgICBGSVhFUkNPSU46IDAuMDA1LFxuICAgICAgICBTT0w6IDE4MCxcbiAgICAgICAgVVNEQzogMS4wLFxuICAgICAgICBVU0RUOiAxLjAsXG4gICAgICAgIExPQ0tFUjogMC4xLFxuICAgICAgfTtcblxuICAgICAgLy8gSWYgc3RhYmxlY29pbnMgb3Iga25vd24gc3ltYm9scywgcmV0dXJuIGRldGVybWluaXN0aWMgcHJpY2VzXG4gICAgICBpZiAodG9rZW5QYXJhbSA9PT0gXCJVU0RDXCIgfHwgdG9rZW5QYXJhbSA9PT0gXCJVU0RUXCIpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5qc29uKHsgdG9rZW46IHRva2VuUGFyYW0sIHByaWNlVXNkOiAxLjAgfSk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0b2tlblBhcmFtID09PSBcIlNPTFwiKVxuICAgICAgICByZXR1cm4gcmVzLmpzb24oeyB0b2tlbjogXCJTT0xcIiwgcHJpY2VVc2Q6IEZBTExCQUNLX1VTRC5TT0wgfSk7XG4gICAgICBpZiAodG9rZW5QYXJhbSA9PT0gXCJGSVhFUkNPSU5cIilcbiAgICAgICAgcmV0dXJuIHJlcy5qc29uKHtcbiAgICAgICAgICB0b2tlbjogXCJGSVhFUkNPSU5cIixcbiAgICAgICAgICBwcmljZVVzZDogRkFMTEJBQ0tfVVNELkZJWEVSQ09JTixcbiAgICAgICAgfSk7XG4gICAgICBpZiAodG9rZW5QYXJhbSA9PT0gXCJMT0NLRVJcIilcbiAgICAgICAgcmV0dXJuIHJlcy5qc29uKHsgdG9rZW46IFwiTE9DS0VSXCIsIHByaWNlVXNkOiBGQUxMQkFDS19VU0QuTE9DS0VSIH0pO1xuXG4gICAgICAvLyBJZiBtaW50IHByb3ZpZGVkIHRoYXQgbWF0Y2hlcyBrbm93biBtaW50cywgbWFwIHRvIGZhbGxiYWNrXG4gICAgICBjb25zdCBUT0tFTl9NSU5UUzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICAgU09MOiBcIlNvMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTJcIixcbiAgICAgICAgVVNEQzogXCJFUGpGV2RkNUF1ZnFTU3FlTTJxTjF4enliYXBDOEc0d0VHR2tad3lURHQxdlwiLFxuICAgICAgICBVU0RUOiBcIkVzOXZNRnJ6YUNFUm1KZnJGNEgyRllENEtDb05rWTExTWNDZThCZW5FbnNcIixcbiAgICAgICAgRklYRVJDT0lOOiBcIkg0cUtuOEZNRmhhOGpKdWo4eE1yeU1xUmhIM2g3R2pMdXh3N1RWaXhwdW1wXCIsXG4gICAgICAgIExPQ0tFUjogXCJFTjFuWXJXNjM3NXpNUFVrcGtHeUdTRVhXOFdtQXFZdTR5aGY2eG5HcHVtcFwiLFxuICAgICAgfTtcblxuICAgICAgbGV0IHRva2VuID0gdG9rZW5QYXJhbTtcbiAgICAgIGxldCBtaW50ID0gbWludFBhcmFtIHx8IFRPS0VOX01JTlRTW3Rva2VuXSB8fCBcIlwiO1xuXG4gICAgICBpZiAoIW1pbnQgJiYgdG9rZW5QYXJhbSAmJiB0b2tlblBhcmFtLmxlbmd0aCA+IDQwKSB7XG4gICAgICAgIG1pbnQgPSB0b2tlblBhcmFtO1xuICAgICAgICBjb25zdCBpbnYgPSBPYmplY3QuZW50cmllcyhUT0tFTl9NSU5UUykuZmluZCgoWywgbV0pID0+IG0gPT09IG1pbnQpO1xuICAgICAgICBpZiAoaW52KSB0b2tlbiA9IGludlswXTtcbiAgICAgIH1cblxuICAgICAgLy8gQXMgYSByb2J1c3QgZmFsbGJhY2ssIGlmIHdlIGNvdWxkbid0IHJlc29sdmUsIHJldHVybiBmYWxsYmFjayBVU0Qgd2hlbiBhdmFpbGFibGVcbiAgICAgIGNvbnN0IGZhbGxiYWNrID0gRkFMTEJBQ0tfVVNEW3Rva2VuXSA/PyBudWxsO1xuICAgICAgaWYgKGZhbGxiYWNrICE9PSBudWxsKSByZXR1cm4gcmVzLmpzb24oeyB0b2tlbiwgcHJpY2VVc2Q6IGZhbGxiYWNrIH0pO1xuXG4gICAgICAvLyBMYXN0IHJlc29ydFxuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6IFwiVG9rZW4gcHJpY2Ugbm90IGF2YWlsYWJsZVwiIH0pO1xuICAgIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgICAgcmV0dXJuIHJlc1xuICAgICAgICAuc3RhdHVzKDUwMilcbiAgICAgICAgLmpzb24oe1xuICAgICAgICAgIGVycm9yOiBcIkZhaWxlZCB0byBmZXRjaCB0b2tlbiBwcmljZVwiLFxuICAgICAgICAgIGRldGFpbHM6IGU/Lm1lc3NhZ2UgfHwgU3RyaW5nKGUpLFxuICAgICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIEV4Y2hhbmdlIHJhdGUgcm91dGVzXG4gIGFwcC5nZXQoXCIvYXBpL2V4Y2hhbmdlLXJhdGVcIiwgaGFuZGxlRXhjaGFuZ2VSYXRlKTtcbiAgYXBwLmdldChcIi9hcGkvZm9yZXgvcmF0ZVwiLCBoYW5kbGVGb3JleFJhdGUpO1xuICBhcHAuZ2V0KFwiL2FwaS9zdGFibGUtMjRoXCIsIGhhbmRsZVN0YWJsZTI0aCk7XG5cbiAgLy8gT3JkZXJzIHJvdXRlcyAobmV3IEFQSSlcbiAgYXBwLmdldChcIi9hcGkvb3JkZXJzXCIsIGhhbmRsZUxpc3RPcmRlcnMpO1xuICBhcHAucG9zdChcIi9hcGkvb3JkZXJzXCIsIGhhbmRsZUNyZWF0ZU9yZGVyKTtcbiAgYXBwLmdldChcIi9hcGkvb3JkZXJzLzpvcmRlcklkXCIsIGhhbmRsZUdldE9yZGVyKTtcbiAgYXBwLnB1dChcIi9hcGkvb3JkZXJzLzpvcmRlcklkXCIsIGhhbmRsZVVwZGF0ZU9yZGVyKTtcbiAgYXBwLmRlbGV0ZShcIi9hcGkvb3JkZXJzLzpvcmRlcklkXCIsIGhhbmRsZURlbGV0ZU9yZGVyKTtcblxuICAvLyBQMlAgT3JkZXJzIHJvdXRlcyAobGVnYWN5IEFQSSkgLSBESVNBQkxFRFxuICAvLyBUaGVzZSBsZWdhY3kgZW5kcG9pbnRzIGFyZSBpbnRlbnRpb25hbGx5IGRpc2FibGVkIHRvIHN0b3AgUDJQIG9yZGVyIGhhbmRsaW5nIGZyb20gdGhpcyBzZXR1cC5cbiAgLy8gS2VlcGluZyBleHBsaWNpdCBkaXNhYmxlZCBoYW5kbGVycyBzbyBjYWxsZXJzIHJlY2VpdmUgYSBjbGVhciA0MTAgR29uZSByZXNwb25zZS5cbiAgYXBwLmdldChcIi9hcGkvcDJwL29yZGVyc1wiLCAocmVxLCByZXMpID0+XG4gICAgcmVzXG4gICAgICAuc3RhdHVzKDQxMClcbiAgICAgIC5qc29uKHsgZXJyb3I6IFwiUDJQIG9yZGVycyBBUEkgaXMgZGlzYWJsZWQgb24gdGhpcyBzZXJ2ZXJcIiB9KSxcbiAgKTtcbiAgYXBwLnBvc3QoXCIvYXBpL3AycC9vcmRlcnNcIiwgKHJlcSwgcmVzKSA9PlxuICAgIHJlc1xuICAgICAgLnN0YXR1cyg0MTApXG4gICAgICAuanNvbih7IGVycm9yOiBcIlAyUCBvcmRlcnMgQVBJIGlzIGRpc2FibGVkIG9uIHRoaXMgc2VydmVyXCIgfSksXG4gICk7XG4gIGFwcC5nZXQoXCIvYXBpL3AycC9vcmRlcnMvOm9yZGVySWRcIiwgKHJlcSwgcmVzKSA9PlxuICAgIHJlc1xuICAgICAgLnN0YXR1cyg0MTApXG4gICAgICAuanNvbih7IGVycm9yOiBcIlAyUCBvcmRlcnMgQVBJIGlzIGRpc2FibGVkIG9uIHRoaXMgc2VydmVyXCIgfSksXG4gICk7XG4gIGFwcC5wdXQoXCIvYXBpL3AycC9vcmRlcnMvOm9yZGVySWRcIiwgKHJlcSwgcmVzKSA9PlxuICAgIHJlc1xuICAgICAgLnN0YXR1cyg0MTApXG4gICAgICAuanNvbih7IGVycm9yOiBcIlAyUCBvcmRlcnMgQVBJIGlzIGRpc2FibGVkIG9uIHRoaXMgc2VydmVyXCIgfSksXG4gICk7XG4gIGFwcC5kZWxldGUoXCIvYXBpL3AycC9vcmRlcnMvOm9yZGVySWRcIiwgKHJlcSwgcmVzKSA9PlxuICAgIHJlc1xuICAgICAgLnN0YXR1cyg0MTApXG4gICAgICAuanNvbih7IGVycm9yOiBcIlAyUCBvcmRlcnMgQVBJIGlzIGRpc2FibGVkIG9uIHRoaXMgc2VydmVyXCIgfSksXG4gICk7XG5cbiAgLy8gVHJhZGUgUm9vbXMgcm91dGVzXG4gIGFwcC5nZXQoXCIvYXBpL3AycC9yb29tc1wiLCBoYW5kbGVMaXN0VHJhZGVSb29tcyk7XG4gIGFwcC5wb3N0KFwiL2FwaS9wMnAvcm9vbXNcIiwgaGFuZGxlQ3JlYXRlVHJhZGVSb29tKTtcbiAgYXBwLmdldChcIi9hcGkvcDJwL3Jvb21zLzpyb29tSWRcIiwgaGFuZGxlR2V0VHJhZGVSb29tKTtcbiAgYXBwLnB1dChcIi9hcGkvcDJwL3Jvb21zLzpyb29tSWRcIiwgaGFuZGxlVXBkYXRlVHJhZGVSb29tKTtcblxuICAvLyBUcmFkZSBNZXNzYWdlcyByb3V0ZXNcbiAgYXBwLmdldChcIi9hcGkvcDJwL3Jvb21zLzpyb29tSWQvbWVzc2FnZXNcIiwgaGFuZGxlTGlzdFRyYWRlTWVzc2FnZXMpO1xuICBhcHAucG9zdChcIi9hcGkvcDJwL3Jvb21zLzpyb29tSWQvbWVzc2FnZXNcIiwgaGFuZGxlQWRkVHJhZGVNZXNzYWdlKTtcblxuICAvLyBIZWFsdGggY2hlY2tcbiAgYXBwLmdldChcIi9oZWFsdGhcIiwgKHJlcSwgcmVzKSA9PiB7XG4gICAgcmVzLmpzb24oeyBzdGF0dXM6IFwib2tcIiwgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkgfSk7XG4gIH0pO1xuXG4gIC8vIDQwNCBoYW5kbGVyXG4gIGFwcC51c2UoKHJlcSwgcmVzKSA9PiB7XG4gICAgcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJBUEkgZW5kcG9pbnQgbm90IGZvdW5kXCIsIHBhdGg6IHJlcS5wYXRoIH0pO1xuICB9KTtcblxuICByZXR1cm4gYXBwO1xufVxuXG4vLyBDbG91ZGZsYXJlIFdvcmtlcnMgY29tcGF0aWJpbGl0eSBleHBvcnRcbmV4cG9ydCBkZWZhdWx0IHtcbiAgYXN5bmMgZmV0Y2gocmVxOiBSZXF1ZXN0KTogUHJvbWlzZTxSZXNwb25zZT4ge1xuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwocmVxLnVybCk7XG5cbiAgICBpZiAodXJsLnBhdGhuYW1lLnN0YXJ0c1dpdGgoXCIvYXBpL3NvbGFuYS1ycGNcIikpIHtcbiAgICAgIHJldHVybiBhd2FpdCBoYW5kbGVTb2xhbmFScGMocmVxIGFzIGFueSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShcIldhbGxldCBiYWNrZW5kIGFjdGl2ZVwiLCB7IHN0YXR1czogMjAwIH0pO1xuICB9LFxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Jvb3QvYXBwL2NvZGVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3ZpdGUuY29uZmlnLm1qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vcm9vdC9hcHAvY29kZS92aXRlLmNvbmZpZy5tanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tIFwidXJsXCI7XG5pbXBvcnQgeyBXZWJTb2NrZXRTZXJ2ZXIgfSBmcm9tIFwid3NcIjtcblxuY29uc3QgX19kaXJuYW1lID0gcGF0aC5kaXJuYW1lKGZpbGVVUkxUb1BhdGgobmV3IFVSTChpbXBvcnQubWV0YS51cmwpKSk7XG5cbmxldCBhcGlTZXJ2ZXIgPSBudWxsO1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGJhc2U6IFwiLi9cIixcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAge1xuICAgICAgbmFtZTogXCJleHByZXNzLXNlcnZlclwiLFxuICAgICAgYXBwbHk6IFwic2VydmVcIixcbiAgICAgIGFzeW5jIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgICAgLy8gTG9hZCBhbmQgaW5pdGlhbGl6ZSB0aGUgRXhwcmVzcyBzZXJ2ZXJcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB7IGNyZWF0ZVNlcnZlcjogY3JlYXRlRXhwcmVzc1NlcnZlciB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICAgXCIuL3NlcnZlci9pbmRleC50c1wiXG4gICAgICAgICAgKTtcbiAgICAgICAgICBhcGlTZXJ2ZXIgPSBhd2FpdCBjcmVhdGVFeHByZXNzU2VydmVyKCk7XG4gICAgICAgICAgY29uc29sZS5sb2coXCJbVml0ZV0gXHUyNzA1IEV4cHJlc3Mgc2VydmVyIGluaXRpYWxpemVkXCIpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKFwiW1ZpdGVdIFx1Mjc0QyBGYWlsZWQgdG8gaW5pdGlhbGl6ZSBFeHByZXNzOlwiLCBlcnIpO1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlZ2lzdGVyIG1pZGRsZXdhcmUgQkVGT1JFIG90aGVyIG1pZGRsZXdhcmVcbiAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICAgICAgICAvLyBPbmx5IGhhbmRsZSAvYXBpIGFuZCAvaGVhbHRoIHJlcXVlc3RzIHdpdGggdGhlIEV4cHJlc3MgYXBwXG4gICAgICAgICAgaWYgKHJlcS51cmwuc3RhcnRzV2l0aChcIi9hcGlcIikgfHwgcmVxLnVybCA9PT0gXCIvaGVhbHRoXCIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgICBgW1ZpdGUgTWlkZGxld2FyZV0gUm91dGluZyAke3JlcS5tZXRob2R9ICR7cmVxLnVybH0gdG8gRXhwcmVzc2AsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIGFwaVNlcnZlcihyZXEsIHJlcywgbmV4dCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gTGlnaHR3ZWlnaHQgaW4tbWVtb3J5IFdlYlNvY2tldCByb29tcyBhdCAvd3MvOnJvb21JZCBmb3IgZGV2XG4gICAgICAgIGNvbnN0IHdzcyA9IG5ldyBXZWJTb2NrZXRTZXJ2ZXIoeyBub1NlcnZlcjogdHJ1ZSB9KTtcbiAgICAgICAgY29uc3Qgcm9vbXMgPSBuZXcgTWFwKCk7IC8vIHJvb21JZCAtPiBTZXQ8V2ViU29ja2V0PlxuXG4gICAgICAgIHNlcnZlci5odHRwU2VydmVyPy5vbihcInVwZ3JhZGVcIiwgKHJlcXVlc3QsIHNvY2tldCwgaGVhZCkgPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB1cmwgPSByZXF1ZXN0LnVybCB8fCBcIlwiO1xuICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSB1cmwubWF0Y2goL15cXC93c1xcLyguKykkLyk7XG4gICAgICAgICAgICBpZiAoIW1hdGNoKSByZXR1cm47IC8vIG5vdCBvdXIgV1Mgcm91dGVcblxuICAgICAgICAgICAgd3NzLmhhbmRsZVVwZ3JhZGUocmVxdWVzdCwgc29ja2V0LCBoZWFkLCAod3MpID0+IHtcbiAgICAgICAgICAgICAgY29uc3Qgcm9vbUlkID0gZGVjb2RlVVJJQ29tcG9uZW50KG1hdGNoWzFdKTtcbiAgICAgICAgICAgICAgaWYgKCFyb29tcy5oYXMocm9vbUlkKSkgcm9vbXMuc2V0KHJvb21JZCwgbmV3IFNldCgpKTtcbiAgICAgICAgICAgICAgY29uc3Qgc2V0ID0gcm9vbXMuZ2V0KHJvb21JZCk7XG4gICAgICAgICAgICAgIHNldC5hZGQod3MpO1xuXG4gICAgICAgICAgICAgIHdzLm9uKFwibWVzc2FnZVwiLCAoZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBtc2c7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIG1zZyA9IEpTT04ucGFyc2UoZGF0YS50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG1zZyAmJiBtc2cudHlwZSA9PT0gXCJjaGF0XCIpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIGtpbmQ6IFwiY2hhdFwiLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgICAgaWQ6IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpLFxuICAgICAgICAgICAgICAgICAgICAgIHRleHQ6IFN0cmluZyhtc2cudGV4dCB8fCBcIlwiKSxcbiAgICAgICAgICAgICAgICAgICAgICBhdDogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBjbGllbnQgb2Ygc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgY2xpZW50LnNlbmQocGF5bG9hZCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1zZyAmJiBtc2cua2luZCA9PT0gXCJub3RpZmljYXRpb25cIikge1xuICAgICAgICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAga2luZDogXCJub3RpZmljYXRpb25cIixcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogbXNnLmRhdGEsXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY2xpZW50IG9mIHNldCkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgIGNsaWVudC5zZW5kKHBheWxvYWQpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHt9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtc2cgJiYgbXNnLnR5cGUgPT09IFwicGluZ1wiKSB7XG4gICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB3cy5zZW5kKEpTT04uc3RyaW5naWZ5KHsga2luZDogXCJwb25nXCIsIHRzOiBEYXRlLm5vdygpIH0pKTtcbiAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgIHdzLm9uKFwiY2xvc2VcIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHNldC5kZWxldGUod3MpO1xuICAgICAgICAgICAgICAgIGlmIChzZXQuc2l6ZSA9PT0gMCkgcm9vbXMuZGVsZXRlKHJvb21JZCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gaWdub3JlIHdzIGVycm9yc1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gRG9uJ3QgcmV0dXJuIGFueXRoaW5nIC0gbWlkZGxld2FyZSBpcyBhbHJlYWR5IHJlZ2lzdGVyZWRcbiAgICAgIH0sXG4gICAgfSxcbiAgXSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6IFwiZGlzdC9zcGFcIixcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgfSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJjbGllbnRcIiksXG4gICAgICBcIkBzaGFyZWRcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJzaGFyZWRcIiksXG4gICAgICBcIkB1dGlsc1wiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcInV0aWxzXCIpLFxuICAgIH0sXG4gIH0sXG59O1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFBQSxJQUVNLGVBZ0JPO0FBbEJiO0FBQUE7QUFFQSxJQUFNLGdCQUFnQjtBQUFBO0FBQUEsTUFFcEIsUUFBUSxJQUFJLGtCQUFrQjtBQUFBO0FBQUEsTUFFOUIsUUFBUSxJQUFJLG1CQUFtQjtBQUFBLE1BQy9CLFFBQVEsSUFBSSxrQkFBa0I7QUFBQSxNQUM5QixRQUFRLElBQUksbUJBQW1CO0FBQUEsTUFDL0IsUUFBUSxJQUFJLGlCQUNSLDJDQUEyQyxRQUFRLElBQUksY0FBYyxLQUNyRTtBQUFBO0FBQUEsTUFFSjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRixFQUFFLE9BQU8sT0FBTztBQUVULElBQU0sa0JBQWtDLE9BQU8sS0FBSyxRQUFRO0FBQ2pFLFVBQUk7QUFDRixjQUFNLE9BQU8sSUFBSTtBQUVqQixZQUFJLENBQUMsTUFBTTtBQUNULGlCQUFPLElBQUksT0FBTyxHQUFHLEVBQUUsS0FBSztBQUFBLFlBQzFCLE9BQU87QUFBQSxVQUNULENBQUM7QUFBQSxRQUNIO0FBRUEsY0FBTSxTQUFTLEtBQUssVUFBVTtBQUM5QixnQkFBUTtBQUFBLFVBQ04sZUFB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QUk7QUFBQSxrQkFDWixDQUFDO0FBQ0QsNkJBQVcsVUFBVSxLQUFLO0FBQ3hCLHdCQUFJO0FBQ0YsNkJBQU8sS0FBSyxPQUFPO0FBQUEsb0JBQ3JCLFFBQVE7QUFBQSxvQkFBQztBQUFBLGtCQUNYO0FBQUEsZ0JBQ0YsV0FBVyxPQUFPLElBQUksU0FBUyxRQUFRO0FBQ3JDLHNCQUFJO0FBQ0YsdUJBQUcsS0FBSyxLQUFLLFVBQVUsRUFBRSxNQUFNLFFBQVEsSUFBSSxLQUFLLElBQUksRUFBRSxDQUFDLENBQUM7QUFBQSxrQkFDMUQsUUFBUTtBQUFBLGtCQUFDO0FBQUEsZ0JBQ1g7QUFBQSxjQUNGLENBQUM7QUFFRCxpQkFBRyxHQUFHLFNBQVMsTUFBTTtBQUNuQixvQkFBSSxPQUFPLEVBQUU7QUFDYixvQkFBSSxJQUFJLFNBQVMsRUFBRyxDQUFBQSxPQUFNLE9BQU8sTUFBTTtBQUFBLGNBQ3pDLENBQUM7QUFBQSxZQUNILENBQUM7QUFBQSxVQUNILFNBQVMsR0FBRztBQUFBLFVBRVo7QUFBQSxRQUNGLENBQUM7QUFBQSxNQUdIO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLGFBQWE7QUFBQSxFQUNmO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxXQUFXLFFBQVE7QUFBQSxNQUNyQyxXQUFXLEtBQUssUUFBUSxXQUFXLFFBQVE7QUFBQSxNQUMzQyxVQUFVLEtBQUssUUFBUSxXQUFXLE9BQU87QUFBQSxJQUMzQztBQUFBLEVBQ0Y7QUFDRjsiLAogICJuYW1lcyI6IFsiUlBDX0VORFBPSU5UUyIsICJNSU5UX1RPX1BBSVJfQUREUkVTUyIsICJNSU5UX1RPX1NFQVJDSF9TWU1CT0wiLCAicGF0aCIsICJjdXJyZW50RW5kcG9pbnRJbmRleCIsICJwYXRoIiwgImdlbmVyYXRlSWQiLCAicGF0aCIsICJUT0tFTl9NSU5UUyIsICJyb29tcyJdCn0K
