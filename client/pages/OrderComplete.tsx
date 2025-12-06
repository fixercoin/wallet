import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Plus, Send, CheckCircle, Clock, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import { useOrderNotifications } from "@/hooks/use-order-notifications";
import {
  saveChatMessage,
  loadChatHistory,
  loadServerChatHistory,
  saveServerChatMessage,
  syncChatMessagesFromServer,
  type ChatMessage,
} from "@/lib/p2p-chat";
import { completeOrder, cancelOrder } from "@/lib/kv-orders-sync";

export default function OrderComplete() {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const { wallet } = useWallet();
  const { toast } = useToast();
  const { createNotification } = useOrderNotifications();

  const order = location.state?.order || null;
  const offer = location.state?.offer || null;
  const orderType = location.state?.orderType || null;
  const confirmation = location.state?.confirmation || null;
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [buyerVerified, setBuyerVerified] = useState(false);
  const [sellerVerified, setSellerVerified] = useState(false);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageCountRef = useRef(0);

  // Ensure roomId is always set from order or location state
  const roomId = order?.id || order?.roomId || "global";

  // Determine if current user is buyer based on wallet
  // If we can't determine, assume the user is a participant
  const isBuyer = order?.buyerWallet
    ? order.buyerWallet === wallet?.publicKey
    : orderType === "BUY" ? true : false;

  // Check if this is a new offer or existing order
  const isNewOffer = offer !== null && order === null;

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    setCopiedValue(value);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
      duration: 2000,
    });
    setTimeout(() => setCopiedValue(null), 2000);
  };

  const shortenAddress = (address: string, chars = 6) => {
    if (!address) return "";
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
  };

  // Initialize chatroom and set up polling when component mounts
  useEffect(() => {
    const initializeChatroom = async () => {
      try {
        // Load chat history from SERVER (source of truth)
        const messages = await loadServerChatHistory(roomId);
        setChatLog(Array.isArray(messages) ? messages : []);
        lastMessageCountRef.current = messages.length;
      } catch (error) {
        console.error("Failed to load chat:", error);
        // Fallback to localStorage
        const messages = loadChatHistory(roomId);
        setChatLog(Array.isArray(messages) ? messages : []);
      } finally {
        setLoading(false);
      }
    };

    // Only initialize if we have valid order and room info
    if (order && roomId && wallet?.publicKey) {
      initializeChatroom();
    } else {
      setLoading(false);
    }
  }, [roomId, order?.id, wallet?.publicKey]);

  // Poll for new messages every 2 seconds to sync with other party
  useEffect(() => {
    if (!order || !roomId || !wallet?.publicKey) return;

    const setupPolling = () => {
      syncIntervalRef.current = setInterval(async () => {
        try {
          const messages = await loadServerChatHistory(roomId);
          // Only update if message count changed
          if (messages.length !== lastMessageCountRef.current) {
            setChatLog(messages);
            lastMessageCountRef.current = messages.length;
          }
        } catch (error) {
          console.error("Failed to sync messages:", error);
        }
      }, 2000); // Poll every 2 seconds
    };

    setupPolling();

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [roomId, order?.id, wallet?.publicKey]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !wallet?.publicKey) return;

    const text = messageInput;
    setMessageInput("");

    try {
      // Save message to SERVER first
      const serverMsg = await saveServerChatMessage(
        roomId,
        wallet.publicKey,
        text,
      );

      if (serverMsg) {
        // Message saved to server, add to local chat
        serverMsg.senderRole = isBuyer ? "buyer" : "seller";
        setChatLog((prev) => [...prev, serverMsg]);
        lastMessageCountRef.current += 1;
      } else {
        // Fallback: save to localStorage if server fails
        const msg: ChatMessage = {
          id: `msg-${Date.now()}`,
          roomId,
          senderWallet: wallet.publicKey,
          senderRole: isBuyer ? "buyer" : "seller",
          type: "message",
          text,
          timestamp: Date.now(),
        };
        setChatLog((prev) => [...prev, msg]);
        saveChatMessage(msg);

        toast({
          title: "Message sent locally",
          description: "Server connection may be unstable",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      // Restore input on error
      setMessageInput(text);
      toast({
        title: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  const handleImageAttachment = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (!wallet?.publicKey) return;

      try {
        // For now, send proof as text message with embedded data (in production, upload to cloud storage)
        // In production, you'd upload to S3/Cloudinary and get a URL
        const msg: ChatMessage = {
          id: `msg-${Date.now()}`,
          roomId,
          senderWallet: wallet.publicKey,
          senderRole: isBuyer ? "buyer" : "seller",
          type: "attachment",
          text: "📎 Proof",
          timestamp: Date.now(),
          metadata: {
            attachmentDataUrl: dataUrl,
            attachmentName: file.name,
          },
        };

        setChatLog((prev) => [...prev, msg]);
        // Save message to localStorage (server doesn't handle attachments yet)
        saveChatMessage(msg);

        toast({
          title: "Proof attached",
          description: "Your proof has been added to the chat",
        });
      } catch (error) {
        console.error("Failed to upload attachment:", error);
        toast({
          title: "Failed to upload proof",
          variant: "destructive",
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVerify = async () => {
    if (!order || !wallet?.publicKey) return;

    const isBuyerAction = isBuyer;
    let newBuyerVerified = buyerVerified;
    let newSellerVerified = sellerVerified;

    if (isBuyerAction) {
      newBuyerVerified = true;
      setBuyerVerified(true);
    } else {
      newSellerVerified = true;
      setSellerVerified(true);
    }

    const verificationText = `${isBuyer ? "Buyer" : "Seller"} has verified and confirmed payment`;

    try {
      // Save verification to server
      const serverMsg = await saveServerChatMessage(
        roomId,
        wallet.publicKey,
        verificationText,
      );

      if (serverMsg) {
        serverMsg.senderRole = isBuyer ? "buyer" : "seller";
        serverMsg.type = "verification";
        setChatLog((prev) => [...prev, serverMsg]);
        lastMessageCountRef.current += 1;
      } else {
        // Fallback to localStorage
        const msg: ChatMessage = {
          id: `msg-${Date.now()}`,
          roomId,
          senderWallet: wallet.publicKey,
          senderRole: isBuyer ? "buyer" : "seller",
          type: "verification",
          text: verificationText,
          timestamp: Date.now(),
          metadata: {
            type: "verification",
          },
        };
        setChatLog((prev) => [...prev, msg]);
        saveChatMessage(msg);
      }

      const otherWalletKey = isBuyerAction
        ? order.sellerWallet
        : order.buyerWallet;

      if (isBuyerAction) {
        await createNotification(
          otherWalletKey,
          "payment_confirmed",
          "BUY",
          order.id,
          "Buyer has confirmed payment",
          {
            token: order.token,
            amountTokens: order.amountTokens,
            amountPKR: order.amountPKR,
          },
        );
      } else {
        await createNotification(
          otherWalletKey,
          "received_confirmed",
          "BUY",
          order.id,
          "Seller has confirmed receiving payment",
          {
            token: order.token,
            amountTokens: order.amountTokens,
            amountPKR: order.amountPKR,
          },
        );
      }

      // If both are now verified, move order to completed
      if (newBuyerVerified && newSellerVerified) {
        try {
          await completeOrder(order, wallet.publicKey);

          toast({
            title: "Order Completed",
            description: "Both parties have verified. Order is now complete.",
          });
        } catch (error) {
          console.error("Failed to move order to completed:", error);
        }
      }

      toast({
        title: "Verification confirmed",
        description: "Your verification has been recorded",
      });
    } catch (error) {
      console.error("Failed to verify:", error);
      toast({
        title: "Verification error",
        description: "Failed to record verification",
        variant: "destructive",
      });
    }
  };

  const handleCancelOrder = async () => {
    if (!order || !wallet?.publicKey) return;

    const confirmed = window.confirm(
      "Are you sure you want to cancel this order? This action cannot be undone.",
    );

    if (!confirmed) return;

    try {
      await cancelOrder(order.id, wallet.publicKey);

      toast({
        title: "Order Cancelled",
        description: "The order has been successfully cancelled.",
      });

      navigate("/p2p");
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast({
        title: "Error",
        description: "Failed to cancel the order.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full min-h-screen pb-32 bg-gradient-to-t from-[#1a1a1a] to-[#1a1a1a]/95 text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-[#1a1a1a] to-transparent p-4">
        <button
          onClick={() => navigate("/p2p")}
          className="text-gray-300 hover:text-gray-100 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white font-bold text-lg mt-2 uppercase">
          ORDER COMPLETE
        </h1>
      </div>

      {/* Two-Column Layout */}
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT COLUMN - VERIFICATION */}
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-[#0f1520]/50 border border-[#FF7A5C]/30">
            <h2 className="text-lg font-bold text-white mb-4 uppercase">
              VERIFICATION STATUS
            </h2>

            {/* Order Details */}
            <div className="space-y-3 mb-6 pb-6 border-b border-white/10">
              <div className="flex justify-between items-start">
                <span className="text-white/70 uppercase text-xs">
                  ORDER ID
                </span>
                <span className="font-mono text-sm text-white/90">
                  {order?.id || "—"}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-white/70 uppercase text-xs">TOKEN</span>
                <span className="text-sm text-white/90">
                  {order?.token || "—"}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-white/70 uppercase text-xs">AMOUNT</span>
                <span className="text-sm text-white/90">
                  {order?.amountPKR || order?.amountTokens || "—"}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-white/70 uppercase text-xs">
                  PAYMENT METHOD
                </span>
                <span className="text-sm text-white/90">
                  {order?.paymentMethod || "—"}
                </span>
              </div>
            </div>

            {/* Buyer Verification */}
            <div className="mb-4 p-3 rounded-lg bg-[#1a2540]/30 border border-blue-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {buyerVerified ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-500" />
                  )}
                  <span className="font-medium uppercase text-sm">
                    BUYER CONFIRMED
                  </span>
                </div>
                {buyerVerified ? (
                  <span className="text-xs text-green-500 font-medium">
                    ✓ VERIFIED
                  </span>
                ) : (
                  <span className="text-xs text-yellow-500 font-medium">
                    PENDING
                  </span>
                )}
              </div>
              {isBuyer && !buyerVerified && (
                <Button
                  onClick={handleVerify}
                  className="w-full mt-3 bg-green-600/30 border border-green-500/50 hover:bg-green-600/40 text-green-400 uppercase text-xs font-semibold"
                >
                  I HAVE PAID FIAT
                </Button>
              )}
            </div>

            {/* Seller Verification */}
            <div className="p-3 rounded-lg bg-[#1a2540]/30 border border-purple-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {sellerVerified ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-500" />
                  )}
                  <span className="font-medium uppercase text-sm">
                    SELLER CONFIRMED
                  </span>
                </div>
                {sellerVerified ? (
                  <span className="text-xs text-green-500 font-medium">
                    ✓ VERIFIED
                  </span>
                ) : (
                  <span className="text-xs text-yellow-500 font-medium">
                    PENDING
                  </span>
                )}
              </div>
              {!isBuyer && !sellerVerified && (
                <Button
                  onClick={handleVerify}
                  className="w-full mt-3 bg-purple-600/30 border border-purple-500/50 hover:bg-purple-600/40 text-purple-400 uppercase text-xs font-semibold"
                >
                  I HAVE TRANSFERRED CRYPTO
                </Button>
              )}
            </div>

            {/* Completion Status */}
            {buyerVerified && sellerVerified && (
              <div className="mt-4 p-3 rounded-lg bg-green-600/20 border border-green-500/50">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium uppercase text-sm">
                    ORDER COMPLETED
                  </span>
                </div>
              </div>
            )}

            {/* Cancel Order Button */}
            {!(buyerVerified && sellerVerified) && (
              <button
                onClick={handleCancelOrder}
                className="w-full mt-4 px-4 py-3 rounded-lg bg-red-600/20 border border-red-500/50 hover:bg-red-600/30 text-red-400 uppercase text-xs font-semibold transition-colors"
              >
                CANCEL ORDER
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN - CHAT */}
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-[#0f1520]/50 border border-[#FF7A5C]/30 flex flex-col h-full min-h-[500px]">
            <h2 className="text-lg font-bold text-white mb-4 uppercase">
              CHAT & PROOF
            </h2>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 mb-4 p-3 bg-[#1a2540]/30 rounded-lg border border-white/5">
              {loading ? (
                <div className="text-center text-white/60 text-xs py-4">
                  Loading messages...
                </div>
              ) : chatLog.length === 0 ? (
                <div className="text-center text-white/60 text-xs py-8">
                  No messages yet. Start chatting with your counterparty!
                </div>
              ) : (
                chatLog.map((msg) => (
                  <div
                    key={msg.id}
                    className={`text-xs p-3 rounded-lg ${
                      msg.senderWallet === wallet?.publicKey
                        ? "bg-[#FF7A5C]/20 text-white/90 ml-4"
                        : "bg-[#1a2540]/50 text-white/70 mr-4"
                    }`}
                  >
                    <div className="font-semibold text-white/80 uppercase text-xs mb-1">
                      {msg.senderRole === "buyer" ? "BUYER" : "SELLER"}
                    </div>
                    <div>{msg.text}</div>
                    {msg.metadata?.attachmentDataUrl && (
                      <div className="mt-2">
                        <img
                          src={msg.metadata.attachmentDataUrl}
                          alt="proof"
                          className="rounded-lg max-h-40 w-full object-cover border border-white/10"
                        />
                      </div>
                    )}
                    <div className="text-xs text-white/50 mt-2">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
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
                  if (e.key === "Enter") handleSendMessage();
                }}
              />
              <input
                id="attach-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  if (f) handleImageAttachment(f);
                  e.currentTarget.value = "";
                }}
              />
              <Button
                type="button"
                onClick={() => document.getElementById("attach-input")?.click()}
                className="px-3 py-2 bg-[#FF7A5C]/20 border border-[#FF7A5C]/50 hover:bg-[#FF7A5C]/30 text-[#FF7A5C]"
                title="Attach proof"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleSendMessage}
                disabled={!messageInput.trim()}
                className="px-3 py-2 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
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
