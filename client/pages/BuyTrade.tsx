import React, { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Copy, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDurableRoom } from "@/hooks/useDurableRoom";
import { API_BASE, ADMIN_WALLET } from "@/lib/p2p";
import { useWallet } from "@/contexts/WalletContext";
import { copyToClipboard, shortenAddress } from "@/lib/wallet";
import {
  saveChatMessage,
  loadChatHistory,
  saveNotification,
  broadcastNotification,
  sendChatMessage,
  parseWebSocketMessage,
  clearNotificationsForRoom,
  type ChatMessage,
  type ChatNotification,
} from "@/lib/p2p-chat";

export default function BuyTrade() {
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: { order?: any } };
  const order = state?.order || null;
  const openChat: boolean = !!(state && state.openChat);
  const initialPhaseFromNav: string | undefined = state?.initialPhase;
  const { toast } = useToast();
  const { wallet } = useWallet();
  const { events, send } = useDurableRoom("global", API_BASE);

  type Phase =
    | "entry"
    | "awaiting_seller_approval"
    | "seller_approved"
    | "awaiting_seller_verified"
    | "seller_verified"
    | "seller_transferred"
    | "completed"
    | "failed";

  const [phase, setPhase] = useState<Phase>("entry");
  const [unread, setUnread] = useState(false);
  const [sellerInfo, setSellerInfo] = useState<{
    accountName: string;
    accountNumber: string;
    paymentMethod?: string;
  } | null>(null);
  const [failMsg, setFailMsg] = useState<string>("");
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
  const [userRole, setUserRole] = useState<"buyer" | "seller">("buyer");

  const [amountPKR, setAmountPKR] = useState<number | "">("");
  const [token, setToken] = useState<string>(
    String(order?.quoteAsset || order?.token || "USDC").toUpperCase(),
  );

  const pricePKR: number | null = useMemo(() => {
    const price = Number(order?.pricePKRPerQuote);
    if (!isFinite(price) || price <= 0) return null;
    const matches =
      String(token).toUpperCase() ===
      String(order?.quoteAsset || order?.token || "").toUpperCase();
    return matches ? price : null;
  }, [order, token]);

  const estimatedTokens = useMemo(() => {
    if (!pricePKR || !amountPKR || Number(amountPKR) <= 0) return 0;
    return Number(amountPKR) / pricePKR;
  }, [amountPKR, pricePKR]);

  const canConfirm =
    Boolean(order) && Boolean(pricePKR) && Number(estimatedTokens) > 0;

  const handleConfirm = () => {
    if (!canConfirm || !roomId || !wallet) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      roomId,
      senderWallet: wallet.publicKey,
      senderRole: userRole,
      type: "buyer_confirm",
      text: `Buyer requested ~${estimatedTokens.toFixed(6)} ${token} for PKR ${Number(amountPKR).toFixed(2)}`,
      metadata: {
        amountPKR: Number(amountPKR),
        token,
        estimatedTokens: estimatedTokens.toFixed(6),
      },
      timestamp: Date.now(),
    };

    saveChatMessage(message);
    sendChatMessage(send, message);

    const notification: ChatNotification = {
      type: "trade_initiated",
      roomId,
      initiatorWallet: wallet.publicKey,
      initiatorRole: userRole,
      message: `Trade initiated: ${estimatedTokens.toFixed(6)} ${token} for PKR ${Number(amountPKR).toFixed(2)}`,
      data: { amountPKR: Number(amountPKR), token },
      timestamp: Date.now(),
    };

    saveNotification(notification);
    broadcastNotification(send, notification);

    setChatLog((prev) => [...prev, message]);
    toast({
      title: "Trade request sent",
      description: `Request to buy ~${estimatedTokens.toFixed(6)} ${token}`,
    });
    setPhase("awaiting_seller_approval");
  };

  const notifySeller = () => {
    if (!roomId || !wallet) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      roomId,
      senderWallet: wallet.publicKey,
      senderRole: userRole,
      type: "buyer_notify",
      text: "Buyer confirmed payment and notified seller to verify",
      timestamp: Date.now(),
    };

    saveChatMessage(message);
    sendChatMessage(send, message);

    const notification: ChatNotification = {
      type: "payment_received",
      roomId,
      initiatorWallet: wallet.publicKey,
      initiatorRole: "buyer",
      message: `Buyer has confirmed payment - ${estimatedTokens.toFixed(6)} ${token} for PKR ${Number(amountPKR).toFixed(2)}`,
      data: {
        amountPKR: Number(amountPKR),
        token,
        estimatedTokens: estimatedTokens.toFixed(6),
        orderId: roomId,
      },
      timestamp: Date.now(),
    };

    saveNotification(notification);
    broadcastNotification(send, notification);

    setChatLog((prev) => [...prev, message]);
    toast({ title: "Seller notified", description: "Waiting for seller to verify payment..." });
    setPhase((p) => (p === "seller_approved" ? "awaiting_seller_verified" : p));
  };

  // Initialize room ID and role based on order
  useEffect(() => {
    if (!order?.id || !wallet) return;

    const rid = order.id;
    setRoomId(rid);

    // Determine user role
    const role = order.type === "buy" ? "buyer" : "seller";
    setUserRole(role);

    // Load chat history from localStorage
    const history = loadChatHistory(rid);
    setChatLog(history);

    // Clear notifications for this room
    clearNotificationsForRoom(rid);
  }, [order?.id, wallet]);

  // Listen for incoming WebSocket messages
  useEffect(() => {
    const last = events[events.length - 1];
    if (!last) return;

    if (last.kind === "chat") {
      const txt = last.data?.text || "";
      const msg = parseWebSocketMessage(txt);

      if (msg && msg.roomId === roomId) {
        // Message is for this room
        saveChatMessage(msg);
        setChatLog((prev) => {
          const exists = prev.find((m) => m.id === msg.id);
          return exists ? prev : [...prev, msg];
        });
        setUnread(true);

        // Handle status changes
        if (msg.type === "seller_approved") {
          setSellerInfo({
            accountName: String(msg.metadata?.accountName || ""),
            accountNumber: String(msg.metadata?.accountNumber || ""),
            paymentMethod: String(msg.metadata?.paymentMethod || ""),
          });
          setPhase("seller_approved");
          toast({
            title: "Seller approved",
            description: "Payment details received",
          });
        } else if (msg.type === "seller_verified") {
          setPhase("seller_verified");
          toast({
            title: "Seller verified payment",
            description: "Assets are being transferred to you",
          });
        } else if (msg.type === "seller_completed") {
          setPhase("seller_transferred");
          toast({
            title: "Seller completed transfer",
            description: "Please confirm receipt to finalize order",
          });
        } else if (msg.type === "buyer_confirmed_receipt") {
          setPhase("completed");
          toast({
            title: "Order Complete",
            description: "Trade finalized successfully",
          });
          try {
            const completedRaw = localStorage.getItem("orders_completed");
            const completed = completedRaw ? JSON.parse(completedRaw) : [];
            const orderToSave = order
              ? { ...order, status: "completed", completedAt: Date.now() }
              : null;
            if (orderToSave) {
              completed.unshift(orderToSave);
              localStorage.setItem(
                "orders_completed",
                JSON.stringify(completed),
              );
            }
            const pendingRaw = localStorage.getItem("orders_pending");
            const pending = pendingRaw ? JSON.parse(pendingRaw) : [];
            const filtered =
              Array.isArray(pending) && order?.id
                ? pending.filter((o: any) => o.id !== order.id)
                : pending;
            localStorage.setItem("orders_pending", JSON.stringify(filtered));
          } catch {}
          setTimeout(() => navigate("/", { state: { goP2P: true } }), 2000);
        } else if (msg.type === "order_failed") {
          setFailMsg(
            String(msg.metadata?.reason || "Order could not complete"),
          );
          setPhase("failed");
        }
      }
    } else if (last.kind === "notification") {
      const notif = last.data as ChatNotification;
      if (
        notif?.roomId === roomId &&
        notif.initiatorWallet !== wallet?.publicKey
      ) {
        // Notification for this room from other party
        saveNotification(notif);
        toast({
          title: notif.message.split(":")[0],
          description: notif.message,
        });
      }
    }
  }, [events, roomId, wallet?.publicKey, order, navigate]);

  // Auto-open chat if flagged
  useEffect(() => {
    if (openChat) {
      if (initialPhaseFromNav && typeof initialPhaseFromNav === "string") {
        setPhase(initialPhaseFromNav as Phase);
      }
      setUnread(true);
    }
  }, [openChat, initialPhaseFromNav]);

  const clearUnread = () => setUnread(false);

  // Seller controls (visible if admin wallet)
  const isSeller = wallet?.publicKey === ADMIN_WALLET;
  const [sellerAccountName, setSellerAccountName] = useState("");
  const [sellerAccountNumber, setSellerAccountNumber] = useState("");

  const sellerApprove = () => {
    if (!roomId || !wallet) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      roomId,
      senderWallet: wallet.publicKey,
      senderRole: "seller",
      type: "seller_approved",
      text: `Seller approved. Payment details: ${sellerAccountName} - ${sellerAccountNumber}`,
      metadata: {
        accountName: sellerAccountName,
        accountNumber: sellerAccountNumber,
        paymentMethod: order?.paymentMethod || "easypaisa",
      },
      timestamp: Date.now(),
    };

    saveChatMessage(message);
    sendChatMessage(send, message);
    setChatLog((prev) => [...prev, message]);
  };

  const sellerVerified = () => {
    if (!roomId || !wallet) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      roomId,
      senderWallet: wallet.publicKey,
      senderRole: "seller",
      type: "seller_verified",
      text: "Seller verified buyer's payment",
      timestamp: Date.now(),
    };

    saveChatMessage(message);
    sendChatMessage(send, message);
    setChatLog((prev) => [...prev, message]);
  };

  const sellerTransferred = () => {
    if (!roomId || !wallet) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      roomId,
      senderWallet: wallet.publicKey,
      senderRole: "seller",
      type: "seller_transferred",
      text: "Seller marked transfer as completed",
      timestamp: Date.now(),
    };

    saveChatMessage(message);
    sendChatMessage(send, message);
    setChatLog((prev) => [...prev, message]);
  };

  const sellerFail = () => {
    if (!roomId || !wallet) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      roomId,
      senderWallet: wallet.publicKey,
      senderRole: "seller",
      type: "order_failed",
      text: "Order failed - Seller cancelled",
      metadata: { reason: "Seller cancelled" },
      timestamp: Date.now(),
    };

    saveChatMessage(message);
    sendChatMessage(send, message);
    setChatLog((prev) => [...prev, message]);
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !roomId || !wallet) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      roomId,
      senderWallet: wallet.publicKey,
      senderRole: userRole,
      type: "text",
      text: messageInput,
      timestamp: Date.now(),
    };

    saveChatMessage(message);
    sendChatMessage(send, message);
    setChatLog((prev) => [...prev, message]);
    setMessageInput("");
  };

  return (
    <div
      className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white"
      style={{ fontSize: "10px" }}
    >
      <div className="bg-gradient-to-r from-[#1a2847]/95 to-[#16223a]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate("/", { state: { goP2P: true } })}
            className="p-2 hover:bg-[#1a2540]/50 rounded-lg transition-colors"
            aria-label="Back to Express P2P"
          >
            <ArrowLeft className="w-5 h-5 text-[#FF7A5C]" />
          </button>

          <div className="flex-1 text-center font-semibold uppercase">
            Buy Trade
          </div>

          <button
            onClick={clearUnread}
            className="relative h-9 w-9 rounded-lg hover:bg-[#1a2540]/50"
            aria-label="Incoming messages"
          >
            <MessageSquare className="h-5 w-5 text-white" />
            {unread && (
              <span className="absolute -top-0.5 -right-0.5 inline-block w-2.5 h-2.5 bg-red-500 rounded-full" />
            )}
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <div className="rounded-2xl p-6 space-y-5 bg-[#1a2540]/60 border border-[#FF7A5C]/30">
          {/* Chat window */}
          <div className="p-3 rounded-xl bg-[#0f1520]/50 border border-[#FF7A5C]/30 max-h-64 overflow-y-auto custom-scrollbar">
            {chatLog.length === 0 ? (
              <div className="text-xs text-white/60">No messages yet</div>
            ) : (
              <div className="space-y-2">
                {chatLog.map((m) => (
                  <div
                    key={m.id}
                    className={`p-2 rounded-lg text-xs ${
                      m.senderWallet === wallet?.publicKey
                        ? "bg-[#FF7A5C]/20 border border-[#FF7A5C]/40 text-white/90"
                        : "bg-white/10 border border-white/20 text-white/80"
                    }`}
                  >
                    <div className="font-semibold text-[#FF7A5C] text-xs mb-1">
                      {m.senderRole === "buyer" ? "🛒 Buyer" : "🏪 Seller"}
                    </div>
                    <div>{m.text}</div>
                    {m.metadata && Object.keys(m.metadata).length > 0 && (
                      <div className="text-[10px] opacity-70 mt-1">
                        {JSON.stringify(m.metadata)}
                      </div>
                    )}
                    <div className="text-[10px] opacity-50 mt-1">
                      {new Date(m.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white placeholder-white/40 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF7A5C]"
            />
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
              className="px-3 py-2 rounded-lg bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white disabled:opacity-50 hover:opacity-90 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {phase === "entry" && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  PKR Amount
                </label>
                <input
                  type="number"
                  min={0}
                  value={amountPKR}
                  onChange={(e) =>
                    setAmountPKR(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Select Token
                </label>
                <select
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                >
                  <option value="USDC">USDC</option>
                  <option value="SOL">SOL</option>
                  <option value="FIXERCOIN">FIXERCOIN</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border bg-white">
                  <div className="text-xs text-gray-500">Token price (PKR)</div>
                  <div className="font-semibold mt-1">{pricePKR ?? "—"}</div>
                </div>
                <div className="p-3 rounded-lg border bg-white">
                  <div className="text-xs text-gray-500">Estimated tokens</div>
                  <div className="font-semibold mt-1">
                    {estimatedTokens ? estimatedTokens.toFixed(6) : "0"}
                  </div>
                </div>
              </div>

              <Button
                className="w-full wallet-button-primary"
                disabled={!canConfirm}
                onClick={handleConfirm}
              >
                Confirm
              </Button>
            </>
          )}

          {phase === "awaiting_seller_approval" && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-gray-600">
                Waiting for seller approval…
              </p>
              <Button
                onClick={notifySeller}
                className="wallet-button-secondary"
              >
                Notify seller
              </Button>
            </div>
          )}

          {phase === "seller_approved" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border bg-white">
                <div className="text-xs text-gray-500">Order serial</div>
                <div className="font-mono text-sm">{order?.id || "—"}</div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <div className="text-xs text-gray-500">Account name</div>
                    <div className="font-semibold">
                      {sellerInfo?.accountName || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Account number</div>
                    <div className="font-semibold">
                      {sellerInfo?.accountNumber || "—"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-sm">
                  Payment method:{" "}
                  {sellerInfo?.paymentMethod || order?.paymentMethod || "—"}
                </div>
              </div>
              <Button
                onClick={notifySeller}
                className="wallet-button-primary w-full"
              >
                Notify seller
              </Button>
            </div>
          )}

          {phase === "awaiting_seller_verified" && (
            <p className="text-sm text-gray-600 text-center">
              Waiting for seller to verify payment…
            </p>
          )}

          {phase === "seller_verified" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border bg-white">
                <div className="text-xs text-gray-500">Your wallet address</div>
                <div className="flex items-center justify-between mt-1">
                  <code className="font-mono text-sm">
                    {wallet ? shortenAddress(wallet.publicKey, 8) : "No wallet"}
                  </code>
                  {wallet && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Copy address"
                      onClick={async () => {
                        const ok = await copyToClipboard(wallet.publicKey);
                        if (ok) toast({ title: "Address copied" });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600">
                After transfer is sent, you will receive a completion message.
              </p>
            </div>
          )}

          {phase === "failed" && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl border bg-red-50 text-red-700">
                {failMsg}
              </div>
              <div className="flex gap-2">
                <Button
                  className="wallet-button-secondary flex-1"
                  onClick={() => setPhase("awaiting_seller_approval")}
                >
                  Continue
                </Button>
                <Button
                  className="wallet-button-primary flex-1"
                  onClick={() => navigate("/", { state: { goP2P: true } })}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}

          {isSeller && (
            <div className="mt-6 p-4 rounded-xl border bg-white space-y-3">
              <div className="text-sm font-medium">Seller controls</div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Account name"
                  value={sellerAccountName}
                  onChange={(e) => setSellerAccountName(e.target.value)}
                />
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Account number"
                  value={sellerAccountNumber}
                  onChange={(e) => setSellerAccountNumber(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={sellerApprove}
                  className="wallet-button-secondary"
                >
                  Approve
                </Button>
                <Button
                  onClick={sellerVerified}
                  className="wallet-button-secondary"
                >
                  Verified
                </Button>
                <Button
                  onClick={sellerTransferred}
                  className="wallet-button-secondary"
                >
                  I have transferred
                </Button>
                <Button onClick={sellerFail} className="wallet-button-primary">
                  Fail order
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
