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
import { ArrowLeft, Plus, Send, MessageSquare } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useDurableRoom } from "@/hooks/useDurableRoom";
import { API_BASE, ADMIN_WALLET } from "@/lib/p2p";
import { useToast } from "@/hooks/use-toast";
import { listOrders } from "@/lib/p2p";
import { listP2POrders } from "@/lib/p2p-api";
import {
  saveChatMessage,
  saveNotification,
  broadcastNotification,
  sendChatMessage,
  loadChatHistory,
  parseWebSocketMessage,
  getUnreadNotifications,
  type ChatMessage,
  type ChatNotification,
} from "@/lib/p2p-chat";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type ActionType = "buyer_paid" | "seller_sent";

export default function SelectPage() {
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
  const { send: sendGlobal } = useDurableRoom("global", API_BASE);

  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Load orders: Admin sees all orders, others see pending orders from unread notifications
  useEffect(() => {
    if (!wallet?.publicKey) return;
    const isAdmin =
      ADMIN_WALLET &&
      String(wallet.publicKey).toLowerCase() ===
        String(ADMIN_WALLET).toLowerCase();

    if (isAdmin) {
      // Admin: Load all orders from the backend
      const loadAllOrders = async () => {
        try {
          const allOrders = await listP2POrders();
          if (Array.isArray(allOrders) && allOrders.length) {
            setOrders((prev) => {
              const byId = new Map<string, any>();
              [...allOrders, ...prev].forEach((o: any) => {
                const key = String(o.id || o.orderId);
                if (key && !byId.has(key)) byId.set(key, o);
              });
              return Array.from(byId.values());
            });
          }
        } catch (err) {
          console.error("Failed to load all orders for admin:", err);
        }
      };
      loadAllOrders();
    } else {
      // Non-admin: Load unread notifications
      try {
        const unread = getUnreadNotifications(wallet.publicKey);
        if (Array.isArray(unread) && unread.length) {
          const mapped = unread.map((n: any) => ({
            id: n.roomId || n.data?.orderId || `room-${n.timestamp}`,
            token: n.data?.token,
            type: n.initiatorRole === "buyer" ? "buy" : "sell",
            message: n.message,
            paymentMethod: n.data?.paymentMethod,
          }));
          setOrders((prev) => {
            const byId = new Map<string, any>();
            [...mapped, ...prev].forEach((o: any) => {
              const key = String(o.id || o.orderId);
              if (!byId.has(key)) byId.set(key, o);
            });
            return Array.from(byId.values());
          });
        }
      } catch {}
    }
  }, [wallet?.publicKey]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoadingOrders(true);
        const res = await listOrders(effectiveRoomId);
        if (!mounted) return;
        const fetched = Array.isArray(res.orders) ? res.orders : [];
        setOrders((prev) => {
          const byId = new Map<string, any>();
          [...fetched, ...prev].forEach((o: any) => {
            const key = String(o.id || o.orderId || "");
            if (key && !byId.has(key)) byId.set(key, o);
          });
          return Array.from(byId.values());
        });
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
    } else if (last.kind === "notification") {
      const notif = last.data as any;
      if (!notif) return;
      // Only reflect for admin wallet to show pending verifications
      const isAdmin =
        ADMIN_WALLET &&
        wallet?.publicKey &&
        String(wallet.publicKey).toLowerCase() ===
          String(ADMIN_WALLET).toLowerCase();
      if (!isAdmin) return;
      try {
        if (notif.initiatorWallet !== wallet.publicKey) {
          saveNotification(notif);
        }
      } catch {}
      const virtualOrder = {
        id: notif.roomId || notif.data?.orderId || `room-${Date.now()}`,
        token: notif.data?.token,
        type: notif.initiatorRole === "buyer" ? "buy" : "sell",
        message: notif.message,
        paymentMethod: notif.data?.paymentMethod,
      };
      setOrders((prev) => {
        const existsIdx = prev.findIndex(
          (o) => String(o.id || o.orderId) === String(virtualOrder.id),
        );
        if (existsIdx >= 0) {
          const copy = prev.slice();
          copy[existsIdx] = { ...copy[existsIdx], ...virtualOrder };
          return copy;
        }
        return [virtualOrder, ...prev];
      });
    }
  }, [events, effectiveRoomId, wallet?.publicKey]);

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

  // Inline Buy section state
  const BUY_TOKENS = ["FIXERCOIN", "SOL", "USDC", "USDT"] as const;
  type BuyToken = (typeof BUY_TOKENS)[number];
  const [buyToken, setBuyToken] = useState<BuyToken>("FIXERCOIN");
  const [amountPKR, setAmountPKR] = useState<string>("");
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [estimatedTokens, setEstimatedTokens] = useState<number>(0);
  const [fetchingRate, setFetchingRate] = useState<boolean>(false);
  const [submittingBuy, setSubmittingBuy] = useState<boolean>(false);
  const [activeSide, setActiveSide] = useState<"buy" | "sell">("buy");

  useEffect(() => {
    const fetchRate = async () => {
      setFetchingRate(true);
      try {
        const res = await fetch(`/api/exchange-rate?token=${buyToken}`);
        if (!res.ok) throw new Error(`Rate ${res.status}`);
        const data = await res.json();
        const rate = data.rate || data.priceInPKR || 0;
        setExchangeRate(typeof rate === "number" && rate > 0 ? rate : 0);
      } catch (e) {
        console.error("Failed to fetch exchange rate", e);
        setExchangeRate(0);
      } finally {
        setFetchingRate(false);
      }
    };
    fetchRate();
  }, [buyToken]);

  useEffect(() => {
    if (amountPKR && exchangeRate > 0) {
      setEstimatedTokens(Number(amountPKR) / exchangeRate);
    } else {
      setEstimatedTokens(0);
    }
  }, [amountPKR, exchangeRate]);

  // Inline Sell section state and effects
  const SELL_TOKENS = BUY_TOKENS;
  type SellToken = (typeof SELL_TOKENS)[number];
  const [sellToken, setSellToken] = useState<SellToken>("FIXERCOIN");
  const [sellAmountTokens, setSellAmountTokens] = useState<string>("");
  const [sellExchangeRate, setSellExchangeRate] = useState<number>(0);
  const [sellEstimatedPKR, setSellEstimatedPKR] = useState<number>(0);
  const [sellFetchingRate, setSellFetchingRate] = useState<boolean>(false);
  const [sellSubmitting, setSellSubmitting] = useState<boolean>(false);
  const [sellAccountName, setSellAccountName] = useState<string>("");
  const [sellAccountNumber, setSellAccountNumber] = useState<string>("");
  const [sellPaymentMethod, setSellPaymentMethod] =
    useState<string>("easypaisa");

  const sellAvailableBalance = useMemo(() => {
    const t = tokens.find(
      (tk) => (tk.symbol || "").toUpperCase() === sellToken,
    );
    return t?.balance ? Number(t.balance) : 0;
  }, [tokens, sellToken]);

  useEffect(() => {
    const fetchSellRate = async () => {
      setSellFetchingRate(true);
      try {
        const res = await fetch(`/api/exchange-rate?token=${sellToken}`);
        if (!res.ok) throw new Error(`Rate ${res.status}`);
        const data = await res.json();
        const rate = data.rate || data.priceInPKR || 0;
        setSellExchangeRate(typeof rate === "number" && rate > 0 ? rate : 0);
      } catch (e) {
        console.error("Failed to fetch sell exchange rate", e);
        setSellExchangeRate(0);
      } finally {
        setSellFetchingRate(false);
      }
    };
    fetchSellRate();
  }, [sellToken]);

  useEffect(() => {
    const amt = Number(sellAmountTokens);
    if (amt > 0 && sellExchangeRate > 0) {
      setSellEstimatedPKR(amt * sellExchangeRate);
    } else {
      setSellEstimatedPKR(0);
    }
  }, [sellAmountTokens, sellExchangeRate]);

  const handleConfirmSell = async () => {
    if (!wallet?.publicKey) {
      toast({ title: "Wallet Not Connected", variant: "destructive" });
      return;
    }
    const amt = Number(sellAmountTokens);
    if (
      !amt ||
      amt <= 0 ||
      amt > sellAvailableBalance ||
      sellExchangeRate <= 0
    ) {
      toast({
        title: "Invalid amount",
        description: "Enter valid token amount",
        variant: "destructive",
      });
      return;
    }
    if (!sellAccountName || !sellAccountNumber) {
      toast({
        title: "Missing details",
        description: "Enter account name and number",
        variant: "destructive",
      });
      return;
    }
    setSellSubmitting(true);
    try {
      const roomId = `ORD-${Date.now()}`;
      const payloadForSell = {
        roomId,
        token: sellToken,
        amountTokens: amt,
        amountPKR: Number((amt * sellExchangeRate).toFixed(2)),
        paymentMethod: sellPaymentMethod,
        sellerWallet: wallet.publicKey,
        adminWallet: ADMIN_WALLET,
        sellerAccountName: sellAccountName,
        sellerAccountNumber: sellAccountNumber,
      };
      navigate("/select", {
        state: {
          action: "seller_sent",
          payload: payloadForSell,
          confirmation: {
            title: "Confirm Token Transfer",
            message: `You are confirming to send ${amt.toFixed(6)} ${sellToken} to admin wallet and receive PKR ${Number((amt * sellExchangeRate).toFixed(2))} via ${sellPaymentMethod}.`,
            details: [
              { label: "Token", value: sellToken },
              { label: "Amount (Token)", value: amt.toFixed(6) },
              {
                label: "Estimated PKR",
                value: Number((amt * sellExchangeRate).toFixed(2)),
              },
              { label: "Admin Wallet", value: ADMIN_WALLET || "—" },
              { label: "Account Name", value: sellAccountName },
              { label: "Account Number", value: sellAccountNumber },
              { label: "Payment Method", value: sellPaymentMethod },
            ],
            buttonText: "Confirm",
          },
        },
      });
    } finally {
      setSellSubmitting(false);
    }
  };

  const handleConfirmFiatTransfer = async () => {
    if (!wallet?.publicKey) {
      toast({ title: "Wallet Not Connected", variant: "destructive" });
      return;
    }
    if (!amountPKR || Number(amountPKR) <= 0 || exchangeRate <= 0) {
      toast({
        title: "Invalid amount",
        description: "Enter PKR amount",
        variant: "destructive",
      });
      return;
    }
    setSubmittingBuy(true);
    try {
      const roomId = `ORD-${Date.now()}`;
      const payloadForBuy = {
        roomId,
        token: buyToken,
        amountPKR: Number(amountPKR),
        estimatedTokens: Number((Number(amountPKR) / exchangeRate).toFixed(6)),
        pricePKRPerQuote: exchangeRate,
        paymentMethod: "easypaisa",
        buyerWallet: wallet.publicKey,
        seller: {
          accountName: "ameer nawaz khan",
          accountNumber: "03107044833",
        },
      };
      navigate("/select", {
        state: {
          action: "buyer_paid",
          payload: payloadForBuy,
          confirmation: {
            title: "Confirm Fiat Transfer",
            message: `You are confirming PKR ${Number(amountPKR).toFixed(2)} payment via easypaisa`,
            details: [
              { label: "Token", value: buyToken },
              { label: "Amount (PKR)", value: Number(amountPKR).toFixed(2) },
              {
                label: "Estimated Receive",
                value: `${payloadForBuy.estimatedTokens.toFixed(6)} ${buyToken}`,
              },
              { label: "Seller Name", value: "ameer nawaz khan" },
              { label: "Account Number", value: "03107044833" },
              { label: "Payment Method", value: "easypaisa" },
            ],
            buttonText: "Confirm",
          },
        },
      });
    } finally {
      setSubmittingBuy(false);
    }
  };

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
        broadcastNotification(send, notification);
        broadcastNotification(sendGlobal, notification);
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
        broadcastNotification(sendGlobal, notification);
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

      <div className="w-full mx-auto px-4 sm:px-6 relative z-20 flex flex-col items-center gap-2">
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg order-0 mt-6 flex items-center justify-end">
          <span className="text-sm text-white/70 select-none">
            info@fixorium.com.pk
          </span>
        </div>

        <div
          id="trade-card"
          className="w-full max-w-sm sm:max-w-md md:max-w-lg rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-[#0f1520]/30 border border-white/10 order-3"
        >
          <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full mb-4">
            <Button
              onClick={() => {
                setActiveSide("buy");
                const el = document.getElementById("trade-card");
                if (el)
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="w-full py-2 sm:py-3 h-12 rounded-xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] hover:shadow-xl hover:scale-105 transition-all duration-300 text-white font-semibold text-sm sm:text-base shadow-lg active:scale-95"
            >
              BUY
            </Button>

            <Button
              onClick={() => {
                setActiveSide("sell");
                const el = document.getElementById("trade-card");
                if (el)
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="w-full py-2 sm:py-3 h-12 rounded-xl bg-gradient-to-br from-[#FF5A8C] to-[#FF7A5C] hover:shadow-xl hover:scale-105 transition-all duration-300 text-white font-semibold text-sm sm:text-base shadow-lg active:scale-95"
            >
              SELL
            </Button>
          </div>
          {activeSide === "buy" ? (
            <div className="space-y-4">
              <div>
                <label className="block font-medium text-white/80 mb-2">
                  Select Token
                </label>
                <Select
                  value={buyToken}
                  onValueChange={(v) => setBuyToken(v as BuyToken)}
                >
                  <SelectTrigger className="bg-[#1a2540]/50 border-white/10 text-white">
                    <SelectValue placeholder="Select token" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2540] border-white/10">
                    {BUY_TOKENS.map((t) => (
                      <SelectItem key={t} value={t} className="text-white">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block font-medium text-white/80 mb-2">
                  Amount (PKR)
                </label>
                <input
                  type="number"
                  value={amountPKR}
                  onChange={(e) => setAmountPKR(e.target.value)}
                  placeholder="Enter amount in PKR"
                  className="w-full px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#FF7A5C] text-white placeholder-white/40"
                  min="0"
                  step="100"
                />
              </div>

              <div className="p-3 rounded-lg bg-[#1a2540]/40 border border-[#FF7A5C]/30">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/70">Exchange Rate</span>
                  <span className="font-semibold text-[#FF7A5C]">
                    {fetchingRate
                      ? "Fetching..."
                      : `1 ${buyToken} = ${exchangeRate > 0 ? (exchangeRate < 1 ? exchangeRate.toFixed(6) : exchangeRate.toFixed(2)) : "0.00"} PKR`}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm mt-2">
                  <span className="text-white/70">You Will Receive</span>
                  <span className="font-bold text-[#FF7A5C]">
                    {estimatedTokens.toFixed(6)} {buyToken}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#1a2540]/40 border border-white/10 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/70">Seller Name</span>
                  <span className="text-white">ameer nawaz khan</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-white/70">Account Number</span>
                  <span className="text-white">03107044833</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-white/70">Payment Method</span>
                  <span className="text-white">easypaisa</span>
                </div>
              </div>

              <Button
                onClick={handleConfirmFiatTransfer}
                disabled={
                  submittingBuy ||
                  !amountPKR ||
                  Number(amountPKR) <= 0 ||
                  exchangeRate <= 0
                }
                className="w-full h-12 rounded-lg font-semibold bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white shadow-lg disabled:opacity-50"
              >
                Confirm Fiat Transfer
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block font-medium text-white/80 mb-2">
                  Select Token
                </label>
                <Select
                  value={sellToken}
                  onValueChange={(v) => setSellToken(v as SellToken)}
                >
                  <SelectTrigger className="bg-[#1a2540]/50 border-white/10 text-white">
                    <SelectValue placeholder="Select token" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2540] border-white/10">
                    {SELL_TOKENS.map((t) => (
                      <SelectItem key={t} value={t} className="text-white">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-2 text-xs text-white/60">
                  Balance:{" "}
                  <span className="text-white/80">
                    {Number(sellAvailableBalance).toFixed(6)} {sellToken}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-white/80 mb-2">
                  Amount ({sellToken})
                </label>
                <input
                  type="number"
                  value={sellAmountTokens}
                  onChange={(e) => setSellAmountTokens(e.target.value)}
                  placeholder={`Enter amount in ${sellToken}`}
                  className="w-full px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#FF7A5C] text-white placeholder-white/40"
                  min="0"
                  step="0.000001"
                />
                <div className="mt-1 text-xs text-white/60">
                  Estimated PKR:{" "}
                  <span className="text-[#FF7A5C] font-semibold">
                    {sellEstimatedPKR.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#1a2540]/40 border border-[#FF7A5C]/30">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/70">Exchange Rate</span>
                  <span className="font-semibold text-[#FF7A5C]">
                    {sellFetchingRate
                      ? "Fetching..."
                      : `1 ${sellToken} = ${sellExchangeRate > 0 ? (sellExchangeRate < 1 ? sellExchangeRate.toFixed(6) : sellExchangeRate.toFixed(2)) : "0.00"} PKR`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-sm text-white/70 mb-1">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={sellAccountName}
                    onChange={(e) => setSellAccountName(e.target.value)}
                    placeholder="Your account name"
                    className="w-full px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#FF7A5C] text-white placeholder-white/40"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={sellAccountNumber}
                    onChange={(e) => setSellAccountNumber(e.target.value)}
                    placeholder="e.g. 0310xxxxxxx"
                    className="w-full px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#FF7A5C] text-white placeholder-white/40"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">
                    Payment Method
                  </label>
                  <input
                    type="text"
                    value={sellPaymentMethod}
                    onChange={(e) => setSellPaymentMethod(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-white/10 text-white"
                  />
                </div>
              </div>

              <Button
                onClick={handleConfirmSell}
                disabled={
                  sellSubmitting ||
                  !sellAmountTokens ||
                  Number(sellAmountTokens) <= 0 ||
                  Number(sellAmountTokens) > sellAvailableBalance ||
                  !sellAccountName ||
                  !sellAccountNumber ||
                  sellExchangeRate <= 0
                }
                className="w-full h-12 rounded-lg font-semibold bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white shadow-lg disabled:opacity-50"
              >
                Confirm Transaction
              </Button>
            </div>
          )}
        </div>

        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg order-1">
          {/* Orders list displayed as prompt messages - moved above image */}
          <div className="mb-3 space-y-3">
            {loadingOrders ? (
              <div className="text-sm text-white/60">Loading orders...</div>
            ) : orders.length === 0 ? (
              payload && payload.roomId ? (
                <div className="p-4 bg-[#0f1520]/50 border border-white/10">
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
                          navigate("/express/buy-trade", {
                            state: {
                              order: {
                                id: payload.roomId,
                                token: payload.token,
                                pricePKRPerQuote: payload.pricePKRPerQuote,
                                paymentMethod: payload.paymentMethod,
                                type: action === "buyer_paid" ? "buy" : "sell",
                              },
                              openChat: true,
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
                  className="p-4 bg-[#0f1520]/50 border border-white/10"
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

          <div className="w-full rounded-2xl p-4 sm:p-6 bg-transparent flex items-center justify-center">
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
