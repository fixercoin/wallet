import React, { useState } from "react";
import { Eye, EyeOff, TrendingUp, TrendingDown } from "lucide-react";
import { TokenInfo } from "@/lib/wallet";
import { Button } from "@/components/ui/button";

interface TokenQuickInfoCardProps {
  token: TokenInfo;
  variant?: "light" | "dark";
}

export const TokenQuickInfoCard: React.FC<TokenQuickInfoCardProps> = ({
  token,
  variant = "light",
}) => {
  const [showValue, setShowValue] = useState(true);

  const currentPrice = token.price || 0;
  const priceChangePercent =
    typeof token.priceChange24h === "number" && isFinite(token.priceChange24h)
      ? token.priceChange24h
      : null;
  const isPositive = priceChangePercent !== null && priceChangePercent >= 0;

  return (
    <div
      className={`rounded-lg border p-4 ${
        variant === "light"
          ? "border-[#e6f6ec]/20 bg-white/50"
          : "border-gray-700 bg-gray-800/50"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Token Logo */}
        {token.logoURI ? (
          <img
            src={token.logoURI}
            alt={token.symbol}
            className={`h-10 w-10 rounded-full border ${
              variant === "light"
                ? "border-[#e6f6ec]/20"
                : "border-gray-700"
            }`}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div
            className={`h-10 w-10 rounded-full ${
              variant === "light"
                ? "bg-white/80 text-gray-900"
                : "bg-gray-700 text-white"
            } flex items-center justify-center text-sm font-bold`}
          >
            {token.symbol?.slice(0, 1) || "?"}
          </div>
        )}

        {/* Price and Change Info */}
        <div className="flex-1 min-w-0">
          {showValue ? (
            <>
              <div className="text-[10px] font-semibold text-gray-500 uppercase">
                Current Price
              </div>
              <div
                className={`text-[10px] font-bold ${
                  variant === "light" ? "text-gray-900" : "text-white"
                }`}
              >
                ${currentPrice.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 8,
                })}
              </div>
              {priceChangePercent !== null && (
                <div className="flex items-center gap-1 mt-1">
                  {priceChangePercent >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span
                    className={`text-[10px] font-semibold ${
                      priceChangePercent >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {priceChangePercent >= 0 ? "+" : ""}
                    {priceChangePercent.toFixed(2)}% (24h)
                  </span>
                </div>
              )}
            </>
          ) : (
            <div
              className={`text-[10px] font-bold ${
                variant === "light" ? "text-gray-900" : "text-white"
              }`}
            >
              ••••••
            </div>
          )}
        </div>

        {/* Eye Toggle Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowValue(!showValue)}
          className={`h-7 w-7 p-0 flex-shrink-0 rounded ${
            variant === "light"
              ? "text-gray-500/60 hover:text-gray-900 hover:bg-white/50"
              : "text-gray-500/60 hover:text-white hover:bg-gray-700"
          }`}
        >
          {showValue ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
};
