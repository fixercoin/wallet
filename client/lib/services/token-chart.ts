/**
 * Token Chart Data Service
 * Fetches real historical price data from CoinGecko API
 */

export interface ChartDataPoint {
  time: string;
  price: number;
  originalTime?: number;
}

export interface CandleDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  originalTime?: number;
}

export type TimeFrame = "15M" | "1H" | "1D" | "1W" | "1M" | "2M";

const TIMEFRAME_CONFIGS: Record<TimeFrame, { days: number; points: number }> = {
  "15M": { days: 1, points: 4 }, // 15 minute intervals (4 candles per hour)
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

    // Format for chart based on timeframe
    const formatTime = (timestamp: number, timeframe: TimeFrame): string => {
      const date = new Date(timestamp);

      switch (timeframe) {
        case "15M":
          return date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
        case "1H":
          return date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
        case "1D":
          return date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
        case "1W":
          return date.toLocaleDateString("en-US", {
            weekday: "short",
            month: "numeric",
            day: "numeric",
          });
        case "1M":
          return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
        case "2M":
          return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
        default:
          return date.toLocaleString();
      }
    };

    // Generate candlestick data instead of line data
    return generateCandleData(
      resampled,
      TIMEFRAME_CONFIGS[timeframe].points,
      timeframe,
    ) as any;
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
 * Convert flat price data into OHLC candlestick data
 */
function generateCandleData(
  prices: Array<[number, number]>,
  numCandles: number,
  timeframe: TimeFrame,
): CandleDataPoint[] {
  if (prices.length === 0) return [];

  const pricesPerCandle = Math.ceil(prices.length / numCandles);
  const candles: CandleDataPoint[] = [];

  const formatTime = (timestamp: number, timeframe: TimeFrame): string => {
    const date = new Date(timestamp);

    switch (timeframe) {
      case "15M":
        return date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      case "1H":
        return date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      case "1D":
        return date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      case "1W":
        return date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "numeric",
          day: "numeric",
        });
      case "1M":
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      case "2M":
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      default:
        return date.toLocaleString();
    }
  };

  for (let i = 0; i < numCandles; i++) {
    const start = i * pricesPerCandle;
    const end = Math.min(start + pricesPerCandle, prices.length);
    const candlePrices = prices.slice(start, end).map((p) => p[1]);

    if (candlePrices.length === 0) continue;

    const open = candlePrices[0];
    const close = candlePrices[candlePrices.length - 1];
    const high = Math.max(...candlePrices);
    const low = Math.min(...candlePrices);
    const timestamp = prices[start][0];

    candles.push({
      time: formatTime(timestamp, timeframe),
      open,
      high,
      low,
      close,
      originalTime: timestamp,
    });
  }

  return candles;
}

/**
 * Generate fallback candlestick data based on price trend
 * Used when real data is not available
 */
export function generateFallbackChartData(
  basePrice: number,
  changePercent: number,
  timeframe: TimeFrame,
): CandleDataPoint[] {
  const config = TIMEFRAME_CONFIGS[timeframe];
  const points = config.points;

  // Calculate time intervals based on timeframe
  const getIntervalMs = (): number => {
    switch (timeframe) {
      case "15M":
        return (15 * 60 * 1000); // 15 minutes to ms
      case "1H":
        return (60 / points) * 60 * 1000; // minutes to ms
      case "1D":
        return (24 / points) * 60 * 60 * 1000; // hours to ms
      case "1W":
        return (7 / points) * 24 * 60 * 60 * 1000; // days to ms
      case "1M":
        return (30 / points) * 24 * 60 * 60 * 1000; // days to ms
      case "2M":
        return (60 / points) * 24 * 60 * 60 * 1000; // days to ms
      default:
        return 60 * 60 * 1000;
    }
  };

  const formatTime = (timestamp: number, timeframe: TimeFrame): string => {
    const date = new Date(timestamp);

    switch (timeframe) {
      case "15M":
        return date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      case "1H":
        return date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      case "1D":
        return date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      case "1W":
        return date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "numeric",
          day: "numeric",
        });
      case "1M":
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      case "2M":
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      default:
        return date.toLocaleString();
    }
  };

  const data: CandleDataPoint[] = [];
  const intervalMs = getIntervalMs();
  const now = Date.now();

  for (let i = 0; i < points; i++) {
    const progress = points > 1 ? i / (points - 1) : 0;
    // Create a smooth curve that trends based on the price change
    const trend =
      Math.sin((progress - 0.5) * Math.PI) * (changePercent / 100) * 0.5;
    const noise = (Math.random() - 0.5) * 0.02;

    const timestamp = now - (points - 1 - i) * intervalMs;
    const basePrice_adjusted = basePrice * Math.max(0.0001, 1 + trend);

    // Generate OHLC values with realistic variance
    const volatility = 0.02; // 2% volatility per candle
    const open = basePrice_adjusted * (1 + (Math.random() - 0.5) * volatility);
    const close = basePrice_adjusted * (1 + (Math.random() - 0.5) * volatility);
    const high = Math.max(open, close) * (1 + Math.abs(noise));
    const low = Math.min(open, close) * (1 - Math.abs(noise));

    data.push({
      time: formatTime(timestamp, timeframe),
      open,
      high,
      low,
      close,
      originalTime: timestamp,
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
): Promise<CandleDataPoint[]> {
  // Try to get CoinGecko ID for this token
  const coinId = getCoinGeckoId(mint);

  if (coinId) {
    try {
      const realData = await fetchCoinGeckoChartData(coinId, timeframe);
      if (realData.length > 0) {
        console.log(
          `[TokenChart] ✅ Fetched real candlestick data from CoinGecko for ${coinId} (${timeframe})`,
        );
        return realData as any;
      }
    } catch (error) {
      console.error(
        `[TokenChart] Failed to fetch real data for ${coinId}:`,
        error,
      );
    }
  }

  // Fallback to synthetic candlestick data based on known price change
  console.log(
    `[TokenChart] Using synthetic candlestick data for ${mint} (${timeframe}), change: ${changePercent}%`,
  );
  return generateFallbackChartData(price, changePercent, timeframe);
}

export const tokenChartService = {
  fetchTokenChartData,
  generateFallbackChartData,
  getCoinGeckoId,
};
