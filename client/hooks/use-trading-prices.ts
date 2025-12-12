import { useState, useEffect } from "react";
import { TradingSignal, generateTradingSignal, calculateSupportResistance } from "@/lib/trading-analysis";
import { TOKEN_MINTS } from "@/lib/constants/token-mints";

export interface TradeAsset {
  symbol: string;
  name: string;
  mint: string;
  logo: string;
}

export interface PriceData {
  symbol: string;
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

const TRADE_ASSETS: TradeAsset[] = [
  {
    symbol: "SOL",
    name: "Solana",
    mint: TOKEN_MINTS.SOL,
    logo: "https://raw.githubusercontent.com/solflare-wallet/token-list/main/assets/solana/So11111111111111111111111111111111111111112/logo.png",
  },
  {
    symbol: "FIXERCOIN",
    name: "Fixercoin",
    mint: TOKEN_MINTS.FIXERCOIN,
    logo: "https://cdn.builder.io/api/v1/image/assets%2F003c5e4209a24523976f0fa5b9f0cf4e%2Fcda299d053f5450e89468ecb221497ec?format=webp&width=800",
  },
];

const FALLBACK_PRICES: Record<string, number> = {
  SOL: 165,
  FIXERCOIN: 0.15,
};

const fetchAssetPrice = async (
  symbol: string,
  mint: string
): Promise<PriceData | null> => {
  try {
    const response = await fetch(`/api/token/price?token=${symbol}&mint=${mint}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();

    return {
      symbol,
      price: data.priceUsd || FALLBACK_PRICES[symbol] || 0,
      priceChange24h: data.priceChange24h || 0,
      priceChangePercent24h: data.priceChange24h || 0,
      high24h: (data.priceUsd || FALLBACK_PRICES[symbol]) * 1.05,
      low24h: (data.priceUsd || FALLBACK_PRICES[symbol]) * 0.95,
      volume24h: data.volume24h || 0,
    };
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);

    return {
      symbol,
      price: FALLBACK_PRICES[symbol] || 0,
      priceChange24h: 0,
      priceChangePercent24h: 0,
      high24h: (FALLBACK_PRICES[symbol] || 0) * 1.05,
      low24h: (FALLBACK_PRICES[symbol] || 0) * 0.95,
      volume24h: 0,
    };
  }
};

const generatePriceHistory = (basePrice: number, volatility: number = 0.02): number[] => {
  const history: number[] = [];
  let currentPrice = basePrice;

  for (let i = 0; i < 100; i++) {
    const change = (Math.random() - 0.5) * volatility * currentPrice;
    currentPrice = Math.max(currentPrice + change, basePrice * 0.7);
    history.push(currentPrice);
  }

  return history;
};

export const useTradingPrices = () => {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  const fetchPrices = async () => {
    try {
      setLoading(true);
      setError(null);

      const pricePromises = TRADE_ASSETS.map((asset) =>
        fetchAssetPrice(asset.symbol, asset.mint)
      );
      const fetchedPrices = await Promise.all(pricePromises);
      const validPrices = fetchedPrices.filter((p): p is PriceData => p !== null);

      setPrices(validPrices);

      const signals = validPrices.map((priceData) => {
        const priceHistory = generatePriceHistory(priceData.price);
        const sr = calculateSupportResistance(
          priceHistory.map((price, i) => ({
            timestamp: Date.now() - (100 - i) * 60000,
            price,
            high: price * 1.01,
            low: price * 0.99,
            volume: Math.random() * 1000000,
          }))
        );

        return generateTradingSignal(
          priceData.symbol,
          priceData.price,
          priceHistory,
          sr,
          priceData.priceChange24h
        );
      });

      setSignals(signals);
      setLastUpdate(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch prices");
      console.error("Error fetching prices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  return {
    prices,
    signals,
    loading,
    error,
    lastUpdate,
    refetch: fetchPrices,
    assets: TRADE_ASSETS,
  };
};
