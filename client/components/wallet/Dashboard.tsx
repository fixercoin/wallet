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
  X,
} from "lucide-react";
import { ADMIN_WALLET, API_BASE } from "@/lib/p2p";
import {
  getPaymentReceivedNotifications,
  saveNotification,
} from "@/lib/p2p-chat";
import { useDurableRoom } from "@/hooks/useDurableRoom";
import { useWallet } from "@/contexts/WalletContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { shortenAddress, copyToClipboard, TokenInfo } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { AddTokenDialog } from "./AddTokenDialog";
import { TokenBadge } from "./TokenBadge";
import { TokenSelectionDialog } from "./TokenSelectionDialog";
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
import { FlyingPrizeBox } from "./FlyingPrizeBox";
import { resolveApiUrl } from "@/lib/api-client";
import bs58 from "bs58";
import nacl from "tweetnacl";

const QUEST_TASKS = [
  {
    id: "follow_x",
    label: "Follow fixercoin on Twitter/X",
    type: "link",
    href: "https://twitter.com/fixorium",
  },
  {
    id: "join_community",
    label: "Join Telegram",
    type: "link",
    href: "https://t.me/fixorium",
  },
  { id: "share_updates", label: "Share fixercoin updates on X", type: "share" },
  {
    id: "visit_links",
    label: "Visit official website",
    type: "link",
    href: "https://fixorium.com.pk",
  },
  {
    id: "watch_videos",
    label: "Watch promo videos",
    type: "link",
    href: "https://www.youtube.com/channel/UCoFLDQasgIdX5tj3UbT9fyQ",
  },
] as const;

const REWARD_PER_TASK = 50; // FIXERCOIN per completed task

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
    removeToken,
  } = useWallet();
  const { toast } = useToast();
  const { events } = useDurableRoom("global", API_BASE);
  const [showBalance, setShowBalance] = useState(true);
  const [showAddTokenDialog, setShowAddTokenDialog] = useState(false);
  const [showQuestModal, setShowQuestModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [isDeletingToken, setIsDeletingToken] = useState(false);
  const navigate = useNavigate();
  const [isServiceDown, setIsServiceDown] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  // Quest state (per-wallet, persisted locally)
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!wallet?.publicKey) return;
    try {
      const raw = localStorage.getItem(`fixer_quest_tasks_${wallet.publicKey}`);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) setCompletedTasks(new Set(arr));
      }
    } catch {}
  }, [wallet?.publicKey]);

  const saveTasks = (next: Set<string>) => {
    if (!wallet?.publicKey) return;
    try {
      localStorage.setItem(
        `fixer_quest_tasks_${wallet.publicKey}`,
        JSON.stringify(Array.from(next)),
      );
    } catch {}
  };

  const tasksTotal = QUEST_TASKS.length;
  const tasksDone = completedTasks.size;
  const progressPct = Math.min(100, Math.round((tasksDone / tasksTotal) * 100));
  const canClaim = tasksDone === tasksTotal;
  const earnedTokens = tasksDone * REWARD_PER_TASK;

  const toggleTask = (taskId: string) => {
    const next = new Set(completedTasks);
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
      toast({
        title: "+50 FIXERCOIN",
        description: "Task completed. Keep going!",
      });
    }
    setCompletedTasks(next);
    saveTasks(next);
  };

  const markTaskCompleted = (taskId: string) => {
    if (completedTasks.has(taskId)) return;
    const next = new Set(completedTasks);
    next.add(taskId);
    setCompletedTasks(next);
    saveTasks(next);
    toast({
      title: "+50 FIXERCOIN",
      description: "Task completed. Keep going!",
    });
  };

  const openAndComplete = (taskId: string, url: string) => {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {}
    markTaskCompleted(taskId);
  };

  const shareOnX = () => {
    const text = encodeURIComponent("Fixercoin updates 🚀 #Fixercoin");
    const shareUrl = encodeURIComponent("https://fixorium.com.pk");
    const intent = `https://twitter.com/intent/tweet?text=${text}&url=${shareUrl}`;
    try {
      window.open(intent, "_blank", "noopener,noreferrer");
    } catch {}
    markTaskCompleted("share_updates");
  };

  const completeNextTask = () => {
    for (const t of QUEST_TASKS) {
      if (!completedTasks.has(t.id)) {
        toggleTask(t.id);
        break;
      }
    }
  };

  const handleClaimReward = async () => {
    if (!wallet?.publicKey || !canClaim) return;
    try {
      const msg = `fixercoin-quest-claim:${wallet.publicKey}:${tasksDone}:${Date.now()}`;
      const bytes = new TextEncoder().encode(msg);
      const sig = nacl.sign.detached(bytes, wallet.secretKey);
      const body = {
        recipient: wallet.publicKey,
        tasks: Array.from(completedTasks),
        count: tasksDone,
        authMessage: msg,
        authSignature: bs58.encode(sig),
      };
      const res = await fetch(resolveApiUrl("/api/quest-claim"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(err || `Claim failed (${res.status})`);
      }
      const j = await res.json().catch(() => ({}) as any);
      toast({
        title: "Claimed",
        description: "Your FIXERCOIN reward is on the way.",
      });
      setShowQuestModal(false);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      toast({ title: "Claim failed", description: m, variant: "destructive" });
    }
  };

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

    const id = window.setInterval(tick, 10000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refreshBalance, refreshTokens]);

  // Check for pending payment verifications if admin
  useEffect(() => {
    if (
      wallet?.publicKey &&
      ADMIN_WALLET &&
      String(wallet.publicKey).toLowerCase() ===
        String(ADMIN_WALLET).toLowerCase()
    ) {
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

  // Persist incoming notifications and update pending badge (admin only)
  useEffect(() => {
    if (!wallet?.publicKey) return;
    const last = events?.[events.length - 1];
    if (!last || last.kind !== "notification") return;
    const notif = last.data as any;
    if (!notif?.initiatorWallet || notif.initiatorWallet === wallet.publicKey)
      return;
    try {
      saveNotification(notif);
    } catch {}
    if (
      ADMIN_WALLET &&
      String(wallet.publicKey).toLowerCase() ===
        String(ADMIN_WALLET).toLowerCase()
    ) {
      const updated = getPaymentReceivedNotifications(wallet.publicKey);
      setPendingOrdersCount(updated.length);
    }
  }, [events, wallet?.publicKey]);

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
    await refreshBalance();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await refreshTokens();

    toast({
      title: "Refreshed",
      description: "Balance and tokens updated",
    });
  };

  const handleTokenCardClick = (token: TokenInfo) => {
    setSelectedToken(token);
    setShowTokenDialog(true);
  };

  const handleDeleteToken = async () => {
    if (!selectedToken) return;

    try {
      setIsDeletingToken(true);
      removeToken(selectedToken.mint);

      toast({
        title: "Token Removed",
        description: `${selectedToken.symbol} has been removed from your wallet`,
      });

      setShowTokenDialog(false);
      setSelectedToken(null);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to remove token",
        variant: "destructive",
      });
    } finally {
      setIsDeletingToken(false);
    }
  };

  const handleTokenContinue = () => {
    if (selectedToken) {
      setShowTokenDialog(false);
      setSelectedToken(null);
      onTokenClick(selectedToken.mint);
    }
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

  const getTotalInSol = (): number => {
    const usdTotal = getTotalPortfolioValue();
    const solPrice = getSolPrice();
    if (typeof solPrice !== "number" || !isFinite(solPrice) || solPrice <= 0) {
      return 0;
    }
    return usdTotal / solPrice;
  };

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

      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
      if (aIdx >= 0) return -1;
      if (bIdx >= 0) return 1;

      return aSym.localeCompare(bSym);
    });
    return arr;
  }, [tokens]);

  if (!wallet) return null;

  return (
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#2d1b47] via-[#1f0f3d] to-[#0f1820] text-white relative overflow-hidden">
      {/* Decorative curved accent background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-25 blur-3xl bg-gradient-to-br from-[#a855f7] to-[#22c55e] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-15 blur-3xl bg-[#22c55e] pointer-events-none" />

      {/* Quest Modal */}
      {showQuestModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 max-h-screen overflow-y-auto">
          <div className="bg-gradient-to-br from-[#2d1b47] to-[#1f0f3d] rounded-2xl border border-[#a855f7]/40 shadow-2xl max-w-md w-full p-6 animate-fade-in my-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">fixercoin quest</h2>
              <button
                onClick={() => setShowQuestModal(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {/* Tagline */}
              <div className="text-center">
                <p className="text-sm font-semibold text-[#a855f7] uppercase tracking-wider">
                  🚀 Grow. Earn. Win.
                </p>
              </div>

              {/* About */}
              <p className="text-xs text-gray-300 leading-relaxed">
                A community challenge inside the Fixorium Wallet. Complete
                simple tasks, earn rewards, and join random prize draws — all
                directly from your wallet.
              </p>

              {/* How it works */}
              <div className="bg-white/5 rounded-lg p-3 border border-[#ffffff66]/10">
                <h3 className="text-sm font-bold text-white mb-3">
                  How It Works
                </h3>
                <div className="space-y-2 text-xs text-gray-300">
                  <p>✅ Connect your Fixorium Wallet</p>
                  <p>✅ Join the quest challenge</p>
                  <p>✅ Complete simple tasks</p>
                  <p>✅ Earn points for each task</p>
                  <p>✅ Win random rewards</p>
                </div>
              </div>

              {/* Complete Tasks */}
              <div className="bg-white/5 rounded-lg p-3 border border-[#a855f7]/20">
                <h3 className="text-sm font-bold text-white mb-3">
                  Complete Tasks
                </h3>
                <div className="space-y-2 text-xs text-gray-300">
                  {QUEST_TASKS.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <label className="flex items-start gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-[#a855f7]"
                          checked={completedTasks.has(t.id)}
                          onChange={() => toggleTask(t.id)}
                        />
                        <span>{t.label}</span>
                      </label>
                      {t.type === "link" ? (
                        <button
                          onClick={() =>
                            openAndComplete(
                              t.id as string,
                              (t as any).href as string,
                            )
                          }
                          className="text-[#a855f7] hover:underline text-[11px] font-semibold"
                        >
                          Open
                        </button>
                      ) : t.type === "share" ? (
                        <button
                          onClick={shareOnX}
                          className="text-[#a855f7] hover:underline text-[11px] font-semibold"
                        >
                          Share
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rewards */}
              <div className="bg-white/5 rounded-lg p-3 border border-[#ffffff66]/10">
                <h3 className="text-sm font-bold text-white mb-3">
                  🎁 Rewards
                </h3>
                <div className="space-y-2 text-xs text-gray-300">
                  <p>💰 {REWARD_PER_TASK} FIXERCOIN per task</p>
                  <p>🖼️ NFTs and airdrops</p>
                  <p>⚡ Early access to wallet updates</p>
                  <p>👑 Premium features for top participants</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">
                    Progress
                  </span>
                  <span className="text-xs text-gray-400">
                    {tasksDone}/{tasksTotal} tasks
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 border border-[#ffffff66]/20">
                  <div
                    className="bg-gradient-to-r from-[#a855f7] to-[#22c55e] h-2 rounded-full"
                    style={{ width: `${progressPct}%` }}
                  ></div>
                </div>
                <div className="mt-2 text-[11px] text-gray-300">
                  Earned:{" "}
                  <span className="text-white font-semibold">
                    {earnedTokens} FIXERCOIN
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  className="w-full h-10 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#a855f7] to-[#22c55e] hover:from-[#9333ea] hover:to-[#16a34a] text-white shadow-lg"
                  onClick={() => completeNextTask()}
                >
                  Complete Task
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-10 rounded-xl font-semibold text-sm bg-[#2d1b47]/50 text-white hover:bg-[#a855f7]/10"
                  disabled={!canClaim}
                  onClick={handleClaimReward}
                >
                  Claim Reward
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md mx-auto px-4 py-2 relative z-20">
        {/* Top Bar - Outside Balance Card */}
        <div className="mb-0">
          <TopBar
            onAccounts={onAccounts}
            onAirdrop={onAirdrop}
            onBurn={onBurn}
            onLock={onLock}
            onSettings={onSettings}
            onQuestOpen={() => setShowQuestModal(true)}
          />
        </div>

        {/* Balance Section */}
        <div className="mb-1 rounded-lg p-6 border border-[#555555]/40 bg-gradient-to-br from-[#2d1b47]/60 to-[#1f0f3d]/60">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              {showBalance ? (
                <Eye className="h-5 w-5 text-white/80" />
              ) : (
                <EyeOff className="h-5 w-5 text-white/80" />
              )}
            </button>
            <div className="flex-1"></div>
          </div>
          <div className="text-center space-y-2">
            {wallet
              ? (() => {
                  const total = getTotalPortfolioValue();
                  const hasAnyBalance =
                    tokens.some(
                      (t) => typeof t.balance === "number" && t.balance > 0,
                    ) ||
                    (typeof balance === "number" && balance > 0);
                  if (!hasAnyBalance) {
                    return (
                      <>
                        <div className="text-2xl font-bold text-white leading-tight">
                          {showBalance ? "0.00 USD" : "****"}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {showBalance ? "+ 0.00 USD (0.00%)" : "24h: ****"}
                        </div>
                      </>
                    );
                  }

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
                      <div className="text-2xl font-bold text-white leading-tight">
                        {showBalance
                          ? `${total.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} USD`
                          : "****"}
                      </div>
                      {showBalance ? (
                        <>
                          {hasValidPriceChange && (
                            <div className="flex items-center justify-center gap-2 mt-1">
                              {isPositive ? (
                                <>
                                  <ArrowUpRight className="h-3 w-3 text-green-400" />
                                  <span className="text-xs font-medium text-green-400">
                                    +
                                    {Math.abs(totalChange24h).toLocaleString(
                                      undefined,
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      },
                                    )}{" "}
                                    (+{change24hPercent.toFixed(2)}%)
                                  </span>
                                </>
                              ) : (
                                <>
                                  <ArrowDownLeft className="h-3 w-3 text-red-400" />
                                  <span className="text-xs font-medium text-red-400">
                                    -
                                    {Math.abs(totalChange24h).toLocaleString(
                                      undefined,
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      },
                                    )}{" "}
                                    ({change24hPercent.toFixed(2)}%)
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                          {!hasValidPriceChange && (
                            <div className="text-xs text-gray-400 mt-1">
                              No data available
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-gray-400 mt-1">****</div>
                      )}
                    </>
                  );
                })()
              : "Connect wallet to see balance"}
          </div>
          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-6">
            <Button
              onClick={onSend}
              className="flex-1 h-10 rounded-xl font-semibold text-xs bg-[#2d1b47]/50 hover:bg-[#a855f7]/20 border border-[#555555]/60 text-white flex items-center justify-center"
            >
              SEND
            </Button>

            <Button
              onClick={onReceive}
              className="flex-1 h-10 rounded-xl font-semibold text-xs bg-[#2d1b47]/50 hover:bg-[#22c55e]/20 border border-[#555555]/60 text-white flex items-center justify-center"
            >
              RECEIVE
            </Button>

            <Button
              onClick={onSwap}
              className="flex-1 h-10 rounded-xl font-semibold text-xs bg-[#2d1b47]/50 hover:bg-[#a855f7]/20 border border-[#555555]/60 text-white flex items-center justify-center"
            >
              SWAP
            </Button>
          </div>
        </div>

        {/* Tokens List */}
        {wallet?.publicKey === ADMIN_WALLET && pendingOrdersCount > 0 && (
          <div className="mb-4 flex gap-2">
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
          </div>
        )}

        <div className="space-y-0">
          {sortedTokens.map((token, index) => {
            const percentChange =
              typeof token.priceChange24h === "number" &&
              isFinite(token.priceChange24h)
                ? token.priceChange24h
                : null;
            const isPositive = (percentChange ?? 0) >= 0;

            return (
              <div key={token.mint}>
                <Card className="bg-transparent rounded-md border-0">
                  <CardContent className="p-0">
                    <div
                      className="flex items-center justify-between p-4 rounded-md hover:bg-[#1a2540]/60 cursor-pointer transition-colors"
                      onClick={() => handleTokenCardClick(token)}
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
                                    isPositive
                                      ? "text-green-400"
                                      : "text-red-400"
                                  }`}
                                >
                                  {isPositive ? "+" : ""}
                                  {percentChange.toFixed(2)}%
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">
                          {formatBalance(token.balance || 0)}
                        </p>
                        <p className="text-xs text-gray-300">
                          {typeof token.price === "number" && token.price > 0
                            ? `$${formatBalance((token.balance || 0) * token.price)}`
                            : "$0.00"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {index < sortedTokens.length - 1 && (
                  <Separator className="bg-[#555555]/30" />
                )}
              </div>
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

      {/* Token Selection Dialog */}
      <TokenSelectionDialog
        token={selectedToken}
        open={showTokenDialog}
        onOpenChange={setShowTokenDialog}
        onDelete={handleDeleteToken}
        onContinue={handleTokenContinue}
        isDeleting={isDeletingToken}
      />
    </div>
  );
};
