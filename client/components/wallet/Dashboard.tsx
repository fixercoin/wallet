import React, { useState, useMemo, useEffect, useRef } from "react";
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
  Menu,
  Gift,
  Flame,
  Lock,
  Coins,
  Bell,
} from "lucide-react";
import { ADMIN_WALLET } from "@/lib/p2p";
import { getPaymentReceivedNotifications } from "@/lib/p2p-chat";
import { useWallet } from "@/contexts/WalletContext";
import { useCurrency } from "@/contexts/CurrencyContext";
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
  onTokenClick: (tokenMint: string) => void;
  onSettings: () => void;
  onOpenSetup?: () => void;
  onAccounts?: () => void;
  onLock: () => void;
  onBurn: () => void;
}

import { useNavigate } from "react-router-dom";
import { TopBar } from "./TopBar";

export const Dashboard: React.FC<DashboardProps> = ({
  onSend,
  onReceive,
  onSwap,
  onAutoBot,
  onAirdrop,
  onTokenClick,
  onSettings,
  onOpenSetup,
  onAccounts,
  onLock,
  onBurn,
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
  const navigate = useNavigate();
  const [isServiceDown, setIsServiceDown] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let running = false;

    const tick = async () => {
      if (cancelled) return;
      if (running) return;
      running = true;
      try {
        await refreshBalance();
        await new Promise((r) => setTimeout(r, 300));
        await refreshTokens();
      } catch (err) {
      } finally {
        running = false;
      }
    };

    const id = window.setInterval(tick, 2000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refreshBalance, refreshTokens]);

  // Check for pending payment verifications if admin
  useEffect(() => {
    if (wallet?.publicKey === ADMIN_WALLET) {
      const notifications = getPaymentReceivedNotifications(wallet.publicKey);
      setPendingOrdersCount(notifications.length);

      // Poll for updates every 5 seconds
      const interval = setInterval(() => {
        const updated = getPaymentReceivedNotifications(wallet.publicKey);
        setPendingOrdersCount(updated.length);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [wallet?.publicKey]);

  // Periodically check Express P2P service health (require consecutive failures before marking down)
  const healthFailureRef = useRef(0);
  useEffect(() => {
    let stopped = false;
    const FAILURE_THRESHOLD = 2; // require N consecutive failures

    const check = async () => {
      try {
        const controller = new AbortController();
        const to = setTimeout(() => controller.abort(), 4000); // slightly longer timeout
        const res = await fetch("/health", { signal: controller.signal });
        clearTimeout(to);

        if (!res.ok) {
          healthFailureRef.current += 1;
          setIsServiceDown(healthFailureRef.current >= FAILURE_THRESHOLD);
          return;
        }

        const data = await res.json().catch(() => null);
        if (data && data.status === "ok") {
          healthFailureRef.current = 0;
          setIsServiceDown(false);
        } else {
          healthFailureRef.current += 1;
          setIsServiceDown(healthFailureRef.current >= FAILURE_THRESHOLD);
        }
      } catch {
        healthFailureRef.current += 1;
        setIsServiceDown(healthFailureRef.current >= FAILURE_THRESHOLD);
      }
    };

    void check();
    const id = setInterval(() => {
      if (!stopped) void check();
    }, 10000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  // Refresh quietly when user scrolls down significantly
  useEffect(() => {
    let lastY = window.scrollY;
    let lastRefresh = 0;
    const THRESHOLD = 50; // pixels scrolled down
    const COOLDOWN = 1000; // ms between auto refreshes

    const doScrollRefresh = async () => {
      try {
        await refreshBalance();
        await new Promise((r) => setTimeout(r, 300));
        await refreshTokens();
      } catch {}
    };

    const onScroll = () => {
      const y = window.scrollY;
      const now = Date.now();
      if (y - lastY > THRESHOLD && now - lastRefresh > COOLDOWN) {
        lastRefresh = now;
        void doScrollRefresh();
      }
      lastY = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [refreshBalance, refreshTokens]);

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
        const res = await fetch("/api/forex/rate?base=USD&symbols=PKR");
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

  // Currency formatting from context
  const { formatCurrency } = useCurrency();

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
    const priority = ["SOL", "USDC", "USDT", "FIXERCOIN", "LOCKER"];
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
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden">
      {/* Decorative curved accent background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <TopBar
        onAccounts={onAccounts}
        onAirdrop={onAirdrop}
        onBurn={onBurn}
        onLock={onLock}
        onSettings={onSettings}
      />

      <div className="max-w-md mx-auto px-4 py-6 relative z-20">
        {/* Balance Section */}
        <div className="text-center space-y-2 mb-8">
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

                // Calculate 24h change
                let totalChange24h = 0;
                let hasValidPriceChange = false;
                tokens.forEach((token) => {
                  if (
                    typeof token.balance === "number" &&
                    typeof token.price === "number" &&
                    typeof token.priceChange24h === "number" &&
                    isFinite(token.balance) &&
                    isFinite(token.price) &&
                    isFinite(token.priceChange24h) &&
                    token.balance > 0 &&
                    token.price > 0
                  ) {
                    const currentValue = token.balance * token.price;
                    const previousPrice =
                      token.price / (1 + token.priceChange24h / 100);
                    const previousValue = token.balance * previousPrice;
                    const change = currentValue - previousValue;
                    totalChange24h += change;
                    hasValidPriceChange = true;
                  }
                });

                const change24hPercent = hasValidPriceChange
                  ? (totalChange24h / (total - totalChange24h)) * 100
                  : 0;
                const isPositive = totalChange24h >= 0;

                return (
                  <>
                    <div className="text-[40px] font-bold text-white leading-tight">
                      {formatCurrency(total, {
                        from: "USD",
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    {hasValidPriceChange && (
                      <div className="flex items-center justify-center gap-2">
                        {isPositive ? (
                          <>
                            <ArrowUpRight className="h-4 w-4 text-green-400" />
                            <span className="text-sm font-medium text-green-400">
                              +
                              {formatCurrency(Math.abs(totalChange24h), {
                                from: "USD",
                                minimumFractionDigits: 2,
                              })}{" "}
                              (+{change24hPercent.toFixed(2)}%)
                            </span>
                          </>
                        ) : (
                          <>
                            <ArrowDownLeft className="h-4 w-4 text-red-400" />
                            <span className="text-sm font-medium text-red-400">
                              -
                              {formatCurrency(Math.abs(totalChange24h), {
                                from: "USD",
                                minimumFractionDigits: 2,
                              })}{" "}
                              ({change24hPercent.toFixed(2)}%)
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </>
                );
              })()
            : "Connect wallet to see balance"}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            onClick={onSend}
            className="flex-1 h-12 rounded-xl font-semibold border-0 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg"
          >
            <ArrowUpRight className="h-4 w-4 mr-2" />
            SEND
          </Button>

          <Button
            onClick={onReceive}
            className="h-12 w-12 rounded-full p-0 bg-[#1a2540]/50 hover:bg-[#FF7A5C]/20 border border-[#FF7A5C]/30 text-white"
          >
            <ArrowDownLeft className="h-4 w-4" />
          </Button>

          <Button
            onClick={onSwap}
            className="h-12 w-12 rounded-full p-0 bg-[#1a2540]/50 hover:bg-[#FF7A5C]/20 border border-[#FF7A5C]/30 text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Tokens List */}
        <div className="mb-4 flex gap-2">
          <Button
            onClick={() => navigate("/buy-crypto")}
            className="flex-1 h-12 rounded-xl font-semibold border-0 relative bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg flex items-center justify-center"
            aria-label="PAY TO BUY CRYPTO CURRENCY"
          >
            <span className="mr-0">PAY TO BUY CRYPTO</span>
          </Button>

          {wallet?.publicKey === ADMIN_WALLET && pendingOrdersCount > 0 && (
            <Button
              onClick={() => navigate("/verify-sell")}
              className="h-12 w-16 rounded-xl font-bold border-0 bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-white shadow-lg flex items-center justify-center text-lg relative"
              aria-label={`${pendingOrdersCount} pending orders`}
            >
              <span className="relative">
                {pendingOrdersCount}
                {pendingOrdersCount > 0 && (
                  <span className="absolute -top-1 -right-3 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
                    !
                  </span>
                )}
              </span>
            </Button>
          )}
        </div>

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
                className="bg-gradient-to-br from-[#1f2d48]/60 to-[#1a2540]/60 backdrop-blur-xl border border-[#FF7A5C]/30 rounded-md"
              >
                <CardContent className="p-0">
                  <div
                    className="flex items-center justify-between p-4 rounded-md hover:bg-[#1a2540]/60 cursor-pointer transition-colors"
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
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-white text-sm">
                            {token.symbol}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-xs text-gray-300">
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
                              <span className="text-xs text-gray-400">24h</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
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
                      <p className="text-xs text-gray-300">
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
            <div className="text-center py-8 text-gray-300">
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
