import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { listOrders, updateOrder, deleteOrder } from "@/lib/p2p";
import { useToast } from "@/hooks/use-toast";

export default function OrderBook() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [adminToken, setAdminToken] = useState("");

  const load = async () => {
    try {
      const res = await listOrders("global");
      setOrders(res.orders || []);
    } catch (e: any) {
      toast({
        title: "Failed to load",
        description: String(e?.message || e),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSave = async (idx: number) => {
    try {
      if (!adminToken) {
        toast({ title: "Admin token required", variant: "destructive" });
        return;
      }
      const o = orders[idx];
      await updateOrder(
        o.id,
        {
          amountPKR: Number(o.amountPKR),
          quoteAsset: String(o.quoteAsset),
          pricePKRPerQuote: Number(o.pricePKRPerQuote),
          paymentMethod: String(o.paymentMethod || "easypaisa"),
        },
        adminToken,
      );
      toast({ title: "Order saved" });
      load();
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: String(e?.message || e),
        variant: "destructive",
      });
    }
  };

  const onDelete = async (id: string) => {
    try {
      if (!adminToken) {
        toast({ title: "Admin token required", variant: "destructive" });
        return;
      }
      await deleteOrder(id, adminToken);
      toast({ title: "Order deleted" });
      setOrders((prev) => prev.filter((o) => o.id !== id));
    } catch (e: any) {
      toast({
        title: "Delete failed",
        description: String(e?.message || e),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10 border-b border-white/60">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/express/post-order")}
            className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-transparent text-[hsl(var(--foreground))]"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1 text-center font-medium">Orderbook</div>

          <div className="h-9 w-9" />
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Admin token
          </label>
          <input
            type="password"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            className="w-full border rounded-xl px-3 py-2 bg-white"
            placeholder="Required to edit/delete"
          />
        </div>

        {orders.map((o, idx) => (
          <div key={o.id} className="wallet-card rounded-2xl p-4 space-y-3">
            <div className="text-xs text-gray-500">
              ID: <span className="font-mono">{o.id}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Amount (PKR)
                </label>
                <input
                  value={o.amountPKR}
                  onChange={(e) =>
                    setOrders((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, amountPKR: e.target.value } : x,
                      ),
                    )
                  }
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Token
                </label>
                <select
                  value={o.quoteAsset}
                  onChange={(e) =>
                    setOrders((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, quoteAsset: e.target.value } : x,
                      ),
                    )
                  }
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                >
                  <option value="USDC">USDC</option>
                  <option value="SOL">SOL</option>
                  <option value="FIXERCOIN">FIXERCOIN</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Token price (PKR)
                </label>
                <input
                  value={o.pricePKRPerQuote}
                  onChange={(e) =>
                    setOrders((prev) =>
                      prev.map((x, i) =>
                        i === idx
                          ? { ...x, pricePKRPerQuote: e.target.value }
                          : x,
                      ),
                    )
                  }
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Payment method
                </label>
                <input
                  disabled
                  className="w-full border rounded-xl px-3 py-2 bg-gray-50"
                  value="easypaisa"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                onClick={() => onSave(idx)}
                className="wallet-button-secondary flex items-center gap-1"
              >
                <Save className="h-4 w-4" /> Save
              </Button>
              <Button
                onClick={() => onDelete(o.id)}
                className="wallet-button-primary flex items-center gap-1"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
