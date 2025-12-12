import React from "react";
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from "recharts";
import { type HolderData } from "@/lib/services/token-holders";

interface HolderPieChartProps {
  data: HolderData;
  isLoading?: boolean;
}

const COLORS = {
  buyers: "#3b82f6", // Blue
  sellers: "#ef4444", // Red
  holders: "#10b981", // Green
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload[0]) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-950 border border-gray-700 rounded px-3 py-2 text-xs shadow-lg">
        <p className="text-gray-300 font-semibold">{data.name}</p>
        <p className="text-white">
          {data.value}% ({data.count})
        </p>
      </div>
    );
  }
  return null;
};

export const HolderPieChart: React.FC<HolderPieChartProps> = ({
  data,
  isLoading = false,
}) => {
  // Prepare data for pie chart
  const chartData = [
    {
      name: "Buyers",
      value: data.buyers,
      count: data.buyerCount,
      fill: COLORS.buyers,
    },
    {
      name: "Sellers",
      value: data.sellers,
      count: data.sellerCount,
      fill: COLORS.sellers,
    },
    {
      name: "Holders",
      value: data.holders,
      count: data.holderCount,
      fill: COLORS.holders,
    },
  ];

  // Filter out zero values
  const filteredData = chartData.filter((item) => item.value > 0);

  if (isLoading) {
    return (
      <div className="w-full flex flex-col gap-4">
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
          <div className="w-full h-48 flex items-center justify-center text-gray-400">
            Loading holder data...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Pie Chart */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
        <div className="w-full h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={filteredData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                isAnimationActive={false}
              >
                {filteredData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detail Text with Statistics */}
      <div className="grid grid-cols-3 gap-2">
        {/* Buyers */}
        <div className="bg-gray-800/50 rounded-lg p-3 border border-blue-500/30">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS.buyers }}
            />
            <h3 className="text-xs font-semibold text-blue-400">Buyers</h3>
          </div>
          <p className="text-lg font-bold text-white">{data.buyers}%</p>
          <p className="text-xs text-gray-400">
            {data.buyerCount > 0
              ? `${data.buyerCount} accounts`
              : "No data"}
          </p>
        </div>

        {/* Sellers */}
        <div className="bg-gray-800/50 rounded-lg p-3 border border-red-500/30">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS.sellers }}
            />
            <h3 className="text-xs font-semibold text-red-400">Sellers</h3>
          </div>
          <p className="text-lg font-bold text-white">{data.sellers}%</p>
          <p className="text-xs text-gray-400">
            {data.sellerCount > 0
              ? `${data.sellerCount} accounts`
              : "No data"}
          </p>
        </div>

        {/* Holders */}
        <div className="bg-gray-800/50 rounded-lg p-3 border border-emerald-500/30">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS.holders }}
            />
            <h3 className="text-xs font-semibold text-emerald-400">Holders</h3>
          </div>
          <p className="text-lg font-bold text-white">{data.holders}%</p>
          <p className="text-xs text-gray-400">
            {data.holderCount > 0
              ? `${data.holderCount} accounts`
              : "No data"}
          </p>
        </div>
      </div>

      {/* Summary */}
      {data.totalAccounts > 0 && (
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <p className="text-xs text-gray-400">
            Total Token Accounts: <span className="text-white font-semibold">{data.totalAccounts}</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default HolderPieChart;
