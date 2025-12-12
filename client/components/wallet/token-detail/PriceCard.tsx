import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { TokenInfo } from "@/lib/wallet";
import { useCurrency } from "@/contexts/CurrencyContext";

interface PriceCardProps {
  token: TokenInfo;
  priceData: Array<{ time: string; price: number; volume: number }>;
  showBalance: boolean;
  onToggleBalance: () => void;
  isLoading?: boolean;
  withinCard?: boolean;
  variant?: "light" | "dark";
}

export const PriceCard: React.FC<PriceCardProps> = ({
  token,
  priceData,
  showBalance,
  onToggleBalance,
  isLoading = false,
  withinCard = false,
  variant = "dark",
}) => {
  const currentPrice = token.price || 0;
  const priceChangePercent =
    typeof token.priceChange24h === "number" && isFinite(token.priceChange24h)
      ? token.priceChange24h
      : null;
  const totalValue = (token.balance || 0) * currentPrice;
  const isPositive = priceChangePercent !== null && priceChangePercent >= 0;

  const { formatCurrency } = useCurrency();

  const content = (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {token.logoURI ? (
            <img
              src={token.logoURI}
              alt={token.symbol}
              className={`h-8 w-8 rounded-full border ${variant === "light" ? "border-gray-200" : "border-gray-700"}`}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div
              className={`h-8 w-8 rounded-full ${variant === "light" ? "bg-white/80 text-gray-900" : "bg-gray-700 text-white"} flex items-center justify-center text-xs`}
            >
              {token.symbol?.slice(0, 1) || "?"}
            </div>
          )}
          <div>
            <h2
              className={`text-2xl font-bold ${variant === "light" ? "text-gray-900" : "text-white"}`}
            >
              {formatCurrency(currentPrice, {
                from: "USD",
                minimumFractionDigits: 2,
              })}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {priceChangePercent !== null ? (
                <>
                  {priceChangePercent >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      priceChangePercent >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {priceChangePercent >= 0 ? "+" : ""}
                    {priceChangePercent.toFixed(2)}%
                  </span>
                  <span
                    className={`${variant === "light" ? "text-gray-500" : "text-gray-400"} text-sm`}
                  >
                    24h
                  </span>
                </>
              ) : (
                <span
                  className={`text-sm font-medium ${variant === "light" ? "text-gray-500" : "text-gray-400"}`}
                >
                  —
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {showBalance && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Balance</span>
            <span className="text-white font-medium">
              {(token.balance || 0).toLocaleString()} {token.symbol}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total Value</span>
            <span className="text-white font-medium">
              {formatCurrency(totalValue, {
                from: "USD",
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="mt-4 text-center">
          <span className="text-gray-400 text-sm">Updating...</span>
        </div>
      )}
    </div>
  );

  if (withinCard) {
    return <div className="bg-transparent">{content}</div>;
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="p-0">{content}</CardContent>
    </Card>
  );
};
