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
  RotateCw,
  Copy,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  TrendingUp,
  Settings,
  Bot,
  Plus,
  Menu,
  Gift,
  Unlock,
  Bell,
  X,
  Clock,
  Coins,
  Search as SearchIcon,
  MessageSquare,
  Zap,
} from "lucide-react";
import { ADMIN_WALLET, API_BASE } from "@/lib/p2p";
import {
  getPaymentReceivedNotifications,
  saveNotification,
  getUnreadNotifications,
} from "@/lib/p2p-chat";
import { useWallet } from "@/contexts/WalletContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { shortenAddress, copyToClipboard, TokenInfo } from "@/lib/wallet";
import { formatAmountCompact } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useStakingTokens } from "@/hooks/use-staking-tokens";
import { AddTokenDialog } from "./AddTokenDialog";
import { TokenBadge } from "./TokenBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { resolveApiUrl, fetchWithFallback } from "@/lib/api-client";
import bs58 from "bs58";
import nacl from "tweetnacl";

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
  onStakeTokens?: () => void;
  onP2PTrade?: () => void;
}

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
  onStakeTokens,
  onP2PTrade,
}) => {
  const {
    wallet,
    balance,
    tokens,
    isLoading,
    isUsingCache,
    refreshBalance,
    refreshTokens,
    addCustomToken,
    removeToken,
  } = useWallet();

  const { toast } = useToast();
  const [showBalance, setShowBalance] = useState(true);
  const [showAddTokenDialog, setShowAddTokenDialog] = useState(false);
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isStaking } = useStakingTokens(wallet?.publicKey || null);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
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

  const getSolToken = () => tokens.find((token) => token.symbol === "SOL");
  const getSolPrice = (): number | undefined => getSolToken()?.price;

  // Total portfolio calculation includes SOL balance even if price undefined
  const getTotalPortfolioValue = (): number => {
    let total = 0;

    if (typeof balance === "number" && isFinite(balance) && balance > 0) {
      total += balance * (getSolPrice() || 0);
    }

    tokens.forEach((token) => {
      if (
        typeof token.balance === "number" &&
        typeof token.price === "number" &&
        isFinite(token.balance) &&
        isFinite(token.price) &&
        token.balance > 0 &&
        token.price > 0
      ) {
        total += token.balance * token.price;
      }
    });

    return total;
  };

  const formatBalance = (amount: number | undefined, symbol?: string) => {
    if (!amount || isNaN(amount)) return "0.00";
    if (symbol === "FIXERCOIN" || symbol === "LOCKER") {
      return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    try {
      setIsRefreshing(true);
      await refreshBalance();
      await new Promise((resolve) => setTimeout(resolve, 300));
      await refreshTokens();
      toast({ title: "Refreshed", description: "Balance and tokens updated" });
    } catch {
      toast({ title: "Refresh Failed", description: "Could not refresh data", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!wallet?.publicKey || !ADMIN_WALLET) return;
    if (wallet.publicKey.toLowerCase() === ADMIN_WALLET.toLowerCase()) {
      const updatePending = () => {
        const notifications = getPaymentReceivedNotifications(wallet.publicKey);
        setPendingOrdersCount(notifications.length);
      };
      updatePending();
      const interval = setInterval(updatePending, 5000);
      return () => clearInterval(interval);
    }
  }, [wallet?.publicKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(resolveApiUrl("/api/forex/rate?base=USD&symbols=PKR"));
        if (!res.ok) return;
        const data = await res.json();
        const rate = data?.rates?.PKR;
        if (typeof rate === "number" && !cancelled) {
          setUsdToPkr(rate);
          try { localStorage.setItem("usd_to_pkr", JSON.stringify({ rate, ts: Date.now() })); } catch {}
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

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

  if (!wallet) return null;

  return (
    <div className="express-p2p-page min-h-screen text-gray-900 relative overflow-y-auto" style={{ backgroundColor: "#f3f4f6" }}>
      <div className="w-full md:max-w-lg lg:max-w-lg mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-2 relative z-20">
        {/* Balance Section */}
        <div className="w-full mt-2 mb-1 rounded-none sm:rounded-lg p-4 sm:p-6 border-0 bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0] relative overflow-hidden">
          <div className="relative z-10">
            <div className="space-y-3 mt-8">
              <div className="text-left">
                <div className="text-xs font-semibold text-gray-700 tracking-widest">MY PORTFOLIO</div>
              </div>

              <div className="flex items-center justify-between gap-4 w-full">
                <div className="text-3xl text-gray-900 leading-tight">
                  {showBalance ? (
                    <>{balance?.toFixed(6)} SOL ≈ ${(balance! * (getSolPrice() || 0)).toFixed(2)}</>
                  ) : (
                    "****"
                  )}
                </div>
                <Button
                  onClick={onP2PTrade || onReceive}
                  className="bg-[#86efac] hover:bg-[#65e8ac] border border-[#22c55e]/40 text-gray-900 font-bold text-xs px-5 py-2.5 rounded-sm whitespace-nowrap h-auto transition-colors"
                >
                  P2P TRADE
                </Button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-around gap-2 sm:gap-3 mt-6 w-full px-0">
              <Button onClick={onSend} className="flex flex-col items-center justify-center gap-2 flex-1 h-auto py-4 px-2 rounded-md font-bold text-xs bg-transparent hover:bg-[#22c55e]/10 border border-[#22c55e]/40 text-white transition-colors">
                <Send className="h-8 w-8 text-[#22c55e]" />
                <span>WITHDRAW</span>
              </Button>

              <Button onClick={onReceive} className="flex flex-col items-center justify-center gap-2 flex-1 h-auto py-4 px-2 rounded-md font-bold text-xs bg-transparent hover:bg-[#22c55e]/10 border border-[#22c55e]/40 text-white transition-colors">
                <Download className="h-8 w-8 text-[#22c55e]" />
                <span>DEPOSIT</span>
              </Button>

              <Button onClick={onSwap} className="flex flex-col items-center justify-center gap-2 flex-1 h-auto py-4 px-2 rounded-md font-bold text-xs bg-transparent hover:bg-[#22c55e]/10 border border-[#22c55e]/40 text-white transition-colors">
                <ArrowRightLeft className="h-8 w-8 text-[#22c55e]" />
                <span>CONVERT</span>
              </Button>
            </div>

            {/* Tokens List */}
            <div className="w-full space-y-0 mt-6">
              {sortedTokens.map((token, index) => {
                const tokenBalance =
                  typeof token.balance === "number" &&
                  typeof token.price === "number" &&
                  isFinite(token.balance) &&
                  isFinite(token.price)
                    ? token.balance * token.price
                    : 0;

                return (
                  <div key={token.mint} className="w-full">
                    <Card className="w-full bg-gray-900/20 rounded-none sm:rounded-[2px] border-0">
                      <CardContent className="w-full p-0">
                        <div
                          className="w-full flex items-center justify-between px-4 py-3 rounded-none sm:rounded-[2px] hover:bg-[#f0fff4]/40 cursor-pointer transition-colors gap-4"
                          onClick={() => onTokenClick(token.mint)}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <AvatarImage src={token.logoURI} alt={token.symbol} />
                              <AvatarFallback className="bg-gradient-to-br from-orange-500 to-yellow-600 text-white font-bold text-xs">
                                {token.symbol.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-semibold text-white truncate uppercase">{token.name}</p>
                                {isStaking(token.mint) && (
                                  <span className="text-xs font-semibold text-yellow-500 whitespace-nowrap">STAKING</span>
                                )}
                              </div>
                              <p className="text-xs font-semibold text-white truncate">{formatBalance(token.balance, token.symbol)}</p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <div className={`text-xs whitespace-nowrap ${token.price ? "font-semibold" : ""}`}>
                              {token.price ? `$${token.price.toFixed(["SOL", "USDC"].includes(token.symbol) ? 2 : 8)}` : null}
                            </div>
                            <div className={`text-xs text-white whitespace-nowrap ${tokenBalance > 0 ? "font-semibold" : ""}`}>
                              {token.price ? `$${tokenBalance.toFixed(2)}` : null}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    {index < sortedTokens.length - 1 && <Separator className="bg-[#14532d]/30" />}
                  </div>
                );
              })}
              {tokens.length === 0 && <div className="text-center py-8 text-gray-300"><p className="text-sm">No tokens found</p></div>}
            </div>
          </div>
        </div>
      </div>

      {/* Add Token Dialog */}
      <AddTokenDialog open={showAddTokenDialog} onOpenChange={setShowAddTokenDialog} onTokenAdd={addCustomToken} />
    </div>
  );
};
