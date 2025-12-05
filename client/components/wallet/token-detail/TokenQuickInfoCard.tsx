import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { TokenInfo } from "@/lib/wallet";

interface TokenQuickInfoCardProps {
  token: TokenInfo;
}

export const TokenQuickInfoCard: React.FC<TokenQuickInfoCardProps> = ({
  token,
}) => {
  const currentPrice = token.price || 0;
  const priceChangePercent =
    typeof token.priceChange24h === "number" && isFinite(token.priceChange24h)
      ? token.priceChange24h
      : null;
  const isPositive = priceChangePercent !== null && priceChangePercent >= 0;

  return (
    <div className={`rounded-lg border border-gray-300/30 p-4 bg-transparent`}>
      <div className="flex items-center justify-between gap-3">
        {/* Token Logo and Price */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {token.logoURI ? (
            <img
              src={token.logoURI}
              alt={token.symbol}
              className="h-10 w-10 rounded-full border border-gray-300/30 flex-shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="h-10 w-10 rounded-full flex-shrink-0 bg-white/80 text-gray-900 flex items-center justify-center text-sm font-bold">
              {token.symbol?.slice(0, 1) || "?"}
            </div>
          )}

          {/* Price Info */}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold text-gray-500 uppercase">
              Current Price
            </div>
            <div className="text-[10px] font-bold text-gray-900">
              $
              {currentPrice.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 8,
              })}
            </div>
          </div>
        </div>

        {/* 24h Change - Right Side */}
        <div className="flex-shrink-0 text-right">
          {priceChangePercent !== null ? (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                {priceChangePercent >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={`text-[10px] font-semibold ${
                    priceChangePercent >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {priceChangePercent >= 0 ? "+" : ""}
                  {priceChangePercent.toFixed(2)}%
                </span>
              </div>
              <span className="text-[9px] text-gray-500">24h</span>
            </div>
          ) : (
            <span className="text-[10px] font-medium text-gray-500">—</span>
          )}
        </div>
      </div>
    </div>
  );
};
