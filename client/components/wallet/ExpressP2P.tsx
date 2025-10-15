import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { copyToClipboard } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, MessageSquare, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [amountPKR, setAmountPKR] = useState<string>("");
  const [buyTokenMint, setBuyTokenMint] = useState<string>("USDC");
  const [sellAmountTokens, setSellAmountTokens] = useState<string>("");
  const [sellTokenMint, setSellTokenMint] = useState<string>("USDC");
  const navigate = useNavigate();
  const adminAddress = "Ec72XPYcxYgpRFaNb9b6BHe1XdxtqFjzz2wLRTnx1owA";

  const [checkingOrders, setCheckingOrders] = useState(true);
  const [detectedOrder, setDetectedOrder] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersDialogOpen, setOrdersDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Prompt dialogs
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);
  const [paymentInput, setPaymentInput] = useState("");
  const [showWalletPrompt, setShowWalletPrompt] = useState(false);
  const [walletInput, setWalletInput] = useState("");
  const [showPendingPrompt, setShowPendingPrompt] = useState(false);

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

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10 border-b border-white/60">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
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
            {wallet?.publicKey === adminAddress ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/express/post-order")}
                className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-transparent text-black focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent"
                aria-label="Add post"
              >
                <Plus className="h-5 w-5" />
              </Button>
            ) : null}
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

      <div className="max-w-md mx-auto px-4 py-8">
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
                <Button
                  className="w-full wallet-button-secondary"
                  onClick={() => navigate("/express/post-order")}
                >
                  Create sell offer
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
          <Input
            placeholder="e.g. Easypaisa, Bank, JazzCash"
            value={paymentInput}
            onChange={(e) => setPaymentInput(e.target.value)}
          />
          <DialogFooter>
            <Button
              onClick={() => {
                setPaymentMethod(paymentInput.trim());
                setShowPaymentPrompt(false);
                if (paymentInput.trim())
                  toast({
                    title: "Saved",
                    description: `Payment method: ${paymentInput.trim()}`,
                  });
              }}
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
