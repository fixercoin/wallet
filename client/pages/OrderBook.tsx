import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Save, Edit2, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { listOrders, updateOrder, deleteOrder } from "@/lib/p2p";
import { useToast } from "@/hooks/use-toast";

interface Order {
  id: string;
  type: "buy" | "sell";
  amountPKR: number;
  quoteAsset: string;
  pricePKRPerQuote: number;
  paymentMethod: string;
}

export default function OrderBook() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [adminToken, setAdminToken] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = async () => {
    try {
      setIsLoading(true);
      const res = await listOrders("global");
      setOrders((res.orders || []) as Order[]);
    } catch (e: any) {
      toast({
        title: "Failed to load orders",
        description: String(e?.message || e),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleEditOrder = (orderId: string) => {
    setEditingId(orderId);
  };

  const handleSaveOrder = async (order: Order) => {
    try {
      if (!adminToken) {
        toast({
          title: "Admin token required",
          description: "Please enter your admin token",
          variant: "destructive",
        });
        return;
      }

      await updateOrder(
        order.id,
        {
          amountPKR: Number(order.amountPKR),
          quoteAsset: String(order.quoteAsset),
          pricePKRPerQuote: Number(order.pricePKRPerQuote),
          paymentMethod: String(order.paymentMethod || "easypaisa"),
        },
        adminToken,
      );
      toast({
        title: "Success",
        description: "Order updated successfully",
      });
      setEditingId(null);
      await load();
    } catch (e: any) {
      toast({
        title: "Failed to save",
        description: String(e?.message || e),
        variant: "destructive",
      });
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      if (!adminToken) {
        toast({
          title: "Admin token required",
          description: "Please enter your admin token",
          variant: "destructive",
        });
        return;
      }

      await deleteOrder(orderId, adminToken);
      toast({
        title: "Success",
        description: "Order deleted successfully",
      });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (e: any) {
      toast({
        title: "Failed to delete",
        description: String(e?.message || e),
        variant: "destructive",
      });
    }
  };

  const updateOrderField = (
    orderId: string,
    field: keyof Order,
    value: any,
  ) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, [field]: value } : o)),
    );
  };

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10 border-b border-white/60">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/express/embedded")}
            className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-transparent text-[hsl(var(--foreground))] focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1 text-center font-medium text-sm">
            Order Management
          </div>

          <div className="h-9 w-9" />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Admin Token Input Card */}
        <div className="bg-white rounded-2xl border border-[hsl(var(--border))] shadow-sm p-4 mb-6">
          <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-2">
            Admin Authentication
          </label>
          <input
            type="password"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            placeholder="Enter admin token to edit/delete orders"
            className="w-full border border-[hsl(var(--border))] rounded-xl px-4 py-2.5 bg-[hsl(var(--input))] text-sm text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
          />
          {adminToken && (
            <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
              <Lock className="h-3 w-3" />
              Admin verified
            </div>
          )}
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
              Loading orders...
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[hsl(var(--border))] shadow-sm p-6 text-center">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
              No orders available
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-[hsl(var(--border))] shadow-sm overflow-hidden transition-all hover:shadow-md"
              >
                {/* Order Header */}
                <div className="px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                        Order ID
                      </div>
                      <div className="font-mono text-sm font-semibold text-[hsl(var(--foreground))]">
                        {order.id.slice(0, 12)}...
                      </div>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        order.type === "buy"
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {order.type === "buy" ? "BUY" : "SELL"}
                    </div>
                  </div>
                </div>

                {/* Order Content */}
                <div className="p-4 space-y-3">
                  {editingId === order.id ? (
                    // Edit Mode
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                            Amount (PKR)
                          </label>
                          <input
                            type="number"
                            value={order.amountPKR}
                            onChange={(e) =>
                              updateOrderField(
                                order.id,
                                "amountPKR",
                                e.target.value ? Number(e.target.value) : "",
                              )
                            }
                            className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                            Token
                          </label>
                          <select
                            value={order.quoteAsset}
                            onChange={(e) =>
                              updateOrderField(order.id, "quoteAsset", e.target.value)
                            }
                            className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 cursor-pointer"
                          >
                            <option value="USDC">USDC</option>
                            <option value="SOL">SOL</option>
                            <option value="FIXERCOIN">FIXERCOIN</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                            Price (PKR/{order.quoteAsset})
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={order.pricePKRPerQuote}
                            onChange={(e) =>
                              updateOrderField(
                                order.id,
                                "pricePKRPerQuote",
                                e.target.value ? Number(e.target.value) : "",
                              )
                            }
                            className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                            Payment Method
                          </label>
                          <select
                            value={order.paymentMethod}
                            onChange={(e) =>
                              updateOrderField(order.id, "paymentMethod", e.target.value)
                            }
                            className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 cursor-pointer"
                          >
                            <option value="easypaisa">EasyPaisa</option>
                            <option value="jazzcash">JazzCash</option>
                            <option value="bank">Bank Account</option>
                          </select>
                        </div>
                      </div>

                      {/* Action Buttons - Edit Mode */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() => handleSaveOrder(order)}
                          className="flex-1 h-9 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm flex items-center justify-center gap-1"
                        >
                          <Save className="h-4 w-4" /> Save
                        </Button>
                        <Button
                          onClick={() => setEditingId(null)}
                          className="flex-1 h-9 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium text-sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    // View Mode
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-2 rounded-lg bg-[hsl(var(--secondary))]">
                          <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                            Amount
                          </div>
                          <div className="font-semibold text-sm text-[hsl(var(--foreground))]">
                            {Number(order.amountPKR).toLocaleString()} PKR
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-[hsl(var(--secondary))]">
                          <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                            Token
                          </div>
                          <div className="font-semibold text-sm text-[hsl(var(--foreground))]">
                            {order.quoteAsset}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-[hsl(var(--secondary))]">
                          <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                            Rate
                          </div>
                          <div className="font-semibold text-sm text-[hsl(var(--foreground))]">
                            {Number(order.pricePKRPerQuote).toFixed(2)}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-[hsl(var(--secondary))]">
                          <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                            Payment
                          </div>
                          <div className="font-semibold text-sm text-[hsl(var(--foreground))]">
                            {order.paymentMethod}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons - View Mode */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() => handleEditOrder(order.id)}
                          className="flex-1 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center justify-center gap-1"
                        >
                          <Edit2 className="h-4 w-4" /> Edit
                        </Button>
                        <Button
                          onClick={() => handleDeleteOrder(order.id)}
                          className="flex-1 h-9 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm flex items-center justify-center gap-1"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
