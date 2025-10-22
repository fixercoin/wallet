import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ExternalLink } from "lucide-react";
import { TokenInfo } from "@/lib/wallet";

interface TokenCardProps {
  token: TokenInfo;
  onClick?: () => void;
}

export const TokenCard: React.FC<TokenCardProps> = ({ token, onClick }) => {
  const formatBalance = (amount: number | undefined): string => {
    if (!amount || isNaN(amount)) return "0.00";
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const formatTokenPriceDisplay = (price?: number): string => {
    if (typeof price !== "number" || !isFinite(price)) return "0.000000";
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(4);
    return price.toFixed(6);
  };

  const solscanUrl = `https://solscan.io/token/${token.mint}`;

  const percentChange =
    typeof token.priceChange24h === "number" && isFinite(token.priceChange24h)
      ? token.priceChange24h
      : null;
  const isPositive = (percentChange ?? 0) >= 0;

  return (
    <Card className="bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 transition-colors">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Token Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 flex-shrink-0">
                <AvatarImage src={token.logoURI} alt={token.symbol} />
                <AvatarFallback className="bg-gradient-to-br from-orange-500 to-yellow-600 text-white font-bold text-sm">
                  {token.symbol.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="font-semibold text-white">{token.name}</div>
                <div className="text-sm text-gray-400">{token.symbol}</div>
              </div>
            </div>
            <a
              href={solscanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
              title="View on Solscan"
            >
              <ExternalLink className="h-4 w-4 text-gray-400 hover:text-white" />
            </a>
          </div>

          {/* Mint Address */}
          <div className="space-y-1">
            <div className="text-xs text-gray-500">Mint Address</div>
            <div className="text-xs text-gray-300 break-all font-mono">
              {token.mint}
            </div>
          </div>

          {/* Price Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-gray-500">Price</div>
              <div className="text-sm font-semibold text-white">
                ${formatTokenPriceDisplay(token.price)}
              </div>
            </div>
            {percentChange !== null && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500">24h Change</div>
                <div
                  className={`text-sm font-semibold ${
                    isPositive ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {percentChange.toFixed(2)}%
                </div>
              </div>
            )}
          </div>

          {/* Balance */}
          <div className="space-y-1 border-t border-gray-700 pt-4">
            <div className="text-xs text-gray-500">Balance</div>
            <div className="text-lg font-semibold text-white">
              {formatBalance(token.balance)}
            </div>
            {typeof token.price === "number" && token.price > 0 && (
              <div className="text-xs text-gray-400">
                ${formatBalance((token.balance || 0) * token.price)}
              </div>
            )}
          </div>

          {/* Click Handler */}
          {onClick && (
            <button
              onClick={onClick}
              className="w-full mt-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg transition-colors"
            >
              View Details
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
