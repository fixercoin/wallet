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
          <div className="flex items-center gap-3">
            <img
              src={asset.logo}
              alt={asset.symbol}
              className="w-10 h-10 rounded-full bg-gray-700 object-cover"
              onError={(e) => {
                e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23374151'/%3E%3Ctext x='50' y='60' text-anchor='middle' font-size='40' font-weight='bold' fill='white'%3E" + asset.symbol[0] + "%3C/text%3E%3C/svg%3E";
              }}
            />
            <div>
              <h3 className="font-bold text-white text-sm">{asset.symbol}</h3>
              <p className="text-xs text-gray-500">{asset.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-lg text-white">
              ${asset.symbol === "FIXERCOIN" ? price.toFixed(8) : price.toFixed(2)}
            </p>
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
            <p className="text-white font-semibold">
              ${asset.symbol === "FIXERCOIN" ? signal.support.toFixed(8) : signal.support.toFixed(2)}
            </p>
          </div>
          <div className="bg-background/40 p-2 rounded">
            <p className="text-gray-500 font-medium">Pivot</p>
            <p className="text-white font-semibold">
              ${asset.symbol === "FIXERCOIN" ? signal.pivot.toFixed(8) : signal.pivot.toFixed(2)}
            </p>
          </div>
          <div className="bg-background/40 p-2 rounded">
            <p className="text-gray-500 font-medium">Resistance</p>
            <p className="text-white font-semibold">
              ${asset.symbol === "FIXERCOIN" ? signal.resistance.toFixed(8) : signal.resistance.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="border-t border-border/50 pt-3 space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Buy Entry</span>
            <span className="text-green-400 font-semibold">
              ${asset.symbol === "FIXERCOIN" ? signal.buyEntry.toFixed(8) : signal.buyEntry.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Sell Entry</span>
            <span className="text-red-400 font-semibold">
              ${asset.symbol === "FIXERCOIN" ? signal.sellEntry.toFixed(8) : signal.sellEntry.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Confidence</span>
            <span className="text-white font-semibold">{(signal.confidence * 100).toFixed(0)}%</span>
          </div>
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
      <div className="w-full max-w-5xl mx-auto px-4 py-6 relative z-20">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="hover:bg-gray-700 text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
          <Button
            size="sm"
            onClick={() => refetch()}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-950/30 border border-red-700/50 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-red-300">Error loading signals</p>
              <p className="text-xs text-red-200/70">{error}</p>
            </div>
          </div>
        )}

        <div className="mb-6 flex justify-between items-center text-xs text-gray-500">
          <span>Updated {formatTime(lastUpdate)}</span>
          <span className="text-purple-400">Real-time AI Analysis</span>
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

            <Card className="border-border/50 bg-card/20 backdrop-blur-sm mt-8">
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-green-400 text-sm">
                      Buy Signals
                    </h4>
                    <ul className="text-gray-300 space-y-1 text-xs leading-relaxed">
                      <li>• Price at Support with STRONG_BUY</li>
                      <li>• RSI below 30 (Oversold)</li>
                      <li>• Below Buy Entry point</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-red-400 text-sm">
                      Sell Signals
                    </h4>
                    <ul className="text-gray-300 space-y-1 text-xs leading-relaxed">
                      <li>• Price at Resistance with STRONG_SELL</li>
                      <li>• RSI above 70 (Overbought)</li>
                      <li>• Above Sell Entry point</li>
                    </ul>
                  </div>
                </div>

                <div className="border-t border-border/30 pt-4 text-xs text-gray-400">
                  <p className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-yellow-500" />
                    <span>Always use stop losses and risk management. Risk only 1-2% per trade.</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
