/**
 * Token Chart Data Service
 * Fetches real historical price data from CoinGecko API
 */

export interface ChartDataPoint {
  time: string;
  price: number;
  originalTime?: number;
}

export type TimeFrame = "1H" | "1D" | "1W" | "1M" | "2M";

const TIMEFRAME_CONFIGS: Record<TimeFrame, { days: number; points: number }> =
  {
    "1H": { days: 1, points: 60 }, // 1 minute intervals
    "1D": { days: 1, points: 24 }, // 1 hour intervals
    "1W": { days: 7, points: 7 }, // 1 day intervals
    "1M": { days: 30, points: 30 }, // 1 day intervals
    "2M": { days: 60, points: 60 }, // 1 day intervals
  };

/**
 * Attempts to get the CoinGecko token ID from a Solana mint address
 * This is a limited lookup for popular tokens
 */
function getCoinGeckoId(mint: string): string | null {
  // Map of popular Solana token mints to CoinGecko IDs
  const mintToCoinGecko: Record<string, string> = {
    // SOL
    So11111111111111111111111111111111111111112: "solana",
    // USDC
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "usd-coin",
    // USDT
    Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns: "tether",
    // RAY
    "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": "raydium",
    // JUP
    JUPyiwrYJFskUPiHa7hKeqbbqJACtrdPk9QCqfi5j9U: "jupiter",
  };

  return mintToCoinGecko[mint] || null;
}

/**
 * Fetch real historical price data from CoinGecko
 */
async function fetchCoinGeckoChartData(
  coinId: string,
  timeframe: TimeFrame,
): Promise<ChartDataPoint[]> {
  const config = TIMEFRAME_CONFIGS[timeframe];

  try {
    // CoinGecko API endpoint for historical market data
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${config.days}&interval=daily`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(
        `[TokenChart] CoinGecko API error for ${coinId}: ${response.status}`,
      );
      return [];
    }

    const data = await response.json();
    const prices: Array<[number, number]> = data.prices || [];

    if (prices.length === 0) {
      return [];
    }

    // Resample to the desired number of points
    const resampled = resamplePrices(prices, config.points);

    // Format for chart
    const timeLabelsMap: Record<TimeFrame, (i: number, timestamp: number) => string> =
      {
        "1H": (i) => new Date(i).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        "1D": (i) => new Date(i).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        "1W": (i) => new Date(i).toLocaleDateString("en-US", { weekday: "short" }),
        "1M": (i) => new Date(i).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        "2M": (i) => new Date(i).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      };

    return resampled.map((point) => ({
      time: timeLabelsMap[timeframe](0, point[0]),
      price: point[1],
      originalTime: point[0],
    }));
  } catch (error) {
    console.error(
      `[TokenChart] Error fetching CoinGecko data for ${coinId}:`,
      error,
    );
    return [];
  }
}

/**
 * Resample price data to desired number of points
 */
function resamplePrices(
  prices: Array<[number, number]>,
  desiredPoints: number,
): Array<[number, number]> {
  if (prices.length <= desiredPoints) {
    return prices;
  }

  const resampled: Array<[number, number]> = [];
  const step = (prices.length - 1) / (desiredPoints - 1);

  for (let i = 0; i < desiredPoints; i++) {
    const index = Math.round(i * step);
    resampled.push(prices[index]);
  }

  return resampled;
}

/**
 * Generate fallback chart data based on price trend
 * Used when real data is not available
 */
export function generateFallbackChartData(
  basePrice: number,
  changePercent: number,
  timeframe: TimeFrame,
): ChartDataPoint[] {
  const config = TIMEFRAME_CONFIGS[timeframe];
  const points = config.points;

  const timeLabelsMap: Record<TimeFrame, (i: number) => string> = {
    "1H": (i) => `${String(i).padStart(2, "0")}:00`,
    "1D": (i) => `${i}:00`,
    "1W": (i) => {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayOffset = (new Date().getDay() - 6 + i) % 7;
      return days[dayOffset];
    },
    "1M": (i) => `Day ${i + 1}`,
    "2M": (i) => `Day ${i + 1}`,
  };

  const data: ChartDataPoint[] = [];

  for (let i = 0; i < points; i++) {
    const progress = points > 1 ? i / (points - 1) : 0;
    // Create a smooth curve that trends based on the price change
    const trend =
      Math.sin((progress - 0.5) * Math.PI) * (changePercent / 100) * 0.5;
    const noise = (Math.random() - 0.5) * 0.01;
    const factor = 1 + trend + noise;

    data.push({
      time: timeLabelsMap[timeframe](i),
      price: basePrice * Math.max(0.0001, factor), // Avoid zero prices
      originalTime: Date.now() - (points - 1 - i) * 1000,
    });
  }

  return data;
}

/**
 * Fetch chart data for a token
 * Tries to get real data from CoinGecko, falls back to synthetic data
 */
export async function fetchTokenChartData(
  mint: string,
  price: number,
  changePercent: number,
  timeframe: TimeFrame,
): Promise<ChartDataPoint[]> {
  // Try to get CoinGecko ID for this token
  const coinId = getCoinGeckoId(mint);

  if (coinId) {
    try {
      const realData = await fetchCoinGeckoChartData(coinId, timeframe);
      if (realData.length > 0) {
        console.log(
          `[TokenChart] ✅ Fetched real data from CoinGecko for ${coinId} (${timeframe})`,
        );
        return realData;
      }
    } catch (error) {
      console.error(`[TokenChart] Failed to fetch real data for ${coinId}:`, error);
    }
  }

  // Fallback to synthetic data based on known price change
  console.log(
    `[TokenChart] Using synthetic data for ${mint} (${timeframe}), change: ${changePercent}%`,
  );
  return generateFallbackChartData(price, changePercent, timeframe);
}

export const tokenChartService = {
  fetchTokenChartData,
  generateFallbackChartData,
  getCoinGeckoId,
};
