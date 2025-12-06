import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Send,
  CheckCircle,
  Copy,
  Check,
  X,
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

  // Load chat messages - polls every 2 seconds
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

    const interval = setInterval(loadMessages, 2000);
    return () => clearInterval(interval);
  }, [order?.roomId]);

  // Scroll to bottom when new message arrives
  useEffect(() => {
    if (messages.length > previousMessageCountRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
    previousMessageCountRef.current = messages.length;
  }, [messages]);

  const isBuyer = wallet?.publicKey === order?.buyerWallet;

  // Derive confirmation states from messages
  const buyerConfirmed = messages.some(
    (msg) =>
      msg.sender_wallet === order?.buyerWallet &&
      msg.message.includes("I have sent PKR payment"),
  );

  const sellerConfirmed = messages.some(
    (msg) =>
      msg.sender_wallet === order?.sellerWallet &&
      msg.message.includes("I have released USDC"),
  );

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !order?.roomId || !wallet?.publicKey) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;

        try {
          await addTradeMessage({
            room_id: order.roomId,
            sender_wallet: wallet.publicKey,
            message: `[Proof Image: ${file.name}]`,
            attachment_url: base64Data,
          });

          toast.success("Proof image uploaded!");

          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        } catch (error) {
          console.error("Failed to upload image:", error);
          toast.error("Failed to upload image");
        } finally {
          setUploading(false);
        }
      };

      reader.onerror = () => {
        console.error("Failed to read file");
        toast.error("Failed to read file");
        setUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
      setUploading(false);
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

  const handleBuyerConfirm = async () => {
    if (!order || !wallet?.publicKey) return;

    try {
      updateOrderInStorage(order.id, { status: "PENDING" });

      if (order.roomId) {
        await addTradeMessage({
          room_id: order.roomId,
          sender_wallet: wallet.publicKey,
          message: "✅ I have sent PKR payment",
        });
      }

      await createNotification(
        order.sellerWallet,
        "payment_confirmed",
        order.type,
        order.id,
        `Buyer sent PKR ${order.amountPKR.toFixed(0)} for ${order.amountTokens.toFixed(6)} ${order.token}`,
        {
          token: order.token,
          amountTokens: order.amountTokens,
          amountPKR: order.amountPKR,
        },
      );

      toast.success("Payment confirmed! Waiting for seller to release USDC...");
    } catch (error) {
      console.error("Error confirming payment:", error);
      toast.error("Failed to confirm payment");
    }
  };

  const handleSellerRelease = async () => {
    if (!order || !wallet?.publicKey) return;

    try {
      updateOrderInStorage(order.id, { status: "COMPLETED" });

      if (order.roomId) {
        await addTradeMessage({
          room_id: order.roomId,
          sender_wallet: wallet.publicKey,
          message: "✅ I have released USDC",
        });
      }

      await createNotification(
        order.buyerWallet,
        "crypto_released",
        order.type,
        order.id,
        `Seller released ${order.amountTokens.toFixed(6)} ${order.token} to your wallet`,
        {
          token: order.token,
          amountTokens: order.amountTokens,
          amountPKR: order.amountPKR,
        },
      );

      toast.success("USDC released! Order completed successfully!");

      setTimeout(() => navigate(-1), 2000);
    } catch (error) {
      console.error("Error releasing USDC:", error);
      toast.error("Failed to release USDC");
    }
  };

  const handleCancelOrder = async () => {
    if (!order || !wallet?.publicKey) return;

    try {
      updateOrderInStorage(order.id, { status: "CANCELLED" });

      if (order.roomId) {
        await addTradeMessage({
          room_id: order.roomId,
          sender_wallet: wallet.publicKey,
          message: "❌ Order cancelled",
        });
      }

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

      toast.success("Order cancelled");
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

  const counterpartyWallet = isBuyer ? order.sellerWallet : order.buyerWallet;

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
            {isBuyer ? "BUY ORDER" : "SELL ORDER"}
          </h1>
          {!sellerConfirmed && (
            <button
              onClick={handleCancelOrder}
              className="relative p-2 rounded-lg hover:bg-red-600/20 transition-colors text-red-400"
              aria-label="Cancel Order"
              title="Cancel order"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Order Details Card */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Card className="bg-[#0f1520]/50 border border-[#FF7A5C]/30 mb-6">
          <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                Order ID
              </div>
              <div className="flex items-center gap-2">
                <div className="font-mono text-sm text-white/90">
                  {shortenAddress(order.id, 8)}
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
              <div className="text-sm text-white/90">
                {order.amountTokens.toFixed(6)} {order.token}
              </div>
            </div>

            <div>
              <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                Price (PKR)
              </div>
              <div className="text-sm text-white/90">
                {order.amountPKR.toFixed(0)} PKR
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Two Column Layout - Buyer and Seller */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* BUYER COLUMN */}
          <Card className={`border ${isBuyer ? "border-blue-500/50" : "border-gray-300/20"} bg-[#0f1520]/50`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white uppercase">
                  {isBuyer ? "Your Payment" : "Buyer Payment"}
                </h2>
                {buyerConfirmed && (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                )}
              </div>

              {isBuyer && !buyerConfirmed && (
                <>
                  <div className="bg-[#1a2540]/50 border border-blue-500/20 rounded-lg p-4 mb-4">
                    <div className="text-sm text-white/80 mb-3">
                      You need to send PKR to the seller's bank account.
                    </div>
                    {order.sellerPaymentMethod && (
                      <div className="space-y-2 text-xs">
                        <div>
                          <div className="text-white/60 uppercase mb-1">
                            Account Name
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="font-mono text-white/90">
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
                                <Check className="w-3 h-3" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div>
                          <div className="text-white/60 uppercase mb-1">
                            Account Number
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="font-mono text-white/90">
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
                                <Check className="w-3 h-3" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleBuyerConfirm}
                    className="w-full bg-blue-600/40 border border-blue-500/50 hover:bg-blue-600/50 text-blue-400 uppercase text-sm font-semibold py-2"
                  >
                    I Have Sent PKR Payment
                  </Button>
                </>
              )}

              {buyerConfirmed && (
                <div className="bg-green-600/20 border border-green-500/50 rounded-lg p-4">
                  <div className="text-green-400 font-semibold text-sm uppercase">
                    ✓ Payment Confirmed
                  </div>
                  <div className="text-white/70 text-xs mt-2">
                    Waiting for seller to release USDC...
                  </div>
                </div>
              )}

              {!isBuyer && (
                <div className="text-white/70 text-sm">
                  {buyerConfirmed
                    ? "Buyer has confirmed payment. You can now release USDC."
                    : "Waiting for buyer to confirm payment..."}
                </div>
              )}
            </CardContent>
          </Card>

          {/* SELLER COLUMN */}
          <Card
            className={`border ${isBuyer ? "border-gray-300/20" : "border-orange-500/50"} bg-[#0f1520]/50`}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white uppercase">
                  {isBuyer ? "Seller Release" : "Your Release"}
                </h2>
                {sellerConfirmed && (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                )}
              </div>

              {!buyerConfirmed && (
                <div className="bg-gray-600/20 border border-gray-500/20 rounded-lg p-4 text-white/60 text-sm">
                  Waiting for buyer to confirm payment first...
                </div>
              )}

              {buyerConfirmed && !sellerConfirmed && !isBuyer && (
                <Button
                  onClick={handleSellerRelease}
                  className="w-full bg-orange-600/40 border border-orange-500/50 hover:bg-orange-600/50 text-orange-400 uppercase text-sm font-semibold py-2"
                >
                  Release {order.amountTokens.toFixed(6)} {order.token}
                </Button>
              )}

              {sellerConfirmed && (
                <div className="bg-green-600/20 border border-green-500/50 rounded-lg p-4">
                  <div className="text-green-400 font-semibold text-sm uppercase">
                    ✓ USDC Released
                  </div>
                  <div className="text-white/70 text-xs mt-2">
                    {order.amountTokens.toFixed(6)} {order.token} transferred to
                    buyer
                  </div>
                </div>
              )}

              {isBuyer && buyerConfirmed && !sellerConfirmed && (
                <div className="text-white/70 text-sm">
                  Waiting for seller to release {order.amountTokens.toFixed(6)}{" "}
                  {order.token}...
                </div>
              )}

              {isBuyer && sellerConfirmed && (
                <div className="bg-green-600/20 border border-green-500/50 rounded-lg p-4">
                  <div className="text-green-400 font-semibold text-sm uppercase">
                    ✓ Order Completed
                  </div>
                  <div className="text-white/70 text-xs mt-2">
                    {order.amountTokens.toFixed(6)} {order.token} is now in your
                    wallet
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* CHAT SECTION - FULL WIDTH */}
        <Card className="bg-[#0f1520]/50 border border-[#FF7A5C]/30">
          <CardContent className="p-4 flex flex-col h-full min-h-[500px]">
            <h2 className="text-lg font-bold text-white mb-4 uppercase">Chat</h2>

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
                    {msg.attachment_url && (
                      <div className="mb-2">
                        <img
                          src={msg.attachment_url}
                          alt="Proof"
                          className="max-w-[200px] rounded-lg"
                        />
                      </div>
                    )}
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
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-3 py-2 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 hover:bg-[#1a2540]/70 text-white disabled:opacity-50 transition-colors"
                title="Upload proof image"
              >
                <Plus className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={uploading}
              />
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

      {/* Bottom Navigation */}
      <P2PBottomNavigation
        onPaymentClick={() => {}}
        onCreateOfferClick={() => {}}
      />
    </div>
  );
}
