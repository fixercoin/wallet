import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BuyTrade() {
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: { order?: any } };
  const order = state?.order || null;
  const { toast } = useToast();

  const [amountPKR, setAmountPKR] = useState<number | "">("");
  const [token, setToken] = useState<string>(
    String(order?.quoteAsset || order?.token || "USDC").toUpperCase(),
  );

  const pricePKR: number | null = useMemo(() => {
    const price = Number(order?.pricePKRPerQuote);
    if (!isFinite(price) || price <= 0) return null;
    // Only trust price if token matches this order's quote asset
    const matches = String(token).toUpperCase() ===
      String(order?.quoteAsset || order?.token || "").toUpperCase();
    return matches ? price : null;
  }, [order, token]);

  const estimatedTokens = useMemo(() => {
    if (!pricePKR || !amountPKR || Number(amountPKR) <= 0) return 0;
    return Number(amountPKR) / pricePKR;
  }, [amountPKR, pricePKR]);

  const canConfirm = Boolean(order) && Boolean(pricePKR) && Number(estimatedTokens) > 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    toast({ title: "Trade request sent", description: `Request to buy ~${estimatedTokens.toFixed(6)} ${token}` });
    navigate(-1);
  };

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
            className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-transparent text-[hsl(var(--foreground))] relative"
            aria-label="Incoming messages from seller"
          >
            <MessageSquare className="h-5 w-5" />
            <span className="absolute -top-0.5 -right-0.5 inline-block w-2.5 h-2.5 bg-red-500 rounded-full" />
          </Button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <div className="wallet-card rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-xs text-gray-500 mb-1">PKR Amount</label>
            <input
              type="number"
              min={0}
              value={amountPKR}
              onChange={(e) => setAmountPKR(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full border rounded-xl px-3 py-2 bg-white"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Select Token</label>
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
              <div className="font-semibold mt-1">{pricePKR ?? "��"}</div>
            </div>
            <div className="p-3 rounded-lg border bg-white">
              <div className="text-xs text-gray-500">Estimated tokens</div>
              <div className="font-semibold mt-1">{estimatedTokens ? estimatedTokens.toFixed(6) : "0"}</div>
            </div>
          </div>

          <Button
            className="w-full wallet-button-primary"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
