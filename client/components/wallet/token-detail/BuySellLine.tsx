import React, { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

interface BuySellLineProps {
  mint: string;
  priceData?: Array<{ time: string; price: number; volume: number }>;
}

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload[0]) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs shadow-lg">
        <p className="text-slate-300 font-semibold">{data.name}</p>
        <p className="text-blue-400">{data.value.toFixed(1)}%</p>
      </div>
    );
  }
  return null;
};

export const BuySellLine: React.FC<BuySellLineProps> = ({ priceData }) => {
  const buysellData = useMemo(() => {
    let prices = priceData;

    if (!prices || prices.length === 0) {
      prices = Array.from({ length: 24 }, (_, i) => ({
        time: `${i}:00`,
        price: 0.00005 * (1 + Math.sin(i / 6) * 0.2),
        volume: 1000,
      }));
    }

    // Calculate buy/sell ratio based on price movement
    let buyVolume = 0;
    let sellVolume = 0;

    for (let i = 1; i < prices.length; i++) {
      const priceDiff = prices[i].price - prices[i - 1].price;
      const volume = prices[i].volume || 0;

      if (priceDiff > 0) {
        buyVolume += volume;
      } else if (priceDiff < 0) {
        sellVolume += volume;
      } else {
        buyVolume += volume * 0.5;
        sellVolume += volume * 0.5;
      }
    }

    // If no volume data, use synthetic ratio
    if (buyVolume === 0 && sellVolume === 0) {
      buyVolume = 65;
      sellVolume = 35;
    }

    const total = buyVolume + sellVolume;
    const buyPercentage = (buyVolume / total) * 100;
    const sellPercentage = (sellVolume / total) * 100;

    return {
      data: [
        { name: "Buys", value: parseFloat(buyPercentage.toFixed(1)) },
        { name: "Sells", value: parseFloat(sellPercentage.toFixed(1)) },
      ],
      buyVolume,
      sellVolume,
      total,
    };
  }, [priceData]);

  const COLORS = ["#10b981", "#ef4444"];

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 rounded-lg bg-transparent overflow-hidden flex flex-col p-4">
        {/* Pie Chart */}
        <div className="flex-1 flex items-center justify-center">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={buysellData.data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}%`}
                labelLine={false}
                labelStyle={{
                  fontSize: 12,
                  fontWeight: "bold",
                  fill: "#e2e8f0",
                }}
              >
                {buysellData.data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Written Details Section */}
        <div className="mt-4 space-y-3 text-sm">
          <div className="bg-slate-700/30 rounded px-3 py-2 border border-slate-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 font-semibold">
                Buy/Sell Ratio
              </span>
              <span className="text-lg font-bold text-slate-100">
                {buysellData.data[0].value}% / {buysellData.data[1].value}%
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              This token shows{" "}
              {buysellData.data[0].value > buysellData.data[1].value
                ? "more buying"
                : "more selling"}{" "}
              activity. Buyers are{" "}
              {buysellData.data[0].value > 50 ? "dominating" : "lagging behind"}{" "}
              the market.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-emerald-500/10 rounded px-2 py-2 border border-emerald-500/30">
              <p className="text-emerald-400 text-xs font-semibold">Buys</p>
              <p className="text-emerald-300 font-bold text-sm">
                {buysellData.data[0].value}%
              </p>
            </div>
            <div className="bg-red-500/10 rounded px-2 py-2 border border-red-500/30">
              <p className="text-red-400 text-xs font-semibold">Sells</p>
              <p className="text-red-300 font-bold text-sm">
                {buysellData.data[1].value}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuySellLine;
