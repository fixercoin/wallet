import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Send, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import { SystemAccountDisplay } from "@/components/p2p/SystemAccountDisplay";
import {
  syncOrderFromStorage,
  updateOrderInBothStorages,
} from "@/lib/p2p-order-api";
import { addTradeMessage, listTradeMessages } from "@/lib/p2p-api";
import { useOrderNotifications } from "@/hooks/use-order-notifications";
import type { CreatedOrder } from "@/lib/p2p-order-creation";
import type { TradeMessage } from "@/lib/p2p-api";

export default function BuyerOrderConfirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const orderId = (location.state as any)?.orderId;
  const { wallet } = useWallet();
  const { createNotification } = useOrderNotifications();

  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState<TradeMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(280);
  const [submitting, setSubmitting] = useState(false);
  const [orderStatus, setOrderStatus] = useState<
    "PENDING" | "ACCEPTED" | "REJECTED"
  >("PENDING");
  const [completionStatus, setCompletionStatus] = useState<
    "PENDING" | "COMPLETED" | "SELLER_COMPLETED"
  >("PENDING");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);

  // Load order
  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) return;

      try {
        const loadedOrder = await syncOrderFromStorage(orderId);
        if (loadedOrder) {
          setOrder(loadedOrder);
          setOrderStatus(
            (loadedOrder.status as "PENDING" | "ACCEPTED" | "REJECTED") ||
              "PENDING",
          );
          // Determine completion status based on confirmation flags
          if (loadedOrder.sellerTransferInitiated) {
            setCompletionStatus("SELLER_COMPLETED");
          } else if (loadedOrder.buyerCryptoReceived) {
            setCompletionStatus("COMPLETED");
          }
        }
      } catch (error) {
        console.error("Error loading order:", error);
        toast.error("Failed to load order");
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderId]);

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

    // Poll for new messages
    const interval = setInterval(loadMessages, 2000);
    return () => clearInterval(interval);
  }, [order?.roomId]);

  // Poll for order updates
  useEffect(() => {
    if (!order?.id) return;

    const pollOrderStatus = async () => {
      try {
        const updatedOrder = await syncOrderFromStorage(order.id);
        if (updatedOrder) {
          console.log(
            `[BuyerOrderConfirmation] Poll update for order ${order.id}:`,
            {
              status: updatedOrder.status,
              sellerTransferInitiated: updatedOrder.sellerTransferInitiated,
              buyerCryptoReceived: updatedOrder.buyerCryptoReceived,
            },
          );
          setOrder(updatedOrder);
          setOrderStatus(
            (updatedOrder.status as "PENDING" | "ACCEPTED" | "REJECTED") ||
              "PENDING",
          );
          if (updatedOrder.buyerCryptoReceived) {
            setCompletionStatus("COMPLETED");
          } else if (updatedOrder.sellerTransferInitiated) {
            console.log(
              `[BuyerOrderConfirmation] ✅ Seller transferred crypto, showing button`,
            );
            setCompletionStatus("SELLER_COMPLETED");
          }
        }
      } catch (error) {
        console.error("Failed to poll order status:", error);
      }
    };

    const interval = setInterval(pollOrderStatus, 1000);
    return () => clearInterval(interval);
  }, [order?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > previousMessageCountRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
    previousMessageCountRef.current = messages.length;
  }, [messages]);

  const shortenAddress = (addr: string, chars = 6): string => {
    if (!addr) return "";
    return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
  };

  const handleCancelOrder = async () => {
    if (!order || !wallet?.publicKey) return;

    setSubmitting(true);
    try {
      // Update order status to REJECTED
      await updateOrderInBothStorages(order.id, {
        status: "REJECTED",
      });

      setOrderStatus("REJECTED");

      // Send message to chat
      if (order.roomId) {
        await addTradeMessage({
          room_id: order.roomId,
          sender_wallet: wallet.publicKey,
          message: "❌ Order cancelled by buyer",
        });
      }

      // Notify seller
      await createNotification(
        order.sellerWallet,
        "order_cancelled_by_buyer",
        order.type,
        order.id,
        "Buyer has cancelled the order",
        {
          token: order.token,
          amountTokens: order.amountTokens,
          amountPKR: order.amountPKR,
        },
      );

      toast.success("Order cancelled");
      setTimeout(() => navigate(-1), 2000);
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast.error("Failed to cancel order");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReceived = async () => {
    if (!order || !wallet?.publicKey) return;

    setSubmitting(true);
    try {
      // Update order to mark buyer has received
      await updateOrderInBothStorages(order.id, {
        buyerCryptoReceived: true,
      });

      setCompletionStatus("COMPLETED");

      // Send message to chat
      if (order.roomId) {
        await addTradeMessage({
          room_id: order.roomId,
          sender_wallet: wallet.publicKey,
          message: "✅ I have received the crypto",
        });
      }

      // Notify seller
      await createNotification(
        order.sellerWallet,
        "order_completed_by_buyer",
        order.type,
        order.id,
        "Buyer has confirmed receipt of crypto",
        {
          token: order.token,
          amountTokens: order.amountTokens,
          amountPKR: order.amountPKR,
        },
      );

      toast.success("Order marked as complete");
    } catch (error) {
      console.error("Error confirming receipt:", error);
      toast.error("Failed to confirm receipt");
    } finally {
      setSubmitting(false);
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
            ORDER CONFIRMATION
          </h1>
          <div className="flex items-center gap-3">
            <div
              className={`text-sm font-bold px-3 py-1 rounded-lg uppercase ${
                orderStatus === "REJECTED"
                  ? "bg-red-600/40 text-red-400"
                  : orderStatus === "ACCEPTED"
                    ? "bg-green-600/40 text-green-400"
                    : "bg-yellow-600/40 text-yellow-400"
              }`}
            >
              {orderStatus}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Order Details */}
        <Card className="bg-[#0f1520]/50 border border-[#FF7A5C]/30 mb-6">
          <CardContent className="p-4">
            <h2 className="text-lg font-bold text-white mb-4 uppercase">
              Order Details
            </h2>
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
                  {shortenAddress(order.id, 8)}
                </div>
              </div>

              <div>
                <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                  Status
                </div>
                <div className="text-xs font-semibold uppercase">
                  {orderStatus === "REJECTED" ? (
                    <span className="text-red-400">Rejected</span>
                  ) : orderStatus === "ACCEPTED" ? (
                    <span className="text-green-400">Accepted</span>
                  ) : (
                    <span className="text-yellow-400">Pending</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Instructions */}
        <Card className="bg-[#0f1520]/50 border border-blue-500/30 mb-6">
          <CardContent className="p-4">
            <h2 className="text-lg font-bold text-white mb-4 uppercase">
              Payment Instructions
            </h2>
            <div className="space-y-4">
              <SystemAccountDisplay type="buyer" />

              <div className="border-t border-blue-500/20 pt-3 mt-3">
                <div className="text-xs text-white/70 font-semibold uppercase mb-3">
                  Seller Details
                </div>

                <div>
                  <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                    Seller Wallet Address
                  </div>
                  <div className="text-xs text-white/90 font-mono break-all">
                    {order.sellerWallet}
                  </div>
                </div>

                {order.payment_method && (
                  <div className="mt-3">
                    <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                      Payment Method
                    </div>
                    <div className="text-sm text-white/90 font-semibold">
                      {order.payment_method}
                    </div>
                  </div>
                )}

                {order.sellerPaymentMethod && (
                  <>
                    <div className="mt-3">
                      <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                        Seller Account Name
                      </div>
                      <div className="text-sm text-white/90">
                        {order.sellerPaymentMethod.accountName}
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                        Seller Account Number
                      </div>
                      <div className="text-sm text-white/90 font-mono break-all">
                        {order.sellerPaymentMethod.accountNumber}
                      </div>
                    </div>
                  </>
                )}

                {!order.sellerPaymentMethod && (
                  <div className="text-xs text-yellow-400/80 italic mt-3">
                    Seller payment method details not yet provided
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

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

        {/* Action Buttons */}
        {orderStatus === "PENDING" && (
          <div className="flex gap-3 mb-6">
            <Button
              onClick={handleCancelOrder}
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-red-600/20 border border-red-500/50 hover:bg-red-600/30 text-red-400 uppercase text-sm font-semibold transition-colors"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel Order
            </Button>
          </div>
        )}

        {/* Confirm Receipt Button (shown after seller transfers) */}
        {completionStatus === "SELLER_COMPLETED" &&
          completionStatus !== "COMPLETED" && (
            <Button
              onClick={handleConfirmReceived}
              disabled={submitting}
              className="w-full px-4 py-3 bg-green-600/20 border border-green-500/50 hover:bg-green-600/30 text-green-400 uppercase text-sm font-semibold transition-colors mb-6"
            >
              <Check className="w-4 h-4 mr-2" />I Have Received Crypto
            </Button>
          )}

        {/* Status Messages */}
        {orderStatus === "PENDING" && (
          <div className="p-4 rounded-lg bg-yellow-600/20 border border-yellow-500/50 mb-6">
            <p className="text-yellow-400 font-semibold uppercase">
              Waiting for Seller Response
            </p>
            <p className="text-yellow-300/80 text-xs mt-1">
              The seller has not yet accepted your order
            </p>
          </div>
        )}

        {orderStatus === "REJECTED" && (
          <div className="p-4 rounded-lg bg-red-600/20 border border-red-500/50 mb-6">
            <p className="text-red-400 font-semibold uppercase">
              Order Rejected
            </p>
            <p className="text-red-300/80 text-xs mt-1">
              This order has been rejected by the seller
            </p>
          </div>
        )}

        {orderStatus === "ACCEPTED" && completionStatus === "PENDING" && (
          <div className="p-4 rounded-lg bg-green-600/20 border border-green-500/50 mb-6">
            <p className="text-green-400 font-semibold uppercase">
              Order Accepted
            </p>
            <p className="text-green-300/80 text-xs mt-1">
              The seller has accepted your order and is preparing the crypto
              transfer
            </p>
          </div>
        )}

        {completionStatus === "SELLER_COMPLETED" && (
          <div className="p-4 rounded-lg bg-blue-600/20 border border-blue-500/50 mb-6">
            <p className="text-blue-400 font-semibold uppercase flex items-center gap-2">
              <Check className="w-5 h-5" />
              Seller Transferred Crypto
            </p>
            <p className="text-blue-300/80 text-xs mt-1">
              Check your wallet for the incoming crypto. Confirm receipt when
              you see it.
            </p>
          </div>
        )}

        {completionStatus === "COMPLETED" && (
          <div className="p-4 rounded-lg bg-green-600/20 border border-green-500/50 mb-6">
            <p className="text-green-400 font-semibold uppercase">
              ✓ Order Complete
            </p>
            <p className="text-green-300/80 text-xs mt-1">
              You have confirmed receipt
            </p>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <P2PBottomNavigation
        onPaymentClick={() => {}}
        onCreateOfferClick={() => {}}
      />
    </div>
  );
}
