import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { copyToClipboard } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, MessageSquare, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TOKEN_MINTS } from "@/lib/constants/token-mints";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { dexscreenerAPI } from "@/lib/services/dexscreener";
import { listOrders } from "@/lib/p2p";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type ExpressP2PProps = {
  onBack: () => void;
};

export function ExpressP2P({ onBack }: ExpressP2PProps) {
  const { wallet, tokens = [] } = useWallet();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [paymentDetails, setPaymentDetails] = useState<{
    accountName: string;
    accountNumber: string;
    method: "easypaisa" | "bank_account";
  } | null>(null);
  const [amountPKR, setAmountPKR] = useState<string>("");
  const [buyTokenMint, setBuyTokenMint] = useState<string>("USDC");
  const [sellAmountTokens, setSellAmountTokens] = useState<string>("");
  const [sellTokenMint, setSellTokenMint] = useState<string>("USDC");

  // Pricing state
  const [usdToPkr, setUsdToPkr] = useState<number | null>(null);
  const [buyTokenPriceUsd, setBuyTokenPriceUsd] = useState<number | null>(null);
  const [sellTokenPriceUsd, setSellTokenPriceUsd] = useState<number | null>(
    null,
  );

  const navigate = useNavigate();

  const [checkingOrders, setCheckingOrders] = useState(true);
  const [detectedOrder, setDetectedOrder] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersDialogOpen, setOrdersDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Prompt dialogs
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);
  const [paymentAccountName, setPaymentAccountName] = useState("");
  const [paymentAccountNumber, setPaymentAccountNumber] = useState("");
  const [paymentMethodChoice, setPaymentMethodChoice] = useState<
    "easypaisa" | "bank_account"
  >("easypaisa");
  const [showWalletPrompt, setShowWalletPrompt] = useState(false);
  const [walletInput, setWalletInput] = useState("");
  const [showPendingPrompt, setShowPendingPrompt] = useState(false);

  useEffect(() => {
    if (showPaymentPrompt) {
      setPaymentAccountName(paymentDetails?.accountName ?? "");
      setPaymentAccountNumber(paymentDetails?.accountNumber ?? "");
      setPaymentMethodChoice(paymentDetails?.method ?? "easypaisa");
    }
  }, [showPaymentPrompt, paymentDetails]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const res = await listOrders("global");
        if (cancelled) return;
        const list = Array.isArray(res?.orders) ? res.orders : [];
        setOrders(list);
        const buy =
          list.find(
            (o: any) => String(o.side || o.type).toLowerCase() === "buy",
          ) || list[0];
        if (buy) {
          setDetectedOrder(buy);
          setSelectedOrder(buy);
          setCheckingOrders(false);
          return;
        }
      } catch {}
      if (!cancelled) {
        timer = window.setTimeout(poll, 2500);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const handleCopyAddress = async () => {
    if (!wallet) return;
    const success = await copyToClipboard(wallet.publicKey);
    toast({
      title: success ? "Address copied" : "Copy failed",
      description: success
        ? "Wallet address copied to clipboard"
        : "Please copy the address manually.",
      variant: success ? "default" : "destructive",
    });
  };

  const tokenOptions = useMemo(() => {
    const set = new Set<string>(["USDC", "SOL", "FIXERCOIN"]);
    for (const t of tokens) set.add(String(t.symbol || "").toUpperCase());
    return Array.from(set);
  }, [tokens]);

  // Resolve symbol to known Solana mint
  const symbolToMint = (sym: string): string | null => {
    const s = String(sym || "").toUpperCase();
    const known: Record<string, string> = {
      SOL: TOKEN_MINTS.SOL,
      USDC: TOKEN_MINTS.USDC,
      USDT: TOKEN_MINTS.USDT,
      FIXERCOIN: TOKEN_MINTS.FIXERCOIN,
      LOCKER: TOKEN_MINTS.LOCKER,
    };
    if (known[s]) return known[s];
    const t = tokens.find((x) => String(x.symbol || "").toUpperCase() === s);
    return t?.mint || null;
  };

  // Load USD→PKR rate (cached)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const cached = localStorage.getItem("usd_to_pkr");
        if (cached) {
          const { rate, ts } = JSON.parse(cached);
          if (
            typeof rate === "number" &&
            Date.now() - ts < 6 * 60 * 60 * 1000
          ) {
            if (!cancelled) setUsdToPkr(rate);
          }
        }
      } catch {}
      try {
        const res = await fetch("/api/forex/rate?base=USD&symbols=PKR");
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
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load token USD price for buy and sell symbols
  useEffect(() => {
    let cancelled = false;
    const loadBuy = async () => {
      const mint = symbolToMint(buyTokenMint);
      if (!mint) {
        setBuyTokenPriceUsd(null);
        return;
      }
      if (buyTokenMint.toUpperCase() === "USDC") {
        setBuyTokenPriceUsd(1);
        return;
      }
      try {
        const dex = await dexscreenerAPI.getTokenByMint(mint);
        if (!cancelled)
          setBuyTokenPriceUsd(dex?.priceUsd ? parseFloat(dex.priceUsd) : null);
      } catch {
        if (!cancelled) setBuyTokenPriceUsd(null);
      }
    };
    loadBuy();
    return () => {
      cancelled = true;
    };
  }, [buyTokenMint, tokens]);

  useEffect(() => {
    let cancelled = false;
    const loadSell = async () => {
      const mint = symbolToMint(sellTokenMint);
      if (!mint) {
        setSellTokenPriceUsd(null);
        return;
      }
      if (sellTokenMint.toUpperCase() === "USDC") {
        setSellTokenPriceUsd(1);
        return;
      }
      try {
        const dex = await dexscreenerAPI.getTokenByMint(mint);
        if (!cancelled)
          setSellTokenPriceUsd(dex?.priceUsd ? parseFloat(dex.priceUsd) : null);
      } catch {
        if (!cancelled) setSellTokenPriceUsd(null);
      }
    };
    loadSell();
    return () => {
      cancelled = true;
    };
  }, [sellTokenMint, tokens]);

  const buyEstimate = useMemo(() => {
    const amt = Number(amountPKR);
    if (!isFinite(amt) || amt <= 0) return null;
    if (!usdToPkr || !buyTokenPriceUsd || buyTokenPriceUsd <= 0) return null;
    const pricePKR = buyTokenPriceUsd * usdToPkr;
    if (pricePKR <= 0) return null;
    return amt / pricePKR;
  }, [amountPKR, usdToPkr, buyTokenPriceUsd]);

  const sellEstimatePKR = useMemo(() => {
    const qty = Number(sellAmountTokens);
    if (!isFinite(qty) || qty <= 0) return null;
    if (!usdToPkr || !sellTokenPriceUsd || sellTokenPriceUsd <= 0) return null;
    const pricePKR = sellTokenPriceUsd * usdToPkr;
    return qty * pricePKR;
  }, [sellAmountTokens, usdToPkr, sellTokenPriceUsd]);

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="w-full px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-10 w-10 p-0 rounded-full border border-white/40 bg-white/80 backdrop-blur-sm text-[hsl(var(--foreground))] focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-transparent text-black focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent"
              aria-label="Add post"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 p-0 rounded-full border border-white/40 bg-white/80 backdrop-blur-sm text-[hsl(var(--foreground))] focus-visible:ring-0 focus-visible:ring-offset-0"
                  aria-label="Menu"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setShowPaymentPrompt(true)}>
                  Payment method
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setShowWalletPrompt(true)}>
                  Wallet address
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setShowPendingPrompt(true)}>
                  Pending orders
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="w-full px-4 py-8">
        <div className="wallet-card rounded-2xl p-6 flex flex-col items-center gap-6">
          {checkingOrders ? (
            <>
              <div
                className="express-p2p-brand"
                role="status"
                aria-label="Scanning for express P2P orders"
              >
                <div className="express-p2p-badge" aria-hidden>
                  <div className="express-p2p-official">OFFICIAL</div>
                  <div className="express-p2p-title">FIXORIUM P2P SERVICE</div>
                </div>

                <div className="express-p2p-currencies" aria-hidden>
                  <div className="p2p-token pkr" aria-hidden>
                    <img
                      src="https://i.postimg.cc/YqdkZCdh/19763513-7xx0-9fxc-170402.jpg"
                      alt="PKR"
                    />
                  </div>
                  <div className="p2p-token sol" aria-hidden>
                    <img
                      src="https://i.postimg.cc/0QsCpPRr/logo.png"
                      alt="SOL"
                    />
                  </div>
                  <div className="p2p-token usdc" aria-hidden>
                    <img
                      src="https://i.postimg.cc/1z9GtMpJ/s-usdc.webp"
                      alt="USDC"
                    />
                  </div>
                  <div className="p2p-token fixer" aria-hidden>
                    <img
                      src="https://i.postimg.cc/zGdmt2XL/6x2D7UQ.png"
                      alt="FIXERCOIN"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : detectedOrder ? (
            <>
              <button
                type="button"
                onClick={() => setOrdersDialogOpen(true)}
                className="w-full rounded-xl border border-white/50 bg-white/80 p-4 hover:bg-white/90 transition flex items-center gap-3"
              >
                <MessageSquare className="h-4 w-4 text-[hsl(var(--primary))]" />
                <span className="text-sm font-medium">Detected orders</span>
                <span className="ml-auto inline-flex items-center justify-center rounded-full bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5">
                  {orders.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate("/express/buy-trade", {
                    state: { order: detectedOrder },
                  })
                }
                className="w-full text-left rounded-xl border border-white/50 bg-white/80 p-4 hover:bg-white/90 transition flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-gray-500">Buy order detected</p>
                  <p className="font-semibold">
                    {String(
                      detectedOrder?.quoteAsset ||
                        detectedOrder?.token ||
                        "Token",
                    ).toUpperCase()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Price (PKR)</p>
                  <p className="font-medium">
                    {detectedOrder?.pricePKRPerQuote ?? "—"}
                  </p>
                </div>
              </button>
            </>
          ) : null}

          <div className="w-full border-t border-white/30 pt-4">
            <div className="flex gap-2 mb-4">
              <button
                className={`flex-1 py-2 rounded-lg ${activeTab === "buy" ? "bg-pink-100 font-medium" : "bg-white/80"}`}
                onClick={() => setActiveTab("buy")}
              >
                Buy
              </button>
              <button
                className={`flex-1 py-2 rounded-lg ${activeTab === "sell" ? "bg-pink-100 font-medium" : "bg-white/80"}`}
                onClick={() => setActiveTab("sell")}
              >
                Sell
              </button>
            </div>

            {activeTab === "buy" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    PKR Amount
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={amountPKR}
                    onChange={(e) => setAmountPKR(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Select Token
                  </label>
                  <select
                    value={buyTokenMint}
                    onChange={(e) => setBuyTokenMint(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 bg-white"
                  >
                    {tokenOptions.map((sym) => (
                      <option key={sym} value={sym}>
                        {sym}
                      </option>
                    ))}
                  </select>
                </div>
                {buyEstimate !== null ? (
                  <div className="p-3 rounded-lg border bg-white/90">
                    <div className="text-xs text-gray-500">Estimate</div>
                    <div className="font-semibold mt-1">
                      {buyEstimate.toLocaleString(undefined, {
                        maximumFractionDigits:
                          buyTokenMint === "FIXERCOIN" ? 8 : 6,
                      })}{" "}
                      {buyTokenMint}
                    </div>
                  </div>
                ) : null}
                <Button
                  className="w-full wallet-button-primary"
                  onClick={() => {
                    if (selectedOrder) {
                      navigate("/express/buy-trade", {
                        state: { order: selectedOrder },
                      });
                    } else {
                      setOrdersDialogOpen(true);
                    }
                  }}
                >
                  Continue
                </Button>
              </div>
            )}

            {activeTab === "sell" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Token
                  </label>
                  <select
                    value={sellTokenMint}
                    onChange={(e) => setSellTokenMint(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 bg-white"
                  >
                    {tokenOptions.map((sym) => (
                      <option key={sym} value={sym}>
                        {sym}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Amount (tokens)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={sellAmountTokens}
                    onChange={(e) => setSellAmountTokens(e.target.value)}
                    placeholder="0"
                  />
                </div>
                {sellEstimatePKR !== null ? (
                  <div className="p-3 rounded-lg border bg-white/90">
                    <div className="text-xs text-gray-500">Estimate</div>
                    <div className="font-semibold mt-1">
                      PKR{" "}
                      {sellEstimatePKR.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                ) : null}
                <Button
                  className="w-full wallet-button-secondary"
                  onClick={() => {
                    const sell =
                      orders.find(
                        (o) =>
                          String(o.side || o.type).toLowerCase() === "sell",
                      ) || selectedOrder;
                    if (sell) {
                      navigate("/express/buy-trade", {
                        state: { order: sell },
                      });
                    } else {
                      setOrdersDialogOpen(true);
                    }
                  }}
                >
                  Continue
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={ordersDialogOpen} onOpenChange={setOrdersDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Available Orders</DialogTitle>
            <DialogDescription>Select an order to continue</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-auto space-y-2">
            {orders.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelectedOrder(o)}
                className={
                  "w-full text-left rounded-lg border border-white/50 p-3 bg-white/80 " +
                  (selectedOrder?.id === o.id
                    ? "ring-2 ring-[hsl(var(--ring))] border-[hsl(var(--ring))]"
                    : "hover:bg-white/90")
                }
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">
                      {String(
                        o?.quoteAsset || o?.token || "Token",
                      ).toUpperCase()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {String(o?.side || o?.type || "").toUpperCase()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Price (PKR)</p>
                    <p className="font-medium">{o?.pricePKRPerQuote ?? "—"}</p>
                  </div>
                </div>
              </button>
            ))}
            {orders.length === 0 ? (
              <p className="text-sm text-gray-500">No orders available.</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              onClick={() => {
                const o = selectedOrder || orders[0];
                if (o) {
                  setOrdersDialogOpen(false);
                  navigate("/express/buy-trade", { state: { order: o } });
                }
              }}
              disabled={!selectedOrder && orders.length === 0}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentPrompt} onOpenChange={setShowPaymentPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add payment method</DialogTitle>
            <DialogDescription>
              Enter your preferred payment method.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-account-name">Account name</Label>
              <Input
                id="payment-account-name"
                placeholder="Account holder name"
                value={paymentAccountName}
                onChange={(e) => setPaymentAccountName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-account-number">Account number</Label>
              <Input
                id="payment-account-number"
                placeholder="e.g. 03001234567"
                value={paymentAccountNumber}
                inputMode="numeric"
                onChange={(e) => setPaymentAccountNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select
                value={paymentMethodChoice}
                onValueChange={(value: "easypaisa" | "bank_account") =>
                  setPaymentMethodChoice(value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easypaisa">Easypaisa</SelectItem>
                  <SelectItem value="bank_account">Bank account</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                const trimmedName = paymentAccountName.trim();
                const trimmedNumber = paymentAccountNumber.trim();
                if (!trimmedName || !trimmedNumber) {
                  return;
                }
                const details = {
                  accountName: trimmedName,
                  accountNumber: trimmedNumber,
                  method: paymentMethodChoice,
                } as const;
                setPaymentDetails(details);
                setShowPaymentPrompt(false);
                toast({
                  title: "Saved",
                  description: `${
                    paymentMethodChoice === "easypaisa"
                      ? "Easypaisa"
                      : "Bank account"
                  } • ${trimmedName} (${trimmedNumber})`,
                });
              }}
              disabled={
                !paymentAccountName.trim() || !paymentAccountNumber.trim()
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showWalletPrompt} onOpenChange={setShowWalletPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add wallet address</DialogTitle>
            <DialogDescription>
              Paste the wallet address to use for transfers.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Wallet address"
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value)}
          />
          <DialogFooter>
            <Button
              onClick={() => {
                setShowWalletPrompt(false);
                if (walletInput.trim())
                  toast({
                    title: "Saved",
                    description: "Wallet address added",
                  });
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPendingPrompt} onOpenChange={setShowPendingPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check pending orders</DialogTitle>
            <DialogDescription>
              Click continue to view your pending orders.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowPendingPrompt(false);
                setOrdersDialogOpen(true);
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ExpressP2P;
