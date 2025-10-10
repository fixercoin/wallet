import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  MessageSquareMore,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface ExpressP2PProps {
  onBack: () => void;
}

type TradeSide = "buy" | "sell";

type PaymentMethodId = "easypaisa" | "firstpay" | "sadapay" | "nayapay";

interface PaymentMethod {
  id: PaymentMethodId;
  label: string;
  accountName: string;
  accountNumber: string;
  notes: string;
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
    accountName: "Ameer Nawaz Khan",
    accountNumber: "0310 7044833",
    notes: "Transfer to Easypaisa mobile account. Share receipt in chat before confirming.",
  },
  {
    id: "firstpay",
    label: "FirstPay",
    accountName: "Ameer Nawaz Khan",
    accountNumber: "0310 7044833",
    notes: "Send funds via FirstPay wallet and capture the confirmation screen.",
  },
  {
    id: "sadapay",
    label: "SadaPay",
    accountName: "Ameer Nawaz Khan",
    accountNumber: "0310 7044833",
    notes: "Use SadaPay instant transfer. Verify CNIC name matches before release.",
  },
  {
    id: "nayapay",
    label: "NayaPay",
    accountName: "Ameer Nawaz Khan",
    accountNumber: "0310 7044833",
    notes: "Send to NayaPay wallet. Add reference: EXPRESS-P2P and notify in chat.",
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
    content: "Express P2P room opened. Keep all settlement updates inside chat.",
    createdAt: Date.now() - 1000 * 60 * 9,
  },
  {
    id: createId(),
    sender: "counterparty",
    content: "Hi Ameer, please share Easypaisa receipt once you send the PKR.",
    createdAt: Date.now() - 1000 * 60 * 4,
  },
  {
    id: createId(),
    sender: "you",
    content: "Sure, preparing to submit the buy request now.",
    createdAt: Date.now() - 1000 * 60 * 2,
  },
];

const RATE_MIN = 272.25;
const RATE_MAX = 285.5;

export const ExpressP2P: React.FC<ExpressP2PProps> = ({ onBack }) => {
  const { toast } = useToast();
  const [side, setSide] = useState<TradeSide>("buy");
  const [pkAmount, setPkAmount] = useState("25000");
  const [rate, setRate] = useState(279.25);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>("easypaisa");
  const [chat, setChat] = useState<ChatMessage[]>(initialMessages);
  const [draftMessage, setDraftMessage] = useState("");
  const [notes, setNotes] = useState("Confirm receipt before releasing USDC. Account owner: Ameer Nawaz Khan.");

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

  const usdcValue = useMemo(() => {
    const numericPk = Number(pkAmount.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(numericPk) || numericPk <= 0) {
      return 0;
    }
    return Number((numericPk / rate).toFixed(4));
  }, [pkAmount, rate]);

  const method = PAYMENT_METHODS.find((item) => item.id === selectedMethod)!;

  const handleRequest = () => {
    if (!pkAmount || Number(pkAmount) <= 0) {
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
      title: "PKR release confirmed",
      description: "Marked PKR payment as sent. Counterparty will verify before releasing USDC.",
    });
    setChat((previous) => [
      ...previous,
      {
        id: createId(),
        sender: "you",
        content: "PKR payment released. Please confirm receipt and release the USDC escrow.",
        createdAt: Date.now(),
      },
    ]);
  };

  const handleReleaseUsdc = () => {
    toast({
      title: "USDC escrow released",
      description: "You completed the order and released the USDC to the buyer.",
    });
    setChat((previous) => [
      ...previous,
      {
        id: createId(),
        sender: "system",
        content: "You marked the escrow as released. Order closed successfully.",
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
  const ctaLabel = side === "buy" ? "Buy with PKR" : "Sell for PKR";

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
                Manual peer trades between USDC and PKR, backed by escrow and chat confirmation.
              </p>
            </div>
          </div>
          <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700">
            <Sparkles className="mr-1 h-3.5 w-3.5" /> Real-time live
          </Badge>
        </div>

        <Card className="border border-[hsl(var(--border))] bg-white shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ArrowRightLeft className="h-4 w-4" /> {headerLabel} flow
            </CardTitle>
            <CardDescription>
              Set the PKR amount, review the USDC you will {side === "buy" ? "receive" : "deliver"}, then choose a payment method.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs value={side} onValueChange={(value) => setSide(value as TradeSide)}>
              <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/60 p-1">
                <TabsTrigger value="buy" className="rounded-lg text-base">
                  Buy
                </TabsTrigger>
                <TabsTrigger value="sell" className="rounded-lg text-base">
                  Sell
                </TabsTrigger>
              </TabsList>
              <TabsContent value="buy" className="mt-6 space-y-5">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Spend</Label>
                  <div className="rounded-xl border border-[hsl(var(--border))] bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Enter PKR amount</span>
                      <span className="font-semibold">PKR</span>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={pkAmount}
                      onChange={(event) => setPkAmount(event.target.value)}
                      className="mt-1 border-0 px-0 text-2xl font-semibold focus-visible:ring-0"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Receive ≈</Label>
                  <div className="rounded-xl border border-[hsl(var(--border))] bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Estimated USDC</span>
                      <span className="font-semibold">USDC</span>
                    </div>
                    <div className="mt-1 text-2xl font-semibold">
                      {usdcFormatter.format(usdcValue)}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    1 USDC ≈ {rateFormatter.format(rate)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Payment method</Label>
                  <Select value={selectedMethod} onValueChange={(value) => setSelectedMethod(value as PaymentMethodId)}>
                    <SelectTrigger>
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

                <div className="rounded-xl border border-[hsl(var(--border))] bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{method.label}</p>
                  <p>Account owner: {method.accountName}</p>
                  <p>Number: {method.accountNumber}</p>
                  <p className="mt-1 text-xs">{method.notes}</p>
                </div>

                <Button className="w-full text-base" onClick={handleRequest}>
                  {ctaLabel}
                </Button>
              </TabsContent>

              <TabsContent value="sell" className="mt-6 space-y-5">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  You are selling USDC to receive PKR manually. Confirm incoming receipt before releasing escrow.
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Receive</Label>
                  <div className="rounded-xl border border-[hsl(var(--border))] bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Calculated PKR</span>
                      <span className="font-semibold">PKR</span>
                    </div>
                    <div className="mt-1 text-2xl font-semibold">
                      {Number(pkAmount) > 0 ? Number(pkAmount).toLocaleString() : "0"}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Send</Label>
                  <div className="rounded-xl border border-[hsl(var(--border))] bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>USDC to deliver</span>
                      <span className="font-semibold">USDC</span>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={usdcValue}
                      readOnly
                      className="mt-1 border-0 px-0 text-2xl font-semibold focus-visible:ring-0"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    1 USDC ≈ {rateFormatter.format(rate)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Payment method you expect</Label>
                  <Select value={selectedMethod} onValueChange={(value) => setSelectedMethod(value as PaymentMethodId)}>
                    <SelectTrigger>
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
                <div className="rounded-xl border border-[hsl(var(--border))] bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Provide method instructions</p>
                  <p>Account owner: {method.accountName}</p>
                  <p>Number: {method.accountNumber}</p>
                  <p className="mt-1 text-xs">{method.notes}</p>
                </div>
                <Button className="w-full text-base" onClick={handleRequest}>
                  {ctaLabel}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="border border-[hsl(var(--border))] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Confirmation & controls
            </CardTitle>
            <CardDescription>
              Request the method, confirm PKR transfer, then release USDC when ready. Maintain manual oversight for every step.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-[hsl(var(--border))] bg-slate-50 p-4">
              <p className="text-sm font-semibold text-foreground">Trade summary</p>
              <div className="text-sm text-muted-foreground">
                <p>Side: <span className="font-medium capitalize text-foreground">{side}</span></p>
                <p>PKR amount: <span className="font-medium text-foreground">{Number(pkAmount).toLocaleString()}</span></p>
                <p>USDC amount: <span className="font-medium text-foreground">{usdcFormatter.format(usdcValue)}</span></p>
                <p>Method: <span className="font-medium text-foreground">{method.label}</span></p>
              </div>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-[100px]"
                placeholder="Add any confirmation notes for the counterparty."
              />
            </div>
            <div className="flex flex-col gap-3">
              <Button className="h-12 text-base" onClick={handleRequest}>
                Request method approval
              </Button>
              <Button className="h-12 text-base" variant="outline" onClick={handleReleasePayment}>
                Release PKR payment
              </Button>
              <Button className="h-12 text-base" variant="ghost" onClick={handleReleaseUsdc}>
                Release USDC escrow
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[hsl(var(--border))] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquareMore className="h-5 w-5 text-[hsl(var(--primary))]" /> Settlement chat
            </CardTitle>
            <CardDescription>
              Coordinate the transfer in real time. Use the log as proof before approving releases.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-[hsl(var(--border))] bg-slate-50 p-4">
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
            <form onSubmit={handleSendMessage} className="flex flex-col gap-3 md:flex-row">
              <Input
                placeholder="Type your update…"
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                className="md:flex-1"
              />
              <Button type="submit" className="md:w-auto">
                Send update
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border border-[hsl(var(--border))] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-emerald-500" /> Release checklist
            </CardTitle>
            <CardDescription>
              Follow these confirmations before pressing release on either side.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[hsl(var(--border))] bg-slate-50 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">When releasing PKR</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Verify account name: Ameer Nawaz Khan.</li>
                <li>Send manual transfer via {method.label} and save receipt.</li>
                <li>Upload confirmation in chat for the counterparty.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-[hsl(var(--border))] bg-slate-50 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">When releasing USDC</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Ensure PKR receipt is verified inside chat.</li>
                <li>Confirm settlement rate: {rateFormatter.format(rate)}.</li>
                <li>Release escrow only after all details match.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
