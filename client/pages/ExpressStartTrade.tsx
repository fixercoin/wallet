import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Copy, MessageSquare, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/lib/wallet";

const SELLER_CONFIRM_TIMEOUT_MS = 5 * 60 * 1000;

interface NavState {
  side?: "buy" | "sell";
  pkrAmount?: number;
  token?: "USDC" | "SOL" | "FIXERCOIN" | string;
  tokenUnits?: number; // computed estimate from previous page
  paymentMethod?: "bank" | "easypaisa" | "firstpay" | string;
  tradeId?: string;
}

export default function ExpressStartTrade() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { state } = useLocation();
  const params = (state || {}) as NavState;

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [tradeId, setTradeId] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [sellerConfirmed, setSellerConfirmed] = useState(false);
  const [buyerMarkedPaid, setBuyerMarkedPaid] = useState(false);
  const [fiatAcknowledged, setFiatAcknowledged] = useState(false);
  const [sellerSentCrypto, setSellerSentCrypto] = useState(false);
  const [sellerApproved, setSellerApproved] = useState(false);
  const [orderCancelledByCounterparty, setOrderCancelledByCounterparty] =
    useState(false);
  const [remoteSellerDetails, setRemoteSellerDetails] = useState<{
    accountName?: string;
    accountNumber?: string;
    method?: string;
  } | null>(null);

  const [baselineSig, setBaselineSig] = useState<string | null>(null);
  const [txDetected, setTxDetected] = useState(false);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const pollRef = useRef<number | null>(null);
  const finalizedRef = useRef(false);
  const sellerConfirmTimeoutRef = useRef<number | null>(null);
  const lastTimeoutMessageId = useRef<string | null>(null);

  const { wallet } = useWallet();
  const buyerPublicKey = wallet?.publicKey || null;
  const localRole = params?.side === "sell" ? "seller" : "buyer";

  const effectiveTradeId = tradeId || params?.tradeId || null;

  const sendSystemMessage = useCallback(
    async (message: string, fromOverride?: string) => {
      if (!effectiveTradeId) {
        throw new Error("Missing trade context");
      }
      const resp = await fetch(
        `/api/p2p/trade/${encodeURIComponent(String(effectiveTradeId))}/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            from: fromOverride ?? localRole,
          }),
        },
      );
      if (!resp.ok) {
        throw new Error("Failed to send trade message");
      }
    },
    [effectiveTradeId, localRole],
  );

  const cancelOrder = useCallback(
    (options?: {
      message?: string;
      toastTitle?: string;
      toastDescription?: string;
      variant?: "default" | "destructive";
    }) => {
      if (sellerConfirmTimeoutRef.current) {
        window.clearTimeout(sellerConfirmTimeoutRef.current);
        sellerConfirmTimeoutRef.current = null;
      }
      const messageToSend = options?.message ?? "__ORDER_CANCELLED__";
      sendSystemMessage(messageToSend).catch(() => undefined);
      try {
        localStorage.removeItem("expressPendingOrder");
      } catch {}
      finalizedRef.current = true;
      setAwaitingApproval(false);
      setBuyerMarkedPaid(false);
      setTxDetected(false);
      setFiatAcknowledged(false);
      setSellerConfirmed(false);
      setSellerSentCrypto(false);
      setSellerApproved(false);
      toast({
        title: options?.toastTitle ?? "Order cancelled",
        description: options?.toastDescription,
        variant: options?.variant,
      });
      navigate("/express");
    },
    [effectiveTradeId, navigate, sendSystemMessage, toast],
  );

  const handleCancelOrder = useCallback(() => {
    cancelOrder();
  }, [cancelOrder]);
  const isEasypaisa = useMemo(
    () => String(params?.paymentMethod || "").toLowerCase() === "easypaisa",
    [params?.paymentMethod],
  );

  // Counterparty-provided buyer address (via trade message fallback)
  const [counterpartyBuyerAddress, setCounterpartyBuyerAddress] = useState<
    string | null
  >(null);
  const buyerAddrSentRef = useRef<string | null>(null);

  // Load posts to match an order against seller/buyer listings
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const resp = await fetch("/api/p2p/list");
        if (!resp.ok) throw new Error("Failed to load posts");
        const data = await resp.json();
        if (mounted) setPosts(Array.isArray(data?.posts) ? data.posts : []);
      } catch (e) {
        if (mounted) setError("Unable to load market posts");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Choose a matching post
  const match = useMemo(() => {
    if (!Array.isArray(posts) || !params?.token) return null;
    const desiredUnits = Number(params?.tokenUnits || 0);
    const typeNeeded = params?.side === "buy" ? "sell" : "buy";
    const candidates = posts.filter(
      (p: any) =>
        p?.type === typeNeeded &&
        String(p?.token).toUpperCase() === String(params.token).toUpperCase() &&
        (params?.side === "buy"
          ? String(p?.paymentMethod).toLowerCase() ===
            String(params.paymentMethod || "").toLowerCase()
          : true),
    );
    const within = candidates.find(
      (p: any) =>
        desiredUnits >= Number(p?.minToken || 0) &&
        desiredUnits <= Number(p?.maxToken || 0),
    );
    if (within) return within;
    const eligible = candidates
      .slice()
      .sort((a: any, b: any) => Number(a.minToken) - Number(b.minToken));
    return eligible[0] || null;
  }, [posts, params]);

  // Create or reuse a tradeId for messaging scope
  useEffect(() => {
    const incomingTradeId = (state as any)?.tradeId as string | undefined;
    if (incomingTradeId) {
      setTradeId(incomingTradeId);
      return;
    }
    const base = (match?.id || "no-post") + "";
    setTradeId(`${base}-${Date.now()}`);
  }, [match, state]);

  // Post an initial order-start event for admin monitoring
  const orderInitSentRef = useRef<string | null>(null);
  const lastCancelledMessageId = useRef<string | null>(null);
  const lastBuyerPaidMessageId = useRef<string | null>(null);
  const lastFiatAckMessageId = useRef<string | null>(null);
  const lastSellerApprovedMessageId = useRef<string | null>(null);
  const lastPromptSellerMessageId = useRef<string | null>(null);
  const lastPromptBuyerMessageId = useRef<string | null>(null);
  const lastSellerDetailsMessageId = useRef<string | null>(null);
  useEffect(() => {
    if (!tradeId || !params?.side) return;
    if (orderInitSentRef.current === tradeId) return;
    const side = params.side;
    const token = params.token || "USDC";
    const pkr = Number(params.pkrAmount || 0);
    const units = Number(params.tokenUnits || 0);
    const method = String(params.paymentMethod || "");
    const msg = `__ORDER_STARTED__|side=${side};token=${token};pkr=${pkr};units=${units};method=${method}`;
    (async () => {
      try {
        await fetch(`/api/p2p/trade/${encodeURIComponent(tradeId)}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, from: localRole }),
        });
      } catch {}
    })();
    orderInitSentRef.current = tradeId;
  }, [tradeId, params, localRole]);

  // Poll messages for this trade
  useEffect(() => {
    if (!tradeId) return;
    let mounted = true;
    const load = async () => {
      try {
        const resp = await fetch(
          `/api/p2p/trade/${encodeURIComponent(tradeId)}/messages`,
        );
        if (!resp.ok) return;
        const data = await resp.json();
        if (mounted)
          setMessages(Array.isArray(data?.messages) ? data.messages : []);
      } catch {}
    };
    load();
    const id = setInterval(load, 2000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [tradeId]);

  // Persist a pending order snapshot so users can resume
  useEffect(() => {
    if (!tradeId) return;
    const payload = {
      tradeId,
      minimized: false,
      status: "review",
      params,
      ts: Date.now(),
    } as any;
    try {
      localStorage.setItem("expressPendingOrder", JSON.stringify(payload));
    } catch {}
  }, [tradeId, params]);

  useEffect(() => {
    setAwaitingApproval(false);
    setTxDetected(false);
    setBuyerMarkedPaid(false);
    setFiatAcknowledged(false);
    setSellerSentCrypto(false);
    setSellerApproved(false);
    setOrderCancelledByCounterparty(false);
    finalizedRef.current = false;
  }, [tradeId]);

  const finalizeOrder = useCallback(
    (
      source: "buyer" | "seller" | "system",
      options?: { toastTitle?: string; toastDescription?: string },
    ) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      setAwaitingApproval(false);
      setTxDetected(false);
      setSellerApproved(true);
      try {
        localStorage.removeItem("expressPendingOrder");
      } catch {}
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      try {
        localStorage.setItem(
          "expressLastOrder",
          JSON.stringify({ tradeId, params, ts: Date.now(), source }),
        );
      } catch {}
      if (options?.toastTitle) {
        toast({
          title: options.toastTitle,
          description: options.toastDescription,
        });
      }
      navigate("/express/order-complete", {
        state: { tradeId, params, ts: Date.now(), source },
      });
    },
    [navigate, params, toast, tradeId],
  );

  // Handle trade state updates received via prompt messages
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const reversed = messages.slice().reverse();

    // Parse buyer wallet address if provided via message
    const buyerAddrMsg = reversed.find(
      (m) =>
        typeof m?.message === "string" &&
        m.message.startsWith("__BUYER_WALLET__|"),
    );
    if (buyerAddrMsg) {
      const part = String(buyerAddrMsg.message).split("|")[1] || "";
      const kv = Object.fromEntries(
        part
          .split(";")
          .map((s) => s.split("=").map((x) => x.trim()))
          .filter((p) => p.length === 2),
      ) as any;
      if (kv.addr && typeof kv.addr === "string" && kv.addr.length > 20) {
        setCounterpartyBuyerAddress(kv.addr);
      }
    }

    const timeoutMsg = reversed.find(
      (m) => String(m?.message) === "__AUTO_CLOSE_TIMEOUT__",
    );
    if (
      timeoutMsg &&
      timeoutMsg.id &&
      timeoutMsg.from !== localRole &&
      lastTimeoutMessageId.current !== timeoutMsg.id
    ) {
      lastTimeoutMessageId.current = timeoutMsg.id;
      if (sellerConfirmTimeoutRef.current) {
        window.clearTimeout(sellerConfirmTimeoutRef.current);
        sellerConfirmTimeoutRef.current = null;
      }
      toast({
        title: "Trade closed",
        description:
          "Counterparty closed this trade automatically after waiting 5 minutes.",
        variant: "destructive",
      });
      try {
        localStorage.removeItem("expressPendingOrder");
      } catch {}
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setAwaitingApproval(false);
      setBuyerMarkedPaid(false);
      setTxDetected(false);
      setOrderCancelledByCounterparty(true);
      finalizedRef.current = true;
      navigate("/express");
      return;
    }

    const cancelMsg = reversed.find(
      (m) => String(m?.message) === "__ORDER_CANCELLED__",
    );
    if (
      cancelMsg &&
      cancelMsg.id &&
      cancelMsg.from !== localRole &&
      lastCancelledMessageId.current !== cancelMsg.id
    ) {
      lastCancelledMessageId.current = cancelMsg.id;
      if (sellerConfirmTimeoutRef.current) {
        window.clearTimeout(sellerConfirmTimeoutRef.current);
        sellerConfirmTimeoutRef.current = null;
      }
      setOrderCancelledByCounterparty(true);
      toast({
        title: "Order cancelled",
        description: "Counterparty cancelled this trade.",
        variant: "destructive",
      });
      try {
        localStorage.removeItem("expressPendingOrder");
      } catch {}
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setAwaitingApproval(false);
      setTxDetected(false);
      finalizedRef.current = true;
      navigate("/express");
      return;
    }

    const confirmMsg = reversed.find(
      (m) => String(m?.message) === "__CONFIRMED_SETTLEMENT__",
    );
    if (confirmMsg && confirmMsg.id) {
      if (confirmMsg.from === localRole) {
        setBuyerMarkedPaid(true);
      } else if (lastBuyerPaidMessageId.current !== confirmMsg.id) {
        lastBuyerPaidMessageId.current = confirmMsg.id;
        setBuyerMarkedPaid(true);
        toast({
          title: "Buyer marked payment",
          description: "Fiat payment has been marked as sent.",
        });
      }
    }

    const promptSellerMsg = reversed.find(
      (m) => String(m?.message) === "__PROMPT_SELLER_CONFIRM__",
    );
    if (
      promptSellerMsg &&
      promptSellerMsg.id &&
      promptSellerMsg.from !== localRole &&
      localRole === "seller" &&
      lastPromptSellerMessageId.current !== promptSellerMsg.id
    ) {
      lastPromptSellerMessageId.current = promptSellerMsg.id;
      toast({
        title: "Buyer reported payment",
        description: "Please verify the payment and confirm the trade.",
      });
    }

    const ackMsg = reversed.find(
      (m) => String(m?.message) === "__SELLER_RECEIVED_FIAT__",
    );
    if (ackMsg && ackMsg.id) {
      if (ackMsg.from === localRole) {
        setFiatAcknowledged(true);
      } else if (lastFiatAckMessageId.current !== ackMsg.id) {
        lastFiatAckMessageId.current = ackMsg.id;
        setFiatAcknowledged(true);
        toast({
          title: "Seller confirmed payment",
          description: "Counterparty confirmed receiving fiat.",
        });
      }
    }

    const sellerMsg = reversed.find(
      (m) => String(m?.message) === "__SELLER_CONFIRMED__",
    );
    if (sellerMsg && sellerMsg.id) {
      if (sellerMsg.from === localRole) {
        setSellerSentCrypto(true);
      } else {
        setSellerConfirmed(true);
        setSellerSentCrypto(true);
        if (localRole === "buyer") {
          toast({
            title: "Seller confirmed transaction",
            description: "Check your wallet balance and complete the order.",
          });
        }
      }
    }

    const sellerDetailsMsg = reversed.find(
      (m) =>
        typeof m?.message === "string" &&
        m.message.startsWith("__SELLER_PAYMENT_DETAILS__|"),
    );
    if (
      sellerDetailsMsg &&
      sellerDetailsMsg.id &&
      sellerDetailsMsg.from !== localRole &&
      lastSellerDetailsMessageId.current !== sellerDetailsMsg.id
    ) {
      lastSellerDetailsMessageId.current = sellerDetailsMsg.id;
      const raw = String(sellerDetailsMsg.message).split("|")[1] || "";
      const parsed = Object.fromEntries(
        raw
          .split(";")
          .map((s) => s.split("=").map((x) => x.trim()))
          .filter((parts) => parts.length === 2),
      ) as Record<string, string>;
      const detailRecord = {
        accountName: parsed.name || parsed.accountName || "",
        accountNumber: parsed.account || parsed.accountNumber || "",
        method: parsed.method || "",
      };
      setRemoteSellerDetails(detailRecord);
      if (localRole === "buyer") {
        const summary = [
          detailRecord.accountName ? `Name: ${detailRecord.accountName}` : null,
          detailRecord.accountNumber
            ? `Account: ${detailRecord.accountNumber}`
            : null,
          detailRecord.method ? `Method: ${detailRecord.method}` : null,
        ]
          .filter(Boolean)
          .join(" • ");
        toast({
          title: "Seller payment details",
          description: summary || "Seller shared payment instructions.",
        });
      }
    }

    const promptBuyerMsg = reversed.find(
      (m) => String(m?.message) === "__PROMPT_BUYER_COMPLETE__",
    );
    if (
      promptBuyerMsg &&
      promptBuyerMsg.id &&
      promptBuyerMsg.from !== localRole &&
      localRole === "buyer" &&
      lastPromptBuyerMessageId.current !== promptBuyerMsg.id
    ) {
      lastPromptBuyerMessageId.current = promptBuyerMsg.id;
      toast({
        title: "Seller confirmed",
        description: "Check your wallet and finish the order when ready.",
      });
    }

    const sellerApprovedMsg = reversed.find(
      (m) => String(m?.message) === "__SELLER_APPROVED__",
    );
    if (
      sellerApprovedMsg &&
      sellerApprovedMsg.id &&
      sellerApprovedMsg.from !== localRole &&
      lastSellerApprovedMessageId.current !== sellerApprovedMsg.id
    ) {
      lastSellerApprovedMessageId.current = sellerApprovedMsg.id;
      setSellerApproved(true);
      if (localRole === "buyer") {
        finalizeOrder("seller", {
          toastTitle: "Seller approved",
          toastDescription: "Check your wallet to confirm receipt.",
        });
      }
    }

    const buyerApprovedMsg = reversed.find(
      (m) => String(m?.message) === "__BUYER_APPROVED__",
    );
    if (
      buyerApprovedMsg &&
      buyerApprovedMsg.id &&
      buyerApprovedMsg.from !== localRole &&
      localRole === "seller"
    ) {
      finalizeOrder("buyer", { toastTitle: "Buyer approved" });
    }
  }, [messages, localRole, toast, finalizeOrder, navigate]);

  const withinLimits = useMemo(() => {
    const units = Number(params?.tokenUnits || 0);
    if (!match) return false;
    return (
      units >= Number(match.minToken || 0) &&
      units <= Number(match.maxToken || 0)
    );
  }, [match, params]);

  const sellerPaymentDetails = useMemo(() => {
    if (!match) return null;
    if (match.paymentDetails) {
      return {
        accountName: match.paymentDetails.accountName,
        accountNumber: match.paymentDetails.accountNumber,
        method: params?.paymentMethod || match.paymentMethod,
      };
    }
    if (isEasypaisa) {
      return {
        accountName: "Seller Easypaisa Account",
        accountNumber: "03107044833",
        method: params?.paymentMethod || match.paymentMethod || "easypaisa",
      };
    }
    return null;
  }, [match, params?.paymentMethod, isEasypaisa]);

  const displayedSellerPaymentDetails = useMemo(
    () => remoteSellerDetails ?? sellerPaymentDetails,
    [remoteSellerDetails, sellerPaymentDetails],
  );

  const sellerPaymentMethodLabel = useMemo(() => {
    const raw =
      displayedSellerPaymentDetails?.method ||
      params?.paymentMethod ||
      match?.paymentMethod ||
      "";
    if (!raw) return "";
    const value = String(raw);
    return value.charAt(0).toUpperCase() + value.slice(1);
  }, [
    displayedSellerPaymentDetails?.method,
    params?.paymentMethod,
    match?.paymentMethod,
  ]);

  // Proactively share buyer wallet address with counterparty via message
  useEffect(() => {
    if (!tradeId) return;
    if (localRole !== "buyer") return;
    if (!buyerPublicKey) return;
    if (buyerAddrSentRef.current === tradeId) return;
    (async () => {
      try {
        await fetch(`/api/p2p/trade/${encodeURIComponent(tradeId)}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `__BUYER_WALLET__|addr=${buyerPublicKey}`,
            from: localRole,
          }),
        });
        buyerAddrSentRef.current = tradeId;
      } catch {}
    })();
  }, [tradeId, localRole, buyerPublicKey]);

  // Address to trace for transaction detection
  const detectionAddress = useMemo(() => {
    if (localRole === "seller") {
      return counterpartyBuyerAddress || null;
    }
    return buyerPublicKey || null; // buyer's own wallet
  }, [localRole, counterpartyBuyerAddress, buyerPublicKey]);

  // Poll for transaction detection
  useEffect(() => {
    const shouldPoll =
      (localRole === "seller" && !!detectionAddress) ||
      (localRole === "buyer" && awaitingApproval && !!detectionAddress);

    if (!shouldPoll) return;

    let cancelled = false;

    const fetchLatestSig = async () => {
      try {
        const resp = await fetch("/api/solana-rpc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: Date.now(),
            method: "getSignaturesForAddress",
            params: [detectionAddress, { limit: 1 }],
          }),
        });
        const data = await resp.json();
        const arr = data?.result || [];
        const sig = arr?.[0]?.signature || null;
        if (!cancelled) setBaselineSig(sig);
      } catch {}
    };

    const poll = async () => {
      try {
        const resp = await fetch("/api/solana-rpc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: Date.now(),
            method: "getSignaturesForAddress",
            params: [detectionAddress, { limit: 1 }],
          }),
        });
        const data = await resp.json();
        const sig = data?.result?.[0]?.signature || null;
        if (baselineSig && sig && sig !== baselineSig) {
          setTxDetected(true);
          if (pollRef.current) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch {}
    };

    fetchLatestSig();
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollRef.current = window.setInterval(poll, 5000);

    return () => {
      cancelled = true;
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [awaitingApproval, localRole, detectionAddress, baselineSig]);

  const sendMessage = async () => {
    if (!tradeId) return;
    const text = message.trim();
    if (!text && !proofFile) return;
    try {
      setUploading(true);
      let body: any = { message: text || "", from: localRole };
      if (proofFile) {
        const base64: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(proofFile);
        });
        body.proof = { filename: proofFile.name, data: base64 };
      }
      const resp = await fetch(
        `/api/p2p/trade/${encodeURIComponent(tradeId)}/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!resp.ok) throw new Error("send failed");
      setMessage("");
      setProofFile(null);
      toast({ title: "Message sent" });
    } catch (e) {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleBuyerConfirm = async () => {
    if (!tradeId) return;
    try {
      const resp = await fetch(
        `/api/p2p/trade/${encodeURIComponent(tradeId)}/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "__BUYER_APPROVED__",
            from: "buyer",
          }),
        },
      );
      if (!resp.ok) throw new Error("failed");
      setAwaitingApproval(false);
      setTxDetected(false);
      try {
        localStorage.removeItem("expressPendingOrder");
      } catch {}
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      toast({ title: "Approved" });
      try {
        localStorage.setItem(
          "expressLastOrder",
          JSON.stringify({ tradeId, params, ts: Date.now() }),
        );
      } catch {}
      navigate("/express/order-complete", {
        state: { tradeId, params, ts: Date.now() },
      });
    } catch (e) {
      toast({ title: "Failed to approve", variant: "destructive" });
    }
  };

  return (
    <div className="flex min-h-screen w-screen flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleCancelOrder}
            aria-label="Cancel order"
            className="h-9 w-9 rounded-full text-destructive hover:bg-destructive/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto max-w-md px-4 py-6">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-wallet-purple-50 p-4">
            <div className="mb-3 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/express")}
                aria-label="Back"
                className="h-8 w-8 rounded-full border border-[hsl(var(--border))] bg-white/90 text-[hsl(var(--primary))] shadow-sm hover:bg-[hsl(var(--primary))]/10"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-semibold uppercase">
                Order Review
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Side</span>
                <span>{params?.side || "buy"}</span>
              </div>
              <div className="flex justify-between">
                <span>Token</span>
                <span>{params?.token || "USDC"}</span>
              </div>
              <div className="flex justify-between">
                <span>PKR</span>
                <span>{params?.pkrAmount?.toFixed?.(2) ?? "0.00"}</span>
              </div>
              <div className="flex justify-between">
                <span>Est. Units</span>
                <span>{params?.tokenUnits?.toFixed?.(4) ?? "0"}</span>
              </div>
              {params?.side === "sell" ? (
                <div className="flex items-center justify-between">
                  <span>Sell Instructions</span>
                  <span className="text-xs text-muted-foreground">
                    Will be shared after match
                  </span>
                </div>
              ) : (
                <div className="flex justify-between">
                  <span>Payment</span>
                  <span>{params?.paymentMethod || "bank"}</span>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-lg border bg-white p-3 text-sm">
              <div className="mb-1 font-medium">Matched Listing</div>
              {loading ? (
                <div>Loading posts…</div>
              ) : error ? (
                <div className="text-destructive">{error}</div>
              ) : match ? (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Post ID</span>
                    <span>{match.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Type</span>
                    <span>{match.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Limits</span>
                    <span>
                      {match.minToken} - {match.maxToken}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Availability</span>
                    <span>{match.availability || "online"}</span>
                  </div>
                  {!withinLimits && (
                    <div className="mt-2 rounded bg-yellow-50 p-2 text-xs text-yellow-800">
                      Order size is outside seller limits. Adjust amount on
                      previous page for a smoother match.
                    </div>
                  )}
                </div>
              ) : (
                <div>No matching listings found for your selection.</div>
              )}
            </div>

            {/* Settlement section (inline, persistent) */}
            <div className="mt-4 rounded-lg border bg-white p-3 text-sm">
              <div className="mb-2 font-medium">Settlement</div>

              {localRole === "buyer" ? (
                <div className="space-y-3">
                  <div>
                    <div className="font-medium">Seller Payment Details</div>
                    {displayedSellerPaymentDetails ? (
                      <div className="mt-1 space-y-1">
                        {displayedSellerPaymentDetails.accountName && (
                          <div>
                            <span className="font-semibold">Name: </span>
                            {displayedSellerPaymentDetails.accountName}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold">Account: </span>
                          {displayedSellerPaymentDetails.accountNumber || "—"}
                        </div>
                        <div>
                          <span className="font-semibold">Method: </span>
                          {sellerPaymentMethodLabel || "—"}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Seller payment details will appear once the seller
                        shares them.
                      </div>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground">
                      {
                        'Send the agreed fiat payment to the seller using the details above. Once you have sent payment, click "I\'ve Paid".'
                      }
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!awaitingApproval && (
                      <Button
                        onClick={async () => {
                          if (!effectiveTradeId) {
                            toast({
                              title: "Trade not ready",
                              description:
                                "Please wait for the trade to initialise.",
                              variant: "destructive",
                            });
                            return;
                          }
                          try {
                            await sendSystemMessage(
                              "__CONFIRMED_SETTLEMENT__",
                              localRole,
                            );
                            await sendSystemMessage(
                              "__PROMPT_SELLER_CONFIRM__",
                              localRole,
                            );
                            setAwaitingApproval(true);
                            setBuyerMarkedPaid(true);
                            try {
                              const raw = localStorage.getItem(
                                "expressPendingOrder",
                              );
                              const obj = raw ? JSON.parse(raw) : {};
                              obj.minimized = false;
                              obj.status = "awaiting_approval";
                              obj.params = params;
                              obj.tradeId = effectiveTradeId;
                              obj.ts = Date.now();
                              localStorage.setItem(
                                "expressPendingOrder",
                                JSON.stringify(obj),
                              );
                            } catch {}
                            toast({
                              title: "Marked as paid",
                              description:
                                "Seller notified. Waiting for confirmation.",
                            });
                          } catch (e) {
                            toast({
                              title: "Failed to notify",
                              variant: "destructive",
                            });
                          }
                        }}
                        className="h-9"
                      >
                        I've Paid
                      </Button>
                    )}

                    {txDetected && (
                      <Button
                        variant="outline"
                        onClick={handleBuyerConfirm}
                        className="h-9"
                      >
                        Confirm
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="font-medium">Buyer Wallet Address</div>
                    {counterpartyBuyerAddress ? (
                      <div className="mt-1 flex items-center gap-2 rounded-md border px-2 py-1">
                        <span className="font-mono text-xs break-all flex-1">
                          {counterpartyBuyerAddress}
                        </span>
                        <Button
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() =>
                            copyToClipboard(counterpartyBuyerAddress)
                          }
                        >
                          Copy
                        </Button>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Waiting for buyer address.
                      </div>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground">
                      Send the tokens to the buyer wallet address above. Once
                      the transaction is confirmed on-chain, the Confirm button
                      will appear.
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={!txDetected}
                      onClick={async () => {
                        if (!tradeId) return;
                        try {
                          const resp = await fetch(
                            `/api/p2p/trade/${encodeURIComponent(tradeId)}/message`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                message: "__SELLER_CONFIRMED__",
                                from: "seller",
                              }),
                            },
                          );
                          if (!resp.ok) throw new Error("failed");
                          setAwaitingApproval(true);
                          toast({ title: "You confirmed settlement" });
                        } catch (e) {
                          toast({
                            title: "Confirmation failed",
                            variant: "destructive",
                          });
                        }
                      }}
                      className="h-9"
                    >
                      Confirm
                    </Button>

                    {sellerConfirmed && (
                      <div className="text-xs text-muted-foreground">
                        Waiting for buyer approval…
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Waiting overlays */}
        {awaitingApproval && localRole === "seller" && (
          <div className="fixed inset-0 z-40 flex items-center justify-center">
            <div className="dashboard-loader-overlay">
              <div className="dashboard-loader" />
              <div className="text-sm">Waiting for buyer approval…</div>
            </div>
          </div>
        )}

        {awaitingApproval && localRole === "buyer" && (
          <div className="fixed inset-0 z-40 flex items-center justify-center">
            <div className="dashboard-loader-overlay">
              <div className="dashboard-loader" />
              <div className="flex flex-col items-center gap-2">
                <div className="text-sm">
                  {!txDetected
                    ? "Waiting for transaction…"
                    : "Transaction detected"}
                </div>
                {!isEasypaisa && (
                  <div className="mt-2 text-xs font-mono">
                    Buyer wallet: {buyerPublicKey || "(no wallet selected)"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Floating Chat Button */}
        <button
          type="button"
          onClick={() => setChatOpen((o) => !o)}
          aria-label="Open chat"
          className="fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-white shadow-xl hover:brightness-95"
        >
          {chatOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageSquare className="h-6 w-6" />
          )}
        </button>

        {chatOpen && (
          <div className="fixed bottom-24 right-6 z-50 w-80 rounded-xl border border-[hsl(var(--border))] bg-white p-3 shadow-2xl">
            <div className="mb-2 text-sm font-semibold">Trade Chat</div>
            <div className="max-h-64 overflow-auto rounded-md border bg-white p-2 text-xs">
              {messages.length === 0 ? (
                <div className="text-muted-foreground">No messages yet.</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="mb-1">
                    <span className="font-medium">{m.from}:</span> {m.message}
                    {m.proof?.filename && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Attachment: {m.proof.filename}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="mt-2 flex gap-2 items-center">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                className="block rounded-md border border-[hsl(var(--input))] bg-white px-2 py-1 text-sm w-32"
              />
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message…"
                className="flex-1 rounded-md border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm outline-none"
              />
              <Button
                onClick={sendMessage}
                disabled={!tradeId || (!message.trim() && !proofFile)}
                className="h-10 px-3"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {proofFile && (
              <div className="mt-2 text-xs text-muted-foreground">
                Selected: {proofFile.name}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
