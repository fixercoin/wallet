import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  CircleDollarSign,
  Copy,
  IndianRupee,
  MessageSquareMore,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getTokenAccounts } from "@/lib/services/solana-rpc";

// Types
type TradeSide = "buy" | "sell";

interface TradeHistoryEntry {
  id: string;
  type:
    | "request"
    | "release_usdc"
    | "system"
    | "confirm"
    | "timeout"
    | "paid"
    | "message";
  message: string;
  createdAt: number;
  imageUrl?: string;
}

// Formatters
const rateFormatter = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usdcFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usdcFormatterPrecise = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

// Helpers
const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const initialHistory: TradeHistoryEntry[] = [
  {
    id: createId(),
    type: "system",
    message: "Session started.",
    createdAt: Date.now() - 1000 * 60 * 5,
  },
];

const EXPRESS_WALLET_ADDRESS = "Ec72XPYcxYgpRFaNb9b6BHe1XdxtqFjzz2wLRTnx1owA";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qFE1TZMHJY7S4q8YDT3k3dDdHr";

const shortenAddress = (address: string) =>
  address.length <= 10
    ? address
    : `${address.slice(0, 4)}...${address.slice(-4)}`;

// Pricing model (internal only)
const RATE_MIN = 272.25;
const RATE_MAX = 285.5;
const INTERNAL_CHARGE_PER_USDC = 2; // do not show in UI

interface ExpressP2PProps {
  onBack?: () => void;
}

export const ExpressP2P: React.FC<ExpressP2PProps> = ({ onBack }) => {
  const { toast } = useToast();

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    }
  }, [onBack]);

  const [side, setSide] = useState<TradeSide>("buy");
  const [buyPkAmount, setBuyPkAmount] = useState("");
  const [sellUsdcAmount, setSellUsdcAmount] = useState("");
  const [rate, setRate] = useState(279.25);
  const [history, setHistory] = useState<TradeHistoryEntry[]>(initialHistory);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [waitOpen, setWaitOpen] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const [expressUsdcBalance, setExpressUsdcBalance] = useState<number | null>(
    null,
  );
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [orderSummary, setOrderSummary] = useState<{
    side: TradeSide;
    pkrAmount: number;
    usdcAmount: number;
  } | null>(null);

  // Chat form
  const [chatText, setChatText] = useState("");
  const [chatFile, setChatFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const fetchExpressBalance = useCallback(async () => {
    setIsBalanceLoading(true);
    try {
      const accounts = await getTokenAccounts(EXPRESS_WALLET_ADDRESS);
      const usdcAccount = accounts.find(
        (account) =>
          account.mint === USDC_MINT ||
          account.symbol?.toUpperCase() === "USDC",
      );
      const amount = Number(usdcAccount?.balance ?? 0);
      setExpressUsdcBalance(Number.isFinite(amount) ? amount : 0);
    } catch (error) {
      console.error("Error fetching EXPRESS LIVE balance:", error);
      setExpressUsdcBalance((prev) => (prev == null ? 0 : prev));
    } finally {
      setIsBalanceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpressBalance();
    const interval = window.setInterval(() => {
      setRate((current) => {
        const jitter = (Math.random() - 0.5) * 0.6;
        const next = Number((current + jitter).toFixed(2));
        if (next < RATE_MIN) return RATE_MIN;
        if (next > RATE_MAX) return RATE_MAX;
        return next;
      });
      fetchExpressBalance();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [fetchExpressBalance]);

  useEffect(() => {
    if (!waitOpen) return;
    setCountdown(60);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          setWaitOpen(false);
          toast({ title: "Service is not acceptable" });
          logHistory({
            type: "timeout",
            message: "No confirmation within 60s.",
          });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [waitOpen, toast]);

  const usdcBalance = useMemo(
    () => (expressUsdcBalance == null ? 0 : expressUsdcBalance),
    [expressUsdcBalance],
  );

  const shortExpressWallet = useMemo(
    () => shortenAddress(EXPRESS_WALLET_ADDRESS),
    [],
  );

  const handleCopyAddress = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(EXPRESS_WALLET_ADDRESS);
        toast({ title: "Wallet address copied" });
      } else {
        throw new Error("Clipboard unavailable");
      }
    } catch (error) {
      console.error("Copy failed:", error);
      toast({ title: "Unable to copy address" });
    }
  }, [toast]);

  const buyPk = useMemo(() => {
    const n = Number(buyPkAmount.replace(/[^0-9.]/g, ""));
    return !Number.isFinite(n) || n <= 0 ? 0 : n;
  }, [buyPkAmount]);

  const sellUsdc = useMemo(() => {
    const n = Number(sellUsdcAmount.replace(/[^0-9.]/g, ""));
    return !Number.isFinite(n) || n <= 0 ? 0 : n;
  }, [sellUsdcAmount]);

  // Estimates (internal charges applied silently)
  const buyNetUsdc = useMemo(() => {
    if (buyPk <= 0) return 0;
    const effectiveRate = rate + INTERNAL_CHARGE_PER_USDC; // PKR per USDC
    return Number((buyPk / effectiveRate).toFixed(4));
  }, [buyPk, rate]);

  const sellNetPkr = useMemo(() => {
    if (sellUsdc <= 0) return 0;
    const effectiveRate = Math.max(0, rate - INTERNAL_CHARGE_PER_USDC);
    return Number((sellUsdc * effectiveRate).toFixed(2));
  }, [sellUsdc, rate]);

  const logHistory = (entry: Omit<TradeHistoryEntry, "id" | "createdAt">) =>
    setHistory((p) => [
      ...p,
      { id: createId(), createdAt: Date.now(), ...entry },
    ]);

  const onConfirm = () => {
    if (side === "buy") {
      if (buyPk <= 0) {
        toast({ title: "Enter PKR amount" });
        return;
      }
      if (buyNetUsdc > usdcBalance) {
        toast({ title: "Insufficient USDC available" });
        return;
      }
      logHistory({
        type: "request",
        message: `Buy request of ${rateFormatter.format(buyPk)} PKR (~${usdcFormatterPrecise.format(buyNetUsdc)} USDC) sent to ${shortExpressWallet}`,
      });
      toast({ title: "Buyer request sent" });
      logHistory({
        type: "confirm",
        message: `Buy ~${usdcFormatterPrecise.format(buyNetUsdc)} USDC`,
      });
      setOrderSummary({
        side,
        pkrAmount: buyPk,
        usdcAmount: buyNetUsdc,
      });
      setWaitOpen(true);
      return;
    }
    if (sellUsdc <= 0) {
      toast({ title: "Enter USDC amount" });
      return;
    }
    if (sellUsdc > usdcBalance) {
      toast({ title: "Insufficient USDC available" });
      return;
    }
    toast({ title: "Waiting for buyer payment" });
    logHistory({
      type: "confirm",
      message: `Sell ~${rateFormatter.format(sellNetPkr)} PKR`,
    });
    setOrderSummary({
      side,
      pkrAmount: sellNetPkr,
      usdcAmount: sellUsdc,
    });
    setWaitOpen(true);
  };

  const simulateCounterpartyConfirmed = () => {
    setWaitOpen(false);
    logHistory({
      type: "release_usdc",
      message:
        side === "buy" ? "Seller released USDC" : "Buyer confirmed payment",
    });
    toast({ title: side === "buy" ? "USDC released" : "Payment confirmed" });
  };

  const handleSendChat = () => {
    const messageContent = chatText.trim();
    if (!messageContent && !chatFile) return;
    const imageUrl = chatFile ? URL.createObjectURL(chatFile) : undefined;
    logHistory({
      type: "message",
      message: messageContent || (chatFile ? "Proof uploaded" : ""),
      imageUrl,
    });
    setChatText("");
    setChatFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleUploadClick = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const title = side === "buy" ? "Buy" : "Sell";
  const buySummaryLabel = `${usdcFormatterPrecise.format(buyNetUsdc)} USDC`;
  const sellSummaryLabel = rateFormatter.format(sellNetPkr);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 p-4 text-[hsl(var(--foreground))]">
      <div className="mx-auto w-full max-w-md">
        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full border border-[hsl(var(--border))]/70 bg-white/80"
              aria-label="Back"
              onClick={handleBack}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold">{title}</h1>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full border border-[hsl(var(--border))]/70 bg-white/80"
                aria-label="Open chat"
              >
                <MessageSquareMore className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
                Open chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Card */}
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                {side === "buy" ? (
                  <CircleDollarSign className="h-7 w-7 text-blue-600" />
                ) : (
                  <IndianRupee className="h-7 w-7 text-blue-600" />
                )}
              </div>
              <div>
                <p className="text-base text-muted-foreground">
                  {side === "buy" ? "Available USDC" : "Available PKR"}
                </p>
                <p className="text-3xl font-semibold">
                  {side === "buy"
                    ? usdcFormatter.format(usdcBalance)
                    : rateFormatter.format(sellNetPkr)}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Tabs */}
            <Tabs value={side} onValueChange={(v) => setSide(v as TradeSide)}>
              <TabsList className="grid w-full grid-cols-2 bg-transparent">
                <TabsTrigger
                  value="buy"
                  className="justify-start border-b-2 data-[state=active]:border-black data-[state=inactive]:border-transparent"
                >
                  Buy
                </TabsTrigger>
                <TabsTrigger
                  value="sell"
                  className="justify-start border-b-2 data-[state=active]:border-black data-[state=inactive]:border-transparent"
                >
                  Sell
                </TabsTrigger>
              </TabsList>

              {/* Buy */}
              <TabsContent value="buy" className="mt-4 space-y-4">
                <div className="rounded-xl border border-[hsl(var(--border))]/70 bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Express wallet available USDC
                      </p>
                      <p className="text-2xl font-semibold text-foreground">
                        {isBalanceLoading
                          ? "Fetching..."
                          : usdcFormatter.format(usdcBalance)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={handleCopyAddress}
                    >
                      Copy address
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Wallet: {shortExpressWallet}
                  </p>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="Enter amount"
                    value={buyPkAmount}
                    onChange={(e) => setBuyPkAmount(e.target.value)}
                    className="h-14 rounded-xl pr-16 text-lg"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-lg font-semibold text-muted-foreground">
                    PKR
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-muted/20 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    USDC you will receive
                  </span>
                  <span className="text-lg font-semibold text-foreground">
                    {buySummaryLabel}
                  </span>
                </div>
                <Button
                  className="h-14 w-full rounded-2xl text-lg font-semibold"
                  onClick={onConfirm}
                >
                  Confirm
                </Button>
              </TabsContent>

              {/* Sell */}
              <TabsContent value="sell" className="mt-4 space-y-4">
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="Enter amount"
                    value={sellUsdcAmount}
                    onChange={(e) => setSellUsdcAmount(e.target.value)}
                    className="h-14 rounded-xl pr-20 text-lg"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-lg font-semibold text-muted-foreground">
                    USDC
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-muted/20 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    PKR you will receive
                  </span>
                  <span className="text-lg font-semibold text-foreground">
                    {sellSummaryLabel}
                  </span>
                </div>
                <Button
                  className="h-14 w-full rounded-2xl text-lg font-semibold"
                  onClick={onConfirm}
                >
                  Confirm
                </Button>
              </TabsContent>
            </Tabs>

            <div className="pt-1 text-xs text-muted-foreground text-right font-medium">
              1 USDC ~ {rateFormatter.format(rate)}
            </div>
          </CardContent>
        </Card>

        {/* Chat (history) */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Chat</DialogTitle>
              <DialogDescription>
                Send a message or upload payment proof.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 max-h-[50vh] space-y-3 overflow-y-auto pr-1">
              {history.map((h) => {
                const isUserMessage = h.type === "message";
                const isSystem = h.type === "system";
                const timestamp = new Date(h.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const alignment = isUserMessage ? "justify-end" : "justify-start";
                const bubbleClasses = cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                  isUserMessage &&
                    "bg-gradient-to-r from-purple-500 to-blue-500 text-white",
                  isSystem && "bg-muted text-muted-foreground border border-dashed",
                  !isUserMessage && !isSystem &&
                    "bg-white border border-[hsl(var(--border))]/60",
                );
                const metaTextClass = isUserMessage
                  ? "text-white/70"
                  : "text-muted-foreground";
                const typeTextClass = isUserMessage
                  ? "text-white"
                  : "text-muted-foreground";
                const messageTextClass = isUserMessage ? "text-white" : "text-foreground";

                return (
                  <div key={h.id} className={cn("flex", alignment)}>
                    <div className={bubbleClasses}>
                      <div className="mb-1 flex items-center justify-between gap-4 text-xs uppercase tracking-wide">
                        <span className={cn("font-semibold", typeTextClass)}>
                          {h.type.replace("_", " ")}
                        </span>
                        <span className={cn(metaTextClass)}>{timestamp}</span>
                      </div>
                      {h.message && (
                        <div
                          className={cn(
                            "whitespace-pre-wrap break-words text-sm",
                            messageTextClass,
                          )}
                        >
                          {h.message}
                        </div>
                      )}
                      {h.imageUrl && (
                        <img
                          src={h.imageUrl}
                          alt="proof"
                          className={cn(
                            "mt-3 max-h-64 w-full rounded-lg object-cover",
                            isUserMessage
                              ? "border border-white/40"
                              : "border border-[hsl(var(--border))]/60",
                          )}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-end gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => setChatFile(e.target.files?.[0] || null)}
                className="hidden"
                id="express-chat-proof"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full border border-[hsl(var(--border))]/70"
                onClick={handleUploadClick}
                aria-label="Upload proof"
              >
                <Plus className="h-5 w-5" />
              </Button>
              <Input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Type a message"
                className="flex-1"
              />
              <Button onClick={handleSendChat} className="h-12 rounded-xl px-6">
                Send
              </Button>
            </div>
            {chatFile?.name && (
              <p className="mt-1 text-xs text-muted-foreground">
                Attached: {chatFile.name}
              </p>
            )}
          </DialogContent>
        </Dialog>

        {/* Wait modal */}
        <Dialog open={waitOpen} onOpenChange={setWaitOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Waiting for confirmation</DialogTitle>
              <DialogDescription>Expires in {countdown}s.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-between">
              <Button
                onClick={simulateCounterpartyConfirmed}
                className="rounded-xl"
              >
                Mark confirmed
              </Button>
              <span className="text-sm text-muted-foreground">
                {countdown}s
              </span>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
