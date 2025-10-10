import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  History,
  MessageSquareMore,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWallet } from "@/contexts/WalletContext";

type TradeSide = "buy" | "sell";

type PaymentMethodId = "easypaisa" | "firstpay" | "sadapay" | "nayapay";

interface PaymentMethod {
  id: PaymentMethodId;
  label: string;
  description: string;
}

interface TradeHistoryEntry {
  id: string;
  type:
    | "request"
    | "release_pkr"
    | "release_usdc"
    | "system"
    | "confirm"
    | "timeout"
    | "buy_ready"
    | "paid";
  message: string;
  createdAt: number;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "easypaisa",
    label: "Easypaisa",
    description:
      "Manual wallet transfer. Keep the receipt for your records before requesting release.",
  },
  {
    id: "firstpay",
    label: "FirstPay",
    description:
      "Complete a FirstPay wallet transfer and keep confirmation for verification.",
  },
  {
    id: "sadapay",
    label: "SadaPay",
    description:
      "Use SadaPay instant transfer. Double-check the recipient handle before submitting proof.",
  },
  {
    id: "nayapay",
    label: "NayaPay",
    description:
      "Send via NayaPay wallet. Include EXPRESS-P2P in the reference and record the transfer.",
  },
];

const rateFormatter = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdcFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const initialHistory: TradeHistoryEntry[] = [
  {
    id: createId(),
    type: "system",
    message: "Session started. Record key settlement updates in History.",
    createdAt: Date.now() - 1000 * 60 * 5,
  },
];

const RATE_MIN = 272.25;
const RATE_MAX = 285.5;
const RECEIVE_FEE_PER_USDC = 2; // internal charge model only

interface ExpressP2PProps {
  onBack: () => void;
}

export const ExpressP2P: React.FC<ExpressP2PProps> = ({ onBack }) => {
  const { toast } = useToast();
  const { tokens } = useWallet();

  const [side, setSide] = useState<TradeSide>("buy");
  const [buyPkAmount, setBuyPkAmount] = useState("");
  const [sellUsdcAmount, setSellUsdcAmount] = useState("");
  const [rate, setRate] = useState(279.25);
  const [selectedMethod, setSelectedMethod] =
    useState<PaymentMethodId>("easypaisa");
  const [history, setHistory] = useState<TradeHistoryEntry[]>(initialHistory);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Buy flow waiting for seller release
  const [buyWaitOpen, setBuyWaitOpen] = useState(false);
  const [buyCountdown, setBuyCountdown] = useState(60);

  // Sell flow waiting for buyer confirmation
  const [sellWaitOpen, setSellWaitOpen] = useState(false);
  const [sellCountdown, setSellCountdown] = useState(60);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRate((current) => {
        const jitter = (Math.random() - 0.5) * 0.6;
        const next = Number((current + jitter).toFixed(2));
        if (next < RATE_MIN) return RATE_MIN;
        if (next > RATE_MAX) return RATE_MAX;
        return next;
      });
    }, 7000);

    return () => window.clearInterval(interval);
  }, []);

  // Timers
  useEffect(() => {
    if (!buyWaitOpen) return;
    setBuyCountdown(60);
    const id = setInterval(() => {
      setBuyCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          setBuyWaitOpen(false);
          toast({ title: "Service is not acceptable" });
          logHistory({ type: "timeout", message: "Seller did not confirm within 60s." });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyWaitOpen]);

  useEffect(() => {
    if (!sellWaitOpen) return;
    setSellCountdown(60);
    const id = setInterval(() => {
      setSellCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          setSellWaitOpen(false);
          toast({ title: "Service is not acceptable" });
          logHistory({ type: "timeout", message: "Buyer did not confirm within 60s." });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellWaitOpen]);

  const buyPk = useMemo(() => {
    const parsed = Number(buyPkAmount.replace(/[^0-9.]/g, ""));
    return !Number.isFinite(parsed) || parsed <= 0 ? 0 : parsed;
  }, [buyPkAmount]);

  const sellUsdc = useMemo(() => {
    const parsed = Number(sellUsdcAmount.replace(/[^0-9.]/g, ""));
    return !Number.isFinite(parsed) || parsed <= 0 ? 0 : parsed;
  }, [sellUsdcAmount]);

  // Buy: net USDC including charges (no fees UI)
  const buyNetUsdc = useMemo(() => {
    if (buyPk <= 0) return 0;
    const effectiveRate = rate + RECEIVE_FEE_PER_USDC; // PKR per USDC with charges
    return Number((buyPk / effectiveRate).toFixed(4));
  }, [buyPk, rate]);

  // Sell: net PKR including charges (no fees UI) -> reduce per-USDC charge
  const sellNetPkr = useMemo(() => {
    if (sellUsdc <= 0) return 0;
    const effectiveRate = Math.max(0, rate - RECEIVE_FEE_PER_USDC);
    return Number((sellUsdc * effectiveRate).toFixed(2));
  }, [sellUsdc, rate]);

  const method = PAYMENT_METHODS.find((item) => item.id === selectedMethod)!;

  const usdcBalance = useMemo(() => {
    const usdc = tokens?.find((t) => t.symbol === "USDC");
    return Number(usdc?.balance || 0);
  }, [tokens]);

  const logHistory = (entry: Omit<TradeHistoryEntry, "id" | "createdAt">) => {
    setHistory((prev) => [
      ...prev,
      { id: createId(), createdAt: Date.now(), ...entry },
    ]);
  };

  // Buy flow actions
  const handleBuyConfirm = () => {
    if (buyPk <= 0) {
      toast({ title: "Add a PKR amount" });
      return;
    }
    toast({ title: "Buyer request sent" });
    logHistory({
      type: "confirm",
      message: `Buyer started process: ${usdcFormatter.format(buyNetUsdc)} USDC via ${method.label}.`,
    });
  };

  const handleIHavePaid = () => {
    if (buyPk <= 0) {
      toast({ title: "Add a PKR amount" });
      return;
    }
    logHistory({ type: "paid", message: "Buyer marked payment as sent (proof shared)." });
    setBuyWaitOpen(true);
  };

  const simulateSellerReleased = () => {
    setBuyWaitOpen(false);
    toast({ title: "Seller confirmed. USDC released." });
    logHistory({ type: "release_usdc", message: "Seller released USDC." });
  };

  // Sell flow actions
  const handleSellConfirm = () => {
    if (sellUsdc <= 0) {
      toast({ title: "Add a USDC amount" });
      return;
    }
    toast({ title: "Waiting for buyer payment" });
    logHistory({
      type: "confirm",
      message: `Seller started process: expecting ${rateFormatter.format(sellNetPkr)} via ${method.label}.`,
    });
    setSellWaitOpen(true);
  };

  const handleBuyerSentPkr = () => {
    logHistory({ type: "paid", message: "Buyer sent PKR payment to seller." });
  };

  const headerLabel = side === "buy" ? "Buy" : "Sell";

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 text-[hsl(var(--foreground))] p-4">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="rounded-full border border-[hsl(var(--border))]/70 bg-white/80 backdrop-blur"
              aria-label="Chat"
              onClick={() => setHistoryOpen(true)}
            >
              <span>
                <MessageSquareMore className="h-4 w-4" />
              </span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="rounded-full border border-[hsl(var(--border))]/70 bg-white/80 backdrop-blur"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="ml-1">
              <h1 className="text-xl font-semibold">Express P2P Service</h1>
              <p className="text-sm text-muted-foreground">
                Trade USDC against PKR with manual control and coordinated settlement.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700">
              <Sparkles className="mr-1 h-3.5 w-3.5" /> Real-time live
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="rounded-full border border-[hsl(var(--border))]/80 bg-white/80 px-3 text-sm font-medium backdrop-blur"
                >
                  Trade actions
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
                  Quick controls
                </DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                  View history
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Card className="border border-[hsl(var(--border))] bg-white/90 shadow-lg backdrop-blur">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ArrowRightLeft className="h-4 w-4" /> {headerLabel} flow
            </CardTitle>
            <CardDescription>Enter the amount and review estimated conversion.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs value={side} onValueChange={(value) => setSide(value as TradeSide)}>
              <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted/60 p-1">
                <TabsTrigger value="buy" className="rounded-xl text-base">
                  Buy
                </TabsTrigger>
                <TabsTrigger value="sell" className="rounded-xl text-base">
                  Sell
                </TabsTrigger>
              </TabsList>

              {/* BUY */}
              <TabsContent value="buy" className="mt-6 space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Spend</Label>
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-white px-4 py-4 shadow-sm">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>PKR amount</span>
                        <span className="font-semibold">PKR</span>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        value={buyPkAmount}
                        onChange={(e) => setBuyPkAmount(e.target.value)}
                        className="mt-2 border-0 bg-transparent px-0 text-3xl font-semibold tracking-tight focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Receive ≈</Label>
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-white px-4 py-4 shadow-sm">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Estimated USDC</span>
                        <span className="font-semibold">USDC</span>
                      </div>
                      <div className="mt-2 text-3xl font-semibold tracking-tight">
                        {usdcFormatter.format(buyNetUsdc)}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">1 USDC ≈ {rateFormatter.format(rate)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Payment method</Label>
                  <Select value={selectedMethod} onValueChange={(v) => setSelectedMethod(v as PaymentMethodId)}>
                    <SelectTrigger className="rounded-xl border border-[hsl(var(--border))] bg-white/80">
                      <SelectValue placeholder="Select a method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((item) => (
                        <SelectItem value={item.id} key={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-slate-50/70 px-4 py-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Manual settlement with {method.label}</p>
                  <p className="mt-1 leading-relaxed">Share payment proof, then mark "I have paid".</p>
                  <p className="mt-2 text-xs uppercase tracking-wide text-[hsl(var(--primary))]">Actions below.</p>
                </div>

                <div className="grid gap-3 rounded-2xl border border-[hsl(var(--border))] bg-white/80 px-4 py-4 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Wallet USDC available</span>
                    <span className="font-semibold text-foreground">{usdcFormatter.format(usdcBalance)}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={handleBuyConfirm} className="rounded-xl sm:w-auto">
                    Confirm
                  </Button>
                  <Button onClick={handleIHavePaid} variant="secondary" className="rounded-xl sm:w-auto">
                    I have paid
                  </Button>
                </div>
              </TabsContent>

              {/* SELL */}
              <TabsContent value="sell" className="mt-6 space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Send</Label>
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-white px-4 py-4 shadow-sm">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>USDC amount</span>
                        <span className="font-semibold">USDC</span>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        value={sellUsdcAmount}
                        onChange={(e) => setSellUsdcAmount(e.target.value)}
                        className="mt-2 border-0 bg-transparent px-0 text-3xl font-semibold tracking-tight focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Receive ≈</Label>
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-white px-4 py-4 shadow-sm">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Estimated PKR</span>
                        <span className="font-semibold">PKR</span>
                      </div>
                      <div className="mt-2 text-3xl font-semibold tracking-tight">
                        {rateFormatter.format(sellNetPkr)}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">1 USDC ≈ {rateFormatter.format(rate)}</p>
                  </div>
                </div>

                <div className="grid gap-3 rounded-2xl border border-[hsl(var(--border))] bg-white/80 px-4 py-4 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Wallet USDC available</span>
                    <span className="font-semibold text-foreground">{usdcFormatter.format(usdcBalance)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Payment method expected</Label>
                  <Select value={selectedMethod} onValueChange={(v) => setSelectedMethod(v as PaymentMethodId)}>
                    <SelectTrigger className="rounded-xl border border-[hsl(var(--border))] bg-white/80">
                      <SelectValue placeholder="Select a method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((item) => (
                        <SelectItem value={item.id} key={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={handleSellConfirm} className="rounded-xl sm:w-auto">
                    Confirm
                  </Button>
                  <Button onClick={handleBuyerSentPkr} variant="secondary" className="rounded-xl sm:w-auto">
                    Send PKR payment to seller
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* History */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Trade history</DialogTitle>
              <DialogDescription>A chronological record of key actions.</DialogDescription>
            </DialogHeader>
            <div className="mt-2 max-h-[60vh] space-y-3 overflow-y-auto">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No history yet.</p>
              ) : (
                history.map((h) => (
                  <div key={h.id} className="rounded-xl border border-[hsl(var(--border))] bg-white/80 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge className="border-slate-200 bg-white text-slate-600">{h.type.replace("_", " ")}</Badge>
                        <span className="text-foreground">{h.message}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Buy wait modal */}
        <Dialog open={buyWaitOpen} onOpenChange={setBuyWaitOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Waiting for seller confirmation</DialogTitle>
              <DialogDescription>Expires in {buyCountdown}s.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-between">
              <Button onClick={simulateSellerReleased} className="rounded-xl">
                Seller released
              </Button>
              <span className="text-sm text-muted-foreground">{buyCountdown}s</span>
            </div>
          </DialogContent>
        </Dialog>

        {/* Sell wait modal */}
        <Dialog open={sellWaitOpen} onOpenChange={setSellWaitOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Waiting for buyer confirmation</DialogTitle>
              <DialogDescription>Expires in {sellCountdown}s.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-between">
              <Button onClick={() => setSellWaitOpen(false)} className="rounded-xl">
                Confirm received
              </Button>
              <span className="text-sm text-muted-foreground">{sellCountdown}s</span>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
