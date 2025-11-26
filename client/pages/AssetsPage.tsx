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
      return (amount / 1000000).toFixed(2) + " m";
    }
    if (absAmount >= 1000) {
      return (amount / 1000).toFixed(2) + " k";
    }
    if (absAmount >= 1) {
      return amount.toFixed(2);
    }
    return amount.toFixed(6);
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
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .token-price-blink {
          animation: blink 1.2s ease-in-out infinite;
        }
      `}</style>
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
              className="border border-green-500 text-green-500 hover:bg-green-500/10 bg-transparent rounded-lg px-4 py-2 text-sm font-medium transition-all"
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
            {sortedTokens.map((token, index) => {
              const tokenBalance =
                typeof token.balance === "number" && typeof token.price === "number" && isFinite(token.balance) && isFinite(token.price)
                  ? token.balance * token.price
                  : 0;

              return (
                <div key={token.mint} className="w-full">
                  <Card className="w-full bg-transparent rounded-none sm:rounded-[2px] border-0">
                    <CardContent className="w-full p-0">
                      <div className="w-full flex items-center justify-between px-4 py-3 rounded-none sm:rounded-[2px] hover:bg-[#f0fff4]/40 cursor-pointer transition-colors gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {token.logoURI && (
                            <img
                              src={token.logoURI}
                              alt={token.symbol}
                              className="w-10 h-10 rounded-full flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          )}
                          <div className="flex flex-col min-w-0">
                            <p className="text-xs font-semibold text-white truncate uppercase">
                              {token.name}
                            </p>
                            <p className="text-xs font-semibold text-white truncate">
                              {formatTokenAmountCompact(token.balance || 0)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                          <p
                            className="text-xs font-semibold whitespace-nowrap token-price-blink"
                            style={{
                              color:
                                typeof token.priceChange24h === "number" && isFinite(token.priceChange24h)
                                  ? token.priceChange24h >= 0
                                    ? "#4ade80"
                                    : "#f87171"
                                  : "#ffffff"
                            }}
                          >
                            $
                            {typeof token.price === "number" && isFinite(token.price)
                              ? token.price.toFixed(
                                  ["SOL", "USDC"].includes(token.symbol) ? 2 : 8,
                                )
                              : ["SOL", "USDC"].includes(token.symbol)
                                ? "0.00"
                                : "0.00000000"}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <p className="text-xs font-semibold text-white whitespace-nowrap">
                            $
                            {tokenBalance.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>

                          {typeof token.priceChange24h === "number" &&
                          isFinite(token.priceChange24h) ? (
                            <p
                              className={`text-xs font-medium whitespace-nowrap ${token.priceChange24h >= 0 ? "text-green-400" : "text-red-400"}`}
                            >
                              {token.priceChange24h >= 0 ? "+" : ""}
                              {token.priceChange24h.toFixed(2)}%
                            </p>
                          ) : (
                            <p className="text-xs font-medium text-gray-400 whitespace-nowrap">
                              N/A
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {index < sortedTokens.length - 1 && (
                    <Separator className="bg-[#14532d]/30" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
