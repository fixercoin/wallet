import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Copy, MessageSquare, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { shortenAddress, copyToClipboard } from "@/lib/wallet";
import { ADMIN_WALLET } from "@/lib/p2p";

interface NavState {
  side?: "buy" | "sell";
  pkrAmount?: number;
  token?: "USDC" | "SOL" | "FIXERCOIN" | string;
  tokenUnits?: number; // computed estimate from previous page
  paymentMethod?: "bank" | "easypaisa" | "firstpay" | string;
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
  const [showConfirm, setShowConfirm] = useState(false);
  const [baselineSig, setBaselineSig] = useState<string | null>(null);
  const [txDetected, setTxDetected] = useState(false);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const pollRef = useRef<number | null>(null);

  // Load posts to match an order against seller listings
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

  // Choose a matching post (for buy, need a seller post)
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
    // Prefer a post whose limits include desired units
    const within = candidates.find(
      (p: any) =>
        desiredUnits >= Number(p?.minToken || 0) &&
        desiredUnits <= Number(p?.maxToken || 0),
    );
    if (within) return within;
    // Otherwise, best-effort: pick closest by minToken not exceeding desired, else smallest max
    const eligible = candidates
      .slice()
      .sort((a: any, b: any) => Number(a.minToken) - Number(b.minToken));
    return eligible[0] || null;
  }, [posts, params]);

  // Create a synthetic tradeId for messaging scope
  useEffect(() => {
    const base = match?.id || "no-post";
    setTradeId(`${base}-${Date.now()}`);
  }, [match]);

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

  // Notify when counterparty confirms settlement via special message
  const localRole = params?.side === "sell" ? "seller" : "buyer";
  const lastConfirmedMessageId = useRef<string | null>(null);
  const [sellerConfirmed, setSellerConfirmed] = useState(false);
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const reversed = messages.slice().reverse();

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
        navigate("/express");
      }
    }
  }, [messages, localRole, toast, navigate]);

  const withinLimits = useMemo(() => {
    const units = Number(params?.tokenUnits || 0);
    if (!match) return false;
    return (
      units >= Number(match.minToken || 0) &&
      units <= Number(match.maxToken || 0)
    );
  }, [match, params]);

  // Send a message; if a file is attached, include it in the message payload
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

  // Poll for transaction detection when seller opens confirm modal
  useEffect(() => {
    if (!showConfirm || localRole !== "seller" || !match?.walletAddress) return;

    let cancelled = false;

    const fetchLatestSig = async () => {
      try {
        const resp = await fetch("/api/solana-rpc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: Date.now(),
            method: "getSignaturesForAddress",
            params: [match.walletAddress, { limit: 1 }],
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
            params: [match.walletAddress, { limit: 1 }],
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
  }, [showConfirm, localRole, match?.walletAddress, baselineSig]);

  return (
    <div className="flex min-h-screen w-screen flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2"></div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto max-w-md px-4 py-6">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-slate-50 p-4">
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

            <div className="mt-4">
              <div className="mt-4">
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => setShowConfirm(true)} className="h-10">
                    Confirm Settlement
                  </Button>

                  {localRole === "buyer" && sellerConfirmed && (
                    <Button
                      variant="outline"
                      className="h-10"
                      onClick={async () => {
                        if (!tradeId) return;
                        try {
                          const resp = await fetch(
                            `/api/p2p/trade/${encodeURIComponent(tradeId)}/message`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                message: "__BUYER_APPROVED__",
                                from: localRole,
                              }),
                            },
                          );
                          if (!resp.ok) throw new Error("failed");
                          toast({ title: "Approved" });
                          navigate("/express");
                        } catch (e) {
                          toast({
                            title: "Failed to approve",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      Approve
                    </Button>
                  )}

                  {/* Confirmation modal */}
                  {showConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-lg">
                        <div className="mb-3 text-lg font-semibold">
                          Confirm Settlement
                        </div>
                        {localRole === "seller" && match?.walletAddress ? (
                          <div className="mb-3 text-sm">
                            <div className="mb-1 font-medium">
                              Buyer Wallet Address
                            </div>
                            <div className="flex items-center gap-2 rounded-md border px-2 py-1">
                              <span className="font-mono text-xs break-all flex-1">
                                {match.walletAddress}
                              </span>
                              <Button
                                variant="outline"
                                className="h-7 px-2"
                                onClick={() =>
                                  copyToClipboard(match.walletAddress)
                                }
                              >
                                Copy
                              </Button>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              Send transaction to this address, then confirm.
                            </div>
                          </div>
                        ) : null}
                        <div className="mb-4 text-sm">
                          {localRole === "seller" ? (
                            <span>
                              We will detect the transaction on the wallet
                              address. Once detected, the Confirm button will be
                              enabled.
                            </span>
                          ) : (
                            <span>
                              Confirming will notify the counterparty.
                            </span>
                          )}
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowConfirm(false);
                              setBaselineSig(null);
                              setTxDetected(false);
                              if (pollRef.current) {
                                window.clearInterval(pollRef.current);
                                pollRef.current = null;
                              }
                            }}
                            className="h-9"
                          >
                            Cancel
                          </Button>
                          <Button
                            disabled={localRole === "seller" && !txDetected}
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
                                      message:
                                        localRole === "seller"
                                          ? "__SELLER_CONFIRMED__"
                                          : "__CONFIRMED_SETTLEMENT__",
                                      from: localRole,
                                    }),
                                  },
                                );
                                if (!resp.ok) throw new Error("failed");
                                setShowConfirm(false);
                                if (localRole === "seller")
                                  setAwaitingApproval(true);
                                toast({ title: "You confirmed settlement" });
                              } catch (e) {
                                setShowConfirm(false);
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
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
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

        {awaitingApproval && localRole === "seller" && (
          <div className="fixed inset-0 z-40 flex items-center justify-center">
            <div className="dashboard-loader-overlay">
              <div className="dashboard-loader" />
              <div className="text-sm">Waiting for buyer approval…</div>
            </div>
          </div>
        )}

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
