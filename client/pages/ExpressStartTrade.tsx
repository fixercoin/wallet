import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Copy, MessageSquare, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/lib/wallet";

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

  const [baselineSig, setBaselineSig] = useState<string | null>(null);
  const [txDetected, setTxDetected] = useState(false);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [fiatConfirmationSent, setFiatConfirmationSent] = useState(false);

  const pollRef = useRef<number | null>(null);
  const easypayPollRef = useRef<number | null>(null);
  const orderStartRef = useRef<number>(Date.now());
  const [fiatDetected, setFiatDetected] = useState(false);
  const [manualPaid, setManualPaid] = useState(false);
  const [autoConfirmed, setAutoConfirmed] = useState(false);

  const { wallet } = useWallet();
  const buyerPublicKey = wallet?.publicKey || null;
  const localRole = params?.side === "sell" ? "seller" : "buyer";
  const isEasypaisa = useMemo(
    () => String(params?.paymentMethod || "").toLowerCase() === "easypaisa",
    [params?.paymentMethod],
  );

  // Counterparty-provided buyer address (via trade message fallback)
  const [counterpartyBuyerAddress, setCounterpartyBuyerAddress] = useState<string | null>(null);
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
    setFiatDetected(false);
    setFiatConfirmationSent(false);
    setAwaitingApproval(false);
    setManualPaid(false);
    setAutoConfirmed(false);
  }, [tradeId]);

  // Notify when counterparty confirms settlement via special message
  const lastConfirmedMessageId = useRef<string | null>(null);
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const reversed = messages.slice().reverse();

    // Parse buyer wallet address if provided via message
    const buyerAddrMsg = reversed.find((m) =>
      typeof m?.message === "string" && m.message.startsWith("__BUYER_WALLET__|"),
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

    const confirmMsg = reversed.find(
      (m) => String(m?.message) === "__CONFIRMED_SETTLEMENT__",
    );
    if (confirmMsg && confirmMsg.id && confirmMsg.from !== localRole) {
      if (lastConfirmedMessageId.current !== confirmMsg.id) {
        toast({
          title: "Order update",
          description: "Counterparty confirmed settlement",
        });
        lastConfirmedMessageId.current = confirmMsg.id;
      }
    }

    const sellerMsg = reversed.find(
      (m) => String(m?.message) === "__SELLER_CONFIRMED__",
    );
    if (sellerMsg && sellerMsg.from !== localRole) {
      setSellerConfirmed(true);
    }

    const approvedMsg = reversed.find(
      (m) => String(m?.message) === "__BUYER_APPROVED__",
    );
    if (approvedMsg && approvedMsg.from !== localRole) {
      if (localRole === "seller") {
        setAwaitingApproval(false);
        toast({ title: "Buyer approved" });
        try {
          localStorage.removeItem("expressPendingOrder");
        } catch {}
        try {
          localStorage.setItem(
            "expressLastOrder",
            JSON.stringify({ tradeId, params, ts: Date.now() }),
          );
        } catch {}
        navigate("/express/order-complete", {
          state: { tradeId, params, ts: Date.now() },
        });
      }
    }
  }, [messages, localRole, toast]);

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

  const sellerPaymentMethodLabel = useMemo(() => {
    const raw =
      sellerPaymentDetails?.method ||
      params?.paymentMethod ||
      match?.paymentMethod ||
      "";
    if (!raw) return "";
    const value = String(raw);
    return value.charAt(0).toUpperCase() + value.slice(1);
  }, [
    sellerPaymentDetails?.method,
    params?.paymentMethod,
    match?.paymentMethod,
  ]);

  // Easypaisa auto-detect polling (buy/sell payment method)
  useEffect(() => {
    if (!isEasypaisa) return;

    const msisdn = (window as any)?.EASYPAY_MSISDN || "03107044833";
    const since = orderStartRef.current - 10 * 60 * 1000;

    const tick = async () => {
      try {
        const resp = await fetch(
          `/api/easypaisa/payments?msisdn=${encodeURIComponent(msisdn)}&since=${since}`,
        );
        if (!resp.ok) return;
        const data = await resp.json();
        const arr = Array.isArray(data?.payments) ? data.payments : [];
        const expected = Number(params?.pkrAmount || 0);
        if (!expected) return;
        const tol = Math.max(1, expected * 0.01);
        const hit = arr.find(
          (p: any) => Math.abs(Number(p.amount) - expected) <= tol,
        );
        if (hit) {
          if (!fiatDetected) setFiatDetected(true);
          if (localRole === "buyer") {
            if (!fiatConfirmationSent && tradeId) {
              try {
                await fetch(
                  `/api/p2p/trade/${encodeURIComponent(tradeId)}/message`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      message: "__CONFIRMED_SETTLEMENT__",
                      from: localRole,
                    }),
                  },
                );
                setFiatConfirmationSent(true);
              } catch {}
            }
            if (!awaitingApproval) {
              setAwaitingApproval(true);
              try {
                const raw = localStorage.getItem("expressPendingOrder");
                const obj = raw ? JSON.parse(raw) : {};
                obj.minimized = false;
                obj.status = "awaiting_approval";
                obj.params = params;
                obj.tradeId = tradeId;
                obj.ts = Date.now();
                localStorage.setItem(
                  "expressPendingOrder",
                  JSON.stringify(obj),
                );
              } catch {}
            }
          }
        }
      } catch {}
    };

    tick();
    if (easypayPollRef.current) {
      clearInterval(easypayPollRef.current);
      easypayPollRef.current = null;
    }
    easypayPollRef.current = window.setInterval(tick, 5000);

    return () => {
      if (easypayPollRef.current) {
        clearInterval(easypayPollRef.current);
        easypayPollRef.current = null;
      }
    };
  }, [
    isEasypaisa,
    params?.pkrAmount,
    localRole,
    awaitingApproval,
    tradeId,
    fiatConfirmationSent,
    params,
    fiatDetected,
  ]);

  // Address to trace for transaction detection
  const detectionAddress = useMemo(() => {
    if (localRole === "seller") {
      return match?.walletAddress || null; // buyer address from BUY post
    }
    return buyerPublicKey || null; // buyer's own wallet
  }, [localRole, match?.walletAddress, buyerPublicKey]);

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
      if (localRole === "buyer" && isEasypaisa && !fiatConfirmationSent) {
        try {
          await fetch(`/api/p2p/trade/${encodeURIComponent(tradeId)}/message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: "__CONFIRMED_SETTLEMENT__",
              from: localRole,
            }),
          });
          setFiatConfirmationSent(true);
        } catch {}
      }

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
      if (isEasypaisa) {
        setFiatDetected(false);
      }
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

  useEffect(() => {
    if (
      isEasypaisa &&
      localRole === "buyer" &&
      fiatDetected &&
      !autoConfirmed
    ) {
      setAutoConfirmed(true);
      handleBuyerConfirm();
    }
  }, [isEasypaisa, localRole, fiatDetected, autoConfirmed]);

  return (
    <div className="flex min-h-screen w-screen flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2"></div>
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
                    {sellerPaymentDetails ? (
                      <div className="mt-1 space-y-1">
                        {sellerPaymentDetails.accountName && (
                          <div>
                            <span className="font-semibold">Name: </span>
                            {sellerPaymentDetails.accountName}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold">Account: </span>
                          {sellerPaymentDetails.accountNumber}
                        </div>
                        <div>
                          <span className="font-semibold">Method: </span>
                          {sellerPaymentMethodLabel || "—"}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Seller payment details will be provided by the seller.
                      </div>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground">
                      {isEasypaisa
                        ? "Send the fiat payment to the seller via Easypaisa. The transfer is monitored automatically."
                        : 'Send the agreed fiat payment to the seller using the details above. Once you have sent payment, click "I\'ve Paid".'}
                    </div>
                  </div>

                  {isEasypaisa ? (
                    <div className="space-y-2">
                      <div
                        className={`rounded px-3 py-2 text-xs ${
                          fiatDetected
                            ? "border border-green-200 bg-green-50 text-green-700"
                            : "border border-yellow-200 bg-yellow-50 text-yellow-800"
                        }`}
                      >
                        {fiatDetected
                          ? "Easypaisa payment detected for seller account 03107044833."
                          : awaitingApproval
                            ? !txDetected
                              ? "Waiting for transaction to your wallet…"
                              : "Transaction detected. You can confirm now."
                            : "Waiting for Easypaisa confirmation for seller account 03107044833…"}
                      </div>
                      <div className="flex gap-2">
                        {(fiatDetected || txDetected || manualPaid) && (
                          <Button onClick={handleBuyerConfirm} className="h-9">
                            Confirm
                          </Button>
                        )}
                        {!fiatDetected && !awaitingApproval && (
                          <Button
                            variant="outline"
                            onClick={async () => {
                              if (!tradeId) return;
                              setManualPaid(true);
                              try {
                                const resp = await fetch(
                                  `/api/p2p/trade/${encodeURIComponent(tradeId)}/message`,
                                  {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      message: "__CONFIRMED_SETTLEMENT__",
                                      from: localRole,
                                    }),
                                  },
                                );
                                if (resp.ok) {
                                  setAwaitingApproval(true);
                                  const raw = localStorage.getItem(
                                    "expressPendingOrder",
                                  );
                                  const obj = raw ? JSON.parse(raw) : {};
                                  obj.minimized = false;
                                  obj.status = "awaiting_approval";
                                  obj.params = params;
                                  obj.tradeId = tradeId;
                                  obj.ts = Date.now();
                                  localStorage.setItem(
                                    "expressPendingOrder",
                                    JSON.stringify(obj),
                                  );
                                  toast({
                                    title:
                                      "Marked as paid. Waiting for seller.",
                                  });
                                }
                              } catch {}
                            }}
                            className="h-9"
                          >
                            I've Paid
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {!awaitingApproval && (
                        <Button
                          onClick={async () => {
                            if (!tradeId) return;
                            try {
                              const resp = await fetch(
                                `/api/p2p/trade/${encodeURIComponent(tradeId)}/message`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    message: "__CONFIRMED_SETTLEMENT__",
                                    from: localRole,
                                  }),
                                },
                              );
                              if (!resp.ok) throw new Error("failed");
                              setAwaitingApproval(true);
                              try {
                                const raw = localStorage.getItem(
                                  "expressPendingOrder",
                                );
                                const obj = raw ? JSON.parse(raw) : {};
                                obj.minimized = false;
                                obj.status = "awaiting_approval";
                                obj.params = params;
                                obj.tradeId = tradeId;
                                obj.ts = Date.now();
                                localStorage.setItem(
                                  "expressPendingOrder",
                                  JSON.stringify(obj),
                                );
                              } catch {}
                              toast({
                                title:
                                  "Marked as paid. Waiting for transaction.",
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
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="font-medium">Buyer Wallet Address</div>
                    {match?.walletAddress ? (
                      <div className="mt-1 flex items-center gap-2 rounded-md border px-2 py-1">
                        <span className="font-mono text-xs break-all flex-1">
                          {match.walletAddress}
                        </span>
                        <Button
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => copyToClipboard(match.walletAddress)}
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
                {isEasypaisa ? (
                  <div className="text-sm">
                    {fiatDetected
                      ? "Easypaisa payment confirmed."
                      : !txDetected
                        ? "Waiting for transaction…"
                        : "Transaction detected"}
                  </div>
                ) : (
                  <div className="text-sm">
                    {!txDetected
                      ? "Waiting for transaction…"
                      : "Transaction detected"}
                  </div>
                )}
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
