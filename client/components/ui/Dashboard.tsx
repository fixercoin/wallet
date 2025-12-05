import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Wallet,
  Send,
  Download,
  RefreshCw,
  Copy,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  Eye,
  EyeOff,
  Settings,
  Plus,
  Bot,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { shortenAddress, copyToClipboard, TokenInfo } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/api-client";
import { AddTokenDialog } from "./AddTokenDialog";
import { TokenBadge } from "./TokenBadge";

interface DashboardProps {
  onSend: () => void;
  onReceive: () => void;
  onSwap: () => void;
  onAutoBot: () => void;
  onTokenClick: (tokenMint: string) => void;
  onSettings: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onSend,
  onReceive,
  onSwap,
  onAutoBot,
  onTokenClick,
  onSettings,
}) => {
  const {
    wallet,
    balance,
    tokens,
    isLoading,
    refreshBalance,
    refreshTokens,
    addCustomToken,
  } = useWallet();
  const { toast } = useToast();
  const [showBalance, setShowBalance] = useState(true);
  const [showAddTokenDialog, setShowAddTokenDialog] = useState(false);

  const handleCopyAddress = async () => {
    if (!wallet) return;

    const success = await copyToClipboard(wallet.publicKey);
    if (success) {
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard",
      });
    } else {
      toast({
        title: "Copy Failed",
        description: "Could not copy address. Please copy it manually.",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = async () => {
    // Space out the calls to avoid rate limiting
    await refreshBalance();
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
    await refreshTokens();

    toast({
      title: "Refreshed",
      description: "Balance and tokens updated",
    });
  };

  const formatBalance = (
    amount: number | undefined,
    symbol?: string,
  ): string => {
    if (!amount || isNaN(amount)) return "0.00";
    // FIXERCOIN and LOCKER always show exactly 2 decimal places
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

  const formatUSD = (
    amount: number | undefined,
    price: number | undefined,
  ): string => {
    if (!amount || !price || isNaN(amount) || isNaN(price)) return "$0.00";
    const usdValue = amount * price;
    return `$${usdValue.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatTokenPriceDisplay = (price?: number): string => {
    if (typeof price !== "number" || !isFinite(price)) return "0.00000000";
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(4);
    if (price >= 0.0001) return price.toFixed(6);
    return price.toFixed(8);
  };

  const [usdToPkr, setUsdToPkr] = useState<number>(() => {
    try {
      const cached = localStorage.getItem("usd_to_pkr");
      if (cached) {
        const parsed = JSON.parse(cached) as { rate: number; ts: number };
        if (parsed && typeof parsed.rate === "number") return parsed.rate;
      }
    } catch {}
    return 280;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          resolveApiUrl("/api/forex/rate?base=USD&symbols=PKR"),
        );
        if (!res.ok) return;
        const data = await res.json();
        const rate = data?.rates?.PKR;
        if (typeof rate === "number" && isFinite(rate) && !cancelled) {
          setUsdToPkr(rate);
          try {
            localStorage.setItem(
              "usd_to_pkr",
              JSON.stringify({ rate, ts: Date.now() }),
            );
          } catch {}
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatPKR = (amount: number): string => {
    if (!amount || !isFinite(amount)) return "PKR 0.00";
    return `PKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Get SOL token data from tokens list
  const getSolToken = () => {
    return tokens.find((token) => token.symbol === "SOL");
  };

  // Get SOL price from tokens or fetch it
  const getSolPrice = (): number | undefined => {
    const solToken = getSolToken();
    return solToken?.price;
  };

  // Calculate total portfolio value including all tokens (USD)
  const getTotalPortfolioValue = (): number => {
    let total = 0;

    // Add all token values including SOL
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

    return total;
  };

  // Calculate total portfolio value expressed in SOL
  const getTotalInSol = (): number => {
    const usdTotal = getTotalPortfolioValue();
    const solPrice = getSolPrice();
    if (typeof solPrice !== "number" || !isFinite(solPrice) || solPrice <= 0) {
      return 0;
    }
    return usdTotal / solPrice;
  };

  // Get breakdown of portfolio by type
  const getPortfolioBreakdown = () => {
    const solToken = getSolToken();
    const solValue =
      solToken && solToken.price && solToken.balance
        ? solToken.balance * solToken.price
        : 0;

    let tokensValue = 0;
    tokens.forEach((token) => {
      if (
        token.balance &&
        token.price &&
        !isNaN(token.balance) &&
        !isNaN(token.price)
      ) {
        if (token.symbol !== "SOL") {
          tokensValue += token.balance * token.price;
        }
      }
    });

    return { solValue, tokensValue, total: solValue + tokensValue };
  };

  const sortedTokens = useMemo(() => {
    const arr = [...tokens];
    arr.sort((a, b) => {
      if (a.symbol === "SOL") return -1;
      if (b.symbol === "SOL") return 1;
      const aSym = (a.symbol || "").toUpperCase();
      const bSym = (b.symbol || "").toUpperCase();
      return aSym.localeCompare(bSym);
    });
    return arr;
  }, [tokens]);

  if (!wallet) return null;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between relative">
          <div className="flex items-center gap-2 text-white font-bold tracking-wide">
            FIXORIUM
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddTokenDialog(true)}
              className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onAutoBot}
              className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full"
            >
              <Bot className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSettings}
              className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        {/* Balance Section */}
        <div className="text-center space-y-2 mb-8">
          <div className="text-4xl font-bold text-white">
            {getTotalPortfolioValue().toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>

          <div className="text-sm text-gray-400">
            {wallet
              ? (() => {
                  const usd = getTotalPortfolioValue();
                  const pkr = usd * (usdToPkr || 0);
                  return `${formatPKR(pkr)}`;
                })()
              : "Connect wallet to see balance"}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            onClick={onSend}
            variant="outline"
            className="flex-1 h-12 bg-transparent border border-gray-600 text-white font-semibold hover:bg-gray-800/50"
          >
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Send
          </Button>

          <Button
            onClick={onReceive}
            variant="outline"
            className="h-12 w-12 rounded-full border-gray-600 bg-gray-800 hover:bg-gray-700 text-white p-0"
          >
            <ArrowDownLeft className="h-4 w-4" />
          </Button>

          <Button
            onClick={onSwap}
            variant="outline"
            className="h-12 w-12 rounded-full border-gray-600 bg-gray-800 hover:bg-gray-700 text-white p-0"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Tokens List */}
        <div className="space-y-3">
          {/* All Tokens - Each in separate container */}
          {sortedTokens.map((token) => {
            // Use real percentage change if available; otherwise show placeholder
            const percentChange =
              typeof token.priceChange24h === "number" &&
              isFinite(token.priceChange24h)
                ? token.priceChange24h
                : null;
            const isPositive = (percentChange ?? 0) >= 0;

            return (
              <Card key={token.mint} className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-0">
                  <div
                    className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-800/70 cursor-pointer transition-colors"
                    onClick={() => onTokenClick(token.mint)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={token.logoURI} alt={token.symbol} />
                        <AvatarFallback className="bg-gradient-to-br from-orange-500 to-yellow-600 text-white font-bold text-sm">
                          {token.symbol.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">
                            {token.symbol}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs text-gray-400 ${
                              ["SOL", "FIXERCOIN", "LOCKER", "FXM"].includes(
                                (token.symbol || "").toUpperCase(),
                              )
                                ? "animate-price-pulse"
                                : ""
                            }`}
                          >
                            ${formatTokenPriceDisplay(token.price)}
                          </span>
                          {percentChange !== null ? (
                            <span className="flex items-center gap-1">
                              <span
                                className={`text-xs font-medium ${
                                  isPositive ? "text-green-400" : "text-red-400"
                                }`}
                              >
                                {isPositive ? "+" : ""}
                                {percentChange.toFixed(2)}%
                              </span>
                              <span className="text-xs text-gray-500">24h</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">—</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">
                        {formatBalance(
                          token.symbol === "SOL" ? balance : token.balance || 0,
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {typeof token.price === "number" && token.price > 0
                          ? `$${formatBalance((token.symbol === "SOL" ? balance : token.balance || 0) * token.price)}`
                          : "$0.00"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {tokens.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">No tokens found</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Token Dialog */}
      <AddTokenDialog
        open={showAddTokenDialog}
        onOpenChange={setShowAddTokenDialog}
        onTokenAdd={addCustomToken}
      />
    </div>
  );
};
