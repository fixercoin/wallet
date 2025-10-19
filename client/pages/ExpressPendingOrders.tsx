import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
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
  const [filter, setFilter] = useState<
    "all" | "pending" | "confirmed" | "completed"
  >("all");

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
      <div
        className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white flex items-center justify-center p-4"
        style={{ fontSize: "10px" }}
      >
        <div className="bg-[#1a2540]/60 border border-[#FF7A5C]/30 rounded-xl p-6 shadow max-w-sm w-full text-center">
          <h2 className="text-base font-semibold text-white">Wallet Not Connected</h2>
          <p className="text-sm text-white/80 mt-2">
            Please connect your wallet to view your pending orders.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white shadow hover:opacity-90"
          >
            Back Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white"
      style={{ fontSize: "10px" }}
    >
      <div className="bg-gradient-to-r from-[#1a2847]/95 to-[#16223a]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="p-2 hover:bg-[#1a2540]/50 rounded-lg transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-[#FF7A5C]" />
          </button>
          <div className="flex-1 text-center font-semibold uppercase">Pending Orders</div>
          <div className="w-9" />
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 relative z-20">
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all border ${
              filter === "all"
                ? "bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] border-transparent"
                : "bg-[#1a2540]/50 border-[#FF7A5C]/30 hover:border-[#FF7A5C]/50"
            }`}
          >
            All ({rooms.length})
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all border ${
              filter === "pending"
                ? "bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] border-transparent"
                : "bg-[#1a2540]/50 border-[#FF7A5C]/30 hover:border-[#FF7A5C]/50"
            }`}
          >
            Pending ({rooms.filter((r) => r.status === "pending").length})
          </button>
          <button
            onClick={() => setFilter("confirmed")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all border ${
              filter === "confirmed"
                ? "bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] border-transparent"
                : "bg-[#1a2540]/50 border-[#FF7A5C]/30 hover:border-[#FF7A5C]/50"
            }`}
          >
            Confirmed (
            {rooms.filter((r) => r.status === "payment_confirmed").length})
          </button>
          <button
            onClick={() => setFilter("completed")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all border ${
              filter === "completed"
                ? "bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] border-transparent"
                : "bg-[#1a2540]/50 border-[#FF7A5C]/30 hover:border-[#FF7A5C]/50"
            }`}
          >
            Completed (
            {
              rooms.filter((r) => ["completed", "cancelled"].includes(r.status))
                .length
            }
            )
          </button>
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF7A5C]"></div>
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 mx-auto text-white/40 mb-4" />
            <p className="text-white font-medium">No orders found</p>
            <p className="text-sm text-white/70">
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
                className="bg-[#1a2540]/50 border border-[#FF7A5C]/30 rounded-xl p-4 hover:border-[#FF7A5C]/50 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${getStatusColor(
                        room.status,
                      )}`}
                    >
                      {getStatusIcon(room.status)}
                      {getStatusText(room.status)}
                    </span>
                  </div>
                  <span className="text-xs text-white/70">
                    {new Date(room.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div>
                    <div className="text-white/60 text-xs">Room ID</div>
                    <code className="font-mono text-xs font-semibold text-white">
                      {room.id.slice(0, 12)}...
                    </code>
                  </div>
                  <div>
                    <div className="text-white/60 text-xs">Party</div>
                    <span className="font-semibold text-white">
                      {wallet.publicKey === room.buyer_wallet ? "Buyer" : "Seller"}
                    </span>
                  </div>
                  <div>
                    <div className="text-white/60 text-xs">Updated</div>
                    <span className="text-xs text-white/80">
                      {new Date(room.updated_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-white/60 text-xs">Action</div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() =>
                          navigate("/express/buy-trade", {
                            state: { room, openChat: true },
                          })
                        }
                        className="px-3 py-2 rounded-lg bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white text-xs font-semibold shadow hover:opacity-90"
                      >
                        Continue
                      </button>
                      <button
                        onClick={() =>
                          navigate("/express/buy-trade", { state: { room } })
                        }
                        className="px-3 py-2 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/40 text-white text-xs hover:bg-[#1a2540]/60"
                      >
                        View Chat →
                      </button>
                    </div>
                  </div>
                </div>

                {room.status === "pending" && (
                  <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-200">
                    ⏳ Waiting for counterparty action
                  </div>
                )}
                {room.status === "payment_confirmed" && (
                  <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-200">
                    ✓ Payment confirmed. Assets being transferred...
                  </div>
                )}
                {room.status === "completed" && (
                  <div className="p-2 bg-green-500/10 border border-green-500/30 rounded text-xs text-green-200">
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
