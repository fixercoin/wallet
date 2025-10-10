import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  CircleDollarSign,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWallet } from "@/contexts/WalletContext";

// Types
 type TradeSide = "buy" | "sell";

interface TradeHistoryEntry {
  id: string;
  type: "request" | "release_usdc" | "system" | "confirm" | "timeout" | "paid";
  message: string;
  createdAt: number;
}

// Formatters
const rateFormatter = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdcFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdcFormatterPrecise = new Intl.NumberFormat("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

// Helpers
const createId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);

const initialHistory: TradeHistoryEntry[] = [
  { id: createId(), type: "system", message: "Session started.", createdAt: Date.now() - 1000 * 60 * 5 },
];

// Pricing model (internal only)
const RATE_MIN = 272.25;
const RATE_MAX = 285.5;
const INTERNAL_CHARGE_PER_USDC = 2; // do not show in UI

interface ExpressP2PProps { onBack?: () => void }

export const ExpressP2P: React.FC<ExpressP2PProps> = () => {
  const { toast } = useToast();
  const { tokens } = useWallet();

  const [side, setSide] = useState<TradeSide>("buy");
  const [buyPkAmount, setBuyPkAmount] = useState("");
  const [sellUsdcAmount, setSellUsdcAmount] = useState("");
  const [rate, setRate] = useState(279.25);
  const [history, setHistory] = useState<TradeHistoryEntry[]>(initialHistory);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [waitOpen, setWaitOpen] = useState(false);
  const [countdown, setCountdown] = useState(60);

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

  useEffect(() => {
    if (!waitOpen) return;
    setCountdown(60);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          setWaitOpen(false);
          toast({ title: "Service is not acceptable" });
          logHistory({ type: "timeout", message: "No confirmation within 60s." });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitOpen]);

  const usdcBalance = useMemo(() => {
    const usdc = tokens?.find((t) => t.symbol === "USDC");
    return Number(usdc?.balance || 0);
  }, [tokens]);

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

  const logHistory = (entry: Omit<TradeHistoryEntry, "id" | "createdAt">) => setHistory((p) => [...p, { id: createId(), createdAt: Date.now(), ...entry }]);

  const onConfirm = () => {
    if (side === "buy") {
      if (buyPk <= 0) { toast({ title: "Enter PKR amount" }); return; }
      toast({ title: "Buyer request sent" });
      logHistory({ type: "confirm", message: `Buy ~${usdcFormatterPrecise.format(buyNetUsdc)} USDC` });
      setWaitOpen(true);
      return;
    }
    if (sellUsdc <= 0) { toast({ title: "Enter USDC amount" }); return; }
    toast({ title: "Waiting for buyer payment" });
    logHistory({ type: "confirm", message: `Sell ~${rateFormatter.format(sellNetPkr)} PKR` });
    setWaitOpen(true);
  };

  const simulateCounterpartyConfirmed = () => {
    setWaitOpen(false);
    logHistory({ type: "release_usdc", message: side === "buy" ? "Seller released USDC" : "Buyer confirmed payment" });
    toast({ title: side === "buy" ? "USDC released" : "Payment confirmed" });
  };

  const title = side === "buy" ? "Buy" : "Sell";
  const estLabel = side === "buy" ? `Est. ${usdcFormatterPrecise.format(buyNetUsdc)} USDC` : `Est. ${rateFormatter.format(sellNetPkr)}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 p-4 text-[hsl(var(--foreground))]">
      <div className="mx-auto w-full max-w-md">
        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold">{title}</h1>
          <Button variant="ghost" size="icon" className="rounded-full border border-[hsl(var(--border))]/70 bg-white/80" aria-label="Open chat" onClick={() => setHistoryOpen(true)}>
            <MessageSquareMore className="h-5 w-5" />
          </Button>
        </div>

        {/* Card */}
        <Card className="border border-[hsl(var(--border))] bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <CircleDollarSign className="h-7 w-7 text-blue-600" />
              </div>
              <div>
                <p className="text-base text-muted-foreground">Available USDC</p>
                <p className="text-3xl font-semibold">{usdcFormatter.format(usdcBalance)}</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Tabs */}
            <Tabs value={side} onValueChange={(v) => setSide(v as TradeSide)}>
              <TabsList className="grid w-full grid-cols-2 bg-transparent">
                <TabsTrigger value="buy" className="justify-start border-b-2 data-[state=active]:border-black data-[state=inactive]:border-transparent">
                  Buy
                </TabsTrigger>
                <TabsTrigger value="sell" className="justify-start border-b-2 data-[state=active]:border-black data-[state=inactive]:border-transparent">
                  Sell
                </TabsTrigger>
              </TabsList>

              {/* Buy */}
              <TabsContent value="buy" className="mt-4 space-y-4">
                <div className="relative">
                  <Input type="number" inputMode="decimal" placeholder="Enter amount" value={buyPkAmount} onChange={(e) => setBuyPkAmount(e.target.value)} className="h-14 rounded-xl pr-16 text-lg" />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-lg font-semibold text-muted-foreground">PKR</span>
                </div>
                <p className="text-lg text-muted-foreground">{estLabel}</p>
                <Button className="h-14 w-full rounded-2xl text-lg font-semibold" onClick={onConfirm}>Confirm</Button>
              </TabsContent>

              {/* Sell */}
              <TabsContent value="sell" className="mt-4 space-y-4">
                <div className="relative">
                  <Input type="number" inputMode="decimal" placeholder="Enter amount" value={sellUsdcAmount} onChange={(e) => setSellUsdcAmount(e.target.value)} className="h-14 rounded-xl pr-20 text-lg" />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-lg font-semibold text-muted-foreground">USDC</span>
                </div>
                <p className="text-lg text-muted-foreground">{estLabel}</p>
                <Button className="h-14 w-full rounded-2xl text-lg font-semibold" onClick={onConfirm}>Confirm</Button>
              </TabsContent>
            </Tabs>

            <div className="pt-1 text-xs text-muted-foreground">1 USDC ≈ {rateFormatter.format(rate)}</div>
          </CardContent>
        </Card>

        {/* History (chat) */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Trade history</DialogTitle>
              <DialogDescription>Important actions in this session.</DialogDescription>
            </DialogHeader>
            <div className="mt-2 space-y-2">
              {history.map((h) => (
                <div key={h.id} className="rounded-lg border p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{h.type.replace("_", " ")}</span>
                    <span className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="text-foreground">{h.message}</div>
                </div>
              ))}
            </div>
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
              <Button onClick={simulateCounterpartyConfirmed} className="rounded-xl">Mark confirmed</Button>
              <span className="text-sm text-muted-foreground">{countdown}s</span>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
