import React, { useEffect, useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { TokenInfo } from "@/lib/wallet";
import { fetchTokenChartData, type TimeFrame, type ChartDataPoint } from "@/lib/services/token-chart";

const TIMEFRAMES: TimeFrame[] = ["1H", "1D", "1W", "1M", "2M"];

interface TradingChartProps {
  token: TokenInfo;
  mint: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload[0]) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-950 border border-gray-700 rounded px-3 py-2 text-xs shadow-lg">
        <p className="text-gray-300">{data.time}</p>
        <p className="text-blue-400 font-semibold">
          ${data.price.toFixed(8)}
        </p>
      </div>
    );
  }
  return null;
};

export const TradingChart: React.FC<TradingChartProps> = ({ token, mint }) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeFrame>("1D");
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [priceChange, setPriceChange] = useState<number | null>(null);

  // Generate mock data based on timeframe and price change percentage
  const generateMockChartData = (
    timeframe: TimeFrame,
    basePrice: number,
    changePercent: number,
  ): ChartDataPoint[] => {
    const pointsMap: Record<TimeFrame, number> = {
      "1H": 60,
      "1D": 24,
      "1W": 7,
      "1M": 30,
      "2M": 60,
    };

    const points = pointsMap[timeframe];
    const timeLabelsMap: Record<TimeFrame, (i: number) => string> = {
      "1H": (i) => `${String(i).padStart(2, "0")}:00`,
      "1D": (i) => `${i}:00`,
      "1W": (i) => {
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const dayOffset = (new Date().getDay() - 6 + i) % 7;
        return days[dayOffset];
      },
      "1M": (i) => `${i + 1}`,
      "2M": (i) => `${Math.floor(i / 2) + 1}`,
    };

    const data: ChartDataPoint[] = [];
    for (let i = 0; i < points; i++) {
      const progress = i / (points - 1);
      // Create a smooth sine wave trend based on the price change
      const trend =
        Math.sin((progress - 0.5) * Math.PI) * (changePercent / 100) * 0.5;
      const noise = (Math.random() - 0.5) * 0.02;
      const factor = 1 + trend + noise;

      data.push({
        time: timeLabelsMap[timeframe](i),
        price: basePrice * factor,
        originalTime: Date.now() - (points - 1 - i) * 1000,
      });
    }

    return data;
  };

  useEffect(() => {
    const loadChartData = async () => {
      setLoading(true);
      try {
        // Get current price and change from Birdeye
        const birdeye = await birdeyeAPI.getTokenByMint(mint).catch(() => null);

        const currentPrice = token.price || (birdeye?.priceUsd ?? 0);
        let changePercent =
          token.priceChange24h !== undefined
            ? token.priceChange24h
            : birdeye?.priceChange?.h24 ?? 0;

        // For different timeframes, adjust the change percent for simulation
        const timeframeChangeMap: Record<TimeFrame, number> = {
          "1H": (birdeye?.priceChange?.m5 ?? 0) * 12, // Approximate 1H
          "1D": changePercent,
          "1W": (birdeye?.priceChange?.h24 ?? 0) * 3, // Rough estimate
          "1M": (birdeye?.priceChange?.h24 ?? 0) * 7,
          "2M": (birdeye?.priceChange?.h24 ?? 0) * 14,
        };

        changePercent = timeframeChangeMap[selectedTimeframe];
        setPriceChange(changePercent);

        const data = generateMockChartData(
          selectedTimeframe,
          currentPrice,
          changePercent,
        );
        setChartData(data);
      } catch (error) {
        console.error("Error loading chart data:", error);
        // Fallback to mock data
        const data = generateMockChartData(
          selectedTimeframe,
          token.price || 0.0015,
          token.priceChange24h || -2.92,
        );
        setChartData(data);
      } finally {
        setLoading(false);
      }
    };

    loadChartData();
  }, [selectedTimeframe, mint, token]);

  const minPrice = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.min(...chartData.map((d) => d.price)) * 0.98;
  }, [chartData]);

  const maxPrice = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map((d) => d.price)) * 1.02;
  }, [chartData]);

  const isPositive = priceChange !== null && priceChange >= 0;

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Price Info Section */}
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-2xl font-bold text-white">
            ${(token.price || 0).toFixed(8)}
          </div>
          <div
            className={`flex items-center gap-1 text-sm font-semibold ${
              isPositive ? "text-emerald-400" : "text-red-400"
            }`}
          >
            <span>{isPositive ? "▲" : "▼"}</span>
            <span>
              {isPositive ? "+" : ""}
              {priceChange?.toFixed(2)}%
            </span>
            <span className="text-xs text-gray-400">just now</span>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
        <div className="w-full h-64">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(107, 114, 128, 0.2)"
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  tickLine={{ stroke: "rgba(107, 114, 128, 0.2)" }}
                  axisLine={{ stroke: "rgba(107, 114, 128, 0.2)" }}
                />
                <YAxis
                  domain={[minPrice, maxPrice]}
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  tickLine={{ stroke: "rgba(107, 114, 128, 0.2)" }}
                  axisLine={{ stroke: "rgba(107, 114, 128, 0.2)" }}
                  tickFormatter={(value) => `$${value.toFixed(6)}`}
                  width={70}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={isPositive ? "#10b981" : "#ef4444"}
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              {loading ? "Loading chart..." : "No data available"}
            </div>
          )}
        </div>
      </div>

      {/* Timeframe Buttons */}
      <div className="flex gap-2 justify-center flex-wrap">
        {TIMEFRAMES.map((tf) => (
          <Button
            key={tf}
            onClick={() => setSelectedTimeframe(tf)}
            variant={selectedTimeframe === tf ? "default" : "outline"}
            size="sm"
            className={`rounded-[2px] h-8 px-3 text-xs font-medium ${
              selectedTimeframe === tf
                ? "bg-gray-700 text-white hover:bg-gray-600"
                : "bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700"
            }`}
            disabled={loading}
          >
            {tf}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default TradingChart;
