import React, { useState } from "react";
import { ArrowLeft, TrendingUp, TrendingDown, AlertCircle, RefreshCw, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTradingPrices } from "@/hooks/use-trading-prices";
import { TradingSignal } from "@/lib/trading-analysis";

const getSignalColor = (signal: string) => {
  switch (signal) {
    case "STRONG_BUY":
      return "text-green-500";
    case "BUY":
      return "text-green-400";
    case "STRONG_SELL":
      return "text-red-500";
    case "SELL":
      return "text-red-400";
    default:
      return "text-yellow-500";
  }
};

const getSignalBgColor = (signal: string) => {
  switch (signal) {
    case "STRONG_BUY":
      return "bg-green-950 border-green-700";
    case "BUY":
      return "bg-green-900/50 border-green-700/50";
    case "STRONG_SELL":
      return "bg-red-950 border-red-700";
    case "SELL":
      return "bg-red-900/50 border-red-700/50";
    default:
      return "bg-yellow-900/30 border-yellow-700/30";
  }
};

interface TradeAsset {
  symbol: string;
  name: string;
  logo: string;
}

const TradeAssetCard = ({
  signal,
  asset,
  price,
  priceChange,
}: {
  signal: TradingSignal;
  asset: TradeAsset;
  price: number;
  priceChange: number;
}) => {
  const signalColor = getSignalColor(signal.signal);
  const signalBgColor = getSignalBgColor(signal.signal);

  return (
    <Card className={`border ${signalBgColor} bg-card/30 backdrop-blur-sm hover:border-purple-500/50 transition-all`}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs">
              {asset.symbol[0]}
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">{asset.symbol}</h3>
              <p className="text-xs text-gray-500">{asset.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-lg text-white">${price.toFixed(2)}</p>
            <p className={`text-xs font-semibold ${priceChange >= 0 ? "text-green-400" : "text-red-400"}`}>
              {priceChange >= 0 ? "↑" : "↓"} {Math.abs(priceChange).toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">Signal</span>
            <span className={`font-bold text-sm px-2 py-1 rounded-md ${signalColor}`}>
              {signal.signal.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            {signal.analysis}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-background/40 p-2 rounded">
            <p className="text-gray-500 font-medium">Support</p>
            <p className="text-white font-semibold">${signal.support.toFixed(2)}</p>
          </div>
          <div className="bg-background/40 p-2 rounded">
            <p className="text-gray-500 font-medium">Pivot</p>
            <p className="text-white font-semibold">${signal.pivot.toFixed(2)}</p>
          </div>
          <div className="bg-background/40 p-2 rounded">
            <p className="text-gray-500 font-medium">Resistance</p>
            <p className="text-white font-semibold">${signal.resistance.toFixed(2)}</p>
          </div>
        </div>

        <div className="border-t border-border/50 pt-3 space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Buy Entry</span>
            <span className="text-green-400 font-semibold">${signal.buyEntry.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Sell Entry</span>
            <span className="text-red-400 font-semibold">${signal.sellEntry.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Confidence</span>
            <span className="text-white font-semibold">{(signal.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-xs font-semibold rounded-md"
          >
            Buy
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-xs font-semibold rounded-md"
          >
            Sell
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function AITradingSignalBot() {
  const navigate = useNavigate();
  const { prices, signals, loading, error, lastUpdate, refetch, assets } =
    useTradingPrices();
  const [selectedSignal, setSelectedSignal] = useState<string | null>(null);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1f1f1f] to-[#2a2a2a] text-white">
      <div className="w-full max-w-4xl mx-auto px-4 py-4 relative z-20">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="hover:bg-gray-700 text-gray-300"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-purple-500" />
            AI Trading Signal Bot
          </h1>
          <Button
            size="sm"
            onClick={() => refetch()}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-700 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-300">Error</p>
              <p className="text-xs text-red-200">{error}</p>
            </div>
          </div>
        )}

        <div className="mb-4 flex justify-between items-center text-xs text-gray-400">
          <span>Last updated: {formatTime(lastUpdate)}</span>
          <span>Real-time AI Analysis</span>
        </div>

        {loading && signals.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading trading signals...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
              {signals.map((signal, index) => {
                const priceData = prices.find((p) => p.symbol === signal.asset);
                const asset = assets.find((a) => a.symbol === signal.asset);

                return (
                  <div
                    key={`${signal.asset}-${index}`}
                    onClick={() =>
                      setSelectedSignal(
                        selectedSignal === signal.asset ? null : signal.asset
                      )
                    }
                    className="cursor-pointer transition-transform duration-200 hover:scale-105"
                  >
                    {priceData && asset && (
                      <TradeAssetCard
                        signal={signal}
                        asset={asset}
                        price={priceData.price}
                        priceChange={priceData.priceChangePercent24h}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <Card className="border-border bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                  Trading Indicators Guide
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-green-400 mb-2">
                      When to Buy:
                    </h4>
                    <ul className="text-gray-300 space-y-1 text-xs">
                      <li>
                        ✓ Price at or near Support level with STRONG_BUY signal
                      </li>
                      <li>✓ RSI below 30 (Oversold)</li>
                      <li>✓ Price breaks above resistance with volume</li>
                      <li>✓ Entry at or below BUY ENTRY point</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-red-400 mb-2">
                      When to Sell:
                    </h4>
                    <ul className="text-gray-300 space-y-1 text-xs">
                      <li>
                        ✓ Price at or near Resistance level with STRONG_SELL
                        signal
                      </li>
                      <li>✓ RSI above 70 (Overbought)</li>
                      <li>✓ Price breaks below support level</li>
                      <li>✓ Exit at or above SELL ENTRY point</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-background/50 rounded-lg border border-border">
                  <h4 className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Risk Management:
                  </h4>
                  <ul className="text-gray-300 space-y-1 text-xs">
                    <li>
                      • Always set Stop Loss below Support level (BUY orders)
                    </li>
                    <li>
                      • Always set Stop Loss above Resistance level (SELL orders)
                    </li>
                    <li>
                      • Take Profit at Resistance (BUY) or Support (SELL)
                    </li>
                    <li>• Risk only 1-2% of your portfolio per trade</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 text-center text-xs text-gray-500">
              <p>
                Signals are calculated based on daily support/resistance zones,
                moving averages, RSI, and Bollinger Bands
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
