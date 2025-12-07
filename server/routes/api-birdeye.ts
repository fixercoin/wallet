import { Request, Response } from "express";
import { fetchDexscreenerData } from "./dexscreener-proxy";

const BIRDEYE_API_KEY =
  process.env.BIRDEYE_API_KEY || "cecae2ad38d7461eaf382f533726d9bb";
const BIRDEYE_API_URL = "https://public-api.birdeye.so";

// Standard Solana token mints and fallback prices
const TOKEN_MINTS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
  FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
  LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
  FXM: "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump",
};

const FALLBACK_USD: Record<string, number> = {
  FIXERCOIN: 0.00008139, // Real-time market price
  SOL: 149.38, // Real-time market price
  USDC: 1.0,
  USDT: 1.0,
  LOCKER: 0.00001112, // Real-time market price
  FXM: 0.000003567, // Real-time market price
};

export interface BirdeyePriceData {
  address: string;
  value: number;
  updateUnixTime: number;
  priceChange24h?: number;
}

export interface BirdeyePriceResponse {
  success: boolean;
  data?: BirdeyePriceData;
  error?: string;
}

// Try to get price from DexScreener as fallback
async function getPriceFromDexScreener(mint: string): Promise<{
  price: number;
  priceChange24h: number;
  volume24h: number;
} | null> {
  try {
    console.log(`[Birdeye Fallback] Trying DexScreener for ${mint}`);
    const data = await fetchDexscreenerData(`/tokens/${mint}`);
    const pairs = Array.isArray(data?.pairs) ? data.pairs : [];

    if (pairs.length > 0) {
      const pair = pairs.find(
        (p: any) =>
          (p?.baseToken?.address === mint || p?.quoteToken?.address === mint) &&
          p?.priceUsd,
      );

      if (pair && pair.priceUsd) {
        const price = parseFloat(pair.priceUsd);
        if (isFinite(price) && price > 0) {
          console.log(
            `[Birdeye Fallback] ✅ Got price from DexScreener: $${price}`,
          );
          return {
            price,
            priceChange24h: pair.priceChange?.h24 || 0,
            volume24h: pair.volume?.h24 || 0,
          };
        }
      }
    }
  } catch (error: any) {
    console.warn(
      `[Birdeye Fallback] DexScreener error: ${error?.message || String(error)}`,
    );
  }
  return null;
}

// Try to get price from Jupiter as fallback
async function getPriceFromJupiter(mint: string): Promise<{
  price: number;
  priceChange24h: number;
  volume24h: number;
} | null> {
  try {
    console.log(`[Birdeye Fallback] Trying Jupiter for ${mint}`);
    const response = await fetch(
      `https://api.jup.ag/price?ids=${encodeURIComponent(mint)}`,
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      console.warn(
        `[Birdeye Fallback] Jupiter API returned ${response.status}`,
      );
      return null;
    }

    const data = await response.json();
    const priceData = data?.data?.[mint];

    if (priceData?.price) {
      const price = parseFloat(priceData.price);
      if (isFinite(price) && price > 0) {
        console.log(`[Birdeye Fallback] ✅ Got price from Jupiter: $${price}`);
        return {
          price,
          priceChange24h: 0,
          volume24h: 0,
        };
      }
    }
  } catch (error: any) {
    console.warn(
      `[Birdeye Fallback] Jupiter error: ${error?.message || String(error)}`,
    );
  }
  return null;
}

// Try to get token symbol to lookup fallback
function getTokenSymbol(address: string): string | null {
  for (const [symbol, mint] of Object.entries(TOKEN_MINTS)) {
    if (mint === address) {
      return symbol;
    }
  }
  return null;
}

export async function handleBirdeyePrice(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    let address = (req.query.address as string) || "";

    if (!address) {
      res.status(400).json({
        success: false,
        error: "Missing 'address' parameter",
      });
      return;
    }

    // Strip ":N" suffix if present (e.g., "mint:1" -> "mint")
    address = address.split(":")[0];

    const birdeyeUrl = `${BIRDEYE_API_URL}/public/price?address=${encodeURIComponent(address)}`;
    console.log(`[Birdeye] Fetching price for ${address} from ${birdeyeUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(birdeyeUrl, {
        headers: {
          Accept: "application/json",
          "X-API-KEY": BIRDEYE_API_KEY,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data: BirdeyePriceResponse = await response.json();

        if (data.success && data.data) {
          console.log(
            `[Birdeye] ✅ Got price for ${address}: $${data.data.value || "N/A"}`,
          );
          res.json({
            success: true,
            data: {
              address: data.data.address,
              value: data.data.value,
              updateUnixTime: data.data.updateUnixTime,
              priceChange24h: data.data.priceChange24h || 0,
            },
          });
          return;
        }
      }

      // Birdeye failed, try fallback
      console.warn(
        `[Birdeye] Request failed with status ${response.status}, trying fallback...`,
      );
    } catch (error: any) {
      console.warn(
        `[Birdeye] Fetch error: ${error?.message}, trying fallback...`,
      );
    }

    // Fallback 1: Try DexScreener
    const dexscreenerPrice = await getPriceFromDexScreener(address);
    if (dexscreenerPrice !== null) {
      return res.json({
        success: true,
        data: {
          address,
          value: dexscreenerPrice.price,
          updateUnixTime: Math.floor(Date.now() / 1000),
          priceChange24h: dexscreenerPrice.priceChange24h,
          volume24h: dexscreenerPrice.volume24h,
        },
        _source: "dexscreener",
      });
    }

    // Fallback 2: Try Jupiter
    const jupiterPrice = await getPriceFromJupiter(address);
    if (jupiterPrice !== null) {
      return res.json({
        success: true,
        data: {
          address,
          value: jupiterPrice.price,
          updateUnixTime: Math.floor(Date.now() / 1000),
          priceChange24h: jupiterPrice.priceChange24h,
          volume24h: jupiterPrice.volume24h,
        },
        _source: "jupiter",
      });
    }

    // Fallback 3: Check hardcoded fallback prices
    const tokenSymbol = getTokenSymbol(address);
    if (tokenSymbol && FALLBACK_USD[tokenSymbol]) {
      console.log(
        `[Birdeye] Using hardcoded fallback price for ${tokenSymbol}: $${FALLBACK_USD[tokenSymbol]}`,
      );
      return res.json({
        success: true,
        data: {
          address,
          value: FALLBACK_USD[tokenSymbol],
          updateUnixTime: Math.floor(Date.now() / 1000),
          priceChange24h: 0,
          volume24h: 0,
        },
        _source: "fallback",
      });
    }

    console.warn(`[Birdeye] No price available for ${address}`);
    res.status(404).json({
      success: false,
      error: "No price data available for this token",
    });
  } catch (error: any) {
    console.error(`[Birdeye] Handler error:`, error?.message || String(error));

    // Try to get fallback price for known tokens
    const address = (req.query.address as string) || "";
    const tokenSymbol = getTokenSymbol(address);

    if (tokenSymbol && FALLBACK_USD[tokenSymbol]) {
      console.log(
        `[Birdeye] Handler error fallback for ${tokenSymbol}: $${FALLBACK_USD[tokenSymbol]}`,
      );
      return res.json({
        success: true,
        data: {
          address,
          value: FALLBACK_USD[tokenSymbol],
          updateUnixTime: Math.floor(Date.now() / 1000),
          priceChange24h: 0,
          volume24h: 0,
        },
        _source: "fallback",
      });
    }

    // If no fallback available, return error but still with valid JSON
    res.json({
      success: false,
      error: "Failed to fetch token price",
      details: error?.message || String(error),
    });
  }
}
