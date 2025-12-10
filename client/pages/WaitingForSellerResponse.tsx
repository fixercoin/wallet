import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Clock, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import {
  syncOrderFromStorage,
  updateOrderInBothStorages,
} from "@/lib/p2p-order-api";
import { addTradeMessage, listTradeMessages } from "@/lib/p2p-api";
import { useOrderNotifications } from "@/hooks/use-order-notifications";
import type { CreatedOrder } from "@/lib/p2p-order-creation";
import type { TradeMessage } from "@/lib/p2p-api";

export default function WaitingForSellerResponse() {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const { wallet } = useWallet();
  const { createNotification } = useOrderNotifications();

  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes in seconds
  const [orderTimestamp, setOrderTimestamp] = useState<number | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(280);
  const [messages, setMessages] = useState<TradeMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);
  const [buyerCryptoReceived, setBuyerCryptoReceived] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);

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
        const response = await fetch("/api/token/price?token=USDC");
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
          // If seller has responded (status changed), navigate to appropriate page
          if (updatedOrder.status === "REJECTED") {
            toast.error("Seller rejected your order");
            setTimeout(() => navigate("/"), 2000);
          } else if (
            updatedOrder.status === "ACCEPTED" ||
            updatedOrder.sellerPaymentReceived
          ) {
            navigate("/order-complete", {
              state: { order: updatedOrder },
            });
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

  // Load messages
  useEffect(() => {
    const loadMessages = async () => {
      if (!order?.roomId) return;

      try {
        const msgs = await listTradeMessages(order.roomId);
        setMessages(Array.isArray(msgs) ? msgs : []);
      } catch (error) {
        console.error("Failed to load messages:", error);
      }
    };

    loadMessages();

    // Poll for new messages every 2 seconds
    const interval = setInterval(loadMessages, 2000);
    return () => clearInterval(interval);
  }, [order?.roomId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > previousMessageCountRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
    previousMessageCountRef.current = messages.length;
  }, [messages]);

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
          message: "❌ Order cancelled by buyer",
        });
      }

      toast.success("Order cancelled");
      setTimeout(() => navigate("/"), 1000);
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast.error("Failed to cancel order");
    }
  };

  const handleBuyerReceivedAsset = async () => {
    if (!order || !wallet?.publicKey) return;

    setConfirmingReceipt(true);
    try {
      setBuyerCryptoReceived(true);
      await updateOrderInBothStorages(order.id, {
        buyerCryptoReceived: true,
        status: "COMPLETED",
      });

      if (order.roomId) {
        await addTradeMessage({
          room_id: order.roomId,
          sender_wallet: wallet.publicKey,
          message: "✅ I have received the crypto asset",
        });
      }

      await createNotification(
        order.sellerWallet || "",
        "crypto_received",
        order.type,
        order.id,
        "Buyer confirmed receiving the crypto",
        {
          token: order.token,
          amountTokens: order.amountTokens,
          amountPKR: order.amountPKR,
        },
      );

      toast.success("Order completed successfully!");
    } catch (error) {
      console.error("Error confirming receipt:", error);
      toast.error("Failed to confirm receipt");
      setBuyerCryptoReceived(false);
    } finally {
      setConfirmingReceipt(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !order?.roomId || !wallet?.publicKey) return;

    const text = messageInput;
    setMessageInput("");
    setSending(true);

    try {
      await addTradeMessage({
        room_id: order.roomId,
        sender_wallet: wallet.publicKey,
        message: text,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessageInput(text);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
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
            WAITING FOR SELLER
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
              Waiting for Seller
            </h2>
            <p className="text-white/70 mb-4">
              Your order has been created and a notification has been sent to
              the seller. Please wait for their response.
            </p>
            <p className="text-sm text-white/60">
              Order will auto-cancel if seller doesn't respond within{" "}
              {formatTimeRemaining(timeRemaining)}
            </p>
          </CardContent>
        </Card>

        {/* Seller Actions Notifications */}
        {(order.sellerPaymentReceived || order.sellerTransferInitiated) && (
          <Card className="bg-green-600/20 border border-green-500/30 mb-6">
            <CardContent className="p-4">
              <div className="space-y-2">
                {order.sellerPaymentReceived && (
                  <div className="flex items-start gap-3">
                    <span className="text-green-400 font-bold text-lg">✓</span>
                    <div>
                      <p className="text-sm font-semibold text-green-300">
                        Seller Confirmed Payment Received
                      </p>
                      <p className="text-xs text-green-200/70">
                        The seller has confirmed receiving your payment. They
                        are preparing to send your crypto.
                      </p>
                    </div>
                  </div>
                )}
                {order.sellerTransferInitiated && (
                  <div className="flex items-start gap-3">
                    <span className="text-green-400 font-bold text-lg">✓</span>
                    <div>
                      <p className="text-sm font-semibold text-green-300">
                        Crypto Transfer Started
                      </p>
                      <p className="text-xs text-green-200/70">
                        The seller has sent your crypto to your wallet. Please
                        check your wallet for the incoming transaction.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Buyer Confirm Receipt Button */}
        {order.sellerTransferInitiated && !buyerCryptoReceived && (
          <Button
            onClick={handleBuyerReceivedAsset}
            disabled={confirmingReceipt}
            className="w-full px-4 py-3 bg-green-600/20 border border-green-500/50 hover:bg-green-600/30 text-green-400 uppercase text-sm font-semibold transition-colors mb-6"
          >
            {confirmingReceipt ? "Confirming..." : "I Have Received Crypto"}
          </Button>
        )}

        {/* Order Completed Status */}
        {buyerCryptoReceived && (
          <Card className="bg-green-600/20 border border-green-500/30 mb-6">
            <CardContent className="p-4">
              <p className="text-green-400 font-semibold uppercase flex items-center gap-2">
                <span className="text-lg">✓</span>
                Order Complete
              </p>
              <p className="text-green-300/80 text-xs mt-2">
                You confirmed receiving the asset. Transaction completed!
              </p>
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
                  Your Wallet Address
                </div>
                <div className="text-xs text-white/90 font-mono break-all">
                  {order.buyerWallet}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method Info */}
        {order.sellerPaymentMethod && (
          <Card className="bg-[#0f1520]/50 border border-green-500/30 mb-6">
            <CardContent className="p-4">
              <h3 className="text-lg font-bold text-white mb-4 uppercase">
                Your Payment Method
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                    Account Name
                  </div>
                  <div className="text-sm text-white/90">
                    {order.sellerPaymentMethod.accountName}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                    Account Number
                  </div>
                  <div className="text-sm text-white/90 font-mono">
                    {order.sellerPaymentMethod.accountNumber}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Messages Chat */}
        <Card className="bg-[#0f1520]/50 border border-[#FF7A5C]/30 mb-6">
          <CardContent className="p-4 flex flex-col h-full min-h-[300px]">
            <h2 className="text-lg font-bold text-white mb-4 uppercase">
              Messages
            </h2>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 mb-4 p-3 bg-[#1a2540]/30 rounded-lg border border-white/5">
              {messages.length === 0 ? (
                <div className="text-center text-white/60 text-xs py-8">
                  No messages yet. Send a message to start chatting!
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`text-xs p-3 rounded-lg ${
                      msg.sender_wallet === wallet.publicKey
                        ? "bg-[#FF7A5C]/20 text-white/90 ml-4"
                        : "bg-[#1a2540]/50 text-white/70 mr-4"
                    }`}
                  >
                    <div className="font-semibold text-white/80 uppercase text-xs mb-1">
                      {msg.sender_wallet === order.sellerWallet
                        ? "SELLER"
                        : "YOU"}
                    </div>
                    <div className="break-words">{msg.message}</div>
                    <div className="text-xs text-white/50 mt-2">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="flex-1 px-3 py-2 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white placeholder-white/40 text-sm"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !sending) {
                    handleSendMessage();
                  }
                }}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!messageInput.trim() || sending}
                className="px-3 py-2 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

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
