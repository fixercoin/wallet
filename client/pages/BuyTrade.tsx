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
  const { state } = useLocation() as { state?: { order?: any; room?: { id: string; buyer_wallet?: string; seller_wallet?: string } } };
  const order = state?.order || null;
  const room = state?.room as any;
  const openChat: boolean = !!(state && state.openChat);
  const initialPhaseFromNav: string | undefined = state?.initialPhase;
  const { toast } = useToast();
  const { wallet, balance } = useWallet();
  const roomId = room?.id || (order && order.id) || "global";
  const { events, send } = useDurableRoom(roomId, API_BASE);
  const counterpartyWallet = useMemo(() => {
    if (!room) return "";
    return wallet?.publicKey === (room.seller_wallet || "")
      ? room.buyer_wallet || ""
      : room.seller_wallet || "";
  }, [room, wallet?.publicKey]);

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

  const [hasReceived, setHasReceived] = useState(false);
  const [sendAmount, setSendAmount] = useState("");
  const [toWallet, setToWallet] = useState("");
  const [readyToConfirmSend, setReadyToConfirmSend] = useState(false);

  const handleReceived = () => {
    send?.({
      type: "chat",
      text: JSON.stringify({ type: "seller_verified", orderId: order?.id || roomId }),
    });
    toast({ title: "Payment received" });
    setHasReceived(true);
    setPhase("seller_verified");
  };

  const handleSendTransaction = () => {
    // Here you could trigger an actual blockchain transfer if desired
    setReadyToConfirmSend(true);
    toast({ title: "Transaction prepared" });
  };

  const handleSentAsset = () => {
    send?.({
      type: "chat",
      text: JSON.stringify({ type: "seller_transferred", orderId: order?.id || roomId }),
    });
    toast({ title: "Assets sent" });
    setPhase("seller_transferred");
  };

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
          {isSeller ? (
            <div className="space-y-4">
              {counterpartyWallet ? (
                <div className="p-3 rounded-xl border bg-white flex items-center justify-between">
                  <div className="text-xs text-gray-500">Buyer wallet</div>
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
                  <div className="p-4 rounded-xl border bg-white">
                    <div className="text-sm font-medium mb-2">Wallet balance</div>
                    <div className="font-semibold">{balance.toFixed(6)} SOL</div>
                  </div>
                  <div className="grid gap-3">
                    <input
                      className="border rounded-lg px-3 py-2"
                      placeholder="Amount"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                    />
                    <input
                      className="border rounded-lg px-3 py-2"
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
            </div>
          ) : (
            <div className="text-center text-sm text-gray-600">
              Waiting for seller actions…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
