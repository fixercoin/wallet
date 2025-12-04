import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Send } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { API_BASE, ADMIN_WALLET } from "@/lib/p2p";
import { useToast } from "@/hooks/use-toast";
import { listOrders } from "@/lib/p2p";
import {
  saveChatMessage,
  saveNotification,
  broadcastNotification,
  sendChatMessage,
  loadChatHistory,
  parseWebSocketMessage,
  type ChatMessage,
  type ChatNotification,
} from "@/lib/p2p-chat";

type ActionType = "buyer_paid" | "seller_sent";

export default function Select() {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const { toast } = useToast();
  const { wallet, tokens } = useWallet();
  const action = (location.state?.action || null) as ActionType | null;
  const payload = (location.state?.payload || null) as any;

  const derivedRoomId: string | null = useMemo(() => {
    return (payload && (payload.roomId || payload.orderId)) || null;
  }, [payload]);

  const effectiveRoomId: string = useMemo(
    () => derivedRoomId || "global",
    [derivedRoomId],
  );

  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoadingOrders(true);
        const res = await listOrders(effectiveRoomId);
        if (!mounted) return;
        setOrders(res.orders || []);
      } catch (e) {
        console.error("Failed to load orders", e);
      } finally {
        if (mounted) setLoadingOrders(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [effectiveRoomId]);

  const [showConfirmation, setShowConfirmation] = useState(
    !!location.state?.confirmation,
  );
  const [openChat, setOpenChat] = useState<boolean>(
    Boolean(location.state?.openChat || action || false),
  );

  useEffect(() => {
    if (wallet?.publicKey === ADMIN_WALLET) setOpenChat(true);
  }, [wallet]);
  const confirmationData = location.state?.confirmation;

  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState<string>("");

  useEffect(() => {
    const history = loadChatHistory(effectiveRoomId);
    setChatLog(history);
  }, [effectiveRoomId]);

  const sendTextMessage = () => {
    if (!messageInput.trim() || !effectiveRoomId || !wallet?.publicKey) return;
    const userRole: "buyer" | "seller" =
      payload?.sellerWallet === wallet.publicKey ? "seller" : "buyer";
    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      roomId: effectiveRoomId,
      senderWallet: wallet.publicKey,
      senderRole: userRole,
      type: "message",
      text: messageInput.trim(),
      timestamp: Date.now(),
    };
    saveChatMessage(message);
    setChatLog((prev) => [...prev, message]);
    setMessageInput("");
  };

  async function resizeImageToDataUrl(
    file: File,
    maxDim: number = 1024,
    quality: number = 0.8,
  ): Promise<string> {
    const img = new Image();
    const fileUrl = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = fileUrl;
      });
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width >= height) {
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
    if (!file || !effectiveRoomId || !wallet?.publicKey) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const userRole: "buyer" | "seller" =
        payload?.sellerWallet === wallet.publicKey ? "seller" : "buyer";
      const message: ChatMessage = {
        id: `msg-${Date.now()}`,
        roomId: effectiveRoomId,
        senderWallet: wallet.publicKey,
        senderRole: userRole,
        type: "attachment",
        text: "Sent an image",
        metadata: { attachmentDataUrl: dataUrl, filename: file.name },
        timestamp: Date.now(),
      };
      saveChatMessage(message);
      setChatLog((prev) => [...prev, message]);
    } catch (e) {
      toast({
        title: "Upload failed",
        description: "Could not attach image",
        variant: "destructive",
      });
    }
  }

  const [adminTokenSymbol, setAdminTokenSymbol] = useState<string>(
    tokens[0]?.symbol || "SOL",
  );
  const [adminAmount, setAdminAmount] = useState<string>("");
  const [adminToWallet, setAdminToWallet] = useState<string>("");
  const adminTokenInfo = useMemo(
    () => tokens.find((t) => t.symbol === adminTokenSymbol),
    [tokens, adminTokenSymbol],
  );
  const [readyToConfirmSend, setReadyToConfirmSend] = useState(false);

  const handleConfirmPayment = async () => {
    try {
      if (!action || !payload) {
        setShowConfirmation(false);
        return;
      }
      if (!wallet?.publicKey) {
        toast({ title: "Wallet Not Connected", variant: "destructive" });
        return;
      }

      if (action === "buyer_paid") {
        const roomId = payload.roomId as string;
        const estimatedTokens = Number(payload.estimatedTokens || 0);
        const message: ChatMessage = {
          id: `msg-${Date.now()}`,
          roomId,
          senderWallet: wallet.publicKey,
          senderRole: "buyer",
          type: "buyer_paid",
          text: `I have paid fiat.\nOrder: ${roomId}\nBuyer: ${wallet.publicKey}\nAmount: ${payload.amountPKR} PKR via ${payload.paymentMethod}\nPlease send ${estimatedTokens.toFixed(6)} ${payload.token} to ${payload.buyerWallet}`,
          metadata: {
            orderId: roomId,
            token: payload.token,
            amountPKR: payload.amountPKR,
            estimatedTokens: estimatedTokens,
            paymentMethod: payload.paymentMethod,
            seller: payload.seller,
            buyerWallet: payload.buyerWallet,
          },
          timestamp: Date.now(),
        };
        saveChatMessage(message);
        const notification: ChatNotification = {
          type: "payment_received",
          roomId,
          initiatorWallet: wallet.publicKey,
          initiatorRole: "buyer",
          message: `Buyer has confirmed payment - ${estimatedTokens.toFixed(6)} ${payload.token} for PKR ${Number(payload.amountPKR).toFixed(2)}`,
          data: {
            amountPKR: Number(payload.amountPKR),
            token: payload.token,
            estimatedTokens: estimatedTokens.toFixed(6),
            orderId: roomId,
          },
          timestamp: Date.now(),
        };
        saveNotification(notification);
        toast({
          title: "Seller notified",
          description: "Waiting for seller to verify payment...",
        });
        setOpenChat(true);
      } else if (action === "seller_sent") {
        const roomId = payload.roomId as string;
        const message: ChatMessage = {
          id: `msg-${Date.now()}`,
          roomId,
          senderWallet: wallet.publicKey,
          senderRole: "seller",
          type: "seller_sent",
          text: `I have sent assets.\nOrder: ${roomId}\nPayment method: ${payload.paymentMethod}\nSent ${Number(payload.amountTokens).toFixed(6)} ${payload.token} to ${ADMIN_WALLET}\nBuyer, please send ${Number(payload.amountPKR).toFixed(2)} PKR`,
          metadata: {
            orderId: roomId,
            token: payload.token,
            amountTokens: payload.amountTokens,
            amountPKR: payload.amountPKR,
            paymentMethod: payload.paymentMethod,
            sellerWallet: payload.sellerWallet,
            adminWallet: payload.adminWallet,
          },
          timestamp: Date.now(),
        };
        saveChatMessage(message);
        const notification: ChatNotification = {
          type: "status_change",
          roomId,
          initiatorWallet: wallet.publicKey,
          initiatorRole: "seller",
          message: `Transfer sent: ${Number(payload.amountTokens).toFixed(6)} ${payload.token} to ${ADMIN_WALLET}`,
          data: { amountTokens: payload.amountTokens, token: payload.token },
          timestamp: Date.now(),
        };
        saveNotification(notification);
        toast({
          title: "Transfer marked sent",
          description: "Buyer will be notified",
        });
        setOpenChat(true);
      }
    } finally {
      setShowConfirmation(false);
    }
  };

  return (
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden flex items-center justify-center">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="absolute top-4 left-4 z-30">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors duration-200 backdrop-blur-sm"
          aria-label="Go back to wallet dashboard"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
      </div>

      <div className="w-full mx-auto px-6 relative z-20 flex flex-col items-center gap-2">
        <div className="w-full max-w-4xl order-0 mt-6 flex items-center justify-end">
          <span className="text-sm text-white/70 select-none">
            info@fixorium.com.pk
          </span>
        </div>
        <img
          src="https://cdn.builder.io/api/v1/image/assets%2F252abe93ac584677b311bb7cf6df36d9%2Fda8d138bd45a4eceb9b1e4baae32a4a2?format=webp&width=800"
          alt="Payment illustration"
          className="mx-auto mb-4 max-h-[220px] w-full object-contain"
        />
        <div className="mt-2 w-full max-w-4xl rounded-3xl p-6 order-2">
          <div className="grid grid-cols-2 gap-4 w-full">
            <Button
              onClick={() => navigate("/buy-now")}
              className="w-full py-3 h-12 rounded-xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] hover:shadow-xl hover:scale-105 transition-all duration-300 text-white font-semibold text-base shadow-lg active:scale-95"
            >
              BUY
            </Button>

            <Button
              onClick={() => navigate("/sell-now")}
              className="w-full py-3 h-12 rounded-xl bg-gradient-to-br from-[#FF5A8C] to-[#FF7A5C] hover:shadow-xl hover:scale-105 transition-all duration-300 text-white font-semibold text-base shadow-lg active:scale-95"
            >
              SELL
            </Button>
          </div>
        </div>

        {wallet?.publicKey && (
          <div className="w-full max-w-4xl order-1">
            {/* Orders list displayed as prompt messages - moved above image */}
            <div className="mb-3 space-y-3">
              {loadingOrders ? (
                <div className="text-sm text-white/60">Loading orders...</div>
              ) : orders.length === 0 ? (
                payload && payload.roomId ? (
                  <div className="p-4 bg-[#0f1520]/50 border border-white/3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-white/90">
                          Order {payload.roomId}
                        </div>
                        <div className="text-xs text-white/70 mt-1">
                          {action === "buyer_paid"
                            ? `Buyer paid ${payload.amountPKR?.toLocaleString?.() ?? payload.amountPKR} PKR for ~${Number(payload.estimatedTokens || 0).toFixed(6)} ${payload.token}`
                            : `Seller sent ${Number(payload.amountTokens || 0).toFixed(6)} ${payload.token}`}
                        </div>
                        <div className="text-xs text-white/60 mt-2">
                          Payment: {payload.paymentMethod || "—"}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <Button
                          onClick={() =>
                            navigate("/order-complete", {
                              state: {
                                order: {
                                  id: payload.roomId,
                                  token: payload.token,
                                  pricePKRPerQuote: payload.pricePKRPerQuote,
                                  paymentMethod: payload.paymentMethod,
                                  amountPKR: payload.amountPKR,
                                  type:
                                    action === "buyer_paid" ? "buy" : "sell",
                                },
                                confirmation: confirmationData,
                              },
                            })
                          }
                          className="ml-2 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white"
                        >
                          Continue
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div />
                )
              ) : (
                orders.map((o: any) => (
                  <div
                    key={o.id || o.orderId}
                    className="p-4 bg-[#0f1520]/50 border border-white/3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-white/90">
                          {o.title ||
                            o.token ||
                            o.type ||
                            `Order ${o.id || o.orderId}`}
                        </div>
                        <div className="text-xs text-white/70 mt-1">
                          {o.description ||
                            o.message ||
                            o.details ||
                            `Amount: ${o.amount || o.estimatedTokens || ""}`}
                        </div>
                        <div className="text-xs text-white/60 mt-2">
                          Payment: {o.paymentMethod || o.payment || "—"}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <Button
                          onClick={() =>
                            navigate("/express/buy-trade", {
                              state: { order: o, openChat: true },
                            })
                          }
                          className="ml-2 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white"
                        >
                          Continue
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="w-full rounded-2xl p-6 bg-transparent flex items-center justify-center">
              {loadingOrders ? (
                <div className="text-sm text-white/60">Loading orders...</div>
              ) : orders.length === 0 && !payload ? (
                <div className="text-sm text-white/60">
                  FIXORIUM P2P — SECURE, FAST, AND LOW-FEE PEER-TO-PEER CRYPTO
                  TRADING. NO ORDERS AVAILABLE.
                </div>
              ) : (
                <img
                  src="https://cdn.builder.io/api/v1/image/assets%2F252abe93ac584677b311bb7cf6df36d9%2F7f9abc82a07a45b0bbb91d5f4765fb76?format=webp&width=800"
                  alt="Payment illustration"
                  className="max-h-[320px] w-full object-contain"
                />
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmationData?.title}</DialogTitle>
            <DialogDescription>{confirmationData?.message}</DialogDescription>
          </DialogHeader>

          {confirmationData?.details && (
            <div className="space-y-3 text-sm py-4">
              {confirmationData.details.map((detail: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white/80">{detail.label}</span>
                    <span className="font-semibold text-[#FF7A5C] text-right break-all max-w-xs">
                      {detail.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmation(false)}
              className="bg-transparent border-white/30 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPayment}
              className="bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white"
            >
              {confirmationData?.buttonText || "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
