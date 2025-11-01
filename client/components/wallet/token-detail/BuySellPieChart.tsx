import { useEffect, useMemo, useState } from "react";
import {
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { dexscreenerAPI, DexscreenerToken } from "@/lib/services/dexscreener";

interface BuySellPieChartProps {
  mint: string;
}

type BuySellData = {
  buys: number;
  sells: number;
  timeframe: "m5" | "h1" | "h6" | "h24";
};

export function BuySellPieChart({ mint }: BuySellPieChartProps) {
  const [data, setData] = useState<BuySellData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!mint) return;
      setLoading(true);
      setError(null);
      try {
        const token: DexscreenerToken | null =
          await dexscreenerAPI.getTokenByMint(mint);
        if (!mounted) return;
        if (!token) {
          setError("No DexScreener data available");
          setData(null);
          return;
        }
        // Prefer 24h, then 6h, 1h, 5m
        const order: BuySellData["timeframe"][] = ["h24", "h6", "h1", "m5"];
        const tf = order.find((t) => (token.txns as any)?.[t]) || "h24";
        const tx = (token.txns as any)?.[tf] || { buys: 0, sells: 0 };
        setData({
          buys: Number(tx.buys || 0),
          sells: Number(tx.sells || 0),
          timeframe: tf,
        });
      } catch (e) {
        if (!mounted) return;
        setError("Failed to load buy/sell data");
        setData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [mint]);

  const chartData = useMemo(
    () =>
      data
        ? [
            { name: "Buys", value: data.buys, fill: "#22c55e" },
            { name: "Sells", value: data.sells, fill: "#ef4444" },
          ]
        : [],
    [data],
  );

  return (
    <div className="bg-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium">
          Buy vs Sell {data ? `(${data.timeframe})` : ""}
        </h3>
        {loading && <span className="text-xs text-gray-300">Loading…</span>}
      </div>
      {error && <div className="text-xs text-red-400 mb-2">{error}</div>}
      {chartData.length > 0 ? (
        <div className="w-full h-56">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0b0f1a",
                  border: "1px solid #1f2937",
                }}
                labelStyle={{ color: "#9ca3af" }}
                formatter={(value, name) => [value as number, name as string]}
              />
              <Legend wrapperStyle={{ color: "#e5e7eb" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        !loading && (
          <div className="text-sm text-gray-300">No trade data available.</div>
        )
      )}
    </div>
  );
}
