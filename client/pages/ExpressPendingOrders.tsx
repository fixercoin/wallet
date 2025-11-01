import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  Check,
  X,
  Bell,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { listTradeRooms, getTradeRoom } from "@/lib/p2p-api";
import { useDurableRoom } from "@/hooks/useDurableRoom";
import { API_BASE } from "@/lib/p2p";
import {
  getUnreadNotifications,
  getPaymentReceivedNotifications,
  saveNotification,
} from "@/lib/p2p-chat";
import type { TradeRoom } from "@/lib/p2p-api";

export default function ExpressPendingOrders() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet } = useWallet();
  const { events } = useDurableRoom("global", API_BASE);

  const [rooms, setRooms] = useState<TradeRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "pending" | "confirmed" | "completed"
  >("all");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [processingRoomId, setProcessingRoomId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingVerificationCount, setPendingVerificationCount] = useState(0);

  // Listen for notifications and auto-open chat
  useEffect(() => {
    if (!wallet?.publicKey) return;

    const last = events[events.length - 1];
    if (!last) return;

    if (last.kind === "notification") {
      const notif = last.data;
      if (notif?.roomId && notif?.initiatorWallet !== wallet.publicKey) {
        toast({
          title: "New Trade Alert 🔔",
          description: notif.message,
        });
        try {
          saveNotification(notif);
        } catch {}

        // Auto-open chat window for the other party
        if (
          notif.type === "trade_initiated" ||
          notif.type === "status_change"
        ) {
          const room: TradeRoom = {
            id: notif.roomId,
            buyer_wallet: "",
            seller_wallet: "",
            order_id: notif.roomId,
            status: "pending",
            created_at: Date.now(),
            updated_at: Date.now(),
          };

          navigate("/express/buy-trade", {
            state: {
              room,
              order: {
                id: notif.roomId,
                type: "sell",
                token: notif.data?.token || "USDC",
              },
              openChat: true,
            },
          });
        }
      }
    }
  }, [events, wallet?.publicKey, navigate, toast]);

  useEffect(() => {
    if (!wallet?.publicKey) return;
    loadRooms();
    const count = getUnreadNotifications(wallet.publicKey).length;
    setUnreadCount(count);
    const verifyCount = getPaymentReceivedNotifications(
      wallet.publicKey,
    ).length;
    setPendingVerificationCount(verifyCount);
  }, [wallet?.publicKey, filter, events]);

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

  const handleVerifyOrder = async (room: TradeRoom) => {
    setProcessingRoomId(room.id);
    try {
      toast({
        title: "Order Verified",
        description: `Order ${room.id.slice(0, 12)}... has been verified`,
      });
      setSelectedRoomId(null);
      await new Promise((resolve) => setTimeout(resolve, 500));
      loadRooms();
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error?.message || "Could not verify order",
        variant: "destructive",
      });
    } finally {
      setProcessingRoomId(null);
    }
  };

  const handleCancelOrder = async (room: TradeRoom) => {
    setProcessingRoomId(room.id);
    try {
      toast({
        title: "Order Cancelled",
        description: `Order ${room.id.slice(0, 12)}... has been cancelled`,
      });
      setSelectedRoomId(null);
      await new Promise((resolve) => setTimeout(resolve, 500));
      loadRooms();
    } catch (error: any) {
      toast({
        title: "Cancellation Failed",
        description: error?.message || "Could not cancel order",
        variant: "destructive",
      });
    } finally {
      setProcessingRoomId(null);
    }
  };

  if (!wallet?.publicKey) {
    return (
      <div
        className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white flex items-center justify-center p-4"
        style={{ fontSize: "10px" }}
      >
        <div className="bg-[#1a2540]/60 border border-[#FF7A5C]/30 rounded-xl p-6 shadow max-w-sm w-full text-center">
          <h2 className="text-base font-semibold text-white">
            Wallet Not Connected
          </h2>
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
          <div className="flex-1 text-center font-semibold uppercase">
            Pending Orders
          </div>
          <div className="relative">
            <Bell className="w-5 h-5 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-red-500 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 relative z-20">
        {/* Seller Verification Alert */}
        {pendingVerificationCount > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-[#FF7A5C]/20 to-[#FF5A8C]/20 border border-[#FF7A5C]/40 flex items-start gap-3">
            <div className="text-[#FF7A5C] flex-shrink-0 mt-0.5">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-white">
                {pendingVerificationCount} Payment
                {pendingVerificationCount !== 1 ? "s" : ""} to Verify
              </div>
              <p className="text-xs text-white/80 mt-1">
                Buyer{pendingVerificationCount !== 1 ? "s have" : " has"}{" "}
                confirmed payment. Review and verify to proceed.
              </p>
              <button
                onClick={() => navigate("/verify-sell")}
                className="mt-2 inline-flex items-center px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white text-xs font-semibold hover:opacity-90 transition-all"
              >
                Review Now →
              </button>
            </div>
          </div>
        )}

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
                      {wallet.publicKey === room.buyer_wallet
                        ? "Buyer"
                        : "Seller"}
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
                    <div className="text-white/60 text-xs">Details</div>
                    <button
                      onClick={() =>
                        setSelectedRoomId(
                          selectedRoomId === room.id ? null : room.id,
                        )
                      }
                      className="text-[#FF7A5C] hover:text-[#FF5A8C] font-semibold text-xs"
                    >
                      {selectedRoomId === room.id ? "Hide" : "Show"} →
                    </button>
                  </div>
                </div>

                {selectedRoomId === room.id && (
                  <div className="mt-4 pt-4 border-t border-[#FF7A5C]/20 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => handleVerifyOrder(room)}
                        disabled={processingRoomId === room.id}
                        className="h-9 rounded-lg bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-white font-semibold text-xs flex items-center justify-center gap-1 shadow transition-all"
                      >
                        <Check className="w-3 h-3" />
                        Verify
                      </Button>
                      <Button
                        onClick={() => handleCancelOrder(room)}
                        disabled={processingRoomId === room.id}
                        className="h-9 rounded-lg bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#dc2626] hover:to-[#b91c1c] text-white font-semibold text-xs flex items-center justify-center gap-1 shadow transition-all"
                      >
                        <X className="w-3 h-3" />
                        Cancel
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          navigate("/express/buy-trade", {
                            state: { room, openChat: true },
                          })
                        }
                        className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white text-xs font-semibold shadow hover:opacity-90 transition-all"
                      >
                        Continue Chat
                      </button>
                      <button
                        onClick={() =>
                          navigate("/express/buy-trade", { state: { room } })
                        }
                        className="flex-1 px-3 py-2 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/40 text-white text-xs hover:bg-[#1a2540]/60 transition-all"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                )}

                {room.status === "pending" && selectedRoomId !== room.id && (
                  <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-200">
                    ⏳ Waiting for counterparty action
                  </div>
                )}
                {room.status === "payment_confirmed" &&
                  selectedRoomId !== room.id && (
                    <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-200">
                      ✓ Payment confirmed. Assets being transferred...
                    </div>
                  )}
                {room.status === "completed" && selectedRoomId !== room.id && (
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
