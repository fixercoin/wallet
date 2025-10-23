import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Eye, EyeOff } from "lucide-react";
import { TokenInfo } from "@/lib/wallet";
import { useCurrency } from "@/contexts/CurrencyContext";

interface PriceCardProps {
  token: TokenInfo;
  priceData: Array<{ time: string; price: number; volume: number }>;
  showBalance: boolean;
  onToggleBalance: () => void;
  isLoading?: boolean;
  withinCard?: boolean;
}

export const PriceCard: React.FC<PriceCardProps> = ({
  token,
  priceData,
  showBalance,
  onToggleBalance,
  isLoading = false,
  withinCard = false,
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
              className="h-8 w-8 rounded-full border border-gray-700"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs">
              {token.symbol?.slice(0, 1) || "?"}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-white">
              {formatCurrency(currentPrice, {
                from: "USD",
                minimumFractionDigits: 8,
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
                  <span className="text-gray-400 text-sm">24h</span>
                </>
              ) : (
                <span className="text-sm font-medium text-gray-400">—</span>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleBalance}
          className="text-gray-400 hover:text-white hover:bg-gray-700"
        >
          {showBalance ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </Button>
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
