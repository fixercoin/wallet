import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, RefreshCw, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type TradeSide = "buy" | "sell";
type OrderStatus = "pendingApproval" | "approved" | "released";

interface ExpressP2PProps {
  onBack: () => void;
}

interface PaymentMethod {
  id: string;
  name: string;
  account: string;
  instructions: string;
  createdAt: number;
}

interface TradeOrder {
  id: string;
  side: TradeSide;
  amountUsdc: number;
  status: OrderStatus;
  counterparty: string;
  createdAt: number;
  statusUpdatedAt: number;
  rate: number;
}

interface MarketActivity {
  id: string;
  side: TradeSide;
  amountUsdc: number;
  rate: number;
  createdAt: number;
}

const RATE_LIMITS = { min: 272.5, max: 284.5 } as const;
const DEFAULT_LIMITS: Record<TradeSide, { min: number; max: number }> = {
  buy: { min: 50, max: 5000 },
  sell: { min: 100, max: 10000 },
};

const usdcFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pkrFormatter = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const statusStyles: Record<OrderStatus, { label: string; className: string }> = {
  pendingApproval: {
    label: "Pending approval",
    className: "bg-amber-100 text-amber-700 border-transparent",
  },
  approved: {
    label: "Approved",
    className: "bg-blue-100 text-blue-700 border-transparent",
  },
  released: {
    label: "Released",
    className: "bg-emerald-100 text-emerald-700 border-transparent",
  },
};

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const toPkr = (amountUsdc: number, rate: number) => amountUsdc * rate;

export const ExpressP2P: React.FC<ExpressP2PProps> = ({ onBack }) => {
  const { toast } = useToast();
  const [rate, setRate] = useState(278.4);
  const rateRef = useRef(rate);
  const [tradeSide, setTradeSide] = useState<TradeSide>("buy");
  const [tradeAmount, setTradeAmount] = useState<string>("");
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [methodError, setMethodError] = useState<string | null>(null);
  const [methodForm, setMethodForm] = useState({
    name: "",
    account: "",
    instructions: "",
  });
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(() => [
    {
      id: createId(),
      name: "Meezan Bank Transfer",
      account: "IBAN PK12 MZNB 0000 1234 5678",
      instructions:
        "Log in to your Meezan Bank account and initiate a manual fund transfer. Share the transaction receipt inside the chat before requesting release.",
      createdAt: Date.now() - 1000 * 60 * 15,
    },
  ]);
  const [orders, setOrders] = useState<TradeOrder[]>(() => [
    {
      id: createId(),
      side: "buy",
      amountUsdc: 250,
      status: "pendingApproval",
      counterparty: "Counterparty 4921",
      createdAt: Date.now() - 1000 * 60 * 6,
      statusUpdatedAt: Date.now() - 1000 * 60 * 6,
      rate: 278.12,
    },
    {
      id: createId(),
      side: "sell",
      amountUsdc: 640,
      status: "approved",
      counterparty: "Counterparty 7315",
      createdAt: Date.now() - 1000 * 60 * 14,
      statusUpdatedAt: Date.now() - 1000 * 60 * 3,
      rate: 278.64,
    },
  ]);
  const [marketFeed, setMarketFeed] = useState<MarketActivity[]>(() => [
    {
      id: createId(),
      side: "buy",
      amountUsdc: 180,
      rate: 278.22,
      createdAt: Date.now() - 1000 * 45,
    },
    {
      id: createId(),
      side: "sell",
      amountUsdc: 420,
      rate: 278.78,
      createdAt: Date.now() - 1000 * 120,
    },
  ]);

  rateRef.current = rate;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRate((previous) => {
        const jitter = (Math.random() - 0.5) * 0.6;
        const next = Number((previous + jitter).toFixed(2));
        return Math.min(RATE_LIMITS.max, Math.max(RATE_LIMITS.min, next));
      });
    }, 6000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMarketFeed((existing) => {
        const amountUsdc = Math.round((100 + Math.random() * 900) * 100) / 100;
        const side: TradeSide = Math.random() > 0.5 ? "buy" : "sell";
        const entry: MarketActivity = {
          id: createId(),
          side,
          amountUsdc,
          rate: Number(rateRef.current.toFixed(2)),
          createdAt: Date.now(),
        };
        return [entry, ...existing].slice(0, 6);
      });
    }, 9000);

    return () => window.clearInterval(interval);
  }, []);

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => b.createdAt - a.createdAt),
    [orders],
  );

  const outstandingVolumes = useMemo(() => {
    const pending = orders
      .filter((order) => order.status !== "released")
      .reduce(
        (acc, order) => {
          acc.usdc += order.amountUsdc;
          acc.pkr += toPkr(order.amountUsdc, order.rate);
          return acc;
        },
        { usdc: 0, pkr: 0 },
      );
    return {
      pendingUsdc: pending.usdc,
      pendingPkr: pending.pkr,
      totalOrders: orders.length,
    };
  }, [orders]);

  const currentAmount = Number(tradeAmount);
  const currentAmountValid = !Number.isNaN(currentAmount) && currentAmount > 0;
  const currentPkrValue = currentAmountValid
    ? toPkr(currentAmount, rate)
    : 0;

  const handleMethodSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = methodForm.name.trim();
    const trimmedAccount = methodForm.account.trim();
    const trimmedInstructions = methodForm.instructions.trim();

    if (!trimmedName || !trimmedAccount) {
      setMethodError("Provide a name and account details to add the payment method manually.");
      return;
    }

    const next: PaymentMethod = {
      id: createId(),
      name: trimmedName,
      account: trimmedAccount,
      instructions: trimmedInstructions,
      createdAt: Date.now(),
    };

    setPaymentMethods((existing) => [next, ...existing]);
    setMethodForm({ name: "", account: "", instructions: "" });
    setMethodError(null);

    toast({
      title: "Payment method added",
      description: `${trimmedName} is now available for manual settlements.`,
    });
  };

  const handleTradeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericAmount = Number(tradeAmount);
    const { min, max } = DEFAULT_LIMITS[tradeSide];

    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setTradeError("Enter a positive USDC amount.");
      return;
    }

    if (numericAmount < min || numericAmount > max) {
      setTradeError(
        `Amount must be between ${usdcFormatter.format(min)} and ${usdcFormatter.format(max)} USDC for a ${tradeSide} order.`,
      );
      return;
    }

    const order: TradeOrder = {
      id: createId(),
      side: tradeSide,
      amountUsdc: numericAmount,
      status: "pendingApproval",
      counterparty: `Counterparty ${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: Date.now(),
      statusUpdatedAt: Date.now(),
      rate,
    };

    setOrders((existing) => [order, ...existing]);
    setTradeAmount("");
    setTradeError(null);
    toast({
      title: tradeSide === "buy" ? "Buy order submitted" : "Sell order submitted",
      description: `Waiting for counterparty approval of ${usdcFormatter.format(numericAmount)} USDC.`,
    });
  };

  const handleApprove = (orderId: string) => {
    setOrders((existing) =>
      existing.map((order) =>
        order.id === orderId
          ? { ...order, status: "approved", statusUpdatedAt: Date.now() }
          : order,
      ),
    );
    toast({
      title: "Order approved",
      description: "USDC escrow approved. Counterparty may now release PKR.",
    });
  };

  const handleRelease = (orderId: string) => {
    setOrders((existing) =>
      existing.map((order) =>
        order.id === orderId
          ? { ...order, status: "released", statusUpdatedAt: Date.now() }
          : order,
      ),
    );
    toast({
      title: "PKR released",
      description: "PKR funds released to counterparty successfully.",
    });
  };

  const renderTradeContent = (side: TradeSide) => {
    const { min, max } = DEFAULT_LIMITS[side];

    return (
      <form onSubmit={handleTradeSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor={`${side}-amount`}>Amount in USDC</Label>
          <Input
            id={`${side}-amount`}
            type="number"
            min={min}
            max={max}
            step="0.01"
            inputMode="decimal"
            placeholder={`${min} - ${max}`}
            value={tradeSide === side ? tradeAmount : ""}
            onChange={(event) => {
              if (tradeSide === side) {
                setTradeAmount(event.target.value);
              }
            }}
          />
        </div>

        <div className="grid gap-3 rounded-md border border-dashed border-[hsl(var(--border))] bg-white/60 p-4 text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Live settlement rate</span>
            <span className="flex items-center gap-1 font-medium text-foreground">
              {rate.toFixed(2)} PKR
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Estimated payout</span>
            <span className="font-semibold text-foreground">
              {currentAmountValid && tradeSide === side
                ? pkrFormatter.format(Math.round(currentPkrValue))
                : pkrFormatter.format(Math.round(toPkr(min, rate)))}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>Limits</span>
            <span>{`${usdcFormatter.format(min)} - ${usdcFormatter.format(max)} USDC`}</span>
          </div>
        </div>

        {tradeError && tradeSide === side ? (
          <p className="text-sm font-medium text-destructive">{tradeError}</p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            Manual settlements only — currency fixed to USDC against PKR release.
          </span>
          <Button type="submit" className="w-full sm:w-auto">
            {side === "buy" ? "Place buy order" : "Place sell order"}
          </Button>
        </div>
      </form>
    );
  };

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))] p-4">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Express P2P Service</h1>
              <p className="text-sm text-muted-foreground">
                Real-time trades between USDC and Pakistani Rupee with manual payment methods.
              </p>
            </div>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
            <Zap className="mr-1 h-3.5 w-3.5" /> Live service
          </Badge>
        </div>

        <Card className="border border-[hsl(var(--border))] bg-white/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Settlement overview</CardTitle>
            <CardDescription>
              Track current appetite and stay aligned with live conversion updates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-[hsl(var(--border))] bg-white p-4">
                <p className="text-xs text-muted-foreground">USDC → PKR live rate</p>
                <p className="mt-2 text-2xl font-semibold">{rate.toFixed(2)} PKR</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Updates every few seconds within regulated corridor.
                </p>
              </div>
              <div className="rounded-lg border border-[hsl(var(--border))] bg-white p-4">
                <p className="text-xs text-muted-foreground">Order limits</p>
                <p className="mt-2 text-sm font-semibold">Buy: {`${usdcFormatter.format(DEFAULT_LIMITS.buy.min)} - ${usdcFormatter.format(DEFAULT_LIMITS.buy.max)} USDC`}</p>
                <p className="text-sm font-semibold">Sell: {`${usdcFormatter.format(DEFAULT_LIMITS.sell.min)} - ${usdcFormatter.format(DEFAULT_LIMITS.sell.max)} USDC`}</p>
                <p className="mt-1 text-xs text-muted-foreground">Limits enforced on every submission.</p>
              </div>
              <div className="rounded-lg border border-[hsl(var(--border))] bg-white p-4">
                <p className="text-xs text-muted-foreground">Outstanding volume</p>
                <p className="mt-2 text-2xl font-semibold">
                  {usdcFormatter.format(outstandingVolumes.pendingUsdc)} USDC
                </p>
                <p className="text-xs text-muted-foreground">
                  ≈ {pkrFormatter.format(Math.round(outstandingVolumes.pendingPkr))} across {outstandingVolumes.totalOrders} orders
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[hsl(var(--border))] bg-white/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Manual payment methods</CardTitle>
            <CardDescription>
              Add instructions for every counterparty — no automated rails, only manual settlement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <form className="space-y-4" onSubmit={handleMethodSubmit} noValidate>
                <div className="space-y-2">
                  <Label htmlFor="method-name">Method name</Label>
                  <Input
                    id="method-name"
                    placeholder="e.g. Meezan Bank manual transfer"
                    value={methodForm.name}
                    onChange={(event) =>
                      setMethodForm((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="method-account">Account / reference details</Label>
                  <Input
                    id="method-account"
                    placeholder="Account number, IBAN or wallet address"
                    value={methodForm.account}
                    onChange={(event) =>
                      setMethodForm((previous) => ({
                        ...previous,
                        account: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="method-instructions">Manual instructions</Label>
                  <Textarea
                    id="method-instructions"
                    placeholder="Share step-by-step instructions for the counterparty."
                    value={methodForm.instructions}
                    onChange={(event) =>
                      setMethodForm((previous) => ({
                        ...previous,
                        instructions: event.target.value,
                      }))
                    }
                  />
                </div>
                {methodError ? (
                  <p className="text-sm font-medium text-destructive">{methodError}</p>
                ) : null}
                <Button type="submit" className="w-full">
                  Add payment method manually
                </Button>
              </form>

              <div className="space-y-3">
                {paymentMethods.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[hsl(var(--border))] bg-white/60 p-6 text-sm text-muted-foreground">
                    No payment methods yet. Add your first manual settlement instructions.
                  </div>
                ) : (
                  paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className="rounded-lg border border-[hsl(var(--border))] bg-white/70 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold">{method.name}</h3>
                        <span className="text-xs text-muted-foreground">
                          Added {new Date(method.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {method.account}
                      </p>
                      {method.instructions ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {method.instructions}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[hsl(var(--border))] bg-white/80 shadow-sm">
          <CardHeader className="flex flex-col gap-2">
            <CardTitle className="text-lg">Create trade</CardTitle>
            <CardDescription>
              Choose buy or sell and submit the order with fixed USDC currency.
            </CardDescription>
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Every order requires manual approval before PKR release.
            </div>
          </CardHeader>
          <CardContent>
            <Tabs
              value={tradeSide}
              onValueChange={(value) => {
                setTradeSide(value as TradeSide);
                setTradeAmount("");
                setTradeError(null);
              }}
            >
              <TabsList className="mb-4">
                <TabsTrigger value="buy">Buy USDC</TabsTrigger>
                <TabsTrigger value="sell">Sell USDC</TabsTrigger>
              </TabsList>
              <TabsContent value="buy">{renderTradeContent("buy")}</TabsContent>
              <TabsContent value="sell">{renderTradeContent("sell")}</TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="border border-[hsl(var(--border))] bg-white/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Approvals and releases</CardTitle>
            <CardDescription>
              Approve USDC escrow first, then release PKR once settlement is confirmed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sortedOrders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[hsl(var(--border))] bg-white/60 p-6 text-sm text-muted-foreground">
                No active orders. Submit a buy or sell order to start the approval flow.
              </div>
            ) : (
              sortedOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col gap-3 rounded-lg border border-[hsl(var(--border))] bg-white/70 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={statusStyles[order.status].className}>
                        {statusStyles[order.status].label}
                      </Badge>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        {order.side === "buy" ? "Buy" : "Sell"}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {usdcFormatter.format(order.amountUsdc)} USDC · {pkrFormatter.format(Math.round(toPkr(order.amountUsdc, order.rate)))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Counterparty {order.counterparty} · {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 md:flex-row">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={order.status !== "pendingApproval"}
                      onClick={() => handleApprove(order.id)}
                    >
                      Approve escrow
                    </Button>
                    <Button
                      size="sm"
                      className="dash-btn"
                      disabled={order.status !== "approved"}
                      onClick={() => handleRelease(order.id)}
                    >
                      Release PKR
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border border-[hsl(var(--border))] bg-white/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Real-time service feed</CardTitle>
            <CardDescription>
              Latest fulfilled interests across the marketplace to gauge liquidity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {marketFeed.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[hsl(var(--border))] bg-white/60 p-6 text-sm text-muted-foreground">
                Feed will populate as trades start flowing.
              </div>
            ) : (
              marketFeed.map((trade) => (
                <div
                  key={trade.id}
                  className="flex flex-col gap-1 rounded-lg border border-[hsl(var(--border))] bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {trade.side === "buy" ? "Buy" : "Sell"} interest · {usdcFormatter.format(trade.amountUsdc)} USDC
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Spot rate {trade.rate.toFixed(2)} PKR — published {new Date(trade.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Manual release on completion
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
