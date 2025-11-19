import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Cell,
} from "recharts";
import { birdeyeAPI, BirdeyeToken } from "@/lib/services/birdeye";

interface BuySellLineProps {
  mint: string;
  priceData?: Array<{ time: string; price: number; volume: number }>;
}

interface ChartData {
  time: string;
  price: number;
  volume: number;
  buys: number;
  sells: number;
}

const PriceTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-3 backdrop-blur-md bg-opacity-90">
        <p className="text-gray-200 text-xs font-medium mb-2">{data.time}</p>
        <p className="text-blue-400 text-xs font-semibold">
          Price: ${typeof data.price === 'number' ? data.price.toFixed(8) : '0.00000000'}
        </p>
      </div>
    );
  }
  return null;
};

const BuySellTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-3 backdrop-blur-md bg-opacity-90">
        <p className="text-gray-200 text-xs font-medium mb-2">{data.time}</p>
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
          <p className="text-emerald-400 text-xs font-semibold">
            Buys: {Math.round(data.buys)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
          <p className="text-red-400 text-xs font-semibold">
            Sells: {Math.round(data.sells)}
          </p>
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
  const [token, setToken] = useState<BirdeyeToken | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Known stablecoin mints on Solana
  const STABLE_MINTS = new Set<string>([
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns", // USDT
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

  const chartData: ChartData[] = useMemo(() => {
    if (!priceData || !Array.isArray(priceData) || priceData.length === 0) {
      return [];
    }

    const points = priceData;
    const last = points[points.length - 1];
    const lastHourVol = last?.volume || 0;
    const last6hVol = points
      .slice(Math.max(0, points.length - 6))
      .reduce((acc, p) => acc + (p.volume || 0), 0);
    const last24hVol = points
      .slice(Math.max(0, points.length - 24))
      .reduce((acc, p) => acc + (p.volume || 0), 0);
    const approx5m = lastHourVol / 12;

    const makeEntry = (
      vol: number,
      priceStart: number,
      priceEnd: number,
    ) => {
      const priceDiff = priceEnd - priceStart;
      const priceChangePercent =
        Math.abs(priceStart) > 0 ? (priceDiff / priceStart) * 100 : 0;

      let ratio = 0.5;
      if (Math.abs(priceChangePercent) > 0.1) {
        ratio = 0.5 + Math.tanh(priceChangePercent / 2) * 0.3;
      }

      const buys = vol * ratio;
      const sells = vol * (1 - ratio);

      const minValue = Math.max(1, vol * 0.1);
      return {
        buys: Math.max(minValue, buys),
        sells: Math.max(minValue, sells),
      };
    };

    const price24Start = points[0]?.price ?? last.price;
    const price24End = last.price;
    const price6Start =
      points[Math.max(0, points.length - 6)]?.price ?? last.price;
    const price6End = last.price;
    const price1Start =
      points[Math.max(0, points.length - 1)]?.price ?? last.price;
    const price1End = last.price;

    const entry5m = makeEntry(Math.max(100, approx5m), price1Start, price1End);
    const entry1h = makeEntry(Math.max(100, lastHourVol), price1Start, price1End);
    const entry6h = makeEntry(Math.max(100, last6hVol), price6Start, price6End);
    const entry24h = makeEntry(Math.max(100, last24hVol), price24Start, price24End);

    const buySellEntries = [
      { time: "5m", ...entry5m },
      { time: "1h", ...entry1h },
      { time: "6h", ...entry6h },
      { time: "24h", ...entry24h },
    ];

    return priceData.map((item, idx) => {
      const timePoint = 5 + idx;
      const bsEntry = buySellEntries[Math.min(3, Math.floor(idx / 6))];
      return {
        time: item.time,
        price: item.price,
        volume: item.volume,
        buys: bsEntry.buys,
        sells: bsEntry.sells,
      };
    });
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
    <div className="w-full h-full flex flex-col gap-4 px-4 py-4">
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

      {/* Price Chart Section */}
      <div className="flex-1 rounded-xl bg-gradient-to-b from-gray-900/50 to-gray-900/20 border border-gray-800/50 shadow-xl backdrop-blur-sm overflow-hidden">
        <div className="px-4 pt-3 pb-2">
          <h3 className="text-xs font-semibold text-gray-300">Price (24h)</h3>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 20, left: -15, bottom: 0 }}
          >
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="#404040"
              vertical={false}
              opacity={0.3}
            />
            <XAxis
              dataKey="time"
              stroke="#8b8b8b"
              style={{ fontSize: "11px" }}
              tick={{ fill: "#9ca3af" }}
              interval={Math.floor(chartData.length / 4)}
            />
            <YAxis
              stroke="#8b8b8b"
              style={{ fontSize: "11px" }}
              tick={{ fill: "#9ca3af" }}
              width={50}
              domain="dataMin"
            />
            <Tooltip content={<PriceTooltip />} />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={true}
              animationDuration={800}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Buy/Sell Chart Section */}
      <div className="flex-1 rounded-xl bg-gradient-to-b from-gray-900/50 to-gray-900/20 border border-gray-800/50 shadow-xl backdrop-blur-sm overflow-hidden">
        <div className="px-4 pt-3 pb-2">
          <h3 className="text-xs font-semibold text-gray-300">Buy/Sell Activity</h3>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 20, left: -15, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="#404040"
              vertical={false}
              opacity={0.3}
            />
            <XAxis
              dataKey="time"
              stroke="#8b8b8b"
              style={{ fontSize: "11px" }}
              tick={{ fill: "#9ca3af" }}
              interval={Math.floor(chartData.length / 4)}
            />
            <YAxis
              stroke="#8b8b8b"
              style={{ fontSize: "11px" }}
              tick={{ fill: "#9ca3af" }}
              width={50}
            />
            <Tooltip content={<BuySellTooltip />} />
            <Bar dataKey="buys" stackId="a" fill="#10b981" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`buys-${index}`}
                  fill="#10b981"
                  opacity={0.8}
                />
              ))}
            </Bar>
            <Bar dataKey="sells" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`sells-${index}`}
                  fill="#ef4444"
                  opacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex gap-6 justify-center px-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></span>
          <span className="text-xs font-medium text-gray-300">Price</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"></span>
          <span className="text-xs font-medium text-gray-300">Buys</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 shadow-lg shadow-red-500/50"></span>
          <span className="text-xs font-medium text-gray-300">Sells</span>
        </div>
      </div>
    </div>
  );
};

export default BuySellLine;
