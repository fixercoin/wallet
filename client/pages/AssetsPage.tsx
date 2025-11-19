import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useWallet } from "@/contexts/WalletContext";
import { TokenInfo } from "@/lib/wallet";

export default function AssetsPage() {
  const { wallet, tokens, isLoading } = useWallet();

  const formatTokenPriceDisplay = (price?: number): string => {
    if (typeof price !== "number" || !isFinite(price)) return "0.00000000";
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(4);
    if (price >= 0.0001) return price.toFixed(6);
    return price.toFixed(8);
  };

  const formatBalance = (
    amount: number | undefined,
    symbol?: string,
  ): string => {
    if (!amount || isNaN(amount)) return "0.00";
    if (symbol === "FIXERCOIN" || symbol === "LOCKER") {
      return amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const sortedTokens = useMemo(() => {
    const priority = ["SOL", "USDC", "FIXERCOIN", "LOCKER"];
    const arr = [...tokens].filter((t) => t.symbol !== "USDT");
    arr.sort((a, b) => {
      const aSym = (a.symbol || "").toUpperCase();
      const bSym = (b.symbol || "").toUpperCase();

      const aIdx = priority.indexOf(aSym);
      const bIdx = priority.indexOf(bSym);

      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
      if (aIdx >= 0) return -1;
      if (bIdx >= 0) return 1;

      return aSym.localeCompare(bSym);
    });
    return arr;
  }, [tokens]);

  const getTotalPortfolioValue = (): number => {
    let total = 0;

    tokens.forEach((token) => {
      if (
        typeof token.balance === "number" &&
        typeof token.price === "number" &&
        isFinite(token.balance) &&
        isFinite(token.price) &&
        token.balance > 0 &&
        token.price > 0
      ) {
        const tokenValue = token.balance * token.price;
        total += tokenValue;
      }
    });

    if (!isFinite(total) || total <= 0) return 0;
    return total;
  };

  if (!wallet) return null;

  const totalBalance = getTotalPortfolioValue();

  return (
    <div
      className="min-h-screen text-gray-100 pb-20"
      style={{ backgroundColor: "#1f1f1f" }}
    >
      <div className="w-full md:max-w-lg lg:max-w-lg mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-4">
        <h1 className="text-2xl font-bold text-white px-4 sm:px-0 mb-6">
          Assets
        </h1>

        {isLoading ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Loading assets...</p>
          </div>
        ) : sortedTokens.length === 0 ? (
          <div className="text-center py-8 text-gray-300">
            <p className="text-sm">No tokens found</p>
          </div>
        ) : (
          <div className="w-full space-y-0">
            {sortedTokens.map((token, index) => (
              <div key={token.mint} className="w-full">
                <Card className="w-full bg-transparent rounded-none sm:rounded-[2px] border-0">
                  <CardContent className="w-full p-0">
                    <div className="w-full flex items-center gap-4 px-4 py-4 rounded-none sm:rounded-[2px] hover:bg-[#f0fff4]/10 transition-colors">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={token.logoURI} alt={token.symbol} />
                        <AvatarFallback className="bg-gradient-to-br from-orange-500 to-yellow-600 text-white font-bold text-sm">
                          {token.symbol.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-white text-sm">
                            {token.symbol}
                          </span>
                          <span className="text-xs text-gray-400">
                            ${formatTokenPriceDisplay(token.price)}
                          </span>
                        </div>
                      </div>

                      <div className="flex-shrink-0 text-right">
                        <p className="text-sm font-semibold text-white whitespace-nowrap">
                          {formatBalance(token.balance || 0, token.symbol)}
                        </p>
                        <p className="text-xs text-gray-400 whitespace-nowrap">
                          {typeof token.price === "number" && token.price > 0
                            ? `$${formatBalance((token.balance || 0) * token.price)}`
                            : "$0.00"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {index < sortedTokens.length - 1 && (
                  <Separator className="bg-[#14532d]/30" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
