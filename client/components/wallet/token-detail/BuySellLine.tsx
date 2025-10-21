import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { dexscreenerAPI, DexscreenerToken } from "@/lib/services/dexscreener";

interface BuySellLineProps {
  mint: string;
}

interface Point {
  label: string;
  buys: number;
  sells: number;
}

export const BuySellLine: React.FC<BuySellLineProps> = ({ mint }) => {
  const [token, setToken] = useState<DexscreenerToken | null>(null);
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

    dexscreenerAPI
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
    if (isStable) {
      // Provide a neutral placeholder dataset for stablecoins
      return [
        { label: "5m", buys: 0, sells: 0 },
        { label: "1h", buys: 0, sells: 0 },
        { label: "6h", buys: 0, sells: 0 },
        { label: "24h", buys: 0, sells: 0 },
      ];
    }
    if (!token) return [];
    const tx = token.txns;
    if (!tx) return [];
    return [
      { label: "5m", buys: tx.m5.buys, sells: tx.m5.sells },
      { label: "1h", buys: tx.h1.buys, sells: tx.h1.sells },
      { label: "6h", buys: tx.h6.buys, sells: tx.h6.sells },
      { label: "24h", buys: tx.h24.buys, sells: tx.h24.sells },
    ];
  }, [token, mint]);

  const isStable = STABLE_MINTS.has(mint);
  return (
    <div className="w-full h-64">
      {isStable && (
        <div className="text-xs text-gray-500 mb-2">
          Stablecoin detected — showing neutral activity (buy/sell data not
          available).
        </div>
      )}
      {error && (
        <div className="text-xs text-red-500 mb-2" role="alert">
          {error}
        </div>
      )}
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" stroke="#6b7280" />
          <YAxis stroke="#6b7280" allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
            }}
            labelStyle={{ color: "#111827" }}
          />
          <Line
            type="monotone"
            dataKey="buys"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            name="Buys"
          />
          <Line
            type="monotone"
            dataKey="sells"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            name="Sells"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BuySellLine;
