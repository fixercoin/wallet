import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { P2POrder } from "@/lib/p2p-api";

interface PendingOrder {
  id: string;
  order: P2POrder;
  createdAt: number;
  expiresAt: number;
  timeRemaining: number;
}

interface AdminNotificationsProps {
  onClose: () => void;
}

export function AdminNotifications({ onClose }: AdminNotificationsProps) {
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [timers, setTimers] = useState<Record<string, number>>({});

  useEffect(() => {
    loadPendingOrders();
    const interval = setInterval(() => {
      setTimers((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          updated[key] = Math.max(0, updated[key] - 1);
          if (updated[key] === 0) {
            handleAutoReject(key);
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadPendingOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/p2p/orders?status=pending_approval");
      if (!response.ok) throw new Error("Failed to load pending orders");

      const data = await response.json();
      const orders = (data.orders || []) as PendingOrder[];
      setPendingOrders(orders);

      const timersObj: Record<string, number> = {};
      orders.forEach((order) => {
        timersObj[order.id] = Math.max(0, order.expiresAt - Date.now());
      });
      setTimers(timersObj);
    } catch (error) {
      console.error("Error loading pending orders:", error);
      toast.error("Failed to load pending orders");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (orderId: string) => {
    try {
      setProcessingId(orderId);
      const response = await fetch(`/api/p2p/orders/${orderId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to approve order");

      toast.success("Order approved!");
      setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (error) {
      console.error("Error approving order:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to approve order",
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (orderId: string) => {
    try {
      setProcessingId(orderId);
      const response = await fetch(`/api/p2p/orders/${orderId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to reject order");

      toast.success("Order rejected!");
      setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (error) {
      console.error("Error rejecting order:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to reject order",
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleAutoReject = async (orderId: string) => {
    try {
      const response = await fetch(`/api/p2p/orders/${orderId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoRejected: true }),
      });

      if (response.ok) {
        setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
        toast.info(`Order ${orderId} auto-rejected after 10 minutes`);
      }
    } catch (error) {
      console.error("Error auto-rejecting order:", error);
    }
  };

  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <Card className="w-full max-w-2xl border border-gray-700/50 bg-gradient-to-br from-gray-900/20 to-gray-900 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-bold text-white uppercase tracking-wider flex-1">
              ADMIN NOTIFICATIONS
            </h2>
            <Badge className="bg-red-500/20 text-red-200 border-red-500/30">
              {pendingOrders.length} Pending
            </Badge>
          </div>
        </div>

        <CardContent className="pt-6 pb-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-gray-400">Loading pending orders...</p>
            </div>
          ) : pendingOrders.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-300 text-lg font-semibold">
                All Orders Approved!
              </p>
              <p className="text-gray-500 text-sm">
                No pending orders requiring approval
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingOrders.map((pending) => {
                const order = pending.order;
                const timeLeft = timers[pending.id] || 0;
                const isExpiring = timeLeft < 60000;

                return (
                  <div
                    key={pending.id}
                    className="border border-gray-700/30 bg-gray-800/40 rounded-lg p-4 space-y-3"
                  >
                    {/* Order Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            className={
                              order.type === "BUY"
                                ? "bg-green-500/20 text-green-300 border-green-500/30"
                                : "bg-purple-500/20 text-purple-300 border-purple-500/30"
                            }
                          >
                            {order.type === "BUY" ? "BUY" : "SELL"}
                          </Badge>
                          <span className="text-sm font-semibold text-gray-200">
                            {order.amountTokens} {order.token}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          Wallet: {order.creator_wallet?.slice(0, 8)}...
                          {order.creator_wallet?.slice(-4)}
                        </p>
                      </div>
                      <div
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                          isExpiring
                            ? "bg-red-900/30 text-red-300 border border-red-500/30"
                            : "bg-yellow-900/30 text-yellow-300 border border-yellow-500/30"
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-mono">
                          {formatTime(timeLeft)}
                        </span>
                      </div>
                    </div>

                    {/* Order Details */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                      <div>
                        <p className="text-gray-500">Price Range:</p>
                        <p className="text-gray-200">
                          {order.minAmountPKR?.toFixed(2)} -{" "}
                          {order.maxAmountPKR?.toFixed(2)} PKR
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Payment:</p>
                        <p className="text-gray-200 capitalize">
                          {order.payment_method?.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>

                    {/* Account Info */}
                    <div className="border-t border-gray-700/30 pt-3 text-xs">
                      <p className="text-gray-500 mb-1">Account Details:</p>
                      <p className="text-gray-200">
                        <span className="text-gray-400">Name:</span>{" "}
                        {order.accountName}
                      </p>
                      <p className="text-gray-200">
                        <span className="text-gray-400">Account #:</span>{" "}
                        {order.accountNumber}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => handleApprove(pending.id)}
                        disabled={processingId !== null}
                        className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold uppercase h-10"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        APPROVE
                      </Button>
                      <Button
                        onClick={() => handleReject(pending.id)}
                        disabled={processingId !== null}
                        className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold uppercase h-10"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        REJECT
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
