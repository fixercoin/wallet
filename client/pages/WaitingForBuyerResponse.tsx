import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import {
  syncOrderFromStorage,
  updateOrderInBothStorages,
} from "@/lib/p2p-order-api";
import { addTradeMessage } from "@/lib/p2p-api";
import { useOrderNotifications } from "@/hooks/use-order-notifications";
import type { CreatedOrder } from "@/lib/p2p-order-creation";

export default function WaitingForBuyerResponse() {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const { wallet } = useWallet();
  const { createNotification } = useOrderNotifications();

  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes in seconds
  const [orderTimestamp, setOrderTimestamp] = useState<number | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(280);

  // Load order from state or storage
  useEffect(() => {
    const loadOrder = async () => {
      const stateOrder = location.state?.order as CreatedOrder | undefined;

      let loadedOrder: CreatedOrder | null = null;

      if (stateOrder) {
        loadedOrder = stateOrder;
      } else if (location.state?.orderId) {
        loadedOrder = await syncOrderFromStorage(location.state.orderId);
      }

      if (loadedOrder) {
        setOrder(loadedOrder);
        const timestamp =
          loadedOrder.createdAt &&
          !isNaN(new Date(loadedOrder.createdAt).getTime())
            ? new Date(loadedOrder.createdAt).getTime()
            : Date.now();
        setOrderTimestamp(timestamp);
      }

      setLoading(false);
    };

    loadOrder();
  }, [location.state]);

  // Fetch exchange rate
  useEffect(() => {
    const fetchRate = async () => {
      try {
        const response = await fetch("/api/token/price?token=USDT");
        if (!response.ok) throw new Error("Failed to fetch rate");
        const data = await response.json();
        const rate = data.rate || data.priceInPKR || 280;
        setExchangeRate(typeof rate === "number" && rate > 0 ? rate : 280);
      } catch (error) {
        console.error("Exchange rate error:", error);
        setExchangeRate(280);
      }
    };

    fetchRate();
  }, []);

  // Poll for order status updates
  useEffect(() => {
    if (!order?.id) return;

    const pollOrderStatus = async () => {
      try {
        const updatedOrder = await syncOrderFromStorage(order.id);
        if (updatedOrder) {
          setOrder(updatedOrder);
          // If buyer has responded (status changed), navigate to appropriate page
          if (updatedOrder.status === "REJECTED") {
            toast.error("Buyer rejected your order");
            setTimeout(() => navigate("/"), 2000);
          } else if (
            updatedOrder.status === "ACCEPTED" ||
            updatedOrder.buyerPaymentReceived
          ) {
            toast.success("Buyer accepted your order!");
            setTimeout(() => navigate("/"), 2000);
          }
        }
      } catch (error) {
        console.error("Failed to poll order status:", error);
      }
    };

    const interval = setInterval(pollOrderStatus, 1000);
    return () => clearInterval(interval);
  }, [order?.id, navigate]);

  // Timer countdown
  useEffect(() => {
    if (!orderTimestamp) return;

    const timerInterval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - orderTimestamp) / 1000);
      const remaining = Math.max(0, 600 - elapsedSeconds);

      setTimeRemaining(remaining);

      // Auto-cancel when timer reaches 0
      if (
        remaining === 0 &&
        order &&
        order.status !== "COMPLETED" &&
        order.status !== "CANCELLED"
      ) {
        handleCancelOrder();
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [orderTimestamp, order]);

  const formatTimeRemaining = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCancelOrder = async () => {
    if (!order || !wallet?.publicKey) return;

    try {
      await updateOrderInBothStorages(order.id, {
        status: "CANCELLED",
      });

      if (order.roomId) {
        await addTradeMessage({
          room_id: order.roomId,
          sender_wallet: wallet.publicKey,
          message: "❌ Order cancelled by seller",
        });
      }

      toast.success("Order cancelled");
      setTimeout(() => navigate("/"), 1000);
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast.error("Failed to cancel order");
    }
  };

  if (!wallet) {
    return (
      <div className="w-full min-h-screen pb-24 bg-gradient-to-t from-[#1a1a1a] to-[#1a1a1a]/95">
        <div className="text-center pt-20 text-white/70">
          Please connect your wallet first
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full min-h-screen pb-24 bg-gradient-to-t from-[#1a1a1a] to-[#1a1a1a]/95">
        <div className="text-center pt-20 text-white/70">Loading order...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="w-full min-h-screen pb-24 bg-gradient-to-t from-[#1a1a1a] to-[#1a1a1a]/95">
        <div className="text-center pt-20 text-white/70">Order not found</div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen pb-32 bg-gradient-to-t from-[#1a1a1a] to-[#1a1a1a]/95 text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-[#1a1a1a] to-transparent p-4 border-b border-gray-300/20">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-300 hover:text-gray-100 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-white font-bold text-lg uppercase flex-1 ml-4">
            WAITING FOR BUYER
          </h1>
          <div className="flex items-center gap-3">
            <div
              className={`text-sm font-bold px-3 py-1 rounded-lg ${
                timeRemaining <= 60
                  ? "bg-red-600/40 text-red-400"
                  : "bg-[#FF7A5C]/20 text-[#FF7A5C]"
              }`}
            >
              {formatTimeRemaining(timeRemaining)}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Waiting Message */}
        <Card className="bg-[#0f1520]/50 border border-blue-500/30 mb-6">
          <CardContent className="p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="relative w-16 h-16">
                <Clock className="w-16 h-16 text-blue-400 animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 uppercase">
              Waiting for Buyer
            </h2>
            <p className="text-white/70 mb-4">
              Your offer has been sent to the buyer. Please wait for their
              response.
            </p>
            <p className="text-sm text-white/60">
              Order will auto-cancel if buyer doesn't respond within{" "}
              {formatTimeRemaining(timeRemaining)}
            </p>
          </CardContent>
        </Card>

        {/* Buyer Actions Notifications */}
        {(order.buyerPaymentConfirmed || order.buyerReceivedCrypto) && (
          <Card className="bg-green-600/20 border border-green-500/30 mb-6">
            <CardContent className="p-4">
              <div className="space-y-2">
                {order.buyerPaymentConfirmed && (
                  <div className="flex items-start gap-3">
                    <span className="text-green-400 font-bold text-lg">✓</span>
                    <div>
                      <p className="text-sm font-semibold text-green-300">
                        Buyer Confirmed Payment Sent
                      </p>
                      <p className="text-xs text-green-200/70">
                        The buyer has sent their payment. You can now transfer the crypto to their wallet.
                      </p>
                    </div>
                  </div>
                )}
                {order.buyerReceivedCrypto && (
                  <div className="flex items-start gap-3">
                    <span className="text-green-400 font-bold text-lg">✓</span>
                    <div>
                      <p className="text-sm font-semibold text-green-300">
                        Buyer Confirmed Crypto Received
                      </p>
                      <p className="text-xs text-green-200/70">
                        The buyer has confirmed receiving the crypto. The order is now complete!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Details */}
        <Card className="bg-[#0f1520]/50 border border-[#FF7A5C]/30 mb-6">
          <CardContent className="p-4">
            <h3 className="text-lg font-bold text-white mb-4 uppercase">
              Order Details
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                  Token
                </div>
                <div className="text-sm text-white/90">{order.token}</div>
              </div>

              <div>
                <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                  Amount
                </div>
                <div className="text-xs text-white/90">
                  {order.amountTokens.toFixed(6)} {order.token}
                </div>
              </div>

              <div>
                <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                  Price
                </div>
                <div className="text-xs text-white/90">
                  1 {order.token} = {exchangeRate.toFixed(2)} PKR
                </div>
              </div>

              <div>
                <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                  Total PKR
                </div>
                <div className="text-xs text-white/90 font-semibold">
                  {(order.amountTokens * exchangeRate).toFixed(2)} PKR
                </div>
              </div>

              <div>
                <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                  Order ID
                </div>
                <div className="text-xs text-white/90 font-mono">
                  {order.id.slice(0, 8)}...
                </div>
              </div>

              <div>
                <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                  Status
                </div>
                <div className="text-xs text-blue-400 font-semibold uppercase">
                  Pending
                </div>
              </div>

              <div className="col-span-2 md:col-span-3">
                <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                  Seller Wallet Address
                </div>
                <div className="text-xs text-white/90 font-mono break-all">
                  {order.sellerWallet}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Buyer Payment Method Info */}
        {order.buyerPaymentMethod && (
          <Card className="bg-[#0f1520]/50 border border-green-500/30 mb-6">
            <CardContent className="p-4">
              <h3 className="text-lg font-bold text-white mb-4 uppercase">
                Buyer Payment Method
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                    Account Name
                  </div>
                  <div className="text-sm text-white/90">
                    {order.buyerPaymentMethod.accountName}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                    Account Number
                  </div>
                  <div className="text-sm text-white/90 font-mono">
                    {order.buyerPaymentMethod.accountNumber}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cancel Button */}
        <Button
          onClick={handleCancelOrder}
          className="w-full px-4 py-3 bg-red-600/20 border border-red-500/50 hover:bg-red-600/30 text-red-400 uppercase text-sm font-semibold transition-colors"
        >
          <X className="w-4 h-4 mr-2" />
          Cancel Order
        </Button>
      </div>

      {/* Bottom Navigation */}
      <P2PBottomNavigation
        onPaymentClick={() => {}}
        onCreateOfferClick={() => {}}
      />
    </div>
  );
}
