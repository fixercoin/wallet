import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Send,
  CheckCircle,
  Clock,
  Copy,
  Check,
  X,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import { listTradeMessages, addTradeMessage } from "@/lib/p2p-api";
import {
  getOrderFromStorage,
  updateOrderInStorage,
} from "@/lib/p2p-order-creation";
import { useOrderNotifications } from "@/hooks/use-order-notifications";
import type { CreatedOrder } from "@/lib/p2p-order-creation";
import type { TradeMessage } from "@/lib/p2p-api";

export default function OrderComplete() {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const { wallet } = useWallet();
  const { createNotification } = useOrderNotifications();

  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<TradeMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [buyerConfirmed, setBuyerConfirmed] = useState(false);
  const [sellerConfirmed, setSellerConfirmed] = useState(false);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(280);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load order from state or storage
  useEffect(() => {
    const stateOrder = location.state?.order as CreatedOrder | undefined;

    if (stateOrder) {
      setOrder(stateOrder);
    } else if (location.state?.orderId) {
      const storedOrder = getOrderFromStorage(location.state.orderId);
      setOrder(storedOrder);
    }

    setLoading(false);
  }, [location.state]);

  // Fetch exchange rate from API (same as BuyData and SellData)
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

  // Load chat messages
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

  // Scroll to bottom only when a NEW message arrives (not on every poll)
  useEffect(() => {
    // Only scroll if message count increased (new message added)
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

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    setCopiedValue(value);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopiedValue(null), 2000);
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
      // Messages will be reloaded by the polling effect
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessageInput(text);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleBuyerConfirm = async () => {
    if (!order || !wallet?.publicKey) return;

    try {
      setBuyerConfirmed(true);
      updateOrderInStorage(order.id, { status: "PENDING" });

      if (order.roomId) {
        await addTradeMessage({
          room_id: order.roomId,
          sender_wallet: wallet.publicKey,
          message: "✅ I have confirmed payment sent",
        });
      }

      // Send notification to seller
      await createNotification(
        order.sellerWallet,
        "payment_confirmed",
        order.type,
        order.id,
        `Buyer confirmed payment for ${order.amountTokens.toFixed(6)} ${order.token}`,
        {
          token: order.token,
          amountTokens: order.amountTokens,
          amountPKR: order.amountPKR,
        },
      );

      toast.success("Payment confirmed!");

      // Check if both confirmed
      if (sellerConfirmed) {
        updateOrderInStorage(order.id, { status: "COMPLETED" });
        toast.success("Order completed! Both parties confirmed.");
      }
    } catch (error) {
      console.error("Error confirming payment:", error);
      toast.error("Failed to confirm");
      setBuyerConfirmed(false);
    }
  };

  const handleSellerConfirm = async () => {
    if (!order || !wallet?.publicKey) return;

    try {
      setSellerConfirmed(true);
      updateOrderInStorage(order.id, { status: "PENDING" });

      if (order.roomId) {
        await addTradeMessage({
          room_id: order.roomId,
          sender_wallet: wallet.publicKey,
          message: "✅ I have confirmed crypto transfer received",
        });
      }

      // Send notification to buyer
      await createNotification(
        order.buyerWallet,
        "received_confirmed",
        order.type,
        order.id,
        `Seller confirmed transfer of ${order.amountTokens.toFixed(6)} ${order.token}`,
        {
          token: order.token,
          amountTokens: order.amountTokens,
          amountPKR: order.amountPKR,
        },
      );

      toast.success("Transfer confirmed!");

      // Check if both confirmed
      if (buyerConfirmed) {
        updateOrderInStorage(order.id, { status: "COMPLETED" });
        toast.success("Order completed! Both parties confirmed.");
      }
    } catch (error) {
      console.error("Error confirming transfer:", error);
      toast.error("Failed to confirm");
      setSellerConfirmed(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order || !wallet?.publicKey) return;

    try {
      updateOrderInStorage(order.id, { status: "CANCELLED" });

      // Send cancellation message to chat
      if (order.roomId) {
        await addTradeMessage({
          room_id: order.roomId,
          sender_wallet: wallet.publicKey,
          message: "❌ Order cancelled",
        });
      }

      // Notify the other party
      const otherParty = isBuyer ? order.sellerWallet : order.buyerWallet;
      await createNotification(
        otherParty,
        "order_cancelled",
        order.type,
        order.id,
        `${isBuyer ? "Buyer" : "Seller"} cancelled the order`,
        {
          token: order.token,
          amountTokens: order.amountTokens,
          amountPKR: order.amountPKR,
        },
      );

      toast.success("Order cancelled and other party notified");
      setTimeout(() => navigate(-1), 1000);
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

  const isBuyer = wallet.publicKey === order.buyerWallet;
  const counterpartyWallet = isBuyer ? order.sellerWallet : order.buyerWallet;

  return (
    <div className="w-full min-h-screen pb-32 bg-gradient-to-t from-[#1a1a1a] to-[#1a1a1a]/95 text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-[#1a1a1a] to-transparent p-4 border-b border-gray-300/20">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-300 hover:text-gray-100 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white font-bold text-lg mt-2 uppercase">
          {isBuyer ? "BUY ORDER" : "SELL ORDER"}
        </h1>
      </div>

      {/* Two-Column Layout */}
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT COLUMN - ORDER DETAILS & CONFIRMATION */}
        <div className="space-y-4">
          {/* Order Details Card */}
          <Card className="bg-[#0f1520]/50 border border-[#FF7A5C]/30">
            <CardContent className="space-y-0 p-0">
              <div className="p-4 border-b border-gray-300/20">
                <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                  Order ID
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-sm text-white/90">
                    {shortenAddress(order.id, 12)}
                  </div>
                  <button
                    onClick={() => handleCopy(order.id, "Order ID")}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {copiedValue === order.id ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="p-4 border-b border-gray-300/20">
                <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                  {isBuyer ? "Seller Wallet" : "Buyer Wallet"}
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-sm text-white/90">
                    {shortenAddress(counterpartyWallet, 12)}
                  </div>
                  <button
                    onClick={() =>
                      handleCopy(counterpartyWallet, "Wallet Address")
                    }
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {copiedValue === counterpartyWallet ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="p-4 border-b border-gray-300/20">
                <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                  Token
                </div>
                <div className="text-sm text-white/90">{order.token}</div>
              </div>

              <div className="p-4 border-b border-gray-300/20">
                <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                  Amount
                </div>
                <div className="text-sm text-white/90">
                  {order.amountTokens.toFixed(6)} {order.token} ={" "}
                  {order.amountPKR.toFixed(0)} PKR
                </div>
              </div>

              <div className="p-4 border-b border-gray-300/20">
                <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                  Price
                </div>
                <div className="text-sm text-white/90">
                  1 {order.token} = {exchangeRate.toFixed(2)} PKR
                </div>
              </div>

              <div className="p-4 border-b border-gray-300/20">
                <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                  Status
                </div>
                <div
                  className={`text-sm font-semibold ${
                    order.status === "COMPLETED"
                      ? "text-green-400"
                      : order.status === "CANCELLED"
                        ? "text-red-400"
                        : "text-yellow-400"
                  }`}
                >
                  {order.status}
                </div>
              </div>

              {isBuyer && order.sellerPaymentMethod && (
                <div className="p-4 border-b border-gray-300/20">
                  <div className="text-xs text-white/70 font-semibold uppercase mb-3">
                    Seller Payment Method
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs text-white/60 uppercase mb-1">
                        Account Name
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-white/90 font-mono">
                          {order.sellerPaymentMethod.accountName}
                        </div>
                        <button
                          onClick={() =>
                            handleCopy(
                              order.sellerPaymentMethod!.accountName,
                              "Account Name",
                            )
                          }
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          {copiedValue ===
                          order.sellerPaymentMethod.accountName ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-white/60 uppercase mb-1">
                        Account Number
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-white/90 font-mono">
                          {order.sellerPaymentMethod.accountNumber}
                        </div>
                        <button
                          onClick={() =>
                            handleCopy(
                              order.sellerPaymentMethod!.accountNumber,
                              "Account Number",
                            )
                          }
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          {copiedValue ===
                          order.sellerPaymentMethod.accountNumber ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Confirmation Status */}
          <div className="space-y-3">
            {isBuyer ? (
              <>
                <div className="p-4 rounded-lg bg-[#1a2540]/30 border border-blue-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold uppercase text-white">
                      Payment Status
                    </span>
                    {buyerConfirmed ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                  {!buyerConfirmed && (
                    <Button
                      onClick={handleBuyerConfirm}
                      className="w-full bg-green-600/30 border border-green-500/50 hover:bg-green-600/40 text-green-400 uppercase text-xs font-semibold py-2"
                    >
                      Confirm Payment Sent
                    </Button>
                  )}
                  {buyerConfirmed && (
                    <div className="text-xs text-green-400 font-semibold">
                      ✓ Payment Confirmed
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-lg bg-[#1a2540]/30 border border-purple-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold uppercase text-white">
                      Seller Status
                    </span>
                    {sellerConfirmed ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                  <div className="text-xs text-white/60 mt-1">
                    {sellerConfirmed
                      ? "✓ Seller confirmed transfer"
                      : "Waiting for seller to confirm"}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 rounded-lg bg-[#1a2540]/30 border border-blue-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold uppercase text-white">
                      Buyer Status
                    </span>
                    {buyerConfirmed ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                  <div className="text-xs text-white/60">
                    {buyerConfirmed
                      ? "✓ Buyer confirmed payment"
                      : "Waiting for buyer to confirm"}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-[#1a2540]/30 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold uppercase text-white">
                      Transfer Status
                    </span>
                    {sellerConfirmed ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                  {!sellerConfirmed && (
                    <Button
                      onClick={handleSellerConfirm}
                      className="w-full bg-purple-600/30 border border-purple-500/50 hover:bg-purple-600/40 text-purple-400 uppercase text-xs font-semibold py-2"
                    >
                      Confirm Transfer Sent
                    </Button>
                  )}
                  {sellerConfirmed && (
                    <div className="text-xs text-purple-400 font-semibold">
                      ✓ Transfer Confirmed
                    </div>
                  )}
                </div>
              </>
            )}

            {order.status === "COMPLETED" && (
              <div className="p-4 rounded-lg bg-green-600/20 border border-green-500/50">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-semibold uppercase">
                    Order Completed
                  </span>
                </div>
              </div>
            )}

            {order.status !== "COMPLETED" && (
              <Button
                onClick={handleCancelOrder}
                className="w-full bg-red-600/20 border border-red-500/50 hover:bg-red-600/30 text-red-400 uppercase text-xs font-semibold py-2"
              >
                Cancel Order
              </Button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN - CHAT */}
        <div className="space-y-4">
          <Card className="bg-[#0f1520]/50 border border-[#FF7A5C]/30 flex flex-col h-full min-h-[600px]">
            <CardContent className="p-4 flex flex-col h-full">
              <h2 className="text-lg font-bold text-white mb-4 uppercase">
                Chat
              </h2>

              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 mb-4 p-3 bg-[#1a2540]/30 rounded-lg border border-white/5">
                {messages.length === 0 ? (
                  <div className="text-center text-white/60 text-xs py-8">
                    No messages yet. Start chatting!
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
                        {msg.sender_wallet === order.buyerWallet
                          ? "BUYER"
                          : "SELLER"}
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
        </div>
      </div>

      {/* Bottom Navigation */}
      <P2PBottomNavigation
        onPaymentClick={() => {}}
        onCreateOfferClick={() => {}}
      />
    </div>
  );
}
