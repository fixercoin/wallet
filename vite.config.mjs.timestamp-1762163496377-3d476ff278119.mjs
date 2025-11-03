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

// server/routes/dexscreener-price.ts
var TOKEN_MINTS2, FALLBACK_USD, handleDexscreenerPrice, handleSolPrice, handleTokenPrice;
var init_dexscreener_price = __esm({
  "server/routes/dexscreener-price.ts"() {
    init_dexscreener_proxy();
    TOKEN_MINTS2 = {
      SOL: "So11111111111111111111111111111111111111112",
      USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
      FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
      LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump"
    };
    FALLBACK_USD = {
      FIXERCOIN: 5e-3,
      SOL: 180,
      USDC: 1,
      USDT: 1,
      LOCKER: 0.1
    };
    handleDexscreenerPrice = async (req, res) => {
      try {
        const { token } = req.query;
        if (!token || typeof token !== "string") {
          return res.status(400).json({ error: "Missing 'token' parameter" });
        }
        console.log(`[DexScreener Price] Fetching price for token: ${token}`);
        try {
          const data = await fetchDexscreenerData(`/tokens/${token}`);
          const pair = data?.pairs?.[0];
          if (!pair) {
            return res.status(404).json({ error: "Token not found on DexScreener" });
          }
          return res.json({
            token,
            price: parseFloat(pair.priceUsd || "0"),
            priceUsd: pair.priceUsd,
            data: pair
          });
        } catch (error) {
          console.error(`[DexScreener Price] Fetch error:`, error);
          return res.status(502).json({
            error: "Failed to fetch token price from DexScreener",
            details: error instanceof Error ? error.message : String(error)
          });
        }
      } catch (error) {
        console.error(`[DexScreener Price] Handler error:`, error);
        return res.status(500).json({
          error: "Failed to process price request",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    };
    handleSolPrice = async (req, res) => {
      try {
        const SOL_MINT = "So11111111111111111111111111111111111111112";
        console.log(`[SOL Price] Fetching price for SOL`);
        try {
          const data = await fetchDexscreenerData(`/tokens/${SOL_MINT}`);
          const pair = data?.pairs?.[0];
          if (!pair) {
            return res.status(404).json({ error: "SOL price data not found" });
          }
          const priceUsd = parseFloat(pair.priceUsd || "0");
          return res.json({
            token: "SOL",
            price: priceUsd,
            priceUsd,
            priceChange24h: pair.priceChange?.h24 || 0,
            volume24h: pair.volume?.h24 || 0,
            marketCap: pair.marketCap || 0
          });
        } catch (error) {
          console.error(`[SOL Price] DexScreener fetch error:`, error);
          return res.status(502).json({
            error: "Failed to fetch SOL price",
            details: error instanceof Error ? error.message : String(error)
          });
        }
      } catch (error) {
        console.error(`[SOL Price] Handler error:`, error);
        return res.status(500).json({
          error: "Failed to fetch SOL price",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    };
    handleTokenPrice = async (req, res) => {
      try {
        const tokenParam = (req.query.token || req.query.symbol || "FIXERCOIN").toUpperCase();
        const mintParam = req.query.mint || "";
        console.log(
          `[Token Price] Request for token: ${tokenParam}, mint: ${mintParam}`
        );
        const PKR_PER_USD2 = 280;
        const MARKUP2 = 1.0425;
        let token = tokenParam;
        let mint = mintParam || TOKEN_MINTS2[token] || "";
        if (!mint && tokenParam && tokenParam.length > 40) {
          mint = tokenParam;
          const inv = Object.entries(TOKEN_MINTS2).find(([, m]) => m === mint);
          if (inv) token = inv[0];
        }
        let priceUsd = null;
        try {
          if (token === "USDC" || token === "USDT") {
            priceUsd = 1;
          } else if (mint) {
            const pairAddress = MINT_TO_PAIR_ADDRESS2[mint];
            if (pairAddress) {
              try {
                const pairData = await fetchDexscreenerData(
                  `/pairs/solana/${pairAddress}`
                );
                const pair = pairData?.pair || (pairData?.pairs || [])[0] || null;
                if (pair && pair.priceUsd) {
                  priceUsd = parseFloat(pair.priceUsd);
                }
              } catch (e) {
                console.warn(`[Token Price] Pair address lookup failed:`, e);
              }
            }
            if (priceUsd === null) {
              try {
                const tokenData = await fetchDexscreenerData(`/tokens/${mint}`);
                const pairs = Array.isArray(tokenData?.pairs) ? tokenData.pairs : [];
                let matchingPair = null;
                if (pairs.length > 0) {
                  matchingPair = pairs.find(
                    (p) => p?.baseToken?.address === mint && p?.chainId === "solana"
                  );
                  if (!matchingPair) {
                    matchingPair = pairs.find(
                      (p) => p?.quoteToken?.address === mint && p?.chainId === "solana"
                    );
                  }
                  if (!matchingPair) {
                    matchingPair = pairs.find(
                      (p) => p?.baseToken?.address === mint || p?.quoteToken?.address === mint
                    );
                  }
                  if (matchingPair && matchingPair.priceUsd) {
                    priceUsd = parseFloat(matchingPair.priceUsd);
                  }
                }
              } catch (e) {
                console.warn(`[Token Price] Token lookup failed:`, e);
              }
            }
          }
        } catch (e) {
          console.warn(`[Token Price] Price lookup error:`, e);
        }
        if (priceUsd === null || !isFinite(priceUsd) || priceUsd <= 0) {
          priceUsd = FALLBACK_USD[token] ?? FALLBACK_USD.FIXERCOIN;
        }
        const rateInPKR = priceUsd * PKR_PER_USD2 * MARKUP2;
        return res.json({
          token,
          priceUsd,
          priceInPKR: rateInPKR,
          rate: rateInPKR,
          pkrPerUsd: PKR_PER_USD2,
          markup: MARKUP2
        });
      } catch (error) {
        console.error(`[Token Price] Handler error:`, error);
        return res.status(500).json({
          error: "Failed to get token price",
          details: error instanceof Error ? error.message : String(error)
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
  app.get("/api/dexscreener/price", handleDexscreenerPrice);
  app.get("/api/sol/price", handleSolPrice);
  app.get("/api/token/price", handleTokenPrice);
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
      const FALLBACK_USD2 = {
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
        return res.json({ token: "SOL", priceUsd: FALLBACK_USD2.SOL });
      if (tokenParam === "FIXERCOIN")
        return res.json({
          token: "FIXERCOIN",
          priceUsd: FALLBACK_USD2.FIXERCOIN
        });
      if (tokenParam === "LOCKER")
        return res.json({ token: "LOCKER", priceUsd: FALLBACK_USD2.LOCKER });
      const TOKEN_MINTS3 = {
        SOL: "So11111111111111111111111111111111111111112",
        USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
        FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
        LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump"
      };
      let token = tokenParam;
      let mint = mintParam || TOKEN_MINTS3[token] || "";
      if (!mint && tokenParam && tokenParam.length > 40) {
        mint = tokenParam;
        const inv = Object.entries(TOKEN_MINTS3).find(([, m]) => m === mint);
        if (inv) token = inv[0];
      }
      const fallback = FALLBACK_USD2[token] ?? null;
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
    init_dexscreener_price();
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic2VydmVyL3JvdXRlcy9zb2xhbmEtcHJveHkudHMiLCAic2VydmVyL3JvdXRlcy93YWxsZXQtYmFsYW5jZS50cyIsICJzZXJ2ZXIvcm91dGVzL2V4Y2hhbmdlLXJhdGUudHMiLCAic2VydmVyL3JvdXRlcy9kZXhzY3JlZW5lci1wcm94eS50cyIsICJzZXJ2ZXIvcm91dGVzL2RleHNjcmVlbmVyLXByaWNlLnRzIiwgInNlcnZlci9yb3V0ZXMvY29pbm1hcmtldGNhcC1wcm94eS50cyIsICJzZXJ2ZXIvcm91dGVzL2p1cGl0ZXItcHJveHkudHMiLCAic2VydmVyL3JvdXRlcy9mb3JleC1yYXRlLnRzIiwgInNlcnZlci9yb3V0ZXMvc3RhYmxlLTI0aC50cyIsICJzZXJ2ZXIvcm91dGVzL2RleHRvb2xzLXByb3h5LnRzIiwgInNlcnZlci9yb3V0ZXMvcDJwLW9yZGVycy50cyIsICJzZXJ2ZXIvcm91dGVzL29yZGVycy50cyIsICJzZXJ2ZXIvaW5kZXgudHMiLCAidml0ZS5jb25maWcubWpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Jvb3QvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Jvb3QvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9zb2xhbmEtcHJveHkudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Jvb3QvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9zb2xhbmEtcHJveHkudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbmNvbnN0IFJQQ19FTkRQT0lOVFMgPSBbXG4gIC8vIFByZWZlciBlbnZpcm9ubWVudC1jb25maWd1cmVkIFJQQyBmaXJzdFxuICBwcm9jZXNzLmVudi5TT0xBTkFfUlBDX1VSTCB8fCBcIlwiLFxuICAvLyBQcm92aWRlci1zcGVjaWZpYyBvdmVycmlkZXNcbiAgcHJvY2Vzcy5lbnYuQUxDSEVNWV9SUENfVVJMIHx8IFwiXCIsXG4gIHByb2Nlc3MuZW52LkhFTElVU19SUENfVVJMIHx8IFwiXCIsXG4gIHByb2Nlc3MuZW52Lk1PUkFMSVNfUlBDX1VSTCB8fCBcIlwiLFxuICBwcm9jZXNzLmVudi5IRUxJVVNfQVBJX0tFWVxuICAgID8gYGh0dHBzOi8vbWFpbm5ldC5oZWxpdXMtcnBjLmNvbS8/YXBpLWtleT0ke3Byb2Nlc3MuZW52LkhFTElVU19BUElfS0VZfWBcbiAgICA6IFwiXCIsXG4gIC8vIEZhbGxiYWNrIHB1YmxpYyBlbmRwb2ludHMgKHByZWZlciBtb3JlIHJlbGlhYmxlIHB1YmxpYyBub2RlIHByb3ZpZGVycyBmaXJzdClcbiAgXCJodHRwczovL3NvbGFuYS5wdWJsaWNub2RlLmNvbVwiLFxuICBcImh0dHBzOi8vcnBjLmFua3IuY29tL3NvbGFuYVwiLFxuICBcImh0dHBzOi8vYXBpLm1haW5uZXQtYmV0YS5zb2xhbmEuY29tXCIsXG5dLmZpbHRlcihCb29sZWFuKTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZVNvbGFuYVJwYzogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBib2R5ID0gcmVxLmJvZHk7XG5cbiAgICBpZiAoIWJvZHkpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7XG4gICAgICAgIGVycm9yOiBcIk1pc3NpbmcgcmVxdWVzdCBib2R5XCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBtZXRob2QgPSBib2R5Lm1ldGhvZCB8fCBcInVua25vd25cIjtcbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbUlBDIFByb3h5XSAke21ldGhvZH0gcmVxdWVzdCB0byAke1JQQ19FTkRQT0lOVFMubGVuZ3RofSBlbmRwb2ludHNgLFxuICAgICk7XG5cbiAgICBsZXQgbGFzdEVycm9yOiBFcnJvciB8IG51bGwgPSBudWxsO1xuICAgIGxldCBsYXN0RXJyb3JTdGF0dXM6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICAgIGxldCBsYXN0RXJyb3JEYXRhOiBhbnkgPSBudWxsO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBSUENfRU5EUE9JTlRTLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBlbmRwb2ludCA9IFJQQ19FTkRQT0lOVFNbaV07XG4gICAgICB0cnkge1xuICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICBgW1JQQyBQcm94eV0gJHttZXRob2R9IC0gQXR0ZW1wdGluZyBlbmRwb2ludCAke2kgKyAxfS8ke1JQQ19FTkRQT0lOVFMubGVuZ3RofTogJHtlbmRwb2ludC5zdWJzdHJpbmcoMCwgNTApfS4uLmAsXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgICAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIDIwMDAwKTsgLy8gMjAgc2Vjb25kIHRpbWVvdXRcblxuICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGVuZHBvaW50LCB7XG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSksXG4gICAgICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG5cbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcbiAgICAgICAgbGV0IHBhcnNlZERhdGE6IGFueSA9IG51bGw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcGFyc2VkRGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIH0gY2F0Y2gge31cblxuICAgICAgICAvLyBDaGVjayBmb3IgUlBDIGVycm9ycyBpbiByZXNwb25zZVxuICAgICAgICBpZiAocGFyc2VkRGF0YT8uZXJyb3IpIHtcbiAgICAgICAgICBjb25zdCBlcnJvckNvZGUgPSBwYXJzZWREYXRhLmVycm9yLmNvZGU7XG4gICAgICAgICAgY29uc3QgZXJyb3JNc2cgPSBwYXJzZWREYXRhLmVycm9yLm1lc3NhZ2U7XG4gICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgYFtSUEMgUHJveHldICR7bWV0aG9kfSAtIEVuZHBvaW50IHJldHVybmVkIFJQQyBlcnJvciBjb2RlICR7ZXJyb3JDb2RlfTogJHtlcnJvck1zZ31gLFxuICAgICAgICAgICk7XG4gICAgICAgICAgbGFzdEVycm9yRGF0YSA9IHBhcnNlZERhdGE7XG4gICAgICAgICAgbGFzdEVycm9yID0gbmV3IEVycm9yKGBSUEMgZXJyb3IgKCR7ZXJyb3JDb2RlfSk6ICR7ZXJyb3JNc2d9YCk7XG5cbiAgICAgICAgICAvLyBTb21lIGVuZHBvaW50cyBkb24ndCBzdXBwb3J0IGNlcnRhaW4gbWV0aG9kcywgc2tpcCBhbmQgdHJ5IG5leHRcbiAgICAgICAgICBpZiAoaSA8IFJQQ19FTkRQT0lOVFMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVHJlYXQgNDAzIGVycm9ycyBhcyBlbmRwb2ludCBiZWluZyBibG9ja2VkL3JhdGUgbGltaXRlZCwgdHJ5IG5leHRcbiAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDAzKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgYFtSUEMgUHJveHldICR7bWV0aG9kfSAtIEVuZHBvaW50IHJldHVybmVkIDQwMyAoQWNjZXNzIEZvcmJpZGRlbiksIHRyeWluZyBuZXh0Li4uYCxcbiAgICAgICAgICApO1xuICAgICAgICAgIGxhc3RFcnJvclN0YXR1cyA9IDQwMztcbiAgICAgICAgICBsYXN0RXJyb3IgPSBuZXcgRXJyb3IoYEVuZHBvaW50IGJsb2NrZWQ6ICR7ZW5kcG9pbnR9YCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUcmVhdCA0MjkgKHJhdGUgbGltaXQpIGFzIHRlbXBvcmFyeSwgc2tpcCB0byBuZXh0XG4gICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQyOSkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICAgIGBbUlBDIFByb3h5XSAke21ldGhvZH0gLSBFbmRwb2ludCByYXRlIGxpbWl0ZWQgKDQyOSksIHRyeWluZyBuZXh0Li4uYCxcbiAgICAgICAgICApO1xuICAgICAgICAgIGxhc3RFcnJvclN0YXR1cyA9IDQyOTtcbiAgICAgICAgICBsYXN0RXJyb3IgPSBuZXcgRXJyb3IoYFJhdGUgbGltaXRlZDogJHtlbmRwb2ludH1gKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZvciBvdGhlciBzZXJ2ZXIgZXJyb3JzLCB0cnkgbmV4dCBlbmRwb2ludFxuICAgICAgICBpZiAoIXJlc3BvbnNlLm9rICYmIHJlc3BvbnNlLnN0YXR1cyA+PSA1MDApIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICBgW1JQQyBQcm94eV0gJHttZXRob2R9IC0gRW5kcG9pbnQgcmV0dXJuZWQgJHtyZXNwb25zZS5zdGF0dXN9LCB0cnlpbmcgbmV4dC4uLmAsXG4gICAgICAgICAgKTtcbiAgICAgICAgICBsYXN0RXJyb3JTdGF0dXMgPSByZXNwb25zZS5zdGF0dXM7XG4gICAgICAgICAgbGFzdEVycm9yID0gbmV3IEVycm9yKGBTZXJ2ZXIgZXJyb3I6ICR7cmVzcG9uc2Uuc3RhdHVzfWApO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3VjY2VzcyBvciBjbGllbnQgZXJyb3IgLSByZXR1cm4gcmVzcG9uc2VcbiAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgYFtSUEMgUHJveHldICR7bWV0aG9kfSAtIFNVQ0NFU1Mgd2l0aCBlbmRwb2ludCAke2kgKyAxfSAoc3RhdHVzOiAke3Jlc3BvbnNlLnN0YXR1c30pYCxcbiAgICAgICAgKTtcbiAgICAgICAgcmVzLnNldChcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XG4gICAgICAgIHJldHVybiByZXMuc3RhdHVzKHJlc3BvbnNlLnN0YXR1cykuc2VuZChkYXRhKTtcbiAgICAgIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgICAgICBsYXN0RXJyb3IgPSBlIGluc3RhbmNlb2YgRXJyb3IgPyBlIDogbmV3IEVycm9yKFN0cmluZyhlKSk7XG4gICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICBgW1JQQyBQcm94eV0gJHttZXRob2R9IC0gRW5kcG9pbnQgJHtpICsgMX0gZXJyb3I6YCxcbiAgICAgICAgICBsYXN0RXJyb3IubWVzc2FnZSxcbiAgICAgICAgKTtcbiAgICAgICAgLy8gVHJ5IG5leHQgZW5kcG9pbnRcbiAgICAgICAgaWYgKGkgPCBSUENfRU5EUE9JTlRTLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCA1MDApKTsgLy8gQnJpZWYgZGVsYXkgYmVmb3JlIHJldHJ5XG4gICAgICAgIH1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc29sZS5lcnJvcihcbiAgICAgIGBbUlBDIFByb3h5XSAke21ldGhvZH0gLSBBbGwgJHtSUENfRU5EUE9JTlRTLmxlbmd0aH0gUlBDIGVuZHBvaW50cyBmYWlsZWRgLFxuICAgICk7XG4gICAgcmV0dXJuIHJlcy5zdGF0dXMobGFzdEVycm9yU3RhdHVzIHx8IDUwMykuanNvbih7XG4gICAgICBlcnJvcjpcbiAgICAgICAgbGFzdEVycm9yPy5tZXNzYWdlIHx8XG4gICAgICAgIFwiQWxsIFJQQyBlbmRwb2ludHMgZmFpbGVkIC0gbm8gU29sYW5hIFJQQyBhdmFpbGFibGVcIixcbiAgICAgIGRldGFpbHM6IGBMYXN0IGVycm9yOiAke2xhc3RFcnJvclN0YXR1cyB8fCBcInVua25vd25cIn1gLFxuICAgICAgcnBjRXJyb3JEZXRhaWxzOiBsYXN0RXJyb3JEYXRhPy5lcnJvciB8fCBudWxsLFxuICAgICAgY29uZmlndXJlZEVuZHBvaW50czogUlBDX0VORFBPSU5UUy5sZW5ndGgsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIltSUEMgUHJveHldIEhhbmRsZXIgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIkludGVybmFsIHNlcnZlciBlcnJvclwiLFxuICAgIH0pO1xuICB9XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL3dhbGxldC1iYWxhbmNlLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvd2FsbGV0LWJhbGFuY2UudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbi8vIEhlbGl1cywgTW9yYWxpcywgYW5kIEFsY2hlbXkgYXJlIFJQQyBwcm92aWRlcnMgZm9yIFNvbGFuYSBibG9ja2NoYWluIGNhbGxzXG4vLyBUaGV5IGZldGNoIHdhbGxldCBiYWxhbmNlIGFuZCB0b2tlbiBhY2NvdW50IGRhdGEgLSBOT1QgZm9yIHRva2VuIHByaWNlIGZldGNoaW5nXG4vLyBUb2tlbiBwcmljZXMgc2hvdWxkIGNvbWUgZnJvbSBkZWRpY2F0ZWQgcHJpY2UgQVBJcyBsaWtlIEp1cGl0ZXIsIERleFNjcmVlbmVyLCBvciBEZXhUb29sc1xuY29uc3QgUlBDX0VORFBPSU5UUyA9IFtcbiAgLy8gUHJlZmVyIGVudmlyb25tZW50LWNvbmZpZ3VyZWQgUlBDIGZpcnN0XG4gIHByb2Nlc3MuZW52LlNPTEFOQV9SUENfVVJMIHx8IFwiXCIsXG4gIC8vIFByb3ZpZGVyLXNwZWNpZmljIG92ZXJyaWRlc1xuICBwcm9jZXNzLmVudi5BTENIRU1ZX1JQQ19VUkwgfHwgXCJcIixcbiAgcHJvY2Vzcy5lbnYuSEVMSVVTX1JQQ19VUkwgfHwgXCJcIixcbiAgcHJvY2Vzcy5lbnYuTU9SQUxJU19SUENfVVJMIHx8IFwiXCIsXG4gIHByb2Nlc3MuZW52LkhFTElVU19BUElfS0VZXG4gICAgPyBgaHR0cHM6Ly9tYWlubmV0LmhlbGl1cy1ycGMuY29tLz9hcGkta2V5PSR7cHJvY2Vzcy5lbnYuSEVMSVVTX0FQSV9LRVl9YFxuICAgIDogXCJcIixcbiAgLy8gRmFsbGJhY2sgcHVibGljIGVuZHBvaW50cyAocHJlZmVyIHB1YmxpY25vZGUgYW5kIGFua3IgZmlyc3QpXG4gIFwiaHR0cHM6Ly9zb2xhbmEucHVibGljbm9kZS5jb21cIixcbiAgXCJodHRwczovL3JwYy5hbmtyLmNvbS9zb2xhbmFcIixcbiAgXCJodHRwczovL2FwaS5tYWlubmV0LWJldGEuc29sYW5hLmNvbVwiLFxuXS5maWx0ZXIoQm9vbGVhbik7XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVXYWxsZXRCYWxhbmNlOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgcHVibGljS2V5IH0gPSByZXEucXVlcnk7XG5cbiAgICBpZiAoIXB1YmxpY0tleSB8fCB0eXBlb2YgcHVibGljS2V5ICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oe1xuICAgICAgICBlcnJvcjogXCJNaXNzaW5nIG9yIGludmFsaWQgJ3B1YmxpY0tleScgcGFyYW1ldGVyXCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBib2R5ID0ge1xuICAgICAganNvbnJwYzogXCIyLjBcIixcbiAgICAgIGlkOiAxLFxuICAgICAgbWV0aG9kOiBcImdldEJhbGFuY2VcIixcbiAgICAgIHBhcmFtczogW3B1YmxpY0tleV0sXG4gICAgfTtcblxuICAgIGxldCBsYXN0RXJyb3I6IEVycm9yIHwgbnVsbCA9IG51bGw7XG5cbiAgICBmb3IgKGNvbnN0IGVuZHBvaW50IG9mIFJQQ19FTkRQT0lOVFMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goZW5kcG9pbnQsIHtcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgIGhlYWRlcnM6IHsgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSxcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblxuICAgICAgICBpZiAoZGF0YS5lcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgUlBDICR7ZW5kcG9pbnR9IHJldHVybmVkIGVycm9yOmAsIGRhdGEuZXJyb3IpO1xuICAgICAgICAgIGxhc3RFcnJvciA9IG5ldyBFcnJvcihkYXRhLmVycm9yLm1lc3NhZ2UgfHwgXCJSUEMgZXJyb3JcIik7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBiYWxhbmNlTGFtcG9ydHMgPSBkYXRhLnJlc3VsdDtcbiAgICAgICAgY29uc3QgYmFsYW5jZVNPTCA9IGJhbGFuY2VMYW1wb3J0cyAvIDFfMDAwXzAwMF8wMDA7XG5cbiAgICAgICAgcmV0dXJuIHJlcy5qc29uKHtcbiAgICAgICAgICBwdWJsaWNLZXksXG4gICAgICAgICAgYmFsYW5jZTogYmFsYW5jZVNPTCxcbiAgICAgICAgICBiYWxhbmNlTGFtcG9ydHMsXG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbGFzdEVycm9yID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yIDogbmV3IEVycm9yKFN0cmluZyhlcnJvcikpO1xuICAgICAgICBjb25zb2xlLndhcm4oYFJQQyBlbmRwb2ludCAke2VuZHBvaW50fSBmYWlsZWQ6YCwgbGFzdEVycm9yLm1lc3NhZ2UpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zb2xlLmVycm9yKFwiQWxsIFJQQyBlbmRwb2ludHMgZmFpbGVkIGZvciB3YWxsZXQgYmFsYW5jZVwiKTtcbiAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgZXJyb3I6XG4gICAgICAgIGxhc3RFcnJvcj8ubWVzc2FnZSB8fFxuICAgICAgICBcIkZhaWxlZCB0byBmZXRjaCBiYWxhbmNlIC0gYWxsIFJQQyBlbmRwb2ludHMgZmFpbGVkXCIsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIldhbGxldCBiYWxhbmNlIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJJbnRlcm5hbCBzZXJ2ZXIgZXJyb3JcIixcbiAgICB9KTtcbiAgfVxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Jvb3QvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Jvb3QvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9leGNoYW5nZS1yYXRlLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvZXhjaGFuZ2UtcmF0ZS50c1wiO2ltcG9ydCB7IFJlcXVlc3RIYW5kbGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuLy8gVG9rZW4gbWludCBhZGRyZXNzZXMgZm9yIFNvbGFuYSBtYWlubmV0IChpbXBvcnRlZCBmcm9tIHNoYXJlZCBjb25zdGFudHMpXG5jb25zdCBUT0tFTl9NSU5UUyA9IHtcbiAgU09MOiBcIlNvMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTJcIixcbiAgVVNEQzogXCJFUGpGV2RkNUF1ZnFTU3FlTTJxTjF4enliYXBDOEc0d0VHR2tad3lURHQxdlwiLFxuICBVU0RUOiBcIkVzOXZNRnJ6YUNFUm1KZnJGNEgyRllENEtDb05rWTExTWNDZThCZW5FbnNcIixcbiAgRklYRVJDT0lOOiBcIkg0cUtuOEZNRmhhOGpKdWo4eE1yeU1xUmhIM2g3R2pMdXh3N1RWaXhwdW1wXCIsXG4gIExPQ0tFUjogXCJFTjFuWXJXNjM3NXpNUFVrcGtHeUdTRVhXOFdtQXFZdTR5aGY2eG5HcHVtcFwiLFxufSBhcyBjb25zdDtcblxuY29uc3QgRkFMTEJBQ0tfUkFURVM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gIEZJWEVSQ09JTjogMC4wMDUsIC8vICQwLjAwNSBwZXIgRklYRVJDT0lOXG4gIFNPTDogMTgwLCAvLyAkMTgwIHBlciBTT0xcbiAgVVNEQzogMS4wLCAvLyAkMSBVU0RDXG4gIFVTRFQ6IDEuMCwgLy8gJDEgVVNEVFxuICBMT0NLRVI6IDAuMSwgLy8gJDAuMSBwZXIgTE9DS0VSXG59O1xuXG5jb25zdCBQS1JfUEVSX1VTRCA9IDI4MDsgLy8gQXBwcm94aW1hdGUgY29udmVyc2lvbiByYXRlXG5jb25zdCBNQVJLVVAgPSAxLjA0MjU7IC8vIDQuMjUlIG1hcmt1cFxuXG5pbnRlcmZhY2UgRGV4c2NyZWVuZXJSZXNwb25zZSB7XG4gIHBhaXJzOiBBcnJheTx7XG4gICAgYmFzZVRva2VuOiB7IGFkZHJlc3M6IHN0cmluZyB9O1xuICAgIHByaWNlVXNkPzogc3RyaW5nO1xuICB9Pjtcbn1cblxuY29uc3QgTUlOVF9UT19QQUlSX0FERFJFU1M6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIEg0cUtuOEZNRmhhOGpKdWo4eE1yeU1xUmhIM2g3R2pMdXh3N1RWaXhwdW1wOlxuICAgIFwiNUNnTEVXcTlWSlVFUThteThVYXhFb3Z1U1dBckdvWEN2YWZ0cGJYNFJRTXlcIixcbiAgRU4xbllyVzYzNzV6TVBVa3BrR3lHU0VYVzhXbUFxWXU0eWhmNnhuR3B1bXA6XG4gICAgXCI3WDdLa1Y5NFk5akZoa1hFTWhnVmNNSE1SekFMaUdqNXhLbU02VFQzY1V2S1wiLFxufTtcblxuY29uc3QgTUlOVF9UT19TRUFSQ0hfU1lNQk9MOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBINHFLbjhGTUZoYThqSnVqOHhNcnlNcVJoSDNoN0dqTHV4dzdUVml4cHVtcDogXCJGSVhFUkNPSU5cIixcbiAgRU4xbllyVzYzNzV6TVBVa3BrR3lHU0VYVzhXbUFxWXU0eWhmNnhuR3B1bXA6IFwiTE9DS0VSXCIsXG59O1xuXG5hc3luYyBmdW5jdGlvbiBmZXRjaFRva2VuUHJpY2VGcm9tRGV4U2NyZWVuZXIoXG4gIG1pbnQ6IHN0cmluZyxcbik6IFByb21pc2U8bnVtYmVyIHwgbnVsbD4ge1xuICAvLyBGaXJzdCwgdHJ5IHBhaXIgYWRkcmVzcyBsb29rdXAgaWYgYXZhaWxhYmxlXG4gIGNvbnN0IHBhaXJBZGRyZXNzID0gTUlOVF9UT19QQUlSX0FERFJFU1NbbWludF07XG4gIGlmIChwYWlyQWRkcmVzcykge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBwYWlyVXJsID0gYGh0dHBzOi8vYXBpLmRleHNjcmVlbmVyLmNvbS9sYXRlc3QvZGV4L3BhaXJzL3NvbGFuYS8ke3BhaXJBZGRyZXNzfWA7XG4gICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgYFtEZXhTY3JlZW5lcl0gVHJ5aW5nIHBhaXIgYWRkcmVzcyBsb29rdXAgZm9yICR7bWludH06ICR7cGFpclVybH1gLFxuICAgICAgKTtcblxuICAgICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCA4MDAwKTtcblxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChwYWlyVXJsLCB7XG4gICAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICBBY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChjb21wYXRpYmxlOyBTb2xhbmFXYWxsZXQvMS4wKVwiLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcblxuICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSAoYXdhaXQgcmVzcG9uc2UuanNvbigpKSBhcyBEZXhzY3JlZW5lclJlc3BvbnNlO1xuICAgICAgICBpZiAoZGF0YS5wYWlycyAmJiBkYXRhLnBhaXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjb25zdCBwcmljZVVzZCA9IGRhdGEucGFpcnNbMF0ucHJpY2VVc2Q7XG4gICAgICAgICAgaWYgKHByaWNlVXNkKSB7XG4gICAgICAgICAgICBjb25zdCBwcmljZSA9IHBhcnNlRmxvYXQocHJpY2VVc2QpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgICAgIGBbRGV4U2NyZWVuZXJdIFx1MjcwNSBHb3QgcHJpY2UgZm9yICR7bWludH0gdmlhIHBhaXIgYWRkcmVzczogJCR7cHJpY2V9YCxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gcHJpY2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgYFtEZXhTY3JlZW5lcl0gXHUyNkEwXHVGRTBGIFBhaXIgYWRkcmVzcyBsb29rdXAgZmFpbGVkOmAsXG4gICAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLy8gRmFsbGJhY2s6IHRyeSBtaW50LWJhc2VkIGxvb2t1cFxuICB0cnkge1xuICAgIGNvbnN0IHVybCA9IGBodHRwczovL2FwaS5kZXhzY3JlZW5lci5jb20vbGF0ZXN0L2RleC90b2tlbnMvJHttaW50fWA7XG4gICAgY29uc29sZS5sb2coYFtEZXhTY3JlZW5lcl0gRmV0Y2hpbmcgcHJpY2UgZm9yICR7bWludH0gZnJvbTogJHt1cmx9YCk7XG5cbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCA4MDAwKTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICBBY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoY29tcGF0aWJsZTsgU29sYW5hV2FsbGV0LzEuMClcIixcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgIGBbRGV4U2NyZWVuZXJdIFx1Mjc0QyBBUEkgcmV0dXJuZWQgJHtyZXNwb25zZS5zdGF0dXN9IGZvciBtaW50ICR7bWludH1gLFxuICAgICAgKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGRhdGEgPSAoYXdhaXQgcmVzcG9uc2UuanNvbigpKSBhcyBEZXhzY3JlZW5lclJlc3BvbnNlO1xuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYFtEZXhTY3JlZW5lcl0gUmVzcG9uc2UgcmVjZWl2ZWQgZm9yICR7bWludH06YCxcbiAgICAgIEpTT04uc3RyaW5naWZ5KGRhdGEpLnN1YnN0cmluZygwLCAyMDApLFxuICAgICk7XG5cbiAgICBpZiAoZGF0YS5wYWlycyAmJiBkYXRhLnBhaXJzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IHByaWNlVXNkID0gZGF0YS5wYWlyc1swXS5wcmljZVVzZDtcbiAgICAgIGlmIChwcmljZVVzZCkge1xuICAgICAgICBjb25zdCBwcmljZSA9IHBhcnNlRmxvYXQocHJpY2VVc2QpO1xuICAgICAgICBjb25zb2xlLmxvZyhgW0RleFNjcmVlbmVyXSBcdTI3MDUgR290IHByaWNlIGZvciAke21pbnR9OiAkJHtwcmljZX1gKTtcbiAgICAgICAgcmV0dXJuIHByaWNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEZhbGxiYWNrOiB0cnkgc2VhcmNoLWJhc2VkIGxvb2t1cCBmb3Igc3BlY2lmaWMgdG9rZW5zXG4gICAgY29uc3Qgc2VhcmNoU3ltYm9sID0gTUlOVF9UT19TRUFSQ0hfU1lNQk9MW21pbnRdO1xuICAgIGlmIChzZWFyY2hTeW1ib2wpIHtcbiAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICBgW0RleFNjcmVlbmVyXSBObyBwYWlycyBmb3VuZCwgdHJ5aW5nIHNlYXJjaCBmYWxsYmFjayBmb3IgJHtzZWFyY2hTeW1ib2x9YCxcbiAgICAgICk7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBzZWFyY2hVcmwgPSBgaHR0cHM6Ly9hcGkuZGV4c2NyZWVuZXIuY29tL2xhdGVzdC9kZXgvc2VhcmNoLz9xPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHNlYXJjaFN5bWJvbCl9YDtcbiAgICAgICAgY29uc3Qgc2VhcmNoQ29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgICAgY29uc3Qgc2VhcmNoVGltZW91dElkID0gc2V0VGltZW91dChcbiAgICAgICAgICAoKSA9PiBzZWFyY2hDb250cm9sbGVyLmFib3J0KCksXG4gICAgICAgICAgODAwMCxcbiAgICAgICAgKTtcblxuICAgICAgICBjb25zdCBzZWFyY2hSZXNwb25zZSA9IGF3YWl0IGZldGNoKHNlYXJjaFVybCwge1xuICAgICAgICAgIHNpZ25hbDogc2VhcmNoQ29udHJvbGxlci5zaWduYWwsXG4gICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChjb21wYXRpYmxlOyBTb2xhbmFXYWxsZXQvMS4wKVwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBjbGVhclRpbWVvdXQoc2VhcmNoVGltZW91dElkKTtcblxuICAgICAgICBpZiAoc2VhcmNoUmVzcG9uc2Uub2spIHtcbiAgICAgICAgICBjb25zdCBzZWFyY2hEYXRhID1cbiAgICAgICAgICAgIChhd2FpdCBzZWFyY2hSZXNwb25zZS5qc29uKCkpIGFzIERleHNjcmVlbmVyUmVzcG9uc2U7XG4gICAgICAgICAgaWYgKHNlYXJjaERhdGEucGFpcnMgJiYgc2VhcmNoRGF0YS5wYWlycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBMb29rIGZvciBwYWlycyB3aGVyZSB0aGlzIHRva2VuIGlzIHRoZSBiYXNlIG9uIFNvbGFuYVxuICAgICAgICAgICAgbGV0IG1hdGNoaW5nUGFpciA9IHNlYXJjaERhdGEucGFpcnMuZmluZChcbiAgICAgICAgICAgICAgKHApID0+XG4gICAgICAgICAgICAgICAgcC5iYXNlVG9rZW4/LmFkZHJlc3MgPT09IG1pbnQgJiZcbiAgICAgICAgICAgICAgICAocCBhcyBhbnkpLmNoYWluSWQgPT09IFwic29sYW5hXCIsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAvLyBJZiBub3QgZm91bmQgYXMgYmFzZSBvbiBTb2xhbmEsIHRyeSBhcyBxdW90ZSB0b2tlbiBvbiBTb2xhbmFcbiAgICAgICAgICAgIGlmICghbWF0Y2hpbmdQYWlyKSB7XG4gICAgICAgICAgICAgIG1hdGNoaW5nUGFpciA9IHNlYXJjaERhdGEucGFpcnMuZmluZChcbiAgICAgICAgICAgICAgICAocCkgPT5cbiAgICAgICAgICAgICAgICAgIChwIGFzIGFueSkucXVvdGVUb2tlbj8uYWRkcmVzcyA9PT0gbWludCAmJlxuICAgICAgICAgICAgICAgICAgKHAgYXMgYW55KS5jaGFpbklkID09PSBcInNvbGFuYVwiLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiBzdGlsbCBub3QgZm91bmQgb24gU29sYW5hLCB0cnkgYW55IGNoYWluIGFzIGJhc2VcbiAgICAgICAgICAgIGlmICghbWF0Y2hpbmdQYWlyKSB7XG4gICAgICAgICAgICAgIG1hdGNoaW5nUGFpciA9IHNlYXJjaERhdGEucGFpcnMuZmluZChcbiAgICAgICAgICAgICAgICAocCkgPT4gcC5iYXNlVG9rZW4/LmFkZHJlc3MgPT09IG1pbnQsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIElmIHN0aWxsIG5vdCBmb3VuZCwgdHJ5IGFzIHF1b3RlIG9uIGFueSBjaGFpblxuICAgICAgICAgICAgaWYgKCFtYXRjaGluZ1BhaXIpIHtcbiAgICAgICAgICAgICAgbWF0Y2hpbmdQYWlyID0gc2VhcmNoRGF0YS5wYWlycy5maW5kKFxuICAgICAgICAgICAgICAgIChwKSA9PiAocCBhcyBhbnkpLnF1b3RlVG9rZW4/LmFkZHJlc3MgPT09IG1pbnQsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIExhc3QgcmVzb3J0OiBqdXN0IHRha2UgdGhlIGZpcnN0IHJlc3VsdFxuICAgICAgICAgICAgaWYgKCFtYXRjaGluZ1BhaXIpIHtcbiAgICAgICAgICAgICAgbWF0Y2hpbmdQYWlyID0gc2VhcmNoRGF0YS5wYWlyc1swXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG1hdGNoaW5nUGFpciAmJiBtYXRjaGluZ1BhaXIucHJpY2VVc2QpIHtcbiAgICAgICAgICAgICAgY29uc3QgcHJpY2UgPSBwYXJzZUZsb2F0KG1hdGNoaW5nUGFpci5wcmljZVVzZCk7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgICAgIGBbRGV4U2NyZWVuZXJdIFx1MjcwNSBHb3QgcHJpY2UgZm9yICR7bWludH0gdmlhIHNlYXJjaDogJCR7cHJpY2V9YCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHByaWNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoc2VhcmNoRXJyKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICBgW0RleFNjcmVlbmVyXSBTZWFyY2ggZmFsbGJhY2sgZmFpbGVkOmAsXG4gICAgICAgICAgc2VhcmNoRXJyIGluc3RhbmNlb2YgRXJyb3IgPyBzZWFyY2hFcnIubWVzc2FnZSA6IFN0cmluZyhzZWFyY2hFcnIpLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnNvbGUud2FybihgW0RleFNjcmVlbmVyXSBObyBwYWlycyBmb3VuZCBpbiByZXNwb25zZSBmb3IgJHttaW50fWApO1xuICAgIHJldHVybiBudWxsO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBgW0RleFNjcmVlbmVyXSBcdTI3NEMgRmFpbGVkIHRvIGZldGNoICR7bWludH06YCxcbiAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICApO1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVFeGNoYW5nZVJhdGU6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgdG9rZW4gPSAocmVxLnF1ZXJ5LnRva2VuIGFzIHN0cmluZykgfHwgXCJGSVhFUkNPSU5cIjtcblxuICAgIGxldCBwcmljZVVzZDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbiAgICAvLyBGZXRjaCBwcmljZSBmcm9tIERleFNjcmVlbmVyIGJhc2VkIG9uIHRva2VuXG4gICAgaWYgKHRva2VuID09PSBcIkZJWEVSQ09JTlwiKSB7XG4gICAgICBwcmljZVVzZCA9IGF3YWl0IGZldGNoVG9rZW5QcmljZUZyb21EZXhTY3JlZW5lcihUT0tFTl9NSU5UUy5GSVhFUkNPSU4pO1xuICAgIH0gZWxzZSBpZiAodG9rZW4gPT09IFwiU09MXCIpIHtcbiAgICAgIHByaWNlVXNkID0gYXdhaXQgZmV0Y2hUb2tlblByaWNlRnJvbURleFNjcmVlbmVyKFRPS0VOX01JTlRTLlNPTCk7XG4gICAgfSBlbHNlIGlmICh0b2tlbiA9PT0gXCJVU0RDXCIgfHwgdG9rZW4gPT09IFwiVVNEVFwiKSB7XG4gICAgICAvLyBTdGFibGVjb2lucyBhcmUgYWx3YXlzIH4xIFVTRFxuICAgICAgcHJpY2VVc2QgPSAxLjA7XG4gICAgfSBlbHNlIGlmICh0b2tlbiA9PT0gXCJMT0NLRVJcIikge1xuICAgICAgcHJpY2VVc2QgPSBhd2FpdCBmZXRjaFRva2VuUHJpY2VGcm9tRGV4U2NyZWVuZXIoVE9LRU5fTUlOVFMuTE9DS0VSKTtcbiAgICB9XG5cbiAgICAvLyBGYWxsIGJhY2sgdG8gaGFyZGNvZGVkIHJhdGVzIGlmIERleFNjcmVlbmVyIGZldGNoIGZhaWxzIG9yIHByaWNlIGlzIGludmFsaWRcbiAgICBpZiAocHJpY2VVc2QgPT09IG51bGwgfHwgcHJpY2VVc2QgPD0gMCkge1xuICAgICAgcHJpY2VVc2QgPSBGQUxMQkFDS19SQVRFU1t0b2tlbl0gfHwgRkFMTEJBQ0tfUkFURVMuRklYRVJDT0lOO1xuICAgICAgY29uc29sZS5sb2coXG4gICAgICAgIGBbRXhjaGFuZ2VSYXRlXSBVc2luZyBmYWxsYmFjayByYXRlIGZvciAke3Rva2VufTogJCR7cHJpY2VVc2R9YCxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICBgW0V4Y2hhbmdlUmF0ZV0gRmV0Y2hlZCAke3Rva2VufSBwcmljZSBmcm9tIERleFNjcmVlbmVyOiAkJHtwcmljZVVzZH1gLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBDb252ZXJ0IHRvIFBLUiB3aXRoIG1hcmt1cFxuICAgIGNvbnN0IHJhdGVJblBLUiA9IHByaWNlVXNkICogUEtSX1BFUl9VU0QgKiBNQVJLVVA7XG5cbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbRXhjaGFuZ2VSYXRlXSAke3Rva2VufTogJCR7cHJpY2VVc2QudG9GaXhlZCg2KX0gVVNEIC0+ICR7cmF0ZUluUEtSLnRvRml4ZWQoMil9IFBLUiAod2l0aCAkeyhNQVJLVVAgLSAxKSAqIDEwMH0lIG1hcmt1cClgLFxuICAgICk7XG5cbiAgICByZXMuanNvbih7XG4gICAgICB0b2tlbixcbiAgICAgIHByaWNlVXNkLFxuICAgICAgcHJpY2VJblBLUjogcmF0ZUluUEtSLFxuICAgICAgcmF0ZTogcmF0ZUluUEtSLFxuICAgICAgcGtrUGVyVXNkOiBQS1JfUEVSX1VTRCxcbiAgICAgIG1hcmt1cDogTUFSS1VQLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJbRXhjaGFuZ2VSYXRlXSBFcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBcIkZhaWxlZCB0byBmZXRjaCBleGNoYW5nZSByYXRlXCIsXG4gICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgfSk7XG4gIH1cbn07XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvZGV4c2NyZWVuZXItcHJveHkudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Jvb3QvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9kZXhzY3JlZW5lci1wcm94eS50c1wiO2ltcG9ydCB7IFJlcXVlc3RIYW5kbGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuaW50ZXJmYWNlIERleHNjcmVlbmVyVG9rZW4ge1xuICBjaGFpbklkOiBzdHJpbmc7XG4gIGRleElkOiBzdHJpbmc7XG4gIHVybDogc3RyaW5nO1xuICBwYWlyQWRkcmVzczogc3RyaW5nO1xuICBiYXNlVG9rZW46IHtcbiAgICBhZGRyZXNzOiBzdHJpbmc7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIHN5bWJvbDogc3RyaW5nO1xuICB9O1xuICBxdW90ZVRva2VuOiB7XG4gICAgYWRkcmVzczogc3RyaW5nO1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBzeW1ib2w6IHN0cmluZztcbiAgfTtcbiAgcHJpY2VOYXRpdmU6IHN0cmluZztcbiAgcHJpY2VVc2Q/OiBzdHJpbmc7XG4gIHR4bnM6IHtcbiAgICBtNTogeyBidXlzOiBudW1iZXI7IHNlbGxzOiBudW1iZXIgfTtcbiAgICBoMTogeyBidXlzOiBudW1iZXI7IHNlbGxzOiBudW1iZXIgfTtcbiAgICBoNjogeyBidXlzOiBudW1iZXI7IHNlbGxzOiBudW1iZXIgfTtcbiAgICBoMjQ6IHsgYnV5czogbnVtYmVyOyBzZWxsczogbnVtYmVyIH07XG4gIH07XG4gIHZvbHVtZToge1xuICAgIGgyNDogbnVtYmVyO1xuICAgIGg2OiBudW1iZXI7XG4gICAgaDE6IG51bWJlcjtcbiAgICBtNTogbnVtYmVyO1xuICB9O1xuICBwcmljZUNoYW5nZToge1xuICAgIG01OiBudW1iZXI7XG4gICAgaDE6IG51bWJlcjtcbiAgICBoNjogbnVtYmVyO1xuICAgIGgyNDogbnVtYmVyO1xuICB9O1xuICBsaXF1aWRpdHk/OiB7XG4gICAgdXNkPzogbnVtYmVyO1xuICAgIGJhc2U/OiBudW1iZXI7XG4gICAgcXVvdGU/OiBudW1iZXI7XG4gIH07XG4gIGZkdj86IG51bWJlcjtcbiAgbWFya2V0Q2FwPzogbnVtYmVyO1xuICBpbmZvPzoge1xuICAgIGltYWdlVXJsPzogc3RyaW5nO1xuICAgIHdlYnNpdGVzPzogQXJyYXk8eyBsYWJlbDogc3RyaW5nOyB1cmw6IHN0cmluZyB9PjtcbiAgICBzb2NpYWxzPzogQXJyYXk8eyB0eXBlOiBzdHJpbmc7IHVybDogc3RyaW5nIH0+O1xuICB9O1xufVxuXG5pbnRlcmZhY2UgRGV4c2NyZWVuZXJSZXNwb25zZSB7XG4gIHNjaGVtYVZlcnNpb246IHN0cmluZztcbiAgcGFpcnM6IERleHNjcmVlbmVyVG9rZW5bXTtcbn1cblxuLy8gRGV4U2NyZWVuZXIgZW5kcG9pbnRzIGZvciBmYWlsb3ZlclxuY29uc3QgREVYU0NSRUVORVJfRU5EUE9JTlRTID0gW1xuICBcImh0dHBzOi8vYXBpLmRleHNjcmVlbmVyLmNvbS9sYXRlc3QvZGV4XCIsXG4gIFwiaHR0cHM6Ly9hcGkuZGV4c2NyZWVuZXIuaW8vbGF0ZXN0L2RleFwiLCAvLyBBbHRlcm5hdGl2ZSBkb21haW5cbl07XG5cbmNvbnN0IENBQ0hFX1RUTF9NUyA9IDMwXzAwMDsgLy8gMzAgc2Vjb25kc1xuY29uc3QgTUFYX1RPS0VOU19QRVJfQkFUQ0ggPSAyMDtcblxubGV0IGN1cnJlbnRFbmRwb2ludEluZGV4ID0gMDtcbmNvbnN0IGNhY2hlID0gbmV3IE1hcDxcbiAgc3RyaW5nLFxuICB7IGRhdGE6IERleHNjcmVlbmVyUmVzcG9uc2U7IGV4cGlyZXNBdDogbnVtYmVyIH1cbj4oKTtcbmNvbnN0IGluZmxpZ2h0UmVxdWVzdHMgPSBuZXcgTWFwPHN0cmluZywgUHJvbWlzZTxEZXhzY3JlZW5lclJlc3BvbnNlPj4oKTtcblxuY29uc3QgdHJ5RGV4c2NyZWVuZXJFbmRwb2ludHMgPSBhc3luYyAoXG4gIHBhdGg6IHN0cmluZyxcbik6IFByb21pc2U8RGV4c2NyZWVuZXJSZXNwb25zZT4gPT4ge1xuICBsZXQgbGFzdEVycm9yOiBFcnJvciB8IG51bGwgPSBudWxsO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgREVYU0NSRUVORVJfRU5EUE9JTlRTLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZW5kcG9pbnRJbmRleCA9XG4gICAgICAoY3VycmVudEVuZHBvaW50SW5kZXggKyBpKSAlIERFWFNDUkVFTkVSX0VORFBPSU5UUy5sZW5ndGg7XG4gICAgY29uc3QgZW5kcG9pbnQgPSBERVhTQ1JFRU5FUl9FTkRQT0lOVFNbZW5kcG9pbnRJbmRleF07XG4gICAgY29uc3QgdXJsID0gYCR7ZW5kcG9pbnR9JHtwYXRofWA7XG5cbiAgICB0cnkge1xuICAgICAgY29uc29sZS5sb2coYFRyeWluZyBEZXhTY3JlZW5lciBBUEk6ICR7dXJsfWApO1xuXG4gICAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIDEyMDAwKTsgLy8gMTJzIHRpbWVvdXRcblxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoY29tcGF0aWJsZTsgU29sYW5hV2FsbGV0LzEuMClcIixcbiAgICAgICAgfSxcbiAgICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICAgIH0pO1xuXG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcblxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MjkpIHtcbiAgICAgICAgICAvLyBSYXRlIGxpbWl0ZWQgLSB0cnkgbmV4dCBlbmRwb2ludFxuICAgICAgICAgIGNvbnNvbGUud2FybihgUmF0ZSBsaW1pdGVkIG9uICR7ZW5kcG9pbnR9LCB0cnlpbmcgbmV4dC4uLmApO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgSFRUUCAke3Jlc3BvbnNlLnN0YXR1c306ICR7cmVzcG9uc2Uuc3RhdHVzVGV4dH1gKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZGF0YSA9IChhd2FpdCByZXNwb25zZS5qc29uKCkpIGFzIERleHNjcmVlbmVyUmVzcG9uc2U7XG5cbiAgICAgIC8vIFN1Y2Nlc3MgLSB1cGRhdGUgY3VycmVudCBlbmRwb2ludFxuICAgICAgY3VycmVudEVuZHBvaW50SW5kZXggPSBlbmRwb2ludEluZGV4O1xuICAgICAgY29uc29sZS5sb2coYERleFNjcmVlbmVyIEFQSSBjYWxsIHN1Y2Nlc3NmdWwgdmlhICR7ZW5kcG9pbnR9YCk7XG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc3QgZXJyb3JNc2cgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgICBjb25zb2xlLndhcm4oYERleFNjcmVlbmVyIGVuZHBvaW50ICR7ZW5kcG9pbnR9IGZhaWxlZDpgLCBlcnJvck1zZyk7XG4gICAgICBsYXN0RXJyb3IgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IgOiBuZXcgRXJyb3IoU3RyaW5nKGVycm9yKSk7XG5cbiAgICAgIC8vIFNtYWxsIGRlbGF5IGJlZm9yZSB0cnlpbmcgbmV4dCBlbmRwb2ludFxuICAgICAgaWYgKGkgPCBERVhTQ1JFRU5FUl9FTkRQT0lOVFMubGVuZ3RoIC0gMSkge1xuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCAxMDAwKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgIGBBbGwgRGV4U2NyZWVuZXIgZW5kcG9pbnRzIGZhaWxlZC4gTGFzdCBlcnJvcjogJHtsYXN0RXJyb3I/Lm1lc3NhZ2UgfHwgXCJVbmtub3duIGVycm9yXCJ9YCxcbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBmZXRjaERleHNjcmVlbmVyRGF0YSA9IGFzeW5jIChcbiAgcGF0aDogc3RyaW5nLFxuKTogUHJvbWlzZTxEZXhzY3JlZW5lclJlc3BvbnNlPiA9PiB7XG4gIGNvbnN0IGNhY2hlZCA9IGNhY2hlLmdldChwYXRoKTtcbiAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblxuICBpZiAoY2FjaGVkICYmIGNhY2hlZC5leHBpcmVzQXQgPiBub3cpIHtcbiAgICByZXR1cm4gY2FjaGVkLmRhdGE7XG4gIH1cblxuICBjb25zdCBleGlzdGluZyA9IGluZmxpZ2h0UmVxdWVzdHMuZ2V0KHBhdGgpO1xuICBpZiAoZXhpc3RpbmcpIHtcbiAgICByZXR1cm4gZXhpc3Rpbmc7XG4gIH1cblxuICBjb25zdCByZXF1ZXN0ID0gKGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHRyeURleHNjcmVlbmVyRW5kcG9pbnRzKHBhdGgpO1xuICAgICAgY2FjaGUuc2V0KHBhdGgsIHsgZGF0YSwgZXhwaXJlc0F0OiBEYXRlLm5vdygpICsgQ0FDSEVfVFRMX01TIH0pO1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGluZmxpZ2h0UmVxdWVzdHMuZGVsZXRlKHBhdGgpO1xuICAgIH1cbiAgfSkoKTtcblxuICBpbmZsaWdodFJlcXVlc3RzLnNldChwYXRoLCByZXF1ZXN0KTtcbiAgcmV0dXJuIHJlcXVlc3Q7XG59O1xuXG5jb25zdCBtZXJnZVBhaXJzQnlUb2tlbiA9IChwYWlyczogRGV4c2NyZWVuZXJUb2tlbltdKTogRGV4c2NyZWVuZXJUb2tlbltdID0+IHtcbiAgY29uc3QgYnlNaW50ID0gbmV3IE1hcDxzdHJpbmcsIERleHNjcmVlbmVyVG9rZW4+KCk7XG5cbiAgcGFpcnMuZm9yRWFjaCgocGFpcikgPT4ge1xuICAgIGNvbnN0IG1pbnQgPSBwYWlyLmJhc2VUb2tlbj8uYWRkcmVzcyB8fCBwYWlyLnBhaXJBZGRyZXNzO1xuICAgIGlmICghbWludCkgcmV0dXJuO1xuXG4gICAgY29uc3QgZXhpc3RpbmcgPSBieU1pbnQuZ2V0KG1pbnQpO1xuICAgIGNvbnN0IGV4aXN0aW5nTGlxdWlkaXR5ID0gZXhpc3Rpbmc/LmxpcXVpZGl0eT8udXNkID8/IDA7XG4gICAgY29uc3QgY2FuZGlkYXRlTGlxdWlkaXR5ID0gcGFpci5saXF1aWRpdHk/LnVzZCA/PyAwO1xuXG4gICAgaWYgKCFleGlzdGluZyB8fCBjYW5kaWRhdGVMaXF1aWRpdHkgPiBleGlzdGluZ0xpcXVpZGl0eSkge1xuICAgICAgYnlNaW50LnNldChtaW50LCBwYWlyKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBBcnJheS5mcm9tKGJ5TWludC52YWx1ZXMoKSk7XG59O1xuXG4vLyBNaW50IHRvIHBhaXIgYWRkcmVzcyBtYXBwaW5nIGZvciBwdW1wLmZ1biB0b2tlbnNcbmV4cG9ydCBjb25zdCBNSU5UX1RPX1BBSVJfQUREUkVTUzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgSDRxS244Rk1GaGE4akp1ajh4TXJ5TXFSaEgzaDdHakx1eHc3VFZpeHB1bXA6XG4gICAgXCI1Q2dMRVdxOVZKVUVROG15OFVheEVvdnVTV0FyR29YQ3ZhZnRwYlg0UlFNeVwiLCAvLyBGSVhFUkNPSU5cbiAgRU4xbllyVzYzNzV6TVBVa3BrR3lHU0VYVzhXbUFxWXU0eWhmNnhuR3B1bXA6XG4gICAgXCI3WDdLa1Y5NFk5akZoa1hFTWhnVmNNSE1SekFMaUdqNXhLbU02VFQzY1V2S1wiLCAvLyBMT0NLRVIgKGlmIGF2YWlsYWJsZSlcbn07XG5cbi8vIE1pbnQgdG8gc2VhcmNoIHN5bWJvbCBtYXBwaW5nIGZvciB0b2tlbnMgbm90IGZvdW5kIHZpYSBtaW50IGxvb2t1cFxuY29uc3QgTUlOVF9UT19TRUFSQ0hfU1lNQk9MOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBINHFLbjhGTUZoYThqSnVqOHhNcnlNcVJoSDNoN0dqTHV4dzdUVml4cHVtcDogXCJGSVhFUkNPSU5cIixcbiAgRU4xbllyVzYzNzV6TVBVa3BrR3lHU0VYVzhXbUFxWXU0eWhmNnhuR3B1bXA6IFwiTE9DS0VSXCIsXG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlRGV4c2NyZWVuZXJUb2tlbnM6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBtaW50cyB9ID0gcmVxLnF1ZXJ5O1xuXG4gICAgaWYgKCFtaW50cyB8fCB0eXBlb2YgbWludHMgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgIGNvbnNvbGUud2FybihgW0RleFNjcmVlbmVyXSBJbnZhbGlkIG1pbnRzIHBhcmFtZXRlcjpgLCBtaW50cyk7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oe1xuICAgICAgICBlcnJvcjpcbiAgICAgICAgICBcIk1pc3Npbmcgb3IgaW52YWxpZCAnbWludHMnIHBhcmFtZXRlci4gRXhwZWN0ZWQgY29tbWEtc2VwYXJhdGVkIHRva2VuIG1pbnRzLlwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coYFtEZXhTY3JlZW5lcl0gVG9rZW5zIHJlcXVlc3QgZm9yIG1pbnRzOiAke21pbnRzfWApO1xuXG4gICAgY29uc3QgcmF3TWludHMgPSBtaW50c1xuICAgICAgLnNwbGl0KFwiLFwiKVxuICAgICAgLm1hcCgobWludCkgPT4gbWludC50cmltKCkpXG4gICAgICAuZmlsdGVyKEJvb2xlYW4pO1xuXG4gICAgY29uc3QgdW5pcXVlTWludHMgPSBBcnJheS5mcm9tKG5ldyBTZXQocmF3TWludHMpKTtcblxuICAgIGlmICh1bmlxdWVNaW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7XG4gICAgICAgIGVycm9yOiBcIk5vIHZhbGlkIHRva2VuIG1pbnRzIHByb3ZpZGVkLlwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgYmF0Y2hlczogc3RyaW5nW11bXSA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdW5pcXVlTWludHMubGVuZ3RoOyBpICs9IE1BWF9UT0tFTlNfUEVSX0JBVENIKSB7XG4gICAgICBiYXRjaGVzLnB1c2godW5pcXVlTWludHMuc2xpY2UoaSwgaSArIE1BWF9UT0tFTlNfUEVSX0JBVENIKSk7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0czogRGV4c2NyZWVuZXJUb2tlbltdID0gW107XG4gICAgY29uc3QgcmVxdWVzdGVkTWludHNTZXQgPSBuZXcgU2V0KHVuaXF1ZU1pbnRzKTtcbiAgICBjb25zdCBmb3VuZE1pbnRzU2V0ID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgbGV0IHNjaGVtYVZlcnNpb24gPSBcIjEuMC4wXCI7XG5cbiAgICBmb3IgKGNvbnN0IGJhdGNoIG9mIGJhdGNoZXMpIHtcbiAgICAgIGNvbnN0IHBhdGggPSBgL3Rva2Vucy8ke2JhdGNoLmpvaW4oXCIsXCIpfWA7XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgZmV0Y2hEZXhzY3JlZW5lckRhdGEocGF0aCk7XG4gICAgICBpZiAoZGF0YT8uc2NoZW1hVmVyc2lvbikge1xuICAgICAgICBzY2hlbWFWZXJzaW9uID0gZGF0YS5zY2hlbWFWZXJzaW9uO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWRhdGEgfHwgIUFycmF5LmlzQXJyYXkoZGF0YS5wYWlycykpIHtcbiAgICAgICAgY29uc29sZS53YXJuKFwiSW52YWxpZCByZXNwb25zZSBmb3JtYXQgZnJvbSBEZXhTY3JlZW5lciBBUEkgYmF0Y2hcIik7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICByZXN1bHRzLnB1c2goLi4uZGF0YS5wYWlycyk7XG5cbiAgICAgIC8vIFRyYWNrIHdoaWNoIG1pbnRzIHdlIGZvdW5kIChib3RoIGJhc2UgYW5kIHF1b3RlIHRva2VucylcbiAgICAgIGRhdGEucGFpcnMuZm9yRWFjaCgocGFpcikgPT4ge1xuICAgICAgICBpZiAocGFpci5iYXNlVG9rZW4/LmFkZHJlc3MpIHtcbiAgICAgICAgICBmb3VuZE1pbnRzU2V0LmFkZChwYWlyLmJhc2VUb2tlbi5hZGRyZXNzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGFpci5xdW90ZVRva2VuPy5hZGRyZXNzKSB7XG4gICAgICAgICAgZm91bmRNaW50c1NldC5hZGQocGFpci5xdW90ZVRva2VuLmFkZHJlc3MpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBGaW5kIG1pbnRzIHRoYXQgd2VyZW4ndCBmb3VuZCBpbiB0aGUgaW5pdGlhbCBiYXRjaCByZXF1ZXN0XG4gICAgY29uc3QgbWlzc2luZ01pbnRzID0gQXJyYXkuZnJvbShyZXF1ZXN0ZWRNaW50c1NldCkuZmlsdGVyKFxuICAgICAgKG0pID0+ICFmb3VuZE1pbnRzU2V0LmhhcyhtKSxcbiAgICApO1xuXG4gICAgLy8gRm9yIG1pc3NpbmcgbWludHMsIHRyeSBwYWlyIGFkZHJlc3MgbG9va3VwIGZpcnN0LCB0aGVuIHNlYXJjaCBmYWxsYmFja1xuICAgIGlmIChtaXNzaW5nTWludHMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc29sZS5sb2coXG4gICAgICAgIGBbRGV4U2NyZWVuZXJdICR7bWlzc2luZ01pbnRzLmxlbmd0aH0gbWludHMgbm90IGZvdW5kIHZpYSBiYXRjaCwgdHJ5aW5nIHBhaXIvc2VhcmNoIGZhbGxiYWNrYCxcbiAgICAgICk7XG5cbiAgICAgIGZvciAoY29uc3QgbWludCBvZiBtaXNzaW5nTWludHMpIHtcbiAgICAgICAgbGV0IGZvdW5kID0gZmFsc2U7XG5cbiAgICAgICAgLy8gRmlyc3QsIHRyeSBwYWlyIGFkZHJlc3MgbG9va3VwIGlmIGF2YWlsYWJsZVxuICAgICAgICBjb25zdCBwYWlyQWRkcmVzcyA9IE1JTlRfVE9fUEFJUl9BRERSRVNTW21pbnRdO1xuICAgICAgICBpZiAocGFpckFkZHJlc3MpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgICAgIGBbRGV4U2NyZWVuZXJdIFRyeWluZyBwYWlyIGFkZHJlc3MgbG9va3VwIGZvciAke21pbnR9OiAke3BhaXJBZGRyZXNzfWAsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgY29uc3QgcGFpckRhdGEgPSBhd2FpdCBmZXRjaERleHNjcmVlbmVyRGF0YShcbiAgICAgICAgICAgICAgYC9wYWlycy9zb2xhbmEvJHtwYWlyQWRkcmVzc31gLFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgICAgIGBbRGV4U2NyZWVuZXJdIFBhaXIgbG9va3VwIHJlc3BvbnNlOiAke3BhaXJEYXRhID8gXCJyZWNlaXZlZFwiIDogXCJudWxsXCJ9LCBwYWlyczogJHtwYWlyRGF0YT8ucGFpcnM/Lmxlbmd0aCB8fCAwfWAsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIHBhaXJEYXRhPy5wYWlycyAmJlxuICAgICAgICAgICAgICBBcnJheS5pc0FycmF5KHBhaXJEYXRhLnBhaXJzKSAmJlxuICAgICAgICAgICAgICBwYWlyRGF0YS5wYWlycy5sZW5ndGggPiAwXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgbGV0IHBhaXIgPSBwYWlyRGF0YS5wYWlyc1swXTtcblxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICAgICBgW0RleFNjcmVlbmVyXSBQYWlyIGFkZHJlc3MgbG9va3VwIHJhdyBkYXRhOiBiYXNlVG9rZW49JHtwYWlyLmJhc2VUb2tlbj8uYWRkcmVzc30sIHF1b3RlVG9rZW49JHtwYWlyLnF1b3RlVG9rZW4/LmFkZHJlc3N9LCBwcmljZVVzZD0ke3BhaXIucHJpY2VVc2R9YCxcbiAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAvLyBJZiB0aGUgcmVxdWVzdGVkIG1pbnQgaXMgdGhlIHF1b3RlVG9rZW4sIHdlIG5lZWQgdG8gc3dhcCB0aGUgdG9rZW5zXG4gICAgICAgICAgICAgIC8vIGFuZCBpbnZlcnQgdGhlIHByaWNlIHRvIGdldCB0aGUgY29ycmVjdCByZXByZXNlbnRhdGlvblxuICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgcGFpci5xdW90ZVRva2VuPy5hZGRyZXNzID09PSBtaW50ICYmXG4gICAgICAgICAgICAgICAgcGFpci5iYXNlVG9rZW4/LmFkZHJlc3MgIT09IG1pbnRcbiAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFzZVByaWNlID0gcGFpci5wcmljZVVzZCA/IHBhcnNlRmxvYXQocGFpci5wcmljZVVzZCkgOiAwO1xuICAgICAgICAgICAgICAgIGNvbnN0IGludmVydGVkUHJpY2UgPVxuICAgICAgICAgICAgICAgICAgYmFzZVByaWNlID4gMCA/ICgxIC8gYmFzZVByaWNlKS50b0ZpeGVkKDIwKSA6IFwiMFwiO1xuXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgICAgICAgICBgW0RleFNjcmVlbmVyXSBTd2FwcGluZyB0b2tlbnM6ICR7bWludH0gd2FzIHF1b3RlVG9rZW4sIGludmVydGluZyBwcmljZSAke3BhaXIucHJpY2VVc2R9IC0+ICR7aW52ZXJ0ZWRQcmljZX1gLFxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICBwYWlyID0ge1xuICAgICAgICAgICAgICAgICAgLi4ucGFpcixcbiAgICAgICAgICAgICAgICAgIGJhc2VUb2tlbjogcGFpci5xdW90ZVRva2VuLFxuICAgICAgICAgICAgICAgICAgcXVvdGVUb2tlbjogcGFpci5iYXNlVG9rZW4sXG4gICAgICAgICAgICAgICAgICBwcmljZVVzZDogaW52ZXJ0ZWRQcmljZSxcbiAgICAgICAgICAgICAgICAgIHByaWNlTmF0aXZlOiBwYWlyLnByaWNlTmF0aXZlXG4gICAgICAgICAgICAgICAgICAgID8gKDEgLyBwYXJzZUZsb2F0KHBhaXIucHJpY2VOYXRpdmUpKS50b1N0cmluZygpXG4gICAgICAgICAgICAgICAgICAgIDogXCIwXCIsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgICAgIGBbRGV4U2NyZWVuZXJdIFx1MjcwNSBGb3VuZCAke21pbnR9IHZpYSBwYWlyIGFkZHJlc3MsIGJhc2VUb2tlbj0ke3BhaXIuYmFzZVRva2VuPy5zeW1ib2wgfHwgXCJVTktOT1dOXCJ9LCBwcmljZVVzZDogJHtwYWlyLnByaWNlVXNkIHx8IFwiTi9BXCJ9YCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHBhaXIpO1xuICAgICAgICAgICAgICBmb3VuZE1pbnRzU2V0LmFkZChtaW50KTtcbiAgICAgICAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICAgIGBbRGV4U2NyZWVuZXJdIFBhaXIgbG9va3VwIHJldHVybmVkIG5vIHBhaXJzIGZvciAke21pbnR9YCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIChwYWlyRXJyKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICAgIGBbRGV4U2NyZWVuZXJdIFx1MjZBMFx1RkUwRiBQYWlyIGFkZHJlc3MgbG9va3VwIGZhaWxlZCBmb3IgJHttaW50fTpgLFxuICAgICAgICAgICAgICBwYWlyRXJyIGluc3RhbmNlb2YgRXJyb3IgPyBwYWlyRXJyLm1lc3NhZ2UgOiBTdHJpbmcocGFpckVyciksXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHBhaXIgbG9va3VwIGZhaWxlZCBvciB1bmF2YWlsYWJsZSwgdHJ5IHNlYXJjaC1iYXNlZCBsb29rdXBcbiAgICAgICAgaWYgKCFmb3VuZCkge1xuICAgICAgICAgIGNvbnN0IHNlYXJjaFN5bWJvbCA9IE1JTlRfVE9fU0VBUkNIX1NZTUJPTFttaW50XTtcbiAgICAgICAgICBpZiAoc2VhcmNoU3ltYm9sKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICAgICBgW0RleFNjcmVlbmVyXSBTZWFyY2hpbmcgZm9yICR7bWludH0gdXNpbmcgc3ltYm9sOiAke3NlYXJjaFN5bWJvbH1gLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICBjb25zdCBzZWFyY2hEYXRhID0gYXdhaXQgZmV0Y2hEZXhzY3JlZW5lckRhdGEoXG4gICAgICAgICAgICAgICAgYC9zZWFyY2gvP3E9JHtlbmNvZGVVUklDb21wb25lbnQoc2VhcmNoU3ltYm9sKX1gLFxuICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgIGlmIChzZWFyY2hEYXRhPy5wYWlycyAmJiBBcnJheS5pc0FycmF5KHNlYXJjaERhdGEucGFpcnMpKSB7XG4gICAgICAgICAgICAgICAgLy8gRmluZCB0aGUgcGFpciB0aGF0IG1hdGNoZXMgb3VyIG1pbnRcbiAgICAgICAgICAgICAgICAvLyBMb29rIGZvciBwYWlycyB3aGVyZSB0aGlzIHRva2VuIGlzIHRoZSBiYXNlIG9uIFNvbGFuYVxuICAgICAgICAgICAgICAgIGxldCBtYXRjaGluZ1BhaXIgPSBzZWFyY2hEYXRhLnBhaXJzLmZpbmQoXG4gICAgICAgICAgICAgICAgICAocCkgPT5cbiAgICAgICAgICAgICAgICAgICAgcC5iYXNlVG9rZW4/LmFkZHJlc3MgPT09IG1pbnQgJiYgcC5jaGFpbklkID09PSBcInNvbGFuYVwiLFxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICAvLyBJZiBub3QgZm91bmQgYXMgYmFzZSBvbiBTb2xhbmEsIHRyeSBhcyBxdW90ZSB0b2tlbiBvbiBTb2xhbmFcbiAgICAgICAgICAgICAgICBpZiAoIW1hdGNoaW5nUGFpcikge1xuICAgICAgICAgICAgICAgICAgbWF0Y2hpbmdQYWlyID0gc2VhcmNoRGF0YS5wYWlycy5maW5kKFxuICAgICAgICAgICAgICAgICAgICAocCkgPT5cbiAgICAgICAgICAgICAgICAgICAgICBwLnF1b3RlVG9rZW4/LmFkZHJlc3MgPT09IG1pbnQgJiYgcC5jaGFpbklkID09PSBcInNvbGFuYVwiLFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBJZiBzdGlsbCBub3QgZm91bmQgb24gU29sYW5hLCB0cnkgYW55IGNoYWluIGFzIGJhc2VcbiAgICAgICAgICAgICAgICBpZiAoIW1hdGNoaW5nUGFpcikge1xuICAgICAgICAgICAgICAgICAgbWF0Y2hpbmdQYWlyID0gc2VhcmNoRGF0YS5wYWlycy5maW5kKFxuICAgICAgICAgICAgICAgICAgICAocCkgPT4gcC5iYXNlVG9rZW4/LmFkZHJlc3MgPT09IG1pbnQsXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIElmIHN0aWxsIG5vdCBmb3VuZCwgdHJ5IGFzIHF1b3RlIG9uIGFueSBjaGFpblxuICAgICAgICAgICAgICAgIGlmICghbWF0Y2hpbmdQYWlyKSB7XG4gICAgICAgICAgICAgICAgICBtYXRjaGluZ1BhaXIgPSBzZWFyY2hEYXRhLnBhaXJzLmZpbmQoXG4gICAgICAgICAgICAgICAgICAgIChwKSA9PiBwLnF1b3RlVG9rZW4/LmFkZHJlc3MgPT09IG1pbnQsXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIExhc3QgcmVzb3J0OiBqdXN0IHRha2UgdGhlIGZpcnN0IHJlc3VsdFxuICAgICAgICAgICAgICAgIGlmICghbWF0Y2hpbmdQYWlyICYmIHNlYXJjaERhdGEucGFpcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgbWF0Y2hpbmdQYWlyID0gc2VhcmNoRGF0YS5wYWlyc1swXTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobWF0Y2hpbmdQYWlyKSB7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICAgICAgICAgYFtEZXhTY3JlZW5lcl0gXHUyNzA1IEZvdW5kICR7c2VhcmNoU3ltYm9sfSAoJHttaW50fSkgdmlhIHNlYXJjaCwgY2hhaW5JZDogJHttYXRjaGluZ1BhaXIuY2hhaW5JZH0sIHByaWNlVXNkOiAke21hdGNoaW5nUGFpci5wcmljZVVzZCB8fCBcIk4vQVwifWAsXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKG1hdGNoaW5nUGFpcik7XG4gICAgICAgICAgICAgICAgICBmb3VuZE1pbnRzU2V0LmFkZChtaW50KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICAgICAgICBgW0RleFNjcmVlbmVyXSBcdTI2QTBcdUZFMEYgU2VhcmNoIHJldHVybmVkIDAgcmVzdWx0cyBmb3IgJHttaW50fWAsXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoc2VhcmNoRXJyKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICAgICAgICBgW0RleFNjcmVlbmVyXSBcdTI2QTBcdUZFMEYgU2VhcmNoIGZhbGxiYWNrIGZhaWxlZCBmb3IgJHttaW50fTpgLFxuICAgICAgICAgICAgICAgIHNlYXJjaEVyciBpbnN0YW5jZW9mIEVycm9yXG4gICAgICAgICAgICAgICAgICA/IHNlYXJjaEVyci5tZXNzYWdlXG4gICAgICAgICAgICAgICAgICA6IFN0cmluZyhzZWFyY2hFcnIpLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHNvbGFuYVBhaXJzID0gbWVyZ2VQYWlyc0J5VG9rZW4ocmVzdWx0cylcbiAgICAgIC5maWx0ZXIoKHBhaXI6IERleHNjcmVlbmVyVG9rZW4pID0+IHBhaXIuY2hhaW5JZCA9PT0gXCJzb2xhbmFcIilcbiAgICAgIC5zb3J0KChhOiBEZXhzY3JlZW5lclRva2VuLCBiOiBEZXhzY3JlZW5lclRva2VuKSA9PiB7XG4gICAgICAgIGNvbnN0IGFMaXF1aWRpdHkgPSBhLmxpcXVpZGl0eT8udXNkIHx8IDA7XG4gICAgICAgIGNvbnN0IGJMaXF1aWRpdHkgPSBiLmxpcXVpZGl0eT8udXNkIHx8IDA7XG4gICAgICAgIGlmIChiTGlxdWlkaXR5ICE9PSBhTGlxdWlkaXR5KSByZXR1cm4gYkxpcXVpZGl0eSAtIGFMaXF1aWRpdHk7XG5cbiAgICAgICAgY29uc3QgYVZvbHVtZSA9IGEudm9sdW1lPy5oMjQgfHwgMDtcbiAgICAgICAgY29uc3QgYlZvbHVtZSA9IGIudm9sdW1lPy5oMjQgfHwgMDtcbiAgICAgICAgcmV0dXJuIGJWb2x1bWUgLSBhVm9sdW1lO1xuICAgICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbRGV4U2NyZWVuZXJdIFx1MjcwNSBSZXNwb25zZTogJHtzb2xhbmFQYWlycy5sZW5ndGh9IFNvbGFuYSBwYWlycyBmb3VuZCBhY3Jvc3MgJHtiYXRjaGVzLmxlbmd0aH0gYmF0Y2goZXMpYCArXG4gICAgICAgIChtaXNzaW5nTWludHMubGVuZ3RoID4gMFxuICAgICAgICAgID8gYCAoJHttaXNzaW5nTWludHMubGVuZ3RofSByZXF1aXJlZCBzZWFyY2ggZmFsbGJhY2spYFxuICAgICAgICAgIDogXCJcIiksXG4gICAgKTtcbiAgICByZXMuanNvbih7IHNjaGVtYVZlcnNpb24sIHBhaXJzOiBzb2xhbmFQYWlycyB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiW0RleFNjcmVlbmVyXSBcdTI3NEMgVG9rZW5zIHByb3h5IGVycm9yOlwiLCB7XG4gICAgICBtaW50czogcmVxLnF1ZXJ5Lm1pbnRzLFxuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICAgIHN0YWNrOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3Iuc3RhY2sgOiB1bmRlZmluZWQsXG4gICAgfSk7XG5cbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBlcnJvcjoge1xuICAgICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgZXJyb3JcIixcbiAgICAgICAgZGV0YWlsczogU3RyaW5nKGVycm9yKSxcbiAgICAgIH0sXG4gICAgICBzY2hlbWFWZXJzaW9uOiBcIjEuMC4wXCIsXG4gICAgICBwYWlyczogW10sXG4gICAgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVEZXhzY3JlZW5lclNlYXJjaDogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHEgfSA9IHJlcS5xdWVyeTtcblxuICAgIGlmICghcSB8fCB0eXBlb2YgcSAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IFwiTWlzc2luZyBvciBpbnZhbGlkICdxJyBwYXJhbWV0ZXIgZm9yIHNlYXJjaCBxdWVyeS5cIixcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKGBbRGV4U2NyZWVuZXJdIFNlYXJjaCByZXF1ZXN0IGZvcjogJHtxfWApO1xuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IGZldGNoRGV4c2NyZWVuZXJEYXRhKFxuICAgICAgYC9zZWFyY2gvP3E9JHtlbmNvZGVVUklDb21wb25lbnQocSl9YCxcbiAgICApO1xuXG4gICAgLy8gRmlsdGVyIGZvciBTb2xhbmEgcGFpcnMgYW5kIGxpbWl0IHJlc3VsdHNcbiAgICBjb25zdCBzb2xhbmFQYWlycyA9IChkYXRhLnBhaXJzIHx8IFtdKVxuICAgICAgLmZpbHRlcigocGFpcjogRGV4c2NyZWVuZXJUb2tlbikgPT4gcGFpci5jaGFpbklkID09PSBcInNvbGFuYVwiKVxuICAgICAgLnNsaWNlKDAsIDIwKTsgLy8gTGltaXQgdG8gMjAgcmVzdWx0c1xuXG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0RleFNjcmVlbmVyXSBcdTI3MDUgU2VhcmNoIHJlc3BvbnNlOiAke3NvbGFuYVBhaXJzLmxlbmd0aH0gcmVzdWx0c2AsXG4gICAgKTtcbiAgICByZXMuanNvbih7XG4gICAgICBzY2hlbWFWZXJzaW9uOiBkYXRhLnNjaGVtYVZlcnNpb24gfHwgXCIxLjAuMFwiLFxuICAgICAgcGFpcnM6IHNvbGFuYVBhaXJzLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJbRGV4U2NyZWVuZXJdIFx1Mjc0QyBTZWFyY2ggcHJveHkgZXJyb3I6XCIsIHtcbiAgICAgIHF1ZXJ5OiByZXEucXVlcnkucSxcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgfSk7XG5cbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBlcnJvcjoge1xuICAgICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgZXJyb3JcIixcbiAgICAgICAgZGV0YWlsczogU3RyaW5nKGVycm9yKSxcbiAgICAgIH0sXG4gICAgICBzY2hlbWFWZXJzaW9uOiBcIjEuMC4wXCIsXG4gICAgICBwYWlyczogW10sXG4gICAgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVEZXhzY3JlZW5lclRyZW5kaW5nOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnNvbGUubG9nKFwiW0RleFNjcmVlbmVyXSBUcmVuZGluZyB0b2tlbnMgcmVxdWVzdFwiKTtcblxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBmZXRjaERleHNjcmVlbmVyRGF0YShcIi9wYWlycy9zb2xhbmFcIik7XG5cbiAgICAvLyBHZXQgdG9wIHRyZW5kaW5nIHBhaXJzLCBzb3J0ZWQgYnkgdm9sdW1lIGFuZCBsaXF1aWRpdHlcbiAgICBjb25zdCB0cmVuZGluZ1BhaXJzID0gKGRhdGEucGFpcnMgfHwgW10pXG4gICAgICAuZmlsdGVyKFxuICAgICAgICAocGFpcjogRGV4c2NyZWVuZXJUb2tlbikgPT5cbiAgICAgICAgICBwYWlyLnZvbHVtZT8uaDI0ID4gMTAwMCAmJiAvLyBNaW5pbXVtIHZvbHVtZSBmaWx0ZXJcbiAgICAgICAgICBwYWlyLmxpcXVpZGl0eT8udXNkICYmXG4gICAgICAgICAgcGFpci5saXF1aWRpdHkudXNkID4gMTAwMDAsIC8vIE1pbmltdW0gbGlxdWlkaXR5IGZpbHRlclxuICAgICAgKVxuICAgICAgLnNvcnQoKGE6IERleHNjcmVlbmVyVG9rZW4sIGI6IERleHNjcmVlbmVyVG9rZW4pID0+IHtcbiAgICAgICAgLy8gU29ydCBieSAyNGggdm9sdW1lXG4gICAgICAgIGNvbnN0IGFWb2x1bWUgPSBhLnZvbHVtZT8uaDI0IHx8IDA7XG4gICAgICAgIGNvbnN0IGJWb2x1bWUgPSBiLnZvbHVtZT8uaDI0IHx8IDA7XG4gICAgICAgIHJldHVybiBiVm9sdW1lIC0gYVZvbHVtZTtcbiAgICAgIH0pXG4gICAgICAuc2xpY2UoMCwgNTApOyAvLyBUb3AgNTAgdHJlbmRpbmdcblxuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYFtEZXhTY3JlZW5lcl0gXHUyNzA1IFRyZW5kaW5nIHJlc3BvbnNlOiAke3RyZW5kaW5nUGFpcnMubGVuZ3RofSB0cmVuZGluZyBwYWlyc2AsXG4gICAgKTtcbiAgICByZXMuanNvbih7XG4gICAgICBzY2hlbWFWZXJzaW9uOiBkYXRhLnNjaGVtYVZlcnNpb24gfHwgXCIxLjAuMFwiLFxuICAgICAgcGFpcnM6IHRyZW5kaW5nUGFpcnMsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIltEZXhTY3JlZW5lcl0gXHUyNzRDIFRyZW5kaW5nIHByb3h5IGVycm9yOlwiLCB7XG4gICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgIH0pO1xuXG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgZXJyb3I6IHtcbiAgICAgICAgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIkludGVybmFsIGVycm9yXCIsXG4gICAgICAgIGRldGFpbHM6IFN0cmluZyhlcnJvciksXG4gICAgICB9LFxuICAgICAgc2NoZW1hVmVyc2lvbjogXCIxLjAuMFwiLFxuICAgICAgcGFpcnM6IFtdLFxuICAgIH0pO1xuICB9XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2RleHNjcmVlbmVyLXByaWNlLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvZGV4c2NyZWVuZXItcHJpY2UudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbi8vIEltcG9ydCB0aGUgc2hhcmVkIGZldGNoIGZ1bmN0aW9uIGZyb20gZGV4c2NyZWVuZXItcHJveHlcbmltcG9ydCB7IGZldGNoRGV4c2NyZWVuZXJEYXRhLCBNSU5UX1RPX1BBSVJfQUREUkVTUyB9IGZyb20gXCIuL2RleHNjcmVlbmVyLXByb3h5XCI7XG5cbmludGVyZmFjZSBEZXhzY3JlZW5lclRva2VuIHtcbiAgY2hhaW5JZDogc3RyaW5nO1xuICBiYXNlVG9rZW46IHtcbiAgICBhZGRyZXNzOiBzdHJpbmc7XG4gICAgc3ltYm9sPzogc3RyaW5nO1xuICB9O1xuICBxdW90ZVRva2VuOiB7XG4gICAgYWRkcmVzczogc3RyaW5nO1xuICB9O1xuICBwcmljZVVzZD86IHN0cmluZztcbiAgcHJpY2VDaGFuZ2U/OiB7XG4gICAgaDI0PzogbnVtYmVyO1xuICB9O1xuICB2b2x1bWU/OiB7XG4gICAgaDI0PzogbnVtYmVyO1xuICB9O1xuICBtYXJrZXRDYXA/OiBudW1iZXI7XG59XG5cbmNvbnN0IFRPS0VOX01JTlRTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBTT0w6IFwiU28xMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMlwiLFxuICBVU0RDOiBcIkVQakZXZGQ1QXVmcVNTcWVNMnFOMXh6eWJhcEM4RzR3RUdHa1p3eVREdDF2XCIsXG4gIFVTRFQ6IFwiRXM5dk1GcnphQ0VSbUpmckY0SDJGWUQ0S0NvTmtZMTFNY0NlOEJlbkVuc1wiLFxuICBGSVhFUkNPSU46IFwiSDRxS244Rk1GaGE4akp1ajh4TXJ5TXFSaEgzaDdHakx1eHc3VFZpeHB1bXBcIixcbiAgTE9DS0VSOiBcIkVOMW5Zclc2Mzc1ek1QVWtwa0d5R1NFWFc4V21BcVl1NHloZjZ4bkdwdW1wXCIsXG59O1xuXG5jb25zdCBGQUxMQkFDS19VU0Q6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gIEZJWEVSQ09JTjogMC4wMDUsXG4gIFNPTDogMTgwLFxuICBVU0RDOiAxLjAsXG4gIFVTRFQ6IDEuMCxcbiAgTE9DS0VSOiAwLjEsXG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlRGV4c2NyZWVuZXJQcmljZTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHRva2VuIH0gPSByZXEucXVlcnk7XG5cbiAgICBpZiAoIXRva2VuIHx8IHR5cGVvZiB0b2tlbiAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6IFwiTWlzc2luZyAndG9rZW4nIHBhcmFtZXRlclwiIH0pO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKGBbRGV4U2NyZWVuZXIgUHJpY2VdIEZldGNoaW5nIHByaWNlIGZvciB0b2tlbjogJHt0b2tlbn1gKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgZmV0Y2hEZXhzY3JlZW5lckRhdGEoYC90b2tlbnMvJHt0b2tlbn1gKTtcbiAgICAgIGNvbnN0IHBhaXIgPSBkYXRhPy5wYWlycz8uWzBdO1xuXG4gICAgICBpZiAoIXBhaXIpIHtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6IFwiVG9rZW4gbm90IGZvdW5kIG9uIERleFNjcmVlbmVyXCIgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXMuanNvbih7XG4gICAgICAgIHRva2VuLFxuICAgICAgICBwcmljZTogcGFyc2VGbG9hdChwYWlyLnByaWNlVXNkIHx8IFwiMFwiKSxcbiAgICAgICAgcHJpY2VVc2Q6IHBhaXIucHJpY2VVc2QsXG4gICAgICAgIGRhdGE6IHBhaXIsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihgW0RleFNjcmVlbmVyIFByaWNlXSBGZXRjaCBlcnJvcjpgLCBlcnJvcik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDIpLmpzb24oe1xuICAgICAgICBlcnJvcjogXCJGYWlsZWQgdG8gZmV0Y2ggdG9rZW4gcHJpY2UgZnJvbSBEZXhTY3JlZW5lclwiLFxuICAgICAgICBkZXRhaWxzOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICB9KTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihgW0RleFNjcmVlbmVyIFByaWNlXSBIYW5kbGVyIGVycm9yOmAsIGVycm9yKTtcbiAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgZXJyb3I6IFwiRmFpbGVkIHRvIHByb2Nlc3MgcHJpY2UgcmVxdWVzdFwiLFxuICAgICAgZGV0YWlsczogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlU29sUHJpY2U6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgU09MX01JTlQgPSBcIlNvMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTJcIjtcbiAgICBjb25zb2xlLmxvZyhgW1NPTCBQcmljZV0gRmV0Y2hpbmcgcHJpY2UgZm9yIFNPTGApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBmZXRjaERleHNjcmVlbmVyRGF0YShgL3Rva2Vucy8ke1NPTF9NSU5UfWApO1xuICAgICAgY29uc3QgcGFpciA9IGRhdGE/LnBhaXJzPy5bMF07XG5cbiAgICAgIGlmICghcGFpcikge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJTT0wgcHJpY2UgZGF0YSBub3QgZm91bmRcIiB9KTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcHJpY2VVc2QgPSBwYXJzZUZsb2F0KHBhaXIucHJpY2VVc2QgfHwgXCIwXCIpO1xuXG4gICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICB0b2tlbjogXCJTT0xcIixcbiAgICAgICAgcHJpY2U6IHByaWNlVXNkLFxuICAgICAgICBwcmljZVVzZCxcbiAgICAgICAgcHJpY2VDaGFuZ2UyNGg6IHBhaXIucHJpY2VDaGFuZ2U/LmgyNCB8fCAwLFxuICAgICAgICB2b2x1bWUyNGg6IHBhaXIudm9sdW1lPy5oMjQgfHwgMCxcbiAgICAgICAgbWFya2V0Q2FwOiBwYWlyLm1hcmtldENhcCB8fCAwLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYFtTT0wgUHJpY2VdIERleFNjcmVlbmVyIGZldGNoIGVycm9yOmAsIGVycm9yKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMikuanNvbih7XG4gICAgICAgIGVycm9yOiBcIkZhaWxlZCB0byBmZXRjaCBTT0wgcHJpY2VcIixcbiAgICAgICAgZGV0YWlsczogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgfSk7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoYFtTT0wgUHJpY2VdIEhhbmRsZXIgZXJyb3I6YCwgZXJyb3IpO1xuICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBlcnJvcjogXCJGYWlsZWQgdG8gZmV0Y2ggU09MIHByaWNlXCIsXG4gICAgICBkZXRhaWxzOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVUb2tlblByaWNlOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHRva2VuUGFyYW0gPSAoXG4gICAgICAocmVxLnF1ZXJ5LnRva2VuIGFzIHN0cmluZykgfHxcbiAgICAgIChyZXEucXVlcnkuc3ltYm9sIGFzIHN0cmluZykgfHxcbiAgICAgIFwiRklYRVJDT0lOXCJcbiAgICApLnRvVXBwZXJDYXNlKCk7XG4gICAgY29uc3QgbWludFBhcmFtID0gKHJlcS5xdWVyeS5taW50IGFzIHN0cmluZykgfHwgXCJcIjtcblxuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYFtUb2tlbiBQcmljZV0gUmVxdWVzdCBmb3IgdG9rZW46ICR7dG9rZW5QYXJhbX0sIG1pbnQ6ICR7bWludFBhcmFtfWAsXG4gICAgKTtcblxuICAgIGNvbnN0IFBLUl9QRVJfVVNEID0gMjgwO1xuICAgIGNvbnN0IE1BUktVUCA9IDEuMDQyNTtcblxuICAgIGxldCB0b2tlbiA9IHRva2VuUGFyYW07XG4gICAgbGV0IG1pbnQgPSBtaW50UGFyYW0gfHwgVE9LRU5fTUlOVFNbdG9rZW5dIHx8IFwiXCI7XG5cbiAgICBpZiAoIW1pbnQgJiYgdG9rZW5QYXJhbSAmJiB0b2tlblBhcmFtLmxlbmd0aCA+IDQwKSB7XG4gICAgICBtaW50ID0gdG9rZW5QYXJhbTtcbiAgICAgIGNvbnN0IGludiA9IE9iamVjdC5lbnRyaWVzKFRPS0VOX01JTlRTKS5maW5kKChbLCBtXSkgPT4gbSA9PT0gbWludCk7XG4gICAgICBpZiAoaW52KSB0b2tlbiA9IGludlswXTtcbiAgICB9XG5cbiAgICBsZXQgcHJpY2VVc2Q6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gICAgdHJ5IHtcbiAgICAgIGlmICh0b2tlbiA9PT0gXCJVU0RDXCIgfHwgdG9rZW4gPT09IFwiVVNEVFwiKSB7XG4gICAgICAgIHByaWNlVXNkID0gMS4wO1xuICAgICAgfSBlbHNlIGlmIChtaW50KSB7XG4gICAgICAgIGNvbnN0IHBhaXJBZGRyZXNzID0gTUlOVF9UT19QQUlSX0FERFJFU1NbbWludF07XG4gICAgICAgIGlmIChwYWlyQWRkcmVzcykge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwYWlyRGF0YSA9IGF3YWl0IGZldGNoRGV4c2NyZWVuZXJEYXRhKFxuICAgICAgICAgICAgICBgL3BhaXJzL3NvbGFuYS8ke3BhaXJBZGRyZXNzfWAsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgY29uc3QgcGFpciA9XG4gICAgICAgICAgICAgIHBhaXJEYXRhPy5wYWlyIHx8IChwYWlyRGF0YT8ucGFpcnMgfHwgW10pWzBdIHx8IG51bGw7XG4gICAgICAgICAgICBpZiAocGFpciAmJiBwYWlyLnByaWNlVXNkKSB7XG4gICAgICAgICAgICAgIHByaWNlVXNkID0gcGFyc2VGbG9hdChwYWlyLnByaWNlVXNkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFtUb2tlbiBQcmljZV0gUGFpciBhZGRyZXNzIGxvb2t1cCBmYWlsZWQ6YCwgZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHByaWNlVXNkID09PSBudWxsKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRva2VuRGF0YSA9IGF3YWl0IGZldGNoRGV4c2NyZWVuZXJEYXRhKGAvdG9rZW5zLyR7bWludH1gKTtcbiAgICAgICAgICAgIGNvbnN0IHBhaXJzID0gQXJyYXkuaXNBcnJheSh0b2tlbkRhdGE/LnBhaXJzKVxuICAgICAgICAgICAgICA/IHRva2VuRGF0YS5wYWlyc1xuICAgICAgICAgICAgICA6IFtdO1xuXG4gICAgICAgICAgICBsZXQgbWF0Y2hpbmdQYWlyID0gbnVsbDtcblxuICAgICAgICAgICAgaWYgKHBhaXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgbWF0Y2hpbmdQYWlyID0gcGFpcnMuZmluZChcbiAgICAgICAgICAgICAgICAocDogRGV4c2NyZWVuZXJUb2tlbikgPT5cbiAgICAgICAgICAgICAgICAgIHA/LmJhc2VUb2tlbj8uYWRkcmVzcyA9PT0gbWludCAmJlxuICAgICAgICAgICAgICAgICAgcD8uY2hhaW5JZCA9PT0gXCJzb2xhbmFcIixcbiAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICBpZiAoIW1hdGNoaW5nUGFpcikge1xuICAgICAgICAgICAgICAgIG1hdGNoaW5nUGFpciA9IHBhaXJzLmZpbmQoXG4gICAgICAgICAgICAgICAgICAocDogRGV4c2NyZWVuZXJUb2tlbikgPT5cbiAgICAgICAgICAgICAgICAgICAgcD8ucXVvdGVUb2tlbj8uYWRkcmVzcyA9PT0gbWludCAmJlxuICAgICAgICAgICAgICAgICAgICBwPy5jaGFpbklkID09PSBcInNvbGFuYVwiLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBpZiAoIW1hdGNoaW5nUGFpcikge1xuICAgICAgICAgICAgICAgIG1hdGNoaW5nUGFpciA9IHBhaXJzLmZpbmQoXG4gICAgICAgICAgICAgICAgICAocDogRGV4c2NyZWVuZXJUb2tlbikgPT5cbiAgICAgICAgICAgICAgICAgICAgcD8uYmFzZVRva2VuPy5hZGRyZXNzID09PSBtaW50IHx8XG4gICAgICAgICAgICAgICAgICAgIHA/LnF1b3RlVG9rZW4/LmFkZHJlc3MgPT09IG1pbnQsXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGlmIChtYXRjaGluZ1BhaXIgJiYgbWF0Y2hpbmdQYWlyLnByaWNlVXNkKSB7XG4gICAgICAgICAgICAgICAgcHJpY2VVc2QgPSBwYXJzZUZsb2F0KG1hdGNoaW5nUGFpci5wcmljZVVzZCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFtUb2tlbiBQcmljZV0gVG9rZW4gbG9va3VwIGZhaWxlZDpgLCBlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLndhcm4oYFtUb2tlbiBQcmljZV0gUHJpY2UgbG9va3VwIGVycm9yOmAsIGUpO1xuICAgIH1cblxuICAgIGlmIChwcmljZVVzZCA9PT0gbnVsbCB8fCAhaXNGaW5pdGUocHJpY2VVc2QpIHx8IHByaWNlVXNkIDw9IDApIHtcbiAgICAgIHByaWNlVXNkID0gRkFMTEJBQ0tfVVNEW3Rva2VuXSA/PyBGQUxMQkFDS19VU0QuRklYRVJDT0lOO1xuICAgIH1cblxuICAgIGNvbnN0IHJhdGVJblBLUiA9IHByaWNlVXNkICogUEtSX1BFUl9VU0QgKiBNQVJLVVA7XG5cbiAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgdG9rZW4sXG4gICAgICBwcmljZVVzZCxcbiAgICAgIHByaWNlSW5QS1I6IHJhdGVJblBLUixcbiAgICAgIHJhdGU6IHJhdGVJblBLUixcbiAgICAgIHBrclBlclVzZDogUEtSX1BFUl9VU0QsXG4gICAgICBtYXJrdXA6IE1BUktVUCxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKGBbVG9rZW4gUHJpY2VdIEhhbmRsZXIgZXJyb3I6YCwgZXJyb3IpO1xuICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBlcnJvcjogXCJGYWlsZWQgdG8gZ2V0IHRva2VuIHByaWNlXCIsXG4gICAgICBkZXRhaWxzOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgfSk7XG4gIH1cbn07XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvY29pbm1hcmtldGNhcC1wcm94eS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2NvaW5tYXJrZXRjYXAtcHJveHkudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbi8qKlxuICogQ29pbk1hcmtldENhcCBBUEkgUHJveHlcbiAqIFByb3ZpZGVzIHNlcnZlci1zaWRlIGFjY2VzcyB0byBDb2luTWFya2V0Q2FwIEFQSSB3aXRoIEFQSSBrZXkgbWFuYWdlbWVudFxuICovXG5cbmNvbnN0IENNQ19BUElfS0VZID0gcHJvY2Vzcy5lbnYuQ09JTk1BUktFVENBUF9BUElfS0VZIHx8IFwiXCI7XG5jb25zdCBDTUNfQkFTRV9VUkwgPSBcImh0dHBzOi8vcHJvLWFwaS5jb2lubWFya2V0Y2FwLmNvbS92MVwiO1xuXG5leHBvcnQgY29uc3QgaGFuZGxlQ29pbk1hcmtldENhcFF1b3RlczogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBzeW1ib2xzID0gcmVxLnF1ZXJ5LnN5bWJvbHMgYXMgc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG4gICAgaWYgKCFzeW1ib2xzIHx8ICFzeW1ib2xzLnRyaW0oKSkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IFwiTWlzc2luZyBvciBlbXB0eSAnc3ltYm9scycgcXVlcnkgcGFyYW1ldGVyXCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBJZiBubyBBUEkga2V5IGNvbmZpZ3VyZWQsIHJldHVybiBoZWxwZnVsIGVycm9yXG4gICAgaWYgKCFDTUNfQVBJX0tFWSkge1xuICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICBcIltDb2luTWFya2V0Q2FwXSBObyBBUEkga2V5IGNvbmZpZ3VyZWQgLSBzZXQgQ09JTk1BUktFVENBUF9BUElfS0VZIGVudmlyb25tZW50IHZhcmlhYmxlXCIsXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNTAzKS5qc29uKHtcbiAgICAgICAgZXJyb3I6XG4gICAgICAgICAgXCJDb2luTWFya2V0Q2FwIEFQSSBrZXkgbm90IGNvbmZpZ3VyZWQgb24gc2VydmVyLiBQbGVhc2UgYWRkIENPSU5NQVJLRVRDQVBfQVBJX0tFWSB0byBlbnZpcm9ubWVudCB2YXJpYWJsZXMuXCIsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbQ29pbk1hcmtldENhcF0gRmV0Y2hpbmcgcXVvdGVzIGZvciBzeW1ib2xzOiAke3N5bWJvbHMuc3Vic3RyaW5nKDAsIDEwMCl9YCxcbiAgICApO1xuXG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBjb25zdCB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgMTUwMDApO1xuXG4gICAgY29uc3QgdXJsID0gbmV3IFVSTChgJHtDTUNfQkFTRV9VUkx9L2NyeXB0b2N1cnJlbmN5L3F1b3Rlcy9sYXRlc3RgKTtcbiAgICB1cmwuc2VhcmNoUGFyYW1zLmFwcGVuZChcInN5bWJvbFwiLCBzeW1ib2xzKTtcbiAgICB1cmwuc2VhcmNoUGFyYW1zLmFwcGVuZChcImNvbnZlcnRcIiwgXCJVU0RcIik7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybC50b1N0cmluZygpLCB7XG4gICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIFwiWC1DTUNfUFJPX0FQSV9LRVlcIjogQ01DX0FQSV9LRVksXG4gICAgICAgIEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgfSxcbiAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgfSk7XG5cbiAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcblxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgIGNvbnN0IGVycm9yVGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKS5jYXRjaCgoKSA9PiBcIlwiKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgIGBbQ29pbk1hcmtldENhcF0gQVBJIGVycm9yOiAke3Jlc3BvbnNlLnN0YXR1c30gJHtyZXNwb25zZS5zdGF0dXNUZXh0fWAsXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMocmVzcG9uc2Uuc3RhdHVzKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IGBDb2luTWFya2V0Q2FwIEFQSSBlcnJvcjogJHtyZXNwb25zZS5zdGF0dXN9YCxcbiAgICAgICAgZGV0YWlsczogZXJyb3JUZXh0LFxuICAgICAgICBkYXRhOiBudWxsLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblxuICAgIC8vIENoZWNrIGZvciBBUEktbGV2ZWwgZXJyb3JzXG4gICAgaWYgKGRhdGEuc3RhdHVzPy5lcnJvcl9jb2RlICE9PSAwKSB7XG4gICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgIGBbQ29pbk1hcmtldENhcF0gQVBJIHJldHVybmVkIGVycm9yOiAke2RhdGEuc3RhdHVzPy5lcnJvcl9tZXNzYWdlfWAsXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IGRhdGEuc3RhdHVzPy5lcnJvcl9tZXNzYWdlIHx8IFwiQ29pbk1hcmtldENhcCBBUEkgZXJyb3JcIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYFtDb2luTWFya2V0Q2FwXSBcdTI3MDUgR290IHF1b3RlcyBmb3IgJHtPYmplY3Qua2V5cyhkYXRhLmRhdGEgfHwge30pLmxlbmd0aH0gc3ltYm9sc2AsXG4gICAgKTtcblxuICAgIHJlcy5qc29uKGRhdGEpO1xuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgLy8gSGFuZGxlIGFib3J0L3RpbWVvdXRcbiAgICBpZiAoZXJyb3IubmFtZSA9PT0gXCJBYm9ydEVycm9yXCIpIHtcbiAgICAgIGNvbnNvbGUud2FybihcIltDb2luTWFya2V0Q2FwXSBSZXF1ZXN0IHRpbWVvdXRcIik7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDQpLmpzb24oe1xuICAgICAgICBlcnJvcjogXCJDb2luTWFya2V0Q2FwIHJlcXVlc3QgdGltZW91dFwiLFxuICAgICAgICBkYXRhOiBudWxsLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5lcnJvcihcIltDb2luTWFya2V0Q2FwXSBQcm94eSBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgc2VydmVyIGVycm9yXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlQ29pbk1hcmtldENhcFNlYXJjaDogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBxdWVyeSA9IHJlcS5xdWVyeS5xIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcblxuICAgIGlmICghcXVlcnkgfHwgIXF1ZXJ5LnRyaW0oKSkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IFwiTWlzc2luZyBvciBlbXB0eSAncScgcXVlcnkgcGFyYW1ldGVyXCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoIUNNQ19BUElfS0VZKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDMpLmpzb24oe1xuICAgICAgICBlcnJvcjpcbiAgICAgICAgICBcIkNvaW5NYXJrZXRDYXAgQVBJIGtleSBub3QgY29uZmlndXJlZC4gU2V0IENPSU5NQVJLRVRDQVBfQVBJX0tFWSBlbnZpcm9ubWVudCB2YXJpYWJsZS5cIixcbiAgICAgICAgZGF0YTogbnVsbCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKGBbQ29pbk1hcmtldENhcF0gU2VhcmNoaW5nIGZvcjogJHtxdWVyeX1gKTtcblxuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIDE1MDAwKTtcblxuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoYCR7Q01DX0JBU0VfVVJMfS9jcnlwdG9jdXJyZW5jeS9tYXBgKTtcbiAgICB1cmwuc2VhcmNoUGFyYW1zLmFwcGVuZChcInN5bWJvbFwiLCBxdWVyeS50b1VwcGVyQ2FzZSgpKTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLnRvU3RyaW5nKCksIHtcbiAgICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgXCJYLUNNQ19QUk9fQVBJX0tFWVwiOiBDTUNfQVBJX0tFWSxcbiAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICB9LFxuICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICB9KTtcblxuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgY29uc3QgZXJyb3JUZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpLmNhdGNoKCgpID0+IFwiXCIpO1xuICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgYFtDb2luTWFya2V0Q2FwXSBTZWFyY2ggZXJyb3I6ICR7cmVzcG9uc2Uuc3RhdHVzfSAke3Jlc3BvbnNlLnN0YXR1c1RleHR9YCxcbiAgICAgICk7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyhyZXNwb25zZS5zdGF0dXMpLmpzb24oe1xuICAgICAgICBlcnJvcjogYENvaW5NYXJrZXRDYXAgc2VhcmNoIGVycm9yOiAke3Jlc3BvbnNlLnN0YXR1c31gLFxuICAgICAgICBkZXRhaWxzOiBlcnJvclRleHQsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgIHJlcy5qc29uKGRhdGEpO1xuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgaWYgKGVycm9yLm5hbWUgPT09IFwiQWJvcnRFcnJvclwiKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDQpLmpzb24oe1xuICAgICAgICBlcnJvcjogXCJDb2luTWFya2V0Q2FwIHNlYXJjaCB0aW1lb3V0XCIsXG4gICAgICAgIGRhdGE6IG51bGwsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmVycm9yKFwiW0NvaW5NYXJrZXRDYXBdIFNlYXJjaCBwcm94eSBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgc2VydmVyIGVycm9yXCIsXG4gICAgICBkYXRhOiBudWxsLFxuICAgIH0pO1xuICB9XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2p1cGl0ZXItcHJveHkudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Jvb3QvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9qdXBpdGVyLXByb3h5LnRzXCI7aW1wb3J0IHsgUmVxdWVzdEhhbmRsZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5pbnRlcmZhY2UgSnVwaXRlclByaWNlUmVzcG9uc2Uge1xuICBkYXRhOiBSZWNvcmQ8c3RyaW5nLCB7IHByaWNlOiBudW1iZXIgfT47XG59XG5cbi8vIEp1cGl0ZXIgZW5kcG9pbnRzXG5jb25zdCBKVVBJVEVSX1BSSUNFX0VORFBPSU5UUyA9IFtcbiAgXCJodHRwczovL3ByaWNlLmp1cC5hZy92NFwiLFxuICBcImh0dHBzOi8vYXBpLmp1cC5hZy9wcmljZS92MlwiLFxuXTtcbmNvbnN0IEpVUElURVJfU1dBUF9CQVNFID0gXCJodHRwczovL2xpdGUtYXBpLmp1cC5hZy9zd2FwL3YxXCI7XG5cbmxldCBjdXJyZW50RW5kcG9pbnRJbmRleCA9IDA7XG5cbmNvbnN0IHRyeUp1cGl0ZXJFbmRwb2ludHMgPSBhc3luYyAoXG4gIHBhdGg6IHN0cmluZyxcbiAgcGFyYW1zOiBVUkxTZWFyY2hQYXJhbXMsXG4pOiBQcm9taXNlPGFueT4gPT4ge1xuICBsZXQgbGFzdEVycm9yOiBFcnJvciB8IG51bGwgPSBudWxsO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgSlVQSVRFUl9QUklDRV9FTkRQT0lOVFMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBlbmRwb2ludEluZGV4ID1cbiAgICAgIChjdXJyZW50RW5kcG9pbnRJbmRleCArIGkpICUgSlVQSVRFUl9QUklDRV9FTkRQT0lOVFMubGVuZ3RoO1xuICAgIGNvbnN0IGVuZHBvaW50ID0gSlVQSVRFUl9QUklDRV9FTkRQT0lOVFNbZW5kcG9pbnRJbmRleF07XG4gICAgY29uc3QgdXJsID0gYCR7ZW5kcG9pbnR9JHtwYXRofT8ke3BhcmFtcy50b1N0cmluZygpfWA7XG5cbiAgICB0cnkge1xuICAgICAgY29uc29sZS5sb2coYFRyeWluZyBKdXBpdGVyIEFQSTogJHt1cmx9YCk7XG5cbiAgICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgICBjb25zdCB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KCgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSwgMTUwMDApO1xuXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICBBY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChjb21wYXRpYmxlOyBTb2xhbmFXYWxsZXQvMS4wKVwiLFxuICAgICAgICB9LFxuICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgfSk7XG5cbiAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQyOSkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgUmF0ZSBsaW1pdGVkIG9uICR7ZW5kcG9pbnR9LCB0cnlpbmcgbmV4dC4uLmApO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgSFRUUCAke3Jlc3BvbnNlLnN0YXR1c306ICR7cmVzcG9uc2Uuc3RhdHVzVGV4dH1gKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblxuICAgICAgY3VycmVudEVuZHBvaW50SW5kZXggPSBlbmRwb2ludEluZGV4O1xuICAgICAgY29uc29sZS5sb2coYEp1cGl0ZXIgQVBJIGNhbGwgc3VjY2Vzc2Z1bCB2aWEgJHtlbmRwb2ludH1gKTtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zdCBlcnJvck1zZyA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbiAgICAgIGNvbnNvbGUud2FybihgSnVwaXRlciBlbmRwb2ludCAke2VuZHBvaW50fSBmYWlsZWQ6YCwgZXJyb3JNc2cpO1xuICAgICAgbGFzdEVycm9yID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yIDogbmV3IEVycm9yKFN0cmluZyhlcnJvcikpO1xuXG4gICAgICBpZiAoaSA8IEpVUElURVJfUFJJQ0VfRU5EUE9JTlRTLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMTAwMCkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHRocm93IG5ldyBFcnJvcihcbiAgICBgQWxsIEp1cGl0ZXIgZW5kcG9pbnRzIGZhaWxlZC4gTGFzdCBlcnJvcjogJHtsYXN0RXJyb3I/Lm1lc3NhZ2UgfHwgXCJVbmtub3duIGVycm9yXCJ9YCxcbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVKdXBpdGVyUHJpY2U6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBpZHMgfSA9IHJlcS5xdWVyeTtcblxuICAgIGlmICghaWRzIHx8IHR5cGVvZiBpZHMgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7XG4gICAgICAgIGVycm9yOlxuICAgICAgICAgIFwiTWlzc2luZyBvciBpbnZhbGlkICdpZHMnIHBhcmFtZXRlci4gRXhwZWN0ZWQgY29tbWEtc2VwYXJhdGVkIHRva2VuIG1pbnRzLlwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coYEp1cGl0ZXIgcHJpY2UgcmVxdWVzdCBmb3IgdG9rZW5zOiAke2lkc31gKTtcblxuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgICAgaWRzOiBpZHMsXG4gICAgfSk7XG5cbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdHJ5SnVwaXRlckVuZHBvaW50cyhcIi9wcmljZVwiLCBwYXJhbXMpO1xuXG4gICAgaWYgKCFkYXRhIHx8IHR5cGVvZiBkYXRhICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHJlc3BvbnNlIGZvcm1hdCBmcm9tIEp1cGl0ZXIgQVBJXCIpO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYEp1cGl0ZXIgcHJpY2UgcmVzcG9uc2U6ICR7T2JqZWN0LmtleXMoZGF0YS5kYXRhIHx8IHt9KS5sZW5ndGh9IHRva2Vuc2AsXG4gICAgKTtcbiAgICByZXMuanNvbihkYXRhKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiSnVwaXRlciBwcmljZSBwcm94eSBlcnJvcjpcIiwge1xuICAgICAgaWRzOiByZXEucXVlcnkuaWRzLFxuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSxcbiAgICAgIHN0YWNrOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3Iuc3RhY2sgOiB1bmRlZmluZWQsXG4gICAgfSk7XG5cbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBlcnJvcjoge1xuICAgICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgZXJyb3JcIixcbiAgICAgICAgZGV0YWlsczogU3RyaW5nKGVycm9yKSxcbiAgICAgIH0sXG4gICAgICBkYXRhOiB7fSxcbiAgICB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUp1cGl0ZXJUb2tlbnM6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyB0eXBlID0gXCJzdHJpY3RcIiB9ID0gcmVxLnF1ZXJ5IGFzIHsgdHlwZT86IHN0cmluZyB9O1xuXG4gICAgY29uc29sZS5sb2coYEp1cGl0ZXIgdG9rZW5zIHJlcXVlc3Q6ICR7dHlwZX1gKTtcblxuICAgIGNvbnN0IHR5cGVzVG9UcnkgPSBbdHlwZSB8fCBcInN0cmljdFwiLCBcImFsbFwiXTsgLy8gZmFsbGJhY2sgdG8gJ2FsbCcgaWYgJ3N0cmljdCcgZmFpbHNcbiAgICBjb25zdCBiYXNlRW5kcG9pbnRzID0gKHQ6IHN0cmluZykgPT4gW1xuICAgICAgYGh0dHBzOi8vdG9rZW4uanVwLmFnLyR7dH1gLFxuICAgICAgXCJodHRwczovL2NhY2hlLmp1cC5hZy90b2tlbnNcIixcbiAgICBdO1xuXG4gICAgY29uc3QgZmV0Y2hXaXRoVGltZW91dCA9ICh1cmw6IHN0cmluZywgdGltZW91dE1zOiBudW1iZXIpID0+IHtcbiAgICAgIGNvbnN0IHRpbWVvdXRQcm9taXNlID0gbmV3IFByb21pc2U8UmVzcG9uc2U+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgIHNldFRpbWVvdXQoXG4gICAgICAgICAgKCkgPT5cbiAgICAgICAgICAgIHJlc29sdmUoXG4gICAgICAgICAgICAgIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogNTA0LCBzdGF0dXNUZXh0OiBcIkdhdGV3YXkgVGltZW91dFwiIH0pLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICB0aW1lb3V0TXMsXG4gICAgICAgICk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBQcm9taXNlLnJhY2UoW1xuICAgICAgICBmZXRjaCh1cmwsIHtcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgICAgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKGNvbXBhdGlibGU7IFNvbGFuYVdhbGxldC8xLjApXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSksXG4gICAgICAgIHRpbWVvdXRQcm9taXNlLFxuICAgICAgXSkgYXMgUHJvbWlzZTxSZXNwb25zZT47XG4gICAgfTtcblxuICAgIGxldCBsYXN0RXJyb3I6IHN0cmluZyA9IFwiXCI7XG5cbiAgICBmb3IgKGNvbnN0IHQgb2YgdHlwZXNUb1RyeSkge1xuICAgICAgY29uc3QgZW5kcG9pbnRzID0gYmFzZUVuZHBvaW50cyh0KTtcbiAgICAgIGZvciAobGV0IGF0dGVtcHQgPSAxOyBhdHRlbXB0IDw9IDM7IGF0dGVtcHQrKykge1xuICAgICAgICBmb3IgKGNvbnN0IGVuZHBvaW50IG9mIGVuZHBvaW50cykge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoV2l0aFRpbWVvdXQoZW5kcG9pbnQsIDE1MDAwKTtcbiAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgICAgbGFzdEVycm9yID0gYCR7ZW5kcG9pbnR9IC0+ICR7cmVzcG9uc2Uuc3RhdHVzfSAke3Jlc3BvbnNlLnN0YXR1c1RleHR9YDtcbiAgICAgICAgICAgICAgLy8gcmV0cnkgb24gcmF0ZSBsaW1pdGluZyAvIHNlcnZlciBlcnJvcnNcbiAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDI5IHx8IHJlc3BvbnNlLnN0YXR1cyA+PSA1MDApIGNvbnRpbnVlO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgICAgICBjb25zdCBjb3VudCA9IEFycmF5LmlzQXJyYXkoZGF0YSkgPyBkYXRhLmxlbmd0aCA6IDA7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICAgYEp1cGl0ZXIgdG9rZW5zIHJlc3BvbnNlICgke3R9KSB2aWEgJHtlbmRwb2ludH06ICR7Y291bnR9IHRva2Vuc2AsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIHJlcy5qc29uKGRhdGEpO1xuICAgICAgICAgIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgICAgICAgICAgbGFzdEVycm9yID0gYCR7ZW5kcG9pbnR9IC0+ICR7ZT8ubWVzc2FnZSB8fCBTdHJpbmcoZSl9YDtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgSnVwaXRlciB0b2tlbnMgZmV0Y2ggZmFpbGVkOiAke2xhc3RFcnJvcn1gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgYXR0ZW1wdCAqIDUwMCkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXMuc3RhdHVzKDUwMikuanNvbih7XG4gICAgICBlcnJvcjoge1xuICAgICAgICBtZXNzYWdlOiBcIkFsbCBKdXBpdGVyIHRva2VuIGVuZHBvaW50cyBmYWlsZWRcIixcbiAgICAgICAgZGV0YWlsczogbGFzdEVycm9yIHx8IFwiVW5rbm93biBlcnJvclwiLFxuICAgICAgfSxcbiAgICAgIGRhdGE6IFtdLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJKdXBpdGVyIHRva2VucyBwcm94eSBlcnJvcjpcIiwge1xuICAgICAgdHlwZTogcmVxLnF1ZXJ5LnR5cGUsXG4gICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgIH0pO1xuXG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgZXJyb3I6IHtcbiAgICAgICAgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIkludGVybmFsIGVycm9yXCIsXG4gICAgICAgIGRldGFpbHM6IFN0cmluZyhlcnJvciksXG4gICAgICB9LFxuICAgICAgZGF0YTogW10sXG4gICAgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVKdXBpdGVyUXVvdGU6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBpbnB1dE1pbnQsIG91dHB1dE1pbnQsIGFtb3VudCwgc2xpcHBhZ2VCcHMsIGFzTGVnYWN5VHJhbnNhY3Rpb24gfSA9XG4gICAgICByZXEucXVlcnk7XG5cbiAgICBpZiAoXG4gICAgICAhaW5wdXRNaW50IHx8XG4gICAgICAhb3V0cHV0TWludCB8fFxuICAgICAgIWFtb3VudCB8fFxuICAgICAgdHlwZW9mIGlucHV0TWludCAhPT0gXCJzdHJpbmdcIiB8fFxuICAgICAgdHlwZW9mIG91dHB1dE1pbnQgIT09IFwic3RyaW5nXCIgfHxcbiAgICAgIHR5cGVvZiBhbW91bnQgIT09IFwic3RyaW5nXCJcbiAgICApIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7XG4gICAgICAgIGVycm9yOiBcIk1pc3NpbmcgcmVxdWlyZWQgcXVlcnkgcGFyYW1zOiBpbnB1dE1pbnQsIG91dHB1dE1pbnQsIGFtb3VudFwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7XG4gICAgICBpbnB1dE1pbnQsXG4gICAgICBvdXRwdXRNaW50LFxuICAgICAgYW1vdW50LFxuICAgICAgc2xpcHBhZ2VCcHM6IHR5cGVvZiBzbGlwcGFnZUJwcyA9PT0gXCJzdHJpbmdcIiA/IHNsaXBwYWdlQnBzIDogXCI1MFwiLFxuICAgICAgb25seURpcmVjdFJvdXRlczogXCJmYWxzZVwiLFxuICAgICAgYXNMZWdhY3lUcmFuc2FjdGlvbjpcbiAgICAgICAgdHlwZW9mIGFzTGVnYWN5VHJhbnNhY3Rpb24gPT09IFwic3RyaW5nXCIgPyBhc0xlZ2FjeVRyYW5zYWN0aW9uIDogXCJmYWxzZVwiLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXJsID0gYCR7SlVQSVRFUl9TV0FQX0JBU0V9L3F1b3RlPyR7cGFyYW1zLnRvU3RyaW5nKCl9YDtcblxuICAgIGNvbnN0IGZldGNoV2l0aFRpbWVvdXQgPSAodGltZW91dE1zOiBudW1iZXIpID0+IHtcbiAgICAgIGNvbnN0IHRpbWVvdXRQcm9taXNlID0gbmV3IFByb21pc2U8UmVzcG9uc2U+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgIHNldFRpbWVvdXQoXG4gICAgICAgICAgKCkgPT5cbiAgICAgICAgICAgIHJlc29sdmUoXG4gICAgICAgICAgICAgIG5ldyBSZXNwb25zZShcIlwiLCB7IHN0YXR1czogNTA0LCBzdGF0dXNUZXh0OiBcIkdhdGV3YXkgVGltZW91dFwiIH0pLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICB0aW1lb3V0TXMsXG4gICAgICAgICk7XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGZldGNoUHJvbWlzZSA9IGZldGNoKHVybCwge1xuICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICBBY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChjb21wYXRpYmxlOyBTb2xhbmFXYWxsZXQvMS4wKVwiLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yYWNlKFtmZXRjaFByb21pc2UsIHRpbWVvdXRQcm9taXNlXSkgYXMgUHJvbWlzZTxSZXNwb25zZT47XG4gICAgfTtcblxuICAgIC8vIFRyeSB1cCB0byAzIGF0dGVtcHRzIHdpdGggc21hbGwgYmFja29mZiBvbiA1eHgvNDI5XG4gICAgbGV0IGxhc3RTdGF0dXMgPSAwO1xuICAgIGxldCBsYXN0VGV4dCA9IFwiXCI7XG4gICAgZm9yIChsZXQgYXR0ZW1wdCA9IDE7IGF0dGVtcHQgPD0gMzsgYXR0ZW1wdCsrKSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoV2l0aFRpbWVvdXQoMTUwMDApO1xuICAgICAgbGFzdFN0YXR1cyA9IHJlc3BvbnNlLnN0YXR1cztcbiAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgICByZXR1cm4gcmVzLmpzb24oZGF0YSk7XG4gICAgICB9XG4gICAgICBsYXN0VGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKS5jYXRjaCgoKSA9PiBcIlwiKTtcblxuICAgICAgLy8gSWYgNDA0IG9yIDQwMCwgbGlrZWx5IG1lYW5zIG5vIHJvdXRlIGV4aXN0cyBmb3IgdGhpcyBwYWlyXG4gICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MDQgfHwgcmVzcG9uc2Uuc3RhdHVzID09PSA0MDApIHtcbiAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgIGBKdXBpdGVyIHF1b3RlIHJldHVybmVkICR7cmVzcG9uc2Uuc3RhdHVzfSAtIGxpa2VseSBubyByb3V0ZSBmb3IgdGhpcyBwYWlyYCxcbiAgICAgICAgICB7IGlucHV0TWludDogcmVxLnF1ZXJ5LmlucHV0TWludCwgb3V0cHV0TWludDogcmVxLnF1ZXJ5Lm91dHB1dE1pbnQgfSxcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIHJlcy5zdGF0dXMocmVzcG9uc2Uuc3RhdHVzKS5qc29uKHtcbiAgICAgICAgICBlcnJvcjogYE5vIHN3YXAgcm91dGUgZm91bmQgZm9yIHRoaXMgcGFpcmAsXG4gICAgICAgICAgZGV0YWlsczogbGFzdFRleHQsXG4gICAgICAgICAgY29kZTogcmVzcG9uc2Uuc3RhdHVzID09PSA0MDQgPyBcIk5PX1JPVVRFX0ZPVU5EXCIgOiBcIklOVkFMSURfUEFSQU1TXCIsXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBSZXRyeSBvbiByYXRlIGxpbWl0IG9yIHNlcnZlciBlcnJvcnNcbiAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQyOSB8fCByZXNwb25zZS5zdGF0dXMgPj0gNTAwKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICBgSnVwaXRlciBBUEkgcmV0dXJuZWQgJHtyZXNwb25zZS5zdGF0dXN9LCByZXRyeWluZy4uLiAoYXR0ZW1wdCAke2F0dGVtcHR9LzMpYCxcbiAgICAgICAgKTtcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgYXR0ZW1wdCAqIDUwMCkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHJldHVybiByZXMuc3RhdHVzKGxhc3RTdGF0dXMgfHwgNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBgUXVvdGUgQVBJIGVycm9yYCxcbiAgICAgIGRldGFpbHM6IGxhc3RUZXh0LFxuICAgICAgY29kZTogbGFzdFN0YXR1cyA9PT0gNTA0ID8gXCJUSU1FT1VUXCIgOiBcIkFQSV9FUlJPUlwiLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJKdXBpdGVyIHF1b3RlIHByb3h5IGVycm9yOlwiLCB7XG4gICAgICBwYXJhbXM6IHJlcS5xdWVyeSxcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICBzdGFjazogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLnN0YWNrIDogdW5kZWZpbmVkLFxuICAgIH0pO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgZXJyb3JcIixcbiAgICB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUp1cGl0ZXJTd2FwOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGJvZHkgPSByZXEuYm9keSB8fCB7fTtcbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIFwiaGFuZGxlSnVwaXRlclN3YXAgcmVjZWl2ZWQgYm9keSBrZXlzOlwiLFxuICAgICAgT2JqZWN0LmtleXMoYm9keSB8fCB7fSksXG4gICAgKTtcblxuICAgIGlmICghYm9keSB8fCAhYm9keS5xdW90ZVJlc3BvbnNlIHx8ICFib2R5LnVzZXJQdWJsaWNLZXkpIHtcbiAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgXCJoYW5kbGVKdXBpdGVyU3dhcCBtaXNzaW5nIGZpZWxkcywgYm9keTpcIixcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoYm9keSksXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6XG4gICAgICAgICAgXCJNaXNzaW5nIHJlcXVpcmVkIGJvZHk6IHsgcXVvdGVSZXNwb25zZSwgdXNlclB1YmxpY0tleSwgLi4ub3B0aW9ucyB9XCIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCAyMDAwMCk7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke0pVUElURVJfU1dBUF9CQVNFfS9zd2FwYCwge1xuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChjb21wYXRpYmxlOyBTb2xhbmFXYWxsZXQvMS4wKVwiLFxuICAgICAgfSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICB9KTtcblxuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgY29uc3QgdGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKS5jYXRjaCgoKSA9PiBcIlwiKTtcbiAgICAgIHJldHVybiByZXNcbiAgICAgICAgLnN0YXR1cyhyZXNwb25zZS5zdGF0dXMpXG4gICAgICAgIC5qc29uKHsgZXJyb3I6IGBTd2FwIGZhaWxlZDogJHtyZXNwb25zZS5zdGF0dXNUZXh0fWAsIGRldGFpbHM6IHRleHQgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICByZXMuanNvbihkYXRhKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiSnVwaXRlciBzd2FwIHByb3h5IGVycm9yOlwiLCB7XG4gICAgICBib2R5OiByZXEuYm9keSxcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICBzdGFjazogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLnN0YWNrIDogdW5kZWZpbmVkLFxuICAgIH0pO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHtcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiSW50ZXJuYWwgZXJyb3JcIixcbiAgICB9KTtcbiAgfVxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Jvb3QvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Jvb3QvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9mb3JleC1yYXRlLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvZm9yZXgtcmF0ZS50c1wiO2ltcG9ydCB7IFJlcXVlc3RIYW5kbGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUZvcmV4UmF0ZTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBiYXNlID0gU3RyaW5nKHJlcS5xdWVyeS5iYXNlIHx8IFwiVVNEXCIpLnRvVXBwZXJDYXNlKCk7XG4gICAgY29uc3Qgc3ltYm9scyA9IFN0cmluZyhyZXEucXVlcnkuc3ltYm9scyB8fCBcIlBLUlwiKS50b1VwcGVyQ2FzZSgpO1xuICAgIGNvbnN0IGZpcnN0U3ltYm9sID0gc3ltYm9scy5zcGxpdChcIixcIilbMF07XG4gICAgY29uc3QgUFJPVklERVJfVElNRU9VVF9NUyA9IDUwMDA7XG5cbiAgICBjb25zdCBwcm92aWRlcnM6IEFycmF5PHtcbiAgICAgIG5hbWU6IHN0cmluZztcbiAgICAgIHVybDogc3RyaW5nO1xuICAgICAgcGFyc2U6IChqOiBhbnkpID0+IG51bWJlciB8IG51bGw7XG4gICAgfT4gPSBbXG4gICAgICB7XG4gICAgICAgIG5hbWU6IFwiZXhjaGFuZ2VyYXRlLmhvc3RcIixcbiAgICAgICAgdXJsOiBgaHR0cHM6Ly9hcGkuZXhjaGFuZ2VyYXRlLmhvc3QvbGF0ZXN0P2Jhc2U9JHtlbmNvZGVVUklDb21wb25lbnQoYmFzZSl9JnN5bWJvbHM9JHtlbmNvZGVVUklDb21wb25lbnQoZmlyc3RTeW1ib2wpfWAsXG4gICAgICAgIHBhcnNlOiAoaikgPT5cbiAgICAgICAgICBqICYmIGoucmF0ZXMgJiYgdHlwZW9mIGoucmF0ZXNbZmlyc3RTeW1ib2xdID09PSBcIm51bWJlclwiXG4gICAgICAgICAgICA/IGoucmF0ZXNbZmlyc3RTeW1ib2xdXG4gICAgICAgICAgICA6IG51bGwsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiBcImZyYW5rZnVydGVyXCIsXG4gICAgICAgIHVybDogYGh0dHBzOi8vYXBpLmZyYW5rZnVydGVyLmFwcC9sYXRlc3Q/ZnJvbT0ke2VuY29kZVVSSUNvbXBvbmVudChiYXNlKX0mdG89JHtlbmNvZGVVUklDb21wb25lbnQoZmlyc3RTeW1ib2wpfWAsXG4gICAgICAgIHBhcnNlOiAoaikgPT5cbiAgICAgICAgICBqICYmIGoucmF0ZXMgJiYgdHlwZW9mIGoucmF0ZXNbZmlyc3RTeW1ib2xdID09PSBcIm51bWJlclwiXG4gICAgICAgICAgICA/IGoucmF0ZXNbZmlyc3RTeW1ib2xdXG4gICAgICAgICAgICA6IG51bGwsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiBcImVyLWFwaVwiLFxuICAgICAgICB1cmw6IGBodHRwczovL29wZW4uZXItYXBpLmNvbS92Ni9sYXRlc3QvJHtlbmNvZGVVUklDb21wb25lbnQoYmFzZSl9YCxcbiAgICAgICAgcGFyc2U6IChqKSA9PlxuICAgICAgICAgIGogJiYgai5yYXRlcyAmJiB0eXBlb2Ygai5yYXRlc1tmaXJzdFN5bWJvbF0gPT09IFwibnVtYmVyXCJcbiAgICAgICAgICAgID8gai5yYXRlc1tmaXJzdFN5bWJvbF1cbiAgICAgICAgICAgIDogbnVsbCxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6IFwiZmF3YXphaG1lZC1jZG5cIixcbiAgICAgICAgdXJsOiBgaHR0cHM6Ly9jZG4uanNkZWxpdnIubmV0L2doL2Zhd2F6YWhtZWQwL2N1cnJlbmN5LWFwaUAxL2xhdGVzdC9jdXJyZW5jaWVzLyR7YmFzZS50b0xvd2VyQ2FzZSgpfS8ke2ZpcnN0U3ltYm9sLnRvTG93ZXJDYXNlKCl9Lmpzb25gLFxuICAgICAgICBwYXJzZTogKGopID0+XG4gICAgICAgICAgaiAmJiB0eXBlb2YgaltmaXJzdFN5bWJvbC50b0xvd2VyQ2FzZSgpXSA9PT0gXCJudW1iZXJcIlxuICAgICAgICAgICAgPyBqW2ZpcnN0U3ltYm9sLnRvTG93ZXJDYXNlKCldXG4gICAgICAgICAgICA6IG51bGwsXG4gICAgICB9LFxuICAgIF07XG5cbiAgICBjb25zdCBmZXRjaFByb3ZpZGVyID0gYXN5bmMgKFxuICAgICAgcHJvdmlkZXI6ICh0eXBlb2YgcHJvdmlkZXJzKVtudW1iZXJdLFxuICAgICk6IFByb21pc2U8eyByYXRlOiBudW1iZXI7IHByb3ZpZGVyOiBzdHJpbmcgfT4gPT4ge1xuICAgICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoXG4gICAgICAgICgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKSxcbiAgICAgICAgUFJPVklERVJfVElNRU9VVF9NUyxcbiAgICAgICk7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXNwID0gYXdhaXQgZmV0Y2gocHJvdmlkZXIudXJsLCB7XG4gICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuICAgICAgICAgICAgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKGNvbXBhdGlibGU7IFNvbGFuYVdhbGxldC8xLjApXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsIGFzIGFueSxcbiAgICAgICAgfSBhcyBhbnkpO1xuICAgICAgICBpZiAoIXJlc3Aub2spIHtcbiAgICAgICAgICBjb25zdCByZWFzb24gPSBgJHtyZXNwLnN0YXR1c30gJHtyZXNwLnN0YXR1c1RleHR9YDtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IocmVhc29uLnRyaW0oKSB8fCBcIm5vbi1vayByZXNwb25zZVwiKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzcC5qc29uKCk7XG4gICAgICAgIGNvbnN0IHJhdGUgPSBwcm92aWRlci5wYXJzZShqc29uKTtcbiAgICAgICAgaWYgKHR5cGVvZiByYXRlID09PSBcIm51bWJlclwiICYmIGlzRmluaXRlKHJhdGUpICYmIHJhdGUgPiAwKSB7XG4gICAgICAgICAgcmV0dXJuIHsgcmF0ZSwgcHJvdmlkZXI6IHByb3ZpZGVyLm5hbWUgfTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnZhbGlkIHJlc3BvbnNlIHBheWxvYWRcIik7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFske3Byb3ZpZGVyLm5hbWV9XSAke21lc3NhZ2V9YCk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3QgcnVuUHJvdmlkZXJzID0gKCkgPT4ge1xuICAgICAgY29uc3QgYXR0ZW1wdHMgPSBwcm92aWRlcnMubWFwKChwKSA9PiBmZXRjaFByb3ZpZGVyKHApKTtcbiAgICAgIGlmICh0eXBlb2YgKFByb21pc2UgYXMgYW55KS5hbnkgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICByZXR1cm4gKFByb21pc2UgYXMgYW55KS5hbnkoYXR0ZW1wdHMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHsgcmF0ZTogbnVtYmVyOyBwcm92aWRlcjogc3RyaW5nIH0+KFxuICAgICAgICAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgIGxldCByZW1haW5pbmcgPSBhdHRlbXB0cy5sZW5ndGg7XG4gICAgICAgICAgYXR0ZW1wdHMuZm9yRWFjaCgoYXR0ZW1wdCkgPT4ge1xuICAgICAgICAgICAgYXR0ZW1wdC50aGVuKHJlc29sdmUpLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAgICAgZXJyb3JzLnB1c2goZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpKTtcbiAgICAgICAgICAgICAgcmVtYWluaW5nIC09IDE7XG4gICAgICAgICAgICAgIGlmIChyZW1haW5pbmcgPT09IDApIHJlamVjdChuZXcgRXJyb3IoZXJyb3JzLmpvaW4oXCI7IFwiKSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICApO1xuICAgIH07XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgeyByYXRlLCBwcm92aWRlciB9ID0gYXdhaXQgcnVuUHJvdmlkZXJzKCk7XG4gICAgICByZXMuanNvbih7XG4gICAgICAgIGJhc2UsXG4gICAgICAgIHN5bWJvbHM6IFtmaXJzdFN5bWJvbF0sXG4gICAgICAgIHJhdGVzOiB7IFtmaXJzdFN5bWJvbF06IHJhdGUgfSxcbiAgICAgICAgcHJvdmlkZXIsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc3QgbXNnID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgICAgcmVzXG4gICAgICAgIC5zdGF0dXMoNTAyKVxuICAgICAgICAuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBmZXRjaCBmb3JleCByYXRlXCIsIGRldGFpbHM6IG1zZyB9KTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJVbmV4cGVjdGVkIGVycm9yXCIgfSk7XG4gIH1cbn07XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvc3RhYmxlLTI0aC50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL3N0YWJsZS0yNGgudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVTdGFibGUyNGg6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3Qgc3ltYm9sc1BhcmFtID0gU3RyaW5nKHJlcS5xdWVyeS5zeW1ib2xzIHx8IFwiVVNEQyxVU0RUXCIpLnRvVXBwZXJDYXNlKCk7XG4gICAgY29uc3Qgc3ltYm9scyA9IEFycmF5LmZyb20oXG4gICAgICBuZXcgU2V0KFxuICAgICAgICBTdHJpbmcoc3ltYm9sc1BhcmFtKVxuICAgICAgICAgIC5zcGxpdChcIixcIilcbiAgICAgICAgICAubWFwKChzKSA9PiBzLnRyaW0oKSlcbiAgICAgICAgICAuZmlsdGVyKEJvb2xlYW4pLFxuICAgICAgKSxcbiAgICApO1xuXG4gICAgY29uc3QgQ09JTkdFQ0tPX0lEUzogUmVjb3JkPHN0cmluZywgeyBpZDogc3RyaW5nOyBtaW50OiBzdHJpbmcgfT4gPSB7XG4gICAgICBVU0RDOiB7XG4gICAgICAgIGlkOiBcInVzZC1jb2luXCIsXG4gICAgICAgIG1pbnQ6IFwiRVBqRldkZDVBdWZxU1NxZU0ycU4xeHp5YmFwQzhHNHdFR0drWnd5VER0MXZcIixcbiAgICAgIH0sXG4gICAgICBVU0RUOiB7XG4gICAgICAgIGlkOiBcInRldGhlclwiLFxuICAgICAgICBtaW50OiBcIkVzOXZNRnJ6YUNFUm1KZnJGNEgyRllENEtDb05rWTExTWNDZThCZW5FbnNcIixcbiAgICAgIH0sXG4gICAgfTtcblxuICAgIGNvbnN0IGlkcyA9IHN5bWJvbHNcbiAgICAgIC5tYXAoKHMpID0+IENPSU5HRUNLT19JRFNbc10/LmlkKVxuICAgICAgLmZpbHRlcihCb29sZWFuKVxuICAgICAgLmpvaW4oXCIsXCIpO1xuXG4gICAgaWYgKCFpZHMpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiBcIk5vIHN1cHBvcnRlZCBzeW1ib2xzIHByb3ZpZGVkXCIgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgYXBpVXJsID0gYGh0dHBzOi8vYXBpLmNvaW5nZWNrby5jb20vYXBpL3YzL3NpbXBsZS9wcmljZT9pZHM9JHtlbmNvZGVVUklDb21wb25lbnQoaWRzKX0mdnNfY3VycmVuY2llcz11c2QmaW5jbHVkZV8yNGhyX2NoYW5nZT10cnVlYDtcbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLCAxMjAwMCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcCA9IGF3YWl0IGZldGNoKGFwaVVybCwge1xuICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsIGFzIGFueSxcbiAgICAgICAgaGVhZGVyczogeyBBY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgICB9IGFzIGFueSk7XG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcblxuICAgICAgY29uc3QgcmVzdWx0OiBSZWNvcmQ8XG4gICAgICAgIHN0cmluZyxcbiAgICAgICAgeyBwcmljZVVzZDogbnVtYmVyOyBjaGFuZ2UyNGg6IG51bWJlcjsgbWludDogc3RyaW5nIH1cbiAgICAgID4gPSB7fTtcblxuICAgICAgaWYgKHJlc3Aub2spIHtcbiAgICAgICAgY29uc3QganNvbiA9IGF3YWl0IHJlc3AuanNvbigpO1xuICAgICAgICBzeW1ib2xzLmZvckVhY2goKHN5bSkgPT4ge1xuICAgICAgICAgIGNvbnN0IG1ldGEgPSBDT0lOR0VDS09fSURTW3N5bV07XG4gICAgICAgICAgaWYgKCFtZXRhKSByZXR1cm47XG4gICAgICAgICAgY29uc3QgZCA9IChqc29uIGFzIGFueSk/LlttZXRhLmlkXTtcbiAgICAgICAgICBjb25zdCBwcmljZSA9IHR5cGVvZiBkPy51c2QgPT09IFwibnVtYmVyXCIgPyBkLnVzZCA6IDE7XG4gICAgICAgICAgY29uc3QgY2hhbmdlID1cbiAgICAgICAgICAgIHR5cGVvZiBkPy51c2RfMjRoX2NoYW5nZSA9PT0gXCJudW1iZXJcIiA/IGQudXNkXzI0aF9jaGFuZ2UgOiAwO1xuICAgICAgICAgIHJlc3VsdFtzeW1dID0geyBwcmljZVVzZDogcHJpY2UsIGNoYW5nZTI0aDogY2hhbmdlLCBtaW50OiBtZXRhLm1pbnQgfTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzeW1ib2xzLmZvckVhY2goKHN5bSkgPT4ge1xuICAgICAgICAgIGNvbnN0IG1ldGEgPSBDT0lOR0VDS09fSURTW3N5bV07XG4gICAgICAgICAgaWYgKCFtZXRhKSByZXR1cm47XG4gICAgICAgICAgcmVzdWx0W3N5bV0gPSB7IHByaWNlVXNkOiAxLCBjaGFuZ2UyNGg6IDAsIG1pbnQ6IG1ldGEubWludCB9O1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgcmVzLmpzb24oeyBkYXRhOiByZXN1bHQgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICBjb25zdCByZXN1bHQ6IFJlY29yZDxcbiAgICAgICAgc3RyaW5nLFxuICAgICAgICB7IHByaWNlVXNkOiBudW1iZXI7IGNoYW5nZTI0aDogbnVtYmVyOyBtaW50OiBzdHJpbmcgfVxuICAgICAgPiA9IHt9O1xuICAgICAgc3ltYm9scy5mb3JFYWNoKChzeW0pID0+IHtcbiAgICAgICAgY29uc3QgbWV0YSA9IENPSU5HRUNLT19JRFNbc3ltXTtcbiAgICAgICAgaWYgKCFtZXRhKSByZXR1cm47XG4gICAgICAgIHJlc3VsdFtzeW1dID0geyBwcmljZVVzZDogMSwgY2hhbmdlMjRoOiAwLCBtaW50OiBtZXRhLm1pbnQgfTtcbiAgICAgIH0pO1xuICAgICAgcmVzLmpzb24oeyBkYXRhOiByZXN1bHQgfSk7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiVW5leHBlY3RlZCBlcnJvclwiIH0pO1xuICB9XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvcm9vdC9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2RleHRvb2xzLXByb3h5LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvZGV4dG9vbHMtcHJveHkudHNcIjtpbXBvcnQgeyBSZXF1ZXN0SGFuZGxlciB9IGZyb20gXCJleHByZXNzXCI7XG5cbmNvbnN0IERFWFRPT0xTX0FQSV9CQVNFID0gXCJodHRwczovL2FwaS5kZXh0b29scy5pby92MVwiO1xuXG5pbnRlcmZhY2UgRGV4VG9vbHNUb2tlblJlc3BvbnNlIHtcbiAgZGF0YT86IHtcbiAgICBhZGRyZXNzOiBzdHJpbmc7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIHN5bWJvbDogc3RyaW5nO1xuICAgIHByaWNlVXNkPzogbnVtYmVyO1xuICAgIHByaWNlVXNkQ2hhbmdlMjRoPzogbnVtYmVyO1xuICAgIG1hcmtldENhcD86IG51bWJlcjtcbiAgICBsaXF1aWRpdHk/OiBudW1iZXI7XG4gICAgdm9sdW1lMjRoPzogbnVtYmVyO1xuICB9O1xuICBlcnJvckNvZGU/OiBzdHJpbmc7XG4gIGVycm9yTXNnPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgaGFuZGxlRGV4VG9vbHNQcmljZTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHRva2VuQWRkcmVzcywgY2hhaW5JZCB9ID0gcmVxLnF1ZXJ5O1xuXG4gICAgaWYgKCF0b2tlbkFkZHJlc3MgfHwgdHlwZW9mIHRva2VuQWRkcmVzcyAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHtcbiAgICAgICAgZXJyb3I6IFwiTWlzc2luZyBvciBpbnZhbGlkICd0b2tlbkFkZHJlc3MnIHBhcmFtZXRlclwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgY2hhaW4gPSBjaGFpbklkIHx8IFwic29sYW5hXCI7XG5cbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbRGV4VG9vbHMgUHJveHldIEZldGNoaW5nIHByaWNlIGZvciAke3Rva2VuQWRkcmVzc30gb24gY2hhaW4gJHtjaGFpbn1gLFxuICAgICk7XG5cbiAgICBjb25zdCB1cmwgPSBgJHtERVhUT09MU19BUElfQkFTRX0vdG9rZW4vJHtjaGFpbn0vJHt0b2tlbkFkZHJlc3N9YDtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICBgW0RleFRvb2xzIFByb3h5XSBBUEkgcmV0dXJuZWQgJHtyZXNwb25zZS5zdGF0dXN9IGZvciAke3Rva2VuQWRkcmVzc31gLFxuICAgICAgKTtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKHJlc3BvbnNlLnN0YXR1cykuanNvbih7XG4gICAgICAgIGVycm9yOiBgRGV4VG9vbHMgQVBJIGVycm9yOiAke3Jlc3BvbnNlLnN0YXR1c31gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgZGF0YTogRGV4VG9vbHNUb2tlblJlc3BvbnNlID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuXG4gICAgaWYgKGRhdGEuZGF0YT8ucHJpY2VVc2QpIHtcbiAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICBgW0RleFRvb2xzIFByb3h5XSBQcmljZSByZXRyaWV2ZWQ6ICR7dG9rZW5BZGRyZXNzfSA9ICQke2RhdGEuZGF0YS5wcmljZVVzZH1gLFxuICAgICAgKTtcbiAgICAgIHJldHVybiByZXMuanNvbih7XG4gICAgICAgIHRva2VuQWRkcmVzcyxcbiAgICAgICAgcHJpY2VVc2Q6IGRhdGEuZGF0YS5wcmljZVVzZCxcbiAgICAgICAgcHJpY2VVc2RDaGFuZ2UyNGg6IGRhdGEuZGF0YS5wcmljZVVzZENoYW5nZTI0aCxcbiAgICAgICAgbWFya2V0Q2FwOiBkYXRhLmRhdGEubWFya2V0Q2FwLFxuICAgICAgICBsaXF1aWRpdHk6IGRhdGEuZGF0YS5saXF1aWRpdHksXG4gICAgICAgIHZvbHVtZTI0aDogZGF0YS5kYXRhLnZvbHVtZTI0aCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnNvbGUud2FybihgW0RleFRvb2xzIFByb3h5XSBObyBwcmljZSBkYXRhIGZvciAke3Rva2VuQWRkcmVzc31gKTtcbiAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oe1xuICAgICAgZXJyb3I6IFwiVG9rZW4gbm90IGZvdW5kIGluIERleFRvb2xzXCIsXG4gICAgICB0b2tlbkFkZHJlc3MsXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIltEZXhUb29scyBQcm94eV0gRXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXR1cm4gcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJJbnRlcm5hbCBzZXJ2ZXIgZXJyb3JcIixcbiAgICB9KTtcbiAgfVxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Jvb3QvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Jvb3QvYXBwL2NvZGUvc2VydmVyL3JvdXRlcy9wMnAtb3JkZXJzLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvcDJwLW9yZGVycy50c1wiO2ltcG9ydCB7IFJlcXVlc3RIYW5kbGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuZXhwb3J0IGludGVyZmFjZSBQMlBPcmRlciB7XG4gIGlkOiBzdHJpbmc7XG4gIHR5cGU6IFwiYnV5XCIgfCBcInNlbGxcIjtcbiAgY3JlYXRvcl93YWxsZXQ6IHN0cmluZztcbiAgdG9rZW46IHN0cmluZztcbiAgdG9rZW5fYW1vdW50OiBzdHJpbmc7XG4gIHBrcl9hbW91bnQ6IG51bWJlcjtcbiAgcGF5bWVudF9tZXRob2Q6IHN0cmluZztcbiAgc3RhdHVzOiBcImFjdGl2ZVwiIHwgXCJwZW5kaW5nXCIgfCBcImNvbXBsZXRlZFwiIHwgXCJjYW5jZWxsZWRcIiB8IFwiZGlzcHV0ZWRcIjtcbiAgb25saW5lOiBib29sZWFuO1xuICBjcmVhdGVkX2F0OiBudW1iZXI7XG4gIHVwZGF0ZWRfYXQ6IG51bWJlcjtcbiAgYWNjb3VudF9uYW1lPzogc3RyaW5nO1xuICBhY2NvdW50X251bWJlcj86IHN0cmluZztcbiAgd2FsbGV0X2FkZHJlc3M/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHJhZGVSb29tIHtcbiAgaWQ6IHN0cmluZztcbiAgYnV5ZXJfd2FsbGV0OiBzdHJpbmc7XG4gIHNlbGxlcl93YWxsZXQ6IHN0cmluZztcbiAgb3JkZXJfaWQ6IHN0cmluZztcbiAgc3RhdHVzOlxuICAgIHwgXCJwZW5kaW5nXCJcbiAgICB8IFwicGF5bWVudF9jb25maXJtZWRcIlxuICAgIHwgXCJhc3NldHNfdHJhbnNmZXJyZWRcIlxuICAgIHwgXCJjb21wbGV0ZWRcIlxuICAgIHwgXCJjYW5jZWxsZWRcIjtcbiAgY3JlYXRlZF9hdDogbnVtYmVyO1xuICB1cGRhdGVkX2F0OiBudW1iZXI7XG59XG5cbi8vIEluLW1lbW9yeSBzdG9yZSBmb3IgZGV2ZWxvcG1lbnQgKHdpbGwgYmUgcmVwbGFjZWQgd2l0aCBkYXRhYmFzZSlcbmNvbnN0IG9yZGVyczogTWFwPHN0cmluZywgUDJQT3JkZXI+ID0gbmV3IE1hcCgpO1xuY29uc3Qgcm9vbXM6IE1hcDxzdHJpbmcsIFRyYWRlUm9vbT4gPSBuZXcgTWFwKCk7XG5jb25zdCBtZXNzYWdlczogTWFwPFxuICBzdHJpbmcsXG4gIEFycmF5PHtcbiAgICBpZDogc3RyaW5nO1xuICAgIHNlbmRlcl93YWxsZXQ6IHN0cmluZztcbiAgICBtZXNzYWdlOiBzdHJpbmc7XG4gICAgY3JlYXRlZF9hdDogbnVtYmVyO1xuICB9PlxuPiA9IG5ldyBNYXAoKTtcblxuLy8gSGVscGVyIGZ1bmN0aW9uc1xuZnVuY3Rpb24gZ2VuZXJhdGVJZChwcmVmaXg6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtwcmVmaXh9LSR7RGF0ZS5ub3coKX0tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyLCA4KX1gO1xufVxuXG4vLyBQMlAgT3JkZXJzIGVuZHBvaW50c1xuZXhwb3J0IGNvbnN0IGhhbmRsZUxpc3RQMlBPcmRlcnM6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyB0eXBlLCBzdGF0dXMsIHRva2VuLCBvbmxpbmUgfSA9IHJlcS5xdWVyeTtcblxuICAgIGxldCBmaWx0ZXJlZCA9IEFycmF5LmZyb20ob3JkZXJzLnZhbHVlcygpKTtcblxuICAgIGlmICh0eXBlKSBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcigobykgPT4gby50eXBlID09PSB0eXBlKTtcbiAgICBpZiAoc3RhdHVzKSBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcigobykgPT4gby5zdGF0dXMgPT09IHN0YXR1cyk7XG4gICAgaWYgKHRva2VuKSBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcigobykgPT4gby50b2tlbiA9PT0gdG9rZW4pO1xuICAgIGlmIChvbmxpbmUgPT09IFwidHJ1ZVwiKSBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcigobykgPT4gby5vbmxpbmUpO1xuICAgIGlmIChvbmxpbmUgPT09IFwiZmFsc2VcIikgZmlsdGVyZWQgPSBmaWx0ZXJlZC5maWx0ZXIoKG8pID0+ICFvLm9ubGluZSk7XG5cbiAgICBmaWx0ZXJlZC5zb3J0KChhLCBiKSA9PiBiLmNyZWF0ZWRfYXQgLSBhLmNyZWF0ZWRfYXQpO1xuXG4gICAgcmVzLmpzb24oeyBvcmRlcnM6IGZpbHRlcmVkIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJMaXN0IFAyUCBvcmRlcnMgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBsaXN0IG9yZGVyc1wiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlQ3JlYXRlUDJQT3JkZXI6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3Qge1xuICAgICAgdHlwZSxcbiAgICAgIGNyZWF0b3Jfd2FsbGV0LFxuICAgICAgdG9rZW4sXG4gICAgICB0b2tlbl9hbW91bnQsXG4gICAgICBwa3JfYW1vdW50LFxuICAgICAgcGF5bWVudF9tZXRob2QsXG4gICAgICBvbmxpbmUsXG4gICAgICBhY2NvdW50X25hbWUsXG4gICAgICBhY2NvdW50X251bWJlcixcbiAgICAgIHdhbGxldF9hZGRyZXNzLFxuICAgIH0gPSByZXEuYm9keTtcblxuICAgIGlmIChcbiAgICAgICF0eXBlIHx8XG4gICAgICAhY3JlYXRvcl93YWxsZXQgfHxcbiAgICAgICF0b2tlbiB8fFxuICAgICAgIXRva2VuX2Ftb3VudCB8fFxuICAgICAgIXBrcl9hbW91bnQgfHxcbiAgICAgICFwYXltZW50X21ldGhvZFxuICAgICkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6IFwiTWlzc2luZyByZXF1aXJlZCBmaWVsZHNcIiB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBpZCA9IGdlbmVyYXRlSWQoXCJvcmRlclwiKTtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXG4gICAgY29uc3Qgb3JkZXI6IFAyUE9yZGVyID0ge1xuICAgICAgaWQsXG4gICAgICB0eXBlLFxuICAgICAgY3JlYXRvcl93YWxsZXQsXG4gICAgICB0b2tlbixcbiAgICAgIHRva2VuX2Ftb3VudDogU3RyaW5nKHRva2VuX2Ftb3VudCksXG4gICAgICBwa3JfYW1vdW50OiBOdW1iZXIocGtyX2Ftb3VudCksXG4gICAgICBwYXltZW50X21ldGhvZCxcbiAgICAgIHN0YXR1czogXCJhY3RpdmVcIixcbiAgICAgIG9ubGluZTogb25saW5lICE9PSBmYWxzZSxcbiAgICAgIGNyZWF0ZWRfYXQ6IG5vdyxcbiAgICAgIHVwZGF0ZWRfYXQ6IG5vdyxcbiAgICAgIGFjY291bnRfbmFtZSxcbiAgICAgIGFjY291bnRfbnVtYmVyLFxuICAgICAgd2FsbGV0X2FkZHJlc3M6IHR5cGUgPT09IFwic2VsbFwiID8gd2FsbGV0X2FkZHJlc3MgOiB1bmRlZmluZWQsXG4gICAgfTtcblxuICAgIG9yZGVycy5zZXQoaWQsIG9yZGVyKTtcblxuICAgIHJlcy5zdGF0dXMoMjAxKS5qc29uKHsgb3JkZXIgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkNyZWF0ZSBQMlAgb3JkZXIgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBjcmVhdGUgb3JkZXJcIiB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUdldFAyUE9yZGVyOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgb3JkZXJJZCB9ID0gcmVxLnBhcmFtcztcbiAgICBjb25zdCBvcmRlciA9IG9yZGVycy5nZXQob3JkZXJJZCk7XG5cbiAgICBpZiAoIW9yZGVyKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJPcmRlciBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICByZXMuanNvbih7IG9yZGVyIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJHZXQgUDJQIG9yZGVyIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gZ2V0IG9yZGVyXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVVcGRhdGVQMlBPcmRlcjogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IG9yZGVySWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgY29uc3Qgb3JkZXIgPSBvcmRlcnMuZ2V0KG9yZGVySWQpO1xuXG4gICAgaWYgKCFvcmRlcikge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6IFwiT3JkZXIgbm90IGZvdW5kXCIgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXBkYXRlZDogUDJQT3JkZXIgPSB7XG4gICAgICAuLi5vcmRlcixcbiAgICAgIC4uLnJlcS5ib2R5LFxuICAgICAgaWQ6IG9yZGVyLmlkLFxuICAgICAgY3JlYXRlZF9hdDogb3JkZXIuY3JlYXRlZF9hdCxcbiAgICAgIHVwZGF0ZWRfYXQ6IERhdGUubm93KCksXG4gICAgfTtcblxuICAgIG9yZGVycy5zZXQob3JkZXJJZCwgdXBkYXRlZCk7XG4gICAgcmVzLmpzb24oeyBvcmRlcjogdXBkYXRlZCB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiVXBkYXRlIFAyUCBvcmRlciBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIHVwZGF0ZSBvcmRlclwiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlRGVsZXRlUDJQT3JkZXI6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBvcmRlcklkIH0gPSByZXEucGFyYW1zO1xuXG4gICAgaWYgKCFvcmRlcnMuaGFzKG9yZGVySWQpKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJPcmRlciBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICBvcmRlcnMuZGVsZXRlKG9yZGVySWQpO1xuICAgIHJlcy5qc29uKHsgb2s6IHRydWUgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkRlbGV0ZSBQMlAgb3JkZXIgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBkZWxldGUgb3JkZXJcIiB9KTtcbiAgfVxufTtcblxuLy8gVHJhZGUgUm9vbXMgZW5kcG9pbnRzXG5leHBvcnQgY29uc3QgaGFuZGxlTGlzdFRyYWRlUm9vbXM6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyB3YWxsZXQgfSA9IHJlcS5xdWVyeTtcblxuICAgIGxldCBmaWx0ZXJlZCA9IEFycmF5LmZyb20ocm9vbXMudmFsdWVzKCkpO1xuXG4gICAgaWYgKHdhbGxldCkge1xuICAgICAgZmlsdGVyZWQgPSBmaWx0ZXJlZC5maWx0ZXIoXG4gICAgICAgIChyKSA9PiByLmJ1eWVyX3dhbGxldCA9PT0gd2FsbGV0IHx8IHIuc2VsbGVyX3dhbGxldCA9PT0gd2FsbGV0LFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBmaWx0ZXJlZC5zb3J0KChhLCBiKSA9PiBiLmNyZWF0ZWRfYXQgLSBhLmNyZWF0ZWRfYXQpO1xuXG4gICAgcmVzLmpzb24oeyByb29tczogZmlsdGVyZWQgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkxpc3QgdHJhZGUgcm9vbXMgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBsaXN0IHJvb21zXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVDcmVhdGVUcmFkZVJvb206IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBidXllcl93YWxsZXQsIHNlbGxlcl93YWxsZXQsIG9yZGVyX2lkIH0gPSByZXEuYm9keTtcblxuICAgIGlmICghYnV5ZXJfd2FsbGV0IHx8ICFzZWxsZXJfd2FsbGV0IHx8ICFvcmRlcl9pZCkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6IFwiTWlzc2luZyByZXF1aXJlZCBmaWVsZHNcIiB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBpZCA9IGdlbmVyYXRlSWQoXCJyb29tXCIpO1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cbiAgICBjb25zdCByb29tOiBUcmFkZVJvb20gPSB7XG4gICAgICBpZCxcbiAgICAgIGJ1eWVyX3dhbGxldCxcbiAgICAgIHNlbGxlcl93YWxsZXQsXG4gICAgICBvcmRlcl9pZCxcbiAgICAgIHN0YXR1czogXCJwZW5kaW5nXCIsXG4gICAgICBjcmVhdGVkX2F0OiBub3csXG4gICAgICB1cGRhdGVkX2F0OiBub3csXG4gICAgfTtcblxuICAgIHJvb21zLnNldChpZCwgcm9vbSk7XG5cbiAgICByZXMuc3RhdHVzKDIwMSkuanNvbih7IHJvb20gfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkNyZWF0ZSB0cmFkZSByb29tIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gY3JlYXRlIHJvb21cIiB9KTtcbiAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUdldFRyYWRlUm9vbTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHJvb21JZCB9ID0gcmVxLnBhcmFtcztcbiAgICBjb25zdCByb29tID0gcm9vbXMuZ2V0KHJvb21JZCk7XG5cbiAgICBpZiAoIXJvb20pIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiBcIlJvb20gbm90IGZvdW5kXCIgfSk7XG4gICAgfVxuXG4gICAgcmVzLmpzb24oeyByb29tIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJHZXQgdHJhZGUgcm9vbSBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGdldCByb29tXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVVcGRhdGVUcmFkZVJvb206IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyByb29tSWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgY29uc3Qgcm9vbSA9IHJvb21zLmdldChyb29tSWQpO1xuXG4gICAgaWYgKCFyb29tKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJSb29tIG5vdCBmb3VuZFwiIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVwZGF0ZWQ6IFRyYWRlUm9vbSA9IHtcbiAgICAgIC4uLnJvb20sXG4gICAgICAuLi5yZXEuYm9keSxcbiAgICAgIGlkOiByb29tLmlkLFxuICAgICAgY3JlYXRlZF9hdDogcm9vbS5jcmVhdGVkX2F0LFxuICAgICAgdXBkYXRlZF9hdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuXG4gICAgcm9vbXMuc2V0KHJvb21JZCwgdXBkYXRlZCk7XG4gICAgcmVzLmpzb24oeyByb29tOiB1cGRhdGVkIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJVcGRhdGUgdHJhZGUgcm9vbSBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIHVwZGF0ZSByb29tXCIgfSk7XG4gIH1cbn07XG5cbi8vIFRyYWRlIE1lc3NhZ2VzIGVuZHBvaW50c1xuZXhwb3J0IGNvbnN0IGhhbmRsZUxpc3RUcmFkZU1lc3NhZ2VzOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgcm9vbUlkIH0gPSByZXEucGFyYW1zO1xuXG4gICAgY29uc3Qgcm9vbU1lc3NhZ2VzID0gbWVzc2FnZXMuZ2V0KHJvb21JZCkgfHwgW107XG4gICAgcmVzLmpzb24oeyBtZXNzYWdlczogcm9vbU1lc3NhZ2VzIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJMaXN0IHRyYWRlIG1lc3NhZ2VzIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gbGlzdCBtZXNzYWdlc1wiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlQWRkVHJhZGVNZXNzYWdlOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgcm9vbUlkIH0gPSByZXEucGFyYW1zO1xuICAgIGNvbnN0IHsgc2VuZGVyX3dhbGxldCwgbWVzc2FnZSwgYXR0YWNobWVudF91cmwgfSA9IHJlcS5ib2R5O1xuXG4gICAgaWYgKCFzZW5kZXJfd2FsbGV0IHx8ICFtZXNzYWdlKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogXCJNaXNzaW5nIHJlcXVpcmVkIGZpZWxkc1wiIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGlkID0gZ2VuZXJhdGVJZChcIm1zZ1wiKTtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXG4gICAgY29uc3QgbXNnID0ge1xuICAgICAgaWQsXG4gICAgICBzZW5kZXJfd2FsbGV0LFxuICAgICAgbWVzc2FnZSxcbiAgICAgIGF0dGFjaG1lbnRfdXJsLFxuICAgICAgY3JlYXRlZF9hdDogbm93LFxuICAgIH07XG5cbiAgICBpZiAoIW1lc3NhZ2VzLmhhcyhyb29tSWQpKSB7XG4gICAgICBtZXNzYWdlcy5zZXQocm9vbUlkLCBbXSk7XG4gICAgfVxuXG4gICAgbWVzc2FnZXMuZ2V0KHJvb21JZCkhLnB1c2gobXNnKTtcblxuICAgIHJlcy5zdGF0dXMoMjAxKS5qc29uKHsgbWVzc2FnZTogbXNnIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJBZGQgdHJhZGUgbWVzc2FnZSBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGFkZCBtZXNzYWdlXCIgfSk7XG4gIH1cbn07XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvb3JkZXJzLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9yb290L2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvb3JkZXJzLnRzXCI7aW1wb3J0IHsgUmVxdWVzdEhhbmRsZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuXG5pbnRlcmZhY2UgT3JkZXIge1xuICBpZDogc3RyaW5nO1xuICBzaWRlOiBcImJ1eVwiIHwgXCJzZWxsXCI7XG4gIGFtb3VudFBLUjogbnVtYmVyO1xuICBxdW90ZUFzc2V0OiBzdHJpbmc7XG4gIHByaWNlUEtSUGVyUXVvdGU6IG51bWJlcjtcbiAgcGF5bWVudE1ldGhvZDogc3RyaW5nO1xuICByb29tSWQ6IHN0cmluZztcbiAgY3JlYXRlZEJ5OiBzdHJpbmc7XG4gIGNyZWF0ZWRBdDogbnVtYmVyO1xuICBhY2NvdW50TmFtZT86IHN0cmluZztcbiAgYWNjb3VudE51bWJlcj86IHN0cmluZztcbiAgd2FsbGV0QWRkcmVzcz86IHN0cmluZztcbn1cblxuLy8gSW4tbWVtb3J5IHN0b3JlIGZvciBvcmRlcnMgKHdpbGwgYmUgcmVwbGFjZWQgd2l0aCBkYXRhYmFzZSBpbiBwcm9kdWN0aW9uKVxuY29uc3Qgb3JkZXJzU3RvcmUgPSBuZXcgTWFwPHN0cmluZywgT3JkZXI+KCk7XG5cbi8vIEFkbWluIHBhc3N3b3JkIGZvciB2YWxpZGF0aW9uXG5jb25zdCBBRE1JTl9QQVNTV09SRCA9IFwiUGFraXN0YW4jIzEyM1wiO1xuXG5jb25zdCBnZW5lcmF0ZUlkID0gKHByZWZpeDogc3RyaW5nKTogc3RyaW5nID0+IHtcbiAgcmV0dXJuIGAke3ByZWZpeH0tJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIsIDgpfWA7XG59O1xuXG5jb25zdCB2YWxpZGF0ZUFkbWluVG9rZW4gPSAodG9rZW46IHN0cmluZyk6IGJvb2xlYW4gPT4ge1xuICByZXR1cm4gdG9rZW4gPT09IEFETUlOX1BBU1NXT1JEO1xufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZUxpc3RPcmRlcnM6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyByb29tSWQgfSA9IHJlcS5xdWVyeTtcblxuICAgIGxldCBmaWx0ZXJlZCA9IEFycmF5LmZyb20ob3JkZXJzU3RvcmUudmFsdWVzKCkpO1xuXG4gICAgaWYgKHJvb21JZCAmJiB0eXBlb2Ygcm9vbUlkID09PSBcInN0cmluZ1wiKSB7XG4gICAgICBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcigobykgPT4gby5yb29tSWQgPT09IHJvb21JZCk7XG4gICAgfVxuXG4gICAgLy8gU29ydCBieSBjcmVhdGVkIGRhdGUsIG5ld2VzdCBmaXJzdFxuICAgIGZpbHRlcmVkLnNvcnQoKGEsIGIpID0+IGIuY3JlYXRlZEF0IC0gYS5jcmVhdGVkQXQpO1xuXG4gICAgcmVzLmpzb24oeyBvcmRlcnM6IGZpbHRlcmVkIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJMaXN0IG9yZGVycyBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGxpc3Qgb3JkZXJzXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVDcmVhdGVPcmRlcjogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7XG4gICAgICBzaWRlLFxuICAgICAgYW1vdW50UEtSLFxuICAgICAgcXVvdGVBc3NldCxcbiAgICAgIHByaWNlUEtSUGVyUXVvdGUsXG4gICAgICBwYXltZW50TWV0aG9kLFxuICAgICAgcm9vbUlkID0gXCJnbG9iYWxcIixcbiAgICAgIGNyZWF0ZWRCeSxcbiAgICAgIGFjY291bnROYW1lLFxuICAgICAgYWNjb3VudE51bWJlcixcbiAgICAgIHdhbGxldEFkZHJlc3MsXG4gICAgfSA9IHJlcS5ib2R5O1xuXG4gICAgLy8gVmFsaWRhdGUgcmVxdWlyZWQgZmllbGRzXG4gICAgaWYgKFxuICAgICAgIXNpZGUgfHxcbiAgICAgICFhbW91bnRQS1IgfHxcbiAgICAgICFxdW90ZUFzc2V0IHx8XG4gICAgICAhcHJpY2VQS1JQZXJRdW90ZSB8fFxuICAgICAgIXBheW1lbnRNZXRob2RcbiAgICApIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7XG4gICAgICAgIGVycm9yOlxuICAgICAgICAgIFwiTWlzc2luZyByZXF1aXJlZCBmaWVsZHM6IHNpZGUsIGFtb3VudFBLUiwgcXVvdGVBc3NldCwgcHJpY2VQS1JQZXJRdW90ZSwgcGF5bWVudE1ldGhvZFwiLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gVmFsaWRhdGUgYXV0aG9yaXphdGlvblxuICAgIGNvbnN0IGF1dGhIZWFkZXIgPSByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uO1xuICAgIGNvbnN0IHRva2VuID0gYXV0aEhlYWRlcj8ucmVwbGFjZShcIkJlYXJlciBcIiwgXCJcIik7XG5cbiAgICBpZiAoIXRva2VuIHx8ICF2YWxpZGF0ZUFkbWluVG9rZW4odG9rZW4pKSB7XG4gICAgICByZXR1cm4gcmVzXG4gICAgICAgIC5zdGF0dXMoNDAxKVxuICAgICAgICAuanNvbih7IGVycm9yOiBcIlVuYXV0aG9yaXplZDogaW52YWxpZCBvciBtaXNzaW5nIGFkbWluIHRva2VuXCIgfSk7XG4gICAgfVxuXG4gICAgLy8gVmFsaWRhdGUgbnVtZXJpYyBmaWVsZHNcbiAgICBjb25zdCBhbW91bnQgPSBOdW1iZXIoYW1vdW50UEtSKTtcbiAgICBjb25zdCBwcmljZSA9IE51bWJlcihwcmljZVBLUlBlclF1b3RlKTtcblxuICAgIGlmICghaXNGaW5pdGUoYW1vdW50KSB8fCBhbW91bnQgPD0gMCkge1xuICAgICAgcmV0dXJuIHJlc1xuICAgICAgICAuc3RhdHVzKDQwMClcbiAgICAgICAgLmpzb24oeyBlcnJvcjogXCJJbnZhbGlkIGFtb3VudFBLUjogbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlclwiIH0pO1xuICAgIH1cblxuICAgIGlmICghaXNGaW5pdGUocHJpY2UpIHx8IHByaWNlIDw9IDApIHtcbiAgICAgIHJldHVybiByZXNcbiAgICAgICAgLnN0YXR1cyg0MDApXG4gICAgICAgIC5qc29uKHsgZXJyb3I6IFwiSW52YWxpZCBwcmljZVBLUlBlclF1b3RlOiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyXCIgfSk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIG9yZGVyXG4gICAgY29uc3QgaWQgPSBnZW5lcmF0ZUlkKFwib3JkZXJcIik7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblxuICAgIGNvbnN0IG9yZGVyOiBPcmRlciA9IHtcbiAgICAgIGlkLFxuICAgICAgc2lkZTogc2lkZSBhcyBcImJ1eVwiIHwgXCJzZWxsXCIsXG4gICAgICBhbW91bnRQS1I6IGFtb3VudCxcbiAgICAgIHF1b3RlQXNzZXQsXG4gICAgICBwcmljZVBLUlBlclF1b3RlOiBwcmljZSxcbiAgICAgIHBheW1lbnRNZXRob2QsXG4gICAgICByb29tSWQsXG4gICAgICBjcmVhdGVkQnk6IGNyZWF0ZWRCeSB8fCBcImFkbWluXCIsXG4gICAgICBjcmVhdGVkQXQ6IG5vdyxcbiAgICAgIGFjY291bnROYW1lLFxuICAgICAgYWNjb3VudE51bWJlcixcbiAgICAgIHdhbGxldEFkZHJlc3MsXG4gICAgfTtcblxuICAgIG9yZGVyc1N0b3JlLnNldChpZCwgb3JkZXIpO1xuXG4gICAgcmVzLnN0YXR1cygyMDEpLmpzb24oeyBvcmRlciB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiQ3JlYXRlIG9yZGVyIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gY3JlYXRlIG9yZGVyXCIgfSk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVHZXRPcmRlcjogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IG9yZGVySWQgfSA9IHJlcS5wYXJhbXM7XG5cbiAgICBjb25zdCBvcmRlciA9IG9yZGVyc1N0b3JlLmdldChvcmRlcklkKTtcblxuICAgIGlmICghb3JkZXIpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiBcIk9yZGVyIG5vdCBmb3VuZFwiIH0pO1xuICAgIH1cblxuICAgIHJlcy5qc29uKHsgb3JkZXIgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkdldCBvcmRlciBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIGdldCBvcmRlclwiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlVXBkYXRlT3JkZXI6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBvcmRlcklkIH0gPSByZXEucGFyYW1zO1xuXG4gICAgLy8gVmFsaWRhdGUgYXV0aG9yaXphdGlvblxuICAgIGNvbnN0IGF1dGhIZWFkZXIgPSByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uO1xuICAgIGNvbnN0IHRva2VuID0gYXV0aEhlYWRlcj8ucmVwbGFjZShcIkJlYXJlciBcIiwgXCJcIik7XG5cbiAgICBpZiAoIXRva2VuIHx8ICF2YWxpZGF0ZUFkbWluVG9rZW4odG9rZW4pKSB7XG4gICAgICByZXR1cm4gcmVzXG4gICAgICAgIC5zdGF0dXMoNDAxKVxuICAgICAgICAuanNvbih7IGVycm9yOiBcIlVuYXV0aG9yaXplZDogaW52YWxpZCBvciBtaXNzaW5nIGFkbWluIHRva2VuXCIgfSk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3JkZXIgPSBvcmRlcnNTdG9yZS5nZXQob3JkZXJJZCk7XG5cbiAgICBpZiAoIW9yZGVyKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJPcmRlciBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1cGRhdGVkOiBPcmRlciA9IHtcbiAgICAgIC4uLm9yZGVyLFxuICAgICAgLi4ucmVxLmJvZHksXG4gICAgICBpZDogb3JkZXIuaWQsXG4gICAgICBjcmVhdGVkQXQ6IG9yZGVyLmNyZWF0ZWRBdCxcbiAgICB9O1xuXG4gICAgb3JkZXJzU3RvcmUuc2V0KG9yZGVySWQsIHVwZGF0ZWQpO1xuICAgIHJlcy5qc29uKHsgb3JkZXI6IHVwZGF0ZWQgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIlVwZGF0ZSBvcmRlciBlcnJvcjpcIiwgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiRmFpbGVkIHRvIHVwZGF0ZSBvcmRlclwiIH0pO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlRGVsZXRlT3JkZXI6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBvcmRlcklkIH0gPSByZXEucGFyYW1zO1xuXG4gICAgLy8gVmFsaWRhdGUgYXV0aG9yaXphdGlvblxuICAgIGNvbnN0IGF1dGhIZWFkZXIgPSByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uO1xuICAgIGNvbnN0IHRva2VuID0gYXV0aEhlYWRlcj8ucmVwbGFjZShcIkJlYXJlciBcIiwgXCJcIik7XG5cbiAgICBpZiAoIXRva2VuIHx8ICF2YWxpZGF0ZUFkbWluVG9rZW4odG9rZW4pKSB7XG4gICAgICByZXR1cm4gcmVzXG4gICAgICAgIC5zdGF0dXMoNDAxKVxuICAgICAgICAuanNvbih7IGVycm9yOiBcIlVuYXV0aG9yaXplZDogaW52YWxpZCBvciBtaXNzaW5nIGFkbWluIHRva2VuXCIgfSk7XG4gICAgfVxuXG4gICAgaWYgKCFvcmRlcnNTdG9yZS5oYXMob3JkZXJJZCkpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiBcIk9yZGVyIG5vdCBmb3VuZFwiIH0pO1xuICAgIH1cblxuICAgIG9yZGVyc1N0b3JlLmRlbGV0ZShvcmRlcklkKTtcbiAgICByZXMuanNvbih7IG9rOiB0cnVlIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJEZWxldGUgb3JkZXIgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkZhaWxlZCB0byBkZWxldGUgb3JkZXJcIiB9KTtcbiAgfVxufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Jvb3QvYXBwL2NvZGUvc2VydmVyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvcm9vdC9hcHAvY29kZS9zZXJ2ZXIvaW5kZXgudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Jvb3QvYXBwL2NvZGUvc2VydmVyL2luZGV4LnRzXCI7aW1wb3J0IGV4cHJlc3MgZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCBjb3JzIGZyb20gXCJjb3JzXCI7XG5pbXBvcnQgeyBoYW5kbGVTb2xhbmFScGMgfSBmcm9tIFwiLi9yb3V0ZXMvc29sYW5hLXByb3h5XCI7XG5pbXBvcnQgeyBoYW5kbGVXYWxsZXRCYWxhbmNlIH0gZnJvbSBcIi4vcm91dGVzL3dhbGxldC1iYWxhbmNlXCI7XG5pbXBvcnQgeyBoYW5kbGVFeGNoYW5nZVJhdGUgfSBmcm9tIFwiLi9yb3V0ZXMvZXhjaGFuZ2UtcmF0ZVwiO1xuaW1wb3J0IHtcbiAgaGFuZGxlRGV4c2NyZWVuZXJUb2tlbnMsXG4gIGhhbmRsZURleHNjcmVlbmVyU2VhcmNoLFxuICBoYW5kbGVEZXhzY3JlZW5lclRyZW5kaW5nLFxufSBmcm9tIFwiLi9yb3V0ZXMvZGV4c2NyZWVuZXItcHJveHlcIjtcbmltcG9ydCB7XG4gIGhhbmRsZURleHNjcmVlbmVyUHJpY2UsXG4gIGhhbmRsZVNvbFByaWNlLFxuICBoYW5kbGVUb2tlblByaWNlLFxufSBmcm9tIFwiLi9yb3V0ZXMvZGV4c2NyZWVuZXItcHJpY2VcIjtcbmltcG9ydCB7XG4gIGhhbmRsZUNvaW5NYXJrZXRDYXBRdW90ZXMsXG4gIGhhbmRsZUNvaW5NYXJrZXRDYXBTZWFyY2gsXG59IGZyb20gXCIuL3JvdXRlcy9jb2lubWFya2V0Y2FwLXByb3h5XCI7XG5pbXBvcnQge1xuICBoYW5kbGVKdXBpdGVyUHJpY2UsXG4gIGhhbmRsZUp1cGl0ZXJRdW90ZSxcbiAgaGFuZGxlSnVwaXRlclN3YXAsXG4gIGhhbmRsZUp1cGl0ZXJUb2tlbnMsXG59IGZyb20gXCIuL3JvdXRlcy9qdXBpdGVyLXByb3h5XCI7XG5pbXBvcnQgeyBoYW5kbGVGb3JleFJhdGUgfSBmcm9tIFwiLi9yb3V0ZXMvZm9yZXgtcmF0ZVwiO1xuaW1wb3J0IHsgaGFuZGxlU3RhYmxlMjRoIH0gZnJvbSBcIi4vcm91dGVzL3N0YWJsZS0yNGhcIjtcbmltcG9ydCB7IGhhbmRsZURleFRvb2xzUHJpY2UgfSBmcm9tIFwiLi9yb3V0ZXMvZGV4dG9vbHMtcHJveHlcIjtcbmltcG9ydCB7XG4gIGhhbmRsZUxpc3RUcmFkZVJvb21zLFxuICBoYW5kbGVDcmVhdGVUcmFkZVJvb20sXG4gIGhhbmRsZUdldFRyYWRlUm9vbSxcbiAgaGFuZGxlVXBkYXRlVHJhZGVSb29tLFxuICBoYW5kbGVMaXN0VHJhZGVNZXNzYWdlcyxcbiAgaGFuZGxlQWRkVHJhZGVNZXNzYWdlLFxufSBmcm9tIFwiLi9yb3V0ZXMvcDJwLW9yZGVyc1wiO1xuaW1wb3J0IHtcbiAgaGFuZGxlTGlzdE9yZGVycyxcbiAgaGFuZGxlQ3JlYXRlT3JkZXIsXG4gIGhhbmRsZUdldE9yZGVyLFxuICBoYW5kbGVVcGRhdGVPcmRlcixcbiAgaGFuZGxlRGVsZXRlT3JkZXIsXG59IGZyb20gXCIuL3JvdXRlcy9vcmRlcnNcIjtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVNlcnZlcigpOiBQcm9taXNlPGV4cHJlc3MuQXBwbGljYXRpb24+IHtcbiAgY29uc3QgYXBwID0gZXhwcmVzcygpO1xuXG4gIC8vIE1pZGRsZXdhcmVcbiAgYXBwLnVzZShjb3JzKCkpO1xuICBhcHAudXNlKGV4cHJlc3MuanNvbigpKTtcblxuICAvLyBEZXhTY3JlZW5lciByb3V0ZXNcbiAgYXBwLmdldChcIi9hcGkvZGV4c2NyZWVuZXIvdG9rZW5zXCIsIGhhbmRsZURleHNjcmVlbmVyVG9rZW5zKTtcbiAgYXBwLmdldChcIi9hcGkvZGV4c2NyZWVuZXIvc2VhcmNoXCIsIGhhbmRsZURleHNjcmVlbmVyU2VhcmNoKTtcbiAgYXBwLmdldChcIi9hcGkvZGV4c2NyZWVuZXIvdHJlbmRpbmdcIiwgaGFuZGxlRGV4c2NyZWVuZXJUcmVuZGluZyk7XG4gIGFwcC5nZXQoXCIvYXBpL2RleHNjcmVlbmVyL3ByaWNlXCIsIGhhbmRsZURleHNjcmVlbmVyUHJpY2UpO1xuXG4gIC8vIFByaWNlIHJvdXRlc1xuICBhcHAuZ2V0KFwiL2FwaS9zb2wvcHJpY2VcIiwgaGFuZGxlU29sUHJpY2UpO1xuICBhcHAuZ2V0KFwiL2FwaS90b2tlbi9wcmljZVwiLCBoYW5kbGVUb2tlblByaWNlKTtcblxuICAvLyBDb2luTWFya2V0Q2FwIHJvdXRlc1xuICBhcHAuZ2V0KFwiL2FwaS9jb2lubWFya2V0Y2FwL3F1b3Rlc1wiLCBoYW5kbGVDb2luTWFya2V0Q2FwUXVvdGVzKTtcbiAgYXBwLmdldChcIi9hcGkvY29pbm1hcmtldGNhcC9zZWFyY2hcIiwgaGFuZGxlQ29pbk1hcmtldENhcFNlYXJjaCk7XG5cbiAgLy8gRGV4VG9vbHMgcm91dGVzXG4gIGFwcC5nZXQoXCIvYXBpL2RleHRvb2xzL3ByaWNlXCIsIGhhbmRsZURleFRvb2xzUHJpY2UpO1xuXG4gIC8vIEp1cGl0ZXIgcm91dGVzXG4gIGFwcC5nZXQoXCIvYXBpL2p1cGl0ZXIvcHJpY2VcIiwgaGFuZGxlSnVwaXRlclByaWNlKTtcbiAgYXBwLmdldChcIi9hcGkvanVwaXRlci9xdW90ZVwiLCBoYW5kbGVKdXBpdGVyUXVvdGUpO1xuICBhcHAucG9zdChcIi9hcGkvanVwaXRlci9zd2FwXCIsIGhhbmRsZUp1cGl0ZXJTd2FwKTtcbiAgYXBwLmdldChcIi9hcGkvanVwaXRlci90b2tlbnNcIiwgaGFuZGxlSnVwaXRlclRva2Vucyk7XG5cbiAgLy8gU29sYW5hIFJQQyBwcm94eVxuICBhcHAucG9zdChcIi9hcGkvc29sYW5hLXJwY1wiLCBoYW5kbGVTb2xhbmFScGMpO1xuXG4gIC8vIFdhbGxldCByb3V0ZXNcbiAgYXBwLmdldChcIi9hcGkvd2FsbGV0L2JhbGFuY2VcIiwgaGFuZGxlV2FsbGV0QmFsYW5jZSk7XG5cbiAgLy8gUHVtcGZ1biBwcm94eSAocXVvdGUgJiBzd2FwKVxuICBhcHAuYWxsKFtcIi9hcGkvcHVtcGZ1bi9xdW90ZVwiLCBcIi9hcGkvcHVtcGZ1bi9zd2FwXCJdLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcGF0aCA9IHJlcS5wYXRoLnJlcGxhY2UoXCIvYXBpL3B1bXBmdW5cIiwgXCJcIik7XG4gICAgICAvLyAvcXVvdGUgb3IgL3N3YXBcbiAgICAgIGlmIChwYXRoID09PSBcIi8vcXVvdGVcIiB8fCBwYXRoID09PSBcIi9xdW90ZVwiKSB7XG4gICAgICAgIC8vIEFjY2VwdCBQT1NUIHdpdGggSlNPTiBib2R5IG9yIEdFVCB3aXRoIHF1ZXJ5IHBhcmFtc1xuICAgICAgICBjb25zdCBtZXRob2QgPSByZXEubWV0aG9kLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgIGxldCBpbnB1dE1pbnQgPSBcIlwiO1xuICAgICAgICBsZXQgb3V0cHV0TWludCA9IFwiXCI7XG4gICAgICAgIGxldCBhbW91bnQgPSBcIlwiO1xuXG4gICAgICAgIGlmIChtZXRob2QgPT09IFwiUE9TVFwiKSB7XG4gICAgICAgICAgY29uc3QgYm9keSA9IHJlcS5ib2R5IHx8IHt9O1xuICAgICAgICAgIGlucHV0TWludCA9IGJvZHkuaW5wdXRNaW50IHx8IGJvZHkuaW5wdXRfbWludCB8fCBcIlwiO1xuICAgICAgICAgIG91dHB1dE1pbnQgPSBib2R5Lm91dHB1dE1pbnQgfHwgYm9keS5vdXRwdXRfbWludCB8fCBcIlwiO1xuICAgICAgICAgIGFtb3VudCA9IGJvZHkuYW1vdW50IHx8IFwiXCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaW5wdXRNaW50ID0gU3RyaW5nKHJlcS5xdWVyeS5pbnB1dE1pbnQgfHwgcmVxLnF1ZXJ5LmlucHV0X21pbnQgfHwgXCJcIik7XG4gICAgICAgICAgb3V0cHV0TWludCA9IFN0cmluZyhcbiAgICAgICAgICAgIHJlcS5xdWVyeS5vdXRwdXRNaW50IHx8IHJlcS5xdWVyeS5vdXRwdXRfbWludCB8fCBcIlwiLFxuICAgICAgICAgICk7XG4gICAgICAgICAgYW1vdW50ID0gU3RyaW5nKHJlcS5xdWVyeS5hbW91bnQgfHwgXCJcIik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWlucHV0TWludCB8fCAhb3V0cHV0TWludCB8fCAhYW1vdW50KSB7XG4gICAgICAgICAgcmV0dXJuIHJlc1xuICAgICAgICAgICAgLnN0YXR1cyg0MDApXG4gICAgICAgICAgICAuanNvbih7XG4gICAgICAgICAgICAgIGVycm9yOlxuICAgICAgICAgICAgICAgIFwiTWlzc2luZyByZXF1aXJlZCBwYXJhbWV0ZXJzOiBpbnB1dE1pbnQsIG91dHB1dE1pbnQsIGFtb3VudFwiLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly9hcGkucHVtcGZ1bi5jb20vYXBpL3YxL3F1b3RlP2lucHV0X21pbnQ9JHtlbmNvZGVVUklDb21wb25lbnQoXG4gICAgICAgICAgaW5wdXRNaW50LFxuICAgICAgICApfSZvdXRwdXRfbWludD0ke2VuY29kZVVSSUNvbXBvbmVudChvdXRwdXRNaW50KX0mYW1vdW50PSR7ZW5jb2RlVVJJQ29tcG9uZW50KGFtb3VudCl9YDtcblxuICAgICAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgICBjb25zdCB0aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIDEwMDAwKTtcbiAgICAgICAgY29uc3QgcmVzcCA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgICAgIGhlYWRlcnM6IHsgQWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIiB9LFxuICAgICAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICAgIH0pO1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgIGlmICghcmVzcC5vaylcbiAgICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyhyZXNwLnN0YXR1cykuanNvbih7IGVycm9yOiBcIlB1bXBmdW4gQVBJIGVycm9yXCIgfSk7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwLmpzb24oKTtcbiAgICAgICAgcmV0dXJuIHJlcy5qc29uKGRhdGEpO1xuICAgICAgfVxuXG4gICAgICBpZiAocGF0aCA9PT0gXCIvL3N3YXBcIiB8fCBwYXRoID09PSBcIi9zd2FwXCIpIHtcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKVxuICAgICAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNSkuanNvbih7IGVycm9yOiBcIk1ldGhvZCBub3QgYWxsb3dlZFwiIH0pO1xuICAgICAgICBjb25zdCBib2R5ID0gcmVxLmJvZHkgfHwge307XG4gICAgICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBmZXRjaChcImh0dHBzOi8vYXBpLnB1bXBmdW4uY29tL2FwaS92MS9zd2FwXCIsIHtcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgIGhlYWRlcnM6IHsgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSxcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KSxcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICghcmVzcC5vaylcbiAgICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyhyZXNwLnN0YXR1cykuanNvbih7IGVycm9yOiBcIlB1bXBmdW4gc3dhcCBmYWlsZWRcIiB9KTtcbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3AuanNvbigpO1xuICAgICAgICByZXR1cm4gcmVzLmpzb24oZGF0YSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiBcIlB1bXBmdW4gcHJveHkgcGF0aCBub3QgZm91bmRcIiB9KTtcbiAgICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICAgIHJldHVybiByZXNcbiAgICAgICAgLnN0YXR1cyg1MDIpXG4gICAgICAgIC5qc29uKHtcbiAgICAgICAgICBlcnJvcjogXCJGYWlsZWQgdG8gcHJveHkgUHVtcGZ1biByZXF1ZXN0XCIsXG4gICAgICAgICAgZGV0YWlsczogZT8ubWVzc2FnZSB8fCBTdHJpbmcoZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gVG9rZW4gcHJpY2UgZW5kcG9pbnQgKHNpbXBsZSwgcm9idXN0IGZhbGxiYWNrICsgc3RhYmxlY29pbnMpXG4gIGFwcC5nZXQoXCIvYXBpL3Rva2VuL3ByaWNlXCIsIGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB0b2tlblBhcmFtID0gU3RyaW5nKFxuICAgICAgICByZXEucXVlcnkudG9rZW4gfHwgcmVxLnF1ZXJ5LnN5bWJvbCB8fCBcIkZJWEVSQ09JTlwiLFxuICAgICAgKS50b1VwcGVyQ2FzZSgpO1xuICAgICAgY29uc3QgbWludFBhcmFtID0gU3RyaW5nKHJlcS5xdWVyeS5taW50IHx8IFwiXCIpO1xuXG4gICAgICBjb25zdCBGQUxMQkFDS19VU0Q6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gICAgICAgIEZJWEVSQ09JTjogMC4wMDUsXG4gICAgICAgIFNPTDogMTgwLFxuICAgICAgICBVU0RDOiAxLjAsXG4gICAgICAgIFVTRFQ6IDEuMCxcbiAgICAgICAgTE9DS0VSOiAwLjEsXG4gICAgICB9O1xuXG4gICAgICAvLyBJZiBzdGFibGVjb2lucyBvciBrbm93biBzeW1ib2xzLCByZXR1cm4gZGV0ZXJtaW5pc3RpYyBwcmljZXNcbiAgICAgIGlmICh0b2tlblBhcmFtID09PSBcIlVTRENcIiB8fCB0b2tlblBhcmFtID09PSBcIlVTRFRcIikge1xuICAgICAgICByZXR1cm4gcmVzLmpzb24oeyB0b2tlbjogdG9rZW5QYXJhbSwgcHJpY2VVc2Q6IDEuMCB9KTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRva2VuUGFyYW0gPT09IFwiU09MXCIpXG4gICAgICAgIHJldHVybiByZXMuanNvbih7IHRva2VuOiBcIlNPTFwiLCBwcmljZVVzZDogRkFMTEJBQ0tfVVNELlNPTCB9KTtcbiAgICAgIGlmICh0b2tlblBhcmFtID09PSBcIkZJWEVSQ09JTlwiKVxuICAgICAgICByZXR1cm4gcmVzLmpzb24oe1xuICAgICAgICAgIHRva2VuOiBcIkZJWEVSQ09JTlwiLFxuICAgICAgICAgIHByaWNlVXNkOiBGQUxMQkFDS19VU0QuRklYRVJDT0lOLFxuICAgICAgICB9KTtcbiAgICAgIGlmICh0b2tlblBhcmFtID09PSBcIkxPQ0tFUlwiKVxuICAgICAgICByZXR1cm4gcmVzLmpzb24oeyB0b2tlbjogXCJMT0NLRVJcIiwgcHJpY2VVc2Q6IEZBTExCQUNLX1VTRC5MT0NLRVIgfSk7XG5cbiAgICAgIC8vIElmIG1pbnQgcHJvdmlkZWQgdGhhdCBtYXRjaGVzIGtub3duIG1pbnRzLCBtYXAgdG8gZmFsbGJhY2tcbiAgICAgIGNvbnN0IFRPS0VOX01JTlRTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgICBTT0w6IFwiU28xMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMlwiLFxuICAgICAgICBVU0RDOiBcIkVQakZXZGQ1QXVmcVNTcWVNMnFOMXh6eWJhcEM4RzR3RUdHa1p3eVREdDF2XCIsXG4gICAgICAgIFVTRFQ6IFwiRXM5dk1GcnphQ0VSbUpmckY0SDJGWUQ0S0NvTmtZMTFNY0NlOEJlbkVuc1wiLFxuICAgICAgICBGSVhFUkNPSU46IFwiSDRxS244Rk1GaGE4akp1ajh4TXJ5TXFSaEgzaDdHakx1eHc3VFZpeHB1bXBcIixcbiAgICAgICAgTE9DS0VSOiBcIkVOMW5Zclc2Mzc1ek1QVWtwa0d5R1NFWFc4V21BcVl1NHloZjZ4bkdwdW1wXCIsXG4gICAgICB9O1xuXG4gICAgICBsZXQgdG9rZW4gPSB0b2tlblBhcmFtO1xuICAgICAgbGV0IG1pbnQgPSBtaW50UGFyYW0gfHwgVE9LRU5fTUlOVFNbdG9rZW5dIHx8IFwiXCI7XG5cbiAgICAgIGlmICghbWludCAmJiB0b2tlblBhcmFtICYmIHRva2VuUGFyYW0ubGVuZ3RoID4gNDApIHtcbiAgICAgICAgbWludCA9IHRva2VuUGFyYW07XG4gICAgICAgIGNvbnN0IGludiA9IE9iamVjdC5lbnRyaWVzKFRPS0VOX01JTlRTKS5maW5kKChbLCBtXSkgPT4gbSA9PT0gbWludCk7XG4gICAgICAgIGlmIChpbnYpIHRva2VuID0gaW52WzBdO1xuICAgICAgfVxuXG4gICAgICAvLyBBcyBhIHJvYnVzdCBmYWxsYmFjaywgaWYgd2UgY291bGRuJ3QgcmVzb2x2ZSwgcmV0dXJuIGZhbGxiYWNrIFVTRCB3aGVuIGF2YWlsYWJsZVxuICAgICAgY29uc3QgZmFsbGJhY2sgPSBGQUxMQkFDS19VU0RbdG9rZW5dID8/IG51bGw7XG4gICAgICBpZiAoZmFsbGJhY2sgIT09IG51bGwpIHJldHVybiByZXMuanNvbih7IHRva2VuLCBwcmljZVVzZDogZmFsbGJhY2sgfSk7XG5cbiAgICAgIC8vIExhc3QgcmVzb3J0XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJUb2tlbiBwcmljZSBub3QgYXZhaWxhYmxlXCIgfSk7XG4gICAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgICByZXR1cm4gcmVzXG4gICAgICAgIC5zdGF0dXMoNTAyKVxuICAgICAgICAuanNvbih7XG4gICAgICAgICAgZXJyb3I6IFwiRmFpbGVkIHRvIGZldGNoIHRva2VuIHByaWNlXCIsXG4gICAgICAgICAgZGV0YWlsczogZT8ubWVzc2FnZSB8fCBTdHJpbmcoZSksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gRXhjaGFuZ2UgcmF0ZSByb3V0ZXNcbiAgYXBwLmdldChcIi9hcGkvZXhjaGFuZ2UtcmF0ZVwiLCBoYW5kbGVFeGNoYW5nZVJhdGUpO1xuICBhcHAuZ2V0KFwiL2FwaS9mb3JleC9yYXRlXCIsIGhhbmRsZUZvcmV4UmF0ZSk7XG4gIGFwcC5nZXQoXCIvYXBpL3N0YWJsZS0yNGhcIiwgaGFuZGxlU3RhYmxlMjRoKTtcblxuICAvLyBPcmRlcnMgcm91dGVzIChuZXcgQVBJKVxuICBhcHAuZ2V0KFwiL2FwaS9vcmRlcnNcIiwgaGFuZGxlTGlzdE9yZGVycyk7XG4gIGFwcC5wb3N0KFwiL2FwaS9vcmRlcnNcIiwgaGFuZGxlQ3JlYXRlT3JkZXIpO1xuICBhcHAuZ2V0KFwiL2FwaS9vcmRlcnMvOm9yZGVySWRcIiwgaGFuZGxlR2V0T3JkZXIpO1xuICBhcHAucHV0KFwiL2FwaS9vcmRlcnMvOm9yZGVySWRcIiwgaGFuZGxlVXBkYXRlT3JkZXIpO1xuICBhcHAuZGVsZXRlKFwiL2FwaS9vcmRlcnMvOm9yZGVySWRcIiwgaGFuZGxlRGVsZXRlT3JkZXIpO1xuXG4gIC8vIFAyUCBPcmRlcnMgcm91dGVzIChsZWdhY3kgQVBJKSAtIERJU0FCTEVEXG4gIC8vIFRoZXNlIGxlZ2FjeSBlbmRwb2ludHMgYXJlIGludGVudGlvbmFsbHkgZGlzYWJsZWQgdG8gc3RvcCBQMlAgb3JkZXIgaGFuZGxpbmcgZnJvbSB0aGlzIHNldHVwLlxuICAvLyBLZWVwaW5nIGV4cGxpY2l0IGRpc2FibGVkIGhhbmRsZXJzIHNvIGNhbGxlcnMgcmVjZWl2ZSBhIGNsZWFyIDQxMCBHb25lIHJlc3BvbnNlLlxuICBhcHAuZ2V0KFwiL2FwaS9wMnAvb3JkZXJzXCIsIChyZXEsIHJlcykgPT5cbiAgICByZXNcbiAgICAgIC5zdGF0dXMoNDEwKVxuICAgICAgLmpzb24oeyBlcnJvcjogXCJQMlAgb3JkZXJzIEFQSSBpcyBkaXNhYmxlZCBvbiB0aGlzIHNlcnZlclwiIH0pLFxuICApO1xuICBhcHAucG9zdChcIi9hcGkvcDJwL29yZGVyc1wiLCAocmVxLCByZXMpID0+XG4gICAgcmVzXG4gICAgICAuc3RhdHVzKDQxMClcbiAgICAgIC5qc29uKHsgZXJyb3I6IFwiUDJQIG9yZGVycyBBUEkgaXMgZGlzYWJsZWQgb24gdGhpcyBzZXJ2ZXJcIiB9KSxcbiAgKTtcbiAgYXBwLmdldChcIi9hcGkvcDJwL29yZGVycy86b3JkZXJJZFwiLCAocmVxLCByZXMpID0+XG4gICAgcmVzXG4gICAgICAuc3RhdHVzKDQxMClcbiAgICAgIC5qc29uKHsgZXJyb3I6IFwiUDJQIG9yZGVycyBBUEkgaXMgZGlzYWJsZWQgb24gdGhpcyBzZXJ2ZXJcIiB9KSxcbiAgKTtcbiAgYXBwLnB1dChcIi9hcGkvcDJwL29yZGVycy86b3JkZXJJZFwiLCAocmVxLCByZXMpID0+XG4gICAgcmVzXG4gICAgICAuc3RhdHVzKDQxMClcbiAgICAgIC5qc29uKHsgZXJyb3I6IFwiUDJQIG9yZGVycyBBUEkgaXMgZGlzYWJsZWQgb24gdGhpcyBzZXJ2ZXJcIiB9KSxcbiAgKTtcbiAgYXBwLmRlbGV0ZShcIi9hcGkvcDJwL29yZGVycy86b3JkZXJJZFwiLCAocmVxLCByZXMpID0+XG4gICAgcmVzXG4gICAgICAuc3RhdHVzKDQxMClcbiAgICAgIC5qc29uKHsgZXJyb3I6IFwiUDJQIG9yZGVycyBBUEkgaXMgZGlzYWJsZWQgb24gdGhpcyBzZXJ2ZXJcIiB9KSxcbiAgKTtcblxuICAvLyBUcmFkZSBSb29tcyByb3V0ZXNcbiAgYXBwLmdldChcIi9hcGkvcDJwL3Jvb21zXCIsIGhhbmRsZUxpc3RUcmFkZVJvb21zKTtcbiAgYXBwLnBvc3QoXCIvYXBpL3AycC9yb29tc1wiLCBoYW5kbGVDcmVhdGVUcmFkZVJvb20pO1xuICBhcHAuZ2V0KFwiL2FwaS9wMnAvcm9vbXMvOnJvb21JZFwiLCBoYW5kbGVHZXRUcmFkZVJvb20pO1xuICBhcHAucHV0KFwiL2FwaS9wMnAvcm9vbXMvOnJvb21JZFwiLCBoYW5kbGVVcGRhdGVUcmFkZVJvb20pO1xuXG4gIC8vIFRyYWRlIE1lc3NhZ2VzIHJvdXRlc1xuICBhcHAuZ2V0KFwiL2FwaS9wMnAvcm9vbXMvOnJvb21JZC9tZXNzYWdlc1wiLCBoYW5kbGVMaXN0VHJhZGVNZXNzYWdlcyk7XG4gIGFwcC5wb3N0KFwiL2FwaS9wMnAvcm9vbXMvOnJvb21JZC9tZXNzYWdlc1wiLCBoYW5kbGVBZGRUcmFkZU1lc3NhZ2UpO1xuXG4gIC8vIEhlYWx0aCBjaGVja1xuICBhcHAuZ2V0KFwiL2hlYWx0aFwiLCAocmVxLCByZXMpID0+IHtcbiAgICByZXMuanNvbih7IHN0YXR1czogXCJva1wiLCB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSB9KTtcbiAgfSk7XG5cbiAgLy8gNDA0IGhhbmRsZXJcbiAgYXBwLnVzZSgocmVxLCByZXMpID0+IHtcbiAgICByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiBcIkFQSSBlbmRwb2ludCBub3QgZm91bmRcIiwgcGF0aDogcmVxLnBhdGggfSk7XG4gIH0pO1xuXG4gIHJldHVybiBhcHA7XG59XG5cbi8vIENsb3VkZmxhcmUgV29ya2VycyBjb21wYXRpYmlsaXR5IGV4cG9ydFxuZXhwb3J0IGRlZmF1bHQge1xuICBhc3luYyBmZXRjaChyZXE6IFJlcXVlc3QpOiBQcm9taXNlPFJlc3BvbnNlPiB7XG4gICAgY29uc3QgdXJsID0gbmV3IFVSTChyZXEudXJsKTtcblxuICAgIGlmICh1cmwucGF0aG5hbWUuc3RhcnRzV2l0aChcIi9hcGkvc29sYW5hLXJwY1wiKSkge1xuICAgICAgcmV0dXJuIGF3YWl0IGhhbmRsZVNvbGFuYVJwYyhyZXEgYXMgYW55KTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFwiV2FsbGV0IGJhY2tlbmQgYWN0aXZlXCIsIHsgc3RhdHVzOiAyMDAgfSk7XG4gIH0sXG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvcm9vdC9hcHAvY29kZVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Jvb3QvYXBwL2NvZGUvdml0ZS5jb25maWcubWpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9yb290L2FwcC9jb2RlL3ZpdGUuY29uZmlnLm1qc1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gXCJ1cmxcIjtcbmltcG9ydCB7IFdlYlNvY2tldFNlcnZlciB9IGZyb20gXCJ3c1wiO1xuXG5jb25zdCBfX2Rpcm5hbWUgPSBwYXRoLmRpcm5hbWUoZmlsZVVSTFRvUGF0aChuZXcgVVJMKGltcG9ydC5tZXRhLnVybCkpKTtcblxubGV0IGFwaVNlcnZlciA9IG51bGw7XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgYmFzZTogXCIuL1wiLFxuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICB7XG4gICAgICBuYW1lOiBcImV4cHJlc3Mtc2VydmVyXCIsXG4gICAgICBhcHBseTogXCJzZXJ2ZVwiLFxuICAgICAgYXN5bmMgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgICAvLyBMb2FkIGFuZCBpbml0aWFsaXplIHRoZSBFeHByZXNzIHNlcnZlclxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHsgY3JlYXRlU2VydmVyOiBjcmVhdGVFeHByZXNzU2VydmVyIH0gPSBhd2FpdCBpbXBvcnQoXG4gICAgICAgICAgICBcIi4vc2VydmVyL2luZGV4LnRzXCJcbiAgICAgICAgICApO1xuICAgICAgICAgIGFwaVNlcnZlciA9IGF3YWl0IGNyZWF0ZUV4cHJlc3NTZXJ2ZXIoKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIltWaXRlXSBcdTI3MDUgRXhwcmVzcyBzZXJ2ZXIgaW5pdGlhbGl6ZWRcIik7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJbVml0ZV0gXHUyNzRDIEZhaWxlZCB0byBpbml0aWFsaXplIEV4cHJlc3M6XCIsIGVycik7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVnaXN0ZXIgbWlkZGxld2FyZSBCRUZPUkUgb3RoZXIgbWlkZGxld2FyZVxuICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKChyZXEsIHJlcywgbmV4dCkgPT4ge1xuICAgICAgICAgIC8vIE9ubHkgaGFuZGxlIC9hcGkgYW5kIC9oZWFsdGggcmVxdWVzdHMgd2l0aCB0aGUgRXhwcmVzcyBhcHBcbiAgICAgICAgICBpZiAocmVxLnVybC5zdGFydHNXaXRoKFwiL2FwaVwiKSB8fCByZXEudXJsID09PSBcIi9oZWFsdGhcIikge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgICAgIGBbVml0ZSBNaWRkbGV3YXJlXSBSb3V0aW5nICR7cmVxLm1ldGhvZH0gJHtyZXEudXJsfSB0byBFeHByZXNzYCxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gYXBpU2VydmVyKHJlcSwgcmVzLCBuZXh0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbmV4dCgpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBMaWdodHdlaWdodCBpbi1tZW1vcnkgV2ViU29ja2V0IHJvb21zIGF0IC93cy86cm9vbUlkIGZvciBkZXZcbiAgICAgICAgY29uc3Qgd3NzID0gbmV3IFdlYlNvY2tldFNlcnZlcih7IG5vU2VydmVyOiB0cnVlIH0pO1xuICAgICAgICBjb25zdCByb29tcyA9IG5ldyBNYXAoKTsgLy8gcm9vbUlkIC0+IFNldDxXZWJTb2NrZXQ+XG5cbiAgICAgICAgc2VydmVyLmh0dHBTZXJ2ZXI/Lm9uKFwidXBncmFkZVwiLCAocmVxdWVzdCwgc29ja2V0LCBoZWFkKSA9PiB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IHJlcXVlc3QudXJsIHx8IFwiXCI7XG4gICAgICAgICAgICBjb25zdCBtYXRjaCA9IHVybC5tYXRjaCgvXlxcL3dzXFwvKC4rKSQvKTtcbiAgICAgICAgICAgIGlmICghbWF0Y2gpIHJldHVybjsgLy8gbm90IG91ciBXUyByb3V0ZVxuXG4gICAgICAgICAgICB3c3MuaGFuZGxlVXBncmFkZShyZXF1ZXN0LCBzb2NrZXQsIGhlYWQsICh3cykgPT4ge1xuICAgICAgICAgICAgICBjb25zdCByb29tSWQgPSBkZWNvZGVVUklDb21wb25lbnQobWF0Y2hbMV0pO1xuICAgICAgICAgICAgICBpZiAoIXJvb21zLmhhcyhyb29tSWQpKSByb29tcy5zZXQocm9vbUlkLCBuZXcgU2V0KCkpO1xuICAgICAgICAgICAgICBjb25zdCBzZXQgPSByb29tcy5nZXQocm9vbUlkKTtcbiAgICAgICAgICAgICAgc2V0LmFkZCh3cyk7XG5cbiAgICAgICAgICAgICAgd3Mub24oXCJtZXNzYWdlXCIsIChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgbGV0IG1zZztcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgbXNnID0gSlNPTi5wYXJzZShkYXRhLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAobXNnICYmIG1zZy50eXBlID09PSBcImNoYXRcIikge1xuICAgICAgICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAga2luZDogXCJjaGF0XCIsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgICBpZDogTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMiksXG4gICAgICAgICAgICAgICAgICAgICAgdGV4dDogU3RyaW5nKG1zZy50ZXh0IHx8IFwiXCIpLFxuICAgICAgICAgICAgICAgICAgICAgIGF0OiBEYXRlLm5vdygpLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNsaWVudCBvZiBzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICBjbGllbnQuc2VuZChwYXlsb2FkKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobXNnICYmIG1zZy5raW5kID09PSBcIm5vdGlmaWNhdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBwYXlsb2FkID0gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBraW5kOiBcIm5vdGlmaWNhdGlvblwiLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiBtc2cuZGF0YSxcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBjbGllbnQgb2Ygc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgY2xpZW50LnNlbmQocGF5bG9hZCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge31cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1zZyAmJiBtc2cudHlwZSA9PT0gXCJwaW5nXCIpIHtcbiAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHdzLnNlbmQoSlNPTi5zdHJpbmdpZnkoeyBraW5kOiBcInBvbmdcIiwgdHM6IERhdGUubm93KCkgfSkpO1xuICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7fVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgd3Mub24oXCJjbG9zZVwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgc2V0LmRlbGV0ZSh3cyk7XG4gICAgICAgICAgICAgICAgaWYgKHNldC5zaXplID09PSAwKSByb29tcy5kZWxldGUocm9vbUlkKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAvLyBpZ25vcmUgd3MgZXJyb3JzXG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBEb24ndCByZXR1cm4gYW55dGhpbmcgLSBtaWRkbGV3YXJlIGlzIGFscmVhZHkgcmVnaXN0ZXJlZFxuICAgICAgfSxcbiAgICB9LFxuICBdLFxuICBidWlsZDoge1xuICAgIG91dERpcjogXCJkaXN0L3NwYVwiLFxuICAgIGVtcHR5T3V0RGlyOiB0cnVlLFxuICB9LFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcImNsaWVudFwiKSxcbiAgICAgIFwiQHNoYXJlZFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcInNoYXJlZFwiKSxcbiAgICAgIFwiQHV0aWxzXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwidXRpbHNcIiksXG4gICAgfSxcbiAgfSxcbn07XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUFBLElBRU0sZUFnQk87QUFsQmI7QUFBQTtBQUVB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QUFXLFVBQVUsS0FBSztBQUN4Qix3QkFBSTtBQUNGLDZCQUFPLEtBQUssT0FBTztBQUFBLG9CQUNyQixRQUFRO0FBQUEsb0JBQUM7QUFBQSxrQkFDWDtBQUFBLGdCQUNGLFdBQVcsT0FBTyxJQUFJLFNBQVMsUUFBUTtBQUNyQyxzQkFBSTtBQUNGLHVCQUFHLEtBQUssS0FBSyxVQUFVLEVBQUUsTUFBTSxRQUFRLElBQUksS0FBSyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQUEsa0JBQzFELFFBQVE7QUFBQSxrQkFBQztBQUFBLGdCQUNYO0FBQUEsY0FDRixDQUFDO0FBRUQsaUJBQUcsR0FBRyxTQUFTLE1BQU07QUFDbkIsb0JBQUksT0FBTyxFQUFFO0FBQ2Isb0JBQUksSUFBSSxTQUFTLEVBQUcsQ0FBQUEsT0FBTSxPQUFPLE1BQU07QUFBQSxjQUN6QyxDQUFDO0FBQUEsWUFDSCxDQUFDO0FBQUEsVUFDSCxTQUFTLEdBQUc7QUFBQSxVQUVaO0FBQUEsUUFDRixDQUFDO0FBQUEsTUFHSDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixhQUFhO0FBQUEsRUFDZjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsV0FBVyxRQUFRO0FBQUEsTUFDckMsV0FBVyxLQUFLLFFBQVEsV0FBVyxRQUFRO0FBQUEsTUFDM0MsVUFBVSxLQUFLLFFBQVEsV0FBVyxPQUFPO0FBQUEsSUFDM0M7QUFBQSxFQUNGO0FBQ0Y7IiwKICAibmFtZXMiOiBbIlJQQ19FTkRQT0lOVFMiLCAiTUlOVF9UT19QQUlSX0FERFJFU1MiLCAiTUlOVF9UT19TRUFSQ0hfU1lNQk9MIiwgInBhdGgiLCAiVE9LRU5fTUlOVFMiLCAiUEtSX1BFUl9VU0QiLCAiTUFSS1VQIiwgIk1JTlRfVE9fUEFJUl9BRERSRVNTIiwgImN1cnJlbnRFbmRwb2ludEluZGV4IiwgInBhdGgiLCAiZ2VuZXJhdGVJZCIsICJwYXRoIiwgIkZBTExCQUNLX1VTRCIsICJUT0tFTl9NSU5UUyIsICJyb29tcyJdCn0K
