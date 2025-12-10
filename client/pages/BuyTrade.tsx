import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  MessageSquare,
  Copy,
  Send,
  Plus,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE, ADMIN_WALLET } from "@/lib/p2p";
import { useWallet } from "@/contexts/WalletContext";
import { copyToClipboard, shortenAddress } from "@/lib/wallet";
import { useState, useEffect, useMemo, useRef } from "react";
import { TOKEN_MINTS } from "@/lib/constants/token-mints";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import {
  saveChatMessage,
  loadChatHistory,
  loadServerChatHistory,
  saveServerChatMessage,
  saveNotification,
  clearNotificationsForRoom,
  parseWebSocketMessage,
  sendChatMessage,
  broadcastNotification,
  type ChatMessage,
  type ChatNotification,
} from "@/lib/p2p-chat";

export default function BuyTrade() {
  const navigate = useNavigate();
  const { state } = useLocation() as {
    state?: {
      order?: any;
      room?: { id: string; buyer_wallet?: string; seller_wallet?: string };
    };
  };
  const order = state?.order || null;
  const room = state?.room as any;
  const openChat: boolean = !!(state && state.openChat);
  const initialPhaseFromNav: string | undefined = state?.initialPhase;
  const { toast } = useToast();
  const { wallet, balance, tokens } = useWallet();
  const derivedRoomId = room?.id || (order && order.id) || "global";
  const counterpartyWallet = useMemo(() => {
    if (!room) return "";
    return wallet?.publicKey === (room.seller_wallet || "")
      ? room.buyer_wallet || ""
      : room.seller_wallet || "";
  }, [room, wallet?.publicKey]);

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageCountRef = useRef(0);

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
  const [userRole, setUserRole] = useState<"buyer" | "seller">("buyer");

  const [amountPKR, setAmountPKR] = useState<number | "">("");
  const [token, setToken] = useState<string>(
    String(order?.quoteAsset || order?.token || "USDT").toUpperCase(),
  );

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<
    string | undefined
  >();
  const [showCreateOfferDialog, setShowCreateOfferDialog] = useState(false);
  const [offerPassword, setOfferPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

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

  const handleConfirm = async () => {
    if (!canConfirm || !derivedRoomId || !wallet) return;

    const text = `Buyer requested ~${estimatedTokens.toFixed(6)} ${token} for PKR ${Number(amountPKR).toFixed(2)}`;

    try {
      // Save to server
      const serverMsg = await saveServerChatMessage(
        derivedRoomId,
        wallet.publicKey,
        text,
      );

      if (serverMsg) {
        serverMsg.senderRole = userRole;
        serverMsg.type = "buyer_confirm";
        serverMsg.metadata = {
          amountPKR: Number(amountPKR),
          token,
          estimatedTokens: estimatedTokens.toFixed(6),
        };
        setChatLog((prev) => [...prev, serverMsg]);
        lastMessageCountRef.current += 1;
      } else {
        // Fallback
        const message: ChatMessage = {
          id: `msg-${Date.now()}`,
          roomId: derivedRoomId,
          senderWallet: wallet.publicKey,
          senderRole: userRole,
          type: "buyer_confirm",
          text,
          metadata: {
            amountPKR: Number(amountPKR),
            token,
            estimatedTokens: estimatedTokens.toFixed(6),
          },
          timestamp: Date.now(),
        };
        saveChatMessage(message);
        setChatLog((prev) => [...prev, message]);
      }

      const notification: ChatNotification = {
        type: "trade_initiated",
        roomId: derivedRoomId,
        initiatorWallet: wallet.publicKey,
        initiatorRole: userRole,
        message: `Trade initiated: ${estimatedTokens.toFixed(6)} ${token} for PKR ${Number(amountPKR).toFixed(2)}`,
        data: { amountPKR: Number(amountPKR), token },
        timestamp: Date.now(),
      };

      saveNotification(notification);

      toast({
        title: "Trade request sent",
        description: `Request to buy ~${estimatedTokens.toFixed(6)} ${token}`,
      });
      setPhase("awaiting_seller_approval");
    } catch (error) {
      console.error("Failed to confirm trade:", error);
      toast({
        title: "Failed to send trade request",
        variant: "destructive",
      });
    }
  };

  const notifySeller = () => {
    if (!derivedRoomId || !wallet) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      roomId: derivedRoomId,
      senderWallet: wallet.publicKey,
      senderRole: userRole,
      type: "buyer_notify",
      text: "Buyer confirmed payment and notified seller to verify",
      timestamp: Date.now(),
    };

    saveChatMessage(message);

    const notification: ChatNotification = {
      type: "payment_received",
      roomId: derivedRoomId,
      initiatorWallet: wallet.publicKey,
      initiatorRole: "buyer",
      message: `Buyer has confirmed payment - ${estimatedTokens.toFixed(6)} ${token} for PKR ${Number(amountPKR).toFixed(2)}`,
      data: {
        amountPKR: Number(amountPKR),
        token,
        estimatedTokens: estimatedTokens.toFixed(6),
        orderId: derivedRoomId,
      },
      timestamp: Date.now(),
    };

    saveNotification(notification);

    setChatLog((prev) => [...prev, message]);
    toast({
      title: "Seller notified",
      description: "Waiting for seller to verify payment...",
    });
    setPhase((p) => (p === "seller_approved" ? "awaiting_seller_verified" : p));
  };

  // Initialize role, history and clear notifications
  useEffect(() => {
    if (!order?.id || !wallet) return;

    const rid = order.id;

    const role = order.type === "buy" ? "buyer" : "seller";
    setUserRole(role);

    const loadHistory = async () => {
      try {
        // Load from server (source of truth)
        const history = await loadServerChatHistory(rid);
        setChatLog(history);
        lastMessageCountRef.current = history.length;
      } catch {
        // Fallback to localStorage
        const history = loadChatHistory(rid);
        setChatLog(history);
        lastMessageCountRef.current = history.length;
      }
    };

    loadHistory();
    clearNotificationsForRoom(rid);
  }, [order?.id, wallet]);

  // Poll for new messages every 2 seconds
  useEffect(() => {
    if (!order?.id || !wallet?.publicKey) return;

    const setupPolling = () => {
      syncIntervalRef.current = setInterval(async () => {
        try {
          const messages = await loadServerChatHistory(order.id);
          // Only update if message count changed
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
  }, [order?.id, wallet?.publicKey]);

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

  const [hasReceived, setHasReceived] = useState(false);
  const [sendAmount, setSendAmount] = useState("");
  const [toWallet, setToWallet] = useState(counterpartyWallet);
  const [sellerToken, setSellerToken] = useState<string>(token);
  const sellerTokenInfo = useMemo(
    () =>
      tokens.find(
        (t) =>
          (t.symbol || "").toUpperCase() === String(sellerToken).toUpperCase(),
      ),
    [tokens, sellerToken],
  );
  const [readyToConfirmSend, setReadyToConfirmSend] = useState(false);

  useEffect(() => {
    if (!toWallet && counterpartyWallet) {
      setToWallet(counterpartyWallet);
    }
  }, [counterpartyWallet, toWallet]);

  const sendTextMessage = async () => {
    if (!messageInput.trim() || !derivedRoomId || !wallet) return;
    const text = messageInput.trim();
    setMessageInput("");

    try {
      // Save to server first
      const serverMsg = await saveServerChatMessage(
        derivedRoomId,
        wallet.publicKey,
        text,
      );

      if (serverMsg) {
        serverMsg.senderRole = userRole;
        setChatLog((prev) => [...prev, serverMsg]);
        lastMessageCountRef.current += 1;
      } else {
        // Fallback to localStorage
        const message: ChatMessage = {
          id: `msg-${Date.now()}`,
          roomId: derivedRoomId,
          senderWallet: wallet.publicKey,
          senderRole: userRole,
          type: "message",
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

  const handleReceived = () => {
    if (!derivedRoomId || !wallet) return;
    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      roomId: derivedRoomId,
      senderWallet: wallet.publicKey,
      senderRole: "seller",
      type: "seller_verified",
      text: "Seller verified buyer's payment",
      timestamp: Date.now(),
    };
    saveChatMessage(message);
    toast({ title: "Payment received" });
    setHasReceived(true);
    setPhase("seller_verified");
  };

  const handleSendTransaction = () => {
    setReadyToConfirmSend(true);
    toast({ title: "Transaction prepared" });
  };

  const handleSentAsset = () => {
    if (!derivedRoomId || !wallet) return;
    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      roomId: derivedRoomId,
      senderWallet: wallet.publicKey,
      senderRole: "seller",
      type: "seller_transferred",
      text: "Seller marked transfer as completed",
      timestamp: Date.now(),
    };
    saveChatMessage(message);
    toast({ title: "Assets sent" });
    setPhase("seller_transferred");
  };

  const sellerApprove = () => {
    if (!derivedRoomId || !wallet) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      roomId: derivedRoomId,
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
    setChatLog((prev) => [...prev, message]);
  };

  const sellerVerified = () => {
    if (!derivedRoomId || !wallet) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      roomId: derivedRoomId,
      senderWallet: wallet.publicKey,
      senderRole: "seller",
      type: "seller_verified",
      text: "Seller verified buyer's payment",
      timestamp: Date.now(),
    };

    saveChatMessage(message);
    setChatLog((prev) => [...prev, message]);
  };

  const sellerTransferred = () => {
    if (!derivedRoomId || !wallet) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      roomId: derivedRoomId,
      senderWallet: wallet.publicKey,
      senderRole: "seller",
      type: "seller_transferred",
      text: "Seller marked transfer as completed",
      timestamp: Date.now(),
    };

    saveChatMessage(message);
    setChatLog((prev) => [...prev, message]);
  };

  const sellerFail = () => {
    if (!derivedRoomId || !wallet) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      roomId: derivedRoomId,
      senderWallet: wallet.publicKey,
      senderRole: "seller",
      type: "order_failed",
      text: "Order failed - Seller cancelled",
      metadata: { reason: "Seller cancelled" },
      timestamp: Date.now(),
    };

    saveChatMessage(message);
    setChatLog((prev) => [...prev, message]);
  };

  const buyerConfirmReceipt = () => {
    if (!derivedRoomId || !wallet) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      roomId: derivedRoomId,
      senderWallet: wallet.publicKey,
      senderRole: "buyer",
      type: "buyer_confirmed_receipt",
      text: "Buyer confirmed receipt of assets",
      timestamp: Date.now(),
    };

    saveChatMessage(message);
    setChatLog((prev) => [...prev, message]);
    setPhase("completed");
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
    if (!file || !derivedRoomId || !wallet) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const message: ChatMessage = {
        id: `msg-${Date.now()}`,
        roomId: derivedRoomId,
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
      console.error("Attachment failed", e);
      toast({
        title: "Upload failed",
        description: "Could not attach image",
        variant: "destructive",
      });
    }
  }

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
          {isSeller ? (
            <div className="space-y-4">
              {counterpartyWallet ? (
                <div className="p-3 rounded-xl bg-[#0f1520]/50 border border-[#FF7A5C]/30 flex items-center justify-between">
                  <div className="text-xs text-white/70">Buyer wallet</div>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm">
                      {shortenAddress(counterpartyWallet, 8)}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Copy buyer address"
                      onClick={async () => {
                        const ok = await copyToClipboard(counterpartyWallet);
                        if (ok) toast({ title: "Buyer address copied" });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}

              {!hasReceived ? (
                <Button
                  onClick={handleReceived}
                  className="wallet-button-primary w-full"
                >
                  I have received
                </Button>
              ) : (
                <>
                  <div className="p-4 rounded-xl bg-[#0f1520]/50 border border-[#FF7A5C]/30">
                    <div className="text-sm font-medium mb-2">
                      Select token and balance
                    </div>
                    <select
                      value={sellerToken}
                      onChange={(e) => setSellerToken(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white cursor-pointer"
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
                    <div className="mt-2 font-semibold">
                      Wallet balance:{" "}
                      {sellerTokenInfo?.balance?.toFixed(6) || "0.000000"}{" "}
                      {sellerToken}
                    </div>
                  </div>
                  <div className="grid gap-3">
                    <input
                      className="px-3 py-2 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white placeholder-white/40"
                      placeholder="Amount"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                    />
                    <input
                      className="px-3 py-2 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white placeholder-white/40"
                      placeholder="To wallet"
                      value={toWallet}
                      onChange={(e) => setToWallet(e.target.value)}
                    />
                  </div>
                  {!readyToConfirmSend ? (
                    <Button
                      onClick={handleSendTransaction}
                      className="wallet-button-primary w-full"
                    >
                      Send transaction
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSentAsset}
                      className="wallet-button-secondary w-full"
                    >
                      I have sent asset
                    </Button>
                  )}
                </>
              )}

              <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2 p-3 bg-[#0f1520]/50 rounded-lg border border-[#FF7A5C]/20">
                {chatLog.length === 0 ? (
                  <div className="text-xs text-white/60 text-center py-4">
                    No messages yet
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
                            className="rounded-lg max-h-48 border border-white/5"
                          />
                        </div>
                      )}
                      <div className="text-xs text-white/50 mt-1">
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
          ) : (
            <div className="space-y-4">
              {phase === "entry" ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-white/70">
                      Select Token
                    </label>
                    <select
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white placeholder-white/40 appearance-none cursor-pointer"
                    >
                      {Object.keys(TOKEN_MINTS).map((tokenName) => (
                        <option
                          key={tokenName}
                          value={tokenName}
                          className="bg-[#1a2540] text-white"
                        >
                          {tokenName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-white/70">
                      Amount PKR
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white placeholder-white/40"
                      placeholder="Enter PKR amount"
                      value={amountPKR}
                      onChange={(e) =>
                        setAmountPKR(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                    />
                  </div>

                  {pricePKR && (
                    <div className="p-3 rounded-lg bg-[#0f1520]/50 border border-[#FF7A5C]/20">
                      <div className="text-xs text-white/60 mb-2">
                        Price: {pricePKR.toFixed(2)} PKR per {token}
                      </div>
                      {estimatedTokens > 0 && (
                        <div className="text-sm font-semibold text-white">
                          You will receive: {estimatedTokens.toFixed(6)} {token}
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    onClick={handleConfirm}
                    disabled={!canConfirm}
                    className="wallet-button-primary w-full disabled:opacity-50"
                  >
                    Request to Buy
                  </Button>
                </>
              ) : (
                <>
                  {phase === "awaiting_seller_approval" && (
                    <div className="p-3 rounded-lg bg-[#FF7A5C]/10 border border-[#FF7A5C]/30 text-sm text-white/80">
                      Waiting for seller to approve...
                    </div>
                  )}

                  {phase === "seller_approved" && sellerInfo && (
                    <>
                      <div className="p-3 rounded-lg bg-[#0f1520]/50 border border-[#FF7A5C]/30 space-y-2">
                        <div className="text-xs font-semibold text-white/70">
                          MAKE PAYMENT
                        </div>
                        <div>
                          <div className="text-xs text-white/60">
                            ACCOUNT NAME
                          </div>
                          <div className="text-sm font-medium text-white">
                            {sellerInfo.accountName}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-white/60">
                            ACCOUNT NUMBER
                          </div>
                          <div className="text-sm font-medium text-white">
                            {sellerInfo.accountNumber}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-white/60">
                            PAYMENT METHOD
                          </div>
                          <div className="text-sm font-medium text-white">
                            {sellerInfo.paymentMethod}
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={notifySeller}
                        className="wallet-button-primary w-full"
                      >
                        I've Sent Payment
                      </Button>
                    </>
                  )}

                  {phase === "awaiting_seller_verified" && (
                    <div className="p-3 rounded-lg bg-[#FF7A5C]/10 border border-[#FF7A5C]/30 text-sm text-white/80">
                      Waiting for seller to verify payment...
                    </div>
                  )}

                  {phase === "seller_verified" && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm text-green-400/80">
                      Seller verified payment. Assets are being transferred...
                    </div>
                  )}

                  {phase === "seller_transferred" && (
                    <Button
                      onClick={buyerConfirmReceipt}
                      className="wallet-button-primary w-full"
                    >
                      Confirm Receipt
                    </Button>
                  )}

                  {phase === "completed" && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm text-green-400/80 text-center font-semibold">
                      Order Completed Successfully!
                    </div>
                  )}

                  {phase === "failed" && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400/80">
                      {failMsg}
                    </div>
                  )}

                  <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2 p-3 bg-[#0f1520]/50 rounded-lg border border-[#FF7A5C]/20">
                    {chatLog.length === 0 ? (
                      <div className="text-xs text-white/60 text-center py-4">
                        No messages yet
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
                                className="rounded-lg max-h-48 border border-white/5"
                              />
                            </div>
                          )}
                          <div className="text-xs text-white/50 mt-1">
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
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
