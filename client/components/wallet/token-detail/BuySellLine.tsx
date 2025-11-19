import React, { useMemo } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload[0]) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs shadow-lg">
        <p className="text-slate-300 font-semibold mb-1">{data.time}</p>
        <p className="text-blue-400">C: ${data.close.toFixed(8)}</p>
        <p className="text-green-400">H: ${data.high.toFixed(8)}</p>
        <p className="text-red-400">L: ${data.low.toFixed(8)}</p>
      </div>
    );
  }
  return null;
};

export const BuySellLine: React.FC<BuySellLineProps> = ({
  priceData,
}) => {
  const chartData: CandleData[] = useMemo(() => {
    let prices = priceData;

    if (!prices || prices.length === 0) {
      prices = Array.from({ length: 24 }, (_, i) => ({
        time: `${i}:00`,
        price: 0.00005 * (1 + Math.sin(i / 6) * 0.2),
        volume: 1000,
      }));
    }

    const numCandles = 12;
    const groupSize = Math.ceil(prices.length / numCandles);
    const candles: CandleData[] = [];

    for (let i = 0; i < prices.length; i += groupSize) {
      const group = prices.slice(i, i + groupSize);
      if (group.length === 0) continue;

      const priceVals = group.map((p) => p.price);
      candles.push({
        time: group[Math.floor(group.length / 2)].time,
        open: group[0].price,
        close: group[group.length - 1].price,
        high: Math.max(...priceVals),
        low: Math.min(...priceVals),
      });
    }

    return candles.length > 0 ? candles : [
      { time: "0:00", open: 0.00005, close: 0.00006, high: 0.00007, low: 0.00004 }
    ];
  }, [priceData]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 rounded-lg bg-gradient-to-b from-slate-900 to-slate-800 border border-slate-700 shadow-lg overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
            <XAxis 
              dataKey="time" 
              stroke="#94a3b8" 
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              stroke="#94a3b8"
              tick={{ fontSize: 12 }}
              width={60}
              tickFormatter={(v) => `$${v.toFixed(5)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="close" 
              stroke="#3b82f6" 
              strokeWidth={3}
              dot={false}
              isAnimationActive={true}
              name="Close"
            />
            <Line 
              type="monotone" 
              dataKey="high" 
              stroke="#10b981" 
              strokeWidth={1}
              strokeOpacity={0.4}
              dot={false}
              isAnimationActive={true}
              name="High"
            />
            <Line 
              type="monotone" 
              dataKey="low" 
              stroke="#ef4444" 
              strokeWidth={1}
              strokeOpacity={0.4}
              dot={false}
              isAnimationActive={true}
              name="Low"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-6 mt-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span className="text-slate-300">Price</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
          <span className="text-slate-300">High</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          <span className="text-slate-300">Low</span>
        </div>
      </div>
    </div>
  );
};

export default BuySellLine;
