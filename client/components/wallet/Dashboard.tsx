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
    <div className="express-p2p-page min-h-screen text-foreground relative overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            FIXORIUM
            {isUsingCache && <Badge variant="outline" className="text-xs">Cache</Badge>}
            {isServiceDown && <Badge variant="destructive" className="text-xs">Offline</Badge>}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/p2p-messages")}
                  className="h-8 w-8 p-0"
                >
                  <MessageSquare className="h-4 w-4" />
                  <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {unreadCount}
                  </Badge>
                </Button>
              </div>
            )}
            {pendingOrdersCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {pendingOrdersCount} Orders
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddTokenDialog(true)}
              className="h-8 w-8 p-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onAutoBot}
              className="h-8 w-8 p-0"
            >
              <Bot className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSettings}
              className="h-8 w-8 p-0"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Balance Card */}
        <Card className="mb-6 bg-gradient-to-br from-card to-card/50 border-border">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Total Balance</div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBalance(!showBalance)}
                  className="h-6 w-6 p-0"
                >
                  {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              </div>
              <div className="text-4xl font-bold">
                {showBalance
                  ? `$${getTotalPortfolioValue().toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : "••••••"}
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">W</AvatarFallback>
                </Avatar>
                <code className="text-xs text-muted-foreground flex-1">
                  {shortenAddress(wallet.publicKey)}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyAddress}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <Button
            onClick={onSend}
            variant="outline"
            className="h-16 flex flex-col items-center justify-center gap-1"
          >
            <Send className="h-4 w-4" />
            <span className="text-xs">Send</span>
          </Button>
          <Button
            onClick={onReceive}
            variant="outline"
            className="h-16 flex flex-col items-center justify-center gap-1"
          >
            <Download className="h-4 w-4" />
            <span className="text-xs">Receive</span>
          </Button>
          <Button
            onClick={onSwap}
            variant="outline"
            className="h-16 flex flex-col items-center justify-center gap-1"
          >
            <ArrowRightLeft className="h-4 w-4" />
            <span className="text-xs">Swap</span>
          </Button>
          <Button
            onClick={onAirdrop}
            variant="outline"
            className="h-16 flex flex-col items-center justify-center gap-1"
          >
            <Gift className="h-4 w-4" />
            <span className="text-xs">Airdrop</span>
          </Button>
        </div>

        {/* Quest Banner */}
        {completedTasks.size < QUEST_TASKS.length && (
          <Card className="mb-6 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold mb-1">Complete Quests</div>
                  <div className="text-xs text-muted-foreground">
                    Earn FIXERCOIN by completing tasks
                  </div>
                  <div className="mt-2 w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(completedTasks.size / QUEST_TASKS.length) * 100}%` }}
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowQuestModal(true)}
                  className="whitespace-nowrap"
                >
                  {completedTasks.size}/{QUEST_TASKS.length}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tokens Section */}
        <div className="space-y-3">
          <div className="text-sm font-semibold px-1">Assets</div>
          {isLoading && !tokens.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="animate-pulse">Loading assets...</div>
            </div>
          ) : sortedTokens.length > 0 ? (
            sortedTokens.map((token) => (
              <Card
                key={token.mint}
                className="bg-card/50 hover:bg-card/70 cursor-pointer transition-colors border-border"
                onClick={() => onTokenClick(token.mint)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={token.logoURI} alt={token.symbol} />
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
                          {token.symbol.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm">{token.symbol}</div>
                        <div className="text-xs text-muted-foreground">
                          {token.price !== undefined && token.price > 0
                            ? `$${token.price.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 6,
                              })}`
                            : "Price unavailable"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm">
                        {formatBalance(token.balance, token.symbol)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {token.price !== undefined && token.price > 0
                          ? `$${((token.balance || 0) * token.price).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`
                          : "-"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Coins className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No assets yet</p>
            </div>
          )}
        </div>

        {/* Add Token Dialog */}
        <AddTokenDialog
          open={showAddTokenDialog}
          onOpenChange={setShowAddTokenDialog}
          onTokenAdd={addCustomToken}
        />

        {/* Quest Modal */}
        {showQuestModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle>Quest & Rewards</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowQuestModal(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {QUEST_TASKS.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={completedTasks.has(task.id)}
                      onChange={() => toggleTask(task.id)}
                      className="h-4 w-4 rounded cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{task.label}</div>
                      <div className="text-xs text-muted-foreground">+{REWARD_PER_TASK} FIXERCOIN</div>
                    </div>
                    {task.type === "link" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAndComplete(task.id, task.href || "")}
                        className="text-xs"
                      >
                        Open
                      </Button>
                    )}
                    {task.type === "share" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={shareOnX}
                        className="text-xs"
                      >
                        Share
                      </Button>
                    )}
                  </div>
                ))}
                <Separator className="my-4" />
                <Button
                  onClick={handleClaimReward}
                  disabled={completedTasks.size !== QUEST_TASKS.length}
                  className="w-full"
                >
                  {completedTasks.size === QUEST_TASKS.length
                    ? `Claim ${REWARD_PER_TASK * QUEST_TASKS.length} FIXERCOIN`
                    : `Complete all tasks (${completedTasks.size}/${QUEST_TASKS.length})`}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
