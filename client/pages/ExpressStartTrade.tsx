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
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const confirmMsg = messages
      .slice()
      .reverse()
      .find((m) => String(m?.message) === "__CONFIRMED_SETTLEMENT__");
    if (confirmMsg && confirmMsg.id && confirmMsg.from !== localRole) {
      if (lastConfirmedMessageId.current !== confirmMsg.id) {
        toast({
          title: "Order update",
          description: "Counterparty confirmed settlement",
        });
        lastConfirmedMessageId.current = confirmMsg.id;
      }
    }
  }, [messages, localRole, toast]);

  const handleSend = async () => {
    if (!tradeId) return;
    const text = message.trim();
    if (!text) return;
    try {
      const resp = await fetch(
        `/api/p2p/trade/${encodeURIComponent(tradeId)}/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, from: localRole }),
        },
      );
      if (!resp.ok) throw new Error("send failed");
      setMessage("");
      toast({ title: "Message sent" });
    } catch (e) {
      toast({ title: "Failed to send message", variant: "destructive" });
    }
  };

  const withinLimits = useMemo(() => {
    const units = Number(params?.tokenUnits || 0);
    if (!match) return false;
    return (
      units >= Number(match.minToken || 0) &&
      units <= Number(match.maxToken || 0)
    );
  }, [match, params]);

  const handleUploadProof = async () => {
    if (!tradeId || !proofFile) return;
    try {
      setUploading(true);
      // Read file as base64
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(proofFile);
      });
      const resp = await fetch(
        `/api/p2p/trade/${encodeURIComponent(tradeId)}/proof`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proof: { filename: proofFile.name, data: base64 },
          }),
        },
      );
      if (!resp.ok) throw new Error("upload failed");
      setProofFile(null);
      toast({ title: "Proof uploaded" });
    } catch (e) {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-screen flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="h-9 w-9 rounded-full border border-[hsl(var(--border))] bg-white/90 text-[hsl(var(--primary))] shadow-sm hover:bg-[hsl(var(--primary))]/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto max-w-md px-4 py-6">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-card p-4">
            <h2 className="mb-2 text-base font-semibold">Order Review</h2>
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
                  {match?.paymentDetails?.accountName && (
                    <div className="flex justify-between">
                      <span>Account Name</span>
                      <span>{match.paymentDetails.accountName}</span>
                    </div>
                  )}
                  {match?.paymentDetails?.accountNumber && (
                    <div className="flex justify-between">
                      <span>Account Number</span>
                      <span>{match.paymentDetails.accountNumber}</span>
                    </div>
                  )}
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
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Upload payment proof (image)
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="block w-full rounded-md border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm"
                  />
                  <Button
                    onClick={handleUploadProof}
                    disabled={!tradeId || !proofFile || uploading}
                    className="h-10 px-3"
                  >
                    {uploading ? "Uploading…" : "Upload"}
                  </Button>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    onClick={() => setShowConfirm(true)}
                    className="h-10"
                  >
                    Confirm Settlement
                  </Button>

                  {/* Confirmation modal */}
                  {showConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-lg">
                        <div className="mb-3 text-lg font-semibold">Confirm Settlement</div>
                        <div className="mb-4 text-sm">Are you sure you want to confirm settlement for this order? This will notify the counterparty.</div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowConfirm(false)} className="h-9">Cancel</Button>
                          <Button
                            onClick={async () => {
                              if (!tradeId) return;
                              try {
                                const resp = await fetch(
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
                                if (!resp.ok) throw new Error("failed");
                                setShowConfirm(false);
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

                  <Button
                    variant="outline"
                    onClick={() => navigate(-1)}
                    className="h-10"
                  >
                    Back
                  </Button>
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
          {chatOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
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
                  </div>
                ))
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message…"
                className="w-full rounded-md border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm outline-none"
              />
              <Button
                onClick={handleSend}
                disabled={!tradeId || !message.trim()}
                className="h-10 px-3"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
