import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { copyToClipboard } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Plus, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
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
  const { wallet } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const adminAddress = "Ec72XPYcxYgpRFaNb9b6BHe1XdxtqFjzz2wLRTnx1owA";

  const [checkingOrders, setCheckingOrders] = useState(true);
  const [detectedOrder, setDetectedOrder] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersDialogOpen, setOrdersDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

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
          return; // stop polling on first detection
        }
      } catch {
        // ignore errors and keep polling
      }
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
    if (!wallet) {
      return;
    }

    const success = await copyToClipboard(wallet.publicKey);
    toast({
      title: success ? "Address copied" : "Copy failed",
      description: success
        ? "Wallet address copied to clipboard"
        : "Please copy the address manually.",
      variant: success ? "default" : "destructive",
    });
  };

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10 border-b border-white/60">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-transparent text-black focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent"
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

          <div className="flex items-center gap-2 w-[300px] max-w-[60vw] shrink-0">
            <Input
              value={wallet?.publicKey || ""}
              placeholder="No wallet"
              readOnly
              className="h-9 font-mono text-sm"
            />
            {wallet ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyAddress}
                className="h-8 w-8 p-0 rounded-full bg-transparent hover:bg-transparent text-[hsl(var(--foreground))] focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent"
                aria-label="Copy wallet address"
              >
                <Copy className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-8">
        <div className="wallet-card rounded-2xl p-6 flex flex-col items-center gap-6">
          {checkingOrders ? (
            <>
              <div
                className="express-p2p-loader"
                role="status"
                aria-label="Scanning for express P2P orders"
              >
                <div className="express-p2p-loader__inner" />
                <div className="express-p2p-loader__orbit">
                  <span className="express-p2p-loader__dot" />
                  <span className="express-p2p-loader__dot" />
                  <span className="express-p2p-loader__dot" />
                  <span className="express-p2p-loader__dot" />
                </div>
              </div>
              <p className="text-base font-semibold text-center express-detecting-text">
                detecting orders
              </p>
            </>
          ) : detectedOrder ? (
            <>
              <button
                type="button"
                onClick={() => setOrdersDialogOpen(true)}
                className="w-full rounded-xl border bg-white p-4 shadow hover:shadow-md transition flex items-center gap-3"
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
                className="w-full text-left rounded-xl border bg-white p-4 shadow hover:shadow-md transition flex items-center justify-between"
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
                  "w-full text-left rounded-lg border p-3 bg-white " +
                  (selectedOrder?.id === o.id
                    ? "ring-2 ring-[hsl(var(--ring))] border-[hsl(var(--ring))]"
                    : "hover:bg-gray-50")
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
    </div>
  );
}

export default ExpressP2P;
