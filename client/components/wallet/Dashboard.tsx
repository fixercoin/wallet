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
  Bot,
  Plus,
  MoreVertical,
  Gift,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { shortenAddress, copyToClipboard, TokenInfo } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { AddTokenDialog } from "./AddTokenDialog";
import { TokenBadge } from "./TokenBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface DashboardProps {
  onSend: () => void;
  onReceive: () => void;
  onSwap: () => void;
  onAutoBot: () => void;
  onAirdrop: () => void;
  onP2P: () => void;
  onTokenClick: (tokenMint: string) => void;
  onSettings: () => void;
  onOpenSetup?: () => void;
  onAccounts?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onSend,
  onReceive,
  onSwap,
  onAutoBot,
  onAirdrop,
  onP2P,
  onTokenClick,
  onSettings,
  onOpenSetup,
  onAccounts,
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

  const formatBalance = (amount: number | undefined): string => {
    if (!amount || isNaN(amount)) return "0.00";
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
    if (typeof price !== "number" || !isFinite(price)) return "0.000000";
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(4);
    return price.toFixed(6);
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
          "/api/forex/rate?base=USD&symbols=PKR",
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

    // Ensure we never return a negative or NaN value
    if (!isFinite(total) || total <= 0) return 0;
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
    const priority = ["SOL", "USDC", "FIXERCOIN", "LOCKER"];
    const arr = [...tokens];
    arr.sort((a, b) => {
      const aSym = (a.symbol || "").toUpperCase();
      const bSym = (b.symbol || "").toUpperCase();

      const aIdx = priority.indexOf(aSym);
      const bIdx = priority.indexOf(bSym);

      // If both are in priority list, sort by their priority order
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
      // If only a is in priority, a comes first
      if (aIdx >= 0) return -1;
      // If only b is in priority, b comes first
      if (bIdx >= 0) return 1;

      // Otherwise fallback to alphabetic by symbol
      return aSym.localeCompare(bSym);
    });
    return arr;
  }, [tokens]);

  if (!wallet) return null;

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      {isLoading ? (
        <div className="dashboard-loader-overlay">
          <div
            className="dashboard-loader"
            role="status"
            aria-label="Loading dashboard data"
          />
        </div>
      ) : null}
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between relative">
          <div className="flex items-center gap-3 text-[hsl(var(--foreground))] font-bold tracking-wide">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fcb7c54ed71c4445994802d2be5063923%2F5dbc95a4895e477594adad3ce67d2790?format=webp&width=800"
              alt="Fixorium logo"
              className="h-8 w-8 rounded-full object-contain"
            />
            <span className="text-cream">FIXORIUM</span>
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-8 w-8 p-0 dash-btn-circle">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => onAccounts?.()}
                  className="flex items-center gap-2"
                >
                  <Wallet className="h-4 w-4" />
                  <span>ALL WALLET</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={onAirdrop}
                  className="flex items-center gap-2"
                >
                  <Gift className="h-4 w-4" />
                  <span>MULTI-SEND</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={onSettings}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  <span>SETTINGS</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        {/* Balance Section */}
        <div className="text-center space-y-1 mb-8">
          <div
            className="text-sm font-semibold text-[hsl(var(--foreground))]"
            style={{ fontSize: 14 }}
          >
            TOTAL BALANCE
          </div>
          <div
            className="text-sm text-[hsl(var(--muted-foreground))]"
            style={{ fontSize: 14 }}
          >
            {wallet
              ? (() => {
                  const total = getTotalPortfolioValue();
                  const hasAnyBalance =
                    tokens.some(
                      (t) => typeof t.balance === "number" && t.balance > 0,
                    ) ||
                    (typeof balance === "number" && balance > 0);
                  // If wallet has no balances, don't show any amount
                  if (!hasAnyBalance) return null;

                  return (
                    <div className="text-[30px] font-semibold text-[hsl(var(--foreground))] leading-tight">
                      {total.toLocaleString(undefined, {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}
                    </div>
                  );
                })()
              : "Connect wallet to see balance"}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            onClick={onSend}
            className="flex-1 h-12 dash-btn font-semibold border-0"
          >
            <ArrowUpRight className="h-4 w-4 mr-2" />
            SEND 
          </Button>

          <Button
            onClick={onReceive}
            className="h-12 w-12 rounded-full dash-btn-circle p-0 border-0"
          >
            <ArrowDownLeft className="h-4 w-4" />
          </Button>

          <Button
            onClick={onSwap}
            className="h-12 w-12 rounded-full dash-btn-circle p-0 border-0"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* EXPRESS P2P SERVICE */}
        <div className="mb-4">
          <Button
            onClick={onP2P}
            className="w-full h-12 dash-btn font-semibold border-0"
          >
            EXPRESS P2P SERVICE
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
              <Card
                key={token.mint}
                className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-md"
              >
                <CardContent className="p-0">
                  <div
                    className="flex items-center justify-between p-4 rounded-md hover:bg-[hsl(var(--card))]/90 cursor-pointer transition-colors"
                    onClick={() => onTokenClick(token.mint)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 ring-2 ring-gray-700 flex-shrink-0">
                        <AvatarImage src={token.logoURI} alt={token.symbol} />
                        <AvatarFallback className="bg-gradient-to-br from-orange-500 to-yellow-600 text-white font-bold text-sm">
                          {token.symbol.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[hsl(var(--foreground))] text-sm">
                            {token.symbol}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">
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
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
                        {formatBalance(
                          token.symbol === "SOL" ? balance : token.balance || 0,
                        )}
                      </p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
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
            <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
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
