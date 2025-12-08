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
} from "lucide-react";
import { ADMIN_WALLET, API_BASE } from "@/lib/p2p";
import {
  getPaymentReceivedNotifications,
  saveNotification,
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
import { FlyingPrizeBox } from "./FlyingPrizeBox";
import { resolveApiUrl, fetchWithFallback } from "@/lib/api-client";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { getUnreadNotifications } from "@/lib/p2p-chat";
import { Zap } from "lucide-react";

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
  const [showQuestModal, setShowQuestModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();
  const [isServiceDown, setIsServiceDown] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const { isStaking } = useStakingTokens(wallet?.publicKey || null);

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
      toast({
        title: "Claim failed",
        description: m,
        variant: "destructive",
      });
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
        if (!cancelled) await refreshBalance();
        if (!cancelled) await new Promise((r) => setTimeout(r, 300));
        if (!cancelled) await refreshTokens();
      } catch (err) {
        // Silently ignore AbortError and other errors during refresh
        // They're already logged by the service layer
        if (!(err instanceof Error && err.name === "AbortError")) {
          console.debug("[Dashboard] Refresh error:", err);
        }
      } finally {
        if (!cancelled) {
          running = false;
        }
      }
    };

    const id = window.setInterval(tick, 60000); // Auto-refresh every 1 minute
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refreshBalance, refreshTokens]);

  // Monitor unread notifications
  useEffect(() => {
    if (!wallet) return;

    const updateUnreadCount = () => {
      const unread = getUnreadNotifications(wallet.publicKey);
      setUnreadCount(unread.length);
    };

    updateUnreadCount();
    // Check for updates every 2 seconds
    const interval = setInterval(updateUnreadCount, 2000);

    // Also listen for storage changes
    const handleStorageChange = () => {
      updateUnreadCount();
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [wallet]);

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

  // Periodically check Express P2P service health (require consecutive failures before marking down)
  const healthFailureRef = useRef(0);
  useEffect(() => {
    let stopped = false;
    const FAILURE_THRESHOLD = 2; // require N consecutive failures

    const check = async () => {
      try {
        const controller = new AbortController();
        const to = setTimeout(() => controller.abort(), 4000);

        // Health check via reliable ping endpoint
        const res = await fetchWithFallback("/api/ping", {
          method: "GET",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        });
        clearTimeout(to);

        if (!res.ok) {
          healthFailureRef.current += 1;
          setIsServiceDown(healthFailureRef.current >= FAILURE_THRESHOLD);
          return;
        }

        const data = await res.json().catch(() => null);
        if (data) {
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
    if (isRefreshing) return;
    try {
      setIsRefreshing(true);
      await refreshBalance();
      await new Promise((resolve) => setTimeout(resolve, 300));
      await refreshTokens();
      toast({
        title: "Refreshed",
        description: "Balance and tokens updated",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Could not refresh data",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTokenCardClick = (token: TokenInfo) => {
    onTokenClick(token.mint);
  };

  const formatBalance = (
    amount: number | undefined,
    symbol?: string,
  ): string => {
    if (amount === undefined || amount === null || isNaN(amount)) {
      if (symbol === "SOL") return "0.000000";
      if (symbol === "FXM") return "0.000000";
      if (symbol === "FIXERCOIN" || symbol === "LOCKER") return "0.00";
      return "0.00";
    }
    // SOL always show exactly 6 decimal places
    if (symbol === "SOL") {
      return amount.toLocaleString(undefined, {
        minimumFractionDigits: 6,
        maximumFractionDigits: 6,
      });
    }
    // FXM shows up to 6 decimal places for precision with small amounts
    if (symbol === "FXM") {
      return amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      });
    }
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
    symbol?: string,
  ): string => {
    if (!amount || !price || isNaN(amount) || isNaN(price)) return "$0.00";
    const usdValue = amount * price;
    // For very small amounts (< $0.01), show up to 8 decimals for precision
    if (usdValue < 0.01) {
      return `$${usdValue.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
      })}`;
    }
    return `$${usdValue.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatTokenPriceDisplay = (price?: number): string => {
    if (typeof price !== "number" || !isFinite(price)) return "0.000000";
    if (price === 0) return "0.000000";
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

  // Currency formatting from context
  const { formatCurrency } = useCurrency();

  const SOL_WRAPPED_MINT = "So11111111111111111111111111111111111111112";

  // Get SOL token data from tokens list (case-insensitive symbol match + wrapped SOL mint fallback)
  const getSolToken = () => {
    return tokens.find((token) => {
      if (!token) return false;
      const sym = (token.symbol || "").toString().toUpperCase();
      if (sym === "SOL") return true;
      if (token.mint === SOL_WRAPPED_MINT) return true;
      return false;
    });
  };

  // Get SOL price from tokens (try several possible fields)
  const getSolPrice = (): number | undefined => {
    const solToken = getSolToken();
    if (!solToken) return undefined;
    if (typeof solToken.price === "number" && isFinite(solToken.price))
      return solToken.price;

    // common alternative price fields providers may use
    const alt =
      (solToken as any).priceUsd ??
      (solToken as any).usdPrice ??
      (solToken as any).price_usd;
    if (typeof alt === "number" && isFinite(alt)) return alt;

    return undefined;
  };

  // Check if any tokens with balance are still loading prices
  const areTokenPricesLoading = (): boolean => {
    return tokens.some(
      (token) =>
        typeof token.balance === "number" &&
        token.balance > 0 &&
        token.price === undefined,
    );
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
    const priority = ["SOL", "USDC", "FIXERCOIN", "LOCKER"];
    const arr = [...tokens].filter((t) => t.symbol !== "USDT");

    const solToken = arr.find((t) => t.symbol === "SOL");
    if (solToken) {
      console.log(`[Dashboard] SOL token found in tokens array:`, {
        symbol: solToken.symbol,
        balance: solToken.balance,
        price: solToken.price,
        mint: solToken.mint,
      });
    } else {
      console.warn("[Dashboard] SOL token NOT found in tokens array");
      console.log(
        "[Dashboard] Available tokens:",
        tokens.map((t) => t.symbol),
      );
    }

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

    console.log(
      `[Dashboard] sortedTokens ready: ${arr.length} tokens, first token: ${arr[0]?.symbol} (balance: ${arr[0]?.balance})`,
    );
    return arr;
  }, [tokens]);

  if (!wallet) return null;

  return (
    <div
      className="express-p2p-page min-h-screen text-gray-900 relative overflow-y-auto"
      style={{ backgroundColor: "#f3f4f6" }}
    >
      {/* Decorative bottom green wave (SVG) */}
      <svg
        className="bottom-wave z-0"
        viewBox="0 0 1440 220"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="g-dashboard" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(34, 197, 94, 0.2)" />
            <stop offset="60%" stopColor="rgba(22, 163, 74, 0.15)" />
            <stop offset="100%" stopColor="rgba(34, 197, 94, 0.3)" />
          </linearGradient>
        </defs>
        <path
          d="M0,80 C240,180 480,20 720,80 C960,140 1200,40 1440,110 L1440,220 L0,220 Z"
          fill="url(#g-dashboard)"
          opacity="0.95"
        />
      </svg>

      {/* Quest Modal */}
      {showQuestModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 max-h-screen overflow-y-auto">
          <div className="bg-gradient-to-br from-[#064e3b] to-[#052e16] rounded-2xl border border-[#22c55e]/40 shadow-2xl max-w-md w-full p-6 animate-fade-in my-8">
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
                <p className="text-sm font-semibold text-[#22c55e] uppercase tracking-wider">
                  🚀 Grow. Earn. Win.
                </p>
              </div>

              {/* About */}
              <p className="text-xs text-gray-300 leading-relaxed">
                A community challenge inside the Fixorium Wallet. Complete
                simple tasks, earn rewards, and join random prize draws 🎁🎉 all
                directly from your wallet.
              </p>

              {/* How it works */}
              <div className="bg-white/5 rounded-lg p-3 border border-[#22c55e]/20">
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
                          className="mt-0.5 accent-[#22c55e]"
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
                          className="text-[#22c55e] hover:underline text-[11px] font-semibold"
                        >
                          Open
                        </button>
                      ) : t.type === "share" ? (
                        <button
                          onClick={shareOnX}
                          className="text-[#22c55e] hover:underline text-[11px] font-semibold"
                        >
                          Share
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rewards */}
              <div className="bg-white/5 rounded-lg p-3 border border-[#22c55e]/20">
                <h3 className="text-sm font-bold text-white mb-3">
                  🎁 Rewards
                </h3>
                <div className="space-y-2 text-xs text-gray-300">
                  <p>🪙 {REWARD_PER_TASK} FIXERCOIN per task</p>
                  <p>🖼️ NFTs and airdrops</p>
                  <p>🌟 Early access to wallet updates</p>
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
                    className="bg-gradient-to-r from-[#34d399] to-[#22c55e] h-2 rounded-full"
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
                  className="w-full h-10 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#34d399] to-[#22c55e] hover:from-[#9333ea] hover:to-[#16a34a] text-white shadow-lg"
                  onClick={() => completeNextTask()}
                >
                  Complete Task
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-10 rounded-xl font-semibold text-sm bg-[#064e3b]/50 text-white hover:bg-[#a855f7]/10"
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

      <div className="w-full md:max-w-lg lg:max-w-lg mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-2 relative z-20">
        {/* Balance Section */}
        <div className="w-full mt-2 mb-1 rounded-none sm:rounded-lg p-4 sm:p-6 border-0 bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0] relative overflow-hidden">
          <img
            src="https://cdn.builder.io/api/v1/image/assets%2F544a1f0862d54740bb19cea328eb3490%2F144647ed9eb7478cac472b3cb771e9ae?format=webp&width=800"
            alt="Balance card background"
            className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none"
            style={{ backgroundColor: "#1f1f1f" }}
          />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2 gap-2">
              {/* Dropdown menu - moved to left */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="h-7 w-7 p-0 rounded-md bg-transparent hover:bg-white/5 text-white ring-0 focus-visible:ring-0 border border-transparent z-20"
                    aria-label="Wallet menu"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onSelect={() => onAccounts?.()}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Wallet className="h-4 w-4" />
                    <span>MY WALLET</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={onAirdrop}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Gift className="h-4 w-4" />
                    <span>AIRDROP</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => navigate("/wallet/history")}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Clock className="h-4 w-4" />
                    <span>WALLET HISTORY</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-2 ml-auto">
                {/* Refresh button */}
                <Button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  size="sm"
                  className="h-7 w-7 p-0 rounded-md bg-transparent hover:bg-white/5 text-gray-400 hover:text-[#22c55e] ring-0 focus-visible:ring-0 border border-transparent z-20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Refresh balance"
                  title="Refresh balance and tokens"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                </Button>

                {/* Search button */}
                <Button
                  onClick={() => navigate("/search")}
                  size="sm"
                  className="h-7 w-7 p-0 rounded-md bg-transparent hover:bg-white/5 text-gray-400 hover:text-[#22c55e] ring-0 focus-visible:ring-0 border border-transparent z-20 transition-colors"
                  aria-label="Search tokens"
                  title="Search tokens"
                >
                  <SearchIcon className="h-4 w-4" />
                </Button>

                {/* Settings button */}
                <Button
                  onClick={onSettings}
                  size="sm"
                  className="h-7 w-7 p-0 rounded-md bg-transparent hover:bg-white/5 text-gray-400 hover:text-white ring-0 focus-visible:ring-0 border border-transparent z-20 transition-colors"
                  aria-label="Settings"
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3 mt-8">
              <div className="text-left">
                <div className="text-xs font-semibold text-gray-700 tracking-widest">
                  MY PORTFOLIO
                </div>
              </div>

              {wallet
                ? (() => {
                    const total = getTotalPortfolioValue();
                    const hasAnyBalance =
                      tokens.some(
                        (t) => typeof t.balance === "number" && t.balance > 0,
                      ) ||
                      (typeof balance === "number" && balance > 0);

                    if (!hasAnyBalance) {
                      // If prices are still loading, show loading indicator
                      // Otherwise show 0.000 USD
                      const displayValue = `0.000 $`;
                      return (
                        <div className="flex items-center justify-between gap-4 w-full">
                          <div className="text-3xl text-gray-900 leading-tight">
                            {showBalance ? displayValue : "****"}
                          </div>
                          <Button
                            onClick={onP2PTrade || onReceive}
                            className="bg-[#86efac] hover:bg-[#65e8ac] border border-[#22c55e]/40 text-gray-900 font-bold text-xs px-5 py-2.5 rounded-sm whitespace-nowrap h-auto transition-colors"
                          >
                            P2P TRADE
                          </Button>
                        </div>
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
                    const isLoadingPrices = areTokenPricesLoading();

                    return (
                      <div className="flex items-center justify-between gap-4 w-full">
                        <div className="text-3xl text-gray-900 leading-tight">
                          {showBalance ? (
                            <>
                              <span
                                style={{
                                  fontVariantNumeric: "tabular-nums",
                                  fontFamily: "Arial",
                                }}
                              >
                                {total.toLocaleString(undefined, {
                                  minimumFractionDigits: 3,
                                  maximumFractionDigits: 3,
                                })}
                              </span>
                              {" $"}
                            </>
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
                    );
                  })()
                : "Connect wallet to see balance"}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-around gap-2 sm:gap-3 mt-6 w-full px-0">
              <Button
                onClick={onSend}
                className="flex flex-col items-center justify-center gap-2 flex-1 h-auto py-4 px-2 rounded-md font-bold text-xs bg-transparent hover:bg-[#22c55e]/10 border border-[#22c55e]/40 text-white transition-colors"
              >
                <Send className="h-8 w-8 text-[#22c55e]" />
                <span>WITHDRAW</span>
              </Button>
              <Button
                onClick={onReceive}
                className="flex flex-col items-center justify-center gap-2 flex-1 h-auto py-4 px-2 rounded-md font-bold text-xs bg-transparent hover:bg-[#22c55e]/10 border border-[#22c55e]/40 text-white transition-colors"
              >
                <Download className="h-8 w-8 text-[#22c55e]" />
                <span>DEPOSIT</span>
              </Button>
              <Button
                onClick={onSwap}
                className="flex flex-col items-center justify-center gap-2 flex-1 h-auto py-4 px-2 rounded-md font-bold text-xs bg-transparent hover:bg-[#22c55e]/10 border border-[#22c55e]/40 text-white transition-colors"
              >
                <ArrowRightLeft className="h-8 w-8 text-[#22c55e]" />
                <span>CONVERT</span>
              </Button>
            </div>

            {/* Additional Action Buttons: TRADE, BURN, LOCK */}
            <div className="flex items-center justify-around gap-2 sm:gap-3 mt-3 w-full px-0">
              <Button
                onClick={onAutoBot}
                className="flex flex-col items-center justify-center gap-2 flex-1 h-auto py-4 px-2 rounded-sm font-bold text-xs bg-transparent hover:bg-[#22c55e]/10 border border-[#22c55e]/40 text-white transition-colors"
              >
                <ArrowRightLeft className="h-8 w-8 text-[#22c55e]" />
                <span>LIMIT ORDER</span>
              </Button>
              <Button
                onClick={onBurn}
                className="flex flex-col items-center justify-center gap-2 flex-1 h-auto py-4 px-2 rounded-sm font-bold text-xs bg-transparent hover:bg-[#22c55e]/10 border border-[#22c55e]/40 text-white transition-colors"
              >
                <Zap className="h-8 w-8 text-[#22c55e]" />
                <span>BURNING</span>
              </Button>
              <Button
                onClick={onLock}
                className="flex flex-col items-center justify-center gap-2 flex-1 h-auto py-4 px-2 rounded-sm font-bold text-xs bg-transparent hover:bg-[#22c55e]/10 border border-[#22c55e]/40 text-white transition-colors"
              >
                <Unlock className="h-8 w-8 text-[#22c55e]" />
                <span>LOCK UP</span>
              </Button>
            </div>
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

        <style>{`
          @keyframes blink {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.3;
            }
          }
          .token-price-blink {
            animation: blink 1.2s ease-in-out infinite;
          }
        `}</style>

        <div className="w-full space-y-2">
          {/* Quest Reward Card */}
          <div className="w-full px-4">
            <div
              className="w-full bg-gradient-to-br from-[#1a3a2a] to-[#0f2818] rounded-md border border-[#22c55e]/40 p-4 cursor-pointer hover:bg-[#22c55e]/10 transition-colors"
              onClick={() => setShowQuestModal(true)}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <div className="text-xs font-semibold text-[#22c55e] uppercase tracking-widest">
                    🎁 Fixercoin Quest
                  </div>
                  <div className="text-sm font-bold text-white">
                    Earn {earnedTokens} FIXERCOIN
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 border border-[#22c55e]/20">
                    <div
                      className="bg-gradient-to-r from-[#34d399] to-[#22c55e] h-1.5 rounded-full"
                      style={{ width: `${progressPct}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {tasksDone}/{tasksTotal} tasks completed
                  </div>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowQuestModal(true);
                  }}
                  className="bg-[#22c55e] hover:bg-[#16a34a] text-gray-900 font-bold text-xs px-4 py-2 rounded-md whitespace-nowrap h-auto transition-colors"
                >
                  View Quest
                </Button>
              </div>
            </div>
          </div>

          {sortedTokens.map((token, index) => {
            const tokenBalance =
              typeof token.balance === "number" &&
              typeof token.price === "number" &&
              isFinite(token.balance) &&
              isFinite(token.price)
                ? token.balance * token.price
                : 0;

            return (
              <div key={token.mint} className="w-full px-4">
                <Card className="w-full bg-transparent rounded-md border border-[#22c55e]/40 hover:bg-[#22c55e]/10 transition-colors">
                  <CardContent className="w-full p-0">
                    <div
                      className="w-full flex items-center justify-between px-4 py-3 rounded-md cursor-pointer gap-4"
                      onClick={() => handleTokenCardClick(token)}
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
                            <p className="text-xs font-semibold text-white truncate uppercase">
                              {token.name}
                            </p>
                            {isStaking(token.mint) && (
                              <span className="text-xs font-semibold text-yellow-500 whitespace-nowrap">
                                STAKING
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-white truncate">
                            {formatBalance(token.balance, token.symbol)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div
                          className={`text-xs whitespace-nowrap ${
                            tokenBalance > 0 ? "font-semibold" : ""
                          }`}
                        >
                          {typeof token.price === "number" &&
                          isFinite(token.price) ? (
                            <span style={{ color: "#ffffff" }}>
                              ${" "}
                              {tokenBalance < 0.01
                                ? tokenBalance.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 8,
                                  })
                                : tokenBalance.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                            </span>
                          ) : null}
                        </div>
                        <div
                          className={`text-xs whitespace-nowrap ${
                            typeof token.priceChange24h === "number" &&
                            isFinite(token.priceChange24h)
                              ? token.priceChange24h >= 0
                                ? "text-green-400"
                                : "text-red-400"
                              : "text-gray-400"
                          }`}
                        >
                          {typeof token.priceChange24h === "number" &&
                          isFinite(token.priceChange24h) ? (
                            <>
                              {token.priceChange24h >= 0 ? "+" : ""}
                              {token.priceChange24h.toFixed(2)}%
                            </>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
    </div>
  );
};
