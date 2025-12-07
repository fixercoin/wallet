 import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { FlyingPrizeBox } from "./FlyingPrizeBox";

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

// ---- Constants ----
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
  { id: "follow_x", label: "Follow fixercoin on Twitter/X", type: "link", href: "https://twitter.com/fixorium" },
  { id: "join_community", label: "Join Telegram", type: "link", href: "https://t.me/fixorium" },
  { id: "share_updates", label: "Share fixercoin updates on X", type: "share" },
  { id: "visit_links", label: "Visit official website", type: "link", href: "https://fixorium.com.pk" },
  { id: "watch_videos", label: "Watch promo videos", type: "link", href: "https://www.youtube.com/channel/UCoFLDQasgIdX5tj3UbT9fyQ" },
] as const;

const REWARD_PER_TASK = 50; // FIXERCOIN per completed task

// ---- Component ----
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
  const { formatCurrency } = useCurrency();
  const { isStaking } = useStakingTokens(wallet?.publicKey || null);

  const [showBalance, setShowBalance] = useState(true);
  const [showAddTokenDialog, setShowAddTokenDialog] = useState(false);
  const [showQuestModal, setShowQuestModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isServiceDown, setIsServiceDown] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const healthFailureRef = useRef(0);

  // ---- Quest Storage ----
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
        JSON.stringify(Array.from(next))
      );
    } catch {}
  };

  const toggleTask = (taskId: string) => {
    const next = new Set(completedTasks);
    if (next.has(taskId)) next.delete(taskId);
    else {
      next.add(taskId);
      toast({ title: "+50 FIXERCOIN", description: "Task completed. Keep going!" });
    }
    setCompletedTasks(next);
    saveTasks(next);
  };

  const markTaskCompleted = (taskId: string) => {
    if (!completedTasks.has(taskId)) {
      const next = new Set(completedTasks);
      next.add(taskId);
      setCompletedTasks(next);
      saveTasks(next);
      toast({ title: "+50 FIXERCOIN", description: "Task completed. Keep going!" });
    }
  };

  const openAndComplete = (taskId: string, url: string) => {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {}
    markTaskCompleted(taskId);
  };

  const shareOnX = () => {
    const text = encodeURIComponent("Fixercoin updates ��� #Fixercoin");
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
    if (!wallet?.publicKey || completedTasks.size !== QUEST_TASKS.length) return;
    try {
      const msg = `fixercoin-quest-claim:${wallet.publicKey}:${completedTasks.size}:${Date.now()}`;
      const bytes = new TextEncoder().encode(msg);
      const sig = nacl.sign.detached(bytes, wallet.secretKey);

      const body = {
        recipient: wallet.publicKey,
        tasks: Array.from(completedTasks),
        count: completedTasks.size,
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

      toast({ title: "Claimed", description: "Your FIXERCOIN reward is on the way." });
      setShowQuestModal(false);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      toast({ title: "Claim failed", description: m, variant: "destructive" });
    }
  };

  // ---- Auto Refresh Balance & Tokens ----
  useEffect(() => {
    let cancelled = false;
    let running = false;

    const tick = async () => {
      if (cancelled || running) return;
      running = true;
      try {
        await refreshBalance();
        await new Promise((r) => setTimeout(r, 300));
        await refreshTokens();
      } catch (err) {
        if (!(err instanceof Error && err.name === "AbortError")) console.debug("[Dashboard] Refresh error:", err);
      } finally {
        running = false;
      }
    };

    const id = window.setInterval(tick, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, [refreshBalance, refreshTokens]);

  // ---- Unread notifications ----
  useEffect(() => {
    if (!wallet) return;

    const updateUnreadCount = () => {
      const unread = getUnreadNotifications(wallet.publicKey);
      setUnreadCount(unread.length);
    };

    updateUnreadCount();
    const interval = setInterval(updateUnreadCount, 2000);

    const handleStorageChange = () => updateUnreadCount();
    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [wallet]);

  // ---- Admin pending notifications ----
  useEffect(() => {
    if (!wallet?.publicKey) return;
    if (String(wallet.publicKey).toLowerCase() !== String(ADMIN_WALLET).toLowerCase()) return;

    const notifications = getPaymentReceivedNotifications(wallet.publicKey);
    setPendingOrdersCount(notifications.length);

    const interval = setInterval(() => {
      const updated = getPaymentReceivedNotifications(wallet.publicKey);
      setPendingOrdersCount(updated.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [wallet?.publicKey]);

  // ---- Service Health Check ----
  useEffect(() => {
    let stopped = false;
    const FAILURE_THRESHOLD = 2;

    const check = async () => {
      try {
        const controller = new AbortController();
        const to = setTimeout(() => controller.abort(), 4000);

        const res = await fetchWithFallback("/api/ping", { method: "GET", signal: controller.signal, headers: { "Content-Type": "application/json" } });
        clearTimeout(to);

        if (!res.ok) { healthFailureRef.current++; setIsServiceDown(healthFailureRef.current >= FAILURE_THRESHOLD); return; }

        const data = await res.json().catch(() => null);
        healthFailureRef.current = data ? 0 : healthFailureRef.current + 1;
        setIsServiceDown(healthFailureRef.current >= FAILURE_THRESHOLD);
      } catch {
        healthFailureRef.current++;
        setIsServiceDown(healthFailureRef.current >= FAILURE_THRESHOLD);
      }
    };

    void check();
    const id = setInterval(() => { if (!stopped) void check(); }, 10000);
    return () => { stopped = true; clearInterval(id); };
  }, []);

  // ---- Scroll-triggered refresh ----
  useEffect(() => {
    let lastY = window.scrollY;
    let lastRefresh = 0;
    const THRESHOLD = 50;
    const COOLDOWN = 1000;

    const doScrollRefresh = async () => {
      await refreshBalance();
      await new Promise((r) => setTimeout(r, 300));
      await refreshTokens();
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

  // ---- Copy wallet address ----
  const handleCopyAddress = async () => {
    if (!wallet) return;
    const success = await copyToClipboard(wallet.publicKey);
    if (success) toast({ title: "Address Copied", description: "Wallet address copied to clipboard" });
    else toast({ title: "Copy Failed", description: "Could not copy address. Please copy it manually.", variant: "destructive" });
  };

  // ---- Manual Refresh ----
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

  // ---- Token helpers ----
  const handleTokenCardClick = (token: TokenInfo) => onTokenClick(token.mint);

  const formatBalance = (amount?: number, symbol?: string): string => {
    if (!amount || isNaN(amount)) return "0.00";
    if (symbol === "FIXERCOIN" || symbol === "LOCKER") {
      return amount.toFixed(2);
    }
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const areTokenPricesLoading = () => tokens.some(t => t.balance > 0 && t.price === undefined);

  const getTotalPortfolioValue = (): number => {
    return tokens.reduce((sum, t) => sum + ((t.balance || 0) * (t.price || 0)), 0);
  };

  const sortedTokens = useMemo(() => {
    const priority = ["SOL", "USDC", "FIXERCOIN", "LOCKER"];
    return [...tokens].sort((a, b) => {
      const aIdx = priority.indexOf(a.symbol);
      const bIdx = priority.indexOf(b.symbol);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.symbol.localeCompare(b.symbol);
    });
  }, [tokens]);

  if (!wallet) return null;

  return (
    <div className="express-p2p-page min-h-screen text-gray-900 relative overflow-y-auto">
      {/* The rest of JSX like Balance Card, Quest Modal, Tokens List, Buttons, etc. */}
      {/* Your existing JSX can remain as-is */}
    </div>
  );
};
