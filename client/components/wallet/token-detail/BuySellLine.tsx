import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";
import { birdeyeAPI, BirdeyeToken } from "@/lib/services/birdeye";

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
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-3 backdrop-blur-md bg-opacity-90">
        <p className="text-gray-200 text-xs font-medium mb-2">{data.time}</p>
        <div className="space-y-1 text-xs">
          <p className="text-blue-400 font-semibold">
            O: ${data.open.toFixed(8)}
          </p>
          <p className={`font-semibold ${isGreen ? "text-emerald-400" : "text-red-400"}`}>
            H: ${data.high.toFixed(8)}
          </p>
          <p className={`font-semibold ${isGreen ? "text-emerald-400" : "text-red-400"}`}>
            L: ${data.low.toFixed(8)}
          </p>
          <p className={`font-semibold ${isGreen ? "text-emerald-400" : "text-red-400"}`}>
            C: ${data.close.toFixed(8)}
          </p>
        </div>
      </div>
    );
  }
  return null;
};

const CustomCandlestick = (props: any) => {
  const { x, y, width, height, payload } = props;

  if (!payload || payload.length === 0) return null;

  const data = payload[0];
  const yAxis = props.yAxis;
  const xAxis = props.xAxis;

  if (!yAxis || !xAxis) return null;

  const yScale = yAxis.scale;
  const candleWidth = Math.max(width * 0.6, 4);
  const halfWidth = candleWidth / 2;

  const yOpen = yScale(data.open);
  const yHigh = yScale(data.high);
  const yLow = yScale(data.low);
  const yClose = yScale(data.close);

  const isGreen = data.close >= data.open;
  const bodyTop = Math.min(yOpen, yClose);
  const bodyBottom = Math.max(yOpen, yClose);
  const bodyHeight = Math.max(bodyBottom - bodyTop, 1);

  const wickX = x + width / 2;
  const bodyX = wickX - halfWidth;

  return (
    <g>
      {/* Wick */}
      <line
        x1={wickX}
        y1={yHigh}
        x2={wickX}
        y2={yLow}
        stroke={isGreen ? "#10b981" : "#ef4444"}
        strokeWidth={1}
        opacity={0.6}
      />
      {/* Body */}
      <rect
        x={bodyX}
        y={bodyTop}
        width={candleWidth}
        height={Math.max(bodyHeight, 2)}
        fill={isGreen ? "#10b981" : "#ef4444"}
        stroke={isGreen ? "#34d399" : "#fca5a5"}
        strokeWidth={0.5}
        opacity={0.85}
      />
    </g>
  );
};

export const BuySellLine: React.FC<BuySellLineProps> = ({
  mint,
  priceData,
}) => {
  const [token, setToken] = useState<BirdeyeToken | null>(null);
  const [error, setError] = useState<string | null>(null);

  const STABLE_MINTS = new Set<string>([
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
  ]);

  useEffect(() => {
    let mounted = true;
    setError(null);

    if (STABLE_MINTS.has(mint)) {
      setToken(null);
      return () => {
        mounted = false;
      };
    }

    birdeyeAPI
      .getTokenByMint(mint)
      .then((t) => {
        if (!mounted) return;
        setToken(t);
        if (!t) setError("Trade breakdown unavailable for this token");
      })
      .catch(() => {
        if (!mounted) return;
        setError("Failed to load token data");
      });
    return () => {
      mounted = false;
    };
  }, [mint]);

  const chartData: CandleData[] = useMemo(() => {
    if (!priceData || !Array.isArray(priceData) || priceData.length === 0) {
      return [];
    }

    const candleSize = Math.ceil(priceData.length / 12);
    const candles: CandleData[] = [];

    for (let i = 0; i < priceData.length; i += candleSize) {
      const chunk = priceData.slice(i, i + candleSize);
      if (chunk.length === 0) continue;

      const open = chunk[0].price;
      const close = chunk[chunk.length - 1].price;
      const high = Math.max(...chunk.map((p) => p.price));
      const low = Math.min(...chunk.map((p) => p.price));
      const volume = chunk.reduce((acc, p) => acc + p.volume, 0);
      const timeStr = chunk[Math.floor(chunk.length / 2)].time;

      candles.push({
        time: timeStr,
        open,
        high,
        low,
        close,
        volume,
      });
    }

    return candles;
  }, [priceData]);

  const isStable = STABLE_MINTS.has(mint);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400">
        <p className="text-sm">Loading chart data...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-2 px-4 py-4">
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

      {/* Candlestick Chart Section */}
      <div className="flex-1 rounded-xl bg-gradient-to-b from-gray-900/50 to-gray-900/20 border border-gray-800/50 shadow-xl backdrop-blur-sm overflow-hidden flex flex-col">
        <div className="px-4 pt-3 pb-2">
          <h3 className="text-xs font-semibold text-gray-300">Price Chart (24h)</h3>
        </div>
        <div className="flex-1 overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 16, right: 24, left: 0, bottom: 16 }}
            >
              <defs>
                <linearGradient id="candleGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                style={{ fontSize: "11px", fontWeight: 500 }}
                tick={{ fill: "#9ca3af" }}
                interval={Math.max(0, Math.floor(chartData.length / 5) - 1)}
              />
              <YAxis
                stroke="#8b8b8b"
                style={{ fontSize: "11px" }}
                tick={{ fill: "#9ca3af" }}
                width={55}
                domain={["dataMin", "dataMax"]}
                label={{ value: "Price", angle: -90, position: "insideLeft" }}
              />
              <Tooltip content={<CandlestickTooltip />} cursor={false} />
              <Line
                type="monotone"
                dataKey="close"
                stroke="transparent"
                dot={false}
                isAnimationActive={false}
              />
              <Scatter
                dataKey="high"
                shape={<CustomCandlestick />}
                isAnimationActive={true}
                animationDuration={600}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-6 justify-center px-2 py-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"></span>
          <span className="text-xs font-medium text-gray-300">Bullish</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 shadow-lg shadow-red-500/50"></span>
          <span className="text-xs font-medium text-gray-300">Bearish</span>
        </div>
      </div>
    </div>
  );
};

export default BuySellLine;
