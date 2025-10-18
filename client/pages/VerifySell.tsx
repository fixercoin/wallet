import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDurableRoom } from "@/hooks/useDurableRoom";
import { API_BASE } from "@/lib/p2p";

const STORAGE_KEY = "sell_pending_verification";

export default function VerifySell() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { send } = useDurableRoom("global", API_BASE);

  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<any | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setOrder(JSON.parse(raw));
    } catch {}
  }, []);

  const handleVerified = async () => {
    if (!order) return;
    setLoading(true);
    try {
      send?.({ type: "chat", text: JSON.stringify({ type: "seller_verified", orderId: order.id }) });
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      navigate("/express/buy-trade", {
        state: {
          order: {
            id: order.id,
            type: "sell",
            token: order.token,
            amountPKR: order.amountPKR,
            pricePKRPerQuote: order.pricePKRPerQuote,
            quoteAsset: order.token,
            paymentMethod: order.paymentMethod,
          },
          openChat: true,
          initialPhase: "seller_verified",
        },
      });
    } catch (error: any) {
      toast({ title: "Failed to notify", description: error?.message || String(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => navigate("/");

  if (!order) {
    return (
      <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden text-[10px]" style={{ fontSize: "10px" }}>
        <div className="bg-gradient-to-r from-[#1a2847]/95 to-[#16223a]/95 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 py-3 flex items-center">
            <button onClick={goBack} className="p-2 hover:bg-[#1a2540]/50 rounded-lg transition-colors" aria-label="Back">
              <ArrowLeft className="w-5 h-5 text-[#FF7A5C]" />
            </button>
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 py-10">
          <Card className="bg-transparent backdrop-blur-xl rounded-md">
            <CardContent className="pt-10 pb-10 text-center">
              <div className="text-white/80">No pending verification found.</div>
              <Button onClick={goBack} className="mt-4 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white">Go back</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden text-[10px]" style={{ fontSize: "10px" }}>
      <div className="bg-gradient-to-r from-[#1a2847]/95 to-[#16223a]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center">
          <button onClick={goBack} className="p-2 hover:bg-[#1a2540]/50 rounded-lg transition-colors" aria-label="Back">
            <ArrowLeft className="w-5 h-5 text-[#FF7A5C]" />
          </button>
          <div className="flex-1 text-center font-semibold">Verify Seller Transfer</div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 relative z-20">
        <Card className="bg-transparent backdrop-blur-xl rounded-md">
          <CardContent className="space-y-6 pt-6">
            <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white space-y-2">
              <div className="flex items-center justify-between text-sm"><span className="opacity-80">Order Number</span><span className="font-semibold">{order.id}</span></div>
              <div className="flex items-center justify-between text-sm"><span className="opacity-80">Token</span><span className="font-semibold">{order.token}</span></div>
              <div className="flex items-center justify-between text-sm"><span className="opacity-80">Amount Tokens</span><span className="font-semibold">{Number(order.amountTokens || 0).toFixed(6)} {order.token}</span></div>
              <div className="flex items-center justify-between text-sm"><span className="opacity-80">Amount (PKR)</span><span className="font-semibold">{Number(order.amountPKR || 0).toFixed(2)} PKR</span></div>
            </div>

            <Separator className="bg-[#FF7A5C]/20" />

            <Button onClick={handleVerified} disabled={loading} className="w-full h-12 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" />Sending…</>) : ("I HAVE VERIFIED")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
