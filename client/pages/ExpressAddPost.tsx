import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { listP2POrders, deleteP2POrder } from "@/lib/p2p-api";
import type { P2POrder } from "@/lib/p2p-api";

export default function ExpressAddPost() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet } = useWallet();

  const [orders, setOrders] = useState<P2POrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "buy" | "sell">("all");
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [filter, showOnlineOnly]);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const type = filter === "all" ? undefined : (filter as "buy" | "sell");
      const online = showOnlineOnly ? true : undefined;
      const data = await listP2POrders({ type, online });
      setOrders(data);
    } catch (error: any) {
      toast({
        title: "Failed to load orders",
        description: error?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (orderId: string) => {
    if (!wallet?.publicKey) {
      toast({
        title: "Not authorized",
        description: "You must be logged in to delete orders",
        variant: "destructive",
      });
      return;
    }

    const order = orders.find((o) => o.id === orderId);
    if (order && order.creator_wallet !== wallet.publicKey) {
      toast({
        title: "Not authorized",
        description: "You can only delete your own orders",
        variant: "destructive",
      });
      return;
    }

    try {
      await deleteP2POrder(orderId);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast({
        title: "Success",
        description: "Order deleted",
      });
    } catch (error: any) {
      toast({
        title: "Failed to delete order",
        description: error?.message || String(error),
        variant: "destructive",
      });
    }
  };

  const myOrders = wallet?.publicKey
    ? orders.filter((o) => o.creator_wallet === wallet.publicKey)
    : [];

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10 border-b border-white/60">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/")}
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-gray-100"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 text-center font-medium">Post Orders</div>
          <button
            onClick={() => navigate("/express/post-order")}
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-purple-100 text-purple-600"
            aria-label="Create new order"
            title="Create new order"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* My Orders Section */}
        {wallet?.publicKey && myOrders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">
              My Orders ({myOrders.length})
            </h2>
            <div className="grid gap-3">
              {myOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-xl border border-[hsl(var(--border))] shadow-sm p-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          order.type === "buy"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {order.type.toUpperCase()}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          order.online ? "text-green-600" : "text-gray-500"
                        }`}
                      >
                        {order.online ? "● Online" : "● Offline"}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(order.id)}
                      className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <div className="text-gray-600">Token</div>
                      <div className="font-semibold">{order.token}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Amount</div>
                      <div className="font-semibold">
                        {Number(order.token_amount).toFixed(6)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">PKR</div>
                      <div className="font-semibold">
                        {order.pkr_amount.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">Rate</div>
                      <div className="font-semibold">
                        {(
                          order.pkr_amount / Number(order.token_amount)
                        ).toFixed(2)}{" "}
                        PKR
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/express/post-order/${order.id}`)}
                    className="w-full py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg border border-purple-200"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Orders Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Available Orders</h2>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                filter === "all"
                  ? "bg-purple-600 text-white"
                  : "bg-white border border-gray-300 hover:border-gray-400"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("buy")}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                filter === "buy"
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-300 hover:border-gray-400"
              }`}
            >
              Buy Orders
            </button>
            <button
              onClick={() => setFilter("sell")}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                filter === "sell"
                  ? "bg-green-600 text-white"
                  : "bg-white border border-gray-300 hover:border-gray-400"
              }`}
            >
              Sell Orders
            </button>
            <label className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-300 rounded-full cursor-pointer hover:border-gray-400 text-sm">
              <input
                type="checkbox"
                checked={showOnlineOnly}
                onChange={(e) => setShowOnlineOnly(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              Online Only
            </label>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No orders found</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {orders
                .filter(
                  (o) =>
                    !wallet?.publicKey || o.creator_wallet !== wallet.publicKey,
                )
                .map((order) => (
                  <div
                    key={order.id}
                    onClick={() =>
                      navigate(`/express/buy-trade`, { state: { order } })
                    }
                    className="bg-white rounded-xl border border-[hsl(var(--border))] shadow-sm p-4 hover:shadow-md cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            order.type === "buy"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {order.type.toUpperCase()}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            order.online ? "text-green-600" : "text-gray-500"
                          }`}
                        >
                          {order.online ? "● Online" : "● Offline"}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-gray-600">Token</div>
                        <div className="font-semibold">{order.token}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Amount</div>
                        <div className="font-semibold">
                          {Number(order.token_amount).toFixed(6)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600">PKR</div>
                        <div className="font-semibold">
                          {order.pkr_amount.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600">Rate</div>
                        <div className="font-semibold">
                          {(
                            order.pkr_amount / Number(order.token_amount)
                          ).toFixed(2)}{" "}
                          PKR
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
