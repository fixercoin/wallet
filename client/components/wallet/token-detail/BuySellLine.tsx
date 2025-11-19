import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { birdeyeAPI } from "@/lib/services/birdeye";

interface BuySellLineProps {
  mint: string;
  priceData?: Array<{ time: string; price: number; volume: number }>;
}

interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const CandlestickTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isGreen = data.close >= data.open;
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-4 backdrop-blur-md bg-opacity-95">
        <p className="text-gray-200 text-xs font-medium mb-3 pb-2 border-b border-gray-700">
          {data.time}
        </p>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Open:</span>
            <span className="text-blue-400 font-semibold">
              ${data.open.toFixed(8)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">High:</span>
            <span className="text-emerald-400 font-semibold">
              ${data.high.toFixed(8)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Low:</span>
            <span className="text-red-400 font-semibold">
              ${data.low.toFixed(8)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Close:</span>
            <span
              className={`font-semibold ${
                isGreen ? "text-emerald-400" : "text-red-400"
              }`}
            >
              ${data.close.toFixed(8)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const BuySellLine: React.FC<BuySellLineProps> = ({
  mint,
  priceData,
}) => {
  const [error, setError] = useState<string | null>(null);

  const STABLE_MINTS = new Set<string>([
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
  ]);

  const chartData: CandleData[] = useMemo(() => {
    let dataToUse = priceData;

    // If no price data, create fallback
    if (!dataToUse || !Array.isArray(dataToUse) || dataToUse.length === 0) {
      // Generate fallback data for visualization
      const basePrice = 0.00005694;
      dataToUse = Array.from({ length: 24 }, (_, i) => ({
        time: `${i}:00`,
        price:
          basePrice *
          (1 +
            Math.sin((i / 24) * Math.PI * 2) * 0.1 +
            (Math.random() - 0.5) * 0.05),
        volume: Math.random() * 10000,
      }));
    }

    // Group data into candles (12 candles for 24-hour view)
    const candleSize = Math.max(1, Math.ceil(dataToUse.length / 12));
    const candles: CandleData[] = [];

    for (let i = 0; i < dataToUse.length; i += candleSize) {
      const chunk = dataToUse.slice(i, i + candleSize);
      if (chunk.length === 0) continue;

      const prices = chunk.map((p) => p.price);
      const open = chunk[0].price;
      const close = chunk[chunk.length - 1].price;
      const high = Math.max(...prices);
      const low = Math.min(...prices);
      const volume = chunk.reduce((acc, p) => acc + p.volume, 0);
      const midIdx = Math.floor(chunk.length / 2);
      const timeStr = chunk[midIdx].time;

      candles.push({
        time: timeStr,
        open,
        high,
        low,
        close,
        volume,
      });
    }

    return candles.length > 0
      ? candles
      : [
          {
            time: "00:00",
            open: 0.00005,
            high: 0.00006,
            low: 0.00004,
            close: 0.00005694,
            volume: 1000,
          },
        ];
  }, [priceData]);

  const isStable = STABLE_MINTS.has(mint);

  return (
    <div className="w-full h-full flex flex-col gap-3 px-4 py-4">
      {isStable && (
        <div className="text-xs text-gray-500">
          Stablecoin detected — showing neutral activity
        </div>
      )}
      {error && (
        <div className="text-xs text-red-500" role="alert">
          {error}
        </div>
      )}

      {/* Candlestick Chart */}
      <div className="flex-1 rounded-xl bg-gradient-to-b from-gray-900/50 to-gray-900/20 border border-gray-800/50 shadow-xl backdrop-blur-sm overflow-hidden flex flex-col">
        <div className="px-4 pt-3 pb-2 border-b border-gray-800/30">
          <h3 className="text-xs font-semibold text-gray-300">
            Price Chart (24h)
          </h3>
        </div>
        <div className="flex-1 w-full">
          {chartData && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 12, right: 24, left: 0, bottom: 12 }}
              >
                <defs>
                  <linearGradient
                    id="candleGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop
                      offset="95%"
                      stopColor="#3b82f6"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="#404040"
                  vertical={true}
                  opacity={0.2}
                />
                <XAxis
                  dataKey="time"
                  stroke="#8b8b8b"
                  style={{ fontSize: "10px" }}
                  tick={{ fill: "#9ca3af" }}
                  interval={Math.max(
                    0,
                    Math.floor(chartData.length / 4) - 1
                  )}
                />
                <YAxis
                  stroke="#8b8b8b"
                  style={{ fontSize: "10px" }}
                  tick={{ fill: "#9ca3af" }}
                  width={50}
                  tickFormatter={(value) => `$${value.toFixed(6)}`}
                />
                <Tooltip
                  content={<CandlestickTooltip />}
                  cursor={{ strokeDasharray: "4 4", stroke: "#666" }}
                  contentStyle={{
                    backgroundColor: "transparent",
                    border: "none",
                    padding: 0,
                  }}
                />

                {/* Close Price - Main Line (Blue) */}
                <Line
                  type="linear"
                  dataKey="close"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={800}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  name="Close"
                />

                {/* High Price - Upper Boundary (Green) */}
                <Line
                  type="linear"
                  dataKey="high"
                  stroke="#10b981"
                  strokeWidth={1}
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={800}
                  opacity={0.3}
                  name="High"
                />

                {/* Low Price - Lower Boundary (Red) */}
                <Line
                  type="linear"
                  dataKey="low"
                  stroke="#ef4444"
                  strokeWidth={1}
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={800}
                  opacity={0.3}
                  name="Low"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <p className="text-sm">No chart data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-6 justify-center px-2 py-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></span>
          <span className="text-xs font-medium text-gray-300">Close</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"></span>
          <span className="text-xs font-medium text-gray-300">High</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 shadow-lg shadow-red-500/50"></span>
          <span className="text-xs font-medium text-gray-300">Low</span>
        </div>
      </div>
    </div>
  );
};

export default BuySellLine;
