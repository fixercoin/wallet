import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  MessageSquareMore,
  MoreHorizontal,
  ShieldCheck,
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDurableRoom } from "@/hooks/useDurableRoom";
import { createOrder } from "@/lib/p2p";

type TradeSide = "buy" | "sell";

type PaymentMethodId = "easypaisa" | "firstpay" | "sadapay" | "nayapay";

interface PaymentMethod {
  id: PaymentMethodId;
  label: string;
  description: string;
}

interface ChatMessage {
  id: string;
  sender: "you" | "counterparty" | "system";
  content: string;
  createdAt: number;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "easypaisa",
    label: "Easypaisa",
    description:
      "Manual wallet transfer. Share the payment receipt in chat before requesting release.",
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

const initialMessages: ChatMessage[] = [
  {
    id: createId(),
    sender: "system",
    content:
      "Express P2P room opened. Keep all settlement updates recorded here.",
    createdAt: Date.now() - 1000 * 60 * 9,
  },
  {
    id: createId(),
    sender: "counterparty",
    content:
      "Hello! Please share the PKR transfer receipt once it is submitted.",
    createdAt: Date.now() - 1000 * 60 * 4,
  },
  {
    id: createId(),
    sender: "you",
    content: "Will do. Preparing the request details now.",
    createdAt: Date.now() - 1000 * 60 * 2,
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
  const bannerUrl = "https://cdn.builder.io/api/v1/image/assets%2Fb5a8e7e2eb7e43a19f3227053e3cfaeb%2Ff096d75efa5346eca92c8e28c02f3406?format=webp&width=800";
  const { toast } = useToast();
  const [side, setSide] = useState<TradeSide>("buy");
  const [pkAmount, setPkAmount] = useState("25000");
  const [rate, setRate] = useState(279.25);
  const [selectedMethod, setSelectedMethod] =
    useState<PaymentMethodId>("easypaisa");
  const [chat, setChat] = useState<ChatMessage[]>(initialMessages);
  const [draftMessage, setDraftMessage] = useState("");
  const [notes, setNotes] = useState(
    "Confirm receipt within chat before releasing escrow on either side.",
  );
  const [adminToken, setAdminToken] = useState("");
  const P2P_BASE = (import.meta as any).env?.VITE_P2P_URL ? String((import.meta as any).env.VITE_P2P_URL).replace(/\/$/, "") : "";
  const { events } = useDurableRoom("global", P2P_BASE);

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

  const handleRequest = async () => {
    if (numericPk <= 0) {
      toast({
        title: "Add a PKR amount",
        description: "Enter a PKR spend amount before requesting the trade.",
      });
      return;
    }

    const action = side === "buy" ? "Buy" : "Sell";

    if (adminToken && P2P_BASE) {
      try {
        await createOrder(
          {
            side,
            amountPKR: numericPk,
            quoteAsset: "USDT",
            pricePKRPerQuote: rate,
            paymentMethod: "easypaisa",
            roomId: "global",
            createdBy: "admin",
          },
          adminToken,
        );
        toast({
          title: `Order posted to room`,
          description: `${action} ${usdcFormatter.format(usdcValue)} USDC via Easypaisa`,
        });
      } catch (err: any) {
        toast({
          title: "Order post failed",
          description: String(err?.message || err),
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: `${action} request created`,
        description: `${action} ${usdcFormatter.format(usdcValue)} USDC using ${method.label}.`,
      });
    }

    setChat((previous) => [
      ...previous,
      {
        id: createId(),
        sender: "you",
        content: `${action} request submitted for ${usdcFormatter.format(usdcValue)} USDC via ${method.label}. Awaiting approval.`,
        createdAt: Date.now(),
      },
    ]);
  };

  const handleReleasePayment = () => {
    toast({
      title: "PKR release logged",
      description:
        "PKR payment marked as sent. Counterparty will verify before releasing USDC.",
    });
    setChat((previous) => [
      ...previous,
      {
        id: createId(),
        sender: "you",
        content:
          "PKR payment released. Please confirm receipt and proceed with the escrow release.",
        createdAt: Date.now(),
      },
    ]);
  };

  const handleReleaseUsdc = () => {
    toast({
      title: "USDC escrow released",
      description: `USDC released with PKR ${RELEASE_USDC_BASE_FEE} extra and PKR ${RELEASE_USDC_SERVICE_FEE} service fees accounted for.`,
    });
    setChat((previous) => [
      ...previous,
      {
        id: createId(),
        sender: "system",
        content: "Escrow marked as released. Session closed successfully.",
        createdAt: Date.now(),
      },
    ]);
  };

  const handleSendMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draftMessage.trim();
    if (!trimmed) return;
    setChat((previous) => [
      ...previous,
      {
        id: createId(),
        sender: "you",
        content: trimmed,
        createdAt: Date.now(),
      },
    ]);
    setDraftMessage("");
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
            >
              <a href="#settlement-chat" aria-label="Open chat">
                <MessageSquareMore className="h-4 w-4" />
              </a>
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
                live chat coordination.
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
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
                  Quick controls
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={handleRequest}
                  className="flex flex-col items-start gap-1 py-2 text-sm"
                >
                  <span>Request settlement setup</span>
                  <span className="text-xs text-muted-foreground">
                    Submit the {side === "buy" ? "buy" : "sell"} request using{" "}
                    {method.label}.
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
                    Includes PKR {RELEASE_USDC_BASE_FEE} extra fee + PKR{" "}
                    {RELEASE_USDC_SERVICE_FEE} service fee.
                  </span>
                  <DropdownMenuShortcut>
                    PKR {releaseUsdcTotalFee}
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Card className="border border-[hsl(var(--border))] bg-white/90 shadow-lg backdrop-blur overflow-hidden">
          <div className="h-28 w-full overflow-hidden bg-gray-50">
            <img src={bannerUrl} alt="P2P banner" className="h-full w-full object-cover" />
          </div>
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
                        <span>USDT amount (before fees)</span>
                        <span className="font-semibold">USDT</span>
                      </div>
                      <div className="mt-2 text-3xl font-semibold tracking-tight">
                        {usdcFormatter.format(usdcValue)}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      1 USDC ≈ {rateFormatter.format(rate)} �� Receiving fee{" "}
                      {rateFormatter.format(receiveFeeTotal)} (
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

                <button onClick={handleRequest} className="w-full h-12 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white font-semibold shadow-md transition-colors">Buy With PKR</button>
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
                        <span>USDT to release</span>
                        <span className="font-semibold">USDT</span>
                      </div>
                      <div className="mt-2 text-3xl font-semibold tracking-tight">
                        {usdcFormatter.format(usdcValue)}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Releasing USDC adds PKR {RELEASE_USDC_BASE_FEE} extra +
                      PKR {RELEASE_USDC_SERVICE_FEE} service fee per settlement.
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

                <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-slate-50/70 px-4 py-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">
                    Manual payout expectation
                  </p>
                  <p className="mt-1 leading-relaxed">{method.description}</p>
                  <p className="mt-2 text-xs uppercase tracking-wide text-[hsl(var(--primary))]">
                    Use the top-right menu to log payments or release escrow.
                  </p>
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

                <button onClick={handleRequest} className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md transition-colors">Sell For PKR</button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="border border-[hsl(var(--border))] bg-white/90 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Confirmation
              & summary
            </CardTitle>
            <CardDescription>
              Snapshot of the settlement plus space for any manual validation
              notes. Actions remain in the menu above.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-[hsl(var(--border))] bg-slate-50/70 p-4">
              <p className="text-sm font-semibold text-foreground">
                Trade overview
              </p>
              {P2P_BASE ? (
                <p className="text-[10px] text-muted-foreground">Connected to {P2P_BASE}</p>
              ) : (
                <p className="text-[10px] text-red-600">Set VITE_P2P_URL to enable backend</p>
              )}
              <input
                type="password"
                placeholder="Admin token (only admin can post)"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                className="w-full rounded-md border bg-white/80 px-3 py-2 text-xs"
              />
              <div className="grid gap-2 text-sm text-muted-foreground">
                <p>
                  Side:{" "}
                  <span className="font-medium capitalize text-foreground">
                    {side}
                  </span>
                </p>
                <p>
                  PKR amount:{" "}
                  <span className="font-medium text-foreground">
                    {numericPk.toLocaleString()}
                  </span>
                </p>
                <p>
                  USDC amount:{" "}
                  <span className="font-medium text-foreground">
                    {usdcFormatter.format(usdcValue)}
                  </span>
                </p>
                <p>
                  Method:{" "}
                  <span className="font-medium text-foreground">
                    {method.label}
                  </span>
                </p>
              </div>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-[110px] resize-none"
                placeholder="Add any confirmation notes for the counterparty."
              />
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-white/80 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Fee breakdown</p>
                <div className="mt-2 space-y-1.5">
                  <p>
                    Receiving USDC: {rateFormatter.format(receiveFeeTotal)} fee
                    ({RECEIVE_FEE_PER_USDC} PKR per USDC)
                  </p>
                  <p>
                    Releasing USDC: PKR {RELEASE_USDC_BASE_FEE} extra + PKR{" "}
                    {RELEASE_USDC_SERVICE_FEE} service = PKR{" "}
                    {releaseUsdcTotalFee}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-white/80 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Reminders</p>
                <ul className="mt-2 space-y-1.5">
                  <li>Log every step in chat for transparency.</li>
                  <li>
                    Verify counterparty details align with manual instructions
                    before releases.
                  </li>
                  <li>Keep screenshots handy in case of dispute review.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          id="settlement-chat"
          className="border border-[hsl(var(--border))] bg-white/90 shadow-lg backdrop-blur"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquareMore className="h-5 w-5 text-[hsl(var(--primary))]" />{" "}
              Settlement chat
            </CardTitle>
            <CardDescription>
              Coordinate in real time. Use the chat log as proof before
              approving any release.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-2xl border border-[hsl(var(--border))] bg-slate-50/70 p-4">
              {P2P_BASE && (
                <div className="text-[10px] text-muted-foreground">
                  Live events: {" "}
                  <code>{JSON.stringify(events.slice(-5))}</code>
                </div>
              )}
              {chat.map((message) => (
                <div key={message.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        message.sender === "you"
                          ? "border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                          : message.sender === "counterparty"
                            ? "border-blue-200 bg-blue-50 text-blue-600"
                            : "border-slate-200 bg-white text-slate-600"
                      }
                    >
                      {message.sender === "you"
                        ? "You"
                        : message.sender === "counterparty"
                          ? "Counterparty"
                          : "System"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{message.content}</p>
                </div>
              ))}
            </div>
            <form
              onSubmit={handleSendMessage}
              className="flex flex-col gap-3 md:flex-row"
            >
              <Input
                placeholder="Type your update…"
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                className="rounded-xl border border-[hsl(var(--border))] bg-white/80 md:flex-1"
              />
              <Button type="submit" className="rounded-xl md:w-auto">
                Send update
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border border-[hsl(var(--border))] bg-white/90 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-emerald-500" /> Release
              checklist
            </CardTitle>
            <CardDescription>
              Follow these confirmations before pressing release on either side.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-slate-50/70 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">When releasing PKR</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>
                  Ensure the method instructions from {method.label} are
                  followed exactly.
                </li>
                <li>Capture and upload the payment confirmation to chat.</li>
                <li>
                  Wait for the counterparty to acknowledge before closing the
                  step.
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-slate-50/70 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">When releasing USDC</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>Verify PKR receipt is confirmed inside chat.</li>
                <li>
                  Account for the PKR {releaseUsdcTotalFee} total release fees.
                </li>
                <li>
                  Log the release using the dropdown menu for audit purposes.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
