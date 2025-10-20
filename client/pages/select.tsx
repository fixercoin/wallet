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
import { useDurableRoom } from "@/hooks/useDurableRoom";
import { API_BASE, ADMIN_WALLET } from "@/lib/p2p";
import { useToast } from "@/hooks/use-toast";
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
  const { send, events } = useDurableRoom(effectiveRoomId, API_BASE);

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

  useEffect(() => {
    if (!events.length) return;
    const last = events[events.length - 1] as any;
    if (last.kind === "chat" && last.data?.text) {
      const msg = parseWebSocketMessage(last.data.text);
      if (msg && msg.roomId === effectiveRoomId) {
        saveChatMessage(msg);
        setChatLog((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    }
  }, [events, effectiveRoomId]);

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
    sendChatMessage(send, message);
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
      sendChatMessage(send, message);
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
        sendChatMessage(send, message);
        const notification: ChatNotification = {
          type: "status_change",
          roomId,
          initiatorWallet: wallet.publicKey,
          initiatorRole: "buyer",
          message: `Payment received: ${payload.amountPKR} PKR - Waiting for verification`,
          data: { amountPKR: payload.amountPKR, token: payload.token },
          timestamp: Date.now(),
        };
        saveNotification(notification);
        broadcastNotification(send, notification);
        toast({
          title: "Payment marked",
          description: "Seller will be notified for verification",
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
        sendChatMessage(send, message);
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
        broadcastNotification(send, notification);
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
      <div className="absolute top-0 right-0 w-56 h-56 sm:w-72 sm:h-72 lg:w-96 lg:h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-56 sm:h-56 lg:w-72 lg:h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="absolute top-4 left-4 z-30">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors duration-200 backdrop-blur-sm"
          aria-label="Go back to wallet dashboard"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
      </div>

      <div className="w-full mx-auto px-4 sm:px-6 relative z-20 flex flex-col items-center gap-4">
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg order-0 mt-6 flex items-center justify-end">
          <span className="text-sm text-white/70 select-none">
            info@fixorium.com.pk
          </span>
        </div>
        <div className="mt-2 w-full max-w-sm sm:max-w-md md:max-w-lg rounded-2xl sm:rounded-3xl p-4 sm:p-6 order-2">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full">
            <Button
              onClick={() => navigate("/buy-now")}
              className="w-full py-2 sm:py-3 rounded-lg bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] hover:shadow-xl hover:scale-105 transition-all duration-300 text-white font-semibold text-sm sm:text-base shadow-lg active:scale-95"
            >
              BUY
            </Button>

            <Button
              onClick={() => navigate("/sell-now")}
              className="w-full py-2 sm:py-3 rounded-lg bg-gradient-to-br from-[#FF5A8C] to-[#FF7A5C] hover:shadow-xl hover:scale-105 transition-all duration-300 text-white font-semibold text-sm sm:text-base shadow-lg active:scale-95"
            >
              SELL
            </Button>
          </div>
        </div>

        {wallet?.publicKey && (
          <div className="w-full max-w-sm sm:max-w-md md:max-w-lg order-1">
            <div className="w-full rounded-2xl p-4 sm:p-6 space-y-3 bg-[#1a2540]/60">
              <div className="w-full h-[300px] overflow-y-auto custom-scrollbar space-y-2 bg-[#0f1520]/50">
                {chatLog.length === 0 ? (
                  <div className="text-xs text-white/60 text-center py-4">
                    Chat conversation will appear here
                  </div>
                ) : (
                  chatLog.map((msg) => (
                    <div
                      key={msg.id}
                      className={`text-xs p-2 rounded ${
                        msg.senderWallet === wallet?.publicKey
                          ? "bg-[#FF7A5C]/20 text-white/90"
                          : "bg-[#1a2540]/50 text-white/70"
                      }`}
                    >
                      <div className="font-semibold text-white/80">
                        {msg.senderRole === "buyer" ? "Buyer" : "Seller"}
                      </div>
                      <div>{msg.text}</div>
                      {msg.metadata?.attachmentDataUrl && (
                        <div className="mt-2">
                          <img
                            src={msg.metadata.attachmentDataUrl}
                            alt="attachment"
                            className="rounded-lg max-h-48"
                          />
                        </div>
                      )}
                      <div className="text-[10px] text-white/50 mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  className="flex-1 px-3 py-2 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white placeholder-white/40"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
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
                  onClick={() =>
                    document.getElementById("attach-input")?.click()
                  }
                  className="wallet-button-secondary px-3"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  onClick={sendTextMessage}
                  className="wallet-button-primary px-4"
                  disabled={!messageInput.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {wallet?.publicKey === ADMIN_WALLET && (
              <div className="mt-3 w-full rounded-2xl p-4 sm:p-6 bg-[#1a2540]/60">
                <div className="text-sm font-medium mb-2">
                  Admin: Send assets
                </div>
                <div className="p-3 rounded-xl bg-[#0f1520]/50">
                  <div className="text-xs font-medium mb-2">
                    Select token and balance
                  </div>
                  <select
                    value={adminTokenSymbol}
                    onChange={(e) => setAdminTokenSymbol(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a2540]/50 text-white cursor-pointer"
                  >
                    {tokens.map((t) => (
                      <option
                        key={t.mint}
                        value={t.symbol}
                        className="bg-[#1a2540] text-white"
                      >
                        {t.symbol} —{" "}
                        {typeof t.balance === "number"
                          ? t.balance.toFixed(6)
                          : 0}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 text-xs">
                    Wallet balance:{" "}
                    {adminTokenInfo?.balance?.toFixed(6) || "0.000000"}{" "}
                    {adminTokenSymbol}
                  </div>
                </div>
                <div className="grid gap-2 mt-3">
                  <input
                    className="px-3 py-2 rounded-lg bg-[#1a2540]/50 text-white placeholder-white/40"
                    placeholder="Amount"
                    value={adminAmount}
                    onChange={(e) => setAdminAmount(e.target.value)}
                  />
                  <input
                    className="px-3 py-2 rounded-lg bg-[#1a2540]/50 text-white placeholder-white/40"
                    placeholder="To wallet"
                    value={adminToWallet}
                    onChange={(e) => setAdminToWallet(e.target.value)}
                  />
                </div>
                {!readyToConfirmSend ? (
                  <Button
                    onClick={() => {
                      setReadyToConfirmSend(true);
                      toast({ title: "Transaction prepared" });
                    }}
                    className="wallet-button-primary w-full mt-3"
                  >
                    Send transaction
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      if (!effectiveRoomId || !wallet?.publicKey) return;
                      const message: ChatMessage = {
                        id: `msg-${Date.now()}`,
                        roomId: effectiveRoomId,
                        senderWallet: wallet.publicKey,
                        senderRole: "seller",
                        type: "admin_transferred",
                        text: `Admin sent ${adminAmount || "0"} ${adminTokenSymbol} to ${adminToWallet || ""}`,
                        timestamp: Date.now(),
                      };
                      saveChatMessage(message);
                      sendChatMessage(send, message);
                      toast({ title: "Assets sent" });
                      setReadyToConfirmSend(false);
                      setAdminAmount("");
                    }}
                    className="wallet-button-secondary w-full mt-3"
                  >
                    I have sent asset
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="sm:max-w-md">
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
