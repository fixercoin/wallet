import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, ShoppingCart, TrendingUp } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";

export default function P2PHome() {
  const navigate = useNavigate();
  const { wallet } = useWallet();

  useEffect(() => {
    if (!wallet) return;
  }, [wallet]);

  if (!wallet) {
    return (
      <div
        className="w-full min-h-screen pb-24"
        style={{ fontSize: "10px", backgroundColor: "#0f0f0f", color: "#fff" }}
      >
        <div className="text-center pt-20 text-white/70">
          Please connect your wallet first
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-screen pb-24"
      style={{ fontSize: "10px", backgroundColor: "#0f0f0f", color: "#fff" }}
    >
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-[#1a1a1a] to-transparent p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#22c55e]/20 border border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e]/30 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white uppercase">P2P TRADE</h1>
            <p className="text-xs text-white/60 uppercase">BUY OR SELL CRYPTO</p>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <Button
          onClick={() => navigate("/orders/active")}
          className="w-full h-14 bg-transparent border border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e]/10 font-bold rounded-lg text-base uppercase"
        >
          <MessageSquare className="w-5 h-5 mr-2" />
          ACTIVE ORDERS
        </Button>

        <Button
          onClick={() => navigate("/buy-crypto")}
          className="w-full h-14 bg-transparent border border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e]/10 font-bold rounded-lg text-base uppercase"
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          BUY CRYPTO
        </Button>

        <Button
          onClick={() => navigate("/sell-now")}
          className="w-full h-14 bg-transparent border border-[#FF7A5C] text-[#FF7A5C] hover:bg-[#FF7A5C]/10 font-bold rounded-lg text-base uppercase"
        >
          <TrendingUp className="w-5 h-5 mr-2" />
          SELL CRYPTO
        </Button>
      </div>
    </div>
  );
}
