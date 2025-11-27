const DEXSCREENER_ENDPOINTS = [
  "https://api.dexscreener.com/latest/dex",
  "https://api.dexscreener.io/latest/dex",
];

const CACHE_TTL_MS = 30_000;
const MAX_TOKENS_PER_BATCH = 20;

let currentEndpointIndex = 0;
const cache = new Map();
const inflightRequests = new Map();

// Mint to pair address mapping for pump.fun tokens
const MINT_TO_PAIR_ADDRESS = {
  H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump:
    "5CgLEWq9VJUEQ8my8UaxEovuSWArGoXCvaftpbX4RQMy", // FIXERCOIN
  EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump:
    "7X7KkV94Y9jFhkXEMhgVcMHMRzALiGj5xKmM6TT3cUvK", // LOCKER
  "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump":
    "BczJ8jo8Xghx2E6G3QKZiHQ6P5xYa5xP4oWc1F5HPXLX", // FXM
};

// Mint to search symbol mapping for tokens not found via mint lookup
const MINT_TO_SEARCH_SYMBOL = {
  H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: "FIXERCOIN",
  EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: "LOCKER",
  "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump": "FXM",
};

// Fallback prices for tokens when DexScreener returns nothing
const FALLBACK_USD = {
  FIXERCOIN: 0.00008139,
  LOCKER: 0.00001112,
  FXM: 0.000003567,
  USDC: 1.0,
  USDT: 1.0,
};

async function tryDexscreenerEndpoints(path) {
  let lastError = null;

  for (let i = 0; i < DEXSCREENER_ENDPOINTS.length; i++) {
    const endpointIndex =
      (currentEndpointIndex + i) % DEXSCREENER_ENDPOINTS.length;
    const endpoint = DEXSCREENER_ENDPOINTS[endpointIndex];
    const url = `${endpoint}${path}`;

    try {
      console.log(`Trying DexScreener API: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn(`Rate limited on ${endpoint}, trying next...`);
          continue;
        }
        throw new Error(`DexScreener API returned ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await response.text();
        if (text.startsWith("<!doctype") || text.startsWith("<html")) {
          throw new Error(
            `Invalid response from ${endpoint}: Got HTML instead of JSON (Status ${response.status})`,
          );
        }
        throw new Error(
          `Invalid content-type from ${endpoint}: ${contentType}`,
        );
      }

      const data = await response.json();
      currentEndpointIndex = endpointIndex;
      return data;
    } catch (error) {
      lastError = error;
      console.warn(
        `DexScreener endpoint ${endpoint} failed:`,
        error instanceof Error ? error.message : String(error),
      );
      if (i < DEXSCREENER_ENDPOINTS.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      continue;
    }
  }

  throw lastError || new Error("All DexScreener endpoints failed");
}

function mergePairsByToken(pairs) {
  const byMint = new Map();

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
}

export async function handleDexscreenerTokens(req, res) {
  try {
    const { mints } = req.query;

    if (!mints || typeof mints !== "string") {
      console.warn(`[DexScreener] Invalid mints parameter:`, mints);
      return res.status(400).json({
        error:
          "Missing or invalid 'mints' parameter. Expected comma-separated token mints.",
      });
    }

    console.log(`[DexScreener] Tokens request for mints: ${mints}`);

    const rawMints = mints
      .split(",")
      .map((mint) => mint.trim())
      .filter(Boolean);

    const uniqueMints = Array.from(new Set(rawMints));

    if (uniqueMints.length === 0) {
      return res.status(400).json({
        error: "No valid token mints provided.",
      });
    }

    const batches = [];
    for (let i = 0; i < uniqueMints.length; i += MAX_TOKENS_PER_BATCH) {
      batches.push(uniqueMints.slice(i, i + MAX_TOKENS_PER_BATCH));
    }

    const results = [];
    const requestedMintsSet = new Set(uniqueMints);
    const foundMintsSet = new Set();
    let schemaVersion = "1.0.0";

    for (const batch of batches) {
      const path = `/tokens/${batch.join(",")}`;
      const data = await tryDexscreenerEndpoints(path);
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

    // Find mints that weren't found in the initial batch request
    const missingMints = Array.from(requestedMintsSet).filter(
      (m) => !foundMintsSet.has(m),
    );

    // For missing mints, try pair address lookup first, then search fallback
    if (missingMints.length > 0) {
      console.log(
        `[DexScreener] ${missingMints.length} mints not found via batch, trying pair/search fallback`,
      );

      for (const mint of missingMints) {
        let found = false;

        // First, try pair address lookup if available
        const pairAddress = MINT_TO_PAIR_ADDRESS[mint];
        if (pairAddress) {
          try {
            console.log(
              `[DexScreener] Trying pair address lookup for ${mint}: ${pairAddress}`,
            );
            const pairData = await tryDexscreenerEndpoints(
              `/pairs/solana/${pairAddress}`,
            );

            if (
              pairData?.pairs &&
              Array.isArray(pairData.pairs) &&
              pairData.pairs.length > 0
            ) {
              let pair = pairData.pairs[0];

              if (
                pair.quoteToken?.address === mint &&
                pair.baseToken?.address !== mint
              ) {
                const basePrice = pair.priceUsd ? parseFloat(pair.priceUsd) : 0;
                const invertedPrice =
                  basePrice > 0 ? (1 / basePrice).toFixed(20) : "0";

                console.log(
                  `[DexScreener] Swapping tokens: ${mint} was quoteToken, inverting price`,
                );

                pair = {
                  ...pair,
                  baseToken: pair.quoteToken,
                  quoteToken: pair.baseToken,
                  priceUsd: invertedPrice,
                  priceNative: pair.priceNative
                    ? (1 / parseFloat(pair.priceNative)).toString()
                    : "0",
                };
              }

              console.log(
                `[DexScreener] ✅ Found ${mint} via pair address, priceUsd: ${pair.priceUsd || "N/A"}`,
              );
              results.push(pair);
              foundMintsSet.add(mint);
              found = true;
            } else {
              console.warn(
                `[DexScreener] Pair lookup returned no pairs for ${mint}`,
              );
            }
          } catch (pairErr) {
            console.warn(
              `[DexScreener] ⚠️ Pair address lookup failed for ${mint}:`,
              pairErr instanceof Error ? pairErr.message : String(pairErr),
            );
          }
        }

        // If pair lookup failed or unavailable, try search-based lookup
        if (!found) {
          const searchSymbol = MINT_TO_SEARCH_SYMBOL[mint];
          if (searchSymbol) {
            try {
              console.log(
                `[DexScreener] Searching for ${mint} using symbol: ${searchSymbol}`,
              );
              const searchData = await tryDexscreenerEndpoints(
                `/search/?q=${encodeURIComponent(searchSymbol)}`,
              );

              if (searchData?.pairs && Array.isArray(searchData.pairs)) {
                let matchingPair = searchData.pairs.find(
                  (p) =>
                    p.baseToken?.address === mint && p.chainId === "solana",
                );

                if (!matchingPair) {
                  matchingPair = searchData.pairs.find(
                    (p) =>
                      p.quoteToken?.address === mint && p.chainId === "solana",
                  );
                }

                if (!matchingPair) {
                  matchingPair = searchData.pairs.find(
                    (p) => p.baseToken?.address === mint,
                  );
                }

                if (!matchingPair) {
                  matchingPair = searchData.pairs.find(
                    (p) => p.quoteToken?.address === mint,
                  );
                }

                if (!matchingPair && searchData.pairs.length > 0) {
                  matchingPair = searchData.pairs[0];
                }

                if (matchingPair) {
                  console.log(
                    `[DexScreener] ✅ Found ${searchSymbol} (${mint}) via search, priceUsd: ${matchingPair.priceUsd || "N/A"}`,
                  );
                  results.push(matchingPair);
                  foundMintsSet.add(mint);
                } else {
                  console.warn(
                    `[DexScreener] ⚠️ Search returned no matching results for ${mint}`,
                  );
                }
              }
            } catch (searchErr) {
              console.warn(
                `[DexScreener] ⚠️ Search fallback failed for ${mint}:`,
                searchErr instanceof Error
                  ? searchErr.message
                  : String(searchErr),
              );
            }
          }
        }

        // If still not found, add synthetic fallback for known tokens
        if (!found) {
          try {
            const STABLE_MINTS = {
              EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
              Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns: "USDT",
            };

            const symbol =
              STABLE_MINTS[mint] || MINT_TO_SEARCH_SYMBOL[mint] || undefined;
            const fallbackPrice = symbol
              ? (FALLBACK_USD[symbol] ?? FALLBACK_USD.FIXERCOIN)
              : undefined;

            if (symbol && typeof fallbackPrice === "number") {
              console.log(
                `[DexScreener] Adding synthetic fallback for ${mint} -> ${symbol} price=${fallbackPrice}`,
              );
              const synthetic = {
                chainId: "solana",
                dexId: "fallback",
                url: "",
                pairAddress: "",
                baseToken: {
                  address: mint,
                  name: symbol,
                  symbol,
                },
                quoteToken: {
                  address: "USD",
                  name: "USD",
                  symbol: "USD",
                },
                priceNative: "0",
                priceUsd: String(fallbackPrice),
                txns: {
                  m5: { buys: 0, sells: 0 },
                  h1: { buys: 0, sells: 0 },
                  h6: { buys: 0, sells: 0 },
                  h24: { buys: 0, sells: 0 },
                },
                volume: { h24: 0, h6: 0, h1: 0, m5: 0 },
                priceChange: { m5: 0, h1: 0, h6: 0, h24: 0 },
                liquidity: { usd: 0 },
              };
              results.push(synthetic);
              foundMintsSet.add(mint);
              found = true;
            }
          } catch (e) {
            // ignore synthetic fallback failures
          }
        }
      }
    }

    const solanaPairs = mergePairsByToken(results)
      .filter((pair) => pair.chainId === "solana")
      .sort((a, b) => {
        const aLiquidity = a.liquidity?.usd || 0;
        const bLiquidity = b.liquidity?.usd || 0;
        if (bLiquidity !== aLiquidity) return bLiquidity - aLiquidity;

        const aVolume = a.volume?.h24 || 0;
        const bVolume = b.volume?.h24 || 0;
        return bVolume - aVolume;
      });

    console.log(
      `[DexScreener] ✅ Response: ${solanaPairs.length} Solana pairs found` +
        (missingMints.length > 0
          ? ` (${missingMints.length} required fallback)`
          : ""),
    );
    res.json({ schemaVersion, pairs: solanaPairs });
  } catch (error) {
    console.error("[DexScreener] ❌ Tokens proxy error:", {
      mints: req.query.mints,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : "Internal error",
        details: String(error),
      },
      schemaVersion: "1.0.0",
      pairs: [],
    });
  }
}

export async function handleDexscreenerSearch(req, res) {
  try {
    const { q } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({
        error: "Missing or invalid 'q' parameter for search query.",
      });
    }

    console.log(`[DexScreener] Search request for: ${q}`);

    const data = await tryDexscreenerEndpoints(
      `/search/?q=${encodeURIComponent(q)}`,
    );

    const solanaPairs = (data.pairs || [])
      .filter((pair) => pair.chainId === "solana")
      .slice(0, 20);

    console.log(
      `[DexScreener] ✅ Search response: ${solanaPairs.length} results`,
    );
    res.json({
      schemaVersion: data.schemaVersion || "1.0.0",
      pairs: solanaPairs,
    });
  } catch (error) {
    console.error("[DexScreener] ❌ Search proxy error:", {
      query: req.query.q,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : "Internal error",
        details: String(error),
      },
      schemaVersion: "1.0.0",
      pairs: [],
    });
  }
}

export async function handleDexscreenerTrending(req, res) {
  try {
    console.log("[DexScreener] Trending tokens request");

    const data = await tryDexscreenerEndpoints("/pairs/solana");

    const trendingPairs = (data.pairs || [])
      .filter(
        (pair) =>
          pair.volume?.h24 > 1000 &&
          pair.liquidity?.usd &&
          pair.liquidity.usd > 10000,
      )
      .sort((a, b) => {
        const aVolume = a.volume?.h24 || 0;
        const bVolume = b.volume?.h24 || 0;
        return bVolume - aVolume;
      })
      .slice(0, 50);

    console.log(
      `[DexScreener] ✅ Trending response: ${trendingPairs.length} trending pairs`,
    );
    res.json({
      schemaVersion: data.schemaVersion || "1.0.0",
      pairs: trendingPairs,
    });
  } catch (error) {
    console.error("[DexScreener] ❌ Trending proxy error:", {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : "Internal error",
        details: String(error),
      },
      schemaVersion: "1.0.0",
      pairs: [],
    });
  }
}
