import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  defs,
  linearGradient,
  stop,
} from "recharts";
import { birdeyeAPI, BirdeyeToken } from "@/lib/services/birdeye";

interface BuySellLineProps {
  mint: string;
  priceData?: Array<{ time: string; price: number; volume: number }>;
}

interface Point {
  label: string;
  buys: number;
  sells: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-3 backdrop-blur-md bg-opacity-90">
        <p className="text-gray-200 text-xs font-medium mb-2">{data.label}</p>
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
          <p className="text-emerald-400 text-xs font-semibold">
            Buys: {payload[0]?.value || 0}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
          <p className="text-red-400 text-xs font-semibold">
            Sells: {payload[1]?.value || 0}
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

    // For stablecoins, skip remote fetch (DexScreener often lacks tx breakdown)
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

  const data: Point[] = useMemo(() => {
    const isStable = STABLE_MINTS.has(mint);

    // If caller provided priceData, derive buys/sells from price movements & volumes
    if (priceData && Array.isArray(priceData) && priceData.length > 0) {
      const points = priceData;

      const last = points[points.length - 1];
      const lastHourVol = last?.volume || 0;
      const last6hVol = points
        .slice(Math.max(0, points.length - 6))
        .reduce((acc, p) => acc + (p.volume || 0), 0);
      const last24hVol = points
        .slice(Math.max(0, points.length - 24))
        .reduce((acc, p) => acc + (p.volume || 0), 0);
      const approx5m = lastHourVol / 12; // approximate 5m as 1/12 of 1h

      const makeEntry = (
        vol: number,
        priceStart: number,
        priceEnd: number,
      ): Point => {
        // Calculate price change percentage
        const priceDiff = priceEnd - priceStart;
        const priceChangePercent =
          Math.abs(priceStart) > 0 ? (priceDiff / priceStart) * 100 : 0;

        // Use a smoother ratio calculation: more buys when price goes up, more sells when it goes down
        // But never go to 100% buys or 100% sells - always show both
        let ratio = 0.5; // default to 50/50

        if (Math.abs(priceChangePercent) > 0.1) {
          // Price changed noticeably
          ratio = 0.5 + Math.tanh(priceChangePercent / 2) * 0.3; // range: 0.2 to 0.8
        }

        const buys = Math.round(vol * ratio);
        const sells = Math.round(vol * (1 - ratio));

        // Ensure minimum values to show both bars
        const minValue = Math.max(1, Math.round(vol * 0.1)); // at least 10% of one side
        return {
          label: "",
          buys: Math.max(minValue, buys),
          sells: Math.max(minValue, sells),
        };
      };

      // determine price start/end for intervals
      const price24Start = points[0]?.price ?? last.price;
      const price24End = last.price;
      const price6Start =
        points[Math.max(0, points.length - 6)]?.price ?? last.price;
      const price6End = last.price;
      const price1Start =
        points[Math.max(0, points.length - 1)]?.price ?? last.price;
      const price1End = last.price;
      const price5mStart = price1Start; // approximate

      const entry5m = makeEntry(
        Math.max(100, approx5m),
        price5mStart,
        price1End,
      );
      const entry1h = makeEntry(
        Math.max(100, lastHourVol),
        price1Start,
        price1End,
      );
      const entry6h = makeEntry(
        Math.max(100, last6hVol),
        price6Start,
        price6End,
      );
      const entry24h = makeEntry(
        Math.max(100, last24hVol),
        price24Start,
        price24End,
      );

      return [
        { label: "5m", buys: entry5m.buys, sells: entry5m.sells },
        { label: "1h", buys: entry1h.buys, sells: entry1h.sells },
        { label: "6h", buys: entry6h.buys, sells: entry6h.sells },
        { label: "24h", buys: entry24h.buys, sells: entry24h.sells },
      ];
    }

    // Provide a neutral placeholder dataset for stablecoins and when data is unavailable
    return [
      { label: "5m", buys: 50, sells: 50 },
      { label: "1h", buys: 50, sells: 50 },
      { label: "6h", buys: 50, sells: 50 },
      { label: "24h", buys: 50, sells: 50 },
    ];
  }, [mint, priceData]);

  const isStable = STABLE_MINTS.has(mint);
  return (
    <div className="w-full h-full flex flex-col px-4 py-4">
      {isStable && (
        <div className="text-xs text-gray-500 mb-3 pl-2">
          Stablecoin detected — showing neutral activity
        </div>
      )}
      {error && (
        <div className="text-xs text-red-500 mb-3 pl-2" role="alert">
          {error}
        </div>
      )}
      <div className="flex-1 rounded-xl bg-gradient-to-b from-gray-900/50 to-gray-900/20 border border-gray-800/50 shadow-xl backdrop-blur-sm overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 16, right: 24, left: -20, bottom: 16 }}
          >
            <defs>
              <linearGradient id="colorBuys" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorSells" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="#404040"
              vertical={true}
              opacity={0.3}
            />
            <XAxis
              dataKey="label"
              stroke="#8b8b8b"
              style={{ fontSize: "12px", fontWeight: 500 }}
              tick={{ fill: "#9ca3af" }}
            />
            <YAxis
              stroke="#8b8b8b"
              allowDecimals={false}
              style={{ fontSize: "12px" }}
              tick={{ fill: "#9ca3af" }}
              width={30}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="linear"
              dataKey="buys"
              stroke="#10b981"
              strokeWidth={3}
              dot={false}
              name="Buys"
              isAnimationActive={true}
              animationDuration={800}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Line
              type="linear"
              dataKey="sells"
              stroke="#ef4444"
              strokeWidth={3}
              dot={false}
              name="Sells"
              isAnimationActive={true}
              animationDuration={800}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-6 mt-4 px-2 justify-center">
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
