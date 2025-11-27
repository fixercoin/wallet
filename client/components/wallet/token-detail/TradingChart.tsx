import React, { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { TokenInfo } from "@/lib/wallet";
import { fetchTokenChartData, type TimeFrame, type CandleDataPoint } from "@/lib/services/token-chart";
import { CandlestickChart } from "./CandlestickChart";

const TIMEFRAMES: TimeFrame[] = ["1H", "1D", "1W", "1M", "2M"];

interface TradingChartProps {
  token: TokenInfo;
  mint: string;
}

export const TradingChart: React.FC<TradingChartProps> = ({ token, mint }) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeFrame>("1D");
  const [chartData, setChartData] = useState<CandleDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [priceChange, setPriceChange] = useState<number | null>(null);

  useEffect(() => {
    const loadChartData = async () => {
      setLoading(true);
      try {
        const currentPrice = token.price || 0;
        const changePercent = token.priceChange24h || 0;

        // Fetch real historical data
        const data = await fetchTokenChartData(
          mint,
          currentPrice,
          changePercent,
          selectedTimeframe,
        );

        setChartData(data);
        setPriceChange(changePercent);
      } catch (error) {
        console.error("Error loading chart data:", error);
        setChartData([]);
      } finally {
        setLoading(false);
      }
    };

    loadChartData();
  }, [selectedTimeframe, mint, token]);

  const minPrice = useMemo(() => {
    if (chartData.length === 0) return 0;
    const lows = chartData.map((d) => d.low);
    return Math.min(...lows) * 0.98;
  }, [chartData]);

  const maxPrice = useMemo(() => {
    if (chartData.length === 0) return 1;
    const highs = chartData.map((d) => d.high);
    return Math.max(...highs) * 1.02;
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
