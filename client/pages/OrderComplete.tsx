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
  const [buyerPaymentConfirmed, setBuyerPaymentConfirmed] = useState(false);
  const [sellerPaymentReceived, setSellerPaymentReceived] = useState(false);
  const [sellerTransferInitiated, setSellerTransferInitiated] = useState(false);
  const [buyerCryptoReceived, setBuyerCryptoReceived] = useState(false);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(280);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load order from state or storage
  useEffect(() => {
    const stateOrder = location.state?.order as CreatedOrder | undefined;

    let loadedOrder: CreatedOrder | null = null;

    if (stateOrder) {
      loadedOrder = stateOrder;
    } else if (location.state?.orderId) {
      loadedOrder = getOrderFromStorage(location.state.orderId);
    }

    if (loadedOrder) {
      setOrder(loadedOrder);
      // Restore confirmation states from stored order
      setBuyerPaymentConfirmed(loadedOrder.buyerPaymentConfirmed ?? false);
      setSellerPaymentReceived(loadedOrder.sellerPaymentReceived ?? false);
      setSellerTransferInitiated(loadedOrder.sellerTransferInitiated ?? false);
      setBuyerCryptoReceived(loadedOrder.buyerCryptoReceived ?? false);
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

  const isBuyer = wallet?.publicKey === order?.buyerWallet;

  const shortenAddress = (addr: string, chars = 6): string => {
    if (!addr) return "";
    return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !order?.roomId || !wallet?.publicKey) return;

    // Validate file type (images only)
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setUploading(true);

    try {
      // Convert image to base64 for storage
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

          // Reset file input
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

  const handleBuyerConfirmPayment = async () => {
    if (!order || !wallet?.publicKey) return;

    try {
      setBuyerPaymentConfirmed(true);
      updateOrderInStorage(order.id, {
        status: "PENDING",
        buyerPaymentConfirmed: true,
      });

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

      toast.success(
        "Payment confirmed! Waiting for seller to transfer crypto...",
      );
    } catch (error) {
      console.error("Error confirming payment:", error);
      toast.error("Failed to confirm");
      setBuyerPaymentConfirmed(false);
    }
  };

  const handleSellerPaymentReceived = async () => {
    if (!order || !wallet?.publicKey) return;

    try {
      setSellerPaymentReceived(true);
      updateOrderInStorage(order.id, { sellerPaymentReceived: true });

      if (order.roomId) {
        await addTradeMessage({
          room_id: order.roomId,
          sender_wallet: wallet.publicKey,
          message: "✅ I have received payment",
        });
      }

      // Send notification to buyer
      await createNotification(
        order.buyerWallet,
        "seller_payment_received",
        order.type,
        order.id,
        `Seller confirmed they received the payment`,
        {
          token: order.token,
          amountTokens: order.amountTokens,
          amountPKR: order.amountPKR,
        },
      );

      toast.success(
        "Payment received confirmed! Now send the crypto transfer...",
      );
    } catch (error) {
      console.error("Error confirming payment received:", error);
      toast.error("Failed to confirm");
      setSellerPaymentReceived(false);
    }
  };

  const handleSellerTransfer = async () => {
    if (!order || !wallet?.publicKey) return;

    try {
      setSellerTransferInitiated(true);
      updateOrderInStorage(order.id, { sellerTransferInitiated: true });

      if (order.roomId) {
        await addTradeMessage({
          room_id: order.roomId,
          sender_wallet: wallet.publicKey,
          message: "✅ I have initiated the crypto transfer",
        });
      }

      // Send notification to buyer
      await createNotification(
        order.buyerWallet,
        "transfer_initiated",
        order.type,
        order.id,
        `Seller initiated crypto transfer of ${order.amountTokens.toFixed(6)} ${order.token}`,
        {
          token: order.token,
          amountTokens: order.amountTokens,
          amountPKR: order.amountPKR,
        },
      );

      toast.success("Transfer initiated! Buyer can now confirm receipt...");
    } catch (error) {
      console.error("Error confirming transfer:", error);
      toast.error("Failed to confirm transfer");
      setSellerTransferInitiated(false);
    }
  };

  const handleBuyerCryptoReceived = async () => {
    if (!order || !wallet?.publicKey) return;

    try {
      setBuyerCryptoReceived(true);
      updateOrderInStorage(order.id, { status: "COMPLETED" });

      if (order.roomId) {
        await addTradeMessage({
          room_id: order.roomId,
          sender_wallet: wallet.publicKey,
          message: "✅ I have received the crypto transfer",
        });
      }

      // Send notification to seller
      await createNotification(
        order.sellerWallet,
        "crypto_received",
        order.type,
        order.id,
        `Buyer confirmed receipt of ${order.amountTokens.toFixed(6)} ${order.token}`,
        {
          token: order.token,
          amountTokens: order.amountTokens,
          amountPKR: order.amountPKR,
        },
      );

      toast.success("Order completed successfully!");

      // Navigate away after 2 seconds
      setTimeout(() => navigate(-1), 2000);
    } catch (error) {
      console.error("Error confirming crypto receipt:", error);
      toast.error("Failed to confirm receipt");
      setBuyerCryptoReceived(false);
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
          {order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
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

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ORDER DETAILS CARD - TOP */}
        <Card className="bg-[#0f1520]/50 border border-[#FF7A5C]/30 mb-6">
          <CardContent className="p-4">
            <h2 className="text-lg font-bold text-white mb-4 uppercase">
              Order Details
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-white/70 font-semibold uppercase mb-1">
                  Order ID
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-xs text-white/90">
                    {shortenAddress(order.id, 8)}
                  </div>
                  <button
                    onClick={() => handleCopy(order.id, "Order ID")}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {copiedValue === order.id ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
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
            </div>

            {!isBuyer && order.sellerPaymentMethod && (
              <div className="mt-4 pt-4 border-t border-gray-300/20">
                <div className="text-xs text-white/70 font-semibold uppercase mb-3">
                  Seller Payment Method
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-white/60 uppercase mb-1">
                      Account Name
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-white/90 font-mono">
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
                    <div className="text-xs text-white/60 uppercase mb-1">
                      Account Number
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-white/90 font-mono">
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* TWO-COLUMN LAYOUT - BUYER & SELLER CONFIRMATIONS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* LEFT COLUMN - BUYER CONFIRMATION */}
          <Card className="bg-[#0f1520]/50 border border-[#FF7A5C]/30">
            <CardContent className="p-4 space-y-3">
              <h2 className="text-lg font-bold text-white uppercase mb-4">
                Buyer Confirmation
              </h2>

              {!isBuyer && (
                <div className="text-xs text-white/60 bg-[#1a2540]/50 p-3 rounded-lg mb-4">
                  Waiting for buyer to confirm payment...
                </div>
              )}

              <div className="p-4 rounded-lg bg-[#1a2540]/30 border border-blue-500/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold uppercase text-white">
                    {isBuyer ? "Your Payment" : "Buyer's Payment"}
                  </span>
                  {buyerPaymentConfirmed ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-500" />
                  )}
                </div>
                {isBuyer && !buyerPaymentConfirmed ? (
                  <Button
                    onClick={handleBuyerConfirmPayment}
                    className="w-full bg-green-600/30 border border-green-500/50 hover:bg-green-600/40 text-green-400 uppercase text-xs font-semibold py-2"
                  >
                    I Have Sent PKR Payment
                  </Button>
                ) : (
                  <div className="text-xs text-green-400 font-semibold">
                    ✓ Payment Confirmed
                  </div>
                )}
              </div>

              {!buyerCryptoReceived && (
                <div className="p-3 bg-blue-600/20 border border-blue-500/30 rounded-lg text-xs text-blue-300">
                  <strong>Step 1:</strong> Buyer confirms payment was sent to
                  seller's account
                </div>
              )}
            </CardContent>
          </Card>

          {/* RIGHT COLUMN - SELLER CONFIRMATION */}
          <Card className="bg-[#0f1520]/50 border border-[#FF7A5C]/30">
            <CardContent className="p-4 space-y-3">
              <h2 className="text-lg font-bold text-white uppercase mb-4">
                Seller Confirmation
              </h2>

              {!buyerPaymentConfirmed && (
                <div className="text-xs text-white/60 bg-[#1a2540]/50 p-3 rounded-lg mb-4">
                  Inactive until buyer confirms payment
                </div>
              )}

              {buyerPaymentConfirmed && (
                <>
                  <div className="p-4 rounded-lg bg-[#1a2540]/30 border border-purple-500/20">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold uppercase text-white">
                        {isBuyer
                          ? "Seller Received Payment"
                          : "You Received Payment"}
                      </span>
                      {sellerPaymentReceived ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-yellow-500" />
                      )}
                    </div>
                    {!isBuyer && !sellerPaymentReceived ? (
                      <Button
                        onClick={handleSellerPaymentReceived}
                        className="w-full bg-purple-600/30 border border-purple-500/50 hover:bg-purple-600/40 text-purple-400 uppercase text-xs font-semibold py-2"
                      >
                        I Have Received Payment
                      </Button>
                    ) : (
                      <div className="text-xs text-purple-400 font-semibold">
                        ✓ Payment Received
                      </div>
                    )}
                  </div>

                  {sellerPaymentReceived && (
                    <div className="p-4 rounded-lg bg-[#1a2540]/30 border border-orange-500/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold uppercase text-white">
                          Crypto Transfer
                        </span>
                        {sellerTransferInitiated ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <Clock className="w-5 h-5 text-yellow-500" />
                        )}
                      </div>
                      {!isBuyer && !sellerTransferInitiated ? (
                        <Button
                          onClick={handleSellerTransfer}
                          className="w-full bg-orange-600/30 border border-orange-500/50 hover:bg-orange-600/40 text-orange-400 uppercase text-xs font-semibold py-2"
                        >
                          Release USDC to Buyer
                        </Button>
                      ) : (
                        <div className="text-xs text-orange-400 font-semibold">
                          ✓ Transfer Initiated
                        </div>
                      )}
                    </div>
                  )}

                  {isBuyer && sellerPaymentReceived && (
                    <div className="p-3 bg-orange-600/20 border border-orange-500/30 rounded-lg text-xs text-orange-300">
                      Waiting for seller to transfer crypto...
                    </div>
                  )}

                  {isBuyer &&
                    sellerTransferInitiated &&
                    !buyerCryptoReceived && (
                      <div className="p-4 rounded-lg bg-[#1a2540]/30 border border-orange-500/20">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold uppercase text-white">
                            You Received Crypto
                          </span>
                          {buyerCryptoReceived ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <Clock className="w-5 h-5 text-yellow-500" />
                          )}
                        </div>
                        <Button
                          onClick={handleBuyerCryptoReceived}
                          className="w-full bg-orange-600/30 border border-orange-500/50 hover:bg-orange-600/40 text-orange-400 uppercase text-xs font-semibold py-2"
                        >
                          I Received USDC
                        </Button>
                      </div>
                    )}

                  {buyerCryptoReceived && (
                    <div className="p-4 rounded-lg bg-green-600/20 border border-green-500/50">
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-semibold uppercase">
                          Order Completed
                        </span>
                      </div>
                    </div>
                  )}

                  {!isBuyer && (
                    <div className="p-3 bg-orange-600/20 border border-orange-500/30 rounded-lg text-xs text-orange-300">
                      <strong>Step 2:</strong> Confirm payment received, then
                      release crypto to buyer
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* FULL-WIDTH CHAT SECTION BELOW */}
        <Card className="bg-[#0f1520]/50 border border-[#FF7A5C]/30">
          <CardContent className="p-4 flex flex-col h-full min-h-[400px]">
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
