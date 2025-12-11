import React from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { type CandleDataPoint } from "@/lib/services/token-chart";

interface CandlestickChartProps {
  data: CandleDataPoint[];
  isPositive: boolean;
  minPrice: number;
  maxPrice: number;
}

// Custom candlestick shape renderer
const CandleShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  const { open, high, low, close } = payload;

  if (!open || !high || !low || !close) {
    return null;
  }

  // Calculate the y positions for each price point
  const range = maxPrice - minPrice;
  const yScale = height / range;

  const getY = (price: number) => y + height - (price - minPrice) * yScale;

  // Calculate positions
  const openY = getY(open);
  const closeY = getY(close);
  const highY = getY(high);
  const lowY = getY(low);

  // Candlestick properties
  const candleColor = close >= open ? "#10b981" : "#ef4444"; // Green if up, red if down
  const bodyTop = Math.min(openY, closeY);
  const bodyHeight = Math.abs(closeY - openY) || 1; // Minimum height of 1px
  const wickX = x + width / 2;
  const candleWidth = Math.max(2, width * 0.6);

  return (
    <g>
      {/* Wick (high-low line) */}
      <line
        x1={wickX}
        y1={highY}
        x2={wickX}
        y2={lowY}
        stroke={candleColor}
        strokeWidth={1}
        opacity={0.7}
      />

      {/* Body (open-close rectangle) */}
      <rect
        x={x + (width - candleWidth) / 2}
        y={bodyTop}
        width={candleWidth}
        height={bodyHeight}
        fill={candleColor}
        stroke={candleColor}
        strokeWidth={1}
        opacity={0.9}
      />
    </g>
  );
};

// Placeholder values - will be overridden in parent component
let maxPrice = 1;
let minPrice = 0;

const CustomCandleShape = (props: any) => {
  return <CandleShape {...props} />;
};

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  data,
  isPositive,
  minPrice: min,
  maxPrice: max,
}) => {
  // Update the module-level variables for use in CandleShape
  maxPrice = max;
  minPrice = min;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-950 border border-gray-700 rounded px-3 py-2 text-xs shadow-lg">
          <p className="text-gray-300 font-semibold">{data.time}</p>
          <p className="text-gray-400">
            O: <span className="text-white">${data.open.toFixed(8)}</span>
          </p>
          <p className="text-gray-400">
            H: <span className="text-white">${data.high.toFixed(8)}</span>
          </p>
          <p className="text-gray-400">
            L: <span className="text-white">${data.low.toFixed(8)}</span>
          </p>
          <p className="text-gray-400">
            C:{" "}
            <span
              className={`font-semibold ${data.close >= data.open ? "text-emerald-400" : "text-red-400"}`}
            >
              ${data.close.toFixed(2)}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={data}
        margin={{ top: 5, right: 10, left: 5, bottom: 5 }}
      >
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
        <Bar
          dataKey="close"
          shape={<CustomCandleShape />}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default CandlestickChart;
