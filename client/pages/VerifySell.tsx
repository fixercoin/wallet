import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  Clock,
  Copy,
  Send,
  Plus,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import { API_BASE } from "@/lib/p2p";
import { copyToClipboard, shortenAddress } from "@/lib/wallet";
import {
  getPaymentReceivedNotifications,
  clearNotificationsForRoom,
  saveChatMessage,
  loadChatHistory,
  loadServerChatHistory,
  saveServerChatMessage,
  sendChatMessage,
  broadcastNotification,
  saveNotification,
  parseWebSocketMessage,
  type ChatMessage,
  type ChatNotification,
} from "@/lib/p2p-chat";

export default function VerifySell() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet } = useWallet();

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [phase, setPhase] = useState<
    "select" | "verify" | "chat" | "completed"
  >("select");
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState<string>("");
  const [buyerConfirmed, setBuyerConfirmed] = useState(false);
  const [sellerConfirmed, setSellerConfirmed] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<
    string | undefined
  >();
  const [showCreateOfferDialog, setShowCreateOfferDialog] = useState(false);
  const [offerPassword, setOfferPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageCountRef = useRef(0);

  const OFFER_PASSWORD = "######Pakistan";

  const handleOfferAction = (action: "buy" | "sell") => {
    if (offerPassword !== OFFER_PASSWORD) {
      setPasswordError("Invalid password");
      return;
    }
    setShowCreateOfferDialog(false);
    setOfferPassword("");
    setPasswordError("");
    navigate(action === "buy" ? "/buy-crypto" : "/sell-now");
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  useEffect(() => {
    if (!wallet?.publicKey) return;

    const notifications = getPaymentReceivedNotifications(wallet.publicKey);
    const ordersList = notifications.map((notif) => ({
      id: notif.data?.orderId || notif.roomId,
      roomId: notif.roomId,
      token: notif.data?.token || "USDC",
      amountPKR: notif.data?.amountPKR || 0,
      amountTokens: notif.data?.estimatedTokens || 0,
      buyerWallet: notif.initiatorWallet,
      timestamp: notif.timestamp,
    }));

    setOrders(ordersList);

    if (ordersList.length > 0 && !selectedOrderId) {
      setSelectedOrderId(ordersList[0].id);
    }
  }, [wallet?.publicKey]);

  useEffect(() => {
    if (!selectedOrder) return;

    const loadHistory = async () => {
      try {
        // Load from server (source of truth)
        const history = await loadServerChatHistory(selectedOrder.roomId);
        setChatLog(history);
        lastMessageCountRef.current = history.length;
      } catch {
        // Fallback to localStorage
        const history = loadChatHistory(selectedOrder.roomId);
        setChatLog(history);
        lastMessageCountRef.current = history.length;
      }
    };

    loadHistory();
  }, [selectedOrder]);

  // Poll for new messages every 2 seconds
  useEffect(() => {
    if (!selectedOrder) return;

    const setupPolling = () => {
      syncIntervalRef.current = setInterval(async () => {
        try {
          const messages = await loadServerChatHistory(selectedOrder.roomId);
          if (messages.length !== lastMessageCountRef.current) {
            setChatLog(messages);
            lastMessageCountRef.current = messages.length;
          }
        } catch (error) {
          // Silently fail on poll errors
        }
      }, 2000);
    };

    setupPolling();

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [selectedOrder]);

  const moveOrderToCompleted = () => {
    try {
      const completedRaw = localStorage.getItem("orders_completed");
      const completed = completedRaw ? JSON.parse(completedRaw) : [];
      const orderToSave = selectedOrder
        ? { ...selectedOrder, status: "completed", completedAt: Date.now() }
        : null;
      if (orderToSave) {
        completed.unshift(orderToSave);
        localStorage.setItem("orders_completed", JSON.stringify(completed));
      }
    } catch (e) {
      console.error("Failed to save completed order", e);
    }
  };

  const handleVerified = async () => {
    if (!selectedOrder || !wallet?.publicKey) return;
    setLoading(true);

    try {
      setPhase("chat");

      const text = "Seller verified payment. Ready to transfer assets.";

      // Save to server
      const serverMsg = await saveServerChatMessage(
        selectedOrder.roomId,
        wallet.publicKey,
        text,
      );

      if (serverMsg) {
        serverMsg.senderRole = "seller";
        serverMsg.type = "seller_verified";
        setChatLog((prev) => [...prev, serverMsg]);
        lastMessageCountRef.current += 1;
      } else {
        // Fallback
        const message: ChatMessage = {
          id: `msg-${Date.now()}`,
          roomId: selectedOrder.roomId,
          senderWallet: wallet.publicKey,
          senderRole: "seller",
          type: "seller_verified",
          text,
          timestamp: Date.now(),
        };
        saveChatMessage(message);
        setChatLog((prev) => [...prev, message]);
      }

      const notification: ChatNotification = {
        type: "status_change",
        roomId: selectedOrder.roomId,
        initiatorWallet: wallet.publicKey,
        initiatorRole: "seller",
        message: "Seller verified payment",
        timestamp: Date.now(),
      };

      saveNotification(notification);

      toast({
        title: "Payment Verified",
        description: "Chat opened for asset transfer",
      });
    } catch (error: any) {
      setPhase("verify");
      toast({
        title: "Failed to verify",
        description: error?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedOrder || !wallet) return;

    const text = messageInput.trim();
    setMessageInput("");

    try {
      // Save to server
      const serverMsg = await saveServerChatMessage(
        selectedOrder.roomId,
        wallet.publicKey,
        text,
      );

      if (serverMsg) {
        serverMsg.senderRole = "seller";
        setChatLog((prev) => [...prev, serverMsg]);
        lastMessageCountRef.current += 1;
      } else {
        // Fallback
        const message: ChatMessage = {
          id: `msg-${Date.now()}`,
          roomId: selectedOrder.roomId,
          senderWallet: wallet.publicKey,
          senderRole: "seller",
          type: "text",
          text,
          timestamp: Date.now(),
        };
        saveChatMessage(message);
        setChatLog((prev) => [...prev, message]);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessageInput(text);
    }
  };

  const handleCompleted = async () => {
    if (!selectedOrder || !wallet) return;
    setLoading(true);

    try {
      const message: ChatMessage = {
        id: `msg-${Date.now()}`,
        roomId: selectedOrder.roomId,
        senderWallet: wallet.publicKey,
        senderRole: "seller",
        type: "seller_completed",
        text: "Seller has completed transfer of assets",
        timestamp: Date.now(),
      };

      saveChatMessage(message);
      setChatLog((prev) => [...prev, message]);
      setSellerConfirmed(true);

      toast({
        title: "Transfer Complete",
        description: "Waiting for buyer confirmation...",
      });
    } catch (error: any) {
      toast({
        title: "Failed to confirm",
        description: error?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (phase === "chat" || phase === "verify") {
      setPhase("select");
      setSelectedOrderId(null);
    } else {
      navigate("/express/pending-orders");
    }
  };

  async function resizeImageToDataUrl(
    file: File,
    maxDim = 1024,
    quality = 0.8,
  ): Promise<string> {
    const img = document.createElement("img");
    const fileUrl = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = fileUrl;
      });
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unsupported");
      ctx.drawImage(img, 0, 0, width, height);
      return canvas.toDataURL("image/jpeg", quality);
    } finally {
      URL.revokeObjectURL(fileUrl);
    }
  }

  async function handleImageAttachment(file: File) {
    if (!file || !selectedOrder || !wallet) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const message: ChatMessage = {
        id: `msg-${Date.now()}`,
        roomId: selectedOrder.roomId,
        senderWallet: wallet.publicKey,
        senderRole: "seller",
        type: "attachment",
        text: "Sent a proof image",
        metadata: { attachmentDataUrl: dataUrl, filename: file.name },
        timestamp: Date.now(),
      };
      const serverMsg = await saveServerChatMessage(
        selectedOrder.roomId,
        wallet.publicKey,
        message.text,
      );

      if (serverMsg) {
        serverMsg.senderRole = "seller";
        serverMsg.type = "attachment";
        serverMsg.metadata = { attachmentDataUrl: dataUrl, filename: file.name };
        setChatLog((prev) => [...prev, serverMsg]);
        lastMessageCountRef.current += 1;
      } else {
        saveChatMessage(message);
        setChatLog((prev) => [...prev, message]);
      }
    } catch (e) {
      console.error("Attachment failed", e);
      toast({
        title: "Upload failed",
        description: "Could not attach image",
        variant: "destructive",
      });
    }
  }

  // Select Phase
  if (phase === "select" || orders.length === 0) {
    return (
      <div
        className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden"
        style={{ fontSize: "10px" }}
      >
        <div className="bg-gradient-to-r from-[#1a2847]/95 to-[#16223a]/95 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 py-3 flex items-center">
            <button
              onClick={() => navigate("/express/pending-orders")}
              className="p-2 hover:bg-[#1a2540]/50 rounded-lg transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-[#FF7A5C]" />
            </button>
            <div className="flex-1 text-center font-semibold">
              Verify Payments
            </div>
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 py-10">
          {orders.length === 0 ? (
            <Card className="bg-transparent backdrop-blur-xl rounded-md">
              <CardContent className="pt-10 pb-10 text-center">
                <Clock className="w-12 h-12 mx-auto text-white/40 mb-4" />
                <div className="text-white/80">
                  No pending payment verifications.
                </div>
                <Button
                  onClick={() => navigate("/express/pending-orders")}
                  className="mt-4 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white"
                >
                  Go back
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => {
                    setSelectedOrderId(order.id);
                    setPhase("verify");
                  }}
                  className="w-full p-4 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 hover:border-[#FF7A5C] hover:bg-[#1a2540]/70 transition-all text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white">
                      {order.token}
                    </span>
                    <span className="text-xs text-white/60">
                      {Number(order.amountTokens).toFixed(6)} {order.token}
                    </span>
                  </div>
                  <div className="text-xs text-white/80">
                    {Number(order.amountPKR).toFixed(2)} PKR
                  </div>
                  <div className="text-[9px] text-white/60 mt-1">
                    From: {shortenAddress(order.buyerWallet)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Verify Phase
  if (phase === "verify" && selectedOrder) {
    return (
      <div
        className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white"
        style={{ fontSize: "10px" }}
      >
        <div className="bg-gradient-to-r from-[#1a2847]/95 to-[#16223a]/95 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 py-3 flex items-center">
            <button
              onClick={goBack}
              className="p-2 hover:bg-[#1a2540]/50 rounded-lg transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-[#FF7A5C]" />
            </button>
            <div className="flex-1 text-center font-semibold">
              Verify Payment
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 py-6">
          <Card className="bg-transparent backdrop-blur-xl rounded-md">
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-[#FF7A5C]/20 to-[#FF5A8C]/20 border border-[#FF7A5C]/30">
                <Clock className="w-5 h-5 text-[#FF7A5C] flex-shrink-0" />
                <div className="text-sm text-white/90">
                  Buyer has confirmed payment. Verify to proceed with transfer.
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">From Buyer</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">
                      {shortenAddress(selectedOrder.buyerWallet)}
                    </span>
                    <button
                      onClick={() => {
                        copyToClipboard(selectedOrder.buyerWallet);
                        toast({ title: "Copied" });
                      }}
                      className="p-1 hover:bg-[#FF7A5C]/20 rounded transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <Separator className="bg-[#FF7A5C]/20" />
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Token</span>
                  <span className="font-semibold">{selectedOrder.token}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Amount</span>
                  <span className="font-semibold">
                    {Number(selectedOrder.amountTokens).toFixed(6)}{" "}
                    {selectedOrder.token}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">PKR Amount</span>
                  <span className="font-semibold">
                    {Number(selectedOrder.amountPKR).toFixed(2)} PKR
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Rate</span>
                  <span className="font-semibold">
                    {(
                      selectedOrder.amountPKR / selectedOrder.amountTokens
                    ).toFixed(2)}{" "}
                    PKR/{selectedOrder.token}
                  </span>
                </div>
              </div>

              <Separator className="bg-[#FF7A5C]/20" />

              <div className="space-y-3">
                <Button
                  onClick={handleVerified}
                  disabled={loading}
                  className="w-full h-12 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />I HAVE VERIFIED
                    </>
                  )}
                </Button>
                <Button
                  onClick={goBack}
                  variant="outline"
                  className="w-full text-white border-white/5 hover:bg-white/10"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Chat Phase
  if ((phase === "chat" || phase === "completed") && selectedOrder) {
    return (
      <div
        className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white"
        style={{ fontSize: "10px" }}
      >
        <div className="bg-gradient-to-r from-[#1a2847]/95 to-[#16223a]/95 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
            {phase === "chat" && (
              <button
                onClick={goBack}
                className="p-2 hover:bg-[#1a2540]/50 rounded-lg transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5 text-[#FF7A5C]" />
              </button>
            )}
            <div className="flex-1 text-center font-semibold">
              {phase === "completed" ? "Order Completed" : "Transfer Assets"}
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 py-6 space-y-4">
          {/* Buyer Info Card */}
          <Card className="bg-transparent backdrop-blur-xl rounded-md border border-[#FF7A5C]/30">
            <CardContent className="pt-4 space-y-2">
              <div className="text-xs text-white/60">Send to Buyer</div>
              <div className="p-3 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs text-white/80 mb-1">
                    {shortenAddress(selectedOrder.buyerWallet)}
                  </div>
                  <div className="text-xs text-white/60">
                    {Number(selectedOrder.amountTokens).toFixed(6)}{" "}
                    {selectedOrder.token}
                  </div>
                </div>
                <button
                  onClick={() => {
                    copyToClipboard(selectedOrder.buyerWallet);
                    toast({ title: "Wallet copied" });
                  }}
                  className="p-2 hover:bg-[#FF7A5C]/20 rounded transition-colors"
                >
                  <Copy className="w-4 h-4 text-[#FF7A5C]" />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Chat Window */}
          <Card className="bg-transparent backdrop-blur-xl rounded-md border border-[#FF7A5C]/30">
            <CardContent className="pt-4 space-y-3">
              <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2 p-3 bg-[#0f1520]/50 rounded-lg border border-[#FF7A5C]/20">
                {chatLog.length === 0 ? (
                  <div className="text-xs text-white/60 text-center py-4">
                    Chat conversation will appear here
                  </div>
                ) : (
                  chatLog.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-2 rounded text-xs ${
                        msg.senderWallet === wallet?.publicKey
                          ? "bg-[#FF7A5C]/20 border border-[#FF7A5C]/40 text-white/90"
                          : "bg-white/10 border border-white/5 text-white/80"
                      }`}
                    >
                      <div className="font-semibold text-[#FF7A5C] mb-1">
                        {msg.senderRole === "buyer" ? "🛒 Buyer" : "🏪 Seller"}
                      </div>
                      <div>{msg.text}</div>
                    </div>
                  ))
                )}
              </div>

              {phase === "chat" && !sellerConfirmed && (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" && handleSendMessage()
                      }
                      placeholder="Type message..."
                      className="flex-1 px-3 py-2 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white placeholder-white/40 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF7A5C]"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim()}
                      className="px-3 py-2 rounded-lg bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white disabled:opacity-50 hover:opacity-90"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>

                  <Button
                    onClick={handleCompleted}
                    disabled={loading}
                    className="w-full h-10 rounded-lg font-semibold bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-white shadow-lg disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Completing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />I HAVE COMPLETED
                        TRANSFER
                      </>
                    )}
                  </Button>
                </>
              )}

              {sellerConfirmed && !buyerConfirmed && (
                <div className="p-3 rounded-lg bg-[#22c55e]/20 border border-[#22c55e]/30 text-xs text-white/90 text-center">
                  ✓ Waiting for buyer to confirm receipt...
                </div>
              )}

              {buyerConfirmed && phase === "completed" && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-[#22c55e]/20 border border-[#22c55e]/30 text-xs text-white/90 text-center">
                    ✓ Order completed successfully!
                  </div>
                  <Button
                    onClick={() => navigate("/express/pending-orders")}
                    className="w-full h-10 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white"
                  >
                    Return to Orders
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment Method Dialog */}
        <PaymentMethodDialog
          open={showPaymentDialog}
          onOpenChange={(open) => {
            setShowPaymentDialog(open);
            if (!open) {
              setEditingPaymentMethodId(undefined);
            }
          }}
          walletAddress={wallet?.publicKey || ""}
          paymentMethodId={editingPaymentMethodId}
          onSave={() => {
            setEditingPaymentMethodId(undefined);
          }}
        />

        {/* Create Offer Dialog */}
        <Dialog
          open={showCreateOfferDialog}
          onOpenChange={(open) => {
            setShowCreateOfferDialog(open);
            if (!open) {
              setOfferPassword("");
              setPasswordError("");
            }
          }}
        >
          <DialogContent className="bg-[#1a2847] border border-gray-300/30 text-white">
            <DialogHeader>
              <DialogTitle className="text-white uppercase">
                CREATE OFFER
              </DialogTitle>
              <DialogDescription className="text-white/70 uppercase">
                CHOOSE WHETHER YOU WANT TO BUY OR SELL CRYPTO
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2 uppercase">
                  Password
                </label>
                <input
                  type="password"
                  value={offerPassword}
                  onChange={(e) => {
                    setOfferPassword(e.target.value);
                    setPasswordError("");
                  }}
                  placeholder="Enter password"
                  className="w-full px-4 py-2 rounded-lg bg-[#1a2540]/50 border border-gray-300/30 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-gray-300/50"
                />
                {passwordError && (
                  <p className="text-red-500 text-xs mt-1">{passwordError}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => handleOfferAction("buy")}
                  className="h-32 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-blue-600/20 to-blue-600/10 border border-blue-500/30 hover:border-blue-500/50 text-white font-semibold rounded-lg transition-all uppercase"
                >
                  <ShoppingCart className="w-8 h-8" />
                  <span>BUY CRYPTO</span>
                </Button>
                <Button
                  onClick={() => handleOfferAction("sell")}
                  className="h-32 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-green-600/20 to-green-600/10 border border-green-500/30 hover:border-green-500/50 text-white font-semibold rounded-lg transition-all uppercase"
                >
                  <TrendingUp className="w-8 h-8" />
                  <span>SELL CRYPTO</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bottom Navigation */}
        <P2PBottomNavigation
          onPaymentClick={() => {
            setEditingPaymentMethodId(undefined);
            setShowPaymentDialog(true);
          }}
          onCreateOfferClick={() => setShowCreateOfferDialog(true)}
        />
      </div>
    );
  }

  return null;
}
