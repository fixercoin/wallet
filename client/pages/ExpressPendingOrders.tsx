import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquare, Clock, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { listTradeRooms, getTradeRoom } from "@/lib/p2p-api";
import type { TradeRoom } from "@/lib/p2p-api";

export default function ExpressPendingOrders() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet } = useWallet();

  const [rooms, setRooms] = useState<TradeRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "completed">("all");

  useEffect(() => {
    if (!wallet?.publicKey) return;
    loadRooms();
  }, [wallet?.publicKey, filter]);

  const loadRooms = async () => {
    if (!wallet?.publicKey) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const allRooms = await listTradeRooms(wallet.publicKey);
      
      let filtered = allRooms;
      if (filter !== "all") {
        filtered = allRooms.filter((r) => {
          switch (filter) {
            case "pending":
              return r.status === "pending";
            case "confirmed":
              return r.status === "payment_confirmed";
            case "completed":
              return r.status === "completed" || r.status === "cancelled";
            default:
              return true;
          }
        });
      }
      setRooms(filtered);
    } catch (error: any) {
      toast({
        title: "Failed to load trades",
        description: error?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: TradeRoom["status"]) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "payment_confirmed":
        return "bg-blue-100 text-blue-800";
      case "assets_transferred":
        return "bg-purple-100 text-purple-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: TradeRoom["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "payment_confirmed":
      case "assets_transferred":
        return <CheckCircle className="h-4 w-4" />;
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "cancelled":
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: TradeRoom["status"]) => {
    const map: Record<TradeRoom["status"], string> = {
      pending: "Awaiting Payment",
      payment_confirmed: "Payment Confirmed",
      assets_transferred: "Assets Transferred",
      completed: "Completed",
      cancelled: "Cancelled",
    };
    return map[status] || status;
  };

  if (!wallet?.publicKey) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 shadow max-w-sm w-full text-center">
          <h2 className="text-lg font-semibold">Wallet Not Connected</h2>
          <p className="text-sm text-gray-600 mt-2">
            Please connect your wallet to view your pending orders.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
          >
            Back Home
          </button>
        </div>
      </div>
    );
  }

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
          <div className="flex-1 text-center font-medium">Pending Orders</div>
          <div className="h-9 w-9" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filter === "all"
                ? "bg-purple-600 text-white"
                : "bg-white border border-gray-300 hover:border-gray-400"
            }`}
          >
            All ({rooms.length})
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filter === "pending"
                ? "bg-yellow-600 text-white"
                : "bg-white border border-gray-300 hover:border-gray-400"
            }`}
          >
            Pending ({rooms.filter((r) => r.status === "pending").length})
          </button>
          <button
            onClick={() => setFilter("confirmed")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filter === "confirmed"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 hover:border-gray-400"
            }`}
          >
            Confirmed (
            {rooms.filter((r) => r.status === "payment_confirmed").length})
          </button>
          <button
            onClick={() => setFilter("completed")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filter === "completed"
                ? "bg-green-600 text-white"
                : "bg-white border border-gray-300 hover:border-gray-400"
            }`}
          >
            Completed (
            {rooms.filter((r) =>
              ["completed", "cancelled"].includes(r.status)
            ).length}
            )
          </button>
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 font-medium">No orders found</p>
            <p className="text-sm text-gray-500">
              {filter === "all"
                ? "You haven't initiated any trades yet."
                : `You have no ${filter} orders.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <div
                key={room.id}
                onClick={() => navigate("/express/buy-trade", { state: { room } })}
                className="bg-white rounded-xl border border-[hsl(var(--border))] shadow-sm p-4 hover:shadow-md cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${getStatusColor(
                        room.status
                      )}`}
                    >
                      {getStatusIcon(room.status)}
                      {getStatusText(room.status)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(room.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div>
                    <div className="text-gray-600 text-xs">Room ID</div>
                    <code className="font-mono text-xs font-semibold">
                      {room.id.slice(0, 12)}...
                    </code>
                  </div>
                  <div>
                    <div className="text-gray-600 text-xs">Party</div>
                    <span className="font-semibold">
                      {wallet.publicKey === room.buyer_wallet ? "Buyer" : "Seller"}
                    </span>
                  </div>
                  <div>
                    <div className="text-gray-600 text-xs">Updated</div>
                    <span className="text-xs">
                      {new Date(room.updated_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-600 text-xs">Action</div>
                    <button className="text-purple-600 text-xs font-semibold hover:underline">
                      View Chat →
                    </button>
                  </div>
                </div>

                {room.status === "pending" && (
                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                    ⏳ Waiting for counterparty action
                  </div>
                )}
                {room.status === "payment_confirmed" && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                    ✓ Payment confirmed. Assets being transferred...
                  </div>
                )}
                {room.status === "completed" && (
                  <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                    ✓ Trade completed successfully!
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
