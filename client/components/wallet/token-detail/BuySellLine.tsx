import React, { useEffect, useMemo, useState } from "react";
import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

export const BuySellLine: React.FC<BuySellLineProps> = ({ mint, priceData }) => {
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
      // compute aggregates
      const sumVolumes = (startIndex: number) => {
        let s = 0;
        for (let i = startIndex; i < points.length; i++) s += points[i].volume || 0;
        return s;
      };

      const last = points[points.length - 1];
      const lastHourVol = last?.volume || 0;
      const last6hVol = points.slice(Math.max(0, points.length - 6)).reduce((acc, p) => acc + (p.volume || 0), 0);
      const last24hVol = points.slice(Math.max(0, points.length - 24)).reduce((acc, p) => acc + (p.volume || 0), 0);
      const approx5m = lastHourVol / 12; // approximate 5m as 1/12 of 1h

      const makeEntry = (vol: number, priceStart: number, priceEnd: number): Point => {
        // If price increased -> more buys, else more sells
        const change = priceEnd - priceStart;
        const ratio = Math.tanh(Math.abs(change) / (Math.max(priceStart, 1) / 100)) * 0.5 + 0.5; // 0..1
        const buys = change >= 0 ? Math.round(vol * ratio) : Math.round(vol * (1 - ratio));
        const sells = Math.round(Math.max(0, vol - buys));
        return { label: "", buys, sells };
      };

      // determine price start/end for intervals
      const price24Start = points[0]?.price ?? last.price;
      const price24End = last.price;
      const price6Start = points[Math.max(0, points.length - 6)]?.price ?? last.price;
      const price6End = last.price;
      const price1Start = points[Math.max(0, points.length - 1)]?.price ?? last.price;
      const price1End = last.price;
      const price5mStart = price1Start; // approximate

      const entry5m = makeEntry(approx5m, price5mStart, price1End);
      const entry1h = makeEntry(lastHourVol, price1Start, price1End);
      const entry6h = makeEntry(last6hVol, price6Start, price6End);
      const entry24h = makeEntry(last24hVol, price24Start, price24End);

      return [
        { label: "5m", buys: entry5m.buys, sells: entry5m.sells },
        { label: "1h", buys: entry1h.buys, sells: entry1h.sells },
        { label: "6h", buys: entry6h.buys, sells: entry6h.sells },
        { label: "24h", buys: entry24h.buys, sells: entry24h.sells },
      ];
    }

    // Provide a neutral placeholder dataset for stablecoins and when data is unavailable
    return [
      { label: "5m", buys: 0, sells: 0 },
      { label: "1h", buys: 0, sells: 0 },
      { label: "6h", buys: 0, sells: 0 },
      { label: "24h", buys: 0, sells: 0 },
    ];
  }, [mint, priceData]);

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
