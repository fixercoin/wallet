export interface PricePoint {
  timestamp: number;
  price: number;
  high: number;
  low: number;
  volume: number;
}

export interface SupportResistance {
  support: number;
  resistance: number;
  pivot: number;
}

export interface TradingSignal {
  asset: string;
  currentPrice: number;
  support: number;
  resistance: number;
  pivot: number;
  signal: "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";
  buyEntry: number;
  sellEntry: number;
  confidence: number;
  analysis: string;
  priceChangePercent: number;
}

export const calculateSupportResistance = (
  prices: PricePoint[]
): SupportResistance => {
  if (prices.length === 0) {
    return { support: 0, resistance: 0, pivot: 0 };
  }

  const highs = prices.map((p) => p.high);
  const lows = prices.map((p) => p.low);
  const closes = prices.map((p) => p.price);

  const high = Math.max(...highs);
  const low = Math.min(...lows);
  const close = closes[closes.length - 1];

  const pivot = (high + low + close) / 3;
  const resistance = 2 * pivot - low;
  const support = 2 * pivot - high;

  return { support, resistance, pivot };
};

export const calculateMovingAverage = (
  prices: number[],
  period: number
): number => {
  if (prices.length < period) {
    return prices.reduce((a, b) => a + b, 0) / prices.length;
  }
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
};

export const calculateRSI = (prices: number[], period: number = 14): number => {
  if (prices.length < period + 1) {
    return 50;
  }

  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) {
    return avgGain > 0 ? 100 : 50;
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return rsi;
};

export const calculateBollingerBands = (
  prices: number[],
  period: number = 20,
  stdDev: number = 2
) => {
  if (prices.length < period) {
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    return { upper: avg, middle: avg, lower: avg };
  }

  const slice = prices.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;

  const variance =
    slice.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
  const stdev = Math.sqrt(variance);

  return {
    upper: middle + stdDev * stdev,
    middle,
    lower: middle - stdDev * stdev,
  };
};

export const generateTradingSignal = (
  asset: string,
  currentPrice: number,
  priceHistory: number[],
  supportResistance: SupportResistance,
  priceChange24h: number
): TradingSignal => {
  const rsi = calculateRSI(priceHistory);
  const ma20 = calculateMovingAverage(priceHistory, 20);
  const ma50 = calculateMovingAverage(priceHistory, 50);
  const bollingerBands = calculateBollingerBands(priceHistory);

  let signal: TradingSignal["signal"] = "NEUTRAL";
  let confidence = 0.5;
  let analysis = "";

  const rsiOversold = rsi < 30;
  const rsiOverbought = rsi > 70;
  const priceAboveMA20 = currentPrice > ma20;
  const priceAboveMA50 = currentPrice > ma50;
  const priceNearSupport =
    currentPrice > supportResistance.support &&
    currentPrice < supportResistance.support * 1.02;
  const priceNearResistance =
    currentPrice < supportResistance.resistance &&
    currentPrice > supportResistance.resistance * 0.98;

  let buySignalCount = 0;
  let sellSignalCount = 0;

  if (rsiOversold && priceNearSupport) {
    buySignalCount += 2;
    analysis += "Strong oversold condition at support. ";
  }
  if (priceAboveMA20 && priceAboveMA50) {
    buySignalCount += 1;
    analysis += "Price above both key moving averages. ";
  }
  if (currentPrice < bollingerBands.lower) {
    buySignalCount += 1;
    analysis += "Price at lower Bollinger Band. ";
  }

  if (rsiOverbought && priceNearResistance) {
    sellSignalCount += 2;
    analysis += "Strong overbought condition at resistance. ";
  }
  if (!priceAboveMA20 || !priceAboveMA50) {
    sellSignalCount += 1;
    analysis += "Price below key moving averages. ";
  }
  if (currentPrice > bollingerBands.upper) {
    sellSignalCount += 1;
    analysis += "Price at upper Bollinger Band. ";
  }

  if (priceChange24h < -5) {
    sellSignalCount += 1;
    analysis += "Negative 24h price trend. ";
  } else if (priceChange24h > 5) {
    buySignalCount += 1;
    analysis += "Positive 24h price trend. ";
  }

  if (buySignalCount > sellSignalCount) {
    confidence = 0.5 + (buySignalCount - sellSignalCount) * 0.15;
    signal =
      buySignalCount >= 4 ? "STRONG_BUY" : buySignalCount >= 2 ? "BUY" : "BUY";
  } else if (sellSignalCount > buySignalCount) {
    confidence = 0.5 + (sellSignalCount - buySignalCount) * 0.15;
    signal =
      sellSignalCount >= 4
        ? "STRONG_SELL"
        : sellSignalCount >= 2
          ? "SELL"
          : "SELL";
  }

  confidence = Math.min(confidence, 0.95);

  const buyEntry = supportResistance.support * 0.995;
  const sellEntry = supportResistance.resistance * 1.005;

  return {
    asset,
    currentPrice,
    support: supportResistance.support,
    resistance: supportResistance.resistance,
    pivot: supportResistance.pivot,
    signal,
    buyEntry,
    sellEntry,
    confidence,
    analysis: analysis.trim() || "Market is consolidating, awaiting clear direction.",
    priceChangePercent: priceChange24h,
  };
};
