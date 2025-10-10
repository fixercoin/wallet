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
  DropdownMenuSeparator,
  DropdownMenuShortcut,
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

type TradeSide = "buy" | "sell";

type PaymentMethodId = "easypaisa" | "firstpay" | "sadapay" | "nayapay";

interface PaymentMethod {
  id: PaymentMethodId;
  label: string;
  description: string;
}

interface TradeHistoryEntry {
  id: string;
  type: "request" | "release_pkr" | "release_usdc" | "system";
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
    message: "Session started. Record important settlement updates in History.",
    createdAt: Date.now() - 1000 * 60 * 5,
  },
];

const RATE_MIN = 272.25;
const RATE_MAX = 285.5;
const RECEIVE_FEE_PER_USDC = 2;
const RELEASE_USDC_BASE_FEE = 100;
const RELEASE_USDC_SERVICE_FEE = 2;

interface ExpressP2PProps {
  onBack: () => void;
}

export const ExpressP2P: React.FC<ExpressP2PProps> = ({ onBack }) => {
  const { toast } = useToast();
  const [side, setSide] = useState<TradeSide>("buy");
  const [pkAmount, setPkAmount] = useState("");
  const [rate, setRate] = useState(279.25);
  const [selectedMethod, setSelectedMethod] =
    useState<PaymentMethodId>("easypaisa");
  const [history, setHistory] = useState<TradeHistoryEntry[]>(initialHistory);
  const [historyOpen, setHistoryOpen] = useState(false);

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

  const numericPk = useMemo(() => {
    const parsed = Number(pkAmount.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(parsed) || parsed <= 0) {
      return 0;
    }
    return parsed;
  }, [pkAmount]);

  const usdcValue = useMemo(() => {
    if (numericPk <= 0) {
      return 0;
    }
    return Number((numericPk / rate).toFixed(4));
  }, [numericPk, rate]);

  const receiveFeeTotal = Number((usdcValue * RECEIVE_FEE_PER_USDC).toFixed(2));
  const totalSpendWithFees = numericPk + receiveFeeTotal;
  const releaseUsdcTotalFee = RELEASE_USDC_BASE_FEE + RELEASE_USDC_SERVICE_FEE;

  const method = PAYMENT_METHODS.find((item) => item.id === selectedMethod)!;

  const logHistory = (entry: Omit<TradeHistoryEntry, "id" | "createdAt">) => {
    setHistory((prev) => [
      ...prev,
      { id: createId(), createdAt: Date.now(), ...entry },
    ]);
  };

  const handleRequest = () => {
    if (numericPk <= 0) {
      toast({
        title: "Add a PKR amount",
        description: "Enter a PKR spend amount before requesting the trade.",
      });
      return;
    }

    const action = side === "buy" ? "Buy" : "Sell";
    toast({
      title: `${action} request created`,
      description: `${action} ${usdcFormatter.format(usdcValue)} USDC using ${method.label}.`,
    });
    logHistory({
      type: "request",
      message: `${action} request submitted for ${usdcFormatter.format(usdcValue)} USDC via ${method.label}. Awaiting approval.`,
    });
  };

  const handleReleasePayment = () => {
    toast({
      title: "PKR release logged",
      description:
        "PKR payment marked as sent. Counterparty will verify before releasing USDC.",
    });
    logHistory({
      type: "release_pkr",
      message:
        "PKR payment released. Waiting for counterparty confirmation to proceed.",
    });
  };

  const handleReleaseUsdc = () => {
    toast({
      title: "USDC escrow released",
      description: `USDC released with PKR ${RELEASE_USDC_BASE_FEE} extra and PKR ${RELEASE_USDC_SERVICE_FEE} service fees accounted for.`,
    });
    logHistory({
      type: "release_usdc",
      message: "Escrow marked as released. Session closed successfully.",
    });
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
                Trade USDC against PKR with manual control, escrow safety, and
                coordinated settlement.
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
                <DropdownMenuItem
                  onSelect={handleRequest}
                  className="flex flex-col items-start gap-1 py-2 text-sm"
                >
                  <span>Request settlement setup</span>
                  <span className="text-xs text-muted-foreground">
                    Submit the {side === "buy" ? "buy" : "sell"} request using {method.label}.
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={handleReleasePayment}
                  className="flex flex-col items-start gap-1 py-2 text-sm"
                >
                  <span>Release PKR payment</span>
                  <span className="text-xs text-muted-foreground">
                    Log the manual PKR transfer before asking for USDC release.
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={handleReleaseUsdc}
                  className="flex flex-col items-start gap-1 py-2 text-sm"
                >
                  <span>Release USDC escrow</span>
                  <span className="text-xs text-muted-foreground">
                    Includes PKR {RELEASE_USDC_BASE_FEE} extra fee + PKR {RELEASE_USDC_SERVICE_FEE} service fee.
                  </span>
                  <DropdownMenuShortcut>
                    PKR {releaseUsdcTotalFee}
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setHistoryOpen(true)}
                  className="flex items-center gap-2 py-2 text-sm"
                >
                  <History className="h-4 w-4" />
                  <span>View history</span>
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
            <CardDescription>
              Enter the amount, review live conversion, and keep currency fixed
              to USDC for settlements.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs
              value={side}
              onValueChange={(value) => setSide(value as TradeSide)}
            >
              <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted/60 p-1">
                <TabsTrigger value="buy" className="rounded-xl text-base">
                  Buy
                </TabsTrigger>
                <TabsTrigger value="sell" className="rounded-xl text-base">
                  Sell
                </TabsTrigger>
              </TabsList>
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
                        value={pkAmount}
                        onChange={(event) => setPkAmount(event.target.value)}
                        className="mt-2 border-0 bg-transparent px-0 text-3xl font-semibold tracking-tight focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Receive ≈</Label>
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-white px-4 py-4 shadow-sm">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>USDC amount (before fees)</span>
                        <span className="font-semibold">USDC</span>
                      </div>
                      <div className="mt-2 text-3xl font-semibold tracking-tight">
                        {usdcFormatter.format(usdcValue)}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      1 USDC ≈ {rateFormatter.format(rate)} · Receiving fee {rateFormatter.format(receiveFeeTotal)} (
                      {RECEIVE_FEE_PER_USDC} PKR per USDC)
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    Payment method
                  </Label>
                  <Select
                    value={selectedMethod}
                    onValueChange={(value) =>
                      setSelectedMethod(value as PaymentMethodId)
                    }
                  >
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
                  <p className="font-medium text-foreground">
                    Manual settlement with {method.label}
                  </p>
                  <p className="mt-1 leading-relaxed">{method.description}</p>
                  <p className="mt-2 text-xs uppercase tracking-wide text-[hsl(var(--primary))]">
                    Actions available from the top-right menu.
                  </p>
                </div>

                <div className="grid gap-3 rounded-2xl border border-[hsl(var(--border))] bg-white/80 px-4 py-4 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>PKR spend</span>
                    <span className="font-semibold text-foreground">
                      {numericPk.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Receiving fee</span>
                    <span className="font-semibold text-foreground">
                      {rateFormatter.format(receiveFeeTotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Total with fees</span>
                    <span className="font-semibold text-foreground">
                      {rateFormatter.format(totalSpendWithFees)}
                    </span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="sell" className="mt-6 space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Receive</Label>
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-white px-4 py-4 shadow-sm">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>PKR amount</span>
                        <span className="font-semibold">PKR</span>
                      </div>
                      <div className="mt-2 text-3xl font-semibold tracking-tight">
                        {numericPk.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Send</Label>
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-white px-4 py-4 shadow-sm">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>USDC to release</span>
                        <span className="font-semibold">USDC</span>
                      </div>
                      <div className="mt-2 text-3xl font-semibold tracking-tight">
                        {usdcFormatter.format(usdcValue)}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Releasing USDC adds PKR {RELEASE_USDC_BASE_FEE} extra + PKR {RELEASE_USDC_SERVICE_FEE} service fee per settlement.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    Payment method expected
                  </Label>
                  <Select
                    value={selectedMethod}
                    onValueChange={(value) =>
                      setSelectedMethod(value as PaymentMethodId)
                    }
                  >
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

                <div className="grid gap-3 rounded-2xl border border-[hsl(var(--border))] bg-white/80 px-4 py-4 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>USDC to release</span>
                    <span className="font-semibold text-foreground">
                      {usdcFormatter.format(usdcValue)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Estimated PKR payout</span>
                    <span className="font-semibold text-foreground">
                      {rateFormatter.format(numericPk)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Release fees</span>
                    <span className="font-semibold text-foreground">
                      PKR {releaseUsdcTotalFee}
                    </span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Trade history</DialogTitle>
              <DialogDescription>
                A chronological record of key actions in this session.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 max-h-[60vh] space-y-3 overflow-y-auto">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No history yet.</p>
              ) : (
                history.map((h) => (
                  <div
                    key={h.id}
                    className="rounded-xl border border-[hsl(var(--border))] bg-white/80 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge
                          className={
                            h.type === "request"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : h.type === "release_pkr"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : h.type === "release_usdc"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-white text-slate-600"
                          }
                        >
                          {h.type.replace("_", " ")}
                        </Badge>
                        <span className="text-foreground">{h.message}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
