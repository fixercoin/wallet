import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { TokenInfo } from "@/lib/wallet";

export default function AssetsPage() {
  const navigate = useNavigate();
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
    if (!amount || isNaN(amount)) {
      return symbol === "SOL" ? "0.0000" : "0.00";
    }
    if (symbol === "SOL") {
      return amount.toLocaleString(undefined, {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      });
    }
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatTokenAmountCompact = (amount: number | undefined): string => {
    if (!amount || isNaN(amount) || amount === 0) return "0";

    const absAmount = Math.abs(amount);
    if (absAmount >= 1000000) {
      return (amount / 1000000).toFixed(2).replace(/\.?0+$/, "") + "m";
    }
    if (absAmount >= 1000) {
      return (amount / 1000).toFixed(2).replace(/\.?0+$/, "") + "k";
    }
    if (absAmount >= 1) {
      return amount.toFixed(2).replace(/\.?0+$/, "");
    }
    return amount.toFixed(6).replace(/\.?0+$/, "");
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

  const totalBalance = getTotalPortfolioValue();

  return (
    <div
      className="min-h-screen text-gray-100 pb-20"
      style={{ backgroundColor: "#1f1f1f" }}
    >
      <div className="w-full md:max-w-lg lg:max-w-lg mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-4 pt-8">
        <div className="px-4 sm:px-0 mb-6">
          <button
            onClick={() => navigate("/")}
            className="text-white hover:text-gray-300 transition-colors mb-4 flex items-center"
            aria-label="Go back"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="bg-transparent rounded-lg p-4 border border-[#22c55e]/30 flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">Total Balance</p>
              <p className="text-3xl font-bold text-green-400">
                $
                {totalBalance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <Button
              onClick={() => navigate("/assets/deposit")}
              className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
            >
              DEPOSITE ASSET
            </Button>
          </div>
        </div>

        {sortedTokens.length === 0 ? (
          <div className="text-center py-8 text-gray-300">
            <p className="text-sm">
              {isLoading ? "Loading assets..." : "No tokens found"}
            </p>
          </div>
        ) : (
          <div className="w-full space-y-0">
            {sortedTokens.map((token, index) => (
              <div key={token.mint} className="w-full">
                <Card className="w-full bg-transparent rounded-none sm:rounded-[2px] border-0">
                  <CardContent className="w-full p-0">
                    <div className="w-full px-4 py-4 rounded-none sm:rounded-[2px] flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <p
                          className="font-semibold text-white whitespace-nowrap"
                          style={{ fontSize: "10px" }}
                        >
                          {token.symbol}
                        </p>
                        <p
                          className="text-green-400 whitespace-nowrap"
                          style={{ fontSize: "10px" }}
                        >
                          {typeof token.price === "number" && token.price > 0
                            ? `$${formatTokenPriceDisplay(token.price)}`
                            : "$0.00"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p
                          className="text-gray-400 whitespace-nowrap"
                          style={{ fontSize: "10px" }}
                        >
                          {formatBalance(token.balance || 0, token.symbol)}
                        </p>
                        <p
                          className="font-semibold text-green-400 whitespace-nowrap"
                          style={{ fontSize: "10px" }}
                        >
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
