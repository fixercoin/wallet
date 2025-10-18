import React, { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDurableRoom } from "@/hooks/useDurableRoom";
import { API_BASE, ADMIN_WALLET } from "@/lib/p2p";
import { useWallet } from "@/contexts/WalletContext";
import { copyToClipboard, shortenAddress } from "@/lib/wallet";

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
    | "failed";

  const [phase, setPhase] = useState<Phase>("entry");
  const [unread, setUnread] = useState(false);
  const [sellerInfo, setSellerInfo] = useState<{
    accountName: string;
    accountNumber: string;
    paymentMethod?: string;
  } | null>(null);
  const [failMsg, setFailMsg] = useState<string>("");

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
    if (!canConfirm) return;
    send?.({
      type: "chat",
      text: JSON.stringify({
        type: "buyer_confirm",
        amountPKR: Number(amountPKR),
        token,
      }),
    });
    toast({
      title: "Trade request sent",
      description: `Request to buy ~${estimatedTokens.toFixed(6)} ${token}`,
    });
    setPhase("awaiting_seller_approval");
  };

  const notifySeller = () => {
    send?.({ type: "chat", text: JSON.stringify({ type: "buyer_notify" }) });
    toast({ title: "Seller notified" });
    setPhase((p) => (p === "seller_approved" ? "awaiting_seller_verified" : p));
  };

  useEffect(() => {
    // If navigated here with openChat flag, set phase accordingly
    if (openChat) {
      if (initialPhaseFromNav && typeof initialPhaseFromNav === "string") {
        // ensure phase is one of allowed values
        setPhase(initialPhaseFromNav as Phase);
      }
      setUnread(true);
    }

    const last = events[events.length - 1];
    if (!last || last.kind !== "chat") return;
    const txt = last.data?.text || "";
    let payload: any = null;
    try {
      payload = JSON.parse(txt);
    } catch {
      if (txt.startsWith("seller:")) payload = { type: txt.slice(7) };
    }
    if (!payload?.type) return;

    setUnread(true);

    if (payload.type === "seller_approved") {
      setSellerInfo({
        accountName: String(payload.accountName || ""),
        accountNumber: String(payload.accountNumber || ""),
        paymentMethod: String(
          payload.paymentMethod || order?.paymentMethod || "",
        ),
      });
      setPhase("seller_approved");
      toast({
        title: "Seller approved",
        description: "Payment details received",
      });
    } else if (payload.type === "seller_verified") {
      setPhase("seller_verified");
      toast({
        title: "Seller verified payment",
        description: "Proceed to transfer",
      });
    } else if (payload.type === "seller_transferred") {
      setPhase("seller_transferred");
      toast({
        title: "Transfer complete",
        description: "Check assets in wallet",
      });
      try {
        const completedRaw = localStorage.getItem("orders_completed");
        const completed = completedRaw ? JSON.parse(completedRaw) : [];
        const orderToSave = order ? { ...order, status: "completed", completedAt: Date.now() } : null;
        if (orderToSave) {
          completed.unshift(orderToSave);
          localStorage.setItem("orders_completed", JSON.stringify(completed));
        }
        const pendingRaw = localStorage.getItem("orders_pending");
        const pending = pendingRaw ? JSON.parse(pendingRaw) : [];
        const filtered = Array.isArray(pending) && order?.id ? pending.filter((o: any) => o.id !== order.id) : pending;
        localStorage.setItem("orders_pending", JSON.stringify(filtered));
      } catch {}
      setTimeout(() => navigate("/", { state: { goP2P: true } }), 1200);
    } else if (payload.type === "order_failed") {
      setFailMsg(String(payload.reason || "Order could not complete"));
      setPhase("failed");
    }
  }, [events]);

  const clearUnread = () => setUnread(false);

  // Seller controls (visible if admin wallet)
  const isSeller = wallet?.publicKey === ADMIN_WALLET;
  const [sellerAccountName, setSellerAccountName] = useState("");
  const [sellerAccountNumber, setSellerAccountNumber] = useState("");

  const sellerApprove = () => {
    send?.({
      type: "chat",
      text: JSON.stringify({
        type: "seller_approved",
        accountName: sellerAccountName,
        accountNumber: sellerAccountNumber,
        paymentMethod: order?.paymentMethod || "easypaisa",
      }),
    });
  };
  const sellerVerified = () =>
    send?.({ type: "chat", text: JSON.stringify({ type: "seller_verified" }) });
  const sellerTransferred = () =>
    send?.({
      type: "chat",
      text: JSON.stringify({ type: "seller_transferred" }),
    });
  const sellerFail = () =>
    send?.({
      type: "chat",
      text: JSON.stringify({
        type: "order_failed",
        reason: "Seller cancelled",
      }),
    });

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10 border-b border-white/60">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/", { state: { goP2P: true } })}
            className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-transparent text-[hsl(var(--foreground))] focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent"
            aria-label="Back to Express P2P"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1 text-center font-medium">Buy Trade</div>

          <Button
            variant="ghost"
            size="icon"
            onClick={clearUnread}
            className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-transparent text-[hsl(var(--foreground))] relative"
            aria-label="Incoming messages from seller"
          >
            <MessageSquare className="h-5 w-5" />
            {unread && (
              <span className="absolute -top-0.5 -right-0.5 inline-block w-2.5 h-2.5 bg-red-500 rounded-full" />
            )}
          </Button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <div className="wallet-card rounded-2xl p-6 space-y-5">
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
