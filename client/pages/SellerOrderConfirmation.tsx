import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Send, Check, X, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import {
  syncOrderFromStorage,
  updateOrderInBothStorages,
} from "@/lib/p2p-order-api";
import { addTradeMessage, listTradeMessages, createTradeRoom } from "@/lib/p2p-api";
import { useOrderNotifications } from "@/hooks/use-order-notifications";
import type { CreatedOrder } from "@/lib/p2p-order-creation";
import type { TradeMessage } from "@/lib/p2p-api";

export default function SellerOrderConfirmation() {
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
  const [sellerTransferInitiated, setSellerTransferInitiated] = useState(false);
  const [buyerCryptoReceived, setBuyerCryptoReceived] = useState(false);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);

  const isBuyer = wallet?.publicKey === order?.buyerWallet;

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

  // Load order
  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) {
        console.warn(
          "[SellerOrderConfirmation] No orderId provided in location state",
        );
        setLoading(false);
        return;
      }

      try {
        console.log(`[SellerOrderConfirmation] Loading order: ${orderId}`);
        const loadedOrder = await syncOrderFromStorage(orderId);
        if (loadedOrder) {
          console.log(
            `[SellerOrderConfirmation] ✅ Order loaded successfully: ${orderId}`,
          );
          setOrder(loadedOrder);
          setOrderStatus(
            (loadedOrder.status as "PENDING" | "ACCEPTED" | "REJECTED") ||
              "PENDING",
          );
          setSellerTransferInitiated(
            loadedOrder.sellerTransferInitiated ?? false,
          );
          setBuyerCryptoReceived(loadedOrder.buyerCryptoReceived ?? false);
        } else {
          console.error(
            `[SellerOrderConfirmation] ❌ Failed to load order (not found): ${orderId}`,
          );
          toast.error("Order not found. It may have expired or been deleted.");
        }
      } catch (error) {
        console.error("[SellerOrderConfirmation] Error loading order:", error);
        toast.error("Failed to load order");
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderId]);

  // Poll for order updates
  useEffect(() => {
    if (!order?.id) return;

    const pollOrderStatus = async () => {
      try {
        const updatedOrder = await syncOrderFromStorage(order.id);
        if (updatedOrder) {
          setOrder(updatedOrder);
          setSellerTransferInitiated(
            updatedOrder.sellerTransferInitiated ?? false,
          );
          setBuyerCryptoReceived(updatedOrder.buyerCryptoReceived ?? false);
        }
      } catch (error) {
        console.error("Failed to poll order status:", error);
      }
    };

    const interval = setInterval(pollOrderStatus, 1000);
    return () => clearInterval(interval);
  }, [order?.id]);

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

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > previousMessageCountRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
    previousMessageCountRef.current = messages.length;
  }, [messages]);

  const handleAcceptOrder = async () => {
    if (!order || !wallet?.publicKey) return;

    setSubmitting(true);
    try {
      // Update order status to ACCEPTED
      const updatedOrder = await updateOrderInBothStorages(order.id, {
        status: "ACCEPTED",
        sellerWallet: wallet.publicKey,
      });

      if (updatedOrder) {
        setOrder(updatedOrder);
      }
      setOrderStatus("ACCEPTED");

      // Create trade room if it doesn't exist
      let roomId = order.roomId;
      if (!roomId && order.buyerWallet && wallet.publicKey) {
        try {
          const room = await createTradeRoom({
            buyer_wallet: order.buyerWallet,
            seller_wallet: wallet.publicKey,
            order_id: order.id,
          });
          roomId = room.id;
          await updateOrderInBothStorages(order.id, { roomId });
        } catch (roomError) {
          console.warn("Failed to create trade room:", roomError);
        }
      }

      if (roomId) {
        await addTradeMessage({
          room_id: roomId,
          sender_wallet: wallet.publicKey,
          message: "✅ I have accepted your order",
        });
      }

      // Notify buyer
      await createNotification(
        order.buyerWallet,
        "order_accepted",
        order.type,
        order.id,
        "Seller has accepted your order",
        {
          token: order.token,
          amountTokens: order.amountTokens,
          amountPKR: order.amountPKR,
        },
      );

      toast.success("Order accepted!");
    } catch (error) {
      console.error("Error accepting order:", error);
      toast.error("Failed to accept order");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectOrder = async () => {
    if (!order || !wallet?.publicKey) return;

    setSubmitting(true);
    try {
      const updatedOrder = await updateOrderInBothStorages(order.id, {
        status: "REJECTED",
        sellerWallet: wallet.publicKey,
      });

      if (updatedOrder) {
        setOrder(updatedOrder);
      }
      setOrderStatus("REJECTED");

      if (order.roomId) {
        await addTradeMessage({
          room_id: order.roomId,
          sender_wallet: wallet.publicKey,
          message: "❌ Order rejected",
        });
      }

      await createNotification(
        order.buyerWallet,
        "order_rejected",
        order.type,
        order.id,
        "Seller has rejected your order",
        {
          token: order.token,
          amountTokens: order.amountTokens,
          amountPKR: order.amountPKR,
        },
      );

      toast.success("Order rejected");
      setTimeout(() => navigate(-1), 2000);
    } catch (error) {
      console.error("Error rejecting order:", error);
      toast.error("Failed to reject order");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSellerTransferAsset = async () => {
    if (!order || !wallet?.publicKey) return;

    setSubmitting(true);
    try {
      setSellerTransferInitiated(true);
      await updateOrderInBothStorages(order.id, {
        sellerTransferInitiated: true,
      });

      if (order.roomId) {
        await addTradeMessage({
          room_id: order.roomId,
          sender_wallet: wallet.publicKey,
          message: "✅ I have transferred the crypto asset",
        });
      }

      await createNotification(
        order.buyerWallet,
        "transfer_initiated",
        order.type,
        order.id,
        `Seller has transferred ${order.amountTokens.toFixed(2)} ${order.token}`,
        {
          token: order.token,
          amountTokens: order.amountTokens,
          amountPKR: order.amountPKR,
        },
      );

      toast.success("Asset transfer initiated! Waiting for buyer confirmation...");
    } catch (error) {
      console.error("Error transferring asset:", error);
      toast.error("Failed to transfer asset");
      setSellerTransferInitiated(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBuyerReceivedAsset = async () => {
    if (!order || !wallet?.publicKey) return;

    setSubmitting(true);
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
        order.sellerWallet,
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
            {isBuyer ? "Payment Confirmation" : "Order Confirmation"}
          </h1>
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
                  Type
                </div>
                <div className="text-xs font-semibold uppercase">
                  <span
                    className={
                      order.type === "BUY"
                        ? "text-blue-400"
                        : "text-purple-400"
                    }
                  >
                    {order.type}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* =============== SELLER VIEW =============== */}
        {!isBuyer && (
          <>
            {/* Buyer Full Payment Details */}
            <Card className="bg-[#0f1520]/50 border border-green-500/30 mb-6">
              <CardContent className="p-4">
                <h2 className="text-lg font-bold text-white mb-4 uppercase">
                  Buyer Payment Details
                </h2>
                <div className="space-y-4">
                  {/* Buyer Wallet */}
                  <div>
                    <div className="text-xs text-white/70 font-semibold uppercase mb-2">
                      Buyer Wallet Address
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-[#1a2540]/50 rounded-lg border border-green-500/20">
                      <div className="text-xs text-white/90 font-mono break-all flex-1">
                        {order.buyerWallet}
                      </div>
                      <button
                        onClick={() =>
                          handleCopy(order.buyerWallet, "Buyer wallet address")
                        }
                        className="p-2 hover:bg-white/10 rounded transition-colors flex-shrink-0"
                      >
                        {copiedValue === order.buyerWallet ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-green-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Buyer Payment Method */}
                  {order.buyerPaymentMethod && (
                    <>
                      <div className="border-t border-green-500/20 pt-4">
                        <div className="text-xs text-white/70 font-semibold uppercase mb-2">
                          Buyer Payment Account Name
                        </div>
                        <div className="p-3 bg-[#1a2540]/50 rounded-lg border border-green-500/20">
                          <div className="text-sm text-white/90">
                            {order.buyerPaymentMethod.accountName}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-white/70 font-semibold uppercase mb-2">
                          Buyer Payment Account Number
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-[#1a2540]/50 rounded-lg border border-green-500/20">
                          <div className="text-xs text-white/90 font-mono break-all flex-1">
                            {order.buyerPaymentMethod.accountNumber}
                          </div>
                          <button
                            onClick={() =>
                              handleCopy(
                                order.buyerPaymentMethod.accountNumber,
                                "Account number"
                              )
                            }
                            className="p-2 hover:bg-white/10 rounded transition-colors flex-shrink-0"
                          >
                            {copiedValue ===
                            order.buyerPaymentMethod.accountNumber ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-green-400" />
                            )}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Accept/Reject Buttons (Pending) */}
            {orderStatus === "PENDING" && (
              <div className="flex gap-3 mb-6">
                <Button
                  onClick={handleRejectOrder}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-red-600/20 border border-red-500/50 hover:bg-red-600/30 text-red-400 uppercase text-sm font-semibold transition-colors"
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject Order
                </Button>
                <Button
                  onClick={handleAcceptOrder}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-green-600/20 border border-green-500/50 hover:bg-green-600/30 text-green-400 uppercase text-sm font-semibold transition-colors"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Accept Order
                </Button>
              </div>
            )}

            {/* Transfer Asset Button (After Accepting) */}
            {orderStatus === "ACCEPTED" && !sellerTransferInitiated && (
              <Button
                onClick={handleSellerTransferAsset}
                disabled={submitting}
                className="w-full px-4 py-3 bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600/30 text-blue-400 uppercase text-sm font-semibold transition-colors mb-6"
              >
                <Check className="w-4 h-4 mr-2" />
                I Have Transferred Asset
              </Button>
            )}

            {/* Transfer Initiated Status */}
            {sellerTransferInitiated && (
              <div className="p-4 rounded-lg bg-blue-600/20 border border-blue-500/50 mb-6">
                <p className="text-blue-400 font-semibold uppercase flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  Asset Transferred
                </p>
                <p className="text-blue-300/80 text-xs mt-1">
                  Waiting for buyer to confirm receipt
                </p>
              </div>
            )}

            {/* Completed Status */}
            {buyerCryptoReceived && (
              <div className="p-4 rounded-lg bg-green-600/20 border border-green-500/50 mb-6">
                <p className="text-green-400 font-semibold uppercase flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  Order Complete
                </p>
                <p className="text-green-300/80 text-xs mt-1">
                  Buyer confirmed receiving asset
                </p>
              </div>
            )}
          </>
        )}

        {/* =============== BUYER VIEW =============== */}
        {isBuyer && (
          <>
            {/* Send Crypto To System Wallet - Transparent */}
            <div className="bg-transparent border border-green-500/30 rounded-lg p-4 mb-6">
              <h2 className="text-lg font-bold text-white mb-4 uppercase">
                Send Crypto To System Wallet
              </h2>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-white/70 font-semibold uppercase mb-2">
                    Solana Wallet Address
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-[#0f1520]/50 rounded-lg border border-green-500/20">
                    <div className="text-xs text-white/90 font-mono break-all flex-1">
                      7jnAb5imcmxFiS6iMvgtd5Rf1HHAyASYdqoZAQesJeSw
                    </div>
                    <button
                      onClick={() =>
                        handleCopy(
                          "7jnAb5imcmxFiS6iMvgtd5Rf1HHAyASYdqoZAQesJeSw",
                          "Wallet address"
                        )
                      }
                      className="p-2 hover:bg-white/10 rounded transition-colors flex-shrink-0"
                    >
                      {copiedValue ===
                      "7jnAb5imcmxFiS6iMvgtd5Rf1HHAyASYdqoZAQesJeSw" ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-green-400" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="text-xs text-green-400/80 mt-3">
                  ✓ This is the official system wallet. Send your crypto here
                  to complete the transaction securely.
                </div>
              </div>
            </Card>

            {/* Buyer Received Asset Button (When Seller Transferred) */}
            {sellerTransferInitiated && !buyerCryptoReceived && (
              <Button
                onClick={handleBuyerReceivedAsset}
                disabled={submitting}
                className="w-full px-4 py-3 bg-green-600/20 border border-green-500/50 hover:bg-green-600/30 text-green-400 uppercase text-sm font-semibold transition-colors mb-6"
              >
                <Check className="w-4 h-4 mr-2" />
                I Have Received Asset
              </Button>
            )}

            {/* Status Messages */}
            {sellerTransferInitiated && !buyerCryptoReceived && (
              <div className="p-4 rounded-lg bg-blue-600/20 border border-blue-500/50 mb-6">
                <p className="text-blue-400 font-semibold uppercase flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  Asset Transfer Initiated
                </p>
                <p className="text-blue-300/80 text-xs mt-1">
                  Seller has transferred your crypto. Confirm receipt when you
                  have received it.
                </p>
              </div>
            )}

            {buyerCryptoReceived && (
              <div className="p-4 rounded-lg bg-green-600/20 border border-green-500/50 mb-6">
                <p className="text-green-400 font-semibold uppercase flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  Order Complete
                </p>
                <p className="text-green-300/80 text-xs mt-1">
                  You confirmed receiving the asset. Transaction completed!
                </p>
              </div>
            )}
          </>
        )}

        {/* Chat Section (For Both Buyer and Seller) */}
        {order.roomId && (
          <Card className="bg-[#0f1520]/50 border border-[#FF7A5C]/30 mb-6">
            <CardContent className="p-4 flex flex-col h-full min-h-[300px]">
              <h2 className="text-lg font-bold text-white mb-4 uppercase">
                Chat with {isBuyer ? "Seller" : "Buyer"}
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
                        msg.sender_wallet === wallet?.publicKey
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