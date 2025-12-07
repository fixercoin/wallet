const TOKEN_MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
  FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
  LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
  FXM: "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump",
};

const FALLBACK_RATES = {
  FIXERCOIN: 0.00008139,
  SOL: 149.38,
  USDC: 1.0,
  USDT: 1.0,
  LOCKER: 0.00001112,
  FXM: 0.000003567,
};

const PKR_PER_USD = 280;
const MARKUP = 1.0425;

const MINT_TO_PAIR_ADDRESS = {
  H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump:
    "5CgLEWq9VJUEQ8my8UaxEovuSWArGoXCvaftpbX4RQMy",
  EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump:
    "7X7KkV94Y9jFhkXEMhgVcMHMRzALiGj5xKmM6TT3cUvK",
  "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump":
    "BczJ8jo8Xghx2E6G3QKZiHQ6P5xYa5xP4oWc1F5HPXLX",
};

const MINT_TO_SEARCH_SYMBOL = {
  H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: "FIXERCOIN",
  EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: "LOCKER",
  "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump": "FXM",
};

async function fetchPriceFromJupiter(mint) {
  try {
    console.log(`[Jupiter Fallback] Fetching price for ${mint} from Jupiter`);

    const params = new URLSearchParams({ ids: mint });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`https://price.jup.ag/v4/price?${params}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        `[Jupiter Fallback] API returned ${response.status} for mint ${mint}`,
      );
      return null;
    }

    const data = await response.json();

    if (data.data && data.data[mint] && data.data[mint].price) {
      const price = data.data[mint].price;
      if (isFinite(price) && price > 0) {
        console.log(
          `[Jupiter Fallback] ✅ Got price for ${mint} from Jupiter: $${price}`,
        );
        return price;
      }
    }

    console.warn(`[Jupiter Fallback] No valid price data for ${mint}`);
    return null;
  } catch (error) {
    console.warn(
      `[Jupiter Fallback] Failed to fetch price:`,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

async function fetchTokenPriceFromDexScreener(mint) {
  const pairAddress = MINT_TO_PAIR_ADDRESS[mint];
  if (pairAddress) {
    try {
      const pairUrl = `https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`;
      console.log(
        `[DexScreener] Trying pair address lookup for ${mint}: ${pairUrl}`,
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(pairUrl, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
        },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.pairs && data.pairs.length > 0) {
          const priceUsd = data.pairs[0].priceUsd;
          if (priceUsd) {
            const price = parseFloat(priceUsd);
            console.log(
              `[DexScreener] ✅ Got price for ${mint} via pair address: $${price}`,
            );
            return price;
          }
        }
      }
    } catch (error) {
      console.warn(
        `[DexScreener] ⚠️ Pair address lookup failed:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
    console.log(`[DexScreener] Fetching price for ${mint} from: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        `[DexScreener] ❌ API returned ${response.status} for mint ${mint}`,
      );
      return null;
    }

    const data = await response.json();
    console.log(
      `[DexScreener] Response received for ${mint}:`,
      JSON.stringify(data).substring(0, 200),
    );

    if (data.pairs && data.pairs.length > 0) {
      const priceUsd = data.pairs[0].priceUsd;
      if (priceUsd) {
        const price = parseFloat(priceUsd);
        console.log(`[DexScreener] ✅ Got price for ${mint}: $${price}`);
        return price;
      }
    }

    const searchSymbol = MINT_TO_SEARCH_SYMBOL[mint];
    if (searchSymbol) {
      console.log(
        `[DexScreener] No pairs found, trying search fallback for ${searchSymbol}`,
      );
      try {
        const searchUrl = `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(searchSymbol)}`;
        const searchController = new AbortController();
        const searchTimeoutId = setTimeout(
          () => searchController.abort(),
          8000,
        );

        const searchResponse = await fetch(searchUrl, {
          signal: searchController.signal,
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
          },
        });
        clearTimeout(searchTimeoutId);

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.pairs && searchData.pairs.length > 0) {
            let matchingPair = searchData.pairs.find(
              (p) => p.baseToken?.address === mint && p.chainId === "solana",
            );

            if (!matchingPair) {
              matchingPair = searchData.pairs.find(
                (p) => p.quoteToken?.address === mint && p.chainId === "solana",
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

            if (!matchingPair) {
              matchingPair = searchData.pairs[0];
            }

            if (matchingPair && matchingPair.priceUsd) {
              const price = parseFloat(matchingPair.priceUsd);
              console.log(
                `[DexScreener] ✅ Got price for ${mint} via search: $${price}`,
              );
              return price;
            }
          }
        }
      } catch (searchErr) {
        console.warn(
          `[DexScreener] Search fallback failed:`,
          searchErr instanceof Error ? searchErr.message : String(searchErr),
        );
      }
    }

    // If DexScreener completely failed, try Jupiter API
    console.log(
      `[DexScreener] No pairs found, trying Jupiter API for ${mint}...`,
    );
    const jupiterPrice = await fetchPriceFromJupiter(mint);
    if (jupiterPrice !== null) {
      return jupiterPrice;
    }

    console.warn(
      `[DexScreener] No price found in DexScreener or Jupiter for ${mint}`,
    );
    return null;
  } catch (error) {
    console.error(
      `[DexScreener] ❌ Failed to fetch ${mint}:`,
      error instanceof Error ? error.message : String(error),
    );

    // Try Jupiter as last resort
    console.log(
      `[DexScreener] Error caught, trying Jupiter fallback for ${mint}...`,
    );
    const jupiterPrice = await fetchPriceFromJupiter(mint);
    if (jupiterPrice !== null) {
      return jupiterPrice;
    }

    return null;
  }
}

export async function handleExchangeRate(req, res) {
  try {
    // Normalize token parameter by extracting the token symbol before any suffix (e.g., "USDC:1" -> "USDC")
    let token = req.query.token || "FIXERCOIN";
    token = String(token).split(":")[0].toUpperCase();

    let priceUsd = null;

    if (token === "FIXERCOIN") {
      priceUsd = await fetchTokenPriceFromDexScreener(TOKEN_MINTS.FIXERCOIN);
    } else if (token === "SOL") {
      priceUsd = await fetchTokenPriceFromDexScreener(TOKEN_MINTS.SOL);
    } else if (token === "USDC" || token === "USDT") {
      priceUsd = 1.0;
    } else if (token === "LOCKER") {
      priceUsd = await fetchTokenPriceFromDexScreener(TOKEN_MINTS.LOCKER);
    }

    if (priceUsd === null || priceUsd <= 0) {
      priceUsd = FALLBACK_RATES[token] || FALLBACK_RATES.FIXERCOIN;
      console.log(
        `[ExchangeRate] Using fallback rate for ${token}: $${priceUsd}`,
      );
    } else {
      console.log(
        `[ExchangeRate] Fetched ${token} price from DexScreener: $${priceUsd}`,
      );
    }

    const rateInPKR = priceUsd * PKR_PER_USD * MARKUP;

    console.log(
      `[ExchangeRate] ${token}: $${priceUsd.toFixed(6)} USD -> ${rateInPKR.toFixed(2)} PKR (with ${(MARKUP - 1) * 100}% markup)`,
    );

    res.json({
      token,
      priceUsd,
      priceInPKR: rateInPKR,
      rate: rateInPKR,
      pkkPerUsd: PKR_PER_USD,
      markup: MARKUP,
    });
  } catch (error) {
    console.error("[ExchangeRate] Error:", error);
    res.status(500).json({
      error: "Failed to fetch exchange rate",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
